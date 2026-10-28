import { useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

export function SignIn({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;

  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    toast.success("Signed in");
  }

  async function handleSignUp() {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    if (data.session) {
      toast.success("Account created");
    } else {
      // Confirmation may be required in Supabase settings.
      toast.success("Account created — try signing in.");
      setMode("signin");
    }
  }

  async function handleForgot() {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    toast.success("Password reset email sent");
    setMode("signin");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (mode !== "forgot" && !password) return;
    setBusy(true);
    try {
      if (mode === "signin") await handleSignIn();
      else if (mode === "signup") await handleSignUp();
      else await handleForgot();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signup"
      ? "Create your SwimLog account"
      : mode === "forgot"
        ? "Reset your password"
        : "Sign in to SwimLog";

  return (
    <div className={compact ? "" : "flex flex-1 items-center justify-center px-6 py-10"}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <LogIn size={26} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-lg border border-border bg-white px-3 text-base outline-none focus:border-primary"
          />

          {mode !== "forgot" && (
            <input
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="Password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-3 text-base outline-none focus:border-primary"
            />
          )}

          {mode === "signin" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-50"
              >
                {busy ? "…" : "Sign in"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("signup")}
                className="flex h-12 w-full items-center justify-center rounded-lg border border-border bg-white text-base font-semibold text-foreground transition disabled:opacity-50"
              >
                Sign up
              </button>
            </div>
          )}

          {mode === "signup" && (
            <>
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="block w-full text-center text-xs text-primary underline"
              >
                Back to sign in
              </button>
            </>
          )}

          {mode === "forgot" && (
            <>
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send reset email"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="block w-full text-center text-xs text-primary underline"
              >
                Back to sign in
              </button>
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="block w-full text-center text-xs text-muted-foreground underline"
            >
              Forgot password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
