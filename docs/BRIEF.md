```markdown
# BUILD BRIEF: "Cyclone AI Decision Support" Frontend Workstation
**Event/PS:** SIH 2026 | PS ID: SIH26070 | **Team:** RetroFit 6

---

## 0. Goal & Ground Rules
Build a polished, demo-ready, **FRONTEND-ONLY web application** of an operational forecaster decision-support workstation for tropical cyclones over the North Indian Ocean (NIO). There is no trained model and no backend. All outputs come from hand-authored mock JSON that simulates what the real system would return.

### Core Workstation Rules
1. **Operational Focus:** Present every screen as a functional software interface designed for meteorologists on shift, avoiding slide-deck or presentation-style layouts.
2. **System Framing:** Position the application as a forecaster guidance system. Benchmarks and verification metrics are explicitly labeled as *"operational evaluation targets"*.
3. **Service Abstraction:** Put all data access behind `src/services/api.ts` using async functions. This ensures a FastAPI backend can replace mock data later without changing UI components.
4. **Display Specification:** Desktop-first ($1440 \times 900$ projector-friendly), usable down to $1024\text{ px}$. Dark Navy base theme default (`#0B132B`) with a high-contrast theme toggle. Minimum $14\text{ px}$ body text for high readability.
5. **Offline Resiliency:** No *lorem ipsum* or broken external assets. Map layers fall back gracefully to a dark canvas background with a simplified coastline GeoJSON if tile servers are offline.

---

## 1. Navigation & Route Architecture

| Route | Operational Name | Workstation Function |
| :--- | :--- | :--- |
| `/` | **Forecast Workstation** | Real-time storm monitoring, probabilistic tracks, landfall analysis, forecaster action logging |
| `/diagnostics` | **Visual Diagnostics** | Multi-channel IR canvas, Grad-CAM attention overlays, physics parameter telemetry |
| `/verification` | **Model Verification** | Benchmark matrix vs. IMD operational averages, reliability diagrams, case study replays |
| `/health` | **System Telemetry** | Live data feed status, stream pipeline inspection drawer, data outage simulator |
| `/docs` | **Operational Scope** | System capabilities, data source specs, operational constraints |

---

## 2. Tech Stack & Dependencies
* **Core:** Vite + React 18 + TypeScript
* **Styling:** Tailwind CSS (Navy Base `#0B132B`, High-Contrast Cyan `#00F5FF`, Amber `#FFB703`, Red `#FF0055`)
* **Mapping:** `react-leaflet` (Leaflet v1.9+)
* **Data Visualization:** `Recharts`
* **Icons:** `lucide-react`
* **State Management:** `Zustand`
* **Routing:** `React Router v6`

---

## 3. Domain Constants & Business Logic

### IMD Intensity Classification Engine
Implement standard IMD operational thresholds for Maximum Sustained Surface Wind (kt):

| Grade Code | IMD Category Name | Wind Range (kt) | Color Code |
| :--- | :--- | :--- | :--- |
| **D** | Depression | 17–27 | `#00D2FF` |
| **DD** | Deep Depression | 28–33 | `#0099FF` |
| **CS** | Cyclonic Storm | 34–47 | `#00E676` |
| **SCS** | Severe Cyclonic Storm | 48–63 | `#FFEA00` |
| **VSCS** | Very Severe Cyclonic Storm | 64–89 | `#FF9100` |
| **ESCS** | Extremely Severe Cyclonic Storm | 90–119 | `#FF3D00` |
| **SuCS** | Super Cyclonic Storm | $\ge 120$ | `#D500F9` |

### Core Utility Logic
* `gradeFromWind(kt: number)`: Global utility mapping wind speed to exact IMD category and hex color code. Guaranteed consistency across all components (e.g., $95\text{ kt}$ strictly returns **ESCS**).
* **Rapid Intensification (RI):** Defined as a wind speed increase of $\ge 30\text{ kt}$ within $24\text{ h}$.
* **IMD Historical Verification Standards (2020–2024 Averages):**
  * **Track Error:** $72\text{ km}$ ($24\text{ h}$), $111\text{ km}$ ($48\text{ h}$), $154\text{ km}$ ($72\text{ h}$)
  * **Intensity MAE:** $5.9\text{ kt}$ ($24\text{ h}$), $8.3\text{ kt}$ ($48\text{ h}$), $9.8\text{ kt}$ ($72\text{ h}$)
  * **Landfall-Time Error:** $2.9\text{ h}$ ($24\text{ h}$), $4.2\text{ h}$ ($48\text{ h}$), $7.5\text{ h}$ ($72\text{ h}$)

