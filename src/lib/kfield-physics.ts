/**
 * Unified K-Field Physics Engine
 * 
 * Field equation:
 *   acc_K = c * K² * Laplacian(K) - 3 * H0 * vel_K - μ² * (K - 1) + α * ρ_mass
 * 
 * Particle force:
 *   F = -β * grad(K)
 * 
 * Integration: Leapfrog (symplectic, energy-conserving)
 */

// ─── Physical constants (scaled for visualization) ───
export const FIELD_CONSTANTS = {
  c: 1.0,        // field propagation coupling
  H0: 0.05,      // Hubble damping
  mu2: 1.0,      // vacuum restoring force (μ²)
  alpha: 0.8,    // mass-field coupling
  beta: 2.0,     // field-particle coupling (F = -β * gradK)
};

// ─── 1D Radial K-Field (for galaxy / acceleration simulations) ───
export class RadialKField {
  N: number;
  dr: number;
  K: Float64Array;
  Kdot: Float64Array;   // dK/dt
  laplacian: Float64Array;
  gradK: Float64Array;
  c: number;
  H0: number;
  mu2: number;
  alpha: number;

  constructor(N: number, rMax: number, params = FIELD_CONSTANTS) {
    this.N = N;
    this.dr = rMax / N;
    this.K = new Float64Array(N);
    this.Kdot = new Float64Array(N);
    this.laplacian = new Float64Array(N);
    this.gradK = new Float64Array(N);
    this.c = params.c;
    this.H0 = params.H0;
    this.mu2 = params.mu2;
    this.alpha = params.alpha;

    // Initialize K = 1 (vacuum equilibrium)
    for (let i = 0; i < N; i++) this.K[i] = 1.0;
  }

  /** r coordinate at grid index i */
  r(i: number): number {
    return (i + 0.5) * this.dr; // cell-centered to avoid r=0 singularity
  }

  /** Compute spherical Laplacian: (1/r²) d/dr(r² dK/dr) */
  computeLaplacian(): void {
    const { N, dr, K } = this;
    for (let i = 1; i < N - 1; i++) {
      const rr = this.r(i);
      const rPlus = this.r(i + 1);
      const rMinus = this.r(i - 1);
      // Second-order finite differences in spherical coords
      const dKdr_plus = (K[i + 1] - K[i]) / dr;
      const dKdr_minus = (K[i] - K[i - 1]) / dr;
      const flux_plus = rPlus * rPlus * dKdr_plus;
      const flux_minus = rMinus * rMinus * dKdr_minus;
      this.laplacian[i] = (flux_plus - flux_minus) / (rr * rr * dr);
    }
    // Boundaries: reflecting
    this.laplacian[0] = this.laplacian[1];
    this.laplacian[N - 1] = this.laplacian[N - 2];
  }

  /** Compute gradient: dK/dr */
  computeGradient(): void {
    const { N, dr, K } = this;
    for (let i = 1; i < N - 1; i++) {
      this.gradK[i] = (K[i + 1] - K[i - 1]) / (2 * dr);
    }
    this.gradK[0] = (K[1] - K[0]) / dr;
    this.gradK[N - 1] = (K[N - 1] - K[N - 2]) / dr;
  }

  /**
   * Advance the field by dt using Leapfrog integration.
   * massDensity: array of mass source term ρ(r) at each grid point.
   */
  step(dt: number, massDensity: Float64Array): void {
    const { N, K, Kdot, c, H0, mu2, alpha } = this;

    this.computeLaplacian();

    // Leapfrog: kick-drift-kick
    // Half kick
    for (let i = 0; i < N; i++) {
      const acc = c * K[i] * K[i] * this.laplacian[i]
        - 3 * H0 * Kdot[i]
        - mu2 * (K[i] - 1.0)
        + alpha * massDensity[i];
      Kdot[i] += acc * dt * 0.5;
      // Clamp magnitude to prevent blowup
      if (!isFinite(Kdot[i])) Kdot[i] = 0;
      else if (Kdot[i] > 50) Kdot[i] = 50;
      else if (Kdot[i] < -50) Kdot[i] = -50;
    }
    // Drift
    for (let i = 0; i < N; i++) {
      K[i] += Kdot[i] * dt;
      // Clamp K to physical range
      if (!isFinite(K[i])) K[i] = 1.0;
      else if (K[i] > 20) K[i] = 20;
      else if (K[i] < 0.01) K[i] = 0.01;
    }
    // Recompute Laplacian after drift
    this.computeLaplacian();
    // Half kick
    for (let i = 0; i < N; i++) {
      const acc = c * K[i] * K[i] * this.laplacian[i]
        - 3 * H0 * Kdot[i]
        - mu2 * (K[i] - 1.0)
        + alpha * massDensity[i];
      Kdot[i] += acc * dt * 0.5;
      if (!isFinite(Kdot[i])) Kdot[i] = 0;
      else if (Kdot[i] > 50) Kdot[i] = 50;
      else if (Kdot[i] < -50) Kdot[i] = -50;
    }

    this.computeGradient();
  }

