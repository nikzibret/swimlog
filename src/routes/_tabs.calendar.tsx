import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { X, Pencil, Trash2, Repeat, Share2 } from "lucide-react";
import { generateAndDownloadShareCard } from "@/lib/share-card";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase, type SessionRow, type SetDbRow } from "@/lib/supabase";
import { useEditStore } from "@/lib/session-store";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/user-profile";
import { estimateCaloriesFromDbSets } from "@/lib/calories";
import type { Row } from "@/lib/swim-types";

import {
  formatDuration,
  formatStartTime,
  parseStartTime,
} from "@/lib/swim-utils";

export const Route = createFileRoute("/_tabs/calendar")({
  head: () => ({
    meta: [{ title: "Swim Calendar" }],
  }),
  component: CalendarPage,
});

const INITIAL_BEFORE = 6;
const INITIAL_AFTER = 3;
const CHUNK = 6;

function monthKey(d: Date) {
  return format(d, "yyyy-MM");
}

function CalendarPage() {
  const navigate = useNavigate();
  const requestNewOnDate = useEditStore((s) => s.requestNewOnDate);
  const { user } = useAuth();

  const thisMonth = useMemo(() => startOfMonth(new Date()), []);

  const [offsets, setOffsets] = useState<number[]>(() => {
    const arr: number[] = [];
    for (let i = -INITIAL_BEFORE; i <= INITIAL_AFTER; i++) arr.push(i);
    return arr;
  });
  const months = useMemo(
    () => offsets.map((o) => addMonths(thisMonth, o)),
    [offsets, thisMonth],
  );

  const [headerMonth, setHeaderMonth] = useState(() => thisMonth);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [allSets, setAllSets] = useState<SetDbRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dayPickerDate, setDayPickerDate] = useState<string | null>(null);
  const [flashDate, setFlashDate] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [ready, setReady] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const topSentinel = useRef<HTMLDivElement | null>(null);
  const bottomSentinel = useRef<HTMLDivElement | null>(null);
  const didInitialScroll = useRef(false);
  const userScrolled = useRef(false);
  const pendingPrepend = useRef<{ height: number; top: number } | null>(null);

  // Fetch sessions across the full loaded range.
  const loadRange = useCallback(async () => {
    const first = addMonths(thisMonth, offsets[0]);
    const last = addMonths(thisMonth, offsets[offsets.length - 1]);
    const from = format(startOfMonth(first), "yyyy-MM-dd");
    const to = format(endOfMonth(last), "yyyy-MM-dd");
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .gte("date", from)
      .lte("date", to);
    const list = (sess as SessionRow[]) ?? [];
    setSessions(list);
    if (list.length === 0) {
      setAllSets([]);
      return;
    }
    const { data: sets } = await supabase
      .from("sets")
      .select("*")
      .in(
        "session_id",
        list.map((s) => s.id),
      );
    setAllSets((sets as SetDbRow[]) ?? []);
  }, [offsets, thisMonth]);

  useEffect(() => {
    loadRange();
  }, [loadRange, refreshTick, user?.id]);

  // Scroll so the current month sits at the top of the scroller.
  const scrollToCurrent = useCallback((behavior: ScrollBehavior = "auto") => {
    const scroller = scrollerRef.current;
    const el = currentRef.current;
    if (!scroller || !el) return false;
    const top =
      scroller.scrollTop +
      (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
    scroller.scrollTo({ top, behavior });
    setHeaderMonth(thisMonth);
    return true;
  }, [thisMonth]);

  // Land on the current month before the user sees anything, on every mount.
  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      const ok = scrollToCurrent("auto");
      frames++;
      // Repeat a few frames: layout/fonts can shift offsets after first paint.
      if (!ok || frames < 3) {
        raf = requestAnimationFrame(tick);
        return;
      }
      didInitialScroll.current = true;
      setReady(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollToCurrent]);

  // Until the user actually scrolls, keep the current month pinned in view
  // (months added by the sentinels must not drag the view away).
  useLayoutEffect(() => {
    if (userScrolled.current) return;
    scrollToCurrent("auto");
  }, [offsets, scrollToCurrent]);

  // Keep visual position stable when prepending months.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const p = pendingPrepend.current;
    if (!scroller || !p) return;
    pendingPrepend.current = null;
    if (!userScrolled.current) return;
    scroller.scrollTop = p.top + (scroller.scrollHeight - p.height);
  }, [offsets]);


  // Infinite scroll sentinels.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !didInitialScroll.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.target === topSentinel.current) {
            pendingPrepend.current = {
              height: scroller.scrollHeight,
              top: scroller.scrollTop,
            };
            setOffsets((prev) => {
              const first = prev[0];
              const add: number[] = [];
              for (let i = first - CHUNK; i < first; i++) add.push(i);
              return [...add, ...prev];
            });
          } else if (e.target === bottomSentinel.current) {
            setOffsets((prev) => {
              const last = prev[prev.length - 1];
              const add: number[] = [];
              for (let i = last + 1; i <= last + CHUNK; i++) add.push(i);
              return [...prev, ...add];
            });
          }
        }
      },
      { root: scroller, rootMargin: "300px 0px" },
    );
    if (topSentinel.current) io.observe(topSentinel.current);
    if (bottomSentinel.current) io.observe(bottomSentinel.current);
    return () => io.disconnect();
  }, [offsets, ready]);

  const sessionsByDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return m;
  }, [sessions]);

  const setsBySession = useMemo(() => {
    const m = new Map<string, SetDbRow[]>();
    for (const s of allSets) {
      const arr = m.get(s.session_id) ?? [];
      arr.push(s);
      m.set(s.session_id, arr);
    }
    return m;
  }, [allSets]);

  // A session is "timed" if any of its set rows has a duration; all-null = casual.
  const kindsByDate = useMemo(() => {
    const m = new Map<string, { timed: boolean; casual: boolean }>();
    for (const s of sessions) {
      const rows = setsBySession.get(s.id) ?? [];
      const timed = rows.some((r) => r.duration_seconds != null);
      const entry = m.get(s.date) ?? { timed: false, casual: false };
      if (timed) entry.timed = true;
      else entry.casual = true;
      m.set(s.date, entry);
    }
    return m;
  }, [sessions, setsBySession]);

  function sessionDistance(sess: SessionRow): number {
    const sets = setsBySession.get(sess.id) ?? [];
    let dist = 0;
    for (const s of sets) {
      if (s.type === "set" && s.laps) {
        dist += s.laps * sess.pool_length * 2;
      }
    }
    return dist;
  }

  function flash(key: string) {
    setFlashDate(key);
    window.setTimeout(() => {
      setFlashDate((d) => (d === key ? null : d));
    }, 350);
  }

  function handleDayClick(d: Date) {
    const key = format(d, "yyyy-MM-dd");
    flash(key);
    const list = sessionsByDate.get(key) ?? [];
    if (list.length === 0) {
      requestNewOnDate(key);
      navigate({ to: "/log" });
      return;
    }
    if (list.length === 1) {
      setOpenId(list[0].id);
      return;
    }
    setDayPickerDate(key);
  }

  function handleDeleted() {
    setOpenId(null);
    setRefreshTick((n) => n + 1);
  }

  // Track which month is under the sticky header.
  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop;
    let best = months[0];
    for (let i = 0; i < months.length; i++) {
      const el = scroller.querySelector<HTMLElement>(
        `[data-month="${monthKey(months[i])}"]`,
      );
      if (!el) continue;
      if (el.offsetTop - scroller.offsetTop - 8 <= top) best = months[i];
      else break;
    }
    if (best && !isSameMonth(best, headerMonth)) setHeaderMonth(best);
  }

  const dayPickerSessions = dayPickerDate
    ? sessionsByDate.get(dayPickerDate) ?? []
    : [];

  return (
    <div className="flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] flex-col overflow-hidden">
      <div className="sticky top-0 z-20 bg-white/90 px-4 pb-2 pt-5 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            {format(headerMonth, "MMMM yyyy")}
          </h1>
          <button
            type="button"
            onClick={() => {
              userScrolled.current = false;
              scrollToCurrent("smooth");
              flash(format(new Date(), "yyyy-MM-dd"));
            }}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            Today
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onWheel={() => (userScrolled.current = true)}
        onTouchStart={() => (userScrolled.current = true)}
        onPointerDown={() => (userScrolled.current = true)}
        onKeyDown={() => (userScrolled.current = true)}
        className={`flex-1 overflow-y-auto overscroll-contain px-4 pb-6 [-webkit-overflow-scrolling:touch] ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <div ref={topSentinel} className="h-px" />
        {months.map((m) => {
          const isCurrent = isSameMonth(m, thisMonth);
          return (
            <div
              key={monthKey(m)}
              data-month={monthKey(m)}
              ref={isCurrent ? currentRef : undefined}
              className="pt-4"
            >
              <div className="mb-2 text-sm font-semibold text-muted-foreground">
                {format(m, "MMMM yyyy")}
              </div>
              <MonthGrid
                month={m}
                sessionsByDate={sessionsByDate}
                kindsByDate={kindsByDate}
                flashDate={flashDate}
                onDayClick={handleDayClick}
              />
            </div>
          );
        })}
        <div ref={bottomSentinel} className="h-px" />
      </div>

      {dayPickerDate && (
        <DayPickerSheet
          date={dayPickerDate}
          sessions={dayPickerSessions}
          distanceFor={sessionDistance}
          onClose={() => setDayPickerDate(null)}
          onPick={(id) => {
            setDayPickerDate(null);
            setOpenId(id);
          }}
        />
      )}

      {openId && (
        <SessionDetailSheet
          id={openId}
          onClose={() => setOpenId(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function MonthGrid({
  month,
  sessionsByDate,
  kindsByDate,
  flashDate,
  onDayClick,
}: {
  month: Date;
  sessionsByDate: Map<string, SessionRow[]>;
  kindsByDate: Map<string, { timed: boolean; casual: boolean }>;
  flashDate: string | null;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const inMonth = isSameMonth(d, month);
        if (!inMonth) return <div key={key} className="aspect-square" />;
        const list = sessionsByDate.get(key) ?? [];
        const count = list.length;
        const kinds = kindsByDate.get(key);
        const today = isSameDay(d, new Date());
        const flashing = flashDate === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDayClick(d)}
            className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition duration-300 ${
              count > 0
                ? "border-primary/30 bg-primary-soft text-primary hover:border-primary"
                : "border-transparent hover:bg-secondary/60"
            } ${today ? "ring-2 ring-primary/40" : ""} ${
              flashing ? "scale-[1.06] ring-2 ring-primary" : ""
            }`}
          >
            <span className={count > 0 ? "font-semibold" : ""}>
              {format(d, "d")}
            </span>
            {kinds && (
              <span className="absolute bottom-1.5 flex items-center gap-0.5">
                {kinds.timed && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                {kinds.casual && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B5D4F4]" />
                )}
              </span>
            )}
            {count > 1 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}