---

## 4. Mock Data Specification (`src/data/`)
Provide 4 distinct storm datasets in JSON format marked with `synthetic: true`:

1. **FENGAL (Nov 2024 – Primary Flagship):** Recurving/stalling near Puducherry. Features high RI probability ($\sim 0.60$), stalling signature flag, elevated landfall-time variance ($7.0\text{ h}$ error at $24\text{ h}$ lead).
2. **ASNA (Aug–Sep 2024 – Atypical Case):** Land-genesis system over Gujarat moving into the Arabian Sea. Flagged as `atypical: land-genesis` with higher track error ($174\text{ km}$ vs $156\text{ km}$ average at $72\text{ h}$).
3. **DANA (Oct 2024) & REMAL (May 2024) (Baseline Controls):** Well-behaved systems with narrow uncertainty bands.

### Timestep Data Interface
```typescript
interface StormRecord {
  time: string; // ISO string
  lat: number;
  lon: number;
  observedMaxWindKt: number;
  observedMinPressureHpa: number;
  predicted: {
    centreOffset: { latOffset: number; lonOffset: number };
    gradeProbabilities: Record<GradeKey, number>;
    intensityDistribution: Record<"now" | "h24" | "h48" | "h72", { mean: number; p10: number; p90: number }>;
    riProbability24h: number;
    trackForecast: Array<{ hour: number; lat: number; lon: number; radiusKm: number }>;
    flags: { recurving: boolean; stalling: boolean; atypical: boolean };
  };
  landfallTime: { medianIso: string; p10Iso: string; p90Iso: string; histogram: Array<{ hourOffset: number; count: number }> };
  landfallPoint: { lat: number; lon: number; radius80km: number }; // KEPT SEPARATE FROM LANDFALL TIME
  inputs: { insat: ModalityStatus; era5: ModalityStatus; track: ModalityStatus };
  physics: Array<{ name: string; value: number; unit: string; anomaly: number }>;
  explainability: { attributionBlobs: Array<{ x: number; y: number; radius: number; weight: number }>; featureImportance: Record<string, number> };
  comparators: { adtWindKt: number; nwpWindKt: number; nwpTrack: Array<{ hour: number; lat: number; lon: number }> };
}

```

---

## 5. Workstation View Specifications

### 5.1 Forecast Workstation (`/`)

* **Header Bar:** Application Title, Storm Selector, Workstation Tier Toggle (**MVP / Advanced**), High-Contrast Theme Toggle, UTC/IST Clock.
* **Timeline Replay Controls:** Scrubber, Play/Pause, $1\times/2\times/4\times$ speed across forecast issue times.
* **Geospatial Map (`react-leaflet`):**
* Tracks: Solid line (Observed), Dashed line (Forecast $0\text{--}72\text{ h}$), Dotted line (NWP Consensus).
* Cone of Uncertainty: Dynamic polygon rendered from per-point `radiusKm`.
* Markers: Color-coded by IMD intensity grade.
* Landfall Layer: Spatial confidence radius ($80\%$) rendered distinctly from temporal predictions.


* **Input Modality Panel (Left Rail):** Interactive toggles for INSAT Imagery, ERA5 Physics, and Track History.
* *Degraded Mode Transform:* Turning off a modality widens $p10/p90$ and track uncertainty by $1.5\times$ in `api.ts`, drops the system confidence rating, and displays an alert chip: *"Reduced Confidence: [MODALITY] Feed Offline"*.


* **Right Panel Cards:**
1. *Identification & Classification:* Refined centre, IMD grade badge, 7-grade probability distribution bar, and structural pattern chip (Advanced Tier).
2. *Intensity Forecast:* Max wind/pressure with $p10\text{--}p90$ band chart (`Recharts AreaChart`).
3. *Rapid Intensification Gauge:* $24\text{ h}$ RI probability gauge with warning thresholds ($>0.40$ Amber, $>0.60$ Red).
4. *Landfall Analysis Panel:* Separate sub-cards for **Landfall Time** (median, $p10\text{--}p90$ window, probability histogram) and **Landfall Point** (target coordinates, $80\%$ radius in km).
5. *Model Disagreement Bar:* Model guidance vs. ADT vs. NWP. Triggers an Amber Alert when variance exceeds $10\text{ kt}$.


