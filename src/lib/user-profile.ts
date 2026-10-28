import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

export interface UserProfile {
  user_id: string;
  weight_kg: number | null;
  birth_year: number | null;
}

export interface WeightLogEntry {
  id: string;
  user_id: string;
  weight_kg: number;
  date: string;
  created_at: string;
}

/**
 * Reads the signed-in user's profile + latest weight (from weight_log if present,
 * else the value cached on user_profile). Exposes a refresh() callback so other
 * tabs can trigger a re-fetch after writes.
 */
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLatestWeight(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: prof } = await supabase
      .from("user_profile")
      .select("user_id, weight_kg, birth_year")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((prof as UserProfile) ?? null);

    const { data: latest } = await supabase
      .from("weight_log")
      .select("weight_kg")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const w = latest ? (latest as { weight_kg: number }).weight_kg : null;
    setLatestWeight(w != null ? Number(w) : null);
    setLoading(false);

  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const ageYears =
    profile?.birth_year != null
      ? new Date().getFullYear() - profile.birth_year
      : null;

  return { profile, latestWeight, ageYears, loading, refresh: load };
}
