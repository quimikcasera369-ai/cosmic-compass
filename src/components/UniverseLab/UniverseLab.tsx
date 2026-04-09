import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Pause, RotateCcw, Shuffle } from 'lucide-react';
import Scene3D from './Scene3D';
import { UniverseLabEngine, DEFAULT_PARAMS, type InitialConditionType, type SimParams } from './engine';
import { analyzeRotation, analyzeClusters, analyzeMemory, type RotationResult, type ClusterResult, type MemoryResult } from './analysis';
import LatexBlock from './LatexBlock';

const IC_TYPES: InitialConditionType[] = ['clusters', 'uniform', 'mixed'];

/* ── Equation definitions (editable LaTeX + sign/toggle) ── */
interface EquationDef {
  id: string;
  label: string;
  latex: string;
  paramKey?: keyof SimParams; // toggle key
  signKey?: keyof SimParams;  // sign key
}

const DEFAULT_EQUATIONS: EquationDef[] = [
  {
    id: 'kfield',
    label: 'K-Field Evolution',
    latex: '\\frac{\\partial^2 K}{\\partial t^2} = \\alpha_K \\rho - \\mu^2 (K-1) + c_K^2 K^2 \\nabla^2 K',
    paramKey: 'enableKField',
  },
  {
    id: 'gravity',
    label: 'Newtonian Gravity',
    latex: '\\mathbf{a}_N = -G \\sum_j \\frac{m_j (\\mathbf{r}_j - \\mathbf{r}_i)}{|\\mathbf{r}_j - \\mathbf{r}_i|^3}',
    paramKey: 'enableGravity',
    signKey: 'gravitySign',
  },
  {
    id: 'kforce',
    label: 'K-Field Force',
    latex: '\\mathbf{a}_K = \\pm \\beta \\nabla K',
    paramKey: 'enableKField',
    signKey: 'kFieldSign',
  },
  {
    id: 'total',
    label: 'Total Acceleration',
    latex: '\\mathbf{a} = \\mathbf{a}_N + \\mathbf{a}_K',
  },
  {
    id: 'damping',
    label: 'Velocity Damping',
    latex: '\\mathbf{v} \\leftarrow \\mathbf{v} - \\gamma \\mathbf{v}',
    paramKey: 'enableDamping',
  },
];

/* ── Parameter definitions ── */
interface ParamDef {
  key: keyof SimParams;
  label: string;
  latex: string;
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
}

const PARAM_DEFS: ParamDef[] = [
  { key: 'dt', label: 'Time step', latex: '\\Delta t', min: 0.001, max: 0.05, step: 0.001 },
  { key: 'G', label: 'Gravitational constant', latex: 'G', min: 0, max: 10, step: 0.1 },
  { key: 'beta', label: 'K-field coupling', latex: '\\beta', min: 0, max: 10, step: 0.1 },
  { key: 'alphaK', label: 'Source coupling', latex: '\\alpha_K', min: 0, max: 5, step: 0.05 },
  { key: 'mu2', label: 'Mass term', latex: '\\mu^2', min: 0, max: 2, step: 0.01 },
  { key: 'cK2', label: 'Field speed²', latex: 'c_K^2', min: 0, max: 1, step: 0.005 },
  { key: 'damping', label: 'Velocity damping', latex: '\\gamma', min: 0, max: 0.1, step: 0.001 },
  { key: 'softening', label: 'Softening length', latex: '\\epsilon', min: 0.05, max: 2, step: 0.05 },
  { key: 'particleCount', label: 'Particle count', latex: 'N', min: 10, max: 200, step: 10, isInt: true },
  { key: 'velocityClamp', label: 'Velocity clamp', latex: 'v_{\\max}', min: 1, max: 50, step: 1 },
  { key: 'kClampMax', label: 'K max clamp', latex: 'K_{\\max}', min: 2, max: 50, step: 1 },
  { key: 'kDotClamp', label: 'K̇ clamp', latex: '\\dot{K}_{\\max}', min: 5, max: 100, step: 5 },
  { key: 'kDotDamping', label: 'K̇ damping', latex: '\\eta_K', min: 0.8, max: 1.0, step: 0.005 },
];

