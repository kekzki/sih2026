import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { listStorms } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { Mode, StormSummary } from '../types';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/explain', label: 'Explain' },
  { to: '/validation', label: 'Validation' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/about', label: 'About' },
];

const MODES: { mode: Mode; hint: string }[] = [
  { mode: 'MVP', hint: 'MVP tier: core outputs with a basic landfall-time point estimate' },
  { mode: 'Advanced', hint: 'Advanced tier: adds the full landfall-time distribution and structural pattern' },
];

const label = (s: StormSummary) => `${s.name} · ${s.season}${s.role === 'flagship' ? ' · flagship' : ''}`;

/** Top bar: logo/title, nav, storm selector, theme toggle, MVP/Advanced toggle. */
export default function TopBar() {
  const stormId = useAppStore((s) => s.stormId);
  const setStorm = useAppStore((s) => s.setStorm);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const [storms, setStorms] = useState<StormSummary[]>([]);

  useEffect(() => {
    let live = true;
    listStorms().then((l) => live && setStorms(l));
    return () => {
      live = false;
    };
  }, []);

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-base font-semibold tracking-tight">
          Cyclone AI <span className="text-accent">Decision Support</span>
        </span>
      </div>

      <nav aria-label="Main" className="flex gap-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            id={`nav-${n.label.toLowerCase()}`}
            className={({ isActive }) =>
              `rounded px-3 py-1 text-sm transition-colors ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg'}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted" htmlFor="storm-select">
          Storm
          <select
            id="storm-select"
            value={stormId}
            onChange={(e) => setStorm(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1 text-sm text-fg"
          >
            {storms.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Mode" className="flex overflow-hidden rounded border border-border">
          {MODES.map((m) => (
            <button
              key={m.mode}
              id={`mode-${m.mode.toLowerCase()}`}
              type="button"
              title={m.hint}
              aria-pressed={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className={`px-3 py-1 text-sm transition-colors ${mode === m.mode ? 'bg-accent/20 font-semibold text-accent' : 'text-muted hover:text-fg'}`}
            >
              {m.mode}
            </button>
          ))}
        </div>

        <button
          id="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted transition-colors hover:text-fg"
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
