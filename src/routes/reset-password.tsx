import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Tokens may arrive in the hash (#access_token=...&refresh_token=...)
      // or already be exchanged into a session by detectSessionInUrl.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          setError("This reset link is invalid or has expired. Please request a new one.");
          setReady(true);
          return;
        }
        // Clean the URL so tokens aren't left in history.
        window.history.replaceState({}, "", "/reset-password");
        setReady(true);
        return;
      }

      // Fall back to existing session (detectSessionInUrl already ran).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <KeyRound size={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground"
            >
              Back to app
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="New password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-3 text-base outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-3 text-base outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-50"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