  /**
   * Evolve the field until convergence or maxIter.
   * Convergence: max(|Kdot|) < threshold
   */
  stepToEquilibrium(
    dt: number,
    massDensity: Float64Array,
    threshold: number = 1e-4,
    maxIter: number = 2000
  ): number {
    let iter = 0;
    let converged = false;
    while (!converged && iter < maxIter) {
      this.step(dt, massDensity);
      iter++;
      // Check convergence every 10 steps
      if (iter % 10 === 0) {
        let maxKdot = 0;
        for (let i = 0; i < this.N; i++) {
          const v = Math.abs(this.Kdot[i]);
          if (v > maxKdot) maxKdot = v;
        }
        if (maxKdot < threshold) converged = true;
      }
    }
    this.computeGradient();
    return iter;
  }

  /** Compute total field energy: kinetic + potential */
  energy(): { kinetic: number; potential: number; total: number } {
    let kinetic = 0;
    let potential = 0;
    for (let i = 0; i < this.N; i++) {
      const rr = this.r(i);
      const vol = 4 * Math.PI * rr * rr * this.dr;
      const ke = 0.5 * this.Kdot[i] * this.Kdot[i] * vol;
      const pe = 0.5 * this.mu2 * (this.K[i] - 1.0) ** 2 * vol;
      if (isFinite(ke)) kinetic += ke;
      if (isFinite(pe)) potential += pe;
    }
    const total = kinetic + potential;
    return {
      kinetic: isFinite(kinetic) ? kinetic : 0,
      potential: isFinite(potential) ? potential : 0,
      total: isFinite(total) ? total : 0,
    };
  }
}

// ─── 3D K-Field (for universe geometry visualization) ───
export class KField3D {
  N: number;
  dx: number;
  K: Float64Array;
  Kdot: Float64Array;
  laplacian: Float64Array;
  c: number;
  H0: number;
  mu2: number;
  alpha: number;
  periodic: boolean; // true = S³-like (closed), false = flat (open)

  constructor(N: number, size: number, periodic: boolean, params = FIELD_CONSTANTS) {
    this.N = N;
    this.dx = size / N;
    this.K = new Float64Array(N * N * N);
    this.Kdot = new Float64Array(N * N * N);
    this.laplacian = new Float64Array(N * N * N);
    this.c = params.c;
    this.H0 = params.H0;
    this.mu2 = params.mu2;
    this.alpha = params.alpha;
    this.periodic = periodic;

    // Initialize K = 1
    for (let i = 0; i < this.K.length; i++) this.K[i] = 1.0;
  }

  idx(x: number, y: number, z: number): number {
    const N = this.N;
    if (this.periodic) {
      x = ((x % N) + N) % N;
      y = ((y % N) + N) % N;
      z = ((z % N) + N) % N;
    } else {
      x = Math.max(0, Math.min(N - 1, x));
      y = Math.max(0, Math.min(N - 1, y));
      z = Math.max(0, Math.min(N - 1, z));
    }
    return x * N * N + y * N + z;
  }

