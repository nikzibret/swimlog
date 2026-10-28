import { formatDuration } from "@/lib/swim-utils";
import type { Totals } from "@/lib/cascade";

interface Props {
  totals: Totals;
  calories: number | null;
  caloriesDisabledReason?: string;
  casual?: boolean;
}

export function TotalsBar({ totals, calories, caloriesDisabledReason, casual = false }: Props) {
  const items = casual
    ? [
        { label: "Distance", value: `${totals.totalDistance.toLocaleString()}m` },
        {
          label: "Calories",
          value: calories != null ? `~${calories.toLocaleString()} kcal` : "— kcal",
          title: calories == null ? caloriesDisabledReason : undefined,
        },
      ]
    : [
    { label: "Distance", value: `${totals.totalDistance.toLocaleString()}m` },
    { label: "Active", value: formatDuration(totals.activeSec) || "—" },
    {
      label: "Pace /100m",
      value:
        totals.paceSecPer100 != null
          ? formatDuration(Math.round(totals.paceSecPer100))
          : "—",
    },
    {
      label: "Calories",
      value: calories != null ? `~${calories.toLocaleString()} kcal` : "— kcal",
      title: calories == null ? caloriesDisabledReason : undefined,
    },
  ];
  return (
    <div
      className="fixed left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-white/95 px-4 py-2.5 backdrop-blur"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      {casual && (
        <div className="mb-1 text-center text-[11px] text-muted-foreground">
          Casual session
        </div>
      )}
      <div className={`grid gap-2 ${casual ? "grid-cols-2" : "grid-cols-4"}`}>
        {items.map((it) => (
          <div key={it.label} className="text-center" title={it.title}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {it.label}
            </div>
            <div className="text-sm font-semibold tabular-nums">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
