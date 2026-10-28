import { X, Clock } from "lucide-react";
import type { Row, ComputedRow } from "@/lib/swim-types";
import { formatDuration, formatEndTime } from "@/lib/swim-utils";
import { TimeInput } from "./TimeInput";

interface Props {
  row: Row;
  computed: ComputedRow;
  onChange: (next: Partial<Row>) => void;
  onRemove: () => void;
}

export function RestRow({ row, computed, onChange, onRemove }: Props) {
  const auto = formatDuration(computed.durationSec);
  const display = row.isManualDuration ? row.durationInput : auto || row.durationInput;
  const endTimeHint = formatEndTime(computed.endSec);

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-2.5">
      <Clock size={14} className="text-muted-foreground" />
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Rest
      </span>
      <div className="ml-auto flex flex-col items-end gap-0.5">
        <TimeInput
          format="MMSS"
          value={display}
          onValueChange={(v) => {
            if (v === "") onChange({ durationInput: "", isManualDuration: false });
            else onChange({ durationInput: v, isManualDuration: true });
          }}
          className={`input h-9 w-24 text-center ${
            !row.isManualDuration ? "is-auto" : ""
          } ${computed.durationNegative ? "is-error" : ""}`}
        />
        {endTimeHint && (
          <span className="text-xs text-muted-foreground">ends {endTimeHint}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white"
        aria-label="Remove rest"
      >
        <X size={16} />
      </button>
    </div>
  );
}
