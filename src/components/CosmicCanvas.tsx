/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sphere, Ring, MeshDistortMaterial, Text } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { Particles } from './Particles';
import { ForceFields } from './ForceFields';
import { useGameStore } from '../store/useGameStore';

import { Tetris3D } from './Tetris3D';

function ShiftStars(props: any) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
      if (groupRef.current) {
          groupRef.current.traverse((child) => {
              if ((child as THREE.Points).isPoints) {
                  const pts = child as THREE.Points;
                  if (pts.material && (pts.material as THREE.PointsMaterial).color) {
                      (pts.material as THREE.PointsMaterial).color.setHSL((state.clock.elapsedTime * 0.1) % 1, 0.8, 0.8);
                  }
              }
          });
      }
  });
  return (
      <group ref={groupRef}>
          <Stars {...props} />
      </group>
  );
}

function RotatingStars({ level }: { level: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Exponentially rotate faster as level increases
      const speedMult = 1 + (level - 1) * 1.5; // Scaled up spin multiplier
      groupRef.current.rotation.y += delta * 0.02 * speedMult;
      groupRef.current.rotation.x += delta * 0.01 * speedMult;
      if (level > 3) {
          groupRef.current.rotation.z += delta * 0.005 * speedMult;
      }
    }
  });

  // More stars and faster fading as level goes up
  const starCount = Math.min(5000 + level * 800, 15000);

  return (
    <group ref={groupRef}>
      <ShiftStars radius={100} depth={50} count={starCount} factor={4} saturation={1} fade speed={1 + level * 0.5} />
    </group>
  );
}

function VaporwaveTheme() {
  const gridRef = useRef<THREE.GridHelper>(null);
  const sunMaterial = useMemo(() => new THREE.ShaderMaterial({
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec3 color = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.0), vUv.y);
        if (vUv.y < 0.5) {
           float lines = fract(vUv.y * 15.0 - 0.5);
           float threshold = 0.2 + vUv.y * 1.5;
           if (lines > threshold) discard;
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  }), []);

  useFrame((state, delta) => {
    if (gridRef.current) {
      gridRef.current.position.z += delta * 15;
      if (gridRef.current.position.z > 0) {
        gridRef.current.position.z = -10; // Reset seamless
      }
    }
  });
  return (
    <group>
      <mesh position={[0, 10, -100]}>
         <circleGeometry args={[40, 64]} />
         <primitive object={sunMaterial} attach="material" />
      </mesh>
      <gridHelper ref={gridRef} args={[200, 40, '#ff00ff', '#ff00ff']} position={[0, -15, -40]} />
      <ShiftStars radius={100} depth={50} count={3000} factor={4} saturation={1} fade speed={0.5} />
    </group>
  );
}

function BlackholeTheme() {
  const diskRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (diskRef.current) {
        diskRef.current.rotation.z += delta * 0.1;
    }
  });
  return (
    <group position={[15, 15, -120]}>
       {/* Background Halo / Lensing */}
       <Ring args={[26, 45, 128]} position={[0, 0, -5]}>
          <meshBasicMaterial color="#ff3300" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
       </Ring>

       {/* Black Hole Sphere */}
       <Sphere args={[25, 64, 64]} position={[0, 0, 0]}>
          <meshBasicMaterial color="#000000" />
       </Sphere>
       
       {/* Accretion disk */}
       <group ref={diskRef} rotation={[Math.PI * 0.45, -Math.PI * 0.1, 0]}>
         <Ring args={[27, 80, 128]}>
            <meshBasicMaterial color="#ff2200" transparent opacity={0.7} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
         </Ring>
         <Ring args={[26, 35, 128]}>
            <meshBasicMaterial color="#ffaa55" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
         </Ring>
         <Ring args={[30, 120, 128]}>
            <meshBasicMaterial color="#aa1100" transparent opacity={0.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
         </Ring>
       </group>
       
       <ShiftStars radius={150} depth={100} count={5000} factor={4} saturation={1} fade speed={1} />
    </group>
  );
}

