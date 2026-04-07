import { useState, useMemo, useCallback, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, ReferenceArea
} from "recharts";
import { Upload, Database, BarChart3, Download, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

// ─── Constants ───
const G = 6.674e-11;
const c = 3e8;
const H0_SI = 73 * 1e3 / (3.0857e22);
const OMEGA_M = 0.3;
const OMEGA_L = 0.7;
const M_SUN = 1.989e30;

interface GalaxyRow {
  name: string;
  V_flat: number;
  M_bar: number;
  z: number;
  V_si: number;
  M_si: number;
  Hz: number;
  a_obs: number;
  alpha: number;
  classification: "collective" | "transition" | "non-collective";
  btfr_ratio: number;
}

function Hz(z: number): number {
  return H0_SI * Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
}

function classify(alpha: number): GalaxyRow["classification"] {
  if (alpha >= 0.15 && alpha <= 0.25) return "collective";
  if ((alpha >= 0.10 && alpha < 0.15) || (alpha > 0.25 && alpha <= 0.35)) return "transition";
  return "non-collective";
}

const CLASS_COLORS: Record<GalaxyRow["classification"], string> = {
  collective: "hsl(142, 71%, 45%)",
  transition: "hsl(48, 96%, 53%)",
  "non-collective": "hsl(0, 84%, 60%)",
};

function parseCSV(text: string): GalaxyRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const iName = header.indexOf("name");
  const iV = header.findIndex(h => h.includes("v_flat") || h === "vflat" || h === "v");
  const iM = header.findIndex(h => h.includes("m_bar") || h === "mbar" || h === "m");
  const iZ = header.findIndex(h => h === "z" || h === "redshift");
  if (iV === -1 || iM === -1 || iZ === -1) return [];

  const rows: GalaxyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length < 3) continue;
    const name = iName >= 0 ? cols[iName] : `Galaxy ${i}`;
    const V_flat = parseFloat(cols[iV]);
    const M_bar = parseFloat(cols[iM]);
    const z = parseFloat(cols[iZ]);
    if (!isFinite(V_flat) || !isFinite(M_bar) || !isFinite(z) || M_bar <= 0) continue;

    const V_si = V_flat * 1000;
    const M_si = M_bar * M_SUN;
    const hz = Hz(z);
    const a_obs = Math.pow(V_si, 4) / (G * M_si);
    const alpha = a_obs / (c * hz);
    const btfr_ratio = V_flat / Math.pow(M_bar, 0.25);

    rows.push({
      name, V_flat, M_bar, z,
      V_si, M_si, Hz: hz, a_obs, alpha,
      classification: classify(alpha),
      btfr_ratio,
    });
  }
  return rows;
}

const SAMPLE_CSV = `name,V_flat,M_bar,z
NGC_2403,136,3.2e9,0.00044
NGC_3198,150,1.2e10,0.0022
NGC_7331,250,7.9e10,0.0027
UGC_128,130,2.1e9,0.014
NGC_2841,310,1.5e11,0.0021
DDO_154,47,3.0e7,0.0012
NGC_6946,200,4.5e10,0.00013
IC_2574,65,1.5e8,0.0015
NGC_3521,220,6.0e10,0.0027
NGC_5055,200,5.0e10,0.0017
UGC_2953,260,1.1e11,0.023
NGC_3031,225,7.0e10,0.00012
NGC_925,115,5.5e9,0.0018
NGC_4736,180,2.5e10,0.001
NGC_2976,85,1.0e9,0.00004`;

