import { useEffect } from 'react';
import { Pause, Play } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { fmtIST, fmtUTC } from '../lib/format';
import { SPEEDS, clampIndex, nextStepIndex, tickMs } from '../lib/timeline';

/** Replay scrubber over the storm's forecast issue times, simulating a historical replay "as if live". */
export default function TimelineControls({ times }: { times: string[] }) {
  const timeIndex = useAppStore((s) => s.timeIndex);
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const setTimeIndex = useAppStore((s) => s.setTimeIndex);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);

  const n = times.length;
  const idx = clampIndex(timeIndex, n);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = nextStepIndex(useAppStore.getState().timeIndex, n);
      if (next === null) setPlaying(false);
      else setTimeIndex(next);
    }, tickMs(speed));
    return () => clearInterval(id);
  }, [playing, speed, n, setPlaying, setTimeIndex]);

  const onPlayPause = () => {
    if (!playing && idx >= n - 1) setTimeIndex(0); // restart finished replay
    setPlaying(!playing);
  };

  return (
    <section aria-label="Replay timeline" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-surface px-4 py-2.5">
      <button
        id="timeline-play"
        type="button"
        onClick={onPlayPause}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-transform hover:scale-105"
      >
        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" className="translate-x-px" />}
      </button>

      <div className="flex min-w-[240px] flex-1 flex-col">
        <input
          id="timeline-scrubber"
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          step={1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setTimeIndex(Number(e.target.value));
          }}
          aria-label="Forecast issue time"
          aria-valuetext={`Issue ${idx + 1} of ${n}, ${fmtUTC(times[idx])}`}
          className="w-full accent-[rgb(var(--c-accent))]"
        />
        <div className="mt-0.5 flex justify-between text-sm text-muted num">
          <span>{fmtUTC(times[0])}</span>
          <span>Forecast issue {idx + 1} of {n} (6-hourly)</span>
          <span>{fmtUTC(times[n - 1])}</span>
        </div>
      </div>

      <div role="group" aria-label="Playback speed" className="flex overflow-hidden rounded border border-border">
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            id={`speed-${sp}x`}
            type="button"
            aria-pressed={speed === sp}
            onClick={() => setSpeed(sp)}
            className={`px-3 py-1 text-sm num transition-colors ${speed === sp ? 'bg-accent/20 font-semibold text-accent' : 'text-muted hover:text-fg'}`}
          >
            {sp}x
          </button>
        ))}
      </div>

      <div className="min-w-[170px] text-right num" aria-live="off">
        <div className="text-base font-semibold" id="time-ist">{fmtIST(times[idx])}</div>
        <div className="text-sm text-muted" id="time-utc">{fmtUTC(times[idx])}</div>
      </div>
    </section>
  );
}
