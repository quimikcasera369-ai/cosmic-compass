import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

const G = 6.674e-11;
const G_CRIT = 9.58e-12;
const SOLAR_MASS = 1.989e30;
const KPC = 3.086e19;

const AccelerationExplorer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(80);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 30, bottom: 45, left: 60 };
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

    ctx.fillStyle = "hsla(220, 15%, 55%, 1)";
    ctx.font = "11px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("Radius (kpc)", pad.left + gw / 2, h - 5);
    ctx.save();
    ctx.translate(12, pad.top + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("log₁₀(a) [m/s²]", 0, 0);
    ctx.restore();

    const maxR = 50 * KPC;
    const points = 300;
    const logGCrit = Math.log10(G_CRIT);

    // g_crit horizontal line
    const minLog = -14;
    const maxLog = -8;
    const yCrit = pad.top + gh - ((logGCrit - minLog) / (maxLog - minLog)) * gh;

    // Fill regions
    ctx.fillStyle = "hsla(185, 80%, 50%, 0.05)";
    ctx.fillRect(pad.left, pad.top, gw, yCrit - pad.top);
    ctx.fillStyle = "hsla(270, 60%, 55%, 0.05)";
    ctx.fillRect(pad.left, yCrit, gw, pad.top + gh - yCrit);

    // g_crit line
    ctx.beginPath();
    ctx.strokeStyle = "hsla(45, 90%, 55%, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(pad.left, yCrit);
    ctx.lineTo(pad.left + gw, yCrit);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "hsla(45, 90%, 60%, 0.9)";
    ctx.font = "11px 'Space Grotesk'";
    ctx.textAlign = "right";
    ctx.fillText("g_crit ≈ 9.58×10⁻¹² m/s²", pad.left + gw - 5, yCrit - 6);

    // Region labels
    ctx.font = "10px 'Space Grotesk'";
    ctx.fillStyle = "hsla(185, 80%, 60%, 0.7)";
    ctx.textAlign = "left";
    ctx.fillText("NEWTONIAN REGIME", pad.left + 8, pad.top + 20);
    ctx.fillStyle = "hsla(270, 60%, 65%, 0.7)";
    ctx.fillText("EMERGENT REGIME", pad.left + 8, pad.top + gh - 10);

    // Acceleration curve
    ctx.beginPath();
    ctx.strokeStyle = "hsla(185, 90%, 55%, 1)";
    ctx.lineWidth = 2;
    for (let i = 1; i <= points; i++) {
      const r = (i / points) * maxR;
      const a = (G * M) / (r * r);
      const logA = Math.log10(a);
      const x = pad.left + (i / points) * gw;
      const y = pad.top + gh - ((logA - minLog) / (maxLog - minLog)) * gh;
      if (i === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
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
    window.addEventListener("resize", () => { resize(); draw(ctx, canvas.width, canvas.height); });
    return () => window.removeEventListener("resize", () => {});
  }, [draw]);

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold gradient-text-purple">Acceleration Regime Explorer</h3>

      <canvas ref={canvasRef} className="w-full rounded-lg" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Galaxy Mass</span>
          <span className="text-secondary font-mono">{mass} × 10⁹ M☉</span>
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
          <span className="text-primary font-medium">Above g_crit</span>
          <p className="text-muted-foreground mt-1">Standard Newtonian gravity dominates: V² = GM/r</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-secondary/10">
          <span className="text-secondary font-medium">Below g_crit</span>
          <p className="text-muted-foreground mt-1">Emergent regime kicks in: V⁴ = GM·g_crit</p>
        </div>
      </div>
    </div>
  );
};

export default AccelerationExplorer;
