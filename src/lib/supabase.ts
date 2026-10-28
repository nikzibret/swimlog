import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storage: isBrowser ? window.localStorage : undefined,
  },
});

export type Stroke =
  | "Freestyle"
  | "Backstroke"
  | "Breaststroke"
  | "Butterfly"
  | "IM"
  | "Mix (back→breast)";

export const STROKES: Stroke[] = [
  "Freestyle",
  "Backstroke",
  "Breaststroke",
  "Butterfly",
  "IM",
  "Mix (back→breast)",
];

export const EQUIPMENT_OPTIONS = [
  "Fins",
  "Kickboard",
  "Pull buoy",
  "Paddles",
  "Snorkel",
];

export interface SessionRow {
  id: string;
  date: string;
  start_time: string;
  pool_length: number;
  created_at: string;
  user_id: string | null;
}

export interface SetDbRow {
  id: string;
  session_id: string;
  order_index: number;
  type: "set" | "rest";
  stroke: string | null;
  laps: number | null;
  equipment: string[] | null;
  start_time: string | null;
  duration_seconds: number | null;
  is_manual_start: boolean;
  is_manual_duration: boolean;
}
