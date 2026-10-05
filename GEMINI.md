# Project rules (always follow)
- This is a frontend-only prototype. All data is mock JSON, accessed only through src/services/api.ts.
- Every page shows a persistent banner: "PROTOTYPE - simulated outputs for demonstration. Not an operational forecast. Decision support for IMD forecasters; final authority rests with the forecaster."
- Never claim to beat IMD.
- All wind-to-grade conversion goes through gradeFromWind(kt). IMD grades (kt): D 17-27, DD 28-33, CS 34-47, SCS 48-63, VSCS 64-89, ESCS 90-119, SuCS 120+. 95 kt must display ESCS.
- Landfall time and landfall point are always separate cards with separate uncertainty.
- Benchmarks (IMD 2020-24 avg): track 72/111/154 km, intensity 5.9/8.3/9.8 kt, landfall time 2.9/4.2/7.5 h at 24/48/72 h.
- Design: dark navy/charcoal, cyan accent, Inter font, projector-readable text (min 14px), tabular numerals, labeled chart axes with units.
- docs/BRIEF.md is the source of truth. Re-read the relevant section before each task.