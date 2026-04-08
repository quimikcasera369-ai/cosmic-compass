import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Pause, RotateCcw, Shuffle } from 'lucide-react';
import Scene3D from './Scene3D';
import { UniverseLabEngine, type InitialConditionType } from './engine';
import { analyzeRotation, analyzeClusters, analyzeMemory, type RotationResult, type ClusterResult, type MemoryResult } from './analysis';

const IC_TYPES: InitialConditionType[] = ['clusters', 'uniform', 'mixed'];

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

  const reset = useCallback((type: InitialConditionType) => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    engineRef.current.initParticles(type, 80);
    setParticles([...engineRef.current.particles]);
    setTime(0);
    setRotation(null);
    setCluster(null);
    setMemory(null);
  }, []);

  useEffect(() => { reset('clusters'); }, []);

  const loop = useCallback(() => {
    const eng = engineRef.current;
    for (let i = 0; i < 3; i++) eng.step(); // 3 substeps per frame
    setParticles([...eng.particles]);
    setTime(eng.time);

    // Run analysis every 10 frames
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
      {/* Simulation */}
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
                <Button
                  key={t}
                  size="sm"
                  variant={icType === t ? 'default' : 'outline'}
                  className="text-xs h-7 px-2"
                  onClick={() => { setIcType(t); reset(t); }}
                >
                  {t}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setIcType(IC_TYPES[Math.floor(Math.random() * 3)]); reset(IC_TYPES[Math.floor(Math.random() * 3)]); }}>
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

      {/* Three Analysis Panels */}
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
                        <TableHead className="text-[10px] py-1 px-2">r</TableHead>
                        <TableHead className="text-[10px] py-1 px-2">v(r)</TableHead>
                        <TableHead className="text-[10px] py-1 px-2">a(r)</TableHead>
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
                    <div>g_transition: <span className="text-primary font-mono">{fmt(rotation.gTransition, 4)}</span></div>
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
                <div className="text-[11px] text-muted-foreground">
                  {cluster.clusteringStrength > 0.3
                    ? 'Strong density concentration detected'
                    : cluster.clusteringStrength > 0.1
                    ? 'Moderate clustering observed'
                    : 'Nearly uniform distribution'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Collecting data…</p>
            )}
          </CardContent>
        </Card>

        {/* C) Memory / Offset Analysis */}
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
                {/* Mini offset history chart */}
                {memory.offsetHistory.length > 3 && (
                  <div className="h-12 flex items-end gap-px">
                    {memory.offsetHistory.map((v, i) => {
                      const maxV = Math.max(...memory.offsetHistory, 0.1);
                      const h = Math.max(1, (v / maxV) * 100);
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            background: v > 0.3 ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.3)',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {memory.offsetDetected
                    ? 'Mass–field offset persists (Bullet-cluster analogue)'
                    : 'Mass and K-field peaks coincide'}
                </div>
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
