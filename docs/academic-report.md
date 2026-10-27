# UrbanPulse: An Intelligent Big Data Visualization Framework for Urban Mobility Pattern Analysis and Demand Forecasting

## 1. Abstract

UrbanPulse integrates distributed data preparation, interactive spatial analytics, and one-hour demand forecasting in a local web application. Official New York City yellow taxi trip records are cleaned with Apache Spark and summarized into Parquet analytical datasets. FastAPI and DuckDB serve bounded filtered aggregates to a React interface combining statistical charts with interactive geographic extrusion. A Random Forest model is evaluated chronologically against a previous-day baseline. The system emphasizes traceability, meaningful visual encodings, and explicit distinctions between observed trips, derived statistics, and predictions.

## 2. Problem statement

Millions of urban mobility records are difficult to inspect as flat tables. A useful analytical system must explain when and where demand concentrates without transferring raw datasets to a browser or implying precision absent from the source. Forecasting adds a separate challenge: time-series evaluation must avoid leakage and compare against an honest baseline.

## 3. Objectives

1. Process multiple monthly TLC Parquet datasets with real Spark DataFrame operations.
2. Preserve provenance and account for accepted and rejected rows.
3. Synchronize geographic and temporal filters across analytical views.
4. Render interactive 3D geometry with readable 2D alternatives.
5. Forecast next-hour zone demand using historical information only.
6. Report reproducible measurements instead of invented performance claims.

## 4. Methodology

Download and validate official source files; cast compatible fields; reject invalid observations; derive local pickup-hour features; aggregate by time and zone pairs; store analytical Parquet; serve parameterized queries; visualize bounded results; train and evaluate a separate forecasting model. The architecture diagram and contracts are documented in `architecture.md`.

## 5. Big Data processing

Spark operates on raw records using lazy distributed DataFrame transformations, explicit actions, groupBy aggregation, and partitioned writes. Local[2] demonstrates Spark's execution model on a laptop, not a multi-node deployment. The application records actual row counts, input/output bytes, Spark version, configured partitions and measured wall-clock durations. No unsupported speedup or scalability claim is made.

## 6. Technologies

React, TypeScript, Vite and Tailwind provide the web foundation. React Three Fiber/Three.js render the stylized city and analytical bars. GSAP handles scroll reveals; Motion handles route entrances. ECharts renders time-series, distributions, heatmap and Sankey charts. MapLibre and deck.gl render official geographic polygons. TanStack Query owns server state. FastAPI/Pydantic provide HTTP validation; DuckDB queries Parquet; PySpark handles ingestion transformations; scikit-learn trains Random Forest models.

## 7. Dataset and schema

NYC TLC yellow taxi data contains pickup/drop-off local timestamps, taxi-zone IDs, distance, fare and other charge fields. UrbanPulse uses `tpep_pickup_datetime`, `tpep_dropoff_datetime`, `PULocationID`, `DOLocationID`, `trip_distance`, and `fare_amount`. It does not infer exact road trajectories or retain payment/passenger fields unnecessary to the implemented analyses. Official lookup/boundary resources supply zone names and geography.

## 8. Preprocessing

Monthly fields are cast before union to accommodate physical schema differences. Known zones 1–263 are accepted. Pickup timestamps must fall within requested months; durations must lie between 1 and 180 minutes; distance must be positive and at most 200 miles; fare must lie between zero and 1,000 USD. Null/NaN values fail validation. These are project-specific plausibility thresholds and introduce selection effects: refunded fares and valid unusual trips can be excluded. Counts are disclosed in the processing ledger.

## 9. Visualization techniques

Temporal charts use observed totals and a seven-day trailing average. Geographic extrusion uses a zero baseline and linear height mapping; tooltip values remain actual trip counts. Three-dimensional zone bars and hour/weekday columns provide orbit interaction, with 2D alternatives for comparison. Sankey links represent aggregate OD counts; histogram bins describe trip distributions. The decorative city is explicitly labeled as stylized. Restrained colors identify observed demand, model forecasts and unusual deviations.

## 10. Machine learning

Zone-hour demand is made dense within source coverage. Lag-one, lag-24, and shifted 24-hour rolling statistics prevent use of the current target. Calendar features and zone ID supplement history. A 70/15/15 chronological split creates train, validation and test intervals. Validation selects between two Random Forest depths; held-out test MAE and RMSE are compared with previous-day same-hour demand. The next-hour forecast follows the dataset's final hour and is not a live prediction for today's city.

## 11. Anomalies

For each zone and selected weekday/hour, the detector uses earlier observed matching values only. Expected demand is their median; robust scale is `max(1, 1.4826 × MAD)`. At least three prior values are required. Absolute robust z-score above 3.5 is reported. Sparse unobserved hours are excluded, so this detector identifies unusual observed demand rather than outages or all missing-hour anomalies. Statistical deviations do not establish incidents or causes.

## 12. Performance evaluation

The benchmark command measures read-and-sum, filtering, zone grouping and hourly grouping at three row limits, with three repetitions. It reports median elapsed seconds and raw timings. Group/filter inputs are cached; reads can benefit from OS cache. Dataset row limits are not random representative samples. Machine load, local disk, cache warmth, and Spark startup overhead limit comparisons. Actual collected results appear in the processing lab and `data/processed/benchmarks.json`.

## 13. Results and limitations

Consult `verification.md` for executed build/test status and measured dataset/model results. The application never assumes Random Forest will beat its baseline. Local execution demonstrates real Spark operations but does not establish cluster throughput. TLC source accuracy is not guaranteed by the publisher. Wall-clock timestamps do not uniquely identify DST transitions. Zero-filled demand presumes complete consecutive input months. UI zone rankings are limited to the top 100 and OD views to selected top connections. Data is historical, not streaming. Sample mode represents sampled counts, not city-wide estimates.

## 14. Future enhancements

Add transactional dataset version publication, cross-validation across several seasons, per-zone model diagnostics, calibrated conformal intervals, holiday/weather features with historical availability controls, richer missing-hour anomaly detection, external accessibility review, and measured distributed-cluster experiments. These are future work, not implemented claims.

## 15. References

- NYC TLC official records: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page
- Apache Spark documentation: https://spark.apache.org/docs/latest/
- DuckDB Parquet documentation: https://duckdb.org/docs/stable/data/parquet/overview
- scikit-learn RandomForestRegressor: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html
- deck.gl geographic layers: https://deck.gl/docs/api-reference/layers/geojson-layer
