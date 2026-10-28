import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Row, ComputedRow } from "@/lib/swim-types";
import {
  EQUIPMENT_OPTIONS,
  STROKES,
  type Stroke,
} from "@/lib/supabase";
import { formatDuration, formatStartMMSS, formatEndTime } from "@/lib/swim-utils";
import { TimeInput } from "./TimeInput";

interface Props {
  index: number;
  row: Row;
  computed: ComputedRow;
  poolLength: number;
  hourTag: string | null;
  casual?: boolean;
  onChange: (next: Partial<Row>) => void;
  onRemove: () => void;
}

export function SetRow({
  index,
  row,
  computed,
  poolLength,
  hourTag,
  casual = false,
  onChange,
  onRemove,
}: Props) {

  const distance =
    row.laps && row.laps > 0 ? row.laps * poolLength * 2 : null;

  const autoStart = formatStartMMSS(computed.startSec);
  const autoDuration = formatDuration(computed.durationSec);
  const endTimeHint = formatEndTime(computed.endSec);

  const startDisplay = row.isManualStart ? row.startInput : autoStart;
  const durationDisplay = row.isManualDuration
    ? row.durationInput
    : autoDuration || row.durationInput;

  return (
    <div className="relative rounded-xl border border-border bg-white p-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        aria-label="Remove set"
      >
        <X size={16} />
      </button>

      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">
          {index + 1}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Set
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Stroke">
          <select
            value={row.stroke ?? "Freestyle"}
            onChange={(e) => onChange({ stroke: e.target.value as Stroke })}
            className="input"
          >
            {STROKES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Laps"
          hint={distance != null ? `${row.laps} laps → ${distance}m` : "— m"}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={row.laps ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ laps: v === "" ? null : Math.max(0, Number(v)) });
            }}
            placeholder="0"
            className="input"
          />
        </Field>
      </div>

      <EquipmentSection
        selected={row.equipment ?? []}
        onChange={(eq) => onChange({ equipment: eq })}
      />


      {!casual && (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Start time">
          <div className="flex items-center gap-1.5">
            {hourTag && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">
                {hourTag}
              </span>
            )}
            <TimeInput
              format="MMSS"
              value={startDisplay}
              onValueChange={(v) => {
                if (v === "") {
                  onChange({ startInput: "", isManualStart: false });
                } else {
                  onChange({ startInput: v, isManualStart: true });
                }
              }}
              className={`input flex-1 ${
                !row.isManualStart ? "is-auto" : ""
              }`}
            />
          </div>
        </Field>
        <Field
          label="Duration"
          hint={endTimeHint ? `ends ${endTimeHint}` : undefined}
        >
          <TimeInput
            format="MMSS"
            value={durationDisplay}
            onValueChange={(v) => {
              if (v === "") {
                onChange({ durationInput: "", isManualDuration: false });
              } else {
                onChange({ durationInput: v, isManualDuration: true });
              }
            }}
            className={`input ${
              !row.isManualDuration ? "is-auto" : ""
            } ${computed.durationNegative ? "is-error" : ""}`}
          />
        </Field>
      </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function EquipmentSection({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 py-1 text-left"
      >
        <span className="flex flex-1 flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Equipment
          </span>
          {!open &&
            selected.map((eq) => (
              <span
                key={eq}
                className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary"
              >
                {eq}
              </span>
            ))}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="no-scrollbar -mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1">
          {EQUIPMENT_OPTIONS.map((eq) => {
            const on = selected.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                onClick={() => {
                  const set = new Set(selected);
                  if (on) set.delete(eq);
                  else set.add(eq);
                  onChange(Array.from(set));
                }}
                className={`chip ${on ? "is-active" : ""}`}
              >
                {eq}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
