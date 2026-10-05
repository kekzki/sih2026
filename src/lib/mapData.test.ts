import { describe, expect, it } from 'vitest';
import type { Storm } from '../types';
import fengal from '../data/storms/fengal.json';
import asna from '../data/storms/asna.json';
import { forecastLinePositions, landfallMapState, nwpLinePositions, observedPath, stormBounds } from './mapData';
import { clampIndex, nextStepIndex, tickMs } from './timeline';

const F = fengal as unknown as Storm;
const A = asna as unknown as Storm;

describe('observedPath', () => {
  it('returns positions up to and including the current step', () => {
    const p = observedPath(F.steps, 3);
    expect(p).toHaveLength(4);
    expect(p[3]).toEqual([F.steps[3].lat, F.steps[3].lon]);
  });
  it('clamps out-of-range indices', () => {
    expect(observedPath(F.steps, -5)).toHaveLength(1);
    expect(observedPath(F.steps, 999)).toHaveLength(F.steps.length);
  });
});

describe('line helpers', () => {
  it('forecast and NWP polylines are [lat, lon] pairs', () => {
    const s = F.steps[5];
    expect(forecastLinePositions(s.predicted.track)).toHaveLength(13);
    expect(forecastLinePositions(s.predicted.track)[0]).toEqual([s.predicted.track[0].lat, s.predicted.track[0].lon]);
    expect(nwpLinePositions(s.comparators.nwpTrack)).toHaveLength(13);
  });
});

describe('stormBounds', () => {
  it('contains every observed position and landfall point', () => {
    const [[s, w], [n, e]] = stormBounds(F.steps);
    F.steps.forEach((st) => {
      expect(st.lat).toBeGreaterThan(s);
      expect(st.lat).toBeLessThan(n);
      expect(st.lon).toBeGreaterThan(w);
      expect(st.lon).toBeLessThan(e);
      const lf = st.predicted.landfall;
      if (lf) {
        expect(lf.point.lat).toBeGreaterThan(s);
        expect(lf.point.lon).toBeLessThan(e);
      }
    });
  });
  it('falls back to a NIO box for empty input', () => {
    expect(stormBounds([])).toEqual([[5, 60], [25, 100]]);
  });
});

describe('landfallMapState', () => {
  it('draws a ring with the 80% radius (km and m) when landfall is expected', () => {
    const s = F.steps.find((x) => x.predicted.landfall)!;
    const st = landfallMapState(s.predicted);
    expect(st.kind).toBe('ring');
    if (st.kind === 'ring') {
      expect(st.radiusKm).toBe(s.predicted.landfall!.point.radius80Km);
      expect(st.radiusM).toBe(st.radiusKm * 1000);
    }
  });
  it('landfall: null with status none-72h does not crash and explains why', () => {
    const st = landfallMapState(A.steps[0].predicted);
    expect(st).toEqual({ kind: 'none', message: 'No landfall expected within 72 h' });
  });
  it('status occurred (landfall: null) reports it already happened', () => {
    const last = F.steps[F.steps.length - 1];
    expect(last.predicted.landfallStatus).toBe('occurred');
    expect(landfallMapState(last.predicted)).toEqual({ kind: 'none', message: 'Landfall has already occurred' });
  });
  it('every step of every storm yields a state without throwing', () => {
    [F, A].forEach((storm) => storm.steps.forEach((s) => expect(() => landfallMapState(s.predicted)).not.toThrow()));
  });
});

describe('timeline helpers', () => {
  it('tickMs scales inversely with speed', () => {
    expect([tickMs(1), tickMs(2), tickMs(4)]).toEqual([1000, 500, 250]);
  });
  it('nextStepIndex advances and stops at the end', () => {
    expect(nextStepIndex(0, 25)).toBe(1);
    expect(nextStepIndex(23, 25)).toBe(24);
    expect(nextStepIndex(24, 25)).toBeNull();
  });
  it('clampIndex bounds and rounds', () => {
    expect(clampIndex(-3, 10)).toBe(0);
    expect(clampIndex(99, 10)).toBe(9);
    expect(clampIndex(4.6, 10)).toBe(5);
  });
});
