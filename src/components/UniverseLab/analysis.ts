// UniverseLab — Analysis functions (rotation, clusters, memory)
import type { AnalysisSnapshot } from './engine';

function safeNum(v: number, f = 0) { return Number.isFinite(v) ? v : f; }

// ===== ROTATION ANALYSIS =====
export interface RadialBin {
  r: number;
  v: number;
  a: number;
  count: number;
}

export interface RotationResult {
  bins: RadialBin[];
  plateauDetected: boolean;
  transitionRadius: number;
  gTransition: number;
}

export function analyzeRotation(snapshots: AnalysisSnapshot[], nBins = 8): RotationResult {
  const empty: RotationResult = { bins: [], plateauDetected: false, transitionRadius: 0, gTransition: 0 };
  if (snapshots.length < 10) return empty;

  // Use last 50 snapshots for time-averaging
  const recent = snapshots.slice(-50);
  const maxR = 4.0;
  const dr = maxR / nBins;
  const binV: number[][] = Array.from({ length: nBins }, () => []);

  for (const snap of recent) {
    // Compute centroid
    let cx = 0, cy = 0, cz = 0, tm = 0;
    for (const p of snap.particles) {
      cx += p.x * p.mass; cy += p.y * p.mass; cz += p.z * p.mass;
      tm += p.mass;
    }
    if (tm > 0) { cx /= tm; cy /= tm; cz /= tm; }

    for (const p of snap.particles) {
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Tangential velocity
      const vr = (dx * p.vx + dy * p.vy + dz * p.vz) / (r + 1e-6);
      const vTotal = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
      const vTan = Math.sqrt(Math.max(0, vTotal * vTotal - vr * vr));

      const bi = Math.min(Math.floor(r / dr), nBins - 1);
      if (bi >= 0) binV[bi].push(vTan);
    }
  }

  const bins: RadialBin[] = binV.map((vs, i) => {
    const r = (i + 0.5) * dr;
    const v = vs.length > 0 ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
    const a = r > 0 ? safeNum(v * v / r) : 0;
    return { r: safeNum(r), v: safeNum(v), a: safeNum(a), count: vs.length };
  }).filter(b => b.count > 2);

  // Detect plateau: check if outer bins have similar v (within 30%)
  let plateauDetected = false;
  let transitionRadius = 0;
  let gTransition = 0;

  if (bins.length >= 4) {
    const outerBins = bins.slice(Math.floor(bins.length / 2));
    const outerVs = outerBins.map(b => b.v);
    const meanV = outerVs.reduce((a, b) => a + b, 0) / outerVs.length;
    const maxDev = Math.max(...outerVs.map(v => Math.abs(v - meanV)));

    if (meanV > 0.05 && maxDev / meanV < 0.35) {
      plateauDetected = true;
      // Transition is where v first reaches ~80% of plateau
      for (const b of bins) {
        if (b.v >= meanV * 0.8) {
          transitionRadius = b.r;
          gTransition = b.a;
          break;
        }
      }
    }
  }

  return { bins, plateauDetected, transitionRadius: safeNum(transitionRadius), gTransition: safeNum(gTransition) };
}

// ===== CLUSTER ANALYSIS =====
export interface ClusterResult {
  clusterCount: number;
  meanParticlesPerCluster: number;
  clusteringStrength: number; // 0 = uniform, 1 = very clustered
}

export function analyzeClusters(snapshots: AnalysisSnapshot[], gridSize = 4): ClusterResult {
  const empty: ClusterResult = { clusterCount: 0, meanParticlesPerCluster: 0, clusteringStrength: 0 };
  if (snapshots.length < 5) return empty;

  // Average density grid over last 30 snapshots
  const recent = snapshots.slice(-30);
  const n3 = gridSize * gridSize * gridSize;
  const density = new Float32Array(n3);
  const domain = 8;
  const dx = domain / gridSize;

  for (const snap of recent) {
    for (const p of snap.particles) {
      const ix = Math.floor((p.x + domain / 2) / dx);
      const iy = Math.floor((p.y + domain / 2) / dx);
      const iz = Math.floor((p.z + domain / 2) / dx);
      if (ix >= 0 && ix < gridSize && iy >= 0 && iy < gridSize && iz >= 0 && iz < gridSize) {
        density[ix + iy * gridSize + iz * gridSize * gridSize] += 1;
      }
    }
  }

  // Normalize
  for (let i = 0; i < n3; i++) density[i] /= recent.length;

  // Find density peaks (cells above 2x mean)
  const mean = Array.from(density).reduce((a, b) => a + b, 0) / n3;
  let clusters = 0;
  let totalInClusters = 0;

  for (let i = 0; i < n3; i++) {
    if (density[i] > mean * 2 && density[i] > 1) {
      clusters++;
      totalInClusters += density[i];
    }
  }

  const meanPPC = clusters > 0 ? totalInClusters / clusters : 0;

  // Clustering strength: variance/mean ratio (index of dispersion)
  const variance = Array.from(density).reduce((s, d) => s + (d - mean) * (d - mean), 0) / n3;
  const strength = mean > 0 ? Math.min(1, variance / (mean * mean)) : 0;

  return {
    clusterCount: clusters,
    meanParticlesPerCluster: safeNum(meanPPC, 0),
    clusteringStrength: safeNum(strength, 0),
  };
}

// ===== MEMORY / OFFSET ANALYSIS =====
export interface MemoryResult {
  currentOffset: number;
  averageOffset: number;
  trend: 'growing' | 'shrinking' | 'stable';
  offsetDetected: boolean;
  offsetHistory: number[];
}

export function analyzeMemory(snapshots: AnalysisSnapshot[]): MemoryResult {
  const empty: MemoryResult = { currentOffset: 0, averageOffset: 0, trend: 'stable', offsetDetected: false, offsetHistory: [] };
  if (snapshots.length < 10) return empty;

  const offsets = snapshots.slice(-100).map(s => {
    const dx = s.massCentroid.x - s.kFieldPeak.x;
    const dy = s.massCentroid.y - s.kFieldPeak.y;
    const dz = s.massCentroid.z - s.kFieldPeak.z;
    return safeNum(Math.sqrt(dx * dx + dy * dy + dz * dz));
  });

  const current = offsets[offsets.length - 1];
  const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;

  // Trend: compare first half vs second half
  const half = Math.floor(offsets.length / 2);
  const firstHalf = offsets.slice(0, half);
  const secondHalf = offsets.slice(half);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  let trend: 'growing' | 'shrinking' | 'stable' = 'stable';
  const diff = avgSecond - avgFirst;
  if (Math.abs(diff) > 0.1) {
    trend = diff > 0 ? 'growing' : 'shrinking';
  }

  const offsetDetected = avg > 0.3;

  return {
    currentOffset: safeNum(current),
    averageOffset: safeNum(avg),
    trend,
    offsetDetected,
    offsetHistory: offsets.slice(-30),
  };
}
