import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Map,
  ChartNoAxesCombined,
  BrainCircuit,
  Workflow,
  SlidersHorizontal,
  Menu,
  ChevronLeft,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { usePreferences } from "../../hooks/context";
import { useAPI, parameters } from "../../services/api";
import { defaultFilters, type Metadata } from "../../types";
const navigation = [
  ["", "Command Center", LayoutDashboard],
  ["geo", "Geographic Intelligence", Map],
  ["analytics", "Mobility Analytics", ChartNoAxesCombined],
  ["predict", "Predictive Intelligence", BrainCircuit],
  ["spark", "Spark Processing Lab", Workflow],
] as const;
export default function Shell() {
  const [collapsed, collapse] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true",
  );
  const [settings, setSettings] = useState(false);
  const {
    filters,
    setFilters,
    reduced,
    setReduced,
    low,
    setLow,
    contrast,
    setContrast,
  } = usePreferences();
  const { data: meta } = useAPI<Metadata>("/dataset/metadata");
  const { data: zones = [] } = useAPI<any[]>("/zones");
  const location = useLocation();
  return (
    <div className={"app-shell " + (collapsed ? "collapsed" : "")}>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Activity size={21} />
          </span>
          <span>
            urban<span className="brand-light">pulse</span>
            <small>MOBILITY INTELLIGENCE</small>
          </span>
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <nav>
          {navigation.map(([path, label, Icon], i) => (
            <NavLink
              key={path}
              to={"/app" + (path ? "/" + path : "")}
              end={path === ""}
              title={label}
            >
              <Icon size={19} />
              <span>{label}</span>
              <small>0{i + 1}</small>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card">
            <span className="live-dot" /> NYC OPEN DATA
            <h4>One city. Millions of stories.</h4>
            <p>TLC Yellow Taxi Records</p>
            <a
              href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page"
              target="_blank"
              rel="noreferrer"
            >
              View source <ArrowUpRight size={13} />
            </a>
          </div>
          <button onClick={() => setSettings(!settings)}>
            <SlidersHorizontal size={18} />
            <span>Experience settings</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem("sidebar-collapsed", String(!collapsed));
              collapse(!collapsed);
            }}
            aria-label="Collapse navigation"
          >
            <ChevronLeft size={18} />
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => collapse(!collapsed)}
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            WORKSPACE <span>/</span>{" "}
            <strong>
              {navigation.find(
                ([p]) => location.pathname === "/app" + (p ? "/" + p : ""),
              )?.[1] ?? "Intelligence"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="dataset-badge">
              <i />
              {meta?.mode === "sample"
                ? "REAL TLC SAMPLE"
                : meta
                  ? "HISTORICAL DATA"
                  : "DATA NOT LOADED"}
            </span>
            <button
              className="icon-button settings-toggle"
              aria-label="Experience settings"
              onClick={() => setSettings(!settings)}
            >
              <SlidersHorizontal size={15} />
            </button>
            <span className="avatar">UP</span>
          </div>
        </header>
        <main>
          <section className="filterbar" aria-label="Global filters">
            <div className="date-fields">
              <label>
                From
                <input
                  aria-label="Start date"
                  type="date"
                  value={filters.start}
                  min={meta?.start.slice(0, 10)}
                  max={filters.end || meta?.end.slice(0, 10)}
                  onChange={(e) => setFilters({ start: e.target.value })}
                />
              </label>
              <span>—</span>
              <label>
                To
                <input
                  aria-label="End date"
                  type="date"
                  value={filters.end}
                  min={filters.start || meta?.start.slice(0, 10)}
                  max={meta?.end.slice(0, 10)}
                  onChange={(e) => setFilters({ end: e.target.value })}
                />
              </label>
            </div>
            <label>
              Borough
              <select
                aria-label="Borough"
                value={filters.borough}
                onChange={(e) =>
                  setFilters({ borough: e.target.value, zone: "" })
                }
              >
                <option value="">All boroughs</option>
                {[
                  "Manhattan",
                  "Brooklyn",
                  "Queens",
                  "Bronx",
                  "Staten Island",
                  "EWR",
                ].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Zone
              <select
                aria-label="Zone"
                value={filters.zone}
                onChange={(e) => setFilters({ zone: e.target.value })}
              >
                <option value="">All zones</option>
                {zones
                  .filter(
                    (z) => !filters.borough || z.borough === filters.borough,
                  )
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Day type
              <select
                aria-label="Day type"
                value={filters.day_type}
                onChange={(e) => setFilters({ day_type: e.target.value })}
              >
                <option value="all">Every day</option>
                <option value="weekday">Weekday</option>
                <option value="weekend">Weekend</option>
              </select>
            </label>
            <label>
              Hours
              <div className="hour-fields">
                <select
                  aria-label="First hour"
                  value={filters.hour_start}
                  onChange={(e) =>
                    setFilters({
                      hour_start: e.target.value,
                      hour_end: String(
                        Math.max(+filters.hour_end, +e.target.value),
                      ),
                    })
                  }
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span>–</span>
                <select
                  aria-label="Last hour"
                  value={filters.hour_end}
                  onChange={(e) => setFilters({ hour_end: e.target.value })}
                >
                  {Array.from(
                    { length: 24 },
                    (_, i) =>
                      i >= +filters.hour_start && (
                        <option key={i} value={i}>
                          {String(i).padStart(2, "0")}
                        </option>
                      ),
                  )}
                </select>
              </div>
            </label>
            <label>
              Demand
              <select
                aria-label="Demand direction"
                value={filters.direction}
                onChange={(e) => setFilters({ direction: e.target.value })}
              >
                <option value="pickup">Pickup</option>
                <option value="dropoff">Drop-off</option>
              </select>
            </label>
            <button
              className="reset-filter"
              onClick={() => setFilters(defaultFilters)}
            >
              Reset
            </button>
          </section>
          <div className="period-line">
            {meta
              ? `${meta.start.slice(0, 10)} — ${meta.end.slice(0, 10)} · America/New_York`
              : "Connect a processed dataset to begin"}
            {meta?.mode === "sample" && (
              <span>Sample counts only · not full city demand</span>
            )}
          </div>
          {settings && (
            <section className="settings panel">
              <h3>Experience settings</h3>
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />{" "}
                Reduce motion
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={low}
                  onChange={(e) => setLow(e.target.checked)}
                />{" "}
                Reduced effects / 2D charts
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={contrast}
                  onChange={(e) => setContrast(e.target.checked)}
                />{" "}
                High contrast
              </label>
              <button onClick={() => setSettings(false)}>Done</button>
            </section>
          )}
          <Outlet />
          <footer>
            URBANPULSE <span>Measured data. Meaningful movement.</span>
            <a href={"/api/export/pdf?" + parameters(filters)}>
              <Download size={13} /> PDF summary
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
