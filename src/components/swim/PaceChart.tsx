import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

export interface PacePoint {
  date: string; // ISO date (YYYY-MM-DD)
  paceSec: number; // seconds per 100m
}

function fmtMMSS(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function PaceChart({ points }: { points: PacePoint[] }) {
  const { data, options } = useMemo(() => {
    const labels = points.map((p) => fmtShortDate(p.date));
    const values = points.map((p) => p.paceSec);
    const isoDates = points.map((p) => p.date);

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Pace",
            data: values,
            borderColor: "#185FA5",
            backgroundColor: "rgba(24, 95, 165, 0.12)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#185FA5",
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items: { dataIndex: number }[]) =>
                fmtDate(isoDates[items[0].dataIndex]),
              label: (ctx: { parsed: { y: number } }) =>
                `${fmtMMSS(ctx.parsed.y)} /100m`,
            },
          },
        },
        scales: {
          y: {
            reverse: true,
            ticks: {
              callback: (val: string | number) => fmtMMSS(Number(val)),
              font: { size: 10 },
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
        },
      } as const,
    };
  }, [points]);

  return (
    <div className="h-56 w-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Line data={data} options={options as any} />
    </div>
  );
}
