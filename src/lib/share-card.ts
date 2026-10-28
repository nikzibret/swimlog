import { format, parseISO } from "date-fns";
import { formatDuration } from "./swim-utils";

export interface ShareCardData {
  date: string; // yyyy-MM-dd
  distance: number; // metres
  paceSecPer100: number | null;
  activeSec: number;
  totalSec: number;
}

function fmtPace(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")} /100m`;
}

export async function generateAndDownloadShareCard(data: ShareCardData) {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";

  const dateLabel = format(parseISO(data.date), "EEEE, d MMMM yyyy");
  const distLabel = `${data.distance.toLocaleString()}m`;
  const paceLabel = fmtPace(data.paceSecPer100);
  const activeLabel = formatDuration(data.activeSec);
  const totalLabel = formatDuration(data.totalSec);

  const padX = 80;

  // Date (top)
  ctx.font = "500 32px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "left";
  ctx.fillText(dateLabel, padX, 130);

  // Distance (huge)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 180px -apple-system, system-ui, sans-serif";
  ctx.fillText(distLabel, padX, 320);

  ctx.font = "500 28px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("TOTAL DISTANCE", padX, 360);

  // Pace
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 96px -apple-system, system-ui, sans-serif";
  ctx.fillText(paceLabel, padX, 500);
  ctx.font = "500 24px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("PACE", padX, 535);

  // Active + Total side-by-side
  const rowY = 660;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px -apple-system, system-ui, sans-serif";
  ctx.fillText(activeLabel, padX, rowY);
  ctx.font = "500 22px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("ACTIVE TIME", padX, rowY + 32);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px -apple-system, system-ui, sans-serif";
  ctx.fillText(totalLabel, padX + 460, rowY);
  ctx.font = "500 22px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("TOTAL TIME", padX + 460, rowY + 32);

  // Sine waves at bottom
  drawSineWaves(ctx, size);

  // App URL bottom-right
  ctx.font = "500 22px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "right";
  ctx.fillText("Swim Log", size - padX, size - 50);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `swim-${data.date}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawSineWaves(ctx: CanvasRenderingContext2D, size: number) {
  const baseY = size - 180;
  const waves = [
    { amp: 36, freq: 0.012, phase: 0, alpha: 1, offsetY: 0, width: 4 },
    { amp: 28, freq: 0.016, phase: 1.2, alpha: 0.55, offsetY: 28, width: 3 },
    { amp: 22, freq: 0.02, phase: 2.4, alpha: 0.3, offsetY: 56, width: 2.5 },
  ];

  for (const w of waves) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${w.alpha})`;
    ctx.lineWidth = w.width;
    ctx.lineCap = "round";
    for (let x = 0; x <= size; x += 2) {
      const y = baseY + w.offsetY + Math.sin(x * w.freq + w.phase) * w.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