function exportCSV(data: GalaxyRow[]) {
  const header = "name,V_flat,M_bar,z,a_obs,H(z),alpha,classification";
  const rows = data.map(d =>
    `${d.name},${d.V_flat},${d.M_bar},${d.z},${d.a_obs.toExponential(6)},${d.Hz.toExponential(6)},${d.alpha.toFixed(6)},${d.classification}`
  );
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "galaxy_analysis_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function GalaxyDataLab() {
  const [data, setData] = useState<GalaxyRow[]>([]);
  const [showBands, setShowBands] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [showPasteArea, setShowPasteArea] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleText = useCallback((text: string) => {
    setData(parseCSV(text));
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleText(reader.result as string);
    reader.readAsText(file);
  }, [handleText]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const collective = data.filter(d => d.classification === "collective").length;
    const transition = data.filter(d => d.classification === "transition").length;
    const nonColl = data.filter(d => d.classification === "non-collective").length;
    const meanAlpha = data.reduce((s, d) => s + d.alpha, 0) / data.length;
    return { collective, transition, nonColl, meanAlpha, total: data.length };
  }, [data]);

  const histogramData = useMemo(() => {
    if (!data.length) return [];
    const bins = 20;
    const alphas = data.map(d => d.alpha);
    const min = Math.min(...alphas);
    const max = Math.max(...alphas);
    const range = max - min || 1;
    const step = range / bins;
    const counts = Array(bins).fill(0);
    alphas.forEach(a => {
      const idx = Math.min(Math.floor((a - min) / step), bins - 1);
      counts[idx]++;
    });
    return counts.map((count, i) => {
      const center = min + (i + 0.5) * step;
      return { alpha: +center.toFixed(4), count, classification: classify(center) };
    });
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Input controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <Button
          variant="outline" size="sm"
          className="border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" /> Upload CSV
        </Button>
        <Button
          variant="outline" size="sm"
          className="border-accent/30 text-accent hover:bg-accent/10"
          onClick={() => setShowPasteArea(p => !p)}
        >
          <ClipboardPaste className="w-4 h-4 mr-2" /> Paste CSV
        </Button>
        <Button
          variant="outline" size="sm"
          className="border-accent/30 text-accent hover:bg-accent/10"
          onClick={() => { handleText(SAMPLE_CSV); setCsvText(SAMPLE_CSV); }}
        >
          <Database className="w-4 h-4 mr-2" /> Load Sample Data
        </Button>
        {data.length > 0 && (
          <Button
            variant="outline" size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => exportCSV(data)}
          >
            <Download className="w-4 h-4 mr-2" /> Export Results
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Classification bands</span>
          <Switch checked={showBands} onCheckedChange={setShowBands} />
        </div>
      </div>

      {/* Paste area */}
      {showPasteArea && (
        <div className="bg-card/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Paste CSV data below. Format: <code className="text-primary">name,V_flat,M_bar,z</code></p>
          <Textarea
            className="font-mono text-xs bg-background/50 min-h-[120px]"
            placeholder={`name,V_flat,M_bar,z\nNGC_2403,136,3.2e9,0.00044\n...`}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { handleText(csvText); setShowPasteArea(false); }}
          >
            Parse Data
          </Button>
        </div>
      )}

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Galaxies", value: stats.total, color: "text-foreground" },
            { label: "Collective", value: stats.collective, color: "text-green-400" },
            { label: "Transition", value: stats.transition, color: "text-yellow-400" },
            { label: "Non-collective", value: stats.nonColl, color: "text-red-400" },
            { label: "⟨α⟩", value: stats.meanAlpha.toFixed(4), color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="bg-card/50 border border-border rounded-lg p-3 text-center">
              <div className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {!data.length && (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Upload a CSV, paste data, or load sample data to begin analysis</p>
          <p className="text-xs mt-1 opacity-60">Required columns: name, V_flat, M_bar, z</p>
        </div>
      )}

      {data.length > 0 && (
        <>
          {/* Raw input table */}
          <div className="bg-card/30 border border-border rounded-xl overflow-hidden">
            <h4 className="text-sm font-semibold text-foreground px-4 pt-3 pb-1">Input Data</h4>
            <div className="max-h-[250px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs text-right">V_flat (km/s)</TableHead>
                    <TableHead className="text-xs text-right">M_bar (M☉)</TableHead>
                    <TableHead className="text-xs text-right">z</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-mono text-xs">{d.name}</TableCell>
                      <TableCell className="text-xs text-right">{d.V_flat}</TableCell>
                      <TableCell className="text-xs text-right">{d.M_bar.toExponential(2)}</TableCell>
                      <TableCell className="text-xs text-right">{d.z}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card/30 border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">α vs Redshift</h4>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  {showBands && (
                    <>
                      <ReferenceArea y1={0.15} y2={0.25} fill="hsla(142,71%,45%,0.08)" />
                      <ReferenceArea y1={0.10} y2={0.15} fill="hsla(48,96%,53%,0.06)" />
                      <ReferenceArea y1={0.25} y2={0.35} fill="hsla(48,96%,53%,0.06)" />
                    </>
                  )}
                  <XAxis dataKey="z" type="number" name="z" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "Redshift z", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="alpha" type="number" name="α" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "α", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload as GalaxyRow;
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 text-xs space-y-0.5">
                        <div className="font-semibold text-foreground">{d.name}</div>
                        <div>α = {d.alpha.toFixed(4)}</div>
                        <div>z = {d.z}</div>
                        <div className="capitalize" style={{ color: CLASS_COLORS[d.classification] }}>{d.classification}</div>
                      </div>
                    );
                  }} />
                  <Scatter data={data} shape="circle">
                    {data.map((d, i) => <Cell key={i} fill={CLASS_COLORS[d.classification]} r={5} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card/30 border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">BTFR Ratio vs Redshift</h4>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="z" type="number" name="z" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "Redshift z", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="btfr_ratio" type="number" name="V/M^¼" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "V / M^¼", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload as GalaxyRow;
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 text-xs space-y-0.5">
                        <div className="font-semibold text-foreground">{d.name}</div>
                        <div>V/M^¼ = {d.btfr_ratio.toFixed(4)}</div>
                        <div>z = {d.z}</div>
                      </div>
                    );
                  }} />
                  <Scatter data={data} shape="circle">
                    {data.map((d, i) => <Cell key={i} fill={CLASS_COLORS[d.classification]} r={5} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histogram */}
          <div className="bg-card/30 border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Distribution of α</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogramData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                {showBands && (
                  <>
                    <ReferenceArea x1={0.15} x2={0.25} fill="hsla(142,71%,45%,0.08)" />
                    <ReferenceLine x={0.15} stroke="hsl(142,71%,45%)" strokeDasharray="4 4" />
                    <ReferenceLine x={0.25} stroke="hsl(142,71%,45%)" strokeDasharray="4 4" />
                  </>
                )}
                <XAxis dataKey="alpha" type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "α", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((d, i) => <Cell key={i} fill={CLASS_COLORS[d.classification]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Computed results table */}
          <div className="bg-card/30 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h4 className="text-sm font-semibold text-foreground">Computed Results</h4>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => exportCSV(data)}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs text-right">V_flat</TableHead>
                    <TableHead className="text-xs text-right">M_bar</TableHead>
                    <TableHead className="text-xs text-right">z</TableHead>
                    <TableHead className="text-xs text-right">a_obs</TableHead>
                    <TableHead className="text-xs text-right">H(z)</TableHead>
                    <TableHead className="text-xs text-right">α</TableHead>
                    <TableHead className="text-xs text-right">V/M^¼</TableHead>
                    <TableHead className="text-xs text-center">Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-mono text-xs">{d.name}</TableCell>
                      <TableCell className="text-xs text-right">{d.V_flat}</TableCell>
                      <TableCell className="text-xs text-right">{d.M_bar.toExponential(2)}</TableCell>
                      <TableCell className="text-xs text-right">{d.z}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{d.a_obs.toExponential(3)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{d.Hz.toExponential(3)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{d.alpha.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{d.btfr_ratio.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-center">
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: CLASS_COLORS[d.classification] }} />
                        <span className="capitalize text-muted-foreground">{d.classification}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
