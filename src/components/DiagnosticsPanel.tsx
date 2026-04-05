import { memo, useEffect, useRef, useState } from "react";

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

function useDeDt(totalEnergy: number) {
  const historyRef = useRef<number[]>([]);
  const [dEdt, setDEdt] = useState(0);
  const [trend, setTrend] = useState<"stable" | "growing" | "decaying">("stable");
  const [relDrift, setRelDrift] = useState(0);

  useEffect(() => {
    const h = historyRef.current;
    h.push(totalEnergy);
    if (h.length > HISTORY_LEN) h.shift();

    if (h.length >= 3) {
      // instantaneous dE/dt (last 2 samples)
      const instant = h[h.length - 1] - h[h.length - 2];
      setDEdt(instant);

      // trend over full window via linear regression slope
      const n = h.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += i; sy += h[i]; sxy += i * h[i]; sx2 += i * i;
      }
      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);

      // relative drift: |E_now - E_initial| / |E_initial|
      const e0 = Math.abs(h[0]) || 1;
      const drift = Math.abs(h[h.length - 1] - h[0]) / e0;
      setRelDrift(drift);

      if (drift < 0.01) setTrend("stable");
      else if (slope > 0) setTrend("growing");
      else setTrend("decaying");
    }
  }, [totalEnergy]);

  return { dEdt, trend, relDrift };
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

const DiagnosticsPanel = memo(({ data, label = "Diagnostics" }: Props) => {
  const { dEdt, trend, relDrift } = useDeDt(data.totalEnergy);

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
