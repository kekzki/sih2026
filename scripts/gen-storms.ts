/**
 * Deterministic mock-data generator.
 *   npm run gen:storms
 * Reads hand-authored key points from scripts/storm-specs.ts and writes
 * src/data/storms/<id>.json. No Math.random: all noise comes from a seeded
 * mulberry32 PRNG, so output is byte-identical on every run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADES, PHYSICS_KEYS } from '../src/lib/constants';
import { destination, haversineKm } from '../src/lib/geo';
import type {
  AttributionBlob,
  Grade,
  IntensityDist,
  Landfall,
  LandfallStatus,
  ModalityInput,
  ModalityKey,
  PhysicsKey,
  PhysicsVar,
  Storm,
  StormStep,
  StructurePattern,
  TrackPoint,
} from '../src/types';
import { NOTE, SPECS, type StormSpec } from './storm-specs';

/* ------------------------------------------------------------ utilities */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}
const normCdf = (x: number, mu: number, sd: number) => 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2)));

/** Round values to `d` decimals and push the residual into the largest entry so the sum is exactly 1. */
function normalizeRounded<K extends string>(w: Record<K, number>, d = 4): Record<K, number> {
  const keys = Object.keys(w) as K[];
  const total = keys.reduce((s, k) => s + w[k], 0);
  const out = {} as Record<K, number>;
  keys.forEach((k) => (out[k] = r(w[k] / total, d)));
  const sum = keys.reduce((s, k) => s + out[k], 0);
  const maxK = keys.reduce((a, b) => (out[a] >= out[b] ? a : b));
  out[maxK] = r(out[maxK] + (1 - sum), d);
  return out;
}

export const windToPressure = (w: number) => 1010 - Math.pow(Math.max(w, 0) / 6.7, 1 / 0.644);

/** Benchmark-shaped error growth, linearly interpolated (km / kt). */
const interp = (lead: number, v24: number, v48: number, v72: number) =>
  lead <= 24 ? (v24 * lead) / 24 : lead <= 48 ? v24 + ((v48 - v24) * (lead - 24)) / 24 : v48 + ((v72 - v48) * (lead - 48)) / 24;
const trackErrKm = (lead: number) => interp(Math.min(lead, 72), 72, 111, 154);
const intErrKt = (lead: number) => (lead === 0 ? 1.5 : interp(lead, 5.9, 8.3, 9.8));

/* ----------------------------------------------------- truth along path */
function truthAt(spec: StormSpec, fIdx: number): { lat: number; lon: number; wind: number } {
  const p = spec.path;
  const n = p.length;
  if (fIdx <= n - 1) {
    const i = Math.floor(fIdx);
    const f = fIdx - i;
    const a = p[i];
    const b = p[Math.min(i + 1, n - 1)];
    return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f, wind: a[2] + (b[2] - a[2]) * f };
  }
  // extrapolate beyond the authored life: persist last motion, decay wind
  const extra = fIdx - (n - 1);
  const last = p[n - 1];
  const prev = p[n - 2];
  return {
    lat: last[0] + (last[0] - prev[0]) * extra,
    lon: last[1] + (last[1] - prev[1]) * extra,
    wind: Math.max(15, last[2] - 4 * extra),
  };
}

function inRange(i: number, range: [number, number] | null) {
  return range !== null && i >= range[0] && i <= range[1];
}

/* -------------------------------------------------------- per-step parts */
function gradeProbs(meanKt: number, sdKt: number): Record<Grade, number> {
  const w = {} as Record<Grade, number>;
  GRADES.forEach((g, k) => {
    const lo = k === 0 ? -Infinity : g.minKt - 0.5;
    const hi = g.maxKt === Infinity ? Infinity : g.maxKt + 0.5;
    const pHi = hi === Infinity ? 1 : normCdf(hi, meanKt, sdKt);
    const pLo = lo === -Infinity ? 0 : normCdf(lo, meanKt, sdKt);
    w[g.code] = Math.max(pHi - pLo, 1e-5);
  });
  return normalizeRounded(w, 4);
}

