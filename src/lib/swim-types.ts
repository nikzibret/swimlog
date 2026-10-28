import type { Stroke } from "./supabase";

export type RowKind = "set" | "rest";

export interface Row {
  id: string;
  kind: RowKind;
  // SET fields
  stroke?: Stroke;
  laps?: number | null;
  equipment?: string[];
  // timing — raw user input
  startInput: string;
  durationInput: string;
  isManualStart: boolean;
  isManualDuration: boolean;
}

export interface ComputedRow {
  startSec: number | null;
  durationSec: number | null;
  endSec: number | null;
  durationNegative: boolean;
}

export function newSetRow(): Row {
  return {
    id: crypto.randomUUID(),
    kind: "set",
    stroke: "Freestyle",
    laps: null,
    equipment: [],
    startInput: "",
    durationInput: "",
    isManualStart: false,
    isManualDuration: false,
  };
}

export function newRestRow(): Row {
  return {
    id: crypto.randomUUID(),
    kind: "rest",
    startInput: "",
    durationInput: "",
    isManualStart: false,
    isManualDuration: false,
  };
}