export default function UniverseLab() {
  const engineRef = useRef(new UniverseLabEngine());
  const rafRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [icType, setIcType] = useState<InitialConditionType>('clusters');
  const [particles, setParticles] = useState(engineRef.current.particles);
  const [time, setTime] = useState(0);
  const [rotation, setRotation] = useState<RotationResult | null>(null);
  const [cluster, setCluster] = useState<ClusterResult | null>(null);
  const [memory, setMemory] = useState<MemoryResult | null>(null);
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [equations, setEquations] = useState<EquationDef[]>(DEFAULT_EQUATIONS);

  const updateParam = useCallback((key: keyof SimParams, value: number | boolean) => {
    setParams(prev => {
      const next = { ...prev, [key]: value };
      engineRef.current.updateParams(next);
      return next;
    });
  }, []);

  const updateEquationLatex = useCallback((id: string, newLatex: string) => {
    setEquations(prev => prev.map(eq => eq.id === id ? { ...eq, latex: newLatex } : eq));
  }, []);

  const reset = useCallback((type: InitialConditionType) => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    engineRef.current.initParticles(type, params.particleCount);
    setParticles([...engineRef.current.particles]);
    setTime(0);
    setRotation(null);
    setCluster(null);
    setMemory(null);
  }, [params.particleCount]);

  useEffect(() => { reset('clusters'); }, []);

  const loop = useCallback(() => {
    const eng = engineRef.current;
    for (let i = 0; i < 3; i++) eng.step();
    setParticles([...eng.particles]);
    setTime(eng.time);

    if (eng.frameCount % 10 === 0) {
      const h = eng.getHistory();
      setRotation(analyzeRotation(h));
      setCluster(analyzeClusters(h));
      setMemory(analyzeMemory(h));
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, loop]);

  const fmt = (v: number, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '—';

  return (
    <div className="space-y-4">
      {/* ══════════ Simulation ══════════ */}
      <Card className="border-primary/20 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg text-primary">Universe Lab — 3D Simulation</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs text-muted-foreground">
                t = {fmt(time, 2)} · N = {particles.length}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Grid</span>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              {IC_TYPES.map(t => (
                <Button key={t} size="sm" variant={icType === t ? 'default' : 'outline'} className="text-xs h-7 px-2"
                  onClick={() => { setIcType(t); reset(t); }}>
                  {t}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => {
                const t = IC_TYPES[Math.floor(Math.random() * 3)];
                setIcType(t); reset(t);
              }}>
                <Shuffle className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => reset(icType)}>
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button size="sm" className="h-7 px-2" onClick={() => setRunning(!running)}>
                {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[350px] md:h-[420px] rounded-b-lg overflow-hidden bg-background/50">
            <Scene3D particles={particles} showGrid={showGrid} />
          </div>
        </CardContent>
      </Card>

      {/* ══════════ EQUATIONS TABLE ══════════ */}
      <Card className="border-accent/20 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-accent">Governing Equations</CardTitle>
          <p className="text-xs text-muted-foreground">Toggle, invert signs, or edit the LaTeX source of each equation live.</p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] py-1 px-2 w-[120px]">Equation</TableHead>
                  <TableHead className="text-[11px] py-1 px-2">Rendered</TableHead>
                  <TableHead className="text-[11px] py-1 px-2 w-[90px]">Active</TableHead>
                  <TableHead className="text-[11px] py-1 px-2 w-[90px]">Sign</TableHead>
                  <TableHead className="text-[11px] py-1 px-2">LaTeX Source (editable)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equations.map(eq => (
                  <TableRow key={eq.id}>
                    <TableCell className="text-[11px] py-1 px-2 font-medium">{eq.label}</TableCell>
                    <TableCell className="py-1 px-2">
                      <LatexBlock tex={eq.latex} display={false} className="text-foreground" />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      {eq.paramKey ? (
                        <Switch
                          checked={!!params[eq.paramKey]}
                          onCheckedChange={(v) => updateParam(eq.paramKey!, v)}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">always</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      {eq.signKey ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs font-mono"
                          onClick={() => updateParam(eq.signKey!, (params[eq.signKey!] as number) * -1)}
                        >
                          {(params[eq.signKey!] as number) > 0 ? '+' : '−'}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        className="h-7 text-[11px] font-mono bg-muted/30 border-border"
                        value={eq.latex}
                        onChange={(e) => updateEquationLatex(eq.id, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ══════════ PARAMETERS TABLE ══════════ */}
      <Card className="border-secondary/20 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-secondary">Simulation Parameters</CardTitle>
          <p className="text-xs text-muted-foreground">Adjust all variables in real time. Changes apply immediately to the running simulation.</p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PARAM_DEFS.map(pd => {
              const val = params[pd.key] as number;
              return (
                <div key={pd.key} className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <LatexBlock tex={pd.latex} className="text-primary text-sm" />
                      <span className="text-[10px] text-muted-foreground">{pd.label}</span>
                    </div>
                    <span className="text-xs font-mono text-foreground">{pd.isInt ? val : val.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={pd.min}
                    max={pd.max}
                    step={pd.step}
                    value={val}
                    onChange={(e) => {
                      const v = pd.isInt ? parseInt(e.target.value) : parseFloat(e.target.value);
                      updateParam(pd.key, v);
                    }}
                    className="w-full h-1.5 accent-primary bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>{pd.min}</span>
                    <span>{pd.max}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => {
              setParams({ ...DEFAULT_PARAMS });
              engineRef.current.updateParams(DEFAULT_PARAMS);
            }}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ══════════ Three Analysis Panels ══════════ */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* A) Rotation Analysis */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary">A) Rotation Analysis</CardTitle>
              {rotation && (
                <Badge variant={rotation.plateauDetected ? 'default' : 'outline'} className={rotation.plateauDetected ? 'bg-green-600 text-white text-[10px]' : 'text-[10px]'}>
                  {rotation.plateauDetected ? '✔ Emergent rotation law' : '✖ No plateau'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {rotation && rotation.bins.length > 0 ? (
              <>
                <div className="overflow-auto max-h-[180px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] py-1 px-2"><LatexBlock tex="r" /></TableHead>
                        <TableHead className="text-[10px] py-1 px-2"><LatexBlock tex="v(r)" /></TableHead>
                        <TableHead className="text-[10px] py-1 px-2"><LatexBlock tex="a(r)" /></TableHead>
                        <TableHead className="text-[10px] py-1 px-2">N</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rotation.bins.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px] py-0.5 px-2 font-mono">{fmt(b.r, 2)}</TableCell>
                          <TableCell className="text-[10px] py-0.5 px-2 font-mono">{fmt(b.v, 3)}</TableCell>
                          <TableCell className="text-[10px] py-0.5 px-2 font-mono">{fmt(b.a, 3)}</TableCell>
                          <TableCell className="text-[10px] py-0.5 px-2 font-mono">{b.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rotation.plateauDetected && (
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    <div>Transition radius: <span className="text-primary font-mono">{fmt(rotation.transitionRadius, 2)}</span></div>
                    <div><LatexBlock tex="g_{\\text{transition}}" className="text-primary" />: <span className="text-primary font-mono">{fmt(rotation.gTransition, 4)}</span></div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Collecting data…</p>
            )}
          </CardContent>
        </Card>

        {/* B) Cluster Analysis */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary">B) Cluster / Structure</CardTitle>
              {cluster && (
                <Badge variant={cluster.clusterCount >= 2 ? 'default' : 'outline'} className={cluster.clusterCount >= 2 ? 'bg-green-600 text-white text-[10px]' : 'text-[10px]'}>
                  {cluster.clusterCount >= 2 ? '✔ Structure formation' : '✖ Not detected'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {cluster ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Clusters" value={cluster.clusterCount.toString()} />
                  <MetricBox label="Mean N/cluster" value={fmt(cluster.meanParticlesPerCluster, 1)} />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Clustering Strength</div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, cluster.clusteringStrength * 100)}%`,
                        background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-right text-muted-foreground font-mono mt-0.5">{fmt(cluster.clusteringStrength, 3)}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Collecting data…</p>
            )}
          </CardContent>
        </Card>

        {/* C) Memory / Offset */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary">C) Memory / Offset</CardTitle>
              {memory && (
                <Badge variant={memory.offsetDetected ? 'default' : 'outline'} className={memory.offsetDetected ? 'bg-green-600 text-white text-[10px]' : 'text-[10px]'}>
                  {memory.offsetDetected ? '✔ Memory effect' : '✖ No offset'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {memory ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Current Δx" value={fmt(memory.currentOffset, 3)} />
                  <MetricBox label="Average Δx" value={fmt(memory.averageOffset, 3)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Trend:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {memory.trend === 'growing' ? '↗ Growing' : memory.trend === 'shrinking' ? '↘ Shrinking' : '→ Stable'}
                  </Badge>
                </div>
                {memory.offsetHistory.length > 3 && (
                  <div className="h-12 flex items-end gap-px">
                    {memory.offsetHistory.map((v, i) => {
                      const maxV = Math.max(...memory.offsetHistory, 0.1);
                      const h = Math.max(1, (v / maxV) * 100);
                      return (
                        <div key={i} className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            background: v > 0.3 ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.3)',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Collecting data…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground">{value}</div>
    </div>
  );
}
