// UniverseLab — Self-contained N-body + K-field engine
// Completely isolated from existing simulation code

const GRID = 16;
const DOMAIN = 8;
const DX = DOMAIN / GRID;

export interface SimParams {
  dt: number;
  G: number;
  softening: number;
  beta: number;
  alphaK: number;
  mu2: number;
  cK2: number;
  damping: number;
  particleCount: number;
  velocityClamp: number;
  kClampMin: number;
  kClampMax: number;
  kDotClamp: number;
  kDotDamping: number;
  // Equation toggles / sign control
  gravitySign: number;   // +1 or -1
  kFieldSign: number;    // +1 or -1
  enableGravity: boolean;
  enableKField: boolean;
  enableDamping: boolean;
}

export const DEFAULT_PARAMS: SimParams = {
  dt: 0.004,
  G: 1.0,
  softening: 0.4,
  beta: 1.5,
  alphaK: 0.3,
  mu2: 0.05,
  cK2: 0.02,
  damping: 0.002,
  particleCount: 80,
  velocityClamp: 15,
  kClampMin: 0.01,
  kClampMax: 15.0,
  kDotClamp: 20,
  kDotDamping: 0.98,
  gravitySign: 1,
  kFieldSign: 1,
  enableGravity: true,
  enableKField: true,
  enableDamping: true,
};

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  mass: number;
}

export interface AnalysisSnapshot {
  time: number;
  particles: { x: number; y: number; z: number; vx: number; vy: number; vz: number; mass: number }[];
  kFieldPeak: { x: number; y: number; z: number };
  massCentroid: { x: number; y: number; z: number };
  totalKE: number;
  totalKField: number;
}

