import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, GeoJSON, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import type { LayerKey, Storm, StormStep, Theme } from '../types';
import { GRADES } from '../lib/constants';
import { gradeFromWind, gradeInfo } from '../lib/grade';
import { conePolygon, haversineKm } from '../lib/geo';
import { fmtKm, fmtKt, fmtLatLon, fmtUTC } from '../lib/format';
import { forecastLinePositions, landfallMapState, nwpLinePositions, observedPath, stormBounds } from '../lib/mapData';
import { getCoastline } from '../services/api';

const TILES: Record<Theme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const PALETTE = {
  dark: { obs: '#e2e8f0', fc: '#22d3ee', nwp: '#fbbf24', ring: '#f8fafc', land: '#16213a', coast: '#5b7fb0', ink: '#0b1220' },
  light: { obs: '#0f172a', fc: '#0891b2', nwp: '#b45309', ring: '#0f172a', land: '#e2e8f0', coast: '#64748b', ink: '#ffffff' },
} as const;

/** Frames the storm whenever a different storm is selected. */
function FitStorm({ storm }: { storm: Storm }) {
  const map = useMap();
  const bounds = useMemo(() => stormBounds(storm.steps), [storm]);
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7, animate: false });
  }, [map, bounds]);
  return null;
}

interface Props {
  storm: Storm;
  /** Step after the degraded-confidence transform (cone and radii already widened if needed). */
  step: StormStep;
  stepIndex: number;
  layers: Record<LayerKey, boolean>;
  theme: Theme;
}

