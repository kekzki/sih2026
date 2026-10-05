import { describe, expect, it } from 'vitest';
import { bearingDeg, circle, conePolygon, destination, haversineKm } from './geo';

type Pt = { lat: number; lon: number; radiusKm: number };

/** Planar ray-casting point-in-polygon on [lat, lon] pairs (fine at these scales). */
function inside(poly: [number, number][], lat: number, lon: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// straight northward track, radius widening with lead time
const straight: Pt[] = [0, 1, 2, 3, 4].map((k) => ({ lat: 10 + k * 1.5, lon: 85, radiusKm: 25 + k * 40 }));

describe('geo primitives', () => {
  it('haversine: 1 degree of latitude is ~111.2 km', () => {
    expect(haversineKm(10, 80, 11, 80)).toBeCloseTo(111.19, 1);
  });
  it('destination is the inverse of distance and bearing', () => {
    const [lat, lon] = destination(12, 80, 90, 100);
    expect(haversineKm(12, 80, lat, lon)).toBeCloseTo(100, 3);
    expect(bearingDeg(12, 80, lat, lon)).toBeCloseTo(90, 0);
  });
});

describe('circle', () => {
  it('has n points all at the requested radius', () => {
    const c = circle(15, 83, 80, 36);
    expect(c).toHaveLength(36);
    c.forEach(([la, lo]) => expect(haversineKm(15, 83, la, lo)).toBeCloseTo(80, 3));
  });
});

describe('conePolygon', () => {
  it('empty input gives empty polygon', () => {
    expect(conePolygon([])).toEqual([]);
  });

  it('single point degenerates to a circle of that radius', () => {
    const poly = conePolygon([{ lat: 15, lon: 83, radiusKm: 50 }]);
    expect(poly).toHaveLength(36);
    poly.forEach(([la, lo]) => expect(haversineKm(15, 83, la, lo)).toBeCloseTo(50, 3));
  });

  it('has left edge + 13-point cap + right edge = 2n + 13 vertices', () => {
    expect(conePolygon(straight)).toHaveLength(2 * straight.length + 13);
  });

  it('edge vertices sit exactly one radius from their track point', () => {
    const poly = conePolygon(straight);
    straight.forEach((p, i) => {
      const left = poly[i];
      const right = poly[poly.length - 1 - i];
      expect(haversineKm(p.lat, p.lon, left[0], left[1])).toBeCloseTo(p.radiusKm, 3);
      expect(haversineKm(p.lat, p.lon, right[0], right[1])).toBeCloseTo(p.radiusKm, 3);
    });
  });

  it('widens with lead time: far end is wider than near end', () => {
    const poly = conePolygon(straight);
    const n = straight.length;
    const widthAt = (i: number) => haversineKm(poly[i][0], poly[i][1], poly[poly.length - 1 - i][0], poly[poly.length - 1 - i][1]);
    expect(widthAt(n - 1)).toBeGreaterThan(widthAt(0));
    expect(widthAt(0)).toBeCloseTo(2 * straight[0].radiusKm, 2);
  });

  it('contains every forecast track point', () => {
    const poly = conePolygon(straight);
    straight.forEach((p) => expect(inside(poly, p.lat, p.lon)).toBe(true));
  });

  it('does not contain a point well outside the cone', () => {
    const poly = conePolygon(straight);
    expect(inside(poly, 10, 90)).toBe(false);
  });

  it('scaling radii (degraded mode, x1.6) scales the cone width', () => {
    const wide = conePolygon(straight.map((p) => ({ ...p, radiusKm: p.radiusKm * 1.6 })));
    const base = conePolygon(straight);
    const w = (poly: [number, number][], i: number) =>
      haversineKm(poly[i][0], poly[i][1], poly[poly.length - 1 - i][0], poly[poly.length - 1 - i][1]);
    expect(w(wide, 2)).toBeCloseTo(w(base, 2) * 1.6, 2);
  });

  it('handles a stalled track (identical positions) without NaN', () => {
    const stalled: Pt[] = [0, 1, 2].map((k) => ({ lat: 11.5, lon: 81.5, radiusKm: 30 + k * 20 }));
    conePolygon(stalled).forEach(([la, lo]) => {
      expect(Number.isFinite(la)).toBe(true);
      expect(Number.isFinite(lo)).toBe(true);
    });
  });
});
