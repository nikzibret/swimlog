import type { Row, ComputedRow } from "./swim-types";
import type { Stroke } from "./supabase";

export const STROKE_MET: Record<Stroke, number> = {
  Freestyle: 8.0,
  Backstroke: 7.0,
  Breaststroke: 7.0,
  Butterfly: 9.5,
  IM: 8.0,
  "Mix (back→breast)": 7.0,
};

/**
 * Estimate calories burned for a session.
 * Returns null if weight isn't available.
 * Sums set rows only (excludes rests). Applies a 0.5% reduction per year over 30
 * when age is provided. Rounded to the nearest 10.
 */
export function estimateCalories(
  rows: Row[],
  computed: ComputedRow[],
  weightKg: number | null | undefined,
  ageYears: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0) return null;
  let kcal = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind !== "set") continue;
    const dur = computed[i]?.durationSec ?? 0;
    if (dur <= 0) continue;
    const met = (r.stroke && STROKE_MET[r.stroke]) ?? 8.0;
    kcal += met * weightKg * (dur / 3600);
  }
  if (ageYears != null && ageYears > 30) {
    kcal *= 1 - 0.005 * (ageYears - 30);
  }
  return Math.round(kcal / 10) * 10;
}

/**
 * Simplified estimate from raw DB set rows ({ type, stroke, duration_seconds }).
 */
export function estimateCaloriesFromDbSets(
  sets: Array<{
    type: "set" | "rest";
    stroke: string | null;
    duration_seconds: number | null;
  }>,
  weightKg: number | null | undefined,
  ageYears: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0) return null;
  let kcal = 0;
  for (const s of sets) {
    if (s.type !== "set") continue;
    const dur = s.duration_seconds ?? 0;
    if (dur <= 0) continue;
    const met: number = (s.stroke ? (STROKE_MET as Record<string, number>)[s.stroke] : undefined) ?? 8.0;
    kcal += met * weightKg * (Number(dur) / 3600);
  }
  if (ageYears != null && ageYears > 30) {
    kcal *= 1 - 0.005 * (ageYears - 30);
  }
  return Math.round(kcal / 10) * 10;
}