function physicsFor(spec: StormSpec, i: number, rnd: () => number): Record<PhysicsKey, PhysicsVar> {
  const sym = () => rnd() * 2 - 1;
  const now = truthAt(spec, i);
  const fut = truthAt(spec, i + 4);
  const trend = fut.wind - now.wind; // kt / 24 h
  const nxt = truthAt(spec, i + 1);
  const speedKt = (haversineKm(now.lat, now.lon, nxt.lat, nxt.lon) / 6) * 0.54;
  const stalling = inRange(i, spec.stallingSteps);
  const vals: Record<PhysicsKey, number> = {
    shear: clamp(spec.env.shear - 0.15 * trend + sym() * 1.5, 2, 40),
    sst: spec.env.sst + sym() * 0.1 - (stalling ? 0.6 : 0),
    midRH: clamp(spec.env.midRH + 0.4 * trend + sym() * 3, 20, 95),
    vorticity: 5 + now.wind * 0.35 + sym(),
    divergence: 2 + 0.12 * trend + now.wind * 0.05 + sym() * 0.5,
    steering: Math.max(0.5, speedKt),
  };
  const clim: Record<PhysicsKey, [number, number, string]> = {
    shear: [12, 6, 'kt'],
    sst: [28.5, 0.8, '°C'],
    midRH: [65, 10, '%'],
    vorticity: [15, 6, '1e-5 s⁻¹'],
    divergence: [4, 2, '1e-5 s⁻¹'],
    steering: [8, 4, 'kt'],
  };
  const out = {} as Record<PhysicsKey, PhysicsVar>;
  PHYSICS_KEYS.forEach((k) => {
    const [mu, sd, units] = clim[k];
    out[k] = { value: r(vals[k], 1), units, anomaly: r(clamp((vals[k] - mu) / sd, -3, 3), 2) };
  });
  return out;
}

function importance(phys: Record<PhysicsKey, PhysicsVar>) {
  const baseI: Record<PhysicsKey, number> = { shear: 0.25, sst: 0.2, midRH: 0.15, vorticity: 0.15, divergence: 0.15, steering: 0.1 };
  const baseR: Record<PhysicsKey, number> = { shear: 0.3, sst: 0.25, midRH: 0.25, vorticity: 0.08, divergence: 0.1, steering: 0.02 };
  const wi = {} as Record<PhysicsKey, number>;
  const wr = {} as Record<PhysicsKey, number>;
  PHYSICS_KEYS.forEach((k) => {
    const a = Math.abs(phys[k].anomaly);
    wi[k] = baseI[k] + 0.15 * a;
    wr[k] = baseR[k] + (k === 'shear' || k === 'sst' || k === 'midRH' ? 0.2 * a : 0.05 * a);
  });
  return { intensity: normalizeRounded(wi, 3), ri: normalizeRounded(wr, 3) };
}

function structureFor(wind: number, shear: number, rnd: () => number): { pattern: StructurePattern; prob: number } {
  const pattern: StructurePattern = shear > 20 ? 'sheared' : wind >= 64 ? 'eye' : wind >= 34 ? 'CDO' : 'curved band';
  return { pattern, prob: r(0.55 + 0.3 * rnd(), 2) };
}

function blobsFor(pattern: StructurePattern, rnd: () => number): AttributionBlob[] {
  const b = (x: number, y: number, radius: number, weight: number): AttributionBlob => ({
    x: r(x, 3), y: r(y, 3), radius: r(radius, 3), weight: r(weight, 2),
  });
  const jit = () => (rnd() * 2 - 1) * 0.02;
  switch (pattern) {
    case 'eye':
      return [0, 72, 144, 216, 288].map((deg, k) => {
        const a = (deg * Math.PI) / 180;
        return b(0.5 + 0.09 * Math.cos(a) + jit(), 0.5 + 0.09 * Math.sin(a) + jit(), 0.07, 0.95 - k * 0.08);
      });
    case 'CDO':
      return [b(0.5 + jit(), 0.5 + jit(), 0.14, 1), b(0.66 + jit(), 0.4 + jit(), 0.08, 0.55), b(0.36 + jit(), 0.64 + jit(), 0.07, 0.45)];
    case 'sheared':
      return [b(0.6 + jit(), 0.44 + jit(), 0.12, 0.95), b(0.7 + jit(), 0.36 + jit(), 0.08, 0.6), b(0.48 + jit(), 0.52 + jit(), 0.05, 0.35)];
    case 'curved band':
    default:
      return [0, 1, 2, 3].map((k) => {
        const a = 0.6 + k * 0.9;
        const rad = 0.08 + k * 0.06;
        return b(0.5 + rad * Math.cos(a) + jit(), 0.5 + rad * Math.sin(a) + jit(), 0.07, 0.9 - k * 0.15);
      });
  }
}

