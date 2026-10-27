import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { useState } from "react";
import type { Row } from "../../types";
import { number } from "../../services/api";
export default function DemandBars({
  rows,
  landscape = false,
  onSelect,
}: {
  rows: Row[];
  landscape?: boolean;
  onSelect?: (r: Row) => void;
}) {
  const [hover, setHover] = useState<Row | null>(null);
  const [normalized, setNormalized] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.trips));
  return (
    <div className="bars-scene">
      <button className="bar-mode" onClick={() => setNormalized(!normalized)}>
        {normalized ? "Show absolute trips" : "Normalize to peak"}
      </button>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: landscape ? [17, 13, 17] : [12, 8, 14], fov: 45 }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[2, 10, 3]} intensity={3} />
        <group position={[-5, 0, landscape ? -3 : 0]}>
          {rows.map((r, i) => {
            const x = landscape ? r.hour * 0.45 : i * 0.9,
              z = landscape ? (r.day - 1) * 0.9 : 0,
              h = (r.trips / max) * 5;
            return (
              <mesh
                key={i}
                position={[x, h / 2, z]}
                onPointerOver={() => setHover(r)}
                onPointerOut={() => setHover(null)}
                onClick={() => onSelect?.(r)}
              >
                <boxGeometry
                  args={[landscape ? 0.32 : 0.58, Math.max(0.003, h), 0.55]}
                />
                <meshStandardMaterial
                  color={
                    hover === r ? "#ff986b" : landscape ? "#8b5cf6" : "#35d9ff"
                  }
                  metalness={0.3}
                  roughness={0.25}
                />
              </mesh>
            );
          })}
          <Line
            points={[
              [0, 0, 0],
              [0, 5, 0],
            ]}
            color="#94a3b8"
          />
          {[0, 0.5, 1].map((v) => (
            <Html key={v} position={[-0.6, v * 5, 0]}>
              <span className="axis-label">
                {normalized ? `${v * 100}%` : number(max * v)}
              </span>
            </Html>
          ))}
        </group>
        <gridHelper args={[20, 20, "#2b4655", "#182a3b"]} />
        <OrbitControls minPolarAngle={0.2} maxPolarAngle={1.45} />
      </Canvas>
      <div className="bars-caption">
        {hover ? (
          <strong>
            {hover.name ??
              `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][hover.day - 1]} ${hover.hour}:00`}{" "}
            · {number(hover.trips)} trips
          </strong>
        ) : (
          <span>
            Drag to orbit · hover for values
            {onSelect ? " · click to select" : ""}
          </span>
        )}
        <small>
          {landscape
            ? "X: hour (0–23) · depth: Monday–Sunday · vertical: trips"
            : "X: zones ordered by demand · vertical: trips (zero baseline)"}
        </small>
      </div>
    </div>
  );
}
