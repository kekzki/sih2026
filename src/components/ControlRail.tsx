import type { LayerKey, Storm } from '../types';
import { useAppStore } from '../store/useAppStore';

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'observed', label: 'Observed track' },
  { key: 'cone', label: 'Forecast cone' },
  { key: 'nwp', label: 'NWP / ADT comparison' },
  { key: 'landfall', label: 'Landfall point' },
];

/** Left control rail: map layer toggles + storm context. (Modality toggles come in a later stage.) */
export default function ControlRail({ storm }: { storm: Storm | null }) {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);

  return (
    <aside aria-label="Control rail" className="flex w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface p-4 xl:w-64">
      <section aria-labelledby="layers-h">
        <h2 id="layers-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Map layers
        </h2>
        <ul className="space-y-1.5">
          {LAYERS.map((l) => (
            <li key={l.key}>
              <button
                id={`layer-${l.key}`}
                type="button"
                role="switch"
                aria-checked={layers[l.key]}
                onClick={() => toggleLayer(l.key)}
                className="flex w-full items-center justify-between gap-2 rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-accent/60"
              >
                <span>{l.label}</span>
                <span
                  aria-hidden="true"
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${layers[l.key] ? 'bg-accent' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-all ${layers[l.key] ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {storm && (
        <section aria-labelledby="storm-h">
          <h2 id="storm-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Selected storm
          </h2>
          <p className="text-base font-semibold">
            {storm.name}
            {storm.role === 'flagship' && <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 text-sm font-medium text-accent">flagship</span>}
          </p>
          <p className="text-sm text-muted num">{storm.season} · {storm.basin}</p>
          <p className="mt-2 text-sm">{storm.reason}</p>
          <p className="mt-2 rounded border border-border px-2 py-1.5 text-sm text-muted">
            <span className="font-medium text-fg">Synthetic data.</span> {storm.note}
          </p>
        </section>
      )}
    </aside>
  );
}
