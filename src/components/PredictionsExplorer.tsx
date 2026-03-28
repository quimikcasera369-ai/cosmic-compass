import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const PredictionsExplorer = () => {
  const [redshift, setRedshift] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // BTFR evolution prediction: +0.120 dex at z=2
  const btfrShift = (z: number) => 0.120 * (z / 2);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 30, right: 20, bottom: 45, left: 55 };
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
    ctx.fillText("log₁₀(M_baryonic) [M☉]", pad.left + gw / 2, h - 5);
    ctx.save();
    ctx.translate(12, pad.top + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("log₁₀(V_flat) [km/s]", 0, 0);
    ctx.restore();

    // BTFR line at z=0
    const slope = 0.25; // V^4 = GM*g_crit → log V = 0.25 log M + const
    const intercept0 = 0.8;
    const interceptZ = intercept0 + btfrShift(redshift) * slope;

    const drawBTFR = (intercept: number, color: string, label: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = 0; i <= 100; i++) {
        const logM = 8 + (i / 100) * 4; // 10^8 to 10^12
        const logV = slope * logM + intercept;
        const x = pad.left + (i / 100) * gw;
        const y = pad.top + gh - ((logV - 1.2) / 2) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "10px 'Space Grotesk'";
      ctx.textAlign = "right";
      const yLabel = pad.top + gh - ((slope * 12 + intercept - 1.2) / 2) * gh;
      ctx.fillText(label, pad.left + gw - 5, yLabel - 8);
    };

    // z=0 baseline
    drawBTFR(intercept0, "hsla(220, 20%, 45%, 0.5)", "z = 0");
    // current z
    if (redshift > 0.01) {
      drawBTFR(interceptZ, "hsla(185, 90%, 55%, 1)", `z = ${redshift.toFixed(1)}`);
    }
  }, [redshift]);

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

    const handler = () => { resize(); draw(ctx, canvas.width, canvas.height); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold gradient-text-gold">BTFR Evolution Predictor</h3>

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
          <span className="text-sm text-muted-foreground">Predicted BTFR shift</span>
          <span className="text-accent font-mono font-bold text-lg">
            +{btfrShift(redshift).toFixed(3)} dex
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The Baryonic Tully-Fisher Relation should evolve with redshift — a testable prediction unique to this model.
        </p>
      </div>
    </div>
  );
};

export default PredictionsExplorer;
