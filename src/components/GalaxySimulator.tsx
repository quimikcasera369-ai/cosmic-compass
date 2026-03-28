import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

const G = 6.674e-11;
const G_CRIT = 9.58e-12; // m/s²
const SOLAR_MASS = 1.989e30;
const KPC = 3.086e19; // meters

const GalaxySimulator = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(50); // in 10^9 solar masses
  const [showEmergent, setShowEmergent] = useState(true);
  const animRef = useRef<number>(0);

  const drawGalaxy = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    // Galaxy core glow
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    coreGrad.addColorStop(0, "hsla(45, 90%, 70%, 0.8)");
    coreGrad.addColorStop(0.3, "hsla(45, 80%, 55%, 0.3)");
    coreGrad.addColorStop(1, "transparent");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    // Spiral arms with stars
    const M = mass * 1e9 * SOLAR_MASS;
    const arms = 2;
    const starsPerArm = 120;

    for (let arm = 0; arm < arms; arm++) {
      const armOffset = (arm * Math.PI * 2) / arms;
      for (let i = 0; i < starsPerArm; i++) {
        const t = i / starsPerArm;
        const r = 15 + t * (Math.min(w, h) * 0.4);
        const rMeters = (t * 30 + 1) * KPC;

        // Calculate orbital velocity
        const vNewton = Math.sqrt((G * M) / rMeters);
        const vEmergent = Math.pow(G * M * G_CRIT, 0.25);
        const vActual = showEmergent
          ? Math.sqrt(vNewton ** 2 + vEmergent ** 2) // smooth blend
          : vNewton;

        // Angular velocity for animation
        const omega = vActual / rMeters;
        const scale = 3e13;
        const angle = armOffset + t * 3 + time * omega * scale;

        const spread = t * 8;
        const dx = (Math.random() - 0.5) * spread;
        const dy = (Math.random() - 0.5) * spread;
        const x = cx + Math.cos(angle) * r + dx;
        const y = cy + Math.sin(angle) * r * 0.6 + dy; // tilt

        const brightness = 0.3 + (1 - t) * 0.7;
        const hue = t < 0.3 ? 45 : t < 0.6 ? 200 : 220;
        const size = (1 - t * 0.5) * 1.8;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${brightness})`;
        ctx.fill();
      }
    }
  }, [mass, showEmergent]);

  const drawGraph = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 30, right: 20, bottom: 40, left: 55 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;
    const M = mass * 1e9 * SOLAR_MASS;

    // Axes
    ctx.strokeStyle = "hsla(220, 15%, 40%, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + gh);
    ctx.lineTo(pad.left + gw, pad.top + gh);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "hsla(220, 15%, 55%, 1)";
    ctx.font = "11px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("Radius (kpc)", pad.left + gw / 2, h - 5);
    ctx.save();
    ctx.translate(12, pad.top + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("V (km/s)", 0, 0);
    ctx.restore();

    // Data
    const maxR = 30 * KPC;
    const points = 200;
    const newtonian: [number, number][] = [];
    const emergent: [number, number][] = [];
    const combined: [number, number][] = [];

    let maxV = 0;
    for (let i = 1; i <= points; i++) {
      const r = (i / points) * maxR;
      const vN = Math.sqrt((G * M) / r) / 1000;
      const vE = Math.pow(G * M * G_CRIT, 0.25) / 1000;
      const vC = Math.sqrt(vN ** 2 * 1e6 + vE ** 2 * 1e6) / 1000;
      newtonian.push([i / points, vN]);
      emergent.push([i / points, vE]);
      combined.push([i / points, vC]);
      maxV = Math.max(maxV, vN, vC);
    }
    maxV *= 1.2;

    const drawCurve = (data: [number, number][], color: string, dashed = false) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      data.forEach(([x, y], i) => {
        const px = pad.left + x * gw;
        const py = pad.top + gh - (y / maxV) * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Newtonian (dashed)
    drawCurve(newtonian, "hsla(45, 80%, 55%, 0.7)", true);

    // Combined / emergent
    if (showEmergent) {
      drawCurve(combined, "hsla(185, 90%, 55%, 1)");
    }

    // g_crit threshold line
    const rCrit = (G * M) / G_CRIT;
    const xCrit = (rCrit / maxR);
    if (xCrit > 0 && xCrit < 1) {
      const px = pad.left + xCrit * gw;
      ctx.beginPath();
      ctx.strokeStyle = "hsla(0, 70%, 55%, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, pad.top + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "hsla(0, 70%, 65%, 0.8)";
      ctx.font = "10px 'Space Grotesk'";
      ctx.textAlign = "center";
      ctx.fillText("g_crit", px, pad.top - 5);
    }

    // Legend
    const ly = pad.top + 10;
    ctx.font = "11px 'Space Grotesk'";
    ctx.fillStyle = "hsla(45, 80%, 55%, 0.9)";
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "hsla(45, 80%, 55%, 0.7)";
    ctx.beginPath(); ctx.moveTo(pad.left + 10, ly); ctx.lineTo(pad.left + 35, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.fillText("Newtonian", pad.left + 40, ly + 4);

    if (showEmergent) {
      ctx.fillStyle = "hsla(185, 90%, 55%, 0.9)";
      ctx.strokeStyle = "hsla(185, 90%, 55%, 1)";
      ctx.beginPath(); ctx.moveTo(pad.left + 10, ly + 18); ctx.lineTo(pad.left + 35, ly + 18); ctx.stroke();
      ctx.fillText("Emergent", pad.left + 40, ly + 22);
    }
  }, [mass, showEmergent]);

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

    let start = Date.now();
    const loop = () => {
      const time = (Date.now() - start) * 0.001;
      drawGalaxy(ctx, canvas.width, canvas.height, time);
      drawGraph(gctx, graph.width, graph.height);
      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [drawGalaxy, drawGraph]);

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
          {showEmergent ? "Emergent ON" : "Emergent OFF"}
        </button>
      </div>

      <canvas ref={canvasRef} className="w-full rounded-lg" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Galaxy Mass</span>
          <span className="text-primary font-mono">{mass} × 10⁹ M☉</span>
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

      <p className="text-xs text-muted-foreground text-center">
        Notice how the emergent curve stays <span className="text-primary">flat</span> at large radii — matching observed galaxy rotation curves without dark matter.
      </p>
    </div>
  );
};

export default GalaxySimulator;
