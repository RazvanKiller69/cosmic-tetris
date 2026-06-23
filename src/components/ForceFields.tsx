/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

type PhysicsState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
};

function Attractor({ physicsState, color }: { physicsState: PhysicsState; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mountedAt = useRef(Date.now());

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.copy(physicsState.position);

      const age = (Date.now() - mountedAt.current) / 1000;
      const maxAge = 3.0;
      let lifeScale = 1;
      if (age < 0.2) {
        lifeScale = age / 0.2;
      } else if (age > maxAge - 0.2) {
        lifeScale = Math.max(0, (maxAge - age) / 0.2);
      }

      const scale = (1 + Math.sin(state.clock.elapsedTime * 5) * 0.1) * lifeScale;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshPhysicalMaterial 
        transmission={1} 
        ior={1.5} 
        thickness={2} 
        roughness={0} 
        color={color || "#ffffff"}
      />
      {/* Inner core */}
      <mesh>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshBasicMaterial color={color || "#ffffff"} />
      </mesh>
    </mesh>
  );
}

function Repulsor({ physicsState, color }: { physicsState: PhysicsState; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const mountedAt = useRef(Date.now());

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.copy(physicsState.position);

      const age = (Date.now() - mountedAt.current) / 1000;
      const maxAge = 0.5;
      const lifeScale = Math.max(0, 1 - (age / maxAge));

      groupRef.current.children.forEach((child, i) => {
        if (i === 1) {
          // Inner core
          child.scale.set(lifeScale, lifeScale, lifeScale);
          return;
        }
        const mesh = child as THREE.Mesh;
        // Expand outward
        const scale = 0.2 + Math.pow(age / maxAge, 0.5) * 4.0;
        mesh.scale.set(scale, scale, scale);
        (mesh.material as THREE.MeshBasicMaterial).opacity = lifeScale * 0.5;
      });
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color={color || "#ff3333"} side={THREE.DoubleSide} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshBasicMaterial color={color || "#ff3333"} />
      </mesh>
    </group>
  );
}

export function ForceFields() {
  const forceFields = useGameStore((state) => state.forceFields);
  const physicsStates = useRef<Record<string, PhysicsState>>({});

  // Sync physics state
  Object.values(forceFields).forEach(force => {
    if (!physicsStates.current[force.id]) {
      physicsStates.current[force.id] = {
        position: new THREE.Vector3(force.position.x, force.position.y, force.position.z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0),
        radius: force.type === 'attractor' ? 1.2 : 0.8
      };
    }
  });

  // Cleanup
  Object.keys(physicsStates.current).forEach(id => {
    if (!forceFields[id]) {
      delete physicsStates.current[id];
    }
  });

  useFrame((state, delta) => {
    const objs = Object.values(physicsStates.current);
    
    for (let obj of objs) {
      obj.velocity.multiplyScalar(0.9); // drag
      obj.position.addScaledVector(obj.velocity, delta);
    }
    
    // Collisions
    for (let i = 0; i < objs.length; i++) {
       for (let j = i + 1; j < objs.length; j++) {
          const a = objs[i];
          const b = objs[j];
          const dx = a.position.x - b.position.x;
          const dy = a.position.y - b.position.y;
          const distSq = dx * dx + dy * dy;
          const minDist = a.radius + b.radius + 0.2; // slight padding
          
          if (distSq < minDist * minDist && distSq > 0.001) {
             const dist = Math.sqrt(distSq);
             const overlap = minDist - dist;
             const nx = dx / dist;
             const ny = dy / dist;
             
             a.position.x += nx * overlap * 0.5;
             a.position.y += ny * overlap * 0.5;
             b.position.x -= nx * overlap * 0.5;
             b.position.y -= ny * overlap * 0.5;
             
             const rVelX = a.velocity.x - b.velocity.x;
             const rVelY = a.velocity.y - b.velocity.y;
             const dot = rVelX * nx + rVelY * ny;
             
             if (dot < 0) {
               const impulse = -(1 + 0.8) * dot / 2;
               a.velocity.x += nx * impulse;
               a.velocity.y += ny * impulse;
               b.velocity.x -= nx * impulse;
               b.velocity.y -= ny * impulse;
             } else {
               a.velocity.x += nx * 10 * delta;
               a.velocity.y += ny * 10 * delta;
               b.velocity.x -= nx * 10 * delta;
               b.velocity.y -= ny * 10 * delta;
             }
          }
       }
    }
  });

  return (
    <>
      {Object.values(forceFields).map((force) => {
        const pState = physicsStates.current[force.id];
        if (!pState) return null;
        return force.type === 'attractor' ? (
          <Attractor key={force.id} physicsState={pState} color={force.color} />
        ) : (
          <Repulsor key={force.id} physicsState={pState} color={force.color} />
        );
      })}
    </>
  );
}
