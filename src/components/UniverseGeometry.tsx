import { useState, useRef, useMemo } from "react";
import { Canvas, useFrame, extend, Object3DNode } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";

// Register Three.js Line_ to avoid conflict with SVG <line>
extend({ Line_: THREE.Line });

declare module "@react-three/fiber" {
  interface ThreeElements {
    line_: Object3DNode<THREE.Line, typeof THREE.Line>;
  }
}

/* ─── Flat Grid ─── */
function FlatGrid({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });

  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    const size = 4;
    const divisions = 16;
    const step = (size * 2) / divisions;
    const color = new THREE.Color("hsl(187, 80%, 55%)");

    for (let i = 0; i <= divisions; i++) {
      const pos = -size + i * step;
      // X lines
      const xGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos, 0, -size),
        new THREE.Vector3(pos, 0, size),
      ]);
      // Z lines
      const zGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, 0, pos),
        new THREE.Vector3(size, 0, pos),
      ]);
      lines.push(
        <line_ key={`x-${i}`} geometry={xGeo}>
          <lineBasicMaterial color={color} transparent opacity={0.35} />
        </line_>,
        <line_ key={`z-${i}`} geometry={zGeo}>
          <lineBasicMaterial color={color} transparent opacity={0.35} />
        </line_>
      );
    }
    return lines;
  }, []);

  if (!visible) return null;

  return (
    <group ref={ref}>
      {gridLines}
      {/* Particles on flat surface */}
      <FlatParticles />
    </group>
  );
}

function FlatParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 7;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="hsl(45, 90%, 65%)" transparent opacity={0.8} />
    </points>
  );
}

/* ─── Closed S³ Sphere ─── */
function ClosedSphere({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.15;
    if (wireRef.current) {
      wireRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.03);
    }
  });

  if (!visible) return null;

  return (
    <group ref={ref}>
      {/* Main wireframe sphere */}
      <mesh ref={wireRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="hsl(270, 70%, 60%)" wireframe transparent opacity={0.25} />
      </mesh>
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[2.4, 32, 32]} />
        <meshBasicMaterial color="hsl(270, 60%, 40%)" transparent opacity={0.08} />
      </mesh>
      {/* Great circles to show S³ structure */}
      <GreatCircle axis="x" />
      <GreatCircle axis="y" />
      <GreatCircle axis="z" />
      {/* Particles on sphere surface */}
      <SphereParticles />
    </group>
  );
}

function GreatCircle({ axis }: { axis: "x" | "y" | "z" }) {
  const geo = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      if (axis === "x") points.push(new THREE.Vector3(0, Math.cos(t) * 2.5, Math.sin(t) * 2.5));
      if (axis === "y") points.push(new THREE.Vector3(Math.cos(t) * 2.5, 0, Math.sin(t) * 2.5));
      if (axis === "z") points.push(new THREE.Vector3(Math.cos(t) * 2.5, Math.sin(t) * 2.5, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [axis]);

  const colors: Record<string, string> = {
    x: "hsl(187, 80%, 55%)",
    y: "hsl(270, 70%, 60%)",
    z: "hsl(45, 90%, 65%)",
  };

  return (
    <line geometry={geo}>
      <lineBasicMaterial color={colors[axis]} transparent opacity={0.6} />
    </line>
  );
}

function SphereParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 300;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="hsl(45, 90%, 65%)" transparent opacity={0.7} />
    </points>
  );
}

/* ─── Main Component ─── */
const UniverseGeometry = () => {
  const [mode, setMode] = useState<"flat" | "closed">("flat");

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setMode("flat")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "flat"
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-card/30 text-muted-foreground border border-border hover:bg-card/50"
          }`}
        >
          Flat (Euclidean)
        </button>
        <button
          onClick={() => setMode("closed")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "closed"
              ? "bg-secondary/20 text-secondary border border-secondary/40"
              : "bg-card/30 text-muted-foreground border border-border hover:bg-card/50"
          }`}
        >
          Closed (S³)
        </button>
      </div>

      {/* 3D Canvas */}
      <motion.div
        className="rounded-xl border border-border bg-card/20 backdrop-blur-sm overflow-hidden"
        style={{ height: 400 }}
        whileInView={{ opacity: [0, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <Canvas camera={{ position: [0, 3, 7], fov: 50 }}>
          <ambientLight intensity={0.3} />
          <FlatGrid visible={mode === "flat"} />
          <ClosedSphere visible={mode === "closed"} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
        </Canvas>
      </motion.div>

      {/* Description */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border border-border bg-card/30 p-5 text-center max-w-xl mx-auto"
      >
        {mode === "flat" ? (
          <>
            <h4 className="text-sm font-bold gradient-text-cyan mb-2">Flat Euclidean Space</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In flat space, parallel lines never meet and gravity weakens indefinitely with distance.
              Particles can escape to infinity — there's no natural boundary or coherence scale.
            </p>
          </>
        ) : (
          <>
            <h4 className="text-sm font-bold gradient-text-purple mb-2">Closed S³ Geometry</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In a closed 3-sphere, space wraps back on itself. Vacuum fluctuations can't escape —
              they reinforce, creating a coherent gravitational background. This is the origin of the
              emergent regime and the critical acceleration g<sub>crit</sub>.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default UniverseGeometry;