function inputsFor(spec: StormSpec, i: number, rnd: () => number): Record<ModalityKey, ModalityInput> {
  const base: Record<ModalityKey, number> = {
    insat: 0.88 + 0.08 * rnd(),
    era5: 0.9 + 0.06 * rnd(),
    track: (spec.atypical && i < 3 ? 0.72 : 0.94) + 0.04 * rnd(),
  };
  const out = {} as Record<ModalityKey, ModalityInput>;
  (Object.keys(base) as ModalityKey[]).forEach((m) => {
    const o = spec.outages.find((x) => x.step === i && x.modality === m);
    if (!o) out[m] = { available: true, quality: r(base[m], 2), flag: 'ok' };
    else if (o.flag === 'interpolated') out[m] = { available: true, quality: 0.55, flag: 'interpolated' };
    else out[m] = { available: false, quality: 0, flag: 'missing' };
  });
  return out;
}

function landfallFor(
  spec: StormSpec,
  i: number,
  tMs: number,
  rnd: () => number,
): { status: LandfallStatus; landfall: Landfall | null } {
  if (!spec.landfall) return { status: 'none-72h', landfall: null };
  const lfMs = Date.parse(spec.landfall.time);
  const hrs = (lfMs - tMs) / HOUR;
  if (hrs <= 0) return { status: 'occurred', landfall: null };
  if (hrs > 72) return { status: 'none-72h', landfall: null };

  const stall = inRange(i, spec.stallingSteps) ? spec.stallLandfallSpread : 1;
  const sd = (1.5 + 0.06 * hrs) * spec.spread * stall;
  const sdL = sd;
  const sdR = stall > 1 ? sd * 1.4 : sd; // stalling: heavier late tail
  const medMs = lfMs + (rnd() * 2 - 1) * 0.25 * sd * HOUR;
  const p10Ms = medMs - 1.2816 * sdL * HOUR;
  const p90Ms = medMs + 1.2816 * sdR * HOUR;

  const startH = Math.floor((medMs - 2.5 * sdL * HOUR) / HOUR);
  const endH = Math.ceil((medMs + 2.5 * sdR * HOUR) / HOUR);
  const raw: Record<string, number> = {};
  for (let h = startH; h <= endH; h++) {
    const c = (h + 0.5) * HOUR;
    const s = c < medMs ? sdL : sdR;
    const z = (c - medMs) / (s * HOUR);
    raw[iso(h * HOUR)] = Math.exp(-0.5 * z * z) + 1e-6;
  }
  const norm = normalizeRounded(raw, 4);
  const histogram = Object.keys(norm).map((t) => ({ t, p: norm[t] }));

  const errKm = 0.35 * trackErrKm(hrs) * spec.spread;
  const [plat, plon] = destination(spec.landfall.lat, spec.landfall.lon, rnd() * 360, errKm);
  return {
    status: 'expected',
    landfall: {
      time: { median: iso(Math.round(medMs / 60000) * 60000), p10: iso(Math.round(p10Ms / 60000) * 60000), p90: iso(Math.round(p90Ms / 60000) * 60000), histogram },
      point: { lat: r(plat, 3), lon: r(plon, 3), radius80Km: r((20 + 1.7 * hrs) * spec.spread, 0) },
    },
  };
}

