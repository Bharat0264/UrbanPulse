# UrbanPulse

**UrbanPulse: An Intelligent Big Data Visualization Framework for Urban Mobility Pattern Analysis and Demand Forecasting**

A standalone local React + FastAPI application. No ChatGPT Sites, paid services, Docker, map keys, or cloud account are required. The visual interface uses real WebGL geometry; analytics come from Spark-processed official NYC TLC records.

## Requirements

- macOS Apple Silicon (also portable to Linux with Java installed)
- Node.js 22.12+ (tested with Node 24)
- Python 3.9–3.12 (tested with 3.9.6; 3.11 recommended for a new environment)
- Java **17**, required by PySpark 3.5.6
- About 2 GB free disk for dependencies/data; 8 GB RAM recommended
- Internet for first dependency/data download; offline sample mode thereafter

## Install

Run from the `urbanpulse` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --index-url https://pypi.org/simple -r backend/requirements.txt
cd frontend
npm ci
cd ..
```

The direct dependency list is pinned for reproducible local installs. `backend/requirements.lock.txt` records the verified macOS ARM64/Python 3.9 environment; Python wheels can still vary by operating system and Python version.

Install a Java 17 JDK, or use the project-local runtime supplied in this workspace. Then:

```bash
source scripts/spark-env.sh
java -version
# If using the project-local runtime:
"$JAVA_HOME/bin/java" -version
```

The environment script discovers `.runtime/jdk*/Contents/Home`, sets the Python interpreter and binds Spark to loopback. It does not change system Java or shell profiles.

## Real dataset: three months

```bash
source .venv/bin/activate
source scripts/spark-env.sh
python -m backend.pipelines.ingest --months 2024-01 2024-02 2024-03
python -m backend.pipelines.process --months 2024-01 2024-02 2024-03
python -m backend.ml.train
python -m backend.pipelines.benchmark
```

Ingestion retrieves official monthly Parquet, the taxi-zone lookup, and official zone boundaries. Downloads use temporary files and content-length checks, and ingestion records Parquet row counts, schemas, sizes and SHA256 hashes. ETL casts compatible fields before union, validates and cleans rows, derives features, and writes partitioned aggregates. Models are trained separately; API requests never launch Spark.

Use consecutive complete months for forecasting. Reprocessing replaces the active dataset; retrain afterward. Stop the API while reprocessing. Large full-data runs and model training can take several minutes on a laptop.

## Fast offline classroom mode

The `data/samples` folder contains a reproducible sample of **real** TLC rows, official geography, and provenance. It contains no synthetic trips. After installing dependencies and Java:

```bash
source .venv/bin/activate
source scripts/spark-env.sh
python -m backend.pipelines.sample restore
python -m backend.pipelines.process --sample --months 2024-01 2024-02 2024-03
python -m backend.ml.train
```

Sample mode uses Spark too. Counts and forecasts are **sample demand**, not estimates of full city demand. The UI and reports label this explicitly. To regenerate the bundled sample after downloading source files:

```bash
python -m backend.pipelines.sample create
```

Alternatively, `process --sample-rows 100000 --months 2024-01` takes a seeded sample directly from a full source file.

## Start

```bash
./scripts/dev.sh
```

Open **http://127.0.0.1:5173**. FastAPI runs at **http://127.0.0.1:8000**; interactive API documentation is at `/docs`. The launch script stops its API child when it exits.

Separate terminals:

```bash
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm run dev
```

The frontend proxies `/api` to port 8000. CORS permits only `http://127.0.0.1:5173` by default. To change it, export `FRONTEND_ORIGIN` before starting the backend. `.env.example` documents the setting; it is not automatically loaded.

## Application

