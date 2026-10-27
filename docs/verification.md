# Verification record

Executed locally on 27 October 2026, with Java 17 and Spark 3.5.6.

## Data and processing

- Official NYC TLC Yellow Taxi January–March 2024 Parquet files were downloaded and inspected.
- Input: 9,554,778 rows / 160,389,205 bytes.
- Validated output: 9,095,282 rows; rejected: 459,496 rows.
- Aggregate cube: 3,355,823 rows; output: 52,588,949 bytes.
- Spark local[2] full ETL: 25.56 seconds, including aggregation: 11.48 seconds.
- A reproducible 60,099-row offline sample of original TLC records was created in `data/samples`.

## Forecast

- Chronological held-out test: 83,592 zone-hour rows.
- Random Forest: MAE 3.25, RMSE 10.53 trips.
- Previous-day same-hour baseline: MAE 5.37, RMSE 19.94 trips.
- A live local API request for zone 161 returned a non-negative next-historical-hour forecast, 48 recent actual points, and 96 evaluation points.

## Automated checks

| Check | Result |
| --- | --- |
| Backend pytest | 8 passed in 7.97 seconds |
| Frontend Vitest | 6 passed |
| Production frontend build | passed |
| Playwright desktop/mobile flow | 2 passed in 16.5 seconds |
| npm audit | 0 vulnerabilities |

The Playwright flow covered the intro, 3D canvas presence, dashboard navigation, global borough filtering, accessible 2D chart mode, prediction page, processing page, geographic 2D/3D switch, and mobile-width overflow. Captures: `landing-desktop.png`, `command-desktop.png`, and `command-mobile.png`.

## Known build observation

The production build succeeds. Vite reports that the lazily loaded map and 3D vendor chunks exceed its generic 500 kB warning threshold. Those modules are only requested by their corresponding routes; the warning is not a build failure. Further bundle splitting would be a performance refinement, not a functional defect.
