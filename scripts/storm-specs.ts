/**
 * HAND-AUTHORED key points for the four synthetic storms.
 * Track positions, wind curves, flags, landfall and (for Fengal) the RI curve
 * are written by hand here; scripts/gen-storms.ts derives everything else
 * deterministically. Values are illustrative, loosely inspired by the real events.
 */
import type { Storm } from '../src/types';

export interface StormSpec {
  id: string;
  name: string;
  basin: Storm['basin'];
  season: string;
  role: Storm['role'];
  reason: string;
  caseFigures: Storm['caseFigures'];
  seed: number;
  start: string; // ISO UTC of step 0; steps are 6-hourly
  /** [lat, lon, observed max wind kt] per 6-hourly step. */
  path: [number, number, number][];
  /** Multiplier on all uncertainty spreads (controls < 1, difficult cases > 1). */
  spread: number;
  /** Extra multiplier on landfall-time spread while stalling. */
  stallLandfallSpread: number;
  landfall: { time: string; lat: number; lon: number } | null;
  stallingSteps: [number, number] | null; // inclusive index range
  recurvingSteps: [number, number] | null;
  atypical: string | null;
  /** Optional hand-authored RI probability per step (else derived). */
  riProb?: number[];
  /** Steps where a modality is degraded in the data itself. */
  outages: { step: number; modality: 'insat' | 'era5' | 'track'; flag: 'interpolated' | 'missing' }[];
  /** Steps where ADT disagrees strongly with the model (kt offset). */
  adtDisagree: { step: number; offsetKt: number }[];
  /** Baseline environment. */
  env: { sst: number; midRH: number; shear: number };
}

export const NOTE = 'Track and values are illustrative, loosely inspired by the real event.';

/* ---------------------------------------------------------------- FENGAL */
export const FENGAL: StormSpec = {
  id: 'fengal',
  name: 'Fengal',
  basin: 'Bay of Bengal',
  season: 'Nov 2024',
  role: 'flagship',
  reason:
    'Flagship: slow, stalling system near the Tamil Nadu coast where landfall timing was hard; shows wide timing uncertainty and an RI alert.',
  caseFigures: {
    title: 'Fengal case-report figures (not benchmarks)',
    source: 'IMD case report; lead times 24/48/60 h',
    rows: [
      { label: 'IMD landfall-time error, Fengal (24/48/60 h)', value: '7.0 / 6.0 / 13.0 h' },
      { label: 'Five-year average quoted in case report (24/48/60 h)', value: '2.8 / 4.4 / 4.6 h' },
    ],
  },
  seed: 2411,
  start: '2024-11-25T00:00:00Z',
  // prettier-ignore
  path: [
    [6.0, 86.0, 20], [6.4, 85.6, 22], [6.9, 85.1, 25], [7.4, 84.6, 25],    // 25 Nov
    [7.9, 84.2, 28], [8.4, 83.8, 30], [8.9, 83.4, 30], [9.4, 83.0, 32],    // 26 Nov
    [9.9, 82.7, 33], [10.3, 82.4, 33], [10.6, 82.2, 30], [10.9, 82.0, 30], // 27 Nov
    [11.2, 81.8, 32], [11.4, 81.7, 33], [11.5, 81.6, 35], [11.6, 81.5, 38], // 28 Nov (stall)
    [11.7, 81.4, 40], [11.8, 81.2, 40], [11.9, 81.0, 40], [11.9, 80.7, 42], // 29 Nov
    [12.0, 80.5, 45], [12.0, 80.3, 45], [12.0, 80.05, 42], [11.95, 79.85, 40], // 30 Nov (landfall)
    [12.0, 79.5, 33],                                                       // 01 Dec
  ],
  spread: 1.3,
  stallLandfallSpread: 2.6,
  landfall: { time: '2024-11-30T17:30:00Z', lat: 11.95, lon: 79.85 }, // near Puducherry
  stallingSteps: [11, 20],
  recurvingSteps: [17, 21],
  atypical: null,
  // prettier-ignore
  riProb: [
    0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.15,
    0.18, 0.20, 0.22, 0.28, 0.38, 0.52, 0.61, 0.48,
    0.35, 0.25, 0.18, 0.14, 0.10, 0.08, 0.05, 0.03, 0.02,
  ],
  outages: [
    { step: 9, modality: 'insat', flag: 'interpolated' },
    { step: 18, modality: 'insat', flag: 'missing' },
    { step: 21, modality: 'era5', flag: 'interpolated' },
  ],
  adtDisagree: [
    { step: 14, offsetKt: -13 },
    { step: 15, offsetKt: -12 },
  ],
  env: { sst: 28.6, midRH: 72, shear: 14 },
};