function MatrixTheme() {
  const count = 1500;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 100;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 100;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 20;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  useFrame((state, delta) => {
    if (pointsRef.current) {
        const positionsArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
           positionsArray[i * 3 + 1] -= delta * 30; // fall down
           if (positionsArray[i * 3 + 1] < -50) {
               positionsArray[i * 3 + 1] = 50;
           }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
     <points ref={pointsRef}>
        <bufferGeometry>
           <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#00ff00" size={0.5} sizeAttenuation transparent opacity={0.8} />
     </points>
  );
}

function NebulaTheme() {
  return (
    <group>
        <pointLight position={[-40, 20, -50]} intensity={5000} color="#fca5a5" />
        <pointLight position={[40, -10, -60]} intensity={5000} color="#93c5fd" />
        <Sphere args={[60, 32, 32]} position={[-40, 20, -80]}>
           <MeshDistortMaterial color="#fca5a5" transparent opacity={0.4} speed={1} distort={0.6} emissive="#4a0f0f" />
        </Sphere>
        <Sphere args={[70, 32, 32]} position={[40, -10, -90]}>
           <MeshDistortMaterial color="#93c5fd" transparent opacity={0.4} speed={0.8} distort={0.5} emissive="#0f1a4a" />
        </Sphere>
        <ShiftStars radius={100} depth={50} count={4000} factor={4} saturation={0.5} fade speed={1} />
    </group>
  );
}

function BackgroundThemeRenderer({ themeIndex, level }: { themeIndex: number, level: number }) {
  switch (themeIndex) {
    case 0: return <RotatingStars level={level} />;
    case 1: return <VaporwaveTheme />;
    case 2: return <BlackholeTheme />;
    case 3: return <MatrixTheme />;
    case 4: return <NebulaTheme />;
    default: return <RotatingStars level={level} />;
  }
}

function BackgroundManager({ level }: { level: number }) {
  const [timeOffset, setTimeOffset] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeOffset(prev => (prev + 1) % 5);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const targetTheme = (Math.floor((level - 1) / 3) + timeOffset) % 5;
  const [activeTheme, setActiveTheme] = React.useState(targetTheme);
  const [fadingOut, setFadingOut] = React.useState(false);
  const opacityRef = useRef(0);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  React.useEffect(() => {
     if (targetTheme !== activeTheme) {
        setFadingOut(true);
     }
  }, [targetTheme, activeTheme]);

  useFrame((state, delta) => {
     if (fadingOut) {
        opacityRef.current += delta * 1.5;
        if (opacityRef.current >= 1) {
            opacityRef.current = 1;
            setActiveTheme(targetTheme);
            setFadingOut(false);
        }
     } else {
        if (opacityRef.current > 0) {
            opacityRef.current -= delta * 1.5;
            if (opacityRef.current < 0) opacityRef.current = 0;
        }
     }
     if (materialRef.current) {
         materialRef.current.opacity = opacityRef.current;
     }
  });

  return (
    <group>
      <BackgroundThemeRenderer themeIndex={activeTheme} level={level} />
      <mesh position={[0, 0, 10]}>
         <planeGeometry args={[200, 200]} />
         <meshBasicMaterial ref={materialRef} color="#050510" transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FloatingTextsRenderer() {
  const floatingTexts = useGameStore(state => state.floatingTexts);
  const removeFloatingText = useGameStore(state => state.removeFloatingText);
  return (
    <group>
      {floatingTexts.map(t => (
        <FloatingText key={t.id} data={t} onComplete={() => removeFloatingText(t.id)} />
      ))}
    </group>
  );
}

function FloatingText({ data, onComplete }: { data: any, onComplete: () => void }) {
  const ref = useRef<any>(null);
  const [startTime] = React.useState(Date.now());
  const lifetime = 1500;

  useFrame(() => {
    if (!ref.current) return;
    const elapsed = Date.now() - startTime;
    const p = elapsed / lifetime;
    if (p >= 1) {
      onComplete();
      return;
    }
    // Float upwards
    ref.current.position.y = data.y + p * 4;
    // Fade out
    ref.current.fillOpacity = 1 - p * p;
  });

  return (
    <Text ref={ref} position={[data.x, data.y, 2]} fontSize={1} color={data.color} outlineWidth={0.05} outlineColor="#000" font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf">
      {data.text}
    </Text>
  );
}

function CosmicCanvasInner() {
  const level = useGameStore(state => state.level);
  const singularityUses = useGameStore(state => state.singularityUses);
  const score = useGameStore(state => state.score);
  const settings = useGameStore(state => state.settings);

  const effectiveVisualLevel = Math.max(1, level - Math.floor(singularityUses * 1.5));

  // Keep bloom more controlled
  const bloomIntensity = Math.min(1.2 + (effectiveVisualLevel - 1) * 0.15, 2.8);
  const luminanceThreshold = 0.25;

  // Add chromatic aberration scaling with level
  const chromaOffset = useMemo(() => {
    const offset = Math.min((effectiveVisualLevel - 1) * 0.0003, 0.003);
    return new THREE.Vector2(offset, offset * 0.5);
  }, [effectiveVisualLevel]);

  // Noise opacity scales with level for a static effect
  const noiseOpacity = Math.min((effectiveVisualLevel - 1) * 0.025, 0.25);

  return (
    <div className="w-full h-full absolute inset-0 bg-black pointer-events-none">
      <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
        <color attach="background" args={['#050510']} />
        <ambientLight intensity={0.2} />
        {settings.showBackgroundStars && <BackgroundManager level={effectiveVisualLevel} />}
        <Tetris3D />
        <FloatingTextsRenderer />
        {settings.showExplosions && <Particles />}
        {settings.showForceFields && <ForceFields />}
        <EffectComposer>
          <Bloom luminanceThreshold={luminanceThreshold} mipmapBlur intensity={bloomIntensity} />
          {effectiveVisualLevel > 1 && (
            <ChromaticAberration 
              blendFunction={BlendFunction.NORMAL} 
              offset={chromaOffset}
              radialModulation={false}
              modulationOffset={0}
            />
          )}
          {effectiveVisualLevel > 2 && (
             <Noise opacity={noiseOpacity} blendFunction={BlendFunction.OVERLAY} />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export const CosmicCanvas = CosmicCanvasInner;

