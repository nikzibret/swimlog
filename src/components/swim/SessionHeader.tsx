import { format } from "date-fns";
import { TimeInput } from "./TimeInput";

interface Props {
  date: string;
  startTime: string;
  poolLength: number;
  customPool: number;
  sessionType: "timed" | "casual";
  onSessionTypeChange: (v: "timed" | "casual") => void;
  onDateChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onPoolLengthChange: (v: number) => void;
  onCustomPoolChange: (v: number) => void;
}

const PRESETS = [25, 50];

export function SessionHeader({
  date,
  startTime,
  poolLength,
  customPool,
  sessionType,
  onSessionTypeChange,
  onDateChange,
  onStartTimeChange,
  onPoolLengthChange,
  onCustomPoolChange,
}: Props) {
  const isCustom = !PRESETS.includes(poolLength);
  const casual = sessionType === "casual";

  return (
    <section className="space-y-4 border-b border-border bg-white px-4 pt-5 pb-5">
      <div className="flex justify-center">
        <div className="flex h-11 min-h-[44px] w-full max-w-[280px] overflow-hidden rounded-full bg-[#F1F5F9] p-1">
          {(["timed", "casual"] as const).map((t) => {
            const active = sessionType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSessionTypeChange(t)}
                className={`flex-1 rounded-full px-3 text-sm font-semibold capitalize transition ${
                  active
                    ? "bg-[#185FA5] text-white shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {t === "timed" ? "Timed" : "Casual"}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">New session</h1>
        <p className="text-xs text-muted-foreground">
          {date ? format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy") : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="input"
          />
        </Field>
        {!casual && (
          <Field label="Start time">
            <TimeInput
              format="HHMMSS"
              value={startTime}
              onValueChange={onStartTimeChange}
              className="input"
            />
          </Field>
        )}
      </div>


      <Field label="Pool length">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-11 rounded-lg border border-border bg-secondary p-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPoolLengthChange(p)}
                className={`h-full min-w-[60px] rounded-md px-3 text-sm font-medium transition ${
                  poolLength === p
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {p}m
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPoolLengthChange(customPool || 33)}
              className={`h-full min-w-[72px] rounded-md px-3 text-sm font-medium transition ${
                isCustom ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              Custom
            </button>
          </div>
          {isCustom && (
            <input
              type="number"
              min={1}
              value={poolLength}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                onCustomPoolChange(v);
                if (v > 0) onPoolLengthChange(v);
              }}
              className="input w-20"
              placeholder="m"
            />
          )}
        </div>
      </Field>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