export default function CycloneMap({ storm, step, stepIndex, layers, theme }: Props) {
  const pal = PALETTE[theme];
  const [tilesFailed, setTilesFailed] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [coast, setCoast] = useState<FeatureCollection | null>(null);
  const loads = useRef(0);
  const errs = useRef(0);

  useEffect(() => {
    let live = true;
    getCoastline().then((c) => live && setCoast(c));
    return () => {
      live = false;
    };
  }, []);

  // a new tile source (theme change) restarts the failure detection
  useEffect(() => {
    loads.current = 0;
    errs.current = 0;
    setTilesFailed(typeof navigator !== 'undefined' && navigator.onLine === false);
  }, [theme]);

  const tileHandlers = useMemo(
    () => ({
      tileload: () => {
        loads.current += 1;
        setTilesFailed(false);
      },
      tileerror: () => {
        errs.current += 1;
        if (loads.current === 0 && errs.current >= 3) setTilesFailed(true);
      },
    }),
    [],
  );

  const p = step.predicted;
  const observed = useMemo(() => storm.steps.slice(0, stepIndex + 1), [storm, stepIndex]);
  const obsLine = useMemo(() => observedPath(storm.steps, stepIndex), [storm, stepIndex]);
  const cone = useMemo(() => conePolygon(p.track), [p.track]);
  const fcLine = useMemo(() => forecastLinePositions(p.track), [p.track]);
  const nwpLine = useMemo(() => nwpLinePositions(step.comparators.nwpTrack), [step]);
  const lf = landfallMapState(p);

  const flagged: [number, number] = [step.lat, step.lon];
  const refined: [number, number] = [step.lat + p.centre.dLat, step.lon + p.centre.dLon];
  const offsetKm = haversineKm(flagged[0], flagged[1], refined[0], refined[1]);
  const adt = step.comparators.adtWindKt;

  return (
    <div className="relative h-full w-full" role="region" aria-label="Cyclone track map">
      <MapContainer center={[15, 82]} zoom={5} minZoom={3} maxZoom={9} scrollWheelZoom className="h-full w-full">
        <TileLayer key={theme} url={TILES[theme]} attribution={ATTRIBUTION} subdomains="abcd" eventHandlers={tileHandlers} />
        <FitStorm storm={storm} />

        {tilesFailed && coast && (
          <GeoJSON
            key={`coast-${theme}`}
            data={coast}
            style={{ color: pal.coast, weight: 1.2, fillColor: pal.land, fillOpacity: 0.9 }}
            interactive={false}
          />
        )}

        {layers.cone && (
          <>
            <Polygon positions={cone} pathOptions={{ color: pal.fc, weight: 1, fillColor: pal.fc, fillOpacity: 0.14 }} interactive={false} />
            <Polyline positions={fcLine} pathOptions={{ color: pal.fc, weight: 2.5, dashArray: '8 7' }} />
            {p.track
              .filter((t) => t.leadH > 0)
              .map((t) => {
                const g = gradeInfo(gradeFromWind(t.windKt));
                return (
                  <CircleMarker
                    key={`fc-${t.leadH}`}
                    center={[t.lat, t.lon]}
                    radius={t.leadH % 24 === 0 ? 6 : 4}
                    pathOptions={{ color: pal.ink, weight: 1, fillColor: g.color, fillOpacity: 1 }}
                  >
                    <Tooltip>
                      +{t.leadH} h forecast · {fmtKt(t.windKt)} {g.code} · cone radius {fmtKm(t.radiusKm)}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
          </>
        )}

        {layers.nwp && (
          <>
            <Polyline positions={nwpLine} pathOptions={{ color: pal.nwp, weight: 2.5, dashArray: '2 7', lineCap: 'round' }} />
            <CircleMarker
              center={flagged}
              radius={17}
              pathOptions={{ color: gradeInfo(gradeFromWind(adt)).color, weight: 3, fill: false }}
            >
              <Tooltip permanent direction="bottom" offset={[0, 14]}>
                ADT {fmtKt(adt)} ({gradeFromWind(adt)}) · NWP {fmtKt(step.comparators.nwpWindKt)} ({gradeFromWind(step.comparators.nwpWindKt)})
              </Tooltip>
            </CircleMarker>
          </>
        )}

        {layers.observed && (
          <>
            <Polyline positions={obsLine} pathOptions={{ color: pal.obs, weight: 3 }} />
            {observed.map((s, i) => {
              const g = gradeInfo(gradeFromWind(s.observed.maxWindKt));
              return (
                <CircleMarker
                  key={`${storm.id}-obs-${i}`}
                  center={[s.lat, s.lon]}
                  radius={i === stepIndex ? 7 : 4.5}
                  pathOptions={{ color: pal.ink, weight: 1, fillColor: g.color, fillOpacity: 1 }}
                >
                  <Tooltip>
                    Observed · {fmtUTC(s.time)} · {fmtKt(s.observed.maxWindKt)} {g.code}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </>
        )}

        {layers.landfall && lf.kind === 'ring' && (
          <>
            <Circle
              center={[lf.lat, lf.lon]}
              radius={lf.radiusM}
              pathOptions={{ color: pal.ring, weight: 2, dashArray: '4 5', fillColor: pal.ring, fillOpacity: 0.08 }}
            >
              <Tooltip sticky>Landfall point · 80% confidence radius {fmtKm(lf.radiusKm)}</Tooltip>
            </Circle>
            <CircleMarker center={[lf.lat, lf.lon]} radius={5} pathOptions={{ color: pal.ink, weight: 1.5, fillColor: pal.ring, fillOpacity: 1 }}>
              <Tooltip>Predicted landfall point {fmtLatLon(lf.lat, lf.lon)}</Tooltip>
            </CircleMarker>
          </>
        )}

        {/* storm centre: IMD flagged position (hollow) vs model-refined centre (cyan) */}
        <CircleMarker center={flagged} radius={11} pathOptions={{ color: pal.ring, weight: 2, fill: false }}>
          <Tooltip>IMD flagged centre {fmtLatLon(flagged[0], flagged[1])}</Tooltip>
        </CircleMarker>
        <Polyline positions={[flagged, refined]} pathOptions={{ color: pal.fc, weight: 2 }} interactive={false} />
        <CircleMarker center={refined} radius={4} pathOptions={{ color: pal.ink, weight: 1, fillColor: pal.fc, fillOpacity: 1 }}>
          <Tooltip>
            Refined centre {fmtLatLon(refined[0], refined[1])} · {offsetKm.toFixed(0)} km from IMD flagged position
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        {tilesFailed && (
          <span className="rounded border border-warn/50 bg-surface/95 px-3 py-1 text-sm text-warn">
            Map tiles unavailable - showing offline coastline
          </span>
        )}
        {layers.landfall && lf.kind === 'none' && (
          <span id="landfall-status-chip" className="rounded border border-border bg-surface/95 px-3 py-1 text-sm text-muted">
            {lf.message}
          </span>
        )}
      </div>

      <MapLegend />
    </div>
  );
}

function MapLegend() {
  return (
    <div
      aria-label="Map legend"
      className="pointer-events-none absolute bottom-3 left-3 z-[1000] space-y-1.5 rounded border border-border bg-surface/95 px-3 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted">IMD grade</span>
        {GRADES.map((g) => (
          <span key={g.code} className="flex items-center gap-1 num">
            <span className="inline-block h-3 w-3 rounded-full border border-black/40" style={{ background: g.color }} />
            {g.code}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block w-6 border-t-[3px] border-fg" />Observed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-6 border-t-[3px] border-dashed border-accent" />72 h forecast</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-fg" />IMD centre</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />Refined centre</span>
      </div>
    </div>
  );
}
