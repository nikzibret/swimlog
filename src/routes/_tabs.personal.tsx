import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogOut, User as UserIcon, Scale } from "lucide-react";
import { toast } from "sonner";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Filler,
} from "chart.js";
import { format, parseISO } from "date-fns";

import { useAuth } from "@/lib/auth-context";
import { supabase, type SessionRow, type SetDbRow } from "@/lib/supabase";
import { useUserProfile, type WeightLogEntry } from "@/lib/user-profile";
import { SignIn } from "@/components/swim/SignIn";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Filler,
);

export const Route = createFileRoute("/_tabs/personal")({
  head: () => ({ meta: [{ title: "Personal" }] }),
  component: PersonalPage,
});

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function PersonalPage() {
  const { user, loading } = useAuth();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Sign out failed: " + error.message);
    else toast.success("Signed out");
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <SignIn />;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-5 pb-28">
      <h1 className="text-xl font-semibold tracking-tight">Personal</h1>

      <WeightLogCard />
      <StatsCard />

      <div className="mt-auto flex flex-col gap-3">
        <BirthYearRow />

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <UserIcon size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:bg-secondary/60"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Birth year settings row                                                    */
/* -------------------------------------------------------------------------- */

function BirthYearRow() {
  const { user } = useAuth();
  const { profile, refresh } = useUserProfile();
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    setValue(profile?.birth_year != null ? String(profile.birth_year) : "");
  }, [profile?.birth_year]);

  async function handleBlur() {
    if (!user) return;
    const trimmed = value.trim();
    const by = trimmed === "" ? null : Number(trimmed);
    if (by === (profile?.birth_year ?? null)) return;
    if (
      by != null &&
      (!Number.isInteger(by) || by < 1900 || by > new Date().getFullYear())
    ) {
      toast.error("Enter a valid 4-digit birth year");
      return;
    }
    const { error } = await supabase
      .from("user_profile")
      .upsert({ user_id: user.id, birth_year: by }, { onConflict: "user_id" });
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3">
      <label
        htmlFor="birth-year"
        className="text-sm font-medium text-foreground"
      >
        Birth year
      </label>
      <input
        id="birth-year"
        type="number"
        inputMode="numeric"
        min="1900"
        max={new Date().getFullYear()}
        placeholder="e.g. 1990"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="h-9 w-28 rounded-lg border border-border bg-white px-3 text-right text-sm tabular-nums outline-none focus:border-primary"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Weight log                                                                  */
/* -------------------------------------------------------------------------- */

function WeightLogCard() {
  const { user } = useAuth();
  const { refresh: refreshProfile } = useUserProfile();
  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("weight_log")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });
    setEntries((data as WeightLogEntry[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleSave() {
    if (!user) return;
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0 || w > 500) {
      toast.error("Enter a valid weight in kg");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("weight_log")
      .insert({ user_id: user.id, weight_kg: w, date });
    setSaving(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success("Weight logged");
    setWeight("");
    setDate(todayISO());
    await load();
    refreshProfile();
  }

  const sorted = useMemo(
    () =>
      [...entries]
        .map((e) => ({ date: e.date, weight: Number(e.weight_kg) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const chart = useMemo(() => {
    if (sorted.length < 2) return null;
    const weights = sorted.map((p) => p.weight);
    const min = Math.min(...weights) - 2;
    const max = Math.max(...weights) + 2;
    return {
      data: {
        labels: sorted.map((p) => format(parseISO(p.date), "d MMM")),
        datasets: [
          {
            data: weights,
            borderColor: "#185FA5",
            backgroundColor: "rgba(24, 95, 165, 0.12)",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#185FA5",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { parsed: { y: number } }) =>
                `${ctx.parsed.y} kg`,
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
          y: {
            min,
            max,
            ticks: {
              font: { size: 11 },
              callback: (v: string | number) => `${v}`,
            },
          },
        },
      },
    };
  }, [sorted]);

  return (
    <SectionCard title="Weight log">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Weight (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="e.g. 72.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm tabular-nums outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm tabular-nums outline-none focus:border-primary"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Scale size={16} /> {saving ? "Saving…" : "Save"}
        </button>

        {chart ? (
          <div className="h-44 w-full">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Line data={chart.data} options={chart.options as any} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center text-xs text-muted-foreground">
            Log at least 2 weights to see your trend
          </p>
        )}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats summary                                                               */
/* -------------------------------------------------------------------------- */

function StatsCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    sessions: number;
    distanceKm: number;
    activeSec: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, pool_length")
        .eq("user_id", user.id);
      const sessList = (sessions as Pick<SessionRow, "id" | "pool_length">[]) ?? [];
      if (sessList.length === 0) {
        setStats({ sessions: 0, distanceKm: 0, activeSec: 0 });
        return;
      }
      const { data: sets } = await supabase
        .from("sets")
        .select("session_id, type, laps, duration_seconds")
        .in(
          "session_id",
          sessList.map((s) => s.id),
        );
      const poolBySession = new Map(sessList.map((s) => [s.id, s.pool_length]));
      let distance = 0;
      let activeSec = 0;
      for (const s of (sets as Pick<SetDbRow, "session_id" | "type" | "laps" | "duration_seconds">[]) ??
        []) {
        if (s.type !== "set") continue;
        const pl = poolBySession.get(s.session_id) ?? 0;
        if (s.laps) distance += s.laps * pl * 2;
        if (s.duration_seconds) activeSec += s.duration_seconds;
      }
      setStats({
        sessions: sessList.length,
        distanceKm: distance / 1000,
        activeSec,
      });
    })();
  }, [user?.id]);

  function formatHHMM(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return (
    <SectionCard title="Stats summary">
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell label="Sessions" value={stats ? String(stats.sessions) : "—"} />
        <StatCell
          label="Distance"
          value={stats ? `${stats.distanceKm.toFixed(1)} km` : "—"}
        />
        <StatCell
          label="Active"
          value={stats ? formatHHMM(stats.activeSec) : "—"}
        />
      </div>
    </SectionCard>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