export type InitialConditionType = 'clusters' | 'uniform' | 'mixed';

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function safeNum(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

function randGauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class UniverseLabEngine {
  particles: Particle[] = [];
  kField: Float32Array;
  kDot: Float32Array;
  time = 0;
  frameCount = 0;
  params: SimParams;

  private history: AnalysisSnapshot[] = [];
  private maxHistory = 300;

  constructor(params?: Partial<SimParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    const n = GRID * GRID * GRID;
    this.kField = new Float32Array(n).fill(1.0);
    this.kDot = new Float32Array(n).fill(0);
  }

  updateParams(p: Partial<SimParams>) {
    this.params = { ...this.params, ...p };
  }

  idx(ix: number, iy: number, iz: number): number {
    const w = ((ix % GRID) + GRID) % GRID;
    const h = ((iy % GRID) + GRID) % GRID;
    const d = ((iz % GRID) + GRID) % GRID;
    return w + h * GRID + d * GRID * GRID;
  }

  posToGrid(p: number): number {
    return (p + DOMAIN / 2) / DX;
  }

  gridToPos(i: number): number {
    return i * DX - DOMAIN / 2;
  }

  initParticles(type: InitialConditionType, count?: number) {
    const N = count ?? this.params.particleCount;
    this.particles = [];
    this.time = 0;
    this.frameCount = 0;
    this.history = [];
    this.kField.fill(1.0);
    this.kDot.fill(0);

    const half = DOMAIN / 2 * 0.7;

    if (type === 'clusters') {
      const nClusters = 2 + Math.floor(Math.random() * 3);
      const centers: number[][] = [];
      for (let c = 0; c < nClusters; c++) {
        centers.push([
          (Math.random() - 0.5) * half * 1.4,
          (Math.random() - 0.5) * half * 1.4,
          (Math.random() - 0.5) * half * 1.4,
        ]);
      }
      for (let i = 0; i < N; i++) {
        const c = centers[Math.floor(Math.random() * nClusters)];
        const spread = 0.4 + Math.random() * 0.6;
        this.particles.push({
          x: c[0] + randGauss() * spread,
          y: c[1] + randGauss() * spread,
          z: c[2] + randGauss() * spread,
          vx: randGauss() * 0.3,
          vy: randGauss() * 0.3,
          vz: randGauss() * 0.3,
          mass: 0.5 + Math.random() * 1.5,
        });
      }
    } else if (type === 'uniform') {
      for (let i = 0; i < N; i++) {
        this.particles.push({
          x: (Math.random() - 0.5) * half * 2,
          y: (Math.random() - 0.5) * half * 2,
          z: (Math.random() - 0.5) * half * 2,
          vx: randGauss() * 0.5,
          vy: randGauss() * 0.5,
          vz: randGauss() * 0.5,
          mass: 0.3 + Math.random() * 2.0,
        });
      }
    } else {
      const cx = (Math.random() - 0.5) * half;
      const cy = (Math.random() - 0.5) * half;
      const cz = (Math.random() - 0.5) * half;
      const halfN = Math.floor(N / 2);
      for (let i = 0; i < halfN; i++) {
        this.particles.push({
          x: cx + randGauss() * 0.5,
          y: cy + randGauss() * 0.5,
          z: cz + randGauss() * 0.5,
          vx: randGauss() * 0.2,
          vy: randGauss() * 0.2,
          vz: randGauss() * 0.2,
          mass: 0.8 + Math.random() * 1.2,
        });
      }
      for (let i = halfN; i < N; i++) {
        this.particles.push({
          x: (Math.random() - 0.5) * half * 2,
          y: (Math.random() - 0.5) * half * 2,
          z: (Math.random() - 0.5) * half * 2,
          vx: randGauss() * 0.4,
          vy: randGauss() * 0.4,
          vz: randGauss() * 0.4,
          mass: 0.3 + Math.random() * 1.5,
        });
      }
    }

    for (const p of this.particles) {
      p.x = clamp(p.x, -DOMAIN / 2, DOMAIN / 2);
      p.y = clamp(p.y, -DOMAIN / 2, DOMAIN / 2);
      p.z = clamp(p.z, -DOMAIN / 2, DOMAIN / 2);
    }
  }

  private depositMass(): Float32Array {
    const rho = new Float32Array(GRID * GRID * GRID);
    for (const p of this.particles) {
      const gx = this.posToGrid(p.x);
      const gy = this.posToGrid(p.y);
      const gz = this.posToGrid(p.z);
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const iz = Math.floor(gz);
      if (ix >= 0 && ix < GRID && iy >= 0 && iy < GRID && iz >= 0 && iz < GRID) {
        rho[this.idx(ix, iy, iz)] += p.mass;
      }
    }
    return rho;
  }

  private evolveKField(rho: Float32Array) {
    const { alphaK, mu2, cK2, dt, kClampMin, kClampMax, kDotClamp, kDotDamping } = this.params;
    const newK = new Float32Array(this.kField.length);

    for (let ix = 0; ix < GRID; ix++) {
      for (let iy = 0; iy < GRID; iy++) {
        for (let iz = 0; iz < GRID; iz++) {
          const i = this.idx(ix, iy, iz);
          const K = this.kField[i];

          const lap =
            (this.kField[this.idx(ix + 1, iy, iz)] + this.kField[this.idx(ix - 1, iy, iz)] +
             this.kField[this.idx(ix, iy + 1, iz)] + this.kField[this.idx(ix, iy - 1, iz)] +
             this.kField[this.idx(ix, iy, iz + 1)] + this.kField[this.idx(ix, iy, iz - 1)] -
             6 * K) / (DX * DX);

          const dKdt = alphaK * rho[i] - mu2 * (K - 1) + cK2 * K * K * lap;
          const newKdot = this.kDot[i] + dKdt * dt;
          const clampedKdot = clamp(safeNum(newKdot), -kDotClamp, kDotClamp);
          const newVal = K + clampedKdot * dt;
          newK[i] = clamp(safeNum(newVal, 1), kClampMin, kClampMax);
          this.kDot[i] = clampedKdot * kDotDamping;
        }
      }
    }
    this.kField.set(newK);
  }

  private kGradientAt(x: number, y: number, z: number): [number, number, number] {
    const gx = this.posToGrid(x);
    const gy = this.posToGrid(y);
    const gz = this.posToGrid(z);
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const iz = Math.floor(gz);

    if (ix < 1 || ix >= GRID - 1 || iy < 1 || iy >= GRID - 1 || iz < 1 || iz >= GRID - 1) {
      return [0, 0, 0];
    }

    const dKdx = (this.kField[this.idx(ix + 1, iy, iz)] - this.kField[this.idx(ix - 1, iy, iz)]) / (2 * DX);
    const dKdy = (this.kField[this.idx(ix, iy + 1, iz)] - this.kField[this.idx(ix, iy - 1, iz)]) / (2 * DX);
    const dKdz = (this.kField[this.idx(ix, iy, iz + 1)] - this.kField[this.idx(ix, iy, iz - 1)]) / (2 * DX);

    return [safeNum(dKdx), safeNum(dKdy), safeNum(dKdz)];
  }

  step() {
    const N = this.particles.length;
    if (N === 0) return;
    const { dt, G, softening, beta, damping, velocityClamp, gravitySign, kFieldSign, enableGravity, enableKField, enableDamping } = this.params;

    const rho = this.depositMass();
    if (enableKField) {
      this.evolveKField(rho);
    }

    const axArr = new Float32Array(N);
    const ayArr = new Float32Array(N);
    const azArr = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const pi = this.particles[i];
      let fgx = 0, fgy = 0, fgz = 0;

      if (enableGravity) {
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const pj = this.particles[j];
          const dx = pj.x - pi.x;
          const dy = pj.y - pi.y;
          const dz = pj.z - pi.z;
          const r2 = dx * dx + dy * dy + dz * dz + softening * softening;
          const r = Math.sqrt(r2);
          const f = G * pj.mass / (r2 * r);
          fgx += f * dx;
          fgy += f * dy;
          fgz += f * dz;
        }
        fgx *= gravitySign;
        fgy *= gravitySign;
        fgz *= gravitySign;
      }

      let kfx = 0, kfy = 0, kfz = 0;
      if (enableKField) {
        const [gkx, gky, gkz] = this.kGradientAt(pi.x, pi.y, pi.z);
        kfx = kFieldSign * beta * gkx;
        kfy = kFieldSign * beta * gky;
        kfz = kFieldSign * beta * gkz;
      }

      axArr[i] = safeNum(fgx + kfx);
      ayArr[i] = safeNum(fgy + kfy);
      azArr[i] = safeNum(fgz + kfz);
    }

    const bound = DOMAIN / 2;
    const damp = enableDamping ? damping : 0;
    for (let i = 0; i < N; i++) {
      const p = this.particles[i];
      p.vx = clamp(safeNum(p.vx + axArr[i] * dt - damp * p.vx), -velocityClamp, velocityClamp);
      p.vy = clamp(safeNum(p.vy + ayArr[i] * dt - damp * p.vy), -velocityClamp, velocityClamp);
      p.vz = clamp(safeNum(p.vz + azArr[i] * dt - damp * p.vz), -velocityClamp, velocityClamp);
      p.x = clamp(safeNum(p.x + p.vx * dt), -bound, bound);
      p.y = clamp(safeNum(p.y + p.vy * dt), -bound, bound);
      p.z = clamp(safeNum(p.z + p.vz * dt), -bound, bound);
    }

    this.time += dt;
    this.frameCount++;

    if (this.frameCount % 2 === 0) {
      this.recordSnapshot();
    }
  }

  private recordSnapshot() {
    const particles = this.particles.map(p => ({ ...p }));

    let cx = 0, cy = 0, cz = 0, totalM = 0;
    for (const p of particles) {
      cx += p.x * p.mass;
      cy += p.y * p.mass;
      cz += p.z * p.mass;
      totalM += p.mass;
    }
    if (totalM > 0) { cx /= totalM; cy /= totalM; cz /= totalM; }

    let maxK = -Infinity;
    let kpx = 0, kpy = 0, kpz = 0;
    for (let ix = 0; ix < GRID; ix++) {
      for (let iy = 0; iy < GRID; iy++) {
        for (let iz = 0; iz < GRID; iz++) {
          const v = this.kField[this.idx(ix, iy, iz)];
          if (v > maxK) {
            maxK = v;
            kpx = this.gridToPos(ix);
            kpy = this.gridToPos(iy);
            kpz = this.gridToPos(iz);
          }
        }
      }
    }

    let ke = 0;
    for (const p of particles) {
      ke += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
    }

    let kEnergy = 0;
    for (let i = 0; i < this.kField.length; i++) {
      const dK = this.kField[i] - 1;
      kEnergy += dK * dK;
    }

    this.history.push({
      time: this.time,
      particles,
      kFieldPeak: { x: kpx, y: kpy, z: kpz },
      massCentroid: { x: cx, y: cy, z: cz },
      totalKE: safeNum(ke),
      totalKField: safeNum(kEnergy),
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): AnalysisSnapshot[] {
    return this.history;
  }

  getLatestSnapshot(): AnalysisSnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}
