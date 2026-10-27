import { useState } from "react";
import { Database, Check, ChevronRight } from "lucide-react";
import { useAPI, number } from "../services/api";
import { Page, Panel, State, Metric } from "../components/layout/UI";
import Chart from "../components/charts/Chart";
const steps = [
  [
    "Raw Parquet",
    "Official TLC monthly Parquet, validated footer, recorded size and SHA256.",
  ],
  [
    "PySpark ingestion",
    "Compatible fields cast before monthly union; local[2] execution.",
  ],
  [
    "Cleaning",
    "Known zones, valid timestamps, plausible duration, distance, and fare. Invalid rows rejected.",
  ],
  [
    "Features",
    "Local pickup hour, date and month; duration derived from timestamps.",
  ],
  [
    "Aggregations",
    "Distributed groupBy over hours, zone pairs, and histogram bins.",
  ],
  ["Parquet storage", "Partitioned aggregates and zone-hour demand."],
  [
    "FastAPI",
    "Parameterized DuckDB queries enforce shared filtering semantics.",
  ],
  [
    "Visualization",
    "Bounded aggregates power charts, geographic extrusion, and evaluation.",
  ],
];
export default function Spark() {
  const [step, setStep] = useState(0);
  const meta = useAPI("/spark/metrics");
  const benchmarks = useAPI("/spark/benchmarks");
  const d = meta.data;
  return (
    <Page
      eyebrow="ENGINEERED, NOT SIMULATED"
      title="Spark Processing Lab"
      description="Follow every record from raw source to analytical insight."
    >
      <State loading={meta.isLoading} error={meta.error}>
        {d && (
          <>
            <div className="processing-banner">
              <Check size={24} className="cyan" />
              <div>
                <strong>Pipeline completed</strong>
                <p>Recorded job · {d.completed_at} · not live execution</p>
              </div>
              <span className="dataset-badge">
                APACHE SPARK {d.spark_version}
              </span>
            </div>
            <div className="metrics-grid">
              <Metric
                label="Input records"
                value={number(d.input_rows)}
                detail={
                  d.mode === "sample"
                    ? "Sampled from " + number(d.source_rows) + " source rows"
                    : "Full selected source files"
                }
              />
              <Metric
                label="Validated records"
                value={number(d.cleaned_rows)}
                detail="Passed documented cleaning rules"
              />
              <Metric
                label="Rejected records"
                value={number(d.rejected_rows)}
                detail="Input minus validated records"
              />
              <Metric
                label="Processing duration"
                value={number(d.duration_seconds, 1)}
                unit="sec"
                detail="Measured wall-clock ETL duration"
              />
            </div>
            <Panel
              title="The intelligence pipeline"
              eyebrow="FROM RECORDS TO REVELATIONS"
            >
              <div className="pipeline">
                {steps.map(([name], i) => (
                  <button
                    className={step === i ? "active" : ""}
                    key={name}
                    onClick={() => setStep(i)}
                  >
                    <span>0{i + 1}</span>
                    <Database size={22} />
                    <strong>{name}</strong>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="pipeline-detail">
                <span className="cyan">STAGE 0{step + 1}</span>
                <p>{steps[step][1]}</p>
              </div>
            </Panel>
            <div className="two-column">
              <Panel title="Dataset ledger" eyebrow="PROVENANCE & INTEGRITY">
                <dl className="metadata-list">
                  <dt>Source</dt>
                  <dd>{d.source}</dd>
                  <dt>Mode</dt>
                  <dd>{d.mode}</dd>
                  <dt>Loaded months</dt>
                  <dd>{d.months.join(", ")}</dd>
                  <dt>Input size</dt>
                  <dd>{number(d.input_bytes / 1024 / 1024, 1)} MiB</dd>
                  <dt>Output size</dt>
                  <dd>{number(d.output_bytes / 1024 / 1024, 1)} MiB</dd>
                  <dt>Aggregate rows</dt>
                  <dd>{number(d.aggregate_rows)}</dd>
                  <dt>Coverage</dt>
                  <dd>
                    {d.start} → {d.end}
                  </dd>
                </dl>
              </Panel>
              <Panel
                title="Execution environment"
                eyebrow="MEASURED LOCAL PROCESSING"
              >
                <dl className="metadata-list">
                  <dt>Spark version</dt>
                  <dd>{d.spark_version}</dd>
                  <dt>Master</dt>
                  <dd>{d.master}</dd>
                  <dt>Partitions</dt>
                  <dd>{d.partitions}</dd>
                  <dt>Aggregation duration</dt>
                  <dd>{number(d.aggregation_seconds, 2)} s</dd>
                  <dt>Time zone</dt>
                  <dd>America/New_York</dd>
                </dl>
                <p className="panel-footnote">{d.cleaning}</p>
              </Panel>
            </div>
          </>
        )}
      </State>
      <Panel title="Performance benchmarks" eyebrow="REPRODUCIBLE MEASUREMENTS">
        <State loading={benchmarks.isLoading} error={benchmarks.error}>
          {benchmarks.data?.results.length ? (
            <Chart
              title="Measured Spark benchmarks"
              option={{
                legend: { textStyle: { color: "#94a3b8" } },
                xAxis: {
                  type: "category",
                  name: "Input rows",
                  data: Array.from(
                    new Set(benchmarks.data.results.map((r: any) => r.rows)),
                  ),
                },
                yAxis: {
                  type: "value",
                  name: "Median seconds",
                  splitLine: { lineStyle: { color: "#1c2637" } },
                },
                series: [
                  "read_parquet",
                  "filter",
                  "group_zones",
                  "hourly_demand",
                ].map((op) => ({
                  name: op,
                  type: "bar",
                  data: benchmarks.data.results
                    .filter((r: any) => r.operation === op)
                    .map((r: any) => r.median_seconds),
                })),
              }}
            />
          ) : (
            <div className="state">
              <Database />
              <h3>No benchmark runs recorded</h3>
              <code>python -m backend.pipelines.benchmark</code>
            </div>
          )}
          <p className="panel-footnote">{benchmarks.data?.methodology}</p>
        </State>
      </Panel>
    </Page>
  );
}
