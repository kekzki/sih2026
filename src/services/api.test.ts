import { describe, expect, it } from 'vitest';
import type { ModalityState, Storm, StormStep } from '../types';
import fengal from '../data/storms/fengal.json';
import dana from '../data/storms/dana.json';
import { applyDegradation, getCoastline, getStep, listStorms } from './api';
import { validateStep } from './validate';

const F = fengal as unknown as Storm;
const D = dana as unknown as Storm;
const ALL_ON: ModalityState = { insat: true, era5: true, track: true };

// a Fengal step with a landfall block and all modalities available
const lfStep = F.steps.find(
  (s) => s.predicted.landfall && Object.values(s.inputs).every((i) => i.available),
) as StormStep;
const missingInsatStep = F.steps.find((s) => s.inputs.insat.flag === 'missing') as StormStep;

const width = (d: { p10: number; p90: number }) => d.p90 - d.p10;
const lfWidthH = (s: StormStep) =>
  (Date.parse(s.predicted.landfall!.time.p90) - Date.parse(s.predicted.landfall!.time.p10)) / 3.6e6;

describe('applyDegradation', () => {
  it('all modalities on: identity, factor 1, no warnings', () => {
    const r = applyDegradation(lfStep, ALL_ON);
    expect(r.widenFactor).toBe(1);
    expect(r.step).toBe(lfStep);
    expect(r.warnings).toEqual([]);
  });

  it('INSAT off: x1.6 widening, -30 confidence, warning chip text', () => {
    const on = applyDegradation(lfStep, ALL_ON);
    const off = applyDegradation(lfStep, { ...ALL_ON, insat: false });
    expect(off.widenFactor).toBeCloseTo(1.6);
    expect(off.confidence).toBe(Math.max(0, on.confidence - 30));
    expect(off.warnings).toContain('Reduced confidence: INSAT unavailable - model running in degraded mode');

    on.step.predicted.intensity.forEach((x, k) => {
      const y = off.step.predicted.intensity[k];
      expect(y.wind.mean).toBe(x.wind.mean); // means unchanged
      expect(width(y.wind)).toBeGreaterThan(width(x.wind));
      expect(width(y.pressure)).toBeCloseTo(width(x.pressure) * 1.6, 6);
    });
    on.step.predicted.track.forEach((t, k) => expect(off.step.predicted.track[k].radiusKm).toBeCloseTo(t.radiusKm * 1.6, 6));
    expect(off.step.predicted.landfall!.point.radius80Km).toBeCloseTo(on.step.predicted.landfall!.point.radius80Km * 1.6, 6);
    expect(lfWidthH(off.step)).toBeCloseTo(lfWidthH(on.step) * 1.6, 1);
  });

  it('factors multiply and penalties add (all off)', () => {
    const on = applyDegradation(lfStep, ALL_ON);
    const off = applyDegradation(lfStep, { insat: false, era5: false, track: false });
    expect(off.widenFactor).toBeCloseTo(1.6 * 1.3 * 1.25);
    expect(off.confidence).toBe(Math.max(0, on.confidence - 55));
  });

  it('ERA5 off alone: x1.3 / -15; track off alone: x1.25 / -10', () => {
    const on = applyDegradation(lfStep, ALL_ON).confidence;
    const e = applyDegradation(lfStep, { ...ALL_ON, era5: false });
    const t = applyDegradation(lfStep, { ...ALL_ON, track: false });
    expect(e.widenFactor).toBeCloseTo(1.3);
    expect(e.confidence).toBe(on - 15);
    expect(t.widenFactor).toBeCloseTo(1.25);
    expect(t.confidence).toBe(on - 10);
  });

  it('modality missing in data counts as OFF and cannot be toggled on', () => {
    const r = applyDegradation(missingInsatStep, ALL_ON);
    expect(r.missingInData).toContain('insat');
    expect(r.effective.insat).toBe(false);
    expect(r.widenFactor).toBeCloseTo(1.6);
    expect(r.warnings.some((w) => w.startsWith('Reduced confidence: INSAT'))).toBe(true);
  });

  it('flattens grade probabilities toward uniform while keeping sum 1', () => {
    const on = applyDegradation(lfStep, ALL_ON).step.predicted.gradeProbs;
    const off = applyDegradation(lfStep, { ...ALL_ON, insat: false }).step.predicted.gradeProbs;
    const sum = Object.values(off).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(Math.max(...Object.values(off))).toBeLessThan(Math.max(...Object.values(on)));
  });

  it('is deterministic, does not mutate input, and output stays valid', () => {
    const snapshot = JSON.stringify(lfStep);
    const a = applyDegradation(lfStep, { insat: false, era5: false, track: true });
    const b = applyDegradation(lfStep, { insat: false, era5: false, track: true });
    expect(a).toEqual(b);
    expect(JSON.stringify(lfStep)).toBe(snapshot);
    expect(validateStep(a.step, 'degraded')).toEqual([]);
  });

  it('handles landfall: null without crashing', () => {
    const noLf = D.steps.find((s) => s.predicted.landfall === null)!;
    const r = applyDegradation(noLf, { ...ALL_ON, insat: false });
    expect(r.step.predicted.landfall).toBeNull();
  });
});

describe('service functions', () => {
  it('lists the four storms with Fengal first', async () => {
    const s = await listStorms();
    expect(s.map((x) => x.id)).toEqual(['fengal', 'asna', 'dana', 'remal']);
  });
  it('getStep clamps index and returns degraded step', async () => {
    const r = await getStep('fengal', 999, ALL_ON);
    expect(r.step.time).toBe(F.steps[F.steps.length - 1].time);
  });
  it('loads coastline offline', async () => {
    const c = await getCoastline();
    expect(c.features.length).toBeGreaterThan(0);
  });
});
