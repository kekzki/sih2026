/** Geo helpers (spherical earth). */
const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

/** Destination point given start, bearing (deg from N) and distance (km). */
export function destination(lat: number, lon: number, bearingDeg: number, distKm: number): [number, number] {
  const d = distKm / R_KM;
  const b = toRad(bearingDeg);
  const p1 = toRad(lat);
  const l1 = toRad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [toDeg(p2), toDeg(l2)];
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Uncertainty cone polygon: union-hull approximation built from per-point radii.
 * Left edge forward, right edge backward, with semicircular caps.
 */
export function conePolygon(points: { lat: number; lon: number; radiusKm: number }[]): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) return circle(points[0].lat, points[0].lon, points[0].radiusKm);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const brg = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    left.push(destination(p.lat, p.lon, brg - 90, p.radiusKm));
    right.push(destination(p.lat, p.lon, brg + 90, p.radiusKm));
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const endBrg = bearingDeg(prev.lat, prev.lon, last.lat, last.lon);
  const cap: [number, number][] = [];
  for (let k = -90; k <= 90; k += 15) cap.push(destination(last.lat, last.lon, endBrg + k, last.radiusKm));
  return [...left, ...cap, ...right.reverse()];
}

export function circle(lat: number, lon: number, radiusKm: number, n = 36): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push(destination(lat, lon, (360 * i) / n, radiusKm));
  return out;
}
