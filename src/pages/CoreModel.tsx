import { useState, useMemo, useRef, useEffect } from "react";

// Constants
const G = 6.674e-11;
const c = 3e8;
const H0_SI = 73e3 / 3.086e22; // 73 km/s/Mpc in SI
const M_SUN = 1.989e30;
const Om = 0.3;
const OL = 0.7;

function Hz(z: number) {
  return H0_SI * Math.sqrt(Om * Math.pow(1 + z, 3) + OL);
}

function gCrit(z: number) {
  return c * Hz(z);
}

function predictedV(M_solar: number, z: number) {
  const gc = gCrit(z);
  const M = M_solar * M_SUN;
  const v4 = G * M * gc;
  return v4 > 0 ? Math.pow(v4, 0.25) : 0;
}

function sigma(v_ms: number, z: number) {
  const gc = gCrit(z);
  return gc > 0 ? (v_ms * v_ms) / gc : 0;
}

function deltaX(v_ms: number, z: number) {
  const gc = gCrit(z);
  const sig = sigma(v_ms, z);
  return gc > 0 ? sig * (Hz(z) * v_ms / gc) : 0;
}

function regime(v_ms: number, z: number) {
  const gc = gCrit(z);
  const a_obs = v_ms > 0 ? (v_ms * v_ms) / sigma(v_ms, z) : 0;
  const ratio = gc > 0 ? a_obs / gc : 0;
  if (ratio > 5) return "newtonian";
  if (ratio < 0.3) return "collective";
  return "transition";
}

function fmt(v: number, digits = 4) {
  if (!isFinite(v)) return "—";
  if (Math.abs(v) < 1e-3 || Math.abs(v) > 1e6) return v.toExponential(digits);
  return v.toPrecision(digits);
}

function Diagram({ sig, dx }: { sig: number; dx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;

    // field radius circle
    const maxR = Math.min(W, H) * 0.4;
    const sigNorm = Math.min(maxR, maxR * 0.8);
    ctx.strokeStyle = "hsl(185, 90%, 55%)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, sigNorm, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // label σ
    ctx.fillStyle = "hsl(185, 90%, 55%)";
    ctx.font = "13px monospace";
    ctx.fillText("σ", cx + sigNorm + 4, cy - 4);

    // offset arrow
    const dxNorm = sig > 0 ? Math.min(maxR * 0.6, (dx / sig) * sigNorm) : 0;
    if (dxNorm > 2) {
      ctx.strokeStyle = "hsl(40, 90%, 60%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dxNorm, cy);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(cx + dxNorm, cy);
      ctx.lineTo(cx + dxNorm - 6, cy - 4);
      ctx.lineTo(cx + dxNorm - 6, cy + 4);
      ctx.fill();
      ctx.fillStyle = "hsl(40, 90%, 60%)";
      ctx.fillText("Δx", cx + dxNorm / 2 - 8, cy - 10);
    }

    // central mass
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "hsl(0, 0%, 60%)";
    ctx.fillText("M", cx - 14, cy + 18);
  }, [sig, dx]);

  return <canvas ref={canvasRef} width={320} height={320} className="mx-auto" />;
}

const equations = [
  { label: "Field equation", eq: "∂²K/∂t² − c_K² ∇²K + 3H(z) ∂K/∂t + μ²(K − 1) = αρ" },
  { label: "Critical acceleration", eq: "g_crit = c · H(z)" },
  { label: "Baryonic relation", eq: "v⁴ = G · M · g_crit" },
  { label: "Memory law", eq: "Δx = σ · ( H(z) · v / g_crit )" },
  { label: "Transition scale", eq: "σ = v² / g_crit" },
];

