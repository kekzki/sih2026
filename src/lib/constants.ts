import type { Grade, ModalityKey, PhysicsKey } from '../types';

export interface GradeDef {
  code: Grade;
  name: string;
  minKt: number;
  maxKt: number; // inclusive; Infinity for SuCS
  color: string;
}

/** IMD intensity grades (BRIEF §2). Keep colours in sync with tailwind.config.js. */
export const GRADES: readonly GradeDef[] = [
  { code: 'D', name: 'Depression', minKt: 17, maxKt: 27, color: '#fde68a' },
  { code: 'DD', name: 'Deep Depression', minKt: 28, maxKt: 33, color: '#fcd34d' },
  { code: 'CS', name: 'Cyclonic Storm', minKt: 34, maxKt: 47, color: '#fb923c' },
  { code: 'SCS', name: 'Severe Cyclonic Storm', minKt: 48, maxKt: 63, color: '#f97316' },
  { code: 'VSCS', name: 'Very Severe Cyclonic Storm', minKt: 64, maxKt: 89, color: '#ef4444' },
  { code: 'ESCS', name: 'Extremely Severe Cyclonic Storm', minKt: 90, maxKt: 119, color: '#c026d3' },
  { code: 'SuCS', name: 'Super Cyclonic Storm', minKt: 120, maxKt: Infinity, color: '#7e22ce' },
] as const;

export const GRADE_CODES: readonly Grade[] = GRADES.map((g) => g.code);

export const LOW_GRADE = { code: 'LOW', name: 'Low pressure area', color: '#6b7280' } as const;

/** Rapid intensification per IMD: gain >= 30 kt in 24 h. */
export const RI_THRESHOLD_KT = 30;
export const RI_WINDOW_H = 24;

/** Comparator disagreement thresholds (A13). */
export const DISAGREE_INTENSITY_KT = 10;
export const DISAGREE_TRACK_24H_KM = 100;

/** IMD RSMC New Delhi 2020-24 average errors (BRIEF §2). Targets to report against, not results. */
export const BENCHMARKS = {
  trackKm: { h24: 72, h48: 111, h72: 154 },
  intensityKt: { h24: 5.9, h48: 8.3, h72: 9.8 },
  landfallTimeH: { h24: 2.9, h48: 4.2, h72: 7.5 },
} as const;

/** Degraded-mode transform (A8, approved). Factors multiply across missing modalities. */
export const DEGRADATION: Record<ModalityKey, { widen: number; confidencePenalty: number; label: string }> = {
  insat: { widen: 1.6, confidencePenalty: 30, label: 'INSAT' },
  era5: { widen: 1.3, confidencePenalty: 15, label: 'ERA5/NWP' },
  track: { widen: 1.25, confidencePenalty: 10, label: 'Track history' },
};

export const MODALITY_KEYS: readonly ModalityKey[] = ['insat', 'era5', 'track'];

export const PHYSICS_KEYS: readonly PhysicsKey[] = [
  'shear',
  'sst',
  'midRH',
  'vorticity',
  'divergence',
  'steering',
];

export const PHYSICS_LABELS: Record<PhysicsKey, string> = {
  shear: 'Vertical wind shear',
  sst: 'Sea surface temperature',
  midRH: 'Mid-level humidity',
  vorticity: 'Low-level vorticity',
  divergence: 'Upper-level divergence',
  steering: 'Steering flow',
};

export const BANNER_TEXT =
  'PROTOTYPE - simulated outputs for demonstration. Not an operational forecast. Decision support for IMD forecasters; final authority rests with the forecaster.';
