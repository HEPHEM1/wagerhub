"use client";

import { useEffect, useRef } from "react";

export type ShotType = "WIN" | "SAVE" | "MISS";
export interface ShotScenario {
  type: ShotType;
  targetZoneId: number;
  keeperZoneId: number;
}

// Canvas dimensions
const CW = 800;
const CH = 340;
const POST_W = 28;
const BAR_H  = 28;

// Keeper visual size
const KW = 90;  // hitbox width
const KH = 150; // hitbox height (standing)

// Zone centres inside goal
const ZONE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: 155, y: 100 },
  1: { x: 400, y: 100 },
  2: { x: 645, y: 100 },
  3: { x: 155, y: 250 },
  4: { x: 400, y: 250 },
  5: { x: 645, y: 250 },
};

// Dive angle per zone (radians). Negative = lean/fall left, positive = right
const ZONE_ANGLE: Record<number, number> = {
  0: -1.45,   // full left dive
  1: -0.25,   // slight left lean (top centre)
  2:  1.45,   // full right dive
  3: -1.45,   // full left dive
  4:  0.0,    // drop straight down
  5:  1.45,   // full right dive
};

// Woodwork miss targets
const MISS_TARGETS = [
  { x: 38,  y: 155 },
  { x: 762, y: 155 },
  { x: 200, y: 20  },
  { x: 600, y: 20  },
];

// Keeper idle position: lower-centre of goal
const IDLE_X = CW / 2;
const IDLE_Y = 220;
const IDLE_ANGLE = 0;

// Ease-out quadratic: fast start, slow finish
function easeOutQuad(t: number) {
  return t * (2 - t);
}

// ─── Draw helpers ────────────────────────────────────────────────────────────

function drawNet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(POST_W, BAR_H, CW - POST_W * 2, CH - BAR_H);
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 1;
  for (let x = POST_W; x <= CW - POST_W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, BAR_H); ctx.lineTo(x, CH); ctx.stroke();
  }
  for (let y = BAR_H; y <= CH; y += 30) {
    ctx.beginPath(); ctx.moveTo(POST_W, y); ctx.lineTo(CW - POST_W, y); ctx.stroke();
  }
}

function drawFrame(ctx: CanvasRenderingContext2D) {
  const vg = (cx: number) => {
    const g = ctx.createLinearGradient(cx - POST_W / 2, 0, cx + POST_W / 2, 0);
    g.addColorStop(0, "#888"); g.addColorStop(0.45, "#fff"); g.addColorStop(1, "#aaa");
    return g;
  };
  ctx.fillStyle = vg(POST_W / 2);
  ctx.fillRect(0, BAR_H, POST_W, CH - BAR_H);
  ctx.fillStyle = vg(CW - POST_W / 2);
  ctx.fillRect(CW - POST_W, BAR_H, POST_W, CH - BAR_H);
  const hg = ctx.createLinearGradient(0, 0, 0, BAR_H);
  hg.addColorStop(0, "#999"); hg.addColorStop(0.5, "#fff"); hg.addColorStop(1, "#bbb");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, CW, BAR_H);
}

/**
 * Draw goalkeeper figure centred at (0,0), upright.
 * Canvas should already be translated + rotated before calling.
 * `extended` = arms out wide (diving pose).
 */
