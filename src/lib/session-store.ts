import { create } from "zustand";
import type { Row } from "./swim-types";

export interface SeedSession {
  date: string;
  poolLength: number;
  rows: Row[];
}

interface EditState {
  loadId: string | null;
  prefillDate: string | null;
  seed: SeedSession | null;
  requestEdit: (id: string) => void;
  consume: () => string | null;
  requestNewOnDate: (date: string) => void;
  consumePrefillDate: () => string | null;
  requestSeed: (seed: SeedSession) => void;
  consumeSeed: () => SeedSession | null;
}

// Cross-route: Calendar requests editing/seeding a session; Log consumes on mount.
export const useEditStore = create<EditState>((set, get) => ({
  loadId: null,
  prefillDate: null,
  seed: null,
  requestEdit: (id) => set({ loadId: id, prefillDate: null, seed: null }),
  consume: () => {
    const id = get().loadId;
    if (id) set({ loadId: null });
    return id;
  },
  requestNewOnDate: (date) =>
    set({ prefillDate: date, loadId: null, seed: null }),
  consumePrefillDate: () => {
    const d = get().prefillDate;
    if (d) set({ prefillDate: null });
    return d;
  },
  requestSeed: (seed) => set({ seed, loadId: null, prefillDate: null }),
  consumeSeed: () => {
    const s = get().seed;
    if (s) set({ seed: null });
    return s;
  },
}));
