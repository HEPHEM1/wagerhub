"use client";

import { useEffect, useRef } from "react";

export type ShotType = "WIN" | "SAVE" | "MISS";
export interface ShotScenario {
  type: ShotType;
  targetZoneId: number;    // zone user aimed at
  keeperZoneId: number;    // zone keeper dives to
}

const CW = 800;
const CH = 340;

// Inner goal boundaries
const POST_W = 30;
const BAR_H  = 30;
const GOAL_L = POST_W;
const GOAL_R = CW - POST_W;
const GOAL_T = BAR_H;

// 3×2 zone centres inside the goal
const ZONE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: 153, y: 107 },
  1: { x: 400, y: 107 },
  2: { x: 647, y: 107 },
  3: { x: 153, y: 262 },
  4: { x: 400, y: 262 },
  5: { x: 647, y: 262 },
};

// Woodwork clip targets (near post/bar junctions)
const MISS_TARGETS = [
  { x: 38,  y: 160 },   // left post
  { x: 762, y: 160 },   // right post
  { x: 200, y: 22  },   // crossbar (left side)
  { x: 600, y: 22  },   // crossbar (right side)
];

/* ─────────── drawing helpers ─────────── */

function drawNet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(GOAL_L, GOAL_T, GOAL_R - GOAL_L, CH - GOAL_T);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let x = GOAL_L; x <= GOAL_R; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, GOAL_T); ctx.lineTo(x, CH); ctx.stroke();
  }
  for (let y = GOAL_T; y <= CH; y += 28) {
    ctx.beginPath(); ctx.moveTo(GOAL_L, y); ctx.lineTo(GOAL_R, y); ctx.stroke();
  }
}

function drawFrame(ctx: CanvasRenderingContext2D) {
  // Post gradient helper
  const vGrad = (x: number) => {
    const g = ctx.createLinearGradient(x - POST_W / 2, 0, x + POST_W / 2, 0);
    g.addColorStop(0, "#999"); g.addColorStop(0.45, "#fff"); g.addColorStop(1, "#aaa");
    return g;
  };
  ctx.fillStyle = vGrad(POST_W / 2);
  ctx.fillRect(0, BAR_H, POST_W, CH - BAR_H);
  ctx.fillStyle = vGrad(CW - POST_W / 2);
  ctx.fillRect(CW - POST_W, BAR_H, POST_W, CH - BAR_H);

  const hGrad = ctx.createLinearGradient(0, 0, 0, BAR_H);
  hGrad.addColorStop(0, "#aaa"); hGrad.addColorStop(0.5, "#fff"); hGrad.addColorStop(1, "#bbb");
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, CW, BAR_H);
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.stroke();
  // Pentagon patches
  ctx.fillStyle = "#1a1a1a";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r * 0.48;
    const py = Math.sin(a) * r * 0.48;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const pa = a + (j / 5) * Math.PI * 2;
      const qx = px + Math.cos(pa) * r * 0.22;
      const qy = py + Math.sin(pa) * r * 0.22;
      j === 0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, diving: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (diving) { ctx.rotate(-0.45); ctx.translate(-20, -20); }

  // Shadow
  ctx.beginPath(); ctx.ellipse(0, 56, 22, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill();

  // Legs (dark navy shorts)
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0a1128"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-9, 18); ctx.lineTo(-12, 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 9, 18); ctx.lineTo( 12, 52); ctx.stroke();

  // Boots
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(-12, 55, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 12, 55, 8, 5,  0.3, 0, Math.PI * 2); ctx.fill();

  // Shorts
  ctx.fillStyle = "#0a1128";
  ctx.beginPath(); ctx.roundRect(-17, 12, 34, 18, 5); ctx.fill();

  // Jersey — bright yellow
  ctx.fillStyle = "#FFD700";
  ctx.beginPath(); ctx.roundRect(-18, -20, 36, 34, 6); ctx.fill();

  // Jersey collar
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.roundRect(-6, -20, 12, 8, 3); ctx.fill();

  // Jersey number
  ctx.fillStyle = "#000"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
  ctx.fillText("1", 0, -3);

  // Arms
  ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 9;
  if (diving) {
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(-38, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 18, -14); ctx.lineTo( 42, -8 ); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(-32,  4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 18, -14); ctx.lineTo( 32,  4); ctx.stroke();
  }

  // Gloves — green keeper gloves
  ctx.fillStyle = "#00AA44";
  const gx = diving ? -40 : -34, gy = diving ? -24 : 6;
  ctx.beginPath(); ctx.arc(gx, gy, 7, 0, Math.PI * 2); ctx.fill();
  const gx2 = diving ? 44 : 34, gy2 = diving ? -10 : 6;
  ctx.beginPath(); ctx.arc(gx2, gy2, 7, 0, Math.PI * 2); ctx.fill();

  // Neck
  ctx.fillStyle = "#FDBCB4";
  ctx.beginPath(); ctx.roundRect(-5, -30, 10, 12, 2); ctx.fill();

  // Head
  ctx.beginPath(); ctx.arc(0, -42, 15, 0, Math.PI * 2);
  ctx.fillStyle = "#FDBCB4"; ctx.fill();

  // Hair
  ctx.fillStyle = "#3b2314";
  ctx.beginPath(); ctx.arc(0, -48, 14, Math.PI, 0); ctx.fill();

  // Eyes
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-5, -42, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 5, -42, 2.5, 0, Math.PI * 2); ctx.fill();

  // Keeper cap
  ctx.fillStyle = "#FF6600";
  ctx.beginPath(); ctx.ellipse(0, -54, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-15, -59, 30, 6);
  ctx.beginPath(); ctx.moveTo(15, -59); ctx.lineTo(22, -56); ctx.lineTo(15, -53); ctx.fill();

  ctx.restore();
}

