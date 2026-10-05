import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditEntry, LayerKey, ModalityKey, ModalityState, Mode, Theme } from '../types';

export type Speed = 1 | 2 | 4;

export interface AppState {
  stormId: string;
  timeIndex: number;
  playing: boolean;
  speed: Speed;
  mode: Mode;
  modalities: ModalityState;
  theme: Theme;
  layers: Record<LayerKey, boolean>;
  auditLog: AuditEntry[];
  /** Forecaster notes keyed by `${stormId}@${timeIndex}`. */
  notes: Record<string, string>;

  setStorm: (id: string) => void;
  setTimeIndex: (i: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: Speed) => void;
  setMode: (m: Mode) => void;
  toggleModality: (m: ModalityKey) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleLayer: (l: LayerKey) => void;
  logAction: (action: string, detail?: string) => void;
  setNote: (key: string, text: string) => void;
}

let auditSeq = 0;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stormId: 'fengal',
      timeIndex: 0,
      playing: false,
      speed: 1,
      mode: 'MVP',
      modalities: { insat: true, era5: true, track: true },
      theme: 'dark',
      layers: { observed: true, cone: true, nwp: false, landfall: true },
      auditLog: [],
      notes: {},

      setStorm: (id) => set({ stormId: id, timeIndex: 0, playing: false }),
      setTimeIndex: (i) => set({ timeIndex: Math.max(0, i) }),
      setPlaying: (p) => set({ playing: p }),
      setSpeed: (s) => set({ speed: s }),
      setMode: (m) => set({ mode: m }),
      toggleModality: (m) => set((s) => ({ modalities: { ...s.modalities, [m]: !s.modalities[m] } })),
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      toggleLayer: (l) => set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
      logAction: (action, detail) => {
        const { stormId, mode } = get();
        const entry: AuditEntry = { id: ++auditSeq, timestamp: new Date().toISOString(), action, storm: stormId, mode, detail };
        set((s) => ({ auditLog: [entry, ...s.auditLog] }));
      },
      setNote: (key, text) => set((s) => ({ notes: { ...s.notes, [key]: text } })),
    }),
    {
      name: 'cyclone-ai-prefs',
      partialize: (s) => ({ mode: s.mode, theme: s.theme }),
    },
  ),
);