function drawKeeperFigure(ctx: CanvasRenderingContext2D, extended: boolean) {
  ctx.save();

  // Shadow (always horizontal under body regardless of rotation)
  ctx.beginPath();
  ctx.ellipse(0, 68, 28, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();

  // Legs
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0a1128";
  ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(-11, 24); ctx.lineTo(-14, 62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 11, 24); ctx.lineTo( 14, 62); ctx.stroke();

  // Boots
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(-14, 66, 10, 6, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 14, 66, 10, 6,  0.25, 0, Math.PI * 2); ctx.fill();

  // Shorts (dark navy)
  ctx.fillStyle = "#0a1128";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-20, 14, 40, 20, 5); else ctx.rect(-20,14,40,20); ctx.fill();

  // Yellow jersey body
  ctx.fillStyle = "#FFD700";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-22, -24, 44, 40, 7); else ctx.rect(-22,-24,44,40); ctx.fill();

  // Jersey collar
  ctx.fillStyle = "#222";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-7, -24, 14, 10, 3); else ctx.rect(-7,-24,14,10); ctx.fill();

  // Jersey number "1"
  ctx.fillStyle = "#111"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("1", 0, -5);

  // Arms — wide if diving, relaxed if idle
  ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 12;
  if (extended) {
    ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-52, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 22, -18); ctx.lineTo( 52, -10); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-36, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 22, -18); ctx.lineTo( 36, 6); ctx.stroke();
  }

  // Gloves (bright green)
  ctx.fillStyle = "#00AA44";
  const gLx = extended ? -54 : -38, gLy = extended ? -12 : 8;
  const gRx = extended ?  54 :  38, gRy = extended ? -12 : 8;
  ctx.beginPath(); ctx.arc(gLx, gLy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(gRx, gRy, 9, 0, Math.PI * 2); ctx.fill();

  // Glove detail lines
  ctx.strokeStyle = "#006622"; ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(gLx + i * 3, gLy - 9); ctx.lineTo(gLx + i * 3, gLy + 9); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gRx + i * 3, gRy - 9); ctx.lineTo(gRx + i * 3, gRy + 9); ctx.stroke();
  }

  // Neck
  ctx.fillStyle = "#FDBCB4";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-6, -34, 12, 12, 2); else ctx.rect(-6,-34,12,12); ctx.fill();

  // Head
  ctx.beginPath(); ctx.arc(0, -50, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#FDBCB4"; ctx.fill();

  // Hair
  ctx.fillStyle = "#3b2314";
  ctx.beginPath(); ctx.arc(0, -56, 17, Math.PI, 0); ctx.fill();

  // Keeper cap (orange brim)
  ctx.fillStyle = "#FF6600";
  ctx.beginPath(); ctx.ellipse(0, -64, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-18, -72, 36, 8);
  ctx.beginPath(); ctx.moveTo(18, -72); ctx.lineTo(27, -68); ctx.lineTo(18, -64); ctx.closePath(); ctx.fill();

  // Eyes
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-6, -50, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -50, 3, 0, Math.PI * 2); ctx.fill();

  // Mouth
  ctx.strokeStyle = "#a05050"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -44, 5, 0.2, Math.PI - 0.2); ctx.stroke();

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r * 0.47, py = Math.sin(a) * r * 0.47;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const pa = a + (j / 5) * Math.PI * 2;
      const qx = px + Math.cos(pa) * r * 0.21, qy = py + Math.sin(pa) * r * 0.21;
      j === 0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PenaltyPhysicsCanvas({
  scenario,
  onComplete,
}: {
  scenario: ShotScenario;
  onComplete: (result: "goal" | "saved" | "missed") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window === "undefined") return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    let rafId: number;
    let matterEngine: any = null;
    let matterWorld: any = null;

    const BALL_R = 17;
    const BALL_START = { x: CW / 2, y: CH - BALL_R - 4 };
    const DIVE_DURATION = 420;  // ms — keeper dive animation
    const LAUNCH_DELAY  = 260;  // ms — ball launches after this
    const TOTAL_DUR     = 2700; // ms — call onComplete

    const kTarget = ZONE_COORDS[scenario.keeperZoneId];
    const kTargetAngle = ZONE_ANGLE[scenario.keeperZoneId];
    const isLeftDive  = kTargetAngle < -0.5;
    const isRightDive = kTargetAngle >  0.5;

    // Ball target
    let ballTarget: { x: number; y: number };
    if (scenario.type === "WIN" || scenario.type === "SAVE") {
      ballTarget = ZONE_COORDS[scenario.targetZoneId];
    } else {
      ballTarget = MISS_TARGETS[Math.floor(Math.random() * MISS_TARGETS.length)];
    }

    // Ball velocity
    const SPEED = 13;
    const dx = ballTarget.x - BALL_START.x;
    const dy = ballTarget.y - BALL_START.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetVX = (dx / dist) * SPEED;
    const targetVY = (dy / dist) * SPEED;

    // Keeper animation state (smooth tween)
    let kX = IDLE_X, kY = IDLE_Y, kAngle = IDLE_ANGLE;
    let launched = false, completed = false;
    let start: number | null = null;
    let ballX = BALL_START.x, ballY = BALL_START.y, ballRot = 0;

    import("matter-js").then((Matter) => {
      const { Engine, World, Bodies, Body, Events } = Matter;

      const engine = Engine.create({ gravity: { x: 0, y: 0.05 } }); // tiny gravity so ball arcs slightly
      matterEngine = engine;
      matterWorld = engine.world;

      // Goal posts (static)
      const leftPost  = Bodies.rectangle(POST_W / 2, CH / 2, POST_W, CH, { isStatic: true, restitution: 0.9, label: "post" });
      const rightPost = Bodies.rectangle(CW - POST_W / 2, CH / 2, POST_W, CH, { isStatic: true, restitution: 0.9, label: "post" });
      const crossbar  = Bodies.rectangle(CW / 2, BAR_H / 2, CW, BAR_H, { isStatic: true, restitution: 0.9, label: "bar" });

      // Keeper body — starts idle
      const keeperBody = Bodies.rectangle(IDLE_X, IDLE_Y, KW, KH, {
        isStatic: true,
        restitution: 0.55,
        label: "keeper",
        // Only add as obstacle for SAVE scenario
        isSensor: scenario.type !== "SAVE",
      });

      // Ball body
      const ballBody = Bodies.circle(BALL_START.x, BALL_START.y, BALL_R, {
        restitution: 0.65,
        friction: 0.04,
        frictionAir: 0.003,
        label: "ball",
      });

      World.add(engine.world, [leftPost, rightPost, crossbar, keeperBody, ballBody]);

      // On collision, record hit for miss detection
      let hasHit = false;
      Events.on(engine, "collisionStart", (ev: any) => {
        for (const p of ev.pairs) {
          const ls = [p.bodyA.label, p.bodyB.label];
          if (ls.includes("ball") && (ls.includes("post") || ls.includes("bar") || ls.includes("keeper"))) {
            hasHit = true;
          }
        }
      });

      const loop = (ts: number) => {
        if (!start) start = ts;
        const elapsed = ts - start;

        // ── 1. Tween keeper position + angle ──────────────────────────────────
        const rawT = Math.min(elapsed / DIVE_DURATION, 1);
        const t    = easeOutQuad(rawT);

        kX     = IDLE_X     + (kTarget.x     - IDLE_X)     * t;
        kY     = IDLE_Y     + (kTarget.y     - IDLE_Y)     * t;
        kAngle = IDLE_ANGLE + (kTargetAngle  - IDLE_ANGLE) * t;

        // Sync matter-js body
        Body.setPosition(keeperBody, { x: kX, y: kY });
        Body.setAngle(keeperBody, kAngle);

        // ── 2. Launch ball after delay ─────────────────────────────────────────
        if (elapsed > LAUNCH_DELAY && !launched) {
          launched = true;
          Body.setVelocity(ballBody, { x: targetVX, y: targetVY });
        }

        // ── 3. Step physics engine ─────────────────────────────────────────────
        if (launched) {
          Engine.update(engine, 1000 / 60);
          ballX   = ballBody.position.x;
          ballY   = ballBody.position.y;
          ballRot += 0.07;
        }

        // ── 4. Render frame ────────────────────────────────────────────────────
        ctx.clearRect(0, 0, CW, CH);
        drawNet(ctx);
        drawFrame(ctx);

        // Keeper — translate + rotate canvas, then draw figure
        ctx.save();
        ctx.translate(kX, kY);
        ctx.rotate(kAngle);
        const isDiving = rawT > 0.15;
        drawKeeperFigure(ctx, isDiving);
        ctx.restore();

        // Ball (only once launched)
        if (launched) drawBall(ctx, ballX, ballY, BALL_R, ballRot);
        // Pre-launch: show ball at spot
        else drawBall(ctx, BALL_START.x, BALL_START.y, BALL_R, 0);

        // ── 5. Complete ────────────────────────────────────────────────────────
        if (elapsed > TOTAL_DUR && !completed) {
          completed = true;
          cancelAnimationFrame(rafId);
          const result =
            scenario.type === "WIN" ? "goal" :
            scenario.type === "SAVE" ? "saved" : "missed";
          onComplete(result);
          return;
        }

        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (matterEngine && matterWorld) {
        import("matter-js").then(({ World, Engine }) => {
          World.clear(matterWorld, false);
          Engine.clear(matterEngine);
        });
      }
    };
  }, [scenario]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="absolute inset-0 w-full h-full z-40 pointer-events-none rounded-t-xl"
    />
  );
}
