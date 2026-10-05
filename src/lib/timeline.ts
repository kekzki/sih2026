/** Replay timeline helpers (pure). */

export const SPEEDS = [1, 2, 4] as const;

/** Milliseconds between steps in "as if live" replay: 1 s at 1x. */
export const tickMs = (speed: number) => 1000 / speed;

/** Next step index during playback, or null when the replay has reached the end. */
export function nextStepIndex(idx: number, count: number): number | null {
  return idx >= count - 1 ? null : idx + 1;
}

export function clampIndex(idx: number, count: number): number {
  return Math.min(Math.max(0, Math.round(idx)), Math.max(0, count - 1));
}
