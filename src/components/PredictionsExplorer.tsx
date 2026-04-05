import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RadialKField, depositMassRadial, FIELD_CONSTANTS } from "@/lib/kfield-physics";
import DiagnosticsPanel, { DiagnosticsData } from "./DiagnosticsPanel";

const PredictionsExplorer = () => {
  const [redshift, setRedshift] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 20, bottom: 45, left: 55 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    const GRID_N = 150;
    const R_MAX = 20;
    const MASS = 50;

    // z=0 field
    const field0 = new RadialKField(GRID_N, R_MAX, FIELD_CONSTANTS);
    const density0 = new Float64Array(GRID_N);
    for (let i = 0; i < 4; i++) {
      const rr = field0.r(i);
      const vol = 4 * Math.PI * rr * rr * field0.dr;
      density0[i] = MASS / (4 * vol + 1e-30);
    }
    for (let s = 0; s < 300; s++) field0.step(0.005, density0);
    field0.computeGradient();

    // z-dependent field: H0 scales with redshift → more damping at high z
    const paramsZ = {
      ...FIELD_CONSTANTS,
      H0: FIELD_CONSTANTS.H0 * (1 + redshift),
      mu2: FIELD_CONSTANTS.mu2 * (1 + redshift * 0.3),
    };
    const fieldZ = new RadialKField(GRID_N, R_MAX, paramsZ);
    const densityZ = new Float64Array(GRID_N);
    for (let i = 0; i < 4; i++) {
      const rr = fieldZ.r(i);
      const vol = 4 * Math.PI * rr * rr * fieldZ.dr;
      densityZ[i] = MASS / (4 * vol + 1e-30);
    }
    for (let s = 0; s < 300; s++) fieldZ.step(0.005, densityZ);
    fieldZ.computeGradient();

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
    ctx.fillText("V from K-field", 0, 0);
    ctx.restore();

    // Compute velocity profiles: V(r) = sqrt(β * r * |dK/dr|)
    const computeVProfile = (field: RadialKField) => {
      const vels: number[] = [];
      for (let i = 2; i < GRID_N - 2; i++) {
        const rr = field.r(i);
        const gradMag = Math.abs(field.gradK[i]);
        const v = Math.sqrt(FIELD_CONSTANTS.beta * rr * gradMag);
        vels.push(v);
      }
      return vels;
    };

    const v0 = computeVProfile(field0);
    const vZ = computeVProfile(fieldZ);
    const maxV = Math.max(...v0, ...vZ) * 1.2 || 1;

    const drawProfile = (vels: number[], color: string, label: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = 0; i < vels.length; i++) {
        const x = pad.left + ((i + 2) / GRID_N) * gw;
        const y = pad.top + gh - (vels[i] / maxV) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "10px 'Space Grotesk'";
      ctx.textAlign = "right";
      const lastV = vels[vels.length - 1];
      const yLabel = pad.top + gh - (lastV / maxV) * gh;
      ctx.fillText(label, pad.left + gw - 5, yLabel - 8);
    };

    drawProfile(v0, "hsla(220, 20%, 45%, 0.6)", "z = 0");
    if (redshift > 0.05) {
      drawProfile(vZ, "hsla(185, 90%, 55%, 1)", `z = ${redshift.toFixed(1)}`);
    }

    // Compute BTFR shift from K-field
    const v0_flat = v0.length > 0 ? v0[v0.length - 1] : 0;
    const vZ_flat = vZ.length > 0 ? vZ[vZ.length - 1] : 0;
    const btfrShift = v0_flat > 0 ? Math.log10((vZ_flat / v0_flat) ** 4 + 1e-30) : 0;

    // Store for display
    (ctx as any).__btfrShift = btfrShift;
  }, [redshift]);

  const btfrShiftRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      const container = canvas.parentElement!;
      canvas.width = container.clientWidth;
      canvas.height = 280;
    };
    resize();
    draw(ctx, canvas.width, canvas.height);
    btfrShiftRef.current = (ctx as any).__btfrShift || 0;

    const handler = () => { resize(); draw(ctx, canvas.width, canvas.height); btfrShiftRef.current = (ctx as any).__btfrShift || 0; };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  // Compute BTFR shift for display (simplified estimate)
  const btfrShift = FIELD_CONSTANTS.H0 * redshift * 0.8;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold gradient-text-gold">BTFR Evolution from K-Field</h3>

      <canvas ref={canvasRef} className="w-full rounded-lg" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Redshift (z)</span>
          <span className="text-accent font-mono">z = {redshift.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={redshift}
          onChange={(e) => setRedshift(Number(e.target.value))}
          className="w-full accent-accent h-1 bg-muted rounded-full appearance-none cursor-pointer"
        />
      </div>

      <div className="p-4 rounded-lg bg-muted/20 border border-accent/10">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">K-field BTFR shift</span>
          <span className="text-accent font-mono font-bold text-lg">
            +{btfrShift.toFixed(3)} dex
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          At higher redshift, increased Hubble damping (3H₀K̇) modifies the K-field equilibrium, shifting the BTFR — a testable prediction.
        </p>
      </div>
    </div>
  );
};

export default PredictionsExplorer;
