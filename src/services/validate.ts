import type { Storm, StormStep } from '../types';
import { GRADE_CODES, MODALITY_KEYS, PHYSICS_KEYS } from '../lib/constants';

/**
 * Runtime shape validation for mock storm JSON (BRIEF §7 step 2: "validate against types").
 * Returns a list of human-readable problems; empty list means valid.
 */
const EPS = 1e-6;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isIso = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));

function checkDist(d: unknown, where: string, errs: string[]) {
  const o = d as { mean: unknown; p10: unknown; p90: unknown };
  if (!o || !isNum(o.mean) || !isNum(o.p10) || !isNum(o.p90)) return errs.push(`${where}: bad dist`);
  if (!(o.p10 <= o.mean + EPS && o.mean <= o.p90 + EPS)) errs.push(`${where}: p10<=mean<=p90 violated`);
}

function sumsToOne(rec: Record<string, number>, keys: readonly string[], where: string, errs: string[]) {
  let s = 0;
  for (const k of keys) {
    if (!isNum(rec?.[k]) || rec[k] < 0) return errs.push(`${where}.${k}: not a non-negative number`);
    s += rec[k];
  }
  if (Math.abs(s - 1) > EPS) errs.push(`${where}: sums to ${s}, expected 1`);
}

export function validateStep(s: StormStep, where: string): string[] {
  const errs: string[] = [];
  if (!isIso(s.time)) errs.push(`${where}.time not ISO`);
  if (!isNum(s.lat) || !isNum(s.lon)) errs.push(`${where}: lat/lon`);
  if (!isNum(s.observed?.maxWindKt) || !isNum(s.observed?.minPressureHpa)) errs.push(`${where}: observed`);

  const p = s.predicted;
  if (!p) return [...errs, `${where}: missing predicted`];
  if (!isNum(p.centre?.dLat) || !isNum(p.centre?.dLon)) errs.push(`${where}: centre`);
  sumsToOne(p.gradeProbs, GRADE_CODES, `${where}.gradeProbs`, errs);

  const leads = p.intensity?.map((x) => x.leadH).join(',');
  if (leads !== '0,24,48,72') errs.push(`${where}: intensity leads ${leads}`);
  p.intensity?.forEach((x) => {
    checkDist(x.wind, `${where}.intensity[${x.leadH}].wind`, errs);
    checkDist(x.pressure, `${where}.intensity[${x.leadH}].pressure`, errs);
  });

  if (!isNum(p.riProb24h) || p.riProb24h < 0 || p.riProb24h > 1) errs.push(`${where}: riProb24h`);

  if (p.track?.length !== 13) errs.push(`${where}: track should have 13 points (0..72 h)`);
  p.track?.forEach((t, k) => {
    if (t.leadH !== k * 6) errs.push(`${where}.track[${k}].leadH`);
    if (k > 0 && t.radiusKm < p.track[k - 1].radiusKm) errs.push(`${where}.track[${k}]: radius shrinks`);
  });

  if (!['expected', 'none-72h', 'occurred'].includes(p.landfallStatus)) errs.push(`${where}: landfallStatus`);
  if ((p.landfallStatus === 'expected') !== (p.landfall !== null)) errs.push(`${where}: landfall/status mismatch`);
  if (p.landfall) {
    const lt = p.landfall.time;
    if (![lt.median, lt.p10, lt.p90].every(isIso)) errs.push(`${where}: landfall time ISO`);
    if (!(Date.parse(lt.p10) <= Date.parse(lt.median) && Date.parse(lt.median) <= Date.parse(lt.p90)))
      errs.push(`${where}: landfall p10<=median<=p90 violated`);
    const hs = lt.histogram.reduce((a, b) => a + b.p, 0);
    if (Math.abs(hs - 1) > EPS) errs.push(`${where}: landfall histogram sums to ${hs}`);
    const lp = p.landfall.point;
    if (!isNum(lp.lat) || !isNum(lp.lon) || !isNum(lp.radius80Km) || lp.radius80Km <= 0) errs.push(`${where}: landfall point`);
  }

  if (typeof p.flags?.recurving !== 'boolean' || typeof p.flags?.stalling !== 'boolean') errs.push(`${where}: flags`);
  if (!['eye', 'CDO', 'curved band', 'sheared'].includes(p.structure?.pattern)) errs.push(`${where}: structure`);

  for (const m of MODALITY_KEYS) {
    const inp = s.inputs?.[m];
    if (!inp || !isNum(inp.quality) || inp.quality < 0 || inp.quality > 1) errs.push(`${where}.inputs.${m}`);
    else if (inp.flag === 'missing' && inp.available) errs.push(`${where}.inputs.${m}: missing but available`);
  }
  for (const k of PHYSICS_KEYS) {
    const v = s.physics?.[k];
    if (!v || !isNum(v.value) || !isNum(v.anomaly) || typeof v.units !== 'string') errs.push(`${where}.physics.${k}`);
  }
  sumsToOne(s.explainability?.importance?.intensity, PHYSICS_KEYS, `${where}.importance.intensity`, errs);
  sumsToOne(s.explainability?.importance?.ri, PHYSICS_KEYS, `${where}.importance.ri`, errs);
  if (!s.explainability?.blobs?.length) errs.push(`${where}: no attribution blobs`);
  if (!isNum(s.comparators?.adtWindKt) || !isNum(s.comparators?.nwpWindKt)) errs.push(`${where}: comparators`);
  return errs;
}

export function validateStorm(st: Storm): string[] {
  const errs: string[] = [];
  if (st.synthetic !== true) errs.push(`${st.id}: synthetic must be true`);
  if (st.note !== 'Track and values are illustrative, loosely inspired by the real event.') errs.push(`${st.id}: note`);
  if (!st.steps?.length) errs.push(`${st.id}: no steps`);
  st.steps?.forEach((s, i) => {
    errs.push(...validateStep(s, `${st.id}[${i}]`));
    if (i > 0 && Date.parse(s.time) - Date.parse(st.steps[i - 1].time) !== 6 * 3_600_000) errs.push(`${st.id}[${i}]: not 6-hourly`);
  });
  return errs;
}
