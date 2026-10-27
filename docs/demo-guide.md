# Classroom demonstration (8–10 minutes)

1. **Provenance (1 minute).** Open Spark Processing Lab. Read the dataset mode, months, counts and cleaning thresholds. Explain that recorded completed execution is not a running job animation.
2. **Real Spark (2 minutes).** In a terminal source the environment and run `python -m backend.pipelines.process --sample --months 2024-01 2024-02 2024-03`. Show Spark stages and final row accounting. Explain `groupBy`, actions, shuffle partitions and Parquet output. Run model training after changing data.
3. **City introduction (30 seconds).** Open the landing page and orbit the stylized geometry. Explicitly distinguish this illustrative city from the next factual geographic view.
4. **Global filters (1 minute).** Enter Command Center. Select Manhattan, weekday, 17–20 hours. Show that the KPI totals, hourly chart, rankings and map update together. Click a zone, then reset.
5. **Geography (1 minute).** Toggle 2D/3D, rotate and hover a zone. Read the exact trip count. Show flow arcs; explain these are centroid connections, not observed road routes. Compare two zones.
6. **Analytics (1 minute).** Compare 3D bars with their 2D alternative. Show the hourly/weekday landscape, Sankey and distribution bins. Explain each axis and units.
7. **Forecasting (2 minutes).** Select a zone. Explain lagged inputs, chronological splitting and one-step historical prediction. Compare measured Random Forest errors with the baseline even if the baseline wins. Show evaluation and anomalies; do not claim confidence or causation.
8. **Reporting (30 seconds).** Export a chart PNG, selected-filter CSV and PDF. Show source/mode labels in the PDF.

If offline, use the bundled real sample. Say explicitly: “These are sampled historical trips, not full NYC demand.” If WebGL is unavailable, use reduced effects and 2D charts; do not present a static image as an interactive scene.
