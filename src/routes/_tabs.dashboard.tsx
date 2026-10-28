import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { supabase, type SessionRow, type SetDbRow } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDuration } from "@/lib/swim-utils";
import { PaceChart, type PacePoint } from "@/components/swim/PaceChart";

export const Route = createFileRoute("/_tabs/dashboard")({
  head: () => ({ meta: [{ title: "Swim Dashboard" }] }),
  component: DashboardPage,
});

interface PR {
  value: string;
  date: string | null;
  tieCount: number;
}

interface PRs {
  longestSet: PR;
  fastestPace: PR;
  longestSession: PR;
  lowestRestPct: PR;
}

const EMPTY: PR = { value: "—", date: null, tieCount: 0 };

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface SessionMetrics {
  date: string;
  maxSetDist: number;
  totalDist: number;
  paceSec: number | null;
  restPct: number | null;
}

function pickRecord<T>(
  items: { date: string; key: T; value: string }[],
  isBetter: (a: T, b: T) => boolean,
  areEqual: (a: T, b: T) => boolean,
): PR {
  if (items.length === 0) return EMPTY;
  let best = items[0];
  for (const item of items) {
    if (isBetter(item.key, best.key)) best = item;
  }
  const tied = items.filter((i) => areEqual(i.key, best.key));
  const mostRecent = tied.sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    value: mostRecent.value,
    date: mostRecent.date,
    tieCount: tied.length,
  };
}

async function computeDashboard(
  userId: string,
): Promise<{ prs: PRs; paces: PacePoint[] }> {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId);
  if (!sessions || sessions.length === 0) {
    return {
      prs: {
        longestSet: EMPTY,
        fastestPace: EMPTY,
        longestSession: EMPTY,
        lowestRestPct: EMPTY,
      },
      paces: [],
    };
  }
  const ids = sessions.map((s) => s.id);
  const { data: sets } = await supabase
    .from("sets")
    .select("*")
    .in("session_id", ids);
  const allSets = (sets ?? []) as SetDbRow[];
  const setsBySession = new Map<string, SetDbRow[]>();
  for (const r of allSets) {
    const arr = setsBySession.get(r.session_id) ?? [];
    arr.push(r);
    setsBySession.set(r.session_id, arr);
  }

  const metrics: SessionMetrics[] = [];
  const paceBySession: { date: string; paceSec: number }[] = [];

  for (const session of sessions as SessionRow[]) {
    const rows = setsBySession.get(session.id) ?? [];
    let totalLaps = 0;
    let activeSec = 0;
    let restSec = 0;
    let hasRest = false;
    let maxSetDist = 0;

    for (const r of rows) {
      if (r.type === "set") {
        const laps = r.laps ?? 0;
        totalLaps += laps;
        const dist = laps * session.pool_length * 2;
        if (dist > maxSetDist) maxSetDist = dist;
        if ((r.duration_seconds ?? 0) > 0) activeSec += r.duration_seconds ?? 0;
      } else {
        if (r.duration_seconds != null) {
          hasRest = true;
          if (r.duration_seconds > 0) restSec += r.duration_seconds;
        }
      }
    }

    const totalDist = totalLaps * session.pool_length * 2;
    const paceSec =
      totalDist > 0 && activeSec > 0 ? (activeSec / totalDist) * 100 : null;
    const restPct =
      hasRest && activeSec + restSec > 0
        ? (restSec / (activeSec + restSec)) * 100
        : null;

    metrics.push({ date: session.date, maxSetDist, totalDist, paceSec, restPct });

    if (totalDist > 0 && activeSec > 0) {
      paceBySession.push({ date: session.date, paceSec: (activeSec / totalDist) * 100 });
    }
  }

  const longestSet = pickRecord(
    metrics.map((m) => ({
      date: m.date,
      key: m.maxSetDist,
      value: `${m.maxSetDist.toLocaleString()}m`,
    })),
    (a, b) => a > b,
    (a, b) => a === b,
  );

  const longestSession = pickRecord(
    metrics.map((m) => ({
      date: m.date,
      key: m.totalDist,
      value: `${m.totalDist.toLocaleString()}m`,
    })),
    (a, b) => a > b,
    (a, b) => a === b,
  );

  const fastestPace = pickRecord(
    metrics
      .filter((m) => m.paceSec != null)
      .map((m) => {
        const rounded = Math.round(m.paceSec!);
        return {
          date: m.date,
          key: rounded,
          value: `${formatDuration(rounded)} /100m`,
        };
      }),
    (a, b) => a < b,
    (a, b) => a === b,
  );

  const lowestRestPct = pickRecord(
    metrics
      .filter((m) => m.restPct != null)
      .map((m) => {
        const fixed = parseFloat(m.restPct!.toFixed(1));
        return {
          date: m.date,
          key: fixed,
          value: `${m.restPct!.toFixed(1)}%`,
        };
      }),
    (a, b) => a < b,
    (a, b) => a === b,
  );

  const paces = paceBySession
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);

  return {
    prs: { longestSet, fastestPace, longestSession, lowestRestPct },
    paces,
  };
}

function DashboardPage() {
  const { user } = useAuth();
  const [prs, setPrs] = useState<PRs | null>(null);
  const [paces, setPaces] = useState<PacePoint[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setPrs(null);
    setPaces([]);
    computeDashboard(user.id).then((res) => {
      if (!active) return;
      setPrs(res.prs);
      setPaces(res.paces);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const cards: { label: string; pr: PR }[] = [
    { label: "Longest set", pr: prs?.longestSet ?? EMPTY },
    { label: "Fastest pace", pr: prs?.fastestPace ?? EMPTY },
    { label: "Longest session", pr: prs?.longestSession ?? EMPTY },
    { label: "Lowest rest %", pr: prs?.lowestRestPct ?? EMPTY },
  ];

  return (
    <div className="flex flex-1 flex-col px-4 pt-5 pb-24">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Dashboard</h1>

      <section>
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Personal records
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-white px-3 py-3"
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {c.pr.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {c.pr.date ? formatDate(c.pr.date) : "\u00A0"}
              </div>
              {c.pr.tieCount >= 2 && (
                <div className="text-[10px] text-muted-foreground/70">
                  tied by {c.pr.tieCount} sessions
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Pace over time
        </h2>
        <div className="rounded-2xl border border-border bg-white p-3">
          {paces.length >= 2 ? (
            <PaceChart points={paces} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Log more sessions to see your pace trend.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          More trends
        </h2>
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <BarChart3 size={18} />
          </div>
          <p className="text-sm text-muted-foreground">
            More charts coming soon — distance and stroke breakdown over time.
          </p>
        </div>
      </section>
    </div>
  );
}