  computeLaplacian(): void {
    const { N, dx, K } = this;
    const dx2 = dx * dx;
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const i = this.idx(x, y, z);
          const lap = (
            K[this.idx(x + 1, y, z)] + K[this.idx(x - 1, y, z)]
            + K[this.idx(x, y + 1, z)] + K[this.idx(x, y - 1, z)]
            + K[this.idx(x, y, z + 1)] + K[this.idx(x, y, z - 1)]
            - 6 * K[i]
          ) / dx2;
          this.laplacian[i] = lap;
        }
      }
    }
  }

  /** Gradient at a point (returns [gx, gy, gz]) */
  gradient(x: number, y: number, z: number): [number, number, number] {
    const dx2 = 2 * this.dx;
    return [
      (this.K[this.idx(x + 1, y, z)] - this.K[this.idx(x - 1, y, z)]) / dx2,
      (this.K[this.idx(x, y + 1, z)] - this.K[this.idx(x, y - 1, z)]) / dx2,
      (this.K[this.idx(x, y, z + 1)] - this.K[this.idx(x, y, z - 1)]) / dx2,
    ];
  }

  step(dt: number, massDensity: Float64Array): void {
    const total = this.N ** 3;
    const { K, Kdot, c, H0, mu2, alpha } = this;

    this.computeLaplacian();

    // Leapfrog KDK
    for (let i = 0; i < total; i++) {
      const acc = c * K[i] * K[i] * this.laplacian[i]
        - 3 * H0 * Kdot[i]
        - mu2 * (K[i] - 1.0)
        + alpha * massDensity[i];
      Kdot[i] += acc * dt * 0.5;
    }
    for (let i = 0; i < total; i++) {
      K[i] += Kdot[i] * dt;
    }
    this.computeLaplacian();
    for (let i = 0; i < total; i++) {
      const acc = c * K[i] * K[i] * this.laplacian[i]
        - 3 * H0 * Kdot[i]
        - mu2 * (K[i] - 1.0)
        + alpha * massDensity[i];
      Kdot[i] += acc * dt * 0.5;
    }
  }

  /** Interpolate K at continuous coordinates */
  sample(fx: number, fy: number, fz: number): number {
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    return this.K[this.idx(ix, iy, iz)];
  }

  /** Interpolated gradient at continuous coords */
  sampleGradient(fx: number, fy: number, fz: number): [number, number, number] {
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    return this.gradient(ix, iy, iz);
  }
}

// ─── Particle driven by K-field ───
export interface KFieldParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
}

/**
 * Update particles via F = -β * grad(K), leapfrog integration.
 * Works with RadialKField (2D projected) or KField3D.
 */
export function stepParticlesRadial(
  particles: KFieldParticle[],
  field: RadialKField,
  dt: number,
  beta: number = FIELD_CONSTANTS.beta
): void {
  for (const p of particles) {
    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    if (r < field.dr) continue; // skip center

    // Find grid index
    const gi = Math.min(Math.floor(r / field.dr), field.N - 1);
    const dKdr = field.gradK[gi];

    // Radial force: F = +β * dK/dr (attract toward high-K regions where mass is)
    const Fr = beta * dKdr;
    const ax = Fr * (p.x / r);
    const ay = Fr * (p.y / r);

    // Leapfrog
    p.vx += ax * dt;
    p.vy += ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function stepParticles3D(
  particles: KFieldParticle[],
  field: KField3D,
  dt: number,
  beta: number = FIELD_CONSTANTS.beta
): void {
  const halfN = field.N / 2;
  for (const p of particles) {
    // Map particle coords to grid coords
    const gx = p.x / field.dx + halfN;
    const gy = p.y / field.dx + halfN;
    const gz = p.z / field.dx + halfN;

    const [gkx, gky, gkz] = field.sampleGradient(gx, gy, gz);

    const ax = beta * gkx;
    const ay = beta * gky;
    const az = beta * gkz;

    p.vx += ax * dt;
    p.vy += ay * dt;
    p.vz += az * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
  }
}

/**
 * Deposit particle masses onto a radial grid as source density.
 */
export function depositMassRadial(
  particles: KFieldParticle[],
  centralMass: number,
  field: RadialKField
): Float64Array {
  const density = new Float64Array(field.N);

  // Central mass deposited in first few cells (smoothed)
  const smoothR = 3;
  for (let i = 0; i < smoothR && i < field.N; i++) {
    const rr = field.r(i);
    const vol = 4 * Math.PI * rr * rr * field.dr;
    density[i] += centralMass / (smoothR * vol + 1e-30);
  }

  // Particle contributions
  for (const p of particles) {
    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    const gi = Math.min(Math.floor(r / field.dr), field.N - 1);
    const rr = field.r(gi);
    const vol = 4 * Math.PI * rr * rr * field.dr;
    density[gi] += p.mass / (vol + 1e-30);
  }

  return density;
}

/**
 * Deposit mass for 3D field.
 */
export function depositMass3D(
  particles: KFieldParticle[],
  field: KField3D,
  centralMass: number = 0
): Float64Array {
  const total = field.N ** 3;
  const density = new Float64Array(total);
  const halfN = field.N / 2;

  // Central mass
  if (centralMass > 0) {
    const ci = field.idx(halfN, halfN, halfN);
    density[ci] += centralMass;
  }

  for (const p of particles) {
    const gx = Math.floor(p.x / field.dx + halfN);
    const gy = Math.floor(p.y / field.dx + halfN);
    const gz = Math.floor(p.z / field.dx + halfN);
    const i = field.idx(gx, gy, gz);
    density[i] += p.mass;
  }

  return density;
}
