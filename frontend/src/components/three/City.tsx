import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Stars } from "@react-three/drei";
import {
  useMemo,
  useRef,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { usePreferences } from "../../hooks/context";
import { supportsWebGL } from "../../utils/webgl";
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        3D unavailable · Explore the accessible analytical charts below.
      </div>
    ) : (
      this.props.children
    );
  }
}
function CityGeometry({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const blocks = useMemo(
    () =>
      Array.from({ length: 420 }, (_, i) => {
        const x = ((i % 14) - 7) * 0.48,
          z = (Math.floor(i / 14) - 15) * 0.37;
        const v = (Math.sin(i * 72.13) * 43758.5453) % 1;
        return {
          x,
          z,
          h: 0.12 + Math.abs(v) * (0.45 + 1.7 * Math.exp(-(x * x + z * z) / 7)),
        };
      }),
    [],
  );
  useEffect(() => {
    const obj = new THREE.Object3D();
    blocks.forEach((b, i) => {
      obj.position.set(b.x, b.h / 2, b.z);
      obj.scale.set(0.28, b.h, 0.24);
      obj.updateMatrix();
      mesh.current.setMatrixAt(i, obj.matrix);
      mesh.current.setColorAt(
        i,
        new THREE.Color(
          i % 9 === 0 ? "#35d9ff" : i % 13 === 0 ? "#8b5cf6" : "#18334a",
        ),
      );
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [blocks]);
  useFrame(({ clock, pointer }) => {
    if (!reduced) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        pointer.x * 0.08,
        0.025,
      );
      group.current.position.y = Math.sin(clock.elapsedTime * 0.3) * 0.025;
    }
  });
  return (
    <group ref={group} rotation={[0, 0.3, 0]}>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[7.4, 0.18, 12.2]} />
        <meshStandardMaterial color="#0b1e2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, 420]}>
        <boxGeometry />
        <meshStandardMaterial metalness={0.5} roughness={0.25} />
      </instancedMesh>
      <gridHelper
        args={[15, 45, "#236174", "#152a3b"]}
        position={[0, -0.025, 0]}
      />
      {Array.from({ length: 9 }, (_, i) => {
        const a = new THREE.Vector3(((i % 3) - 1) * 2, 0.25, i - 4),
          b = new THREE.Vector3(1.8, 0.3, 3 - i * 0.65);
        const mid = a.clone().lerp(b, 0.5);
        mid.y = 1.5 + i * 0.15;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        return (
          <Line
            key={i}
            points={curve.getPoints(40)}
            color={i % 2 ? "#8b5cf6" : "#35d9ff"}
            lineWidth={1.3}
            transparent
            opacity={0.55}
          />
        );
      })}
    </group>
  );
}
export default function City() {
  const { reduced, low } = usePreferences();
  const parent = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) =>
      setVisible(e.isIntersecting),
    );
    if (parent.current) observer.observe(parent.current);
    return () => observer.disconnect();
  }, []);
  if (low || !supportsWebGL())
    return (
      <div className="scene-fallback city-wire">
        <span>URBANPULSE / LOW EFFECTS MODE</span>
        <p>City geometry paused. All analytical views remain available.</p>
      </div>
    );
  return (
    <div ref={parent} className="city-canvas">
      <Boundary>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [10, 8, 11], fov: 40 }}
          frameloop={!visible || reduced ? "demand" : "always"}
        >
          <color attach="background" args={["#070a12"]} />
          <fog attach="fog" args={["#070a12", 15, 32]} />
          <ambientLight intensity={1.2} />
          <directionalLight
            position={[5, 12, 5]}
            intensity={3}
            color="#8dcfff"
          />
          <pointLight position={[-4, 3, -1]} intensity={30} color="#8b5cf6" />
          <CityGeometry reduced={reduced} />
          <Stars
            radius={60}
            depth={20}
            count={600}
            factor={2}
            fade
            speed={reduced ? 0 : 0.15}
          />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={0.4}
            maxPolarAngle={1.3}
            autoRotate={!reduced}
            autoRotateSpeed={0.18}
          />
        </Canvas>
      </Boundary>
    </div>
  );
}
