import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";

import { SessionHeader } from "@/components/swim/SessionHeader";
import { SetRow } from "@/components/swim/SetRow";
import { RestRow } from "@/components/swim/RestRow";
import { TotalsBar } from "@/components/swim/TotalsBar";
import { newRestRow, newSetRow, type Row } from "@/lib/swim-types";
import { computeRows, computeTotals } from "@/lib/cascade";
import {
  formatHour12,
  formatStartMMSS,
  formatStartTime,
  getHour,
  parseStartTime,
  startTimeToHHMMSS,
} from "@/lib/swim-utils";
import { supabase, type SetDbRow } from "@/lib/supabase";
import { useEditStore } from "@/lib/session-store";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/user-profile";
import { estimateCalories } from "@/lib/calories";


export const Route = createFileRoute("/_tabs/log")({
  head: () => ({
    meta: [{ title: "Swim Log" }, { name: "description", content: "Log your swim session sets and rests." }],
  }),
  component: LogPage,
});

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function LogPage() {
  const consumeEdit = useEditStore((s) => s.consume);
  const consumePrefillDate = useEditStore((s) => s.consumePrefillDate);
  const consumeSeed = useEditStore((s) => s.consumeSeed);
  const { user } = useAuth();


  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [poolLength, setPoolLength] = useState(25);
  const [customPool, setCustomPool] = useState(33);
  const [rows, setRows] = useState<Row[]>(() => [newSetRow()]);
  const [saving, setSaving] = useState(false);
  const [sessionType, setSessionType] = useState<"timed" | "casual">("timed");
  const casual = sessionType === "casual";

  function handleSessionTypeChange(t: "timed" | "casual") {
    setSessionType(t);
    if (t === "casual") {
      setStartTime("");
      setRows((prev) => {
        const kept = prev
          .filter((r) => r.kind === "set")
          .map((r) => ({
            ...r,
            startInput: "",
            durationInput: "",
            isManualStart: false,
            isManualDuration: false,
          }));
        return kept.length ? kept : [newSetRow()];
      });
    }
  }


  // Pre-fill date when navigating from Calendar tap on an empty day.
  useEffect(() => {
    const d = consumePrefillDate();
    if (d) setDate(d);
  }, [consumePrefillDate]);

  // Seed a new (unsaved) session from "Repeat session".
  useEffect(() => {
    const seed = consumeSeed();
    if (!seed) return;
    setEditingId(null);
    setDate(seed.date);
    setStartTime("");
    setPoolLength(seed.poolLength);
    if (![25, 50].includes(seed.poolLength)) setCustomPool(seed.poolLength);
    setRows(seed.rows);
  }, [consumeSeed]);

  // Load session for editing if requested.
  useEffect(() => {
    const id = consumeEdit();
    if (!id) return;
    (async () => {
      const { data: session, error } = await supabase.from("sessions").select("*").eq("id", id).single();
      if (error || !session) {
        toast.error("Couldn't load session for editing");
        return;
      }
      const { data: sets } = await supabase
        .from("sets")
        .select("*")
        .eq("session_id", id)
        .order("order_index", { ascending: true });

      setEditingId(id);
      setDate(session.date);
      setStartTime(session.start_time ? (session.start_time as string).slice(0, 8) : "");
      setPoolLength(session.pool_length);
      if (![25, 50].includes(session.pool_length)) setCustomPool(session.pool_length);
      const isCasualSession =
        (sets ?? []).length > 0 &&
        (sets ?? []).every((s: SetDbRow) => s.duration_seconds == null && !s.start_time);
      setSessionType(isCasualSession ? "casual" : "timed");

      const loaded: Row[] = (sets ?? []).map((s: SetDbRow) => ({
        id: s.id,
        kind: s.type,
        stroke: (s.stroke as Row["stroke"]) ?? "Freestyle",
        laps: s.laps,
        equipment: s.equipment ?? [],
        startInput:
          s.is_manual_start && s.start_time
            ? parseStartTime(s.start_time.slice(0, 8)) != null
              ? formatStartTime(parseStartTime(s.start_time.slice(0, 8))!)
              : ""
            : "",
        durationInput: s.is_manual_duration && s.duration_seconds != null ? formatDurForInput(s.duration_seconds) : "",
        isManualStart: s.is_manual_start,
        isManualDuration: s.is_manual_duration,
      }));
      setRows(loaded.length ? loaded : [newSetRow()]);
    })();
  }, [consumeEdit]);

  const sessionStartSec = useMemo(() => parseStartTime(startTime), [startTime]);

  const computed = useMemo(() => computeRows(rows, sessionStartSec), [rows, sessionStartSec]);

  const totals = useMemo(() => computeTotals(rows, computed, poolLength), [rows, computed, poolLength]);

  const { latestWeight, ageYears } = useUserProfile();
  const calories = useMemo(
    () => estimateCalories(rows, computed, latestWeight, ageYears),
    [rows, computed, latestWeight, ageYears],
  );

  const hasNegative = computed.some((c) => c.durationNegative);
  const hasSet = rows.some((r) => r.kind === "set");
  const canSave = hasSet && !hasNegative && !saving && !!user;

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function addSet() {
    setRows((prev) => {
      const next = [...prev];
      // If the last item is a set, insert a rest before the new set
      if (!casual && next.length > 0 && next[next.length - 1].kind === "set") {
        next.push(newRestRow());
      }
      next.push(newSetRow());
      return next;
    });
  }
  function addRest() {
    setRows((prev) => [...prev, newRestRow()]);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      // Resolve any remaining null start times for non-manual set rows by
      // cascading from the previous row's start + duration.
      const resolved = computed.map((c) => ({
        startSec: c.startSec,
        durationSec: c.durationSec,
      }));
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.kind === "set" && resolved[i].startSec == null && !r.isManualStart && i > 0) {
          const prev = resolved[i - 1];
          if (prev.startSec != null && prev.durationSec != null) {
            resolved[i].startSec = prev.startSec + prev.durationSec;
          }
        }
      }

      // Build payload, skipping rows we should not persist.
      const issues: string[] = [];
      const persistRows: Array<Record<string, unknown>> = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const c = resolved[i];
        const isLast = i === rows.length - 1;

        if (casual) {
          if (r.kind !== "set") continue;
          const n = r.laps != null ? Math.round(Number(r.laps)) : NaN;
          persistRows.push({
            order_index: i,
            type: "set",
            stroke: r.stroke ?? null,
            laps: Number.isFinite(n) && n > 0 ? n : null,
            equipment:
              Array.isArray(r.equipment) && r.equipment.length > 0
                ? r.equipment.map((e) => String(e).trim()).filter(Boolean)
                : null,
            start_time: null,
            duration_seconds: null,
            is_manual_start: false,
            is_manual_duration: false,
          });
          continue;
        }

        // (a) Omit a trailing rest row with null duration entirely.
        if (r.kind === "rest" && isLast) {
          continue;
        }

        const startStr = startTimeToHHMMSS(c.startSec);
        if (!startStr) {
          // Never insert a row with a null start_time.
          console.warn(`Skipping row ${i + 1} (${r.kind}): unresolved start_time`);
          continue;
        }


        let durationInt: number | null = null;
        if (c.durationSec != null) {
          const n = Math.round(Number(c.durationSec));
          if (!Number.isFinite(n) || n < 0) {
            issues.push(`Row ${i + 1} (${r.kind}): invalid duration_seconds (${c.durationSec})`);
          } else {
            durationInt = n;
          }
        } else if (r.kind === "rest") {
          issues.push(`Row ${i + 1} (rest): missing duration`);
        }

        let lapsInt: number | null = null;
        if (r.kind === "set" && r.laps != null && r.laps !== undefined) {
          const n = Math.round(Number(r.laps));
          lapsInt = Number.isFinite(n) && n > 0 ? n : null;
        }

        const equipmentArr: string[] | null =
          r.kind === "set" && Array.isArray(r.equipment) && r.equipment.length > 0
            ? r.equipment.map((e) => String(e).trim()).filter(Boolean)
            : null;

        persistRows.push({
          order_index: i,
          type: r.kind,
          stroke: r.kind === "set" ? (r.stroke ?? null) : null,
          laps: lapsInt,
          equipment: equipmentArr,
          start_time: startStr,
          duration_seconds: durationInt,
          is_manual_start: !!r.isManualStart,
          is_manual_duration: !!r.isManualDuration,
        });
      }

      if (issues.length > 0) {
        console.warn("sets payload validation issues:", issues);
      }

      let sessionId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("sessions")
          .update({
            date,
            start_time: startTimeToHHMMSS(sessionStartSec),
            pool_length: poolLength,
          })
          .eq("id", editingId);
        if (error) throw error;
        const { error: delErr } = await supabase.from("sets").delete().eq("session_id", editingId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase
          .from("sessions")
          .insert({
            date,
            start_time: startTimeToHHMMSS(sessionStartSec),
            pool_length: poolLength,
            user_id: user!.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        sessionId = data!.id as string;
      }


      const setsPayload = persistRows.map((r) => ({ ...r, session_id: sessionId }));
      console.log("sets payload:", JSON.stringify(setsPayload, null, 2));

      if (setsPayload.length === 0) {
        // Roll back the session insert — no valid sets to attach
        await supabase.from("sessions").delete().eq("id", sessionId);
        toast.error("No valid sets to save — check your timings.");
        return;
      }

      const { error: insErr } = await supabase.from("sets").insert(setsPayload);
      if (insErr) {
        console.error("Supabase sets insert error:", {
          message: insErr.message,
          details: insErr.details,
          hint: insErr.hint,
          code: insErr.code,
        });
        throw insErr;
      }

      toast.success(editingId ? "Session updated" : "Session saved");
      // Reset to a fresh form
      setEditingId(null);
      setRows([newSetRow()]);
      setStartTime("");
      setDate(todayISO());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Save failed: " + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SessionHeader
        date={date}
        startTime={startTime}
        poolLength={poolLength}
        customPool={customPool}
        sessionType={sessionType}
        onSessionTypeChange={handleSessionTypeChange}
        onDateChange={setDate}
        onStartTimeChange={setStartTime}
        onPoolLengthChange={setPoolLength}
        onCustomPoolChange={setCustomPool}
      />

      <div className="flex-1 space-y-2 px-4 py-4 pb-44">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
            Add at least one set to start logging.
          </p>
        )}

        {rows.map((row, i) => {
          const sessionHour = getHour(sessionStartSec);
          const rowHour = getHour(computed[i].startSec);
          const prevHour = i === 0 ? sessionHour : getHour(computed[i - 1].startSec);
          const showBanner =
            !casual && rowHour != null && prevHour != null && rowHour !== prevHour;
          const hourTag = !casual && rowHour != null ? formatHour12(rowHour) : null;
          return (
            <div key={row.id} className="space-y-2">
              {showBanner && (
                <div className="flex items-center gap-2 py-1">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">Now {formatHour12(rowHour!)}</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              {row.kind === "set" ? (
                <SetRow
                  index={setIndex(rows, i)}
                  row={row}
                  computed={computed[i]}
                  poolLength={poolLength}
                  hourTag={hourTag}
                  casual={casual}
                  onChange={(p) => updateRow(row.id, p)}
                  onRemove={() => removeRow(row.id)}
                />
              ) : casual ? null : (
                <RestRow
                  row={row}
                  computed={computed[i]}
                  onChange={(p) => updateRow(row.id, p)}
                  onRemove={() => removeRow(row.id)}
                />
              )}
            </div>
          );
        })}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={addSet}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} /> Add set
          </button>
          {!casual && (
            <button
              type="button"
              onClick={addRest}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-sm font-medium text-foreground"
            >
              <Plus size={16} /> Add rest
            </button>
          )}
        </div>


        <div className="pt-3">
          {!hasSet && <p className="text-center text-xs text-muted-foreground">Add at least one set</p>}
          {hasNegative && (
            <p className="text-center text-xs text-destructive">
              A set duration is negative — fix the timings to save.
            </p>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            title={!user ? "Sign in to save sessions" : undefined}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? "Saving…" : editingId ? "Update session" : "Save session"}
          </button>
          {!user && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Sign in to save sessions
            </p>
          )}

        </div>
      </div>

      <TotalsBar
        totals={totals}
        calories={calories}
        casual={casual}
        caloriesDisabledReason="Log your weight in Personal to enable calorie estimates"
      />
    </>
  );
}

function setIndex(rows: Row[], i: number): number {
  let n = 0;
  for (let j = 0; j < i; j++) if (rows[j].kind === "set") n++;
  return n;
}

function formatDurForInput(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