export default function CoreModel() {
  const [V, setV] = useState(200);
  const [M, setM] = useState(1e11);
  const [z, setZ] = useState(0.01);

  const results = useMemo(() => {
    const v_ms = V * 1000;
    const hz = Hz(z);
    const gc = gCrit(z);
    const vPred = predictedV(M, z);
    const sig = sigma(v_ms, z);
    const dx = deltaX(v_ms, z);
    const reg = regime(v_ms, z);
    return { hz, gc, vPred, sig, dx, reg, v_ms };
  }, [V, M, z]);

  const regColor = results.reg === "newtonian" ? "hsl(0,70%,55%)" : results.reg === "collective" ? "hsl(140,70%,50%)" : "hsl(45,90%,55%)";

  return (
    <div style={{ background: "#06081a", color: "#d4dce8", minHeight: "100vh", fontFamily: "'Space Grotesk', monospace" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* Title */}
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, textAlign: "center", marginBottom: "0.3rem", color: "#e0e8f0" }}>
          Emergent Coherence Gravity – Core Model
        </h1>
        <p style={{ textAlign: "center", color: "#6b7a8d", fontSize: "0.85rem", marginBottom: "2.5rem" }}>
          Interactive reference for the ECG field equations
        </p>

        {/* Section 1 — Equations */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "hsl(185,90%,55%)", marginBottom: "1rem", borderBottom: "1px solid #1a2030", paddingBottom: "0.4rem" }}>
            Core Equations
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {equations.map((e) => (
              <div key={e.label} style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
                <span style={{ color: "#6b7a8d", fontSize: "0.78rem", minWidth: 140 }}>{e.label}</span>
                <code style={{ color: "#c8d8e8", fontSize: "0.95rem", letterSpacing: "0.02em" }}>{e.eq}</code>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2 — Calculator */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "hsl(185,90%,55%)", marginBottom: "1rem", borderBottom: "1px solid #1a2030", paddingBottom: "0.4rem" }}>
            Interactive Calculator
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {([
              ["V (km/s)", V, setV, 10, 500, 1],
              ["M (M☉)", M, setM, 1e8, 1e13, 1e9],
              ["z", z, setZ, 0, 2, 0.01],
            ] as [string, number, (v: number) => void, number, number, number][]).map(([label, val, setter, min, max, step]) => (
              <label key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.75rem", color: "#6b7a8d" }}>{label}</span>
                <input
                  type="range" min={min} max={max} step={step} value={val}
                  onChange={(e) => setter(Number(e.target.value))}
                  style={{ accentColor: "hsl(185,90%,55%)" }}
                />
                <span style={{ fontSize: "0.8rem", color: "#a0b0c0", textAlign: "center" }}>
                  {label === "M (M☉)" ? M.toExponential(1) : val}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 2rem", background: "#0a0e20", borderRadius: 8, padding: "1rem 1.2rem" }}>
            {([
              ["H(z)", fmt(results.hz), "s⁻¹"],
              ["g_crit", fmt(results.gc), "m/s²"],
              ["v_pred", fmt(results.vPred / 1000), "km/s"],
              ["σ", fmt(results.sig), "m"],
              ["Δx", fmt(results.dx), "m"],
            ] as [string, string, string][]).map(([k, v, u]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid #141828" }}>
                <span style={{ color: "#6b7a8d", fontSize: "0.82rem" }}>{k}</span>
                <span style={{ color: "#d4dce8", fontSize: "0.85rem", fontFamily: "monospace" }}>{v} <span style={{ color: "#4a5a6a", fontSize: "0.72rem" }}>{u}</span></span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 — Regime */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "hsl(185,90%,55%)", marginBottom: "1rem", borderBottom: "1px solid #1a2030", paddingBottom: "0.4rem" }}>
            Regime
          </h2>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28 }}>
            {(["collective", "transition", "newtonian"] as const).map((r) => (
              <div key={r} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                background: results.reg === r
                  ? (r === "newtonian" ? "hsl(0,70%,30%)" : r === "collective" ? "hsl(140,60%,25%)" : "hsl(45,70%,30%)")
                  : "#0e1224",
                color: results.reg === r ? "#fff" : "#3a4a5a",
                transition: "all 0.3s",
              }}>
                {r}
              </div>
            ))}
          </div>
        </section>

        {/* Section 4 — Diagram */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "hsl(185,90%,55%)", marginBottom: "1rem", borderBottom: "1px solid #1a2030", paddingBottom: "0.4rem" }}>
            Field Diagram
          </h2>
          <Diagram sig={results.sig} dx={results.dx} />
          <p style={{ textAlign: "center", color: "#4a5a6a", fontSize: "0.72rem", marginTop: "0.5rem" }}>
            Dashed circle = transition scale σ &nbsp;|&nbsp; Arrow = memory offset Δx
          </p>
        </section>

      </div>
    </div>
  );
}
