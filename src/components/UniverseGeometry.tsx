import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, extend, Object3DNode } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { KField3D, KFieldParticle, stepParticles3D, depositMass3D, FIELD_CONSTANTS } from "@/lib/kfield-physics";
import DiagnosticsPanel, { computeDiagnostics, DiagnosticsData } from "./DiagnosticsPanel";

extend({ Line_: THREE.Line });

declare module "@react-three/fiber" {
  interface ThreeElements {
    line_: Object3DNode<THREE.Line, typeof THREE.Line>;
  }
}

// ─── K-Field driven particle system ───
function KFieldParticles({
  mode,
  centralMass,
  onDiag,
}: {
  mode: "flat" | "closed";
  centralMass: number;
  onDiag: (d: DiagnosticsData) => void;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const GRID_N = 16; // Keep small for performance
  const GRID_SIZE = 8;
  const NUM_PARTICLES = 200;
  const DT = 0.01;

  const simRef = useRef<{
    field: KField3D;
    particles: KFieldParticle[];
  } | null>(null);

  // Initialize simulation
  useMemo(() => {
    const periodic = mode === "closed";
    const field = new KField3D(GRID_N, GRID_SIZE, periodic, {
      ...FIELD_CONSTANTS,
      c: periodic ? 1.2 : 0.3,
      mu2: periodic ? 1.5 : 0.2,
      H0: periodic ? 0.08 : 0.02,
    });

    const particles: KFieldParticle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      if (periodic) {
        // Distribute on sphere surface
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2.5 + (Math.random() - 0.5) * 0.5;
        particles.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          vz: (Math.random() - 0.5) * 0.1,
          mass: 0.01,
        });
      } else {
        // Flat distribution
        particles.push({
          x: (Math.random() - 0.5) * 7,
          y: (Math.random() - 0.5) * 0.3,
          z: (Math.random() - 0.5) * 7,
          vx: (Math.random() - 0.5) * 0.05,
          vy: 0,
          vz: (Math.random() - 0.5) * 0.05,
          mass: 0.01,
        });
      }
    }

    // Pre-evolve field
    const density = depositMass3D(particles, field, centralMass);
    for (let i = 0; i < 50; i++) {
      field.step(DT, density);
    }

    simRef.current = { field, particles };
  }, [mode, centralMass]);

  // Positions buffer
  const positions = useMemo(() => new Float32Array(NUM_PARTICLES * 3), []);

  useFrame(() => {
    const sim = simRef.current;
    if (!sim || !pointsRef.current) return;

    // Physics step
    const density = depositMass3D(sim.particles, sim.field, centralMass);
    sim.field.step(DT, density);
    stepParticles3D(sim.particles, sim.field, DT, FIELD_CONSTANTS.beta * 0.5);

    // Boundary: clamp particles
    const limit = GRID_SIZE * 0.45;
    for (const p of sim.particles) {
      const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (r > limit) {
        const s = limit / r;
        p.x *= s; p.y *= s; p.z *= s;
        // Reflect velocity inward
        const dot = (p.vx * p.x + p.vy * p.y + p.vz * p.z) / (r * r);
        if (dot > 0) {
          p.vx -= 2 * dot * p.x;
          p.vy -= 2 * dot * p.y;
          p.vz -= 2 * dot * p.z;
        }
      }
      // Damping for stability
      p.vx *= 0.999;
      p.vy *= 0.999;
      p.vz *= 0.999;
    }

    // Update buffer
    for (let i = 0; i < sim.particles.length; i++) {
      positions[i * 3] = sim.particles[i].x;
      positions[i * 3 + 1] = sim.particles[i].y;
      positions[i * 3 + 2] = sim.particles[i].z;
    }

    const attr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={NUM_PARTICLES}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color={mode === "closed" ? "hsl(270, 70%, 70%)" : "hsl(187, 80%, 65%)"}
        transparent
        opacity={0.8}
      />
    </points>
  );
}

/* ─── Visual scaffolding (grid / sphere wireframe) ─── */
function FlatGrid({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null);

  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    const size = 4;
    const divisions = 16;
    const step = (size * 2) / divisions;
    const color = new THREE.Color("hsl(187, 80%, 55%)");

    for (let i = 0; i <= divisions; i++) {
      const pos = -size + i * step;
      const xGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos, 0, -size),
        new THREE.Vector3(pos, 0, size),
      ]);
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
  return <group ref={ref}>{gridLines}</group>;
}

function ClosedSphere({ visible }: { visible: boolean }) {
  const wireRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (wireRef.current) {
      wireRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.03);
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={wireRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="hsl(270, 70%, 60%)" wireframe transparent opacity={0.2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.4, 32, 32]} />
        <meshBasicMaterial color="hsl(270, 60%, 40%)" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

/* ─── Main Component ─── */
const UniverseGeometry = () => {
  const [mode, setMode] = useState<"flat" | "closed">("flat");

  return (
    <div className="space-y-6">
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
          <KFieldParticles mode={mode} centralMass={5} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </motion.div>

      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border border-border bg-card/30 p-5 text-center max-w-xl mx-auto"
      >
        {mode === "flat" ? (
          <>
            <h4 className="text-sm font-bold gradient-text-cyan mb-2">Flat K-Field</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In flat space, the K-field weakens with distance (μ² restoring is weak).
              Particles disperse — no emergent coherence. Force F = −β∇K vanishes at large r.
            </p>
          </>
        ) : (
          <>
            <h4 className="text-sm font-bold gradient-text-purple mb-2">Closed S³ K-Field</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In closed geometry, periodic boundaries create standing K-field modes.
              Vacuum fluctuations reinforce → coherent ∇K emerges → g<sub>crit</sub> appears naturally.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default UniverseGeometry;
