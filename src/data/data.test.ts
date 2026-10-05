import { describe, expect, it } from 'vitest';
import type { Storm } from '../types';
import fengal from './storms/fengal.json';
import asna from './storms/asna.json';
import dana from './storms/dana.json';
import remal from './storms/remal.json';
import benchmarks from './benchmarks.json';
import { validateStorm } from '../services/validate';
import { buildStorm } from '../../scripts/gen-storms';
import { SPECS } from '../../scripts/storm-specs';
import { haversineKm } from '../lib/geo';

const storms = { fengal, asna, dana, remal } as unknown as Record<string, Storm>;

const windowH = (s: Storm) =>
  Math.max(
    0,
    ...s.steps.map((st) =>
      st.predicted.landfall ? (Date.parse(st.predicted.landfall.time.p90) - Date.parse(st.predicted.landfall.time.p10)) / 3.6e6 : 0,
    ),
  );

describe('mock storm data', () => {
  it.each(Object.keys(storms))('%s conforms to types and invariants', (id) => {
    expect(validateStorm(storms[id])).toEqual([]);
  });

  it.each(SPECS.map((s) => s.id))('%s JSON is in sync with the deterministic generator', (id) => {
    const spec = SPECS.find((s) => s.id === id)!;
    expect(JSON.parse(JSON.stringify(buildStorm(spec)))).toEqual(storms[id]);
  });

  it('generator is deterministic across runs', () => {
    expect(buildStorm(SPECS[0])).toEqual(buildStorm(SPECS[0]));
  });

  it('Fengal: RI ~0.6, stalling flag, wide landfall window, landfall near Puducherry', () => {
    const f = storms.fengal;
    const maxRi = Math.max(...f.steps.map((s) => s.predicted.riProb24h));
    expect(maxRi).toBeGreaterThanOrEqual(0.55);
    expect(maxRi).toBeLessThanOrEqual(0.65);
    expect(f.steps.some((s) => s.predicted.flags.stalling)).toBe(true);
    expect(windowH(f)).toBeGreaterThanOrEqual(24);
    const lfStep = f.steps.find((s) => s.predicted.landfall)!;
    const pt = lfStep.predicted.landfall!.point;
    expect(haversineKm(pt.lat, pt.lon, 11.93, 79.83)).toBeLessThan(250);
    expect(f.steps.some((s) => s.inputs.insat.flag === 'missing')).toBe(true);
  });

  it('Dana and Remal controls are tight', () => {
    expect(windowH(storms.dana)).toBeLessThanOrEqual(12);
    expect(windowH(storms.remal)).toBeLessThanOrEqual(12);
    expect(windowH(storms.dana)).toBeLessThan(windowH(storms.fengal) / 2);
  });

  it('Asna is atypical land genesis with no landfall', () => {
    expect(storms.asna.steps.every((s) => s.predicted.flags.atypical === 'land genesis')).toBe(true);
    expect(storms.asna.steps.every((s) => s.predicted.landfall === null)).toBe(true);
  });

  it('benchmarks use exactly the IMD 2020-24 numbers', () => {
    const b = Object.fromEntries(benchmarks.imd.map((r) => [r.metric, [r.h24, r.h48, r.h72]]));
    expect(b['Track error']).toEqual([72, 111, 154]);
    expect(b['Intensity error']).toEqual([5.9, 8.3, 9.8]);
    expect(b['Landfall-time error']).toEqual([2.9, 4.2, 7.5]);
    expect(benchmarks.ourMvp.label).toMatch(/placeholder/);
  });
});
