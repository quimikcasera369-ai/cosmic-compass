import { memo } from "react";

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

const DiagnosticsPanel = memo(({ data, label = "Diagnostics" }: Props) => (
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
  </div>
));

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
