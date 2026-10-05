/**
 * SINGLE data-access layer (BRIEF §0 rule 3). Components must only call these
 * async functions. To swap in the real FastAPI backend, replace the bodies with
 * fetch() calls returning the same types; no component changes needed.
 */
import type {
  Benchmarks,
  Dist,
  Grade,
  LandfallTime,
  ModalityKey,
  ModalityState,
  Storm,
  StormStep,
  StormSummary,
} from '../types';
import { DEGRADATION, GRADE_CODES, MODALITY_KEYS } from '../lib/constants';
import fengal from '../data/storms/fengal.json';
import asna from '../data/storms/asna.json';
import dana from '../data/storms/dana.json';
import remal from '../data/storms/remal.json';
import benchmarks from '../data/benchmarks.json';
import coastlineRaw from '../data/coastline.geojson?raw';
import type { FeatureCollection } from 'geojson';

const STORMS: Record<string, Storm> = {
  fengal: fengal as unknown as Storm,
  asna: asna as unknown as Storm,
  dana: dana as unknown as Storm,
  remal: remal as unknown as Storm,
};
const ORDER = ['fengal', 'asna', 'dana', 'remal'];

export async function listStorms(): Promise<StormSummary[]> {
  return ORDER.map((id) => {
    const s = STORMS[id];
    return { id: s.id, name: s.name, season: s.season, role: s.role };
  });
}

export async function getStorm(id: string): Promise<Storm> {
  const s = STORMS[id];
  if (!s) throw new Error(`Unknown storm: ${id}`);
  return s;
}

export async function getBenchmarks(): Promise<Benchmarks> {
  return benchmarks as unknown as Benchmarks;
}

export async function getCoastline(): Promise<FeatureCollection> {
  return JSON.parse(coastlineRaw) as FeatureCollection;
}

/* ------------------------------------------------------------------ */
/* Degraded-confidence transform (deterministic; approved table A8/A9) */
/* ------------------------------------------------------------------ */

export interface DegradedStep {
  step: StormStep; // transformed copy; original JSON is never mutated
  /** Modalities actually in use (requested ON and available in data). */
  effective: ModalityState;
  /** Modalities flagged "missing" in the data: count as OFF, cannot be toggled on. */
  missingInData: ModalityKey[];
  widenFactor: number;
  confidence: number; // 0-100
  warnings: string[];
}

const widenDist = (d: Dist, f: number, floor = -Infinity): Dist => ({
  mean: d.mean,
  p10: Math.max(floor, d.mean - (d.mean - d.p10) * f),
  p90: d.mean + (d.p90 - d.mean) * f,
});

function widenLandfallTime(lt: LandfallTime, f: number): LandfallTime {
  if (f === 1) return lt;
  const med = Date.parse(lt.median);
  const stretch = (iso: string) => new Date(med + (Date.parse(iso) - med) * f).toISOString();
  const H = 3_600_000;
  const bins = new Map<number, number>();
  for (const b of lt.histogram) {
    const centre = Date.parse(b.t) + H / 2;
    const t = med + (centre - med) * f;
    const key = Math.floor(t / H) * H;
    bins.set(key, (bins.get(key) ?? 0) + b.p);
  }
  // spread mass across stretched gaps so the histogram stays smooth
  const keys = [...bins.keys()].sort((a, b) => a - b);
  const filled: { t: string; p: number }[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1]; k += H) filled.push({ t: new Date(k).toISOString(), p: 0 });
  for (let i = 0; i < keys.length; i++) {
    const start = keys[i];
    const end = i + 1 < keys.length ? keys[i + 1] : start + H;
    const span = Math.max(1, Math.round((end - start) / H));
    const share = bins.get(start)! / span;
    for (let j = 0; j < span; j++) {
      const idx = (start - keys[0]) / H + j;
      if (filled[idx]) filled[idx].p += share;
    }
  }
  const total = filled.reduce((s, b) => s + b.p, 0);
  return {
    median: lt.median,
    p10: stretch(lt.p10),
    p90: stretch(lt.p90),
    histogram: filled.map((b) => ({ t: b.t, p: b.p / total })),
  };
}

/** Flatten grade probabilities toward uniform: p^(1/f), renormalized. */
function flattenProbs(p: Record<Grade, number>, f: number): Record<Grade, number> {
  if (f === 1) return p;
  const raw = GRADE_CODES.map((g) => Math.pow(p[g], 1 / f));
  const s = raw.reduce((a, b) => a + b, 0);
  const out = {} as Record<Grade, number>;
  GRADE_CODES.forEach((g, i) => (out[g] = raw[i] / s));
  return out;
}

export function applyDegradation(step: StormStep, requested: ModalityState): DegradedStep {
  const missingInData = MODALITY_KEYS.filter((m) => !step.inputs[m].available);
  const effective = {} as ModalityState;
  MODALITY_KEYS.forEach((m) => (effective[m] = requested[m] && step.inputs[m].available));
  const off = MODALITY_KEYS.filter((m) => !effective[m]);

  const f = off.reduce((acc, m) => acc * DEGRADATION[m].widen, 1);

  const availableQ = MODALITY_KEYS.filter((m) => step.inputs[m].available).map((m) => step.inputs[m].quality);
  const base = availableQ.length ? (availableQ.reduce((a, b) => a + b, 0) / availableQ.length) * 100 : 0;
  const penalty = off.reduce((acc, m) => acc + DEGRADATION[m].confidencePenalty, 0);
  const confidence = Math.round(Math.min(100, Math.max(0, base - penalty)));

  const warnings: string[] = [];
  off.forEach((m) => warnings.push(`Reduced confidence: ${DEGRADATION[m].label} unavailable - model running in degraded mode`));
  MODALITY_KEYS.filter((m) => step.inputs[m].flag === 'interpolated' && effective[m]).forEach((m) =>
    warnings.push(`${DEGRADATION[m].label} data interpolated for this time step`),
  );

  const p = step.predicted;
  const transformed: StormStep =
    f === 1
      ? step
      : {
          ...step,
          predicted: {
            ...p,
            gradeProbs: flattenProbs(p.gradeProbs, f),
            intensity: p.intensity.map((x) => ({
              ...x,
              wind: widenDist(x.wind, f, 0),
              pressure: widenDist(x.pressure, f),
            })),
            track: p.track.map((t) => ({ ...t, radiusKm: t.radiusKm * f })),
            landfall: p.landfall
              ? {
                  time: widenLandfallTime(p.landfall.time, f),
                  point: { ...p.landfall.point, radius80Km: p.landfall.point.radius80Km * f },
                }
              : null,
          },
        };

  return { step: transformed, effective, missingInData, widenFactor: f, confidence, warnings };
}

export async function getStep(stormId: string, index: number, modalities: ModalityState): Promise<DegradedStep> {
  const s = await getStorm(stormId);
  const i = Math.min(Math.max(0, index), s.steps.length - 1);
  return applyDegradation(s.steps[i], modalities);
}
