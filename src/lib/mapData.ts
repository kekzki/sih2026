import type { Predicted, StormStep, TrackPoint } from '../types';

export type LatLon = [number, number];

/** Observed (best-track) positions from step 0 up to and including `idx`. */
export function observedPath(steps: Pick<StormStep, 'lat' | 'lon'>[], idx: number): LatLon[] {
  const end = Math.min(Math.max(0, idx), steps.length - 1);
  return steps.slice(0, end + 1).map((s) => [s.lat, s.lon]);
}

export function forecastLinePositions(track: Pick<TrackPoint, 'lat' | 'lon'>[]): LatLon[] {
  return track.map((t) => [t.lat, t.lon]);
}

export function nwpLinePositions(nwp: { lat: number; lon: number }[]): LatLon[] {
  return nwp.map((t) => [t.lat, t.lon]);
}

/**
 * Bounds (SW, NE) covering the whole observed life of a storm plus any landfall
 * points, padded by `pad` degrees. Used to frame the map when a storm is selected.
 */
export function stormBounds(
  steps: Pick<StormStep, 'lat' | 'lon' | 'predicted'>[],
  pad = 1.5,
): [LatLon, LatLon] {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  const add = (lat: number, lon: number) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  };
  for (const s of steps) {
    add(s.lat, s.lon);
    const lf = s.predicted?.landfall;
    if (lf) add(lf.point.lat, lf.point.lon);
  }
  if (!Number.isFinite(minLat)) return [[5, 60], [25, 100]];
  return [
    [minLat - pad, minLon - pad],
    [maxLat + pad, maxLon + pad],
  ];
}

export type LandfallMapState =
  | { kind: 'ring'; lat: number; lon: number; radiusKm: number; radiusM: number }
  | { kind: 'none'; message: string };

/**
 * What the map should draw for landfall. Landfall point only; time is never
 * mixed in (separate cards / separate uncertainty). Safe when landfall is null.
 */
export function landfallMapState(p: Pick<Predicted, 'landfallStatus' | 'landfall'>): LandfallMapState {
  if (p.landfall) {
    const pt = p.landfall.point;
    return { kind: 'ring', lat: pt.lat, lon: pt.lon, radiusKm: pt.radius80Km, radiusM: pt.radius80Km * 1000 };
  }
  if (p.landfallStatus === 'occurred') return { kind: 'none', message: 'Landfall has already occurred' };
  return { kind: 'none', message: 'No landfall expected within 72 h' };
}
