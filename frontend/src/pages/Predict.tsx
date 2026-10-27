import { useState } from "react";
import { useAPI, number } from "../services/api";
import { usePreferences } from "../hooks/context";
import { Page, Panel, State, Metric } from "../components/layout/UI";
import Chart from "../components/charts/Chart";
import type { Row } from "../types";
export default function Predict() {
  const { filters } = usePreferences();
  const [zone, setZone] = useState("161");
  const { data: zones = [] } = useAPI<any[]>("/zones");
  const forecast = useAPI("/forecast", undefined, {
    zone: filters.zone || zone,
  });
  const metrics = useAPI("/model/metrics");
  const anomalies = useAPI("/analytics/anomalies", filters);
  const d = forecast.data;
  const m = metrics.data;
  return (
    <Page
      eyebrow="AHEAD OF THE NEXT JOURNEY"
      title="Predictive Intelligence"
      description="One-hour demand forecasts, grounded in observed history."
    >
      <div className="forecast-toolbar">
        <label>
          Forecast zone
          <select
            aria-label="Forecast zone"
            value={filters.zone || zone}
            disabled={!!filters.zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          Forecasts use full zone history through the dataset’s last hour.
          Global date, borough, day, hour, and direction filters apply to
          anomalies, not the trained forecast. A global zone overrides the
          forecast selector.
        </p>
      </div>
      <State
        loading={forecast.isLoading || metrics.isLoading}
        error={forecast.error || metrics.error}
      >
        {d && m && (
          <>
            <div className="metrics-grid">
              <Metric
                label="Next-hour prediction"
                value={number(d.prediction, 1)}
                unit="trips"
                detail={d.timestamp + " · NYC time"}
              />
              <Metric
                label="Seasonal baseline"
                value={number(d.baseline, 1)}
                unit="trips"
                detail="Previous day, same hour"
              />
              <Metric
                label="Test MAE"
                value={number(m.test.mae, 2)}
                unit="trips"
                detail={"Baseline " + number(m.baseline_test.mae, 2) + " trips"}
              />
              <Metric
                label="Test RMSE"
                value={number(m.test.rmse, 2)}
                unit="trips"
                detail={
                  "Baseline " + number(m.baseline_test.rmse, 2) + " trips"
                }
              />
            </div>
            <div className="notice">
              <span className="live-dot" />
              {d.scope}.{" "}
              {m.mode === "sample"
                ? "Model trained on sampled trip counts; not full NYC demand."
                : ""}{" "}
              No confidence interval is claimed.
            </div>
            <Panel
              title="The next hour of movement"
              eyebrow="OBSERVED HISTORY → MODEL FORECAST"
            >
              <Chart
                title="Next hour forecast"
                option={{
                  legend: {
                    data: ["Actual", "Forecast"],
                    textStyle: { color: "#94a3b8" },
                  },
                  xAxis: {
                    type: "category",
                    data: [...d.recent.map((r: Row) => r.time), d.timestamp],
                    axisLabel: { formatter: (v: string) => v.slice(5, 16) },
                  },
                  yAxis: {
                    type: "value",
                    name: "Pickups",
                    splitLine: { lineStyle: { color: "#1c2637" } },
                  },
                  series: [
                    {
                      name: "Actual",
                      type: "line",
                      showSymbol: false,
                      data: [...d.recent.map((r: Row) => r.actual), null],
                    },
                    {
                      name: "Forecast",
                      type: "line",
                      symbolSize: 10,
                      lineStyle: { type: "dashed" },
                      itemStyle: { color: "#8b5cf6" },
                      data: [
                        ...d.recent.map((r: Row, i: number) =>
                          i === d.recent.length - 1 ? r.actual : null,
                        ),
                        d.prediction,
                      ],
                    },
                  ],
                }}
              />
            </Panel>
            <div className="two-column">
              <Panel
                title="Held-out evaluation"
                eyebrow="ROLLING ONE-STEP FORECASTS / LAST 96 TEST HOURS"
              >
                <Chart
                  title="Predicted versus actual"
                  option={{
                    legend: { textStyle: { color: "#94a3b8" } },
                    xAxis: {
                      type: "category",
                      data: d.evaluation.map((r: Row) => r.time),
                      axisLabel: { formatter: (v: string) => v.slice(5, 16) },
                    },
                    yAxis: {
                      type: "value",
                      name: "Pickups",
                      splitLine: { lineStyle: { color: "#1c2637" } },
                    },
                    series: [
                      ["actual", "Actual"],
                      ["predicted", "Random Forest"],
                      ["lag24", "Seasonal baseline"],
                    ].map(([key, name]) => ({
                      name,
                      type: "line",
                      showSymbol: false,
                      data: d.evaluation.map((r: Row) => r[key]),
                    })),
                  }}
                />
              </Panel>
              <Panel title="Inside the model" eyebrow="TRANSPARENT BY DESIGN">
                <dl className="metadata-list">
                  <dt>Algorithm</dt>
                  <dd>{m.model}</dd>
                  <dt>Train / validation / test</dt>
                  <dd>70% / 15% / 15% chronological</dd>
                  <dt>Training rows</dt>
                  <dd>{number(m.train_rows)}</dd>
                  <dt>Test rows</dt>
                  <dd>{number(m.test_rows)}</dd>
                  <dt>Training ends before</dt>
                  <dd>{m.train_end}</dd>
                  <dt>Test begins</dt>
                  <dd>{m.validation_end}</dd>
                  <dt>Features</dt>
                  <dd>{m.features.join(", ")}</dd>
                </dl>
                <p className="panel-footnote">{m.evaluation}</p>
              </Panel>
            </div>
          </>
        )}
      </State>
      <Panel
        title="Unusual demand signals"
        eyebrow="ROBUST SEASONAL DEVIATIONS"
      >
        <State
          loading={anomalies.isLoading}
          error={anomalies.error}
          empty={!anomalies.data?.rows.length}
        >
          <Chart
            title="Anomaly timeline"
            option={{
              useUTC: true,
              tooltip: {
                trigger: "item",
                formatter: (p: any) =>
                  `${p.data[3]} · ${p.data[4]}<br/>Observed ${p.data[1]} trips · robust z ${p.data[2].toFixed(2)}`,
              },
              xAxis: { type: "time" },
              yAxis: {
                type: "value",
                name: "Observed trips",
                splitLine: { lineStyle: { color: "#1c2637" } },
              },
              series: [
                {
                  type: "scatter",
                  symbolSize: 10,
                  itemStyle: { color: "#ff986b" },
                  data: anomalies.data?.rows.map((r: Row) => [
                    r.time.replace(" ", "T") + "Z",
                    r.trips,
                    r.score,
                    r.name,
                    r.time,
                  ]),
                },
              ],
            }}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Zone / timestamp</th>
                  <th>Observed</th>
                  <th>Expected</th>
                  <th>Robust z-score</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.data?.rows.map((r: Row, i: number) => (
                  <tr key={i}>
                    <td>
                      {r.name}
                      <small>{r.time}</small>
                    </td>
                    <td>{r.trips}</td>
                    <td>{number(r.expected, 1)}</td>
                    <td className="orange">{number(r.score, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
        <p className="panel-footnote">
          Median and MAD of at least three earlier matching weekday/hour
          observations. |z| &gt; 3.5; scale floor 1 trip. Sparse unobserved
          hours are excluded. A statistical anomaly is not evidence of an
          external incident.
        </p>
      </Panel>
    </Page>
  );
}
