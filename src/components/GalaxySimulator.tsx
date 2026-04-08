import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  RadialKField,
  KFieldParticle,
  stepParticlesRadial,
  depositMassRadial,
  FIELD_CONSTANTS,
} from "@/lib/kfield-physics";
import DiagnosticsPanel, { computeDiagnostics, DiagnosticsData } from "./DiagnosticsPanel";

const GalaxySimulator = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(50);
  const [showEmergent, setShowEmergent] = useState(false);
  const [diag, setDiag] = useState<DiagnosticsData>({ kineticEnergy: 0, fieldEnergy: 0, totalEnergy: 0, avgVelocity: 0, avgRadius: 0, radialDispersion: 0 });
  const animRef = useRef<number>(0);
  const frameCount = useRef(0);

  // Simulation state persisted across renders via ref
  const simRef = useRef<{
    field: RadialKField;
    particles: KFieldParticle[];
    initialized: boolean;
  }>({ field: null!, particles: [], initialized: false });

  const GRID_N = 128;
  const R_MAX = 20; // simulation units
  const NUM_STARS = 200;
  const DT = 0.008;

  const initSim = useCallback(() => {
    const params = showEmergent
      ? { ...FIELD_CONSTANTS }
      : { ...FIELD_CONSTANTS, alpha: 0, mu2: 0, c: 0, H0: 0 }; // pure Newtonian-like: no field dynamics

    const field = new RadialKField(GRID_N, R_MAX, params);
    const particles: KFieldParticle[] = [];

    // Create stars in spiral arms
    const arms = 2;
    const starsPerArm = NUM_STARS / arms;
    for (let arm = 0; arm < arms; arm++) {
      const armOffset = (arm * Math.PI * 2) / arms;
      for (let i = 0; i < starsPerArm; i++) {
        const t = (i + 1) / starsPerArm;
        const r = 1 + t * (R_MAX * 0.8);
        const angle = armOffset + t * 3 + (Math.random() - 0.5) * 0.3;

        // Initial circular velocity estimate
        const v0 = Math.sqrt(mass * 0.5 / (r + 0.1));
        particles.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: 0,
          vx: -Math.sin(angle) * v0,
          vy: Math.cos(angle) * v0,
          vz: 0,
          mass: 0.001,
        });
      }
    }

    // Seed the field with mass to create initial gradient
    const density = depositMassRadial(particles, mass, field);
    // Pre-evolve field to quasi-equilibrium
    for (let i = 0; i < 200; i++) {
      field.step(DT, density);
    }

    simRef.current = { field, particles, initialized: true };
  }, [mass, showEmergent]);

  const drawGalaxy = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sim = simRef.current;
    if (!sim.initialized) return;

    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / (R_MAX * 2.2);

    // Core glow
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    coreGrad.addColorStop(0, "hsla(45, 90%, 70%, 0.8)");
    coreGrad.addColorStop(0.3, "hsla(45, 80%, 55%, 0.3)");
    coreGrad.addColorStop(1, "transparent");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    // Draw particles
    for (const p of sim.particles) {
      const sx = cx + p.x * scale;
      const sy = cy + p.y * scale * 0.6; // tilt
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      const t = r / R_MAX;

      const hue = t < 0.3 ? 45 : t < 0.6 ? 200 : 220;
      const brightness = Math.max(0.3, 1 - t * 0.7);
      const size = Math.max(0.8, (1 - t * 0.5) * 1.8);

      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${brightness})`;
      ctx.fill();
    }
  }, []);

  const drawGraph = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sim = simRef.current;
    if (!sim.initialized) return;

    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 20, bottom: 40, left: 55 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    // Axes
    ctx.strokeStyle = "hsla(220, 15%, 40%, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + gh);
    ctx.lineTo(pad.left + gw, pad.top + gh);
    ctx.stroke();

    ctx.fillStyle = "hsla(220, 15%, 55%, 1)";
    ctx.font = "11px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("Radius", pad.left + gw / 2, h - 5);
    ctx.save();
    ctx.translate(12, pad.top + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Velocity", 0, 0);
    ctx.restore();

    // Bin particles by radius to get velocity profile
    const bins = 30;
    const binSize = R_MAX / bins;
    const vAvg = new Float64Array(bins);
    const counts = new Float64Array(bins);

    for (const p of sim.particles) {
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const bi = Math.min(Math.floor(r / binSize), bins - 1);
      vAvg[bi] += v;
      counts[bi]++;
    }

    let maxV = 0;
    for (let i = 0; i < bins; i++) {
      if (counts[i] > 0) vAvg[i] /= counts[i];
      maxV = Math.max(maxV, vAvg[i]);
    }
    maxV = Math.max(maxV * 1.3, 0.1);

    // Draw K-field profile (secondary)
    ctx.beginPath();
    ctx.strokeStyle = "hsla(45, 80%, 55%, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    const kMax = 2;
    for (let i = 0; i < sim.field.N; i += 2) {
      const x = pad.left + (i / sim.field.N) * gw;
      const kVal = sim.field.K[i];
      const y = pad.top + gh - ((kVal / kMax) * gh);
      if (i === 0) ctx.moveTo(x, Math.max(pad.top, Math.min(pad.top + gh, y)));
      else ctx.lineTo(x, Math.max(pad.top, Math.min(pad.top + gh, y)));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw velocity curve from particles
    ctx.beginPath();
    ctx.strokeStyle = showEmergent ? "hsla(185, 90%, 55%, 1)" : "hsla(45, 80%, 55%, 0.9)";
    ctx.lineWidth = 2;
    let started = false;
    for (let i = 0; i < bins; i++) {
      if (counts[i] < 2) continue;
      const x = pad.left + ((i + 0.5) / bins) * gw;
      const y = pad.top + gh - (vAvg[i] / maxV) * gh;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    const ly = pad.top + 10;
    ctx.font = "11px 'Space Grotesk'";

    ctx.strokeStyle = showEmergent ? "hsla(185, 90%, 55%, 1)" : "hsla(45, 80%, 55%, 0.9)";
    ctx.beginPath();
    ctx.moveTo(pad.left + 10, ly);
    ctx.lineTo(pad.left + 35, ly);
    ctx.stroke();
    ctx.fillStyle = showEmergent ? "hsla(185, 90%, 55%, 0.9)" : "hsla(45, 80%, 55%, 0.9)";
    ctx.textAlign = "left";
    ctx.fillText("V(r) from K-field", pad.left + 40, ly + 4);

    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "hsla(45, 80%, 55%, 0.4)";
    ctx.beginPath();
    ctx.moveTo(pad.left + 10, ly + 18);
    ctx.lineTo(pad.left + 35, ly + 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "hsla(45, 80%, 55%, 0.6)";
    ctx.fillText("K(r) field", pad.left + 40, ly + 22);
  }, [showEmergent]);

  useEffect(() => {
    initSim();
  }, [initSim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const graph = graphRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d")!;
    const gctx = graph.getContext("2d")!;

    const resize = () => {
      const container = canvas.parentElement!;
      canvas.width = container.clientWidth;
      canvas.height = 350;
      graph.width = container.clientWidth;
      graph.height = 280;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      const sim = simRef.current;
      if (sim.initialized) {
        // Physics step
        const density = depositMassRadial(sim.particles, mass, sim.field);
        sim.field.step(DT, density);
        if (showEmergent) {
          stepParticlesRadial(sim.particles, sim.field, DT, FIELD_CONSTANTS.beta);
        } else {
          // Newtonian fallback: F = -M/r² radial
          for (const p of sim.particles) {
            const r = Math.sqrt(p.x * p.x + p.y * p.y);
            if (r < 0.3) continue;
            const a = -mass * 0.5 / (r * r);
            p.vx += a * (p.x / r) * DT;
            p.vy += a * (p.y / r) * DT;
            p.x += p.vx * DT;
            p.y += p.vy * DT;
          }
        }
      }
      drawGalaxy(ctx, canvas.width, canvas.height);
      drawGraph(gctx, graph.width, graph.height);

      frameCount.current++;
      if (frameCount.current % 10 === 0) {
        const fe = sim.field.energy();
        setDiag(computeDiagnostics(sim.particles, fe.total));
      }

      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [drawGalaxy, drawGraph, mass, showEmergent, initSim]);

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold gradient-text-cyan">Galaxy Rotation Simulator</h3>
        <button
          onClick={() => setShowEmergent(!showEmergent)}
          className={`text-xs tracking-wider uppercase px-4 py-2 rounded-full border transition-all ${
            showEmergent
              ? "border-primary/50 text-primary glow-border-cyan"
              : "border-border text-muted-foreground"
          }`}
        >
          {showEmergent ? "K-Field ON" : "K-Field OFF"}
        </button>
      </div>

      <canvas ref={canvasRef} className="w-full rounded-lg" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Central Mass</span>
          <span className="text-primary font-mono">{mass} units</span>
        </div>
        <input
          type="range"
          min={5}
          max={200}
          value={mass}
          onChange={(e) => setMass(Number(e.target.value))}
          className="w-full accent-primary h-1 bg-muted rounded-full appearance-none cursor-pointer"
        />
      </div>

      <canvas ref={graphRef} className="w-full rounded-lg" />

      <DiagnosticsPanel data={diag} label="Galaxy Diagnostics" />

      <p className="text-xs text-muted-foreground text-center">
        All motion emerges from the K-field equation: <span className="text-primary font-mono">acc = cK²∇²K − 3H₀K̇ − μ²(K−1) + αρ</span>
      </p>
    </div>
  );
};

export default GalaxySimulator;
