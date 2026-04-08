import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { Particle } from './engine';

interface ParticlesProps {
  particles: Particle[];
}

function ParticleMesh({ particles }: ParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorArr = useMemo(() => {
    const c = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      // Color by mass: low mass = cyan, high mass = gold
      const t = Math.min(1, (particles[i]?.mass ?? 1) / 2);
      c[i * 3] = 0.3 + t * 0.7;     // R
      c[i * 3 + 1] = 0.8 - t * 0.3;  // G
      c[i * 3 + 2] = 1.0 - t * 0.6;  // B
    }
    return c;
  }, [particles.length]);

  useFrame(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      dummy.position.set(p.x, p.y, p.z);
      const scale = 0.06 + p.mass * 0.04;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const t = Math.min(1, p.mass / 2);
      const color = new THREE.Color(0.3 + t * 0.7, 0.8 - t * 0.3, 1.0 - t * 0.6);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.count = particles.length;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 200]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
}

interface Scene3DProps {
  particles: Particle[];
  showGrid: boolean;
}

export default function Scene3D({ particles, showGrid }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#4fc3f7" />
      <ParticleMesh particles={particles} />
      {showGrid && (
        <Grid
          args={[16, 16]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#334155"
          sectionSize={4}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={20}
          infiniteGrid
          position={[0, -4, 0]}
        />
      )}
      <OrbitControls enableDamping dampingFactor={0.1} />
    </Canvas>
  );
}