* **Forecaster Action Bar & Audit Trail:**
* Action triggers: `[Accept Guidance]`, `[Override / Annotate]`, `[Export Brief]`.
* `Export Brief` opens browser print (`window.print()`) with a print stylesheet layout.
* Actions append entries to an on-screen **Audit Log Drawer** (Timestamp, Action, Storm ID, User ID, Tier).



---

### 5.2 Visual Diagnostics (`/diagnostics`)

* **Multi-Channel Satellite Canvas:** Interactive IR satellite viewer with channel toggles (`IR-10.8µm`, `Water Vapor`, `Visible`, `Shortwave IR`).
* **Grad-CAM Attention Overlay:** Heatmap overlay with opacity slider ($0\text{--}100\%$) and toggle switch. Caption: *"Regions driving CNN feature weights (Illustrative)"*.
* **Physics Telemetry Bars:** Dynamic horizontal bars showing current values and climatological anomalies for shear, SST, humidity, vorticity, divergence, and steering flow.
* **Target Task Switcher:** Toggle between *Intensity Drivers* and *RI Drivers* to view shifting feature weight profiles.

---

### 5.3 Model Verification (`/verification`)

* **Benchmark Matrix:** Side-by-side verification table comparing IMD 2020–2024 operational averages against system evaluation targets.
* **Reliability Diagram:** Interactive `Recharts` graph showing perfect calibration ($45^\circ$ line) vs. illustrative calibrated and uncalibrated model curves.
* **Historical Case Studies:** Interactive evaluation cards for Fengal, Asna, Dana, and Remal with target inspection objectives.
* **Operational Readiness Stepper:** Three-stage deployment breakdown (MVP, Advanced Tier, Production Integration).

---

### 5.4 System Telemetry (`/health`)

* **Data Stream Flow:** Interactive 5-node pipeline (`Ingestion & QC` $\rightarrow$ `Alignment` $\rightarrow$ `Encoders` $\rightarrow$ `Fusion & Heads` $\rightarrow$ `Calibration`).
* **Interactive Node Inspector:**
* *Ingestion Stage:* Feeds status (INSAT, NWP, IBTrACS) and interactive **Feed Outage Simulator**.
* *Alignment Stage:* Interactive storm-centric cropping inspector ($512 \times 512\text{ px}$).
* *Encoder Stage:* Tensor dimension inspector (`[B, 6, 512, 512]` $\rightarrow$ `[B, 512]`).
* *Calibration Stage:* Interactive temperature scaling slider ($T = 0.5\text{--}2.0$).


* **Latency & Source Reference Table:** Documents training sources vs. real-time operational execution substitutes (e.g., ERA5 reanalysis vs. operational NCMRWF/GFS analyses).

---

### 5.5 Operational Scope (`/docs`)

* **Problem & Gap Definition:** Outlines landfall-time accuracy limits and rapid intensification challenges over the North Indian Ocean.
* **System Capabilities & Limits:** Detailed documentation of system parameters, operational boundaries, and human-in-the-loop decision principles.
* **Team & Event Specs:** Team RetroFit 6, SIH 2026, PS SIH26070.

---

## 6. Directory Structure & Execution

```text
src/
├── components/
│   ├── AuditLogDrawer.tsx
│   ├── ComparatorStrip.tsx
│   ├── GradCamCanvas.tsx
│   ├── GradeBadge.tsx
│   ├── IntensityChart.tsx
│   ├── LandfallPointCard.tsx
│   ├── LandfallTimeCard.tsx
│   ├── Map.tsx
│   ├── ModalityToggles.tsx
│   ├── PipelineInspector.tsx
│   ├── RIGauge.tsx
│   └── TimelineControls.tsx
├── data/
│   ├── benchmarks.json
│   ├── coastline.geojson
│   └── storms/
│       ├── asna.json
│       ├── dana.json
│       ├── fengal.json
│       └── remal.json
├── lib/
│   ├── formatters.ts
│   ├── geo.ts
│   └── gradeFromWind.ts
├── pages/
│   ├── Diagnostics.tsx
│   ├── Docs.tsx
│   ├── ForecastWorkstation.tsx
│   ├── Health.tsx
│   └── Verification.tsx
├── services/
│   └── api.ts
├── store/
│   └── useStore.ts
├── types/
│   └── index.ts
├── App.tsx
└── main.tsx

```

```bash
# Setup and Run
npm install
npm run dev

```

```

```