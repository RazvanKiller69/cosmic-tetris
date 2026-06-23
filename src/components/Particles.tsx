/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Vector3 } from '../store/useGameStore';
import { computeCurl } from '../utils/curlNoise';

const MAX_PARTICLES = 10000;
const PARTICLE_LIFETIME = 3.0; // seconds
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

interface Particle {
  active: boolean;
  hidden: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  baseColor: THREE.Color;
  life: number;
}

export function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Initialize instanceColor
  React.useEffect(() => {
    if (meshRef.current) {
      const color = new THREE.Color();
      for (let i = 0; i < MAX_PARTICLES; i++) {
        meshRef.current.setColorAt(i, color);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, []);

  const forceFields = useGameStore((state) => state.forceFields);

  const particles = useMemo(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      arr.push({
        active: false,
        hidden: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        baseColor: new THREE.Color(),
        life: 0,
      });
    }
    return arr;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnIndex = useRef(0);

  const spawnParticle = (pos: THREE.Vector3, colorHex: string, isExplosion = false, isTrail = false) => {
    const p = particles[spawnIndex.current];
    p.active = true;
    p.hidden = false;
    p.position.copy(pos);
    
    if (isTrail) {
      // Very slight spread for trails to keep them tight
      p.position.x += (Math.random() - 0.5) * 0.5;
      p.position.y += (Math.random() - 0.5) * 0.5;
      p.position.z += (Math.random() - 0.5) * 0.5;
      
      p.velocity.set(
        (Math.random() - 0.5) * 1.0,
        Math.random() * 2.0, // mostly up
        (Math.random() - 0.5) * 1.0
      );
      p.life = 0.5 + Math.random() * 0.5; // Short life for fast trails
    } else {
      // Add explosion or normal spread
      p.position.x += (Math.random() - 0.5) * 1.5;
      p.position.y += (Math.random() - 0.5) * 1.5;
      p.position.z += (Math.random() - 0.5) * 1.5;
      
      if (isExplosion) {
        p.velocity.set(
          (Math.random() - 0.5) * 25.0,
          Math.random() * 8.0 - 2.0, // mostly up/out
          (Math.random() - 0.5) * 25.0
        );
        p.life = 1.0 + Math.random() * 2.0; // shorter life for explosion
      } else {
        p.velocity.set(
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0
        );
        p.life = PARTICLE_LIFETIME;
      }
    }

    p.color.set(colorHex);
    p.baseColor.set(colorHex);

    spawnIndex.current = (spawnIndex.current + 1) % MAX_PARTICLES;
  };

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Spawn from explosions
    const { explosions, clearExplosions, trails, clearTrails, settings } = useGameStore.getState();
    
    if (explosions.length > 0) {
      if (settings.showExplosions) {
        for (const exp of explosions) {
          const ePos = new THREE.Vector3(exp.position.x, exp.position.y, exp.position.z);
          // Explosions spawn per block, tighter burst
          for (let i = 0; i < 60; i++) {
            const spawnPos = ePos.clone();
            // Distribute along the block size roughly
            spawnPos.x += (Math.random() - 0.5) * 1.5; 
            spawnPos.y += (Math.random() - 0.5) * 1.5; 
            spawnPos.z += (Math.random() - 0.5) * 2.0; 
            spawnParticle(spawnPos, exp.color, true);
          }
        }
      }
      clearExplosions();
    }

    if (trails.length > 0) {
      if (settings.showBlockTrails) {
        for (const trail of trails) {
          // Spawn particles along the path
          const start = new THREE.Vector3(trail.start.x, trail.start.y, trail.start.z);
          const end = new THREE.Vector3(trail.end.x, trail.end.y, trail.end.z);
          const distance = start.distanceTo(end);
          
          // Spawn more particles depending on distance
          const numParticles = Math.max(10, Math.floor(distance * 15));
          
          for (let i = 0; i < numParticles; i++) {
            const t = i / numParticles;
            const spawnPos = start.clone().lerp(end, t);
            // Small scatter
            spawnPos.x += (Math.random() - 0.5) * 0.5;
            spawnPos.y += (Math.random() - 0.5) * 0.5;
            spawnPos.z += (Math.random() - 0.5) * 0.5;
            
            spawnParticle(spawnPos, trail.color, false, true);
          }
        }
      }
      clearTrails();
    }

    const forces = Object.values(forceFields);

    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    const emberColor = new THREE.Color('#ff3300');
    const whiteColor = new THREE.Color('#ffffff');

    let needsMatrixUpdate = false;
    let needsColorUpdate = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        if (!p.hidden) {
          meshRef.current.setMatrixAt(i, ZERO_MATRIX);
          p.hidden = true;
          needsMatrixUpdate = true;
        }
        continue;
      }

      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        meshRef.current.setMatrixAt(i, ZERO_MATRIX);
        p.hidden = true;
        needsMatrixUpdate = true;
        continue;
      }

      // Apply curl noise
      const curl = computeCurl(p.position.x * 0.3, p.position.y * 0.3, p.position.z * 0.3);
      p.velocity.add(curl.multiplyScalar(delta * 5.0));

      // Apply force fields
      for (const force of forces) {
        const fPos = new THREE.Vector3(force.position.x, force.position.y, force.position.z);
        const dir = new THREE.Vector3().subVectors(fPos, p.position);
        const distSq = dir.lengthSq();
        
        // Avoid division by zero and extreme forces
        if (distSq > 0.1 && distSq < 400) {
          dir.normalize();
          const strength = 100.0 / distSq;
          if (force.type === 'attractor') {
            p.velocity.add(dir.multiplyScalar(strength * delta));
            // Tint particle if close to attractor
            if (distSq < 10) {
               p.baseColor.lerp(whiteColor, 0.05); // permanently tint a bit
            }
          } else {
            p.velocity.sub(dir.multiplyScalar(strength * delta));
          }
        }
      }

      // Damping
      p.velocity.multiplyScalar(0.96);
      p.position.addScaledVector(p.velocity, delta);

      // Color shift based on life
      const lifeRatio = p.life / PARTICLE_LIFETIME;
      p.color.copy(p.baseColor);
      p.color.lerp(emberColor, Math.pow(1 - lifeRatio, 2));

      // Update instanced mesh
      dummy.position.copy(p.position);
      
      const speed = p.velocity.length();
      // Scale down as life decreases, base size is larger for soft blending
      const scale = (p.life / PARTICLE_LIFETIME) * 0.08;
      // Stretch along velocity, clamp to prevent extreme distortion
      const stretch = Math.min(4, Math.max(1, speed * 0.1));
      
      dummy.scale.set(scale, scale, scale * stretch);

      // Orient along velocity
      if (speed > 0.01) {
        const dir = p.velocity.clone().normalize();
        quaternion.setFromUnitVectors(up, dir);
        dummy.quaternion.copy(quaternion);
      }

      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, p.color);
      needsMatrixUpdate = true;
      needsColorUpdate = true;
    }

    if (needsMatrixUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (needsColorUpdate && meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial 
        map={particleTexture}
        transparent 
        opacity={0.8} 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
