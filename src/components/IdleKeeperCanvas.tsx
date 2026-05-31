"use client";

import { useEffect, useRef } from "react";

const CW = 800;
const CH = 340;
const POST_W = 28;
const BAR_H  = 28;

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

function drawIdleKeeper(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  // Shadow
  ctx.beginPath(); ctx.ellipse(0, 68, 28, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fill();

  // Legs
  ctx.lineCap = "round"; ctx.strokeStyle = "#0a1128"; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(-11, 24); ctx.lineTo(-14, 62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 11, 24); ctx.lineTo( 14, 62); ctx.stroke();

  // Boots
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(-14, 66, 10, 6, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 14, 66, 10, 6,  0.25, 0, Math.PI * 2); ctx.fill();

  // Shorts
  ctx.fillStyle = "#0a1128";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-20, 14, 40, 20, 5); else ctx.rect(-20,14,40,20); ctx.fill();

  // Jersey
  ctx.fillStyle = "#FFD700";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-22, -24, 44, 40, 7); else ctx.rect(-22,-24,44,40); ctx.fill();

  // Collar
  ctx.fillStyle = "#222";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-7, -24, 14, 10, 3); else ctx.rect(-7,-24,14,10); ctx.fill();

  // Number
  ctx.fillStyle = "#111"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("1", 0, -5);

  // Arms (idle — relaxed)
  ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-36, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 22, -18); ctx.lineTo( 36, 6); ctx.stroke();

  // Gloves
  ctx.fillStyle = "#00AA44";
  ctx.beginPath(); ctx.arc(-38, 8, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 38, 8, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#006622"; ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(-38 + i * 3, -1); ctx.lineTo(-38 + i * 3, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 38 + i * 3, -1); ctx.lineTo( 38 + i * 3, 17); ctx.stroke();
  }

  // Neck
  ctx.fillStyle = "#FDBCB4";
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-6, -34, 12, 12, 2); else ctx.rect(-6,-34,12,12); ctx.fill();

  // Head
  ctx.beginPath(); ctx.arc(0, -50, 18, 0, Math.PI * 2); ctx.fillStyle = "#FDBCB4"; ctx.fill();

  // Hair
  ctx.fillStyle = "#3b2314"; ctx.beginPath(); ctx.arc(0, -56, 17, Math.PI, 0); ctx.fill();

  // Cap
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

export default function IdleKeeperCanvas({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CW, CH);
    drawNet(ctx);
    drawFrame(ctx);
    drawIdleKeeper(ctx, CW / 2, 220);
  }, []);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="absolute inset-0 w-full h-full z-30 pointer-events-none rounded-t-xl"
    />
  );
}
