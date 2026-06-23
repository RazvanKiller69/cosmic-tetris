import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, TETRIS_COLS, TETRIS_ROWS, checkCollision } from '../store/useGameStore';

export function Tetris3D() {
  const pointsRef = useRef<THREE.Points>(null);
  
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }, []);

  const MAX_BLOCKS = TETRIS_COLS * TETRIS_ROWS + 8; // 200 grid + 4 falling + 4 ghost
  const PARTICLES_PER_BLOCK = 25; // 5x5
  const TOTAL_PARTICLES = MAX_BLOCKS * PARTICLES_PER_BLOCK;

  const [positions, colors] = useMemo(() => {
    return [
      new Float32Array(TOTAL_PARTICLES * 3),
      new Float32Array(TOTAL_PARTICLES * 3)
    ];
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const wireframeMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.05, transparent: true }), []);
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), []);

  useFrame((state) => {
    if (!pointsRef.current || !pointsRef.current.geometry.attributes.position || !pointsRef.current.geometry.attributes.color) return;
    const time = state.clock.elapsedTime;
    
            const { grid, currentPiece, piecePos, status, level, energy, singularityUses, settings } = useGameStore.getState();
            
            const effectiveVisualLevel = Math.max(1, Math.min(level - Math.floor(singularityUses * 1.5), 15));
            const jitterAmp = Math.min(0.12, 0.05 + (effectiveVisualLevel - 1) * 0.005 + (energy / 160) * 0.05);
            const jitterFreq = Math.min(6, 2 + (effectiveVisualLevel - 1) * 0.1 + (energy / 160) * 1.5);
    
    const blocks: { x: number, y: number, color: string, isGhost: boolean }[] = [];
    
    for (let y = 0; y < TETRIS_ROWS; y++) {
      for (let x = 0; x < TETRIS_COLS; x++) {
        if (grid[y][x]) {
          blocks.push({ x, y, color: grid[y][x]!, isGhost: false });
        }
      }
    }
    
    if (status === 'playing' && currentPiece) {
      let ghostY = piecePos.y;
      while (!checkCollision(grid, currentPiece.shape, piecePos.x, ghostY + 1)) {
        ghostY++;
      }
      
      for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
          if (currentPiece.shape[r][c]) {
            const gy = ghostY + r;
            const gx = piecePos.x + c;
            // Ghost
            if (settings.showGhostPiece && gy >= 0 && gy < TETRIS_ROWS) {
              blocks.push({ x: gx, y: gy, color: currentPiece.color, isGhost: true });
            }
            
            // Actual
            const py = piecePos.y + r;
            const px = piecePos.x + c;
            if (py >= 0 && py < TETRIS_ROWS) {
              blocks.push({ x: px, y: py, color: currentPiece.color, isGhost: false });
            }
          }
        }
      }
    }
    
    let pIdx = 0;
    const blockWidth = 1.0;
    const startX = - (TETRIS_COLS * blockWidth) / 2;
    const startY = (TETRIS_ROWS * blockWidth) / 2;
    
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        
        const wx = startX + b.x * blockWidth + blockWidth / 2;
        const wy = startY - b.y * blockWidth - blockWidth / 2;
        
        tempColor.set(b.color);
        if (b.isGhost) {
            tempColor.multiplyScalar(0.3);
        }
        
        for (let p = 0; p < PARTICLES_PER_BLOCK; p++) {
            if (pIdx >= TOTAL_PARTICLES) break;
            
            const pcol = p % 5;
            const prow = Math.floor(p / 5);
            
            const lx = (pcol / 4) - 0.5;
            const ly = (prow / 4) - 0.5;
            
            if (b.isGhost) {
                 if (lx !== -0.5 && lx !== 0.5 && ly !== -0.5 && ly !== 0.5) {
                     continue; 
                 }
            } else {
                 if (lx === -0.5 || lx === 0.5 || ly === -0.5 || ly === 0.5) {
                     tempColor.set(b.color).lerp(new THREE.Color('#ffffff'), 0.3);
                 } else {
                     tempColor.set(b.color);
                 }
            }
            
            const jitterX = Math.sin(time * jitterFreq + (b.x + b.y) * 0.5) * jitterAmp;
            const jitterY = Math.cos(time * (jitterFreq * 1.1) + (b.x + b.y) * 0.5) * jitterAmp;
            
            let finalWx = wx + lx * 0.8 + jitterX;
            let finalWy = wy - ly * 0.8 + jitterY; 
            let finalWz = 0;
            
            positions[pIdx * 3] = finalWx;
            positions[pIdx * 3 + 1] = finalWy;
            positions[pIdx * 3 + 2] = finalWz;
            
            colors[pIdx * 3] = tempColor.r;
            colors[pIdx * 3 + 1] = tempColor.g;
            colors[pIdx * 3 + 2] = tempColor.b;
            
            pIdx++;
        }
    }
    
    for (; pIdx < TOTAL_PARTICLES; pIdx++) {
        positions[pIdx * 3] = 0;
        positions[pIdx * 3 + 1] = 0;
        positions[pIdx * 3 + 2] = 9999;
    }
    
    wireframeMaterial.opacity = 0.05 + (effectiveVisualLevel - 1) * 0.02 + (energy / 160) * 0.1;
    wireframeMaterial.color.setHSL((time * 0.1) % 1, 0.5, 0.5 + (energy / 160) * 0.5);

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  const blockWidth = 1.0;
  const boardWidth = TETRIS_COLS * blockWidth;
  const boardHeight = TETRIS_ROWS * blockWidth;

  return (
    <group>
      {/* Board subtle border/grid in 3D */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[boardWidth, boardHeight]} />
        <meshBasicMaterial color="#00071a" opacity={0.8} transparent depthWrite={false} />
      </mesh>
      
      {/* Draw a subtle grid */}
      <group position={[0, 0, -0.1]}>
         {Array.from({ length: TETRIS_COLS }).map((_, x) => 
            Array.from({ length: TETRIS_ROWS }).map((_, y) => (
                <lineSegments 
                    key={`${x}-${y}`} 
                    geometry={edgeGeometry} 
                    material={wireframeMaterial} 
                    position={[
                        -boardWidth/2 + x + 0.5,
                        boardHeight/2 - y - 0.5,
                        0
                    ]} 
                />
            ))
         )}
      </group>
      
      <lineSegments position={[0, 0, -0.05]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(boardWidth, boardHeight)]} />
        <lineBasicMaterial color="#00ffff" opacity={0.5} transparent />
      </lineSegments>

      <points ref={pointsRef} frustumCulled={false} position={[0, 0, 0.1]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={TOTAL_PARTICLES}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={TOTAL_PARTICLES}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.6}
          map={particleTexture}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
