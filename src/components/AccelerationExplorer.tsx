import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RadialKField, FIELD_CONSTANTS } from "@/lib/kfield-physics";
import DiagnosticsPanel, { DiagnosticsData } from "./DiagnosticsPanel";

const AccelerationExplorer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(80);
  const [diag, setDiag] = useState<DiagnosticsData>({ kineticEnergy: 0, fieldEnergy: 0, totalEnergy: 0, avgVelocity: 0, avgRadius: 0, radialDispersion: 0 });

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 30, bottom: 45, left: 60 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    const GRID_N = 200;
    const R_MAX = 25;

    // Create field and evolve to equilibrium with convergence check
    const field = new RadialKField(GRID_N, R_MAX, FIELD_CONSTANTS);
    const density = new Float64Array(GRID_N);
    const smoothR = 5;
    for (let i = 0; i < smoothR; i++) {
      const rr = field.r(i);
      const vol = 4 * Math.PI * rr * rr * field.dr;
      density[i] = mass / (smoothR * vol + 1e-30);
    }

    // Convergence-based equilibration
    field.stepToEquilibrium(0.005, density, 1e-4, 2000);

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
    ctx.fillText("K-field acceleration", 0, 0);
    ctx.restore();

    // Compute acceleration from grad(K): a = β * |dK/dr|
    const accProfile: number[] = [];
    let maxAcc = 0;
    let minAcc = Infinity;
    for (let i = 2; i < GRID_N - 2; i++) {
      let a = Math.abs(FIELD_CONSTANTS.beta * field.gradK[i]);
      if (!isFinite(a)) a = 0;
      accProfile.push(a);
      if (a > 0) {
        maxAcc = Math.max(maxAcc, a);
        minAcc = Math.min(minAcc, a);
      }
    }

    // Fallback if profile is degenerate
    if (maxAcc <= 0 || !isFinite(maxAcc)) {
      ctx.fillStyle = "hsla(220, 15%, 55%, 0.7)";
      ctx.font = "12px 'Space Grotesk'";
      ctx.textAlign = "center";
      ctx.fillText("Field not converged — adjust mass", pad.left + gw / 2, pad.top + gh / 2);
      return;
    }
    if (minAcc <= 0 || !isFinite(minAcc)) minAcc = maxAcc * 1e-6;

    // Log scale with guards
    const logMin = Math.log10(minAcc) - 0.5;
    const logMax = Math.log10(maxAcc) + 0.5;
    const logRange = logMax - logMin;

    if (logRange <= 0) return; // degenerate range

    // Find transition: direct g_crit comparison
    // g_crit = midpoint of acceleration range in log space
    const gCritValue = Math.sqrt(maxAcc * minAcc); // geometric mean as emergent g_crit
    let transitionIdx = -1;
    for (let i = 0; i < accProfile.length; i++) {
      if (accProfile[i] > 0 && accProfile[i] <= gCritValue) {
        transitionIdx = i;
        break;
      }
    }
    if (transitionIdx < 0) transitionIdx = Math.floor(accProfile.length * 0.4);

    const gCritLog = Math.log10(gCritValue);
    const gCritY = pad.top + gh - ((gCritLog - logMin) / logRange) * gh;

    // Fill regions
    ctx.fillStyle = "hsla(185, 80%, 50%, 0.05)";
    ctx.fillRect(pad.left, pad.top, gw, Math.max(0, gCritY - pad.top));
    ctx.fillStyle = "hsla(270, 60%, 55%, 0.05)";
    ctx.fillRect(pad.left, gCritY, gw, Math.max(0, pad.top + gh - gCritY));

    // g_crit line
    ctx.beginPath();
    ctx.strokeStyle = "hsla(45, 90%, 55%, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(pad.left, gCritY);
    ctx.lineTo(pad.left + gw, gCritY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "hsla(45, 90%, 60%, 0.9)";
    ctx.font = "11px 'Space Grotesk'";
    ctx.textAlign = "right";
    ctx.fillText("g_crit (emergent)", pad.left + gw - 5, gCritY - 6);

    // Region labels
    ctx.font = "10px 'Space Grotesk'";
    ctx.fillStyle = "hsla(185, 80%, 60%, 0.7)";
    ctx.textAlign = "left";
    ctx.fillText("STRONG K-FIELD (Newtonian-like)", pad.left + 8, pad.top + 20);
    ctx.fillStyle = "hsla(270, 60%, 65%, 0.7)";
    ctx.fillText("WEAK K-FIELD (Emergent)", pad.left + 8, pad.top + gh - 10);

    // Acceleration curve
    ctx.beginPath();
    ctx.strokeStyle = "hsla(185, 90%, 55%, 1)";
    ctx.lineWidth = 2;
    let started = false;
    for (let i = 0; i < accProfile.length; i++) {
      if (accProfile[i] <= 0) continue;
      const x = pad.left + ((i + 2) / GRID_N) * gw;
      const logA = Math.log10(accProfile[i]);
      if (!isFinite(logA)) continue;
      const y = pad.top + gh - ((logA - logMin) / logRange) * gh;
      if (!isFinite(y)) continue;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Diagnostics
    const fe = field.energy();
    const accData: { r: number; a: number }[] = [];
    for (let i = 2; i < GRID_N - 2; i++) {
      const a = Math.abs(FIELD_CONSTANTS.beta * field.gradK[i]);
      accData.push({ r: field.r(i), a: isFinite(a) ? a : 0 });
    }
    const avgR = accData.reduce((s, d) => s + d.r, 0) / accData.length;
    const avgA = accData.reduce((s, d) => s + d.a, 0) / accData.length;
    const sigR = Math.sqrt(accData.reduce((s, d) => s + (d.r - avgR) ** 2, 0) / accData.length);
    setDiag({
      kineticEnergy: fe.kinetic,
      fieldEnergy: fe.potential,
      totalEnergy: fe.total,
      avgVelocity: avgA,
      avgRadius: avgR,
      radialDispersion: sigR,
    });
  }, [mass]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      const container = canvas.parentElement!;
      canvas.width = container.clientWidth;
      canvas.height = 320;
    };
    resize();
    draw(ctx, canvas.width, canvas.height);

    const handler = () => { resize(); draw(ctx, canvas.width, canvas.height); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold gradient-text-purple">K-Field Acceleration Explorer</h3>

      <canvas ref={canvasRef} className="w-full rounded-lg" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Source Mass</span>
          <span className="text-secondary font-mono">{mass} units</span>
        </div>
        <input
          type="range"
          min={5}
          max={200}
          value={mass}
          onChange={(e) => setMass(Number(e.target.value))}
          className="w-full accent-secondary h-1 bg-muted rounded-full appearance-none cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 rounded-lg bg-muted/30 border border-primary/10">
          <span className="text-primary font-medium">Strong K-field</span>
          <p className="text-muted-foreground mt-1">Large ∇K → strong F = −β∇K (Newtonian-like)</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-secondary/10">
          <span className="text-secondary font-medium">Weak K-field</span>
          <p className="text-muted-foreground mt-1">Small ∇K → emergent regime dominates</p>
        </div>
      </div>

      <DiagnosticsPanel data={diag} label="Acceleration Field Diagnostics" />
    </div>
  );
};

export default AccelerationExplorer;
