import { memo, useEffect, useRef, useState, useCallback } from "react";

export interface DiagnosticsData {
  kineticEnergy: number;
  fieldEnergy: number;
  totalEnergy: number;
  avgVelocity: number;
  avgRadius: number;
  radialDispersion: number;
}

interface Props {
  data: DiagnosticsData;
  label?: string;
}

const fmt = (v: number) => {
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  if (Math.abs(v) > 9999) return v.toExponential(2);
  return v.toFixed(4);
};

const HISTORY_LEN = 120;

interface HistoryPoint {
  totalEnergy: number;
  drift: number;
  avgVelocity: number;
}

function useDeDt(totalEnergy: number, avgVelocity: number) {
  const historyRef = useRef<number[]>([]);
  const chartHistoryRef = useRef<HistoryPoint[]>([]);
  const [dEdt, setDEdt] = useState(0);
  const [trend, setTrend] = useState<"stable" | "growing" | "decaying">("stable");
  const [relDrift, setRelDrift] = useState(0);
  const [chartData, setChartData] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const h = historyRef.current;
    h.push(totalEnergy);
    if (h.length > HISTORY_LEN) h.shift();

    let drift = 0;
    if (h.length >= 3) {
      const instant = h[h.length - 1] - h[h.length - 2];
      setDEdt(instant);

      const n = h.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += i; sy += h[i]; sxy += i * h[i]; sx2 += i * i;
      }
      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);

      const e0 = Math.abs(h[0]) || 1;
      drift = Math.abs(h[h.length - 1] - h[0]) / e0;
      setRelDrift(drift);

      if (drift < 0.01) setTrend("stable");
      else if (slope > 0) setTrend("growing");
      else setTrend("decaying");
    }

    const ch = chartHistoryRef.current;
    ch.push({ totalEnergy, drift: drift * 100, avgVelocity });
    if (ch.length > HISTORY_LEN) ch.shift();
    // update chart state every 4 frames to avoid excessive re-renders
    if (ch.length % 4 === 0) setChartData([...ch]);
  }, [totalEnergy, avgVelocity]);

  return { dEdt, trend, relDrift, chartData };
}

const trendIcon: Record<string, string> = {
  stable: "✓",
  growing: "↑",
  decaying: "↓",
};
const trendColor: Record<string, string> = {
  stable: "text-green-400",
  growing: "text-red-400",
  decaying: "text-amber-400",
};

/* ---- Mini sparkline chart drawn on canvas ---- */
const CHART_H = 90;

const SparklineChart = memo(({ data }: { data: HistoryPoint[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, w, h);

    const series: { key: keyof HistoryPoint; color: string; label: string }[] = [
      { key: "totalEnergy", color: "#60a5fa", label: "E_total" },
      { key: "drift", color: "#f87171", label: "drift %" },
      { key: "avgVelocity", color: "#34d399", label: "⟨v⟩" },
    ];

    const colW = Math.floor(w / 3);

    series.forEach((s, si) => {
      const x0 = si * colW;
      const cw = colW - 4;

      // extract values
      const vals = data.map((d) => d[s.key]);
      let min = Infinity, max = -Infinity;
      for (const v of vals) { if (v < min) min = v; if (v > max) max = v; }
      const range = max - min || 1;

      // draw line
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < vals.length; i++) {
        const px = x0 + 2 + (i / (data.length - 1)) * cw;
        const py = h - 16 - ((vals[i] - min) / range) * (h - 28);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // label
      ctx.fillStyle = s.color;
      ctx.font = "9px monospace";
      ctx.fillText(s.label, x0 + 4, 10);

      // current value
      const cur = vals[vals.length - 1];
      const valStr = Math.abs(cur) > 9999 || (Math.abs(cur) < 0.001 && cur !== 0)
        ? cur.toExponential(1)
        : cur.toFixed(2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(valStr, x0 + 4, h - 4);
    });

    // time axis label
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "8px monospace";
    ctx.fillText("t →", w - 20, h - 4);
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * (window.devicePixelRatio > 1 ? 2 : 1);
    canvas.height = CHART_H * (window.devicePixelRatio > 1 ? 2 : 1);
    const ctx = canvas.getContext("2d");
    if (ctx && window.devicePixelRatio > 1) ctx.scale(2, 2);
    draw();
  }, [data, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded border border-border/30"
      style={{ height: CHART_H }}
    />
  );
});
SparklineChart.displayName = "SparklineChart";

const DiagnosticsPanel = memo(({ data, label = "Diagnostics" }: Props) => {
  const { dEdt, trend, relDrift, chartData } = useDeDt(data.totalEnergy, data.avgVelocity);

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/30 backdrop-blur-sm p-3 text-xs font-mono">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        <div>
          <span className="text-muted-foreground">KE </span>
          <span className="text-primary">{fmt(data.kineticEnergy)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">E_field </span>
          <span className="text-secondary">{fmt(data.fieldEnergy)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">E_total </span>
          <span className="text-accent">{fmt(data.totalEnergy)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">⟨v⟩ </span>
          <span className="text-primary">{fmt(data.avgVelocity)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">⟨r⟩ </span>
          <span className="text-secondary">{fmt(data.avgRadius)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">σ_r </span>
          <span className="text-accent">{fmt(data.radialDispersion)}</span>
        </div>
      </div>

      {/* Energy conservation monitor */}
      <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        <div>
          <span className="text-muted-foreground">dE/dt </span>
          <span className={trend === "stable" ? "text-green-400" : "text-red-400"}>{fmt(dEdt)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">drift </span>
          <span className={relDrift < 0.01 ? "text-green-400" : relDrift < 0.1 ? "text-amber-400" : "text-red-400"}>
            {(relDrift * 100).toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">trend </span>
          <span className={trendColor[trend]}>
            {trendIcon[trend]} {trend}
          </span>
        </div>
      </div>

      {/* Temporal sparkline charts */}
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">History (last {HISTORY_LEN} frames)</div>
        <SparklineChart data={chartData} />
      </div>
    </div>
  );
});

DiagnosticsPanel.displayName = "DiagnosticsPanel";
export default DiagnosticsPanel;

/** Compute diagnostics from particles + field energy */
export function computeDiagnostics(
  particles: { x: number; y: number; z: number; vx: number; vy: number; vz: number; mass: number }[],
  fieldEnergy: number
): DiagnosticsData {
  let ke = 0;
  let sumV = 0;
  let sumR = 0;
  let sumR2 = 0;
  const n = particles.length || 1;

  for (const p of particles) {
    const v2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
    ke += 0.5 * p.mass * v2;
    sumV += Math.sqrt(v2);
    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    sumR += r;
    sumR2 += r * r;
  }

  const avgR = sumR / n;
  return {
    kineticEnergy: ke,
    fieldEnergy,
    totalEnergy: ke + fieldEnergy,
    avgVelocity: sumV / n,
    avgRadius: avgR,
    radialDispersion: Math.sqrt(sumR2 / n - avgR * avgR),
  };
}
