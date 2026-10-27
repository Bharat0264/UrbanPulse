import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Expand, RotateCcw } from "lucide-react";
import { number, useAPI } from "../../services/api";
import { usePreferences } from "../../hooks/context";
import { State } from "../layout/UI";
import type { Row } from "../../types";

// Vite needs an explicit module worker URL for MapLibre 6; its default worker
// lookup works in a CDN build but resolves to no file in this local bundle.
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
);

type Feature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

const emptyCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

const MAP_BOUNDS = { west: -74.28, east: -73.68, north: 40.93, south: 40.48 };

function project(point: unknown) {
  const [longitude, latitude] = point as [number, number];
  return [
    ((longitude - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 1000,
    ((MAP_BOUNDS.north - latitude) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 720,
  ];
}

function ringPath(ring: unknown) {
  return (ring as unknown[])
    .map((point, index) => {
      const [x, y] = project(point);
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

function geometryPath(geometry: unknown) {
  const shape = geometry as { type?: string; coordinates?: unknown };
  if (shape.type === "Polygon")
    return (shape.coordinates as unknown[]).map(ringPath).join(" ");
  if (shape.type === "MultiPolygon")
    return (shape.coordinates as unknown[])
      .flatMap((polygon) => (polygon as unknown[]).map(ringPath))
      .join(" ");
  return "";
}

export default function GeoMap({
  zones,
  flows = [],
  compact = false,
}: {
  zones: Row[];
  flows?: Row[];
  compact?: boolean;
}) {
  const { data, error, isLoading } =
    useAPI<FeatureCollection>("/geo/taxi-zones");
  const { setFilters, filters, low } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [flat, setFlat] = useState(low);
  const [showFlows, setFlows] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const max = Math.max(1, ...zones.map((zone) => zone.trips));
  const total = zones.reduce((sum, zone) => sum + zone.trips, 0);
  const demand = useMemo<FeatureCollection>(() => {
    if (!data) return emptyCollection();
    const byId = new Map(zones.map((zone) => [zone.zone, zone]));
    return {
      type: "FeatureCollection",
      features: data.features.flatMap((feature: any) => {
        const zone = byId.get(feature.properties.id);
        if (!zone) return [];
        const intensity = zone.trips / max;
        return [
          {
            type: "Feature" as const,
            geometry: feature.geometry,
            properties: {
              ...feature.properties,
              trips: zone.trips,
              elevation: intensity * 1800,
              color:
                filters.zone === String(feature.properties.id)
                  ? "#ff986b"
                  : intensity > 0.7
                    ? "#35d9ff"
                    : intensity > 0.35
                      ? "#277eaa"
                      : "#1c4c72",
            },
          },
        ];
      }),
    };
  }, [data, zones, max, filters.zone]);

  const flowCollection = useMemo<FeatureCollection>(() => {
    if (!data || !showFlows) return emptyCollection();
    const centroids = new Map(
      data.features.map((feature: any) => [
        feature.properties.id,
        feature.properties.centroid,
      ]),
    );
    return {
      type: "FeatureCollection",
      features: flows.flatMap((flow) => {
        const origin = centroids.get(flow.origin);
        const destination = centroids.get(flow.destination);
        if (!origin || !destination) return [];
        return [
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString",
              coordinates: [origin, destination],
            },
            properties: {
              origin_name: flow.origin_name,
              destination_name: flow.destination_name,
              trips: flow.trips,
            },
          },
        ];
      }),
    };
  }, [data, flows, showFlows]);

  useEffect(() => {
    if (!container.current || !data || map.current) return;
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            demand: { type: "geojson", data: demand as any },
            flows: { type: "geojson", data: flowCollection as any },
          },
          layers: [
            {
              id: "demand-fill",
              type: "fill-extrusion",
              source: "demand",
              paint: {
                "fill-extrusion-color": ["get", "color"],
                "fill-extrusion-height": ["get", "elevation"],
                "fill-extrusion-base": 0,
                "fill-extrusion-opacity": 0.84,
              },
            },
            {
              id: "demand-surface",
              type: "fill",
              source: "demand",
              paint: {
                "fill-color": ["get", "color"],
                "fill-opacity": 0.54,
              },
            },
            {
              id: "demand-outline",
              type: "line",
              source: "demand",
              paint: {
                "line-color": "#6fd1ec",
                "line-width": 0.65,
                "line-opacity": 0.8,
              },
            },
            {
              id: "flows-layer",
              type: "line",
              source: "flows",
              paint: {
                "line-color": "#a978ff",
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["get", "trips"],
                  0,
                  1,
                  4000,
                  6,
                ],
                "line-opacity": 0.68,
              },
            },
          ],
        },
        center: [-73.965, 40.745],
        zoom: 10.7,
        pitch: flat ? 0 : 48,
        bearing: -25,
        attributionControl: false,
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl(), "top-right");
      instance.addControl(
        new maplibregl.AttributionControl({
          customAttribution:
            "NYC TLC taxi zone boundaries · no external basemap",
        }),
      );
      instance.on("load", () => {
        (instance.getSource("demand") as maplibregl.GeoJSONSource).setData(demand as any);
        (instance.getSource("flows") as maplibregl.GeoJSONSource).setData(flowCollection as any);
        setMapReady(true);
      });
      instance.on("error", (event) => {
        if (event.error) setMapError(event.error.message);
      });
      instance.on("click", "demand-fill", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setFilters({ zone: String(id) });
      });
      instance.on("mouseenter", "demand-fill", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "demand-fill", () => {
        instance.getCanvas().style.cursor = "";
      });
      instance.on("mousemove", "demand-fill", (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 10,
        })
          .setLngLat(event.lngLat)
          .setHTML(
            `<strong>${properties.name}</strong><br>${number(Number(properties.trips))} ${filters.direction} trips`,
          )
          .addTo(instance);
      });
      return () => {
        instance.remove();
        map.current = null;
      };
    } catch (cause) {
      setMapError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [data, flat, filters.direction, setFilters]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    (
      instance.getSource("demand") as maplibregl.GeoJSONSource | undefined
    )?.setData(demand as any);
    (
      instance.getSource("flows") as maplibregl.GeoJSONSource | undefined
    )?.setData(flowCollection as any);
    instance.easeTo({ pitch: flat ? 0 : 48, duration: 400 });
  }, [demand, flowCollection, flat, mapReady]);

  return (
    <div className={`map-wrap ${compact ? "compact" : ""}`}>
      <State loading={isLoading} error={error}>
        {mapError ? (
          <div className="state error">
            <strong>The map renderer could not start.</strong>
            <p>{mapError}</p>
            <p>
              Use the zone comparison and connection tables below while WebGL is
              unavailable.
            </p>
          </div>
        ) : (
          <>
            <div
              ref={container}
              className="geo-canvas"
              aria-label="Interactive NYC demand map"
            />
            <svg
              className="geo-fallback"
              viewBox="0 0 1000 720"
              preserveAspectRatio="xMidYMid slice"
              role="img"
              aria-label="NYC taxi-zone demand map"
            >
              <rect width="1000" height="720" fill="#09121f" />
              <g className="geo-grid" aria-hidden="true">
                {[160, 320, 480, 640, 800].map((x) => (
                  <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="720" />
                ))}
                {[144, 288, 432, 576].map((y) => (
                  <line key={`y-${y}`} x1="0" y1={y} x2="1000" y2={y} />
                ))}
              </g>
              {demand.features.map((feature) => {
                const props = feature.properties;
                const id = String(props.id ?? "");
                return (
                  <path
                    key={id}
                    className="geo-zone"
                    data-zone-id={id}
                    d={geometryPath(feature.geometry)}
                    fill={String(props.color)}
                    fillRule="evenodd"
                    opacity={id === filters.zone ? 1 : 0.82}
                    onClick={() => setFilters({ zone: id })}
                  >
                    <title>{`${props.name}: ${number(Number(props.trips))} ${filters.direction} trips`}</title>
                  </path>
                );
              })}
              {showFlows &&
                flowCollection.features.map((feature, index) => {
                  const coordinates = (feature.geometry as any).coordinates as unknown[];
                  const [x1, y1] = project(coordinates[0]);
                  const [x2, y2] = project(coordinates[1]);
                  return (
                    <line
                      key={`${String(feature.properties.origin_name)}-${index}`}
                      className="geo-flow"
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                    />
                  );
                })}
            </svg>
            <div className="map-tools">
              <button onClick={() => setFlat((value) => !value)}>
                {flat ? "Enable 3D" : "2D view"}
              </button>
              <button
                aria-pressed={showFlows}
                onClick={() => setFlows((value) => !value)}
              >
                Flows {showFlows ? "on" : "off"}
              </button>
              <button
                className="icon-button"
                title="Reset camera"
                onClick={() =>
                  map.current?.flyTo({
                    center: [-73.965, 40.745],
                    zoom: 10.7,
                    bearing: -25,
                    pitch: flat ? 0 : 48,
                  })
                }
              >
                <RotateCcw size={15} />
              </button>
              <button
                className="icon-button"
                title="Full screen map"
                onClick={() =>
                  container.current?.parentElement?.requestFullscreen?.()
                }
              >
                <Expand size={15} />
              </button>
            </div>
            <div className="map-caption">
              <span className="live-dot" /> NYC /{" "}
              {filters.direction.toUpperCase()} DEMAND
              <br />
              <small>
                {number(total)} trips · {zones.length} zones
              </small>
            </div>
            <div className="map-legend">
              <span>0</span>
              <i />
              <span>{number(max)} trips</span>
              <small>Height: 0–1,800 m display scale, linear in trips</small>
            </div>
            {showFlows && (
              <div className="flow-label">
                Straight centroid connections, not road routes · origin →
                destination
              </div>
            )}
          </>
        )}
      </State>
    </div>
  );
}
