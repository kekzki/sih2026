/**
 * TypeScript types for every data shape in the prototype (BRIEF.md §3, §6).
 * All mock JSON in src/data must conform to these.
 */

/** The 7 IMD grades (BRIEF §2). */
export type Grade = 'D' | 'DD' | 'CS' | 'SCS' | 'VSCS' | 'ESCS' | 'SuCS';
/** Grade or "LOW" (below 17 kt, low-pressure area, not one of the 7 grades). */
export type GradeOrLow = Grade | 'LOW';

export type Mode = 'MVP' | 'Advanced';
export type Theme = 'dark' | 'light';
export type ModalityKey = 'insat' | 'era5' | 'track';
export type PhysicsKey = 'shear' | 'sst' | 'midRH' | 'vorticity' | 'divergence' | 'steering';
export type StructurePattern = 'eye' | 'CDO' | 'curved band' | 'sheared';
export type ModalityFlag = 'ok' | 'interpolated' | 'missing';
export type LandfallStatus = 'expected' | 'none-72h' | 'occurred';

/** p10 / mean / p90 triple. Invariant: p10 <= mean <= p90. */
export interface Dist {
  mean: number;
  p10: number;
  p90: number;
}

export interface IntensityDist {
  leadH: 0 | 24 | 48 | 72;
  wind: Dist; // kt
  pressure: Dist; // hPa
}

export interface TrackPoint {
  leadH: number; // 0..72 step 6
  lat: number;
  lon: number;
  radiusKm: number; // uncertainty radius
  windKt: number; // forecast mean wind at this point (for grade colour)
}

export interface LandfallTime {
  median: string; // ISO UTC
  p10: string;
  p90: string;
  /** Hourly bins; probabilities sum to 1. */
  histogram: { t: string; p: number }[];
}

export interface LandfallPoint {
  lat: number;
  lon: number;
  radius80Km: number;
}

/** Landfall time and point are separate objects with separate uncertainty. */
export interface Landfall {
  time: LandfallTime;
  point: LandfallPoint;
}

export interface Flags {
  recurving: boolean;
  stalling: boolean;
  atypical: string | null; // e.g. "land genesis"
}

export interface CentreRefinement {
  /** Offset of refined centre from IMD flagged position (degrees). */
  dLat: number;
  dLon: number;
}

export interface Predicted {
  centre: CentreRefinement;
  gradeProbs: Record<Grade, number>; // sums to 1
  intensity: IntensityDist[]; // leads 0/24/48/72
  riProb24h: number; // 0-1
  track: TrackPoint[]; // every 6 h to 72 h
  landfallStatus: LandfallStatus;
  landfall: Landfall | null; // null when none within 72 h or already occurred
  flags: Flags;
  structure: { pattern: StructurePattern; prob: number };
}

export interface ModalityInput {
  available: boolean;
  quality: number; // 0-1
  flag: ModalityFlag;
}

export interface PhysicsVar {
  value: number;
  units: string;
  anomaly: number; // normalized (z-score-like), clamped to [-3, 3]
}

export interface AttributionBlob {
  x: number; // 0-1
  y: number; // 0-1
  radius: number; // 0-1 (fraction of image width)
  weight: number; // 0-1
}

export interface Explainability {
  blobs: AttributionBlob[];
  importance: {
    intensity: Record<PhysicsKey, number>; // sums to 1
    ri: Record<PhysicsKey, number>; // sums to 1
  };
}

export interface Comparators {
  adtWindKt: number; // Dvorak/ADT estimate (now)
  nwpWindKt: number; // NWP/ensemble consensus (now)
  nwpTrack: { leadH: number; lat: number; lon: number }[];
}

export interface StormStep {
  time: string; // ISO UTC; also the forecast issue time
  lat: number; // IMD flagged / best-track position
  lon: number;
  observed: { maxWindKt: number; minPressureHpa: number };
  predicted: Predicted;
  inputs: Record<ModalityKey, ModalityInput>;
  physics: Record<PhysicsKey, PhysicsVar>;
  explainability: Explainability;
  comparators: Comparators;
}

export interface CaseFigure {
  label: string;
  value: string;
}

export interface Storm {
  id: string;
  name: string;
  basin: 'Bay of Bengal' | 'Arabian Sea';
  season: string;
  role: 'flagship' | 'atypical' | 'control';
  synthetic: true;
  note: string;
  /** One-line reason this storm was chosen as a test case. */
  reason: string;
  /** Case-report figures; shown only in this storm's own case text, never as benchmarks. */
  caseFigures: { title: string; source: string; rows: CaseFigure[] } | null;
  steps: StormStep[];
}

export interface StormSummary {
  id: string;
  name: string;
  season: string;
  role: Storm['role'];
}

export interface BenchmarkRow {
  metric: string;
  units: string;
  h24: number;
  h48: number;
  h72: number;
}

export interface Benchmarks {
  source: string;
  imd: BenchmarkRow[];
  ourMvp: {
    label: string;
    rows: { metric: string; units: string; h24: null; h48: null; h72: null }[];
  };
}

export interface AuditEntry {
  id: number;
  timestamp: string; // ISO
  action: string;
  storm: string;
  mode: Mode;
  detail?: string;
}

export type ModalityState = Record<ModalityKey, boolean>;

export type LayerKey = 'observed' | 'cone' | 'nwp' | 'landfall';