/* ------------------------------------------------------------ main step */
function buildStep(spec: StormSpec, i: number, rnd: () => number): StormStep {
  const sym = () => rnd() * 2 - 1;
  const tMs = Date.parse(spec.start) + i * 6 * HOUR;
  const [lat, lon, obsWind] = spec.path[i];

  // track forecast (0..72 h every 6 h)
  const errBearing = rnd() * 360;
  const nwpBearing = errBearing + 60 + rnd() * 120;
  const track: TrackPoint[] = [];
  const nwpTrack: { leadH: number; lat: number; lon: number }[] = [];
  for (let L = 0; L <= 72; L += 6) {
    const t = truthAt(spec, i + L / 6);
    const [flat, flon] = destination(t.lat, t.lon, errBearing + L * 0.5, 0.35 * trackErrKm(L) * spec.spread);
    const [nlat, nlon] = destination(t.lat, t.lon, nwpBearing, 0.45 * trackErrKm(L) * spec.spread);
    track.push({ leadH: L, lat: r(flat, 3), lon: r(flon, 3), radiusKm: r((25 + 2.4 * L) * spec.spread, 0), windKt: r(t.wind, 0) });
    nwpTrack.push({ leadH: L, lat: r(nlat, 3), lon: r(nlon, 3) });
  }

  // intensity distribution
  const intensity: IntensityDist[] = ([0, 24, 48, 72] as const).map((L) => {
    const t = truthAt(spec, i + L / 6);
    const mean = Math.max(15, t.wind + sym() * 0.4 * intErrKt(L) * spec.spread);
    const s = (2.5 + 0.9 * intErrKt(L)) * spec.spread;
    const p10 = Math.max(10, mean - s);
    const p90 = mean + 1.1 * s;
    return {
      leadH: L,
      wind: { mean: r(mean, 1), p10: r(p10, 1), p90: r(p90, 1) },
      pressure: { mean: r(windToPressure(mean), 1), p10: r(windToPressure(p90), 1), p90: r(windToPressure(p10), 1) },
    };
  });
  const now = intensity[0].wind;

  const fut24 = truthAt(spec, i + 4).wind;
  const riProb = spec.riProb ? spec.riProb[i] : clamp(0.02 + (Math.max(0, fut24 - obsWind) / 30) * 0.3 + rnd() * 0.02, 0.01, 0.9);

  const physics = physicsFor(spec, i, rnd);
  const structure = structureFor(obsWind, physics.shear.value, rnd);
  const lf = landfallFor(spec, i, tMs, rnd);
  const adtOffset = spec.adtDisagree.find((a) => a.step === i)?.offsetKt ?? sym() * 4;

  return {
    time: iso(tMs),
    lat,
    lon,
    observed: { maxWindKt: obsWind, minPressureHpa: r(windToPressure(obsWind), 0) },
    predicted: {
      centre: { dLat: r(sym() * 0.12 * spec.spread, 3), dLon: r(sym() * 0.12 * spec.spread, 3) },
      gradeProbs: gradeProbs(now.mean, (now.p90 - now.p10) / 2.5632),
      intensity,
      riProb24h: r(riProb, 2),
      track,
      landfallStatus: lf.status,
      landfall: lf.landfall,
      flags: {
        recurving: inRange(i, spec.recurvingSteps),
        stalling: inRange(i, spec.stallingSteps),
        atypical: spec.atypical,
      },
      structure,
    },
    inputs: inputsFor(spec, i, rnd),
    physics,
    explainability: { blobs: blobsFor(structure.pattern, rnd), importance: importance(physics) },
    comparators: {
      adtWindKt: r(now.mean + adtOffset, 0),
      nwpWindKt: r(now.mean + sym() * 4, 0),
      nwpTrack,
    },
  };
}

export function buildStorm(spec: StormSpec): Storm {
  const rnd = mulberry32(spec.seed);
  return {
    id: spec.id,
    name: spec.name,
    basin: spec.basin,
    season: spec.season,
    role: spec.role,
    synthetic: true,
    note: NOTE,
    reason: spec.reason,
    caseFigures: spec.caseFigures,
    steps: spec.path.map((_, i) => buildStep(spec, i, rnd)),
  };
}

/* ------------------------------------------------------------- CLI entry */
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/storms');
  mkdirSync(outDir, { recursive: true });
  for (const spec of SPECS) {
    const storm = buildStorm(spec);
    writeFileSync(resolve(outDir, `${spec.id}.json`), JSON.stringify(storm, null, 2) + '\n');
    console.log(`wrote ${spec.id}.json (${storm.steps.length} steps)`);
  }
}