- **Cinematic introduction:** instanced city geometry, orbit interaction, atmospheric light, scroll-linked copy, reduced motion and skip intro.
- **Command Center:** measured trips, fares, distances, duration, demand map, hourly rhythm, zone rankings and calculated data stories.
- **Geographic Intelligence:** official boundaries, deck.gl extrusions, hover/click, rotation, 2D/3D, flow arcs, reset/fullscreen and zone comparisons.
- **Mobility Analytics:** temporal trends, rolling averages, zone bars, a 3D weekday/hour landscape, accessible heatmap, Sankey, weekday averages and distributions.
- **Predictive Intelligence:** historical next-hour Random Forest forecast, seasonal baseline, held-out MAE/RMSE, observed/predicted timelines and robust seasonal anomalies.
- **Spark Processing Lab:** recorded execution details, row accounting, sizes, interactive pipeline and measured benchmarks.
- **Exports:** chart PNG buttons, aggregated CSV download and selected-filter PDF report.

All exploratory queries share date, borough, zone, day type, hour and direction filters. Date/time always refers to **pickup time**. Direction selects the pickup or drop-off geographic dimension; it does not change the timestamp. Forecasting uses full selected-zone history rather than filtering away its lag features. This distinction is displayed in the interface.

## Tests and production build

```bash
source scripts/spark-env.sh
.venv/bin/python -m pytest backend/tests -q
cd frontend
npm test
npm run build
# Start both servers first:
npm run test:e2e
```

The browser tests use installed Chrome on macOS. For another platform, remove `executablePath` in `playwright.config.ts` and run `npx playwright install chromium`.

Tests validate cleaning, aggregation, API schemas, filters, shifted ML features, anomaly baselines, saved forecasts and exports. Browser checks cover navigation, filters, charts, map controls, errors and mobile overflow. See `docs/verification.md` for actual executed results; scripts existing does not imply they passed.

## Data integrity

- Source: [NYC TLC trip record data](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).
- Taxi trips contain zone identifiers, not traveled road trajectories. Arcs show aggregate **zone-centroid connections** only.
- Hero buildings are explicitly stylized, not geographic evidence.
- Fares use `fare_amount`, excluding tips, tolls, and surcharges. No invented percentage comparisons or confidence scores.
- Cleaning rules: known zones 1–263, pickup within requested months, duration 1–180 minutes, distance `(0, 200]` miles, fare `[0, 1000]` USD. Null/NaN values fail validation. These thresholds exclude refunds, zero-distance trips and outliers; see limitations.
- TLC timestamps are local wall-clock values. Storage preserves these as timezone-naive local hours. DST repeated/skipped hours cannot be uniquely resolved from these fields.
- Each forecast is the next historical hour after coverage, **not today's live demand**.
- Model metrics are measured on chronological held-out hours. Better-than-baseline performance is not assumed.

## Structure

```text
frontend/src/        React pages, charts, WebGL scenes, maps, shared state
backend/app/         FastAPI schemas, DuckDB analytics, prediction serving
backend/pipelines/  Official downloads, Spark ETL, sample and benchmarks
backend/ml/         Chronological feature engineering and training
backend/tests/      Backend unit/integration tests
data/raw/           Downloaded TLC sources (ignored)
data/processed/     Spark output and recorded metadata (ignored)
data/samples/       Small real-data offline package + provenance
models/             Trained model, metadata and held-out predictions (ignored)
scripts/            Local startup and Spark environment
docs/               Architecture, academic report, demo and verification
```

## Troubleshooting

- **Java gateway exited:** verify Java 17 and source `scripts/spark-env.sh` from the project directory. Set `JAVA_HOME` to the JDK's `Contents/Home` on macOS.
- **API shows dataset unavailable:** run ingestion + ETL. Prediction also requires model training. Run commands from the project root.
- **Model stale:** dataset ID changed. Run `python -m backend.ml.train` again.
- **Port busy:** stop the other process or consistently adjust both proxy and backend port.
- **Map unsupported:** enable reduced effects and use 2D charts/rankings. WebGL2 is required for geographic extrusion.
- **No anomalies:** at least three earlier matching weekday/hour observations are needed. A narrow filter or short sample can legitimately return none.
- **No data under filters:** reset filters or widen the selection; missing data is never replaced with fake metrics.
- **Offline fonts:** fonts fall back to system sans-serif/monospace; analytics and maps do not need external map tiles.

Academic methodology, limitations and demonstration instructions are in `docs/academic-report.md` and `docs/demo-guide.md`.
