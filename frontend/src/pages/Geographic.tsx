import { lazy, Suspense, useState } from "react";
import { useAPI, number } from "../services/api";
import { usePreferences } from "../hooks/context";
import { Page, Panel, State } from "../components/layout/UI";
import type { Row } from "../types";
const GeoMap = lazy(() => import("../components/maps/GeoMap"));
export default function Geographic() {
  const { filters, setFilters } = usePreferences();
  const [compare, setCompare] = useState<string[]>([]);
  const zones = useAPI("/analytics/zones", filters, { limit: "100" });
  const flows = useAPI("/analytics/origin-destination", filters, {
    limit: "30",
  });
  return (
    <Page
      eyebrow="THE GEOGRAPHY OF MOVEMENT"
      title="Geographic Intelligence"
      description="Authentic NYC taxi zones. Demand made dimensional."
    >
      <Panel
        title="New York / demand atlas"
        action={
          <span className="small-label">
            DRAG TO PAN · RIGHT-DRAG TO ROTATE
          </span>
        }
      >
        <State
          loading={zones.isLoading}
          error={zones.error}
          empty={!zones.data?.rows.length}
        >
          <Suspense fallback={<State loading />}>
            <GeoMap
              zones={zones.data?.rows ?? []}
              flows={flows.data?.rows ?? []}
            />
          </Suspense>
        </State>
      </Panel>
      <div className="notice">
        Showing up to 100 highest-demand zones under the active filters.
        Extrusion height is a linear display scale, not building height. All
        filters use pickup timestamp; demand direction changes the geographic
        zone.
      </div>
      <div className="two-column">
        <Panel title="Compare locations" eyebrow="SELECT TWO ZONES">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Compare / zone</th>
                  <th>Trips</th>
                  <th>Avg fare</th>
                </tr>
              </thead>
              <tbody>
                {zones.data?.rows.slice(0, 20).map((z: Row) => (
                  <tr key={z.zone}>
                    <td>
                      <label className="compare-label">
                        <input
                          type="checkbox"
                          checked={compare.includes(String(z.zone))}
                          disabled={
                            compare.length >= 2 &&
                            !compare.includes(String(z.zone))
                          }
                          onChange={(e) =>
                            setCompare(
                              e.target.checked
                                ? [...compare, String(z.zone)]
                                : compare.filter((id) => id !== String(z.zone)),
                            )
                          }
                        />
                        <button
                          className="text-button"
                          onClick={() => setFilters({ zone: String(z.zone) })}
                        >
                          {z.name}
                        </button>
                      </label>
                    </td>
                    <td>{number(z.trips)}</td>
                    <td>${number(z.average_fare, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="compare-cards">
            {zones.data?.rows
              .filter((z: Row) => compare.includes(String(z.zone)))
              .map((z: Row) => (
                <div key={z.zone}>
                  <span>{z.name}</span>
                  <strong>{number(z.trips)} trips</strong>
                  <small>${number(z.average_fare, 2)} average fare</small>
                </div>
              ))}
          </div>
        </Panel>
        <Panel title="Most traveled connections" eyebrow="ORIGIN → DESTINATION">
          <State loading={flows.isLoading} error={flows.error}>
            <div className="flow-list">
              {flows.data?.rows.slice(0, 10).map((f: Row, i: number) => (
                <div key={i}>
                  <span>
                    <small>{f.origin_name}</small> →{" "}
                    <small>{f.destination_name}</small>
                  </span>
                  <strong>{number(f.trips)}</strong>
                </div>
              ))}
            </div>
          </State>
          <p className="panel-footnote">
            Zone-level aggregates. These connections do not reconstruct observed
            road routes.
          </p>
        </Panel>
      </div>
    </Page>
  );
}
