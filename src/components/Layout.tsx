import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/about', label: 'About' },
];

/** Router shell: banner + minimal nav. Full top bar arrives in Phase 4. */
export default function Layout() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 border-b border-border bg-surface px-4 py-2">
        <span className="font-semibold tracking-tight">
          Cyclone AI <span className="text-accent">Decision Support</span>
        </span>
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
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
