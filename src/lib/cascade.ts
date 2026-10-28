import type { Row, ComputedRow } from "./swim-types";
import { parseDuration, parseManualStart } from "./swim-utils";

// Pure derivation. Walks rows, computes start/duration/end for each.
export function computeRows(
  rows: Row[],
  sessionStartSec: number | null,
): ComputedRow[] {
  const out: ComputedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prev = i === 0 ? null : out[i - 1];

    // Start
    let startSec: number | null;
    const prevStartBasis =
      prev?.startSec ?? (i === 0 ? sessionStartSec : null);
    if (row.isManualStart) {
      startSec = parseManualStart(row.startInput, prevStartBasis);
    } else if (i === 0) {
      startSec = sessionStartSec;
    } else if (prev) {
      startSec =
        prev.startSec != null && prev.durationSec != null
          ? prev.startSec + prev.durationSec
          : null;
    } else {
      startSec = null;
    }

    // Duration
    let durationSec: number | null = null;
    if (row.isManualDuration) {
      durationSec = parseDuration(row.durationInput);
    } else {
      const next = rows[i + 1];
      if (next && next.isManualStart) {
        const nextStart = parseManualStart(next.startInput, startSec);
        if (nextStart != null && startSec != null) {
          durationSec = nextStart - startSec;
        }
      }
    }

    const endSec =
      startSec != null && durationSec != null ? startSec + durationSec : null;

    out.push({
      startSec,
      durationSec,
      endSec,
      durationNegative: durationSec != null && durationSec < 0,
    });
  }

  return out;
}

export interface Totals {
  totalLaps: number;
  totalDistance: number;
  activeSec: number;
  totalSec: number;
  paceSecPer100: number | null;
}

export function computeTotals(
  rows: Row[],
  computed: ComputedRow[],
  poolLength: number,
): Totals {
  let totalLaps = 0;
  let activeSec = 0;
  let restSec = 0;

  rows.forEach((r, i) => {
    const c = computed[i];
    const dur = c.durationSec ?? 0;
    if (r.kind === "set") {
      totalLaps += r.laps ?? 0;
      if (dur > 0) activeSec += dur;
    } else {
      if (dur > 0) restSec += dur;
    }
  });

  const totalDistance = totalLaps * poolLength * 2;
  const totalSec = activeSec + restSec;
  const paceSecPer100 =
    totalDistance > 0 && activeSec > 0
      ? (activeSec / totalDistance) * 100
      : null;

  return { totalLaps, totalDistance, activeSec, totalSec, paceSecPer100 };
}