/* ---------------------------------------------------------------- ASNA */
export const ASNA: StormSpec = {
  id: 'asna',
  name: 'Asna',
  basin: 'Arabian Sea',
  season: 'Aug-Sep 2024',
  role: 'atypical',
  reason: 'Atypical: formed over land (Gujarat) and moved out to the Arabian Sea, a pattern rare in training data.',
  caseFigures: {
    title: 'Asna case-report figures (not benchmarks)',
    source: 'IMD case report',
    rows: [{ label: 'IMD 72 h track error, Asna vs average quoted in case report', value: '174 km vs 156 km' }],
  },
  seed: 2408,
  start: '2024-08-29T00:00:00Z',
  // prettier-ignore
  path: [
    [23.2, 70.0, 25], [23.3, 69.5, 28], [23.4, 69.0, 30], [23.5, 68.4, 33],
    [23.5, 67.8, 35], [23.4, 67.1, 38], [23.2, 66.4, 40], [23.0, 65.7, 40],
    [22.8, 65.0, 40], [22.6, 64.3, 38], [22.4, 63.6, 35], [22.2, 62.9, 33],
    [22.0, 62.2, 30], [21.8, 61.6, 28], [21.6, 61.0, 25], [21.5, 60.5, 22],
  ],
  spread: 1.45,
  stallLandfallSpread: 1,
  landfall: null,
  stallingSteps: null,
  recurvingSteps: null,
  atypical: 'land genesis',
  outages: [{ step: 2, modality: 'era5', flag: 'interpolated' }],
  adtDisagree: [{ step: 4, offsetKt: 11 }],
  env: { sst: 28.9, midRH: 60, shear: 18 },
};

/* ---------------------------------------------------------------- DANA */
export const DANA: StormSpec = {
  id: 'dana',
  name: 'Dana',
  basin: 'Bay of Bengal',
  season: 'Oct 2024',
  role: 'control',
  reason: 'Control: well-forecast Odisha landfall; confirms no regression on a typical recurving-free track.',
  caseFigures: null,
  seed: 2410,
  start: '2024-10-22T00:00:00Z',
  // prettier-ignore
  path: [
    [14.5, 89.5, 25], [15.1, 89.2, 28], [15.7, 88.9, 30], [16.3, 88.6, 33],
    [16.9, 88.3, 35], [17.5, 88.0, 40], [18.1, 87.8, 45], [18.7, 87.6, 50],
    [19.3, 87.4, 55], [19.8, 87.2, 60], [20.3, 87.05, 60], [20.85, 86.95, 60],
    [21.2, 86.7, 50], [21.5, 86.4, 40], [21.7, 86.1, 30],
  ],
  spread: 0.65,
  stallLandfallSpread: 1,
  landfall: { time: '2024-10-24T18:00:00Z', lat: 20.85, lon: 86.95 },
  stallingSteps: null,
  recurvingSteps: null,
  atypical: null,
  outages: [],
  adtDisagree: [],
  env: { sst: 29.4, midRH: 78, shear: 9 },
};

/* ---------------------------------------------------------------- REMAL */
export const REMAL: StormSpec = {
  id: 'remal',
  name: 'Remal',
  basin: 'Bay of Bengal',
  season: 'May 2024',
  role: 'control',
  reason: 'Control: well-forecast northward track to the Bangladesh/West Bengal coast; tight, calm uncertainty.',
  caseFigures: null,
  seed: 2405,
  start: '2024-05-24T00:00:00Z',
  // prettier-ignore
  path: [
    [15.5, 89.0, 25], [16.1, 89.0, 28], [16.7, 88.95, 30], [17.3, 88.9, 33],
    [17.9, 88.9, 35], [18.5, 88.9, 40], [19.1, 88.95, 45], [19.7, 89.0, 50],
    [20.3, 89.05, 55], [20.8, 89.1, 60], [21.3, 89.15, 60], [21.75, 89.2, 60],
    [22.6, 89.6, 45], [23.3, 90.2, 30],
  ],
  spread: 0.7,
  stallLandfallSpread: 1,
  landfall: { time: '2024-05-26T18:00:00Z', lat: 21.75, lon: 89.2 },
  stallingSteps: null,
  recurvingSteps: null,
  atypical: null,
  outages: [],
  adtDisagree: [],
  env: { sst: 30.2, midRH: 76, shear: 10 },
};

export const SPECS: StormSpec[] = [FENGAL, ASNA, DANA, REMAL];
