import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RadialKField, depositMassRadial, FIELD_CONSTANTS } from "@/lib/kfield-physics";

const AccelerationExplorer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(80);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 30, bottom: 45, left: 60 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    const GRID_N = 200;
    const R_MAX = 25;

    // Create field and evolve to equilibrium
    const field = new RadialKField(GRID_N, R_MAX, FIELD_CONSTANTS);
    const density = new Float64Array(GRID_N);
    // Deposit central mass
    const smoothR = 5;
    for (let i = 0; i < smoothR; i++) {
      const rr = field.r(i);
      const vol = 4 * Math.PI * rr * rr * field.dr;
      density[i] = mass / (smoothR * vol + 1e-30);
    }

    // Evolve field to quasi-static equilibrium
    for (let i = 0; i < 500; i++) {
      field.step(0.005, density);
    }
    field.computeGradient();

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
      const a = Math.abs(FIELD_CONSTANTS.beta * field.gradK[i]);
      accProfile.push(a);
      if (a > 0) {
        maxAcc = Math.max(maxAcc, a);
        minAcc = Math.min(minAcc, a);
      }
    }

    // Use log scale
    const logMin = minAcc > 0 ? Math.log10(minAcc) - 0.5 : -6;
    const logMax = Math.log10(maxAcc + 1e-30) + 0.5;
    const logRange = logMax - logMin;

    // Find transition point: where acceleration profile changes slope significantly
    // This is the emergent g_crit analog
    let transitionIdx = Math.floor(accProfile.length * 0.3);
    for (let i = 5; i < accProfile.length - 5; i++) {
      const slopeBefore = accProfile[i] - accProfile[i - 3];
      const slopeAfter = accProfile[i + 3] - accProfile[i];
      if (Math.abs(slopeBefore) > 0 && Math.abs(slopeAfter / (slopeBefore + 1e-30)) < 0.3) {
        transitionIdx = i;
        break;
      }
    }

    const gCritY = pad.top + gh - ((Math.log10(accProfile[transitionIdx] + 1e-30) - logMin) / logRange) * gh;

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

    // Acceleration curve from K-field
    ctx.beginPath();
    ctx.strokeStyle = "hsla(185, 90%, 55%, 1)";
    ctx.lineWidth = 2;
    for (let i = 0; i < accProfile.length; i++) {
      if (accProfile[i] <= 0) continue;
      const x = pad.left + ((i + 2) / GRID_N) * gw;
      const logA = Math.log10(accProfile[i]);
      const y = pad.top + gh - ((logA - logMin) / logRange) * gh;
      if (i === 0) ctx.moveTo(x, y);
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
    </div>
  );
};

export default AccelerationExplorer;