function DayPickerSheet({
  date,
  sessions,
  distanceFor,
  onClose,
  onPick,
}: {
  date: string;
  sessions: SessionRow[];
  distanceFor: (s: SessionRow) => number;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-t-2xl bg-white p-4 pb-8 shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {format(parseISO(date), "EEEE, d MMMM yyyy")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {sessions.length} sessions on this day
        </p>
        <ul className="space-y-2">
          {sessions.map((s) => {
            const startLabel = s.start_time
              ? formatStartTime(parseStartTime(s.start_time.slice(0, 8)))
              : "Casual";
            const dist = distanceFor(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-3 text-left text-sm hover:border-primary"
                >
                  <span className="font-medium">{startLabel}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {dist.toLocaleString()}m
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SessionDetailSheet({
  id,
  onClose,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const requestEdit = useEditStore((s) => s.requestEdit);
  const requestSeed = useEditStore((s) => s.requestSeed);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sets, setSets] = useState<SetDbRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setSession((data as SessionRow) ?? null));
    supabase
      .from("sets")
      .select("*")
      .eq("session_id", id)
      .order("order_index", { ascending: true })
      .then(({ data }) => setSets((data as SetDbRow[]) ?? []));
  }, [id]);

  const { latestWeight, ageYears } = useUserProfile();

  const isCasual = useMemo(
    () =>
      sets.length > 0 &&
      sets.every((s) => s.duration_seconds == null && !s.start_time),
    [sets],
  );

  const totals = useMemo(() => {
    if (!session) return null;
    let dist = 0;
    let active = 0;
    let total = 0;
    for (const s of sets) {
      const d = s.duration_seconds ?? 0;
      total += d;
      if (s.type === "set") {
        active += d;
        if (s.laps) dist += s.laps * session.pool_length * 2;
      }
    }
    const pace =
      active > 0 && dist > 0 ? Math.round((active / dist) * 100) : null;
    const calories = estimateCaloriesFromDbSets(sets, latestWeight, ageYears);
    return { dist, active, total, pace, calories };
  }, [sets, session, latestWeight, ageYears]);


  async function handleDelete() {
    setDeleting(true);
    try {
      // Best-effort delete sets first in case cascade isn't configured.
      await supabase.from("sets").delete().eq("session_id", id);
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Session deleted");
      onDeleted();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Delete failed: " + msg);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {session
                ? format(parseISO(session.date), "EEEE, d MMMM yyyy")
                : "Session"}
              {isCasual && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Casual
                </span>
              )}
            </h2>
            {session && (
              <p className="text-xs text-muted-foreground">
                {!isCasual && session.start_time && (
                  <>
                    Start{" "}
                    {formatStartTime(parseStartTime(session.start_time.slice(0, 8)))} ·{" "}
                  </>
                )}
                Pool {session.pool_length}m
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {sets.map((s, i) => {
            if (s.type === "rest") {
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground"
                >
                  Rest · {formatDuration(s.duration_seconds)}
                </div>
              );
            }
            const dist =
              s.laps && session ? s.laps * session.pool_length * 2 : 0;
            return (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-white p-3"
              >
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>
                    {setNumberLabel(sets, i)} · {s.stroke}
                  </span>
                  {!isCasual && (
                    <span className="tabular-nums text-muted-foreground">
                      {formatDuration(s.duration_seconds)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.laps ?? 0} laps · {dist}m
                </div>
                {s.equipment && s.equipment.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.equipment.map((eq) => (
                      <span
                        key={eq}
                        className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary"
                      >
                        {eq}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totals && (
          <div className="mt-4 space-y-2">
            <div
              className={`grid gap-2 rounded-lg bg-surface p-3 text-center ${
                isCasual ? "grid-cols-1" : "grid-cols-4"
              }`}
            >
              <Cell label="Distance" value={`${totals.dist}m`} />
              {!isCasual && (
                <>
                  <Cell label="Active" value={formatDuration(totals.active)} />
                  <Cell label="Total" value={formatDuration(totals.total)} />
                  <Cell
                    label="Pace /100m"
                    value={totals.pace != null ? formatDuration(totals.pace) : "—"}
                  />
                </>
              )}
            </div>
            <div
              className="rounded-lg bg-surface p-3 text-center"
              title={
                totals.calories == null
                  ? "Log your weight in Personal to enable calorie estimates"
                  : undefined
              }
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Calories
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {totals.calories != null
                  ? `~${totals.calories.toLocaleString()} kcal`
                  : "— kcal"}
              </div>
            </div>
          </div>
        )}

        {session && totals && (
          <button
            type="button"
            onClick={() =>
              generateAndDownloadShareCard({
                date: session.date,
                distance: totals.dist,
                paceSecPer100: totals.pace,
                activeSec: totals.active,
                totalSec: totals.total,
              })
            }
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1a1a2e] text-sm font-semibold text-white"
          >
            <Share2 size={16} /> Share session
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            requestEdit(id);
            navigate({ to: "/log" });
          }}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white text-sm font-semibold text-primary"
        >
          <Pencil size={16} /> Edit session
        </button>


        <button
          type="button"
          disabled={!session}
          onClick={() => {
            if (!session) return;
            const seedRows: Row[] = sets.map((s) => ({
              id: crypto.randomUUID(),
              kind: s.type,
              stroke:
                s.type === "set"
                  ? ((s.stroke as Row["stroke"]) ?? "Freestyle")
                  : undefined,
              laps: s.type === "set" ? s.laps : null,
              equipment: s.type === "set" ? s.equipment ?? [] : [],
              startInput: "",
              durationInput:
                s.duration_seconds != null
                  ? formatDuration(s.duration_seconds)
                  : "",
              isManualStart: false,
              isManualDuration: false,
            }));
            requestSeed({
              date: todayLocalISO(),
              poolLength: session.pool_length,
              rows: seedRows,
            });
            navigate({ to: "/log" });
          }}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white text-sm font-semibold text-primary disabled:opacity-50"
        >
          <Repeat size={16} /> Repeat session
        </button>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-destructive bg-white text-sm font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 size={16} /> Delete session
        </button>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            e.stopPropagation();
            if (!deleting) setConfirmDelete(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Delete this session?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="h-11 flex-1 rounded-lg border border-border bg-white text-sm font-semibold text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="h-11 flex-1 rounded-lg bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function setNumberLabel(sets: SetDbRow[], i: number) {
  let n = 0;
  for (let j = 0; j <= i; j++) if (sets[j].type === "set") n++;
  return `Set ${n}`;
}

function todayLocalISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
