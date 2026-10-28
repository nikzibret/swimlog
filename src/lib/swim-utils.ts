// Parse "HH:MM" or "HH:MM:SS" to seconds since midnight. Returns null if invalid.
export function parseStartTime(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, sec = 0] = nums;
  if (h > 23 || m > 59 || sec > 59) return null;
  return h * 3600 + m * 60 + sec;
}

// Parse "MM:SS" or "HH:MM:SS" to total seconds.
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, sec] = nums;
    if (sec > 59) return null;
    return m * 60 + sec;
  }
  const [h, m, sec] = nums;
  if (m > 59 || sec > 59) return null;
  return h * 3600 + m * 60 + sec;
}

export function formatEndTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (r === 0) return `${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

export function formatStartTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(r)}`;
  return `${pad(m)}:${pad(r)}`;
}

// Display only MM:SS portion of a wall-clock start time.
export function formatStartMMSS(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec)) % 3600;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad(m)}:${pad(r)}`;
}

export function getHour(sec: number | null | undefined): number | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  return Math.floor(Math.max(0, sec) / 3600);
}

// "16" -> "4pm"
export function formatHour12(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

// Parse a manual start input that may be MM:SS (infer hour from prev) or HH:MM:SS literal.
export function parseManualStart(
  input: string,
  prevSec: number | null,
): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) {
    const [h, m, sec] = nums;
    if (h > 23 || m > 59 || sec > 59) return null;
    return h * 3600 + m * 60 + sec;
  }
  const [m, sec] = nums;
  if (m > 59 || sec > 59) return null;
  const mmss = m * 60 + sec;
  const prevHour = prevSec != null ? Math.floor(prevSec / 3600) : 0;
  const prevMMSS = prevSec != null ? prevSec % 3600 : -1;
  const hour = prevMMSS >= 0 && mmss < prevMMSS ? prevHour + 1 : prevHour;
  return hour * 3600 + mmss;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// SQL date/time conversions.
// Supabase TIME column = "HH:MM:SS"
export function startTimeToHHMMSS(sec: number | null): string | null {
  if (sec == null) return null;
  return formatStartTime(sec);
}

export function hhmmssToSeconds(s: string | null): number | null {
  if (!s) return null;
  return parseStartTime(s);
}
