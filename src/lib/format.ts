/** Formatters. All measurements are rendered with tabular numerals in the UI. */

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. "30 Nov 17:30 UTC" */
export function fmtUTC(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** IST = UTC+05:30, e.g. "30 Nov 23:00 IST" */
export function fmtIST(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
}

export const fmtKt = (v: number) => `${Math.round(v)} kt`;
export const fmtHpa = (v: number) => `${Math.round(v)} hPa`;
export const fmtKm = (v: number) => `${Math.round(v)} km`;
export const fmtPct = (p: number) => `${Math.round(p * 100)}%`;

export function fmtLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function hoursBetween(aIso: string, bIso: string): number {
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3_600_000;
}
