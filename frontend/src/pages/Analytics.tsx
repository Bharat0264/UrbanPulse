import { lazy, Suspense, useState } from "react";
import { useAPI } from "../services/api";
import { usePreferences } from "../hooks/context";
import { Page, Panel, State } from "../components/layout/UI";
import Chart, { timeOption } from "../components/charts/Chart";
import type { Row } from "../types";
import { supportsWebGL } from "../utils/webgl";
const DemandBars = lazy(() => import("../components/three/DemandBars"));
const axis = {
  type: "value",
  name: "Trips",
  splitLine: { lineStyle: { color: "#1c2637" } },
};
export default function Analytics() {
  const { filters, setFilters, low } = usePreferences();
  const [three, setThree] = useState(!low && supportsWebGL());
  const [threshold, setThreshold] = useState(0);
  const daily = useAPI("/analytics/daily-demand", filters);
  const zones = useAPI("/analytics/zones", filters, { limit: "10" });
  const landscape = useAPI("/analytics/landscape", filters);
  const flow = useAPI("/analytics/origin-destination", filters);
  const dist = useAPI("/analytics/fare-distance", filters);
  const weekdays = useAPI("/analytics/weekdays", filters);
  const links = (flow.data?.rows ?? [])
    .filter((r: Row) => r.trips >= threshold)
    .map((r: Row) => ({
      source: "From: " + r.origin_name,
      target: "To: " + r.destination_name,
      value: r.trips,
    }));
  const nodes = Array.from(
    new Set(links.flatMap((l: any) => [l.source, l.target])),
  ).map((name) => ({ name }));
  return (
    <Page
      eyebrow="PATTERNS BEYOND THE SURFACE"
      title="Mobility Analytics"
      description="Explore time, geography, and the economics of every journey."
      action={
        <button
          className="secondary-button"
          disabled={!supportsWebGL()}
          onClick={() => setThree(!three)}
        >
          {three ? "Switch to accessible 2D" : "Enable 3D charts"}
        </button>
      }
    >
      <Panel
        title="Demand over time"
        eyebrow="DAILY TRIPS / SEVEN-DAY ROLLING AVERAGE"
      >
        <State
          loading={daily.isLoading}
          error={daily.error}
          empty={!daily.data?.rows.length}
        >
          <Chart
            title="Daily trips and rolling average"
            option={{
              ...timeOption(daily.data?.rows ?? [], "date", true),
              legend: { textStyle: { color: "#aab5c8" }, top: 0 },
            }}
          />
        </State>
      </Panel>
      <div className="two-column">
        <Panel
          title="Demand by zone"
          eyebrow={three ? "3D EXPLORER" : "2D COMPARISON"}
        >
          <State
            loading={zones.isLoading}
            error={zones.error}
            empty={!zones.data?.rows.length}
          >
            {three ? (
              <Suspense fallback={<State loading />}>
                <DemandBars
                  rows={zones.data?.rows ?? []}
                  onSelect={(r) => setFilters({ zone: String(r.zone) })}
                />
              </Suspense>
            ) : (
              <Chart
                title="Zone demand"
                option={{
                  xAxis: {
                    type: "category",
                    data: zones.data?.rows.map((r: Row) => r.name),
                    axisLabel: { rotate: 25, overflow: "truncate", width: 65 },
                  },
                  yAxis: axis,
                  series: [
                    {
                      type: "bar",
                      data: zones.data?.rows.map((r: Row) => r.trips),
                      barMaxWidth: 28,
                    },
                  ],
                }}
              />
            )}
          </State>
        </Panel>
        <Panel title="The weekly landscape" eyebrow="HOUR × WEEKDAY × TRIPS">
          <State
            loading={landscape.isLoading}
            error={landscape.error}
            empty={!landscape.data?.rows.length}
          >
            {three ? (
              <Suspense fallback={<State loading />}>
                <DemandBars rows={landscape.data?.rows ?? []} landscape />
              </Suspense>
            ) : (
              <Chart
                title="Weekday hourly heatmap"
                option={{
                  tooltip: {
                    position: "top",
                    formatter: (p: any) =>
                      `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][p.value[1]]} ${p.value[0]}:00 · ${p.value[2]} trips`,
                  },
                  grid: { left: 44, bottom: 65, right: 15 },
                  xAxis: {
                    type: "category",
                    data: Array.from({ length: 24 }, (_, i) => i),
                  },
                  yAxis: {
                    type: "category",
                    data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  },
                  visualMap: {
                    min: 0,
                    max: Math.max(
                      1,
                      ...(landscape.data?.rows ?? []).map((r: Row) => r.trips),
                    ),
                    orient: "horizontal",
                    left: "center",
                    bottom: 0,
                    itemHeight: 120,
                    textStyle: { color: "#94a3b8" },
                    inRange: { color: ["#142337", "#236b89", "#35d9ff"] },
                  },
                  series: [
                    {
                      type: "heatmap",
                      data: landscape.data?.rows.map((r: Row) => [
                        r.hour,
                        r.day - 1,
                        r.trips,
                      ]),
                    },
                  ],
                }}
              />
            )}
          </State>
        </Panel>
      </div>
      <div className="two-column">
        <Panel
          title="Origin → destination"
          eyebrow="TOP ZONE CONNECTIONS"
          action={
            <label className="threshold">
              Min trips
              <input
                aria-label="Minimum flow trips"
                type="number"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(Math.max(0, +e.target.value))}
              />
            </label>
          }
        >
          <State
            loading={flow.isLoading}
            error={flow.error}
            empty={!links.length}
          >
            <Chart
              title="Origin destination Sankey"
              option={{
                tooltip: { trigger: "item" },
                series: [
                  {
                    type: "sankey",
                    data: nodes,
                    links,
                    left: 110,
                    right: 110,
                    top: 20,
                    bottom: 20,
                    nodeWidth: 8,
                    nodeGap: 12,
                    label: {
                      color: "#bcc8dc",
                      fontSize: 9,
                      width: 100,
                      overflow: "truncate",
                    },
                    lineStyle: { color: "gradient", opacity: 0.25 },
                    emphasis: { focus: "adjacency" },
                  },
                ],
              }}
              height={340}
            />
          </State>
        </Panel>
        <Panel
          title="Weekday vs. weekend"
          eyebrow="AVERAGE TRIPS PER OBSERVED DATE"
        >
          <State loading={weekdays.isLoading} error={weekdays.error}>
            <Chart
              title="Demand by weekday"
              option={{
                xAxis: {
                  type: "category",
                  data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                },
                yAxis: { ...axis, name: "Trips / date" },
                series: [
                  {
                    type: "bar",
                    data: Array.from({ length: 7 }, (_, i) => {
                      const r = weekdays.data?.rows.find(
                        (r: Row) => r.day === i + 1,
                      );
                      return {
                        value: r ? r.trips / r.days : 0,
                        itemStyle: { color: i >= 5 ? "#8b5cf6" : "#35d9ff" },
                      };
                    }),
                    barMaxWidth: 30,
                  },
                ],
              }}
              height={340}
            />
          </State>
        </Panel>
      </div>
      <div className="three-column">
        {[
          ["fare", "Fare distribution", "USD · $5 bins"],
          ["distance", "Distance distribution", "Miles · 1-mile bins"],
          ["duration", "Duration distribution", "Minutes · 5-minute bins"],
        ].map(([key, title, label]) => (
          <Panel key={key} title={title} eyebrow={label}>
            <State
              loading={dist.isLoading}
              error={dist.error}
              empty={!dist.data?.distributions[key]?.length}
            >
              <Chart
                title={title}
                height={240}
                option={{
                  xAxis: {
                    type: "category",
                    data: dist.data?.distributions[key].map((r: Row) => r.bin),
                    name: label.split(" · ")[0],
                  },
                  yAxis: axis,
                  dataZoom: [{ type: "inside" }],
                  series: [
                    {
                      type: "bar",
                      data: dist.data?.distributions[key].map(
                        (r: Row) => r.trips,
                      ),
                      itemStyle: {
                        color:
                          key === "fare"
                            ? "#35d9ff"
                            : key === "distance"
                              ? "#8b5cf6"
                              : "#ff986b",
                      },
                    },
                  ],
                }}
              />
            </State>
          </Panel>
        ))}
      </div>
      <Panel
        title="Fare meets distance"
        eyebrow="BINNED OBSERVED RELATIONSHIP / TOP 5,000 CELLS"
      >
        <State loading={dist.isLoading} error={dist.error}>
          <Chart
            title="Fare versus distance"
            option={{
              tooltip: {
                trigger: "item",
                formatter: (p: any) =>
                  `${p.value[0]}–${p.value[0] + 1} miles · $${p.value[1]}–$${p.value[1] + 5} · ${p.value[2]} trips`,
              },
              xAxis: {
                type: "value",
                name: "Distance (mi)",
                splitLine: { lineStyle: { color: "#1c2637" } },
              },
              yAxis: {
                type: "value",
                name: "Fare (USD)",
                splitLine: { lineStyle: { color: "#1c2637" } },
              },
              dataZoom: [{ type: "inside" }],
              series: [
                {
                  type: "scatter",
                  data: dist.data?.distributions.relationship.map((r: Row) => [
                    r.distance,
                    r.fare,
                    r.trips,
                  ]),
                  symbolSize: (v: number[]) =>
                    Math.min(24, 3 + Math.log1p(v[2]) * 2),
                  itemStyle: { opacity: 0.45, color: "#35d9ff" },
                },
              ],
            }}
          />
        </State>
        <p className="panel-footnote">
          Each point is an aggregate 1-mile × $5 bin, not an individual trip.
          Point size uses log trip count to control overlap.
        </p>
      </Panel>
      <p className="notice">
        Distributions use Spark histogram bins. Fare excludes tips, taxes, and
        tolls. Weekday averages count dates with observed trips under the
        selected filters.
      </p>
    </Page>
  );
}
