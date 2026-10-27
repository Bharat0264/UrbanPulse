import { lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowUpRight, Download, Radio } from "lucide-react";
import { usePreferences } from "../hooks/context";
import { useAPI, number, parameters } from "../services/api";
import { Page, Panel, Metric, State } from "../components/layout/UI";
import Chart, { timeOption } from "../components/charts/Chart";
import type { Row } from "../types";
const GeoMap = lazy(() => import("../components/maps/GeoMap"));
export default function Command() {
  const { filters, setFilters } = usePreferences();
  const navigate = useNavigate();
  const summary = useAPI("/dashboard/overview", filters);
  const zones = useAPI("/analytics/zones", filters, { limit: "100" });
  const hours = useAPI("/analytics/hourly-demand", filters);
  const flows = useAPI("/analytics/origin-destination", filters);
  const d = summary.data;
  return (
    <Page
      eyebrow="YOUR CITY. DECODED."
      title="Command Center"
      description="A connected view of New York’s movement, one journey at a time."
      action={
        <a
          className="secondary-button"
          href={"/api/export/csv?" + parameters(filters)}
        >
          <Download size={15} /> Export data
        </a>
      }
    >
      <State
        loading={summary.isLoading}
        error={summary.error}
        empty={d?.trips === 0}
      >
        {d && (
          <>
            <div className="metrics-grid">
              <Metric
                label="Total trips"
                value={number(d.trips)}
                detail="Observed in selected period"
              />
              <Metric
                label="Reported fares"
                value={"$" + number(d.fares)}
                detail="Fare amount · excludes tips & tolls"
              />
              <Metric
                label="Average distance"
                value={number(d.distance, 2)}
                unit="mi"
                detail="Per validated trip"
              />
              <Metric
                label="Average duration"
                value={number(d.duration, 1)}
                unit="min"
                detail="Pickup to drop-off"
              />
            </div>
            <div className="command-grid">
              <Panel
                className="map-panel"
                eyebrow="SPATIAL INTELLIGENCE"
                title="The city, in motion"
                action={
                  <Link to="/app/geo" className="text-link">
                    Explore map <ArrowUpRight size={14} />
                  </Link>
                }
              >
                <State loading={zones.isLoading} error={zones.error}>
                  <Suspense fallback={<State loading />}>
                    <GeoMap
                      zones={zones.data?.rows ?? []}
                      flows={flows.data?.rows ?? []}
                      compact
                    />
                  </Suspense>
                </State>
              </Panel>
              <Panel
                title="Demand rhythm"
                eyebrow="HOURLY PULSE"
                action={<Radio size={18} className="cyan" />}
              >
                <div className="chart-kicker">
                  <strong>
                    {String(d.peak_hour ?? 0).padStart(2, "0")}:00
                  </strong>
                  <span>Peak hour across selected days</span>
                </div>
                <State loading={hours.isLoading} error={hours.error}>
                  <Chart
                    title="Hourly pickup demand"
                    option={timeOption(hours.data?.rows ?? [])}
                    height={250}
                  />
                </State>
                <div className="panel-footnote">
                  Aggregated trips · NYC local time
                </div>
              </Panel>
            </div>
            <div className="lower-grid">
              <Panel
                title={`Top ${filters.direction} zones`}
                eyebrow="WHERE IT HAPPENS"
                action={<span className="small-label">TRIPS</span>}
              >
                <State loading={zones.isLoading} error={zones.error}>
                  <div className="ranking">
                    {zones.data?.rows.slice(0, 5).map((z: Row, i: number) => (
                      <button
                        key={z.zone}
                        onClick={() => setFilters({ zone: String(z.zone) })}
                      >
                        <span className="rank-number">0{i + 1}</span>
                        <div>
                          <span>{z.name}</span>
                          <i
                            style={{
                              width:
                                (z.trips / zones.data.rows[0].trips) * 100 +
                                "%",
                            }}
                          />
                        </div>
                        <strong>{number(z.trips)}</strong>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </State>
              </Panel>
              <Panel title="Data stories" eyebrow="SIGNALS WORTH EXPLORING">
                <div className="insight-grid">
                  {d.stories.map((s: Row, i: number) => (
                    <button
                      className="insight"
                      key={i}
                      onClick={() => {
                        if (s.zone) setFilters({ zone: String(s.zone) });
                        if (s.hour !== undefined)
                          setFilters({
                            hour_start: String(s.hour),
                            hour_end: String(s.hour),
                          });
                        if (s.date) setFilters({ start: s.date, end: s.date });
                        navigate("/app/" + s.page);
                      }}
                    >
                      <span className="insight-index">
                        INSIGHT / 0{i + 1}
                        <ArrowUpRight size={15} />
                      </span>
                      <strong>{s.title}</strong>
                      <p>{s.detail}</p>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </State>
    </Page>
  );
}