/* ─────────── main component ─────────── */

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
    let engineRef: any = null;
    let worldRef:  any = null;
    let runnerRef: any = null;

    const BALL_R = 16;
    const BALL_START = { x: CW / 2, y: CH - BALL_R - 5 };

    // Determine keeper & ball targets
    const keeperTarget = ZONE_COORDS[scenario.keeperZoneId];
    let ballTarget: { x: number; y: number };
    if (scenario.type === "WIN" || scenario.type === "SAVE") {
      ballTarget = ZONE_COORDS[scenario.targetZoneId];
    } else {
      ballTarget = MISS_TARGETS[Math.floor(Math.random() * MISS_TARGETS.length)];
    }

    let ballX = BALL_START.x, ballY = BALL_START.y;
    let ballVX = 0, ballVY = 0;
    let ballRot = 0;

    let keeperX = CW / 2, keeperY = CH / 2;
    let keeperDiving = false;
    let launched = false;
    let completed = false;
    let start: number | null = null;
    let hasHit = false;

    const LAUNCH_DELAY = 250;   // ms
    const KEEPER_DELAY = 180;   // ms — keeper starts moving
    const TOTAL_DUR   = 2600;   // ms — call onComplete

    const speed = 14;
    const dx = ballTarget.x - BALL_START.x;
    const dy = ballTarget.y - BALL_START.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetVX = (dx / dist) * speed;
    const targetVY = (dy / dist) * speed;

    import("matter-js").then((Matter) => {
      const { Engine, World, Bodies, Body, Runner, Events } = Matter;

      const engine = Engine.create({ gravity: { x: 0, y: 0 } });
      engineRef = engine;
      worldRef = engine.world;

      // Static woodwork bodies
      const leftPost  = Bodies.rectangle(POST_W / 2, CH / 2, POST_W, CH, { isStatic: true, restitution: 0.85, label: "post" });
      const rightPost = Bodies.rectangle(CW - POST_W / 2, CH / 2, POST_W, CH, { isStatic: true, restitution: 0.85, label: "post" });
      const crossbar  = Bodies.rectangle(CW / 2, BAR_H / 2, CW, BAR_H, { isStatic: true, restitution: 0.85, label: "bar" });

      // Keeper body (sensor, positioned at keeper target for SAVE)
      const keeperBody = Bodies.rectangle(
        scenario.type === "SAVE" ? keeperTarget.x : -999,
        scenario.type === "SAVE" ? keeperTarget.y : -999,
        52, 90,
        { isStatic: true, isSensor: false, restitution: 0.55, label: "keeper" }
      );

      // Ball physics body
      const ballBody = Bodies.circle(BALL_START.x, BALL_START.y, BALL_R, {
        restitution: 0.65, friction: 0.05, frictionAir: 0.005, label: "ball"
      });

      World.add(engine.world, [leftPost, rightPost, crossbar, keeperBody, ballBody]);

      // Collision → mark hit so we know deflection happened
      Events.on(engine, "collisionStart", (event: any) => {
        const pairs = event.pairs;
        for (const pair of pairs) {
          const labels = [pair.bodyA.label, pair.bodyB.label];
          if (labels.includes("ball") && (labels.includes("post") || labels.includes("bar") || labels.includes("keeper"))) {
            hasHit = true;
          }
        }
      });

      const runner = Runner.create();
      runnerRef = runner;

      const loop = (ts: number) => {
        if (!start) start = ts;
        const elapsed = ts - start;

        // 1 — move keeper smoothly
        if (elapsed < KEEPER_DELAY) {
          const t = elapsed / KEEPER_DELAY;
          const e = 1 - Math.pow(1 - t, 3);
          keeperX = CW / 2 + (keeperTarget.x - CW / 2) * e;
          keeperY = CH / 2 + (keeperTarget.y - CH / 2) * e;
        } else {
          keeperX = keeperTarget.x;
          keeperY = keeperTarget.y;
          keeperDiving = elapsed < KEEPER_DELAY + 600;
          Body.setPosition(keeperBody, {
            x: scenario.type === "SAVE" ? keeperX : -999,
            y: scenario.type === "SAVE" ? keeperY : -999,
          });
        }

        // 2 — launch ball
        if (elapsed > LAUNCH_DELAY && !launched) {
          launched = true;
          Body.setVelocity(ballBody, { x: targetVX, y: targetVY });
        }

        // 3 — step physics
        if (launched) {
          Engine.update(engine, 1000 / 60);
          ballX = ballBody.position.x;
          ballY = ballBody.position.y;
          ballRot += 0.06;
        }

        // 4 — draw frame
        ctx.clearRect(0, 0, CW, CH);
        drawNet(ctx);
        drawFrame(ctx);
        drawKeeper(ctx, keeperX, keeperY, keeperDiving);
        drawBall(ctx, ballX, ballY, BALL_R, ballRot);

        // 5 — complete
        if (elapsed > TOTAL_DUR && !completed) {
          completed = true;
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
      if (engineRef && worldRef) {
        import("matter-js").then(({ World, Engine }) => {
          World.clear(worldRef, false);
          Engine.clear(engineRef);
        });
      }
    };
  }, [scenario]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="absolute inset-0 w-full h-full z-40 pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}
