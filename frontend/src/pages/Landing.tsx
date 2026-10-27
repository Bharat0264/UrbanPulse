import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  ArrowDown,
  Database,
  Layers,
  ScanLine,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePreferences } from "../hooks/context";
import { useAPI, number } from "../services/api";
import type { Metadata } from "../types";
const City = lazy(() => import("../components/three/City"));
gsap.registerPlugin(ScrollTrigger);
export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const { reduced, setReduced } = usePreferences();
  const { data } = useAPI<Metadata>("/dataset/metadata");
  useLayoutEffect(() => {
    if (reduced) return;
    const context = gsap.context(() => {
      gsap.from(".hero-copy > *", {
        y: 25,
        opacity: 0,
        duration: 1,
        stagger: 0.12,
        ease: "power3.out",
      });
      gsap.to(".hero-scene", {
        y: 90,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      gsap.from(".story-section > *", {
        y: 40,
        opacity: 0,
        stagger: 0.15,
        scrollTrigger: { trigger: ".story-section", start: "top 85%" },
      });
    }, root);
    return () => context.revert();
  }, [reduced]);
  return (
    <div ref={root} className="landing">
      <nav className="landing-nav">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Activity size={22} />
          </span>
          <span>
            urban<span className="brand-light">pulse</span>
          </span>
        </Link>
        <div>
          <button className="text-button" onClick={() => setReduced(!reduced)}>
            {reduced ? "Motion off" : "Reduce motion"}
          </button>
          <Link to="/app" className="nav-enter">
            Skip intro <ArrowUpRight size={15} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-scene">
          <Suspense
            fallback={
              <div className="scene-fallback">Initializing city geometry…</div>
            }
          >
            <City />
          </Suspense>
        </div>
        <div className="hero-shade" />
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="live-dot" /> BIG DATA INTELLIGENCE PLATFORM
          </div>
          <h1>
            Cities Move.
            <br />
            Data Reveals <em>Why.</em>
          </h1>
          <p>
            Explore millions of mobility records through immersive
            visualization, geographic intelligence, and predictive analytics.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/app">
              Enter Intelligence Dashboard <ArrowUpRight size={19} />
            </Link>
            <a className="secondary-button" href="#data">
              Explore the Data <ArrowDown size={17} />
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{data ? number(data.cleaned_rows) : "NYC"}</strong>
              <span>
                {data?.mode === "sample"
                  ? "REAL TLC SAMPLE TRIPS"
                  : data
                    ? "VALIDATED TRIPS"
                    : "YELLOW TAXI RECORDS"}
              </span>
            </div>
            <div>
              <strong>263</strong>
              <span>OFFICIAL TAXI ZONES</span>
            </div>
            <div>
              <strong>01</strong>
              <span>CONNECTED CITY</span>
            </div>
          </div>
        </div>
        <div className="scene-tag">
          <span className="live-dot" /> DIGITAL CITY / NEW YORK INSPIRED
          <small>Interactive stylized geometry · not a geographic map</small>
        </div>
        <div className="hero-bottom">
          <span>40.7128° N / 74.0060° W</span>
          <span>SCROLL TO DISCOVER ↓</span>
          <span>DATA IN MOTION. INSIGHT IN FOCUS.</span>
        </div>
      </section>
      <section id="data" className="story-section">
        <div>
          <span className="eyebrow">BENEATH EVERY JOURNEY, A PATTERN.</span>
          <h2>
            A new perspective
            <br />
            on a city in motion<span className="cyan">.</span>
          </h2>
          <p>
            From raw records to the next hour of demand. Follow the entire
            analytical journey, with every number traceable to its source.
          </p>
        </div>
        <div className="story-grid">
          {[
            [
              Database,
              "01 / PROCESS",
              "Millions of trips. One clear picture.",
              "Apache Spark cleans and aggregates official NYC taxi records. Explore the processing ledger.",
              "spark",
            ],
            [
              Layers,
              "02 / EXPLORE",
              "See movement take shape.",
              "Real taxi-zone boundaries, interactive demand extrusions, and aggregate connections.",
              "geo",
            ],
            [
              ScanLine,
              "03 / ANTICIPATE",
              "Meet the next hour.",
              "A trained Random Forest compared with a seasonal baseline, on held-out historical data.",
              "predict",
            ],
          ].map(([Icon, n, t, d, path]: any) => (
            <Link to={"/app/" + path} className="story-feature" key={n}>
              <Icon size={25} />
              <span className="eyebrow">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <ArrowUpRight className="feature-arrow" />
            </Link>
          ))}
        </div>
      </section>
      <footer>
        URBANPULSE <span>Urban mobility, understood.</span>
        <Link to="/app">Open workspace ↗</Link>
      </footer>
    </div>
  );
}
