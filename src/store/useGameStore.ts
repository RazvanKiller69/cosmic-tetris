/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { synth } from '../lib/audio';

export type Vector3 = { x: number; y: number; z: number };

export interface ForceField {
  id: string;
  position: Vector3;
  type: 'attractor' | 'repulsor';
  ownerId: string;
  createdAt: number;
  color: string;
}

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export interface Tetromino {
  shape: number[][];
  color: string;
  type: TetrominoType;
}

const TETROMINOS: Record<TetrominoType, Tetromino> = {
  I: { shape: [[1, 1, 1, 1]], color: '#33CCFF', type: 'I' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#3333FF', type: 'J' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#FF9933', type: 'L' },
  O: { shape: [[1, 1], [1, 1]], color: '#FFFF33', type: 'O' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#33FF99', type: 'S' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#CC33FF', type: 'T' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#FF3333', type: 'Z' }
};

export const TETRIS_COLS = 10;
export const TETRIS_ROWS = 20;

const generateUniqueColors = () => {
  const colors = new Set<string>();
  if (Math.random() < 0.3) colors.add('#FFFFFF');
  if (Math.random() < 0.3) colors.add('#000000');
  
  while(colors.size < 7) {
      const c = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
      colors.add(c);
  }
  const pool = Array.from(colors);
  for(let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
};

const getRandomTetromino = () => {
  const keys = Object.keys(TETROMINOS) as TetrominoType[];
  const randKey = keys[Math.floor(Math.random() * keys.length)];
  return TETROMINOS[randKey];
};

interface GameState {
  grid: (string | null)[][];
  currentPiece: Tetromino | null;
  nextPieces: Tetromino[];
  heldPiece: Tetromino | null;
  canHold: boolean;
  piecePos: { x: number, y: number };
  targetCol: number | null;
  score: number;
  highScore: number;
  energy: number;
  level: number;
  singularityUses: number;
  status: 'idle' | 'playing' | 'gameover' | 'paused' | 'switching_gravity' | 'won';
  gravity: 'down' | 'up';
  autoplay: boolean;
  autoplaySpeed: number;
  combo: number;
  lastClearText: string | null;
  clearTextTrigger: number;
  shakeTrigger: number;
  shakeIntensity: number;
  gameMode: 'standard' | 'sprint' | 'roulette';
  sprintStartTime: number | null;
  sprintEndTime: number | null;
  sprintTimer: number;
  sprintLinesCleared: number;
  rouletteNextShift: number | null;
  settings: {
    showBackgroundStars: boolean;
    showBlockTrails: boolean;
    showExplosions: boolean;
    showForceFields: boolean;
    showGhostPiece: boolean;
  };
  forceFields: Record<string, ForceField>;
  explosions: { position: Vector3, color: string }[];
  trails: { start: Vector3, end: Vector3, color: string }[];
  floatingTexts: { id: number, text: string, x: number, y: number, color: string }[];
  
  updateSettings: (newSettings: Partial<GameState['settings']>) => void;
  setGameMode: (mode: 'standard' | 'sprint' | 'roulette') => void;
  triggerShake: (intensity?: number) => void;
  startGame: () => void;
  togglePause: () => void;
  toggleAutoplay: () => void;
  cycleAutoplaySpeed: () => void;
  performAutoplayMove: () => void;
  activateSingularity: () => void;
  shiftGridLeft: () => void;
  shiftGridRight: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveDown: () => void;
  rotate: () => void;
  hardDrop: () => void;
  holdPiece: () => void;
  setColumn: (col: number) => void;
  tick: (isHardDrop?: boolean, dropDistance?: number) => void;
  addForce: (position: Vector3, type: 'attractor' | 'repulsor', color: string) => void;
  addExplosion: (position: Vector3, color: string) => void;
  clearExplosions: () => void;
  addTrail: (start: Vector3, end: Vector3, color: string) => void;
  clearTrails: () => void;
  clearForces: () => void;
  addFloatingText: (text: string, x: number, y: number, color: string) => void;
  removeFloatingText: (id: number) => void;
}

const createEmptyGrid = () => Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(null));

export function checkCollision(grid: (string | null)[][], shape: number[][], x: number, y: number) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] !== 0) {
        const newY = y + r;
        const newX = x + c;
        if (newX < 0 || newX >= TETRIS_COLS || newY >= TETRIS_ROWS || newY < 0) return true;
        if (newY >= 0 && newY < TETRIS_ROWS && grid[newY][newX] !== null) return true;
      }
    }
  }
  return false;
}

export const useGameStore = create<GameState>((set, get) => ({
  grid: createEmptyGrid(),
  currentPiece: null,
  nextPieces: [],
  heldPiece: null,
  canHold: true,
  piecePos: { x: 3, y: 0 },
  targetCol: null,
  score: 0,
  highScore: parseInt(localStorage.getItem('tetrisHighScore') || '0'),
  energy: 0,
  level: 1,
  singularityUses: 0,
  status: 'idle',
  gravity: 'down',
  autoplay: false,
  autoplaySpeed: 1,
  combo: 0,
  lastClearText: null,
  clearTextTrigger: 0,
  shakeTrigger: 0,
  shakeIntensity: 1,
  gameMode: 'standard',
  sprintStartTime: null,
  sprintEndTime: null,
  sprintTimer: 0,
  sprintLinesCleared: 0,
  rouletteNextShift: null,
  settings: {
    showBackgroundStars: true,
    showBlockTrails: true,
    showExplosions: true,
    showForceFields: true,
    showGhostPiece: true,
  },
  forceFields: {},
  explosions: [],
  trails: [],
  floatingTexts: [],

  updateSettings: (newSettings) => set(state => ({ settings: { ...state.settings, ...newSettings } })),
  setGameMode: (mode) => set({ gameMode: mode }),
  triggerShake: (intensity = 1) => set(state => ({ shakeTrigger: state.shakeTrigger + 1, shakeIntensity: intensity })),

  startGame: () => {
    const startPiece = getRandomTetromino();
    const startX = Math.floor(TETRIS_COLS / 2) - Math.floor(startPiece.shape[0].length / 2);
    synth.setLevel(1);
    synth.playTheme();
    const { gameMode } = get();
    set({ 
      grid: createEmptyGrid(), 
      score: 0, 
      energy: 0,
      level: 1,
      singularityUses: 0,
      combo: 0,
      lastClearText: null,
      clearTextTrigger: 0,
      status: 'playing',
      gravity: 'down',
      currentPiece: startPiece,
      nextPieces: [getRandomTetromino(), getRandomTetromino(), getRandomTetromino()],
      heldPiece: null,
      canHold: true,
      targetCol: null,
      piecePos: { x: startX, y: 0 },
      forceFields: {},
      explosions: [],
      trails: [],
      floatingTexts: [],
      sprintStartTime: gameMode === 'sprint' ? Date.now() : null,
      sprintEndTime: null,
      sprintTimer: 0,
      sprintLinesCleared: 0,
      rouletteNextShift: gameMode === 'roulette' ? Date.now() + 10000 + Math.random() * 10000 : null
    });
  },

  togglePause: () => {
    const { status } = get();
    if (status === 'playing') {
      set({ status: 'paused' });
    } else if (status === 'paused') {
      set({ status: 'playing' });
    }
  },

  toggleAutoplay: () => {
    set(state => ({ autoplay: !state.autoplay }));
  },

  cycleAutoplaySpeed: () => {
    set(state => {
      const speeds = [1, 2, 5, 10, 20];
      const idx = speeds.indexOf(state.autoplaySpeed);
      return { autoplaySpeed: speeds[(idx + 1) % speeds.length] };
    });
  },

  performAutoplayMove: () => {
    const { grid, currentPiece, heldPiece, nextPieces, piecePos, status, gravity, energy, canHold } = get();
    if (status !== 'playing' || !currentPiece) return;

    // Check stack height
    let maxY = gravity === 'up' ? 0 : TETRIS_ROWS - 1;
    for (let c = 0; c < TETRIS_COLS; c++) {
      for (let r = 0; r < TETRIS_ROWS; r++) {
        if (grid[r][c] !== null) {
          if (gravity === 'up') {
            if (r > maxY) maxY = r;
          } else {
            if (r < maxY) maxY = r;
          }
        }
      }
    }
    const stackHeight = gravity === 'up' ? maxY + 1 : TETRIS_ROWS - maxY;
    
    if (stackHeight > 10 && energy >= 100) {
       get().activateSingularity();
       return;
    }

    const getRotated = (shape: number[][]) => shape[0].map((_, index) => shape.map(row => row[index]).reverse());
    
    const evaluate = (shape: number[][], x: number, startY: number) => {
      let dropY = startY;
      const direction = gravity === 'up' ? -1 : 1;
      while (!checkCollision(grid, shape, x, dropY + direction)) dropY += direction;
      
      const testGrid = grid.map(row => [...row]);
      for (let r = 0; r < shape.length; r++) {
         for (let c = 0; c < shape[r].length; c++) {
             if (shape[r][c]) {
                 testGrid[dropY + r][x + c] = 'X';
             }
         }
      }
      
      let lines = 0;
      for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
          if (testGrid[r].every(cell => cell !== null)) {
              lines++;
              testGrid.splice(r, 1);
              if (gravity === 'up') {
                 testGrid.push(Array(TETRIS_COLS).fill(null));
              } else {
                 testGrid.unshift(Array(TETRIS_COLS).fill(null));
              }
              r++; // check the same row index again because it shifted
          }
      }

      let holes = 0;
      let aggregateHeight = 0;
      let bumpiness = 0;
      let heights = new Array(TETRIS_COLS).fill(0);

      for (let c = 0; c < TETRIS_COLS; c++) {
          let foundTop = false;
          if (gravity === 'up') {
              for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
                  if (testGrid[r][c] !== null) {
                      if (!foundTop) {
                          heights[c] = r + 1;
                          aggregateHeight += r + 1;
                          foundTop = true;
                      }
                  } else if (foundTop) {
                      holes++;
                  }
              }
          } else {
              for (let r = 0; r < TETRIS_ROWS; r++) {
                  if (testGrid[r][c] !== null) {
                      if (!foundTop) {
                          heights[c] = TETRIS_ROWS - r;
                          aggregateHeight += TETRIS_ROWS - r;
                          foundTop = true;
                      }
                  } else if (foundTop) {
                      holes++;
                  }
              }
          }
      }

      for (let c = 0; c < TETRIS_COLS - 1; c++) {
          bumpiness += Math.abs(heights[c] - heights[c + 1]);
      }

      return (lines * 7606) - (aggregateHeight * 5100) - (holes * 3566) - (bumpiness * 1844);
    };

    const findBestMove = (piece: any) => {
      let bestScore = -Infinity;
      let bestX = Math.floor(TETRIS_COLS / 2) - Math.floor(piece.shape[0].length / 2);
      let bestShape = piece.shape;
      let bestStartY = gravity === 'up' ? TETRIS_ROWS - piece.shape.length : 0;

      const shapes = [
        piece.shape,
        getRotated(piece.shape),
        getRotated(getRotated(piece.shape)),
        getRotated(getRotated(getRotated(piece.shape)))
      ];

      shapes.forEach((shape) => {
        const rotatedStartY = gravity === 'up' ? TETRIS_ROWS - shape.length : 0;
        for (let testX = 0; testX <= TETRIS_COLS - shape[0].length; testX++) {
           if (!checkCollision(grid, shape, testX, rotatedStartY)) {
               const score = evaluate(shape, testX, rotatedStartY);
               if (score > bestScore) {
                   bestScore = score;
                   bestX = testX;
                   bestShape = shape;
                   bestStartY = rotatedStartY;
               }
           }
        }
      });
      return { score: bestScore, x: bestX, shape: bestShape, startY: bestStartY };
    };

    const currentMove = findBestMove(currentPiece);
    let holdMove = { score: -Infinity, x: 0, shape: [] as number[][], startY: 0 };
    
    if (canHold) {
       const nextPieceToCheck = heldPiece !== null ? heldPiece : nextPieces[0];
       holdMove = findBestMove(nextPieceToCheck);
    }

    if (canHold && holdMove.score > currentMove.score + 50) {
       get().holdPiece();
    } else if (currentMove.score !== -Infinity) {
       set({ 
         currentPiece: { ...currentPiece, shape: currentMove.shape },
         piecePos: { ...piecePos, x: currentMove.x, y: currentMove.startY }
       });
       get().hardDrop();
    }
  },

  activateSingularity: () => {
    const { status, energy, grid, score, highScore, level, singularityUses, addExplosion, addForce, clearForces } = get();
    if (status !== 'playing' || energy < 100) return;

    synth.playSingularitySound(); // Play clear sound for singularity
    
    // Clear out existing chaotic forces to reduce visual clutter
    clearForces();

    // Entropy Collapse / Singularity mechanic:
    // Move every block down as far as it can go to eliminate all gaps.
    const newGrid = Array(TETRIS_ROWS).fill(null).map(() => Array(TETRIS_COLS).fill(null));
    
    if (get().gravity === 'up') {
      for (let c = 0; c < TETRIS_COLS; c++) {
        let writeRow = 0;
        for (let r = 0; r < TETRIS_ROWS; r++) {
          if (grid[r][c] !== null) {
            newGrid[writeRow][c] = grid[r][c];
            writeRow++;
          }
        }
      }
    } else {
      for (let c = 0; c < TETRIS_COLS; c++) {
        let writeRow = TETRIS_ROWS - 1;
        for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
          if (grid[r][c] !== null) {
            newGrid[writeRow][c] = grid[r][c];
            writeRow--;
          }
        }
      }
    }

    // Now clear any resulting full lines from the collapsed grid
    let linesCleared = 0;
    const finalGrid = newGrid.filter(row => {
        if (row.every(cell => cell !== null)) {
            linesCleared++;
            return false;
        }
        return true;
    });

    while (finalGrid.length < TETRIS_ROWS) {
        if (get().gravity === 'up') {
          finalGrid.push(Array(TETRIS_COLS).fill(null));
        } else {
          finalGrid.unshift(Array(TETRIS_COLS).fill(null));
        }
    }
    
    // Massive attractor force
    const forceY = get().gravity === 'up' ? TETRIS_ROWS/2 + 2 : -TETRIS_ROWS/2 - 2;
    addForce({ x: 0, y: forceY, z: -10 }, 'attractor', '#9333ea');
    addForce({ x: 0, y: forceY > 0 ? forceY - 2 : forceY - 4, z: -10 }, 'attractor', '#c084fc');

    if (linesCleared > 0) {
        synth.playClearSound();
    }

    // Singularity lines grant minimal score so they don't propel your level up incredibly fast reducing its cooling off functionality
    const points = 0;
    const newScore = score + points;
    const newHighScore = Math.max(highScore, newScore);
    if (newHighScore > highScore) {
       localStorage.setItem('tetrisHighScore', newHighScore.toString());
    }

    const newLevel = Math.floor(newScore / 2000) + 1;
    if (newLevel > level) {
      synth.setLevel(newLevel);
    }

    const newSingularityUses = singularityUses + 1;

    set({ 
      grid: finalGrid, 
      energy: energy - 100, 
      score: newScore, 
      highScore: newHighScore, 
      level: newLevel,
      singularityUses: newSingularityUses
    });
  },

  shiftGridLeft: () => {
    const { status, energy, grid, currentPiece, piecePos } = get();
    if (status !== 'playing' || energy < 10 || !currentPiece) return;
    
    const newGrid = grid.map(row => {
        const newRow = [...row];
        const first = newRow.shift();
        newRow.push(first!);
        return newRow;
    });
    
    if (!checkCollision(newGrid, currentPiece.shape, piecePos.x, piecePos.y)) {
        synth.playShiftSound();
        set({ grid: newGrid, energy: energy - 10 });
    }
  },

  shiftGridRight: () => {
    const { status, energy, grid, currentPiece, piecePos } = get();
    if (status !== 'playing' || energy < 10 || !currentPiece) return;
    
    const newGrid = grid.map(row => {
        const newRow = [...row];
        const last = newRow.pop();
        newRow.unshift(last!);
        return newRow;
    });
    
    if (!checkCollision(newGrid, currentPiece.shape, piecePos.x, piecePos.y)) {
        synth.playShiftSound();
        set({ grid: newGrid, energy: energy - 10 });
    }
  },

  moveLeft: () => {
    const { grid, currentPiece, piecePos, status } = get();
    if (status !== 'playing' || !currentPiece) return;
    if (!checkCollision(grid, currentPiece.shape, piecePos.x - 1, piecePos.y)) {
      set({ piecePos: { ...piecePos, x: piecePos.x - 1 } });
    }
  },

  moveRight: () => {
    const { grid, currentPiece, piecePos, status } = get();
    if (status !== 'playing' || !currentPiece) return;
    if (!checkCollision(grid, currentPiece.shape, piecePos.x + 1, piecePos.y)) {
      set({ piecePos: { ...piecePos, x: piecePos.x + 1 } });
    }
  },

  moveDown: () => {
    const state = get();
    if (state.status !== 'playing' || !state.currentPiece) return;
    state.tick();
  },

  rotate: () => {
    const { grid, currentPiece, piecePos, status } = get();
    if (status !== 'playing' || !currentPiece) return;
    const rotated = currentPiece.shape[0].map((_, index) => currentPiece.shape.map(row => row[index]).reverse());
    
    // Simple wall kick offsets
    const kicks = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 }
    ];

    for (const kick of kicks) {
      if (!checkCollision(grid, rotated, piecePos.x + kick.x, piecePos.y + kick.y)) {
        set({ 
          currentPiece: { ...currentPiece, shape: rotated },
          piecePos: { x: piecePos.x + kick.x, y: piecePos.y + kick.y }
        });
        return;
      }
    }
  },

  hardDrop: () => {
    const { grid, currentPiece, piecePos, status, addTrail, gravity } = get();
    if (status !== 'playing' || !currentPiece) return;
    const direction = gravity === 'up' ? -1 : 1;
    let newY = piecePos.y;
    const oldY = piecePos.y;
    while (!checkCollision(grid, currentPiece.shape, piecePos.x, newY + direction)) {
      newY += direction;
    }
    
    if (newY > oldY) {
      // Add a visual trail from old pos to new pos
      for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
          if (currentPiece.shape[r][c] !== 0) {
             const worldX = -(TETRIS_COLS / 2) + piecePos.x + c + 0.5;
             const startWorldY = (TETRIS_ROWS / 2) - oldY - r - 0.5;
             const endWorldY = (TETRIS_ROWS / 2) - newY - r - 0.5;
             addTrail({ x: worldX, y: startWorldY, z: 0 }, { x: worldX, y: endWorldY, z: 0 }, currentPiece.color);
          }
        }
      }
    }
    
    set({ piecePos: { ...piecePos, y: newY } });
    const dropDistance = Math.abs(newY - oldY);
    get().tick(true, dropDistance);
  },

  holdPiece: () => {
    const { grid, currentPiece, heldPiece, nextPieces, canHold, status, gravity } = get();
    if (status !== 'playing' || !currentPiece || !canHold) return;

    if (heldPiece === null) {
      const nextPiece = nextPieces[0];
      const newNextPieces = [...nextPieces.slice(1), getRandomTetromino()];
      const startX = Math.floor(TETRIS_COLS / 2) - Math.floor(nextPiece.shape[0].length / 2);
      const startY = gravity === 'up' ? TETRIS_ROWS - nextPiece.shape.length : 0;
      
      if (checkCollision(grid, nextPiece.shape, startX, startY)) {
         synth.playGameOverSound();
         set({ status: 'gameover', currentPiece: nextPiece, nextPieces: newNextPieces, piecePos: { x: startX, y: startY } });
      } else {
         set({
           heldPiece: { ...currentPiece, shape: TETROMINOS[currentPiece.type].shape },
           currentPiece: nextPiece,
           nextPieces: newNextPieces,
           piecePos: { x: startX, y: startY },
           canHold: false
         });
      }
    } else {
      const startX = Math.floor(TETRIS_COLS / 2) - Math.floor(heldPiece.shape[0].length / 2);
      const startY = gravity === 'up' ? TETRIS_ROWS - heldPiece.shape.length : 0;
      if (checkCollision(grid, heldPiece.shape, startX, startY)) {
         synth.playGameOverSound();
         set({ status: 'gameover', currentPiece: heldPiece, piecePos: { x: startX, y: startY } });
      } else {
         set({
           heldPiece: { ...currentPiece, shape: TETROMINOS[currentPiece.type].shape },
           currentPiece: heldPiece,
           piecePos: { x: startX, y: startY },
           canHold: false
         });
      }
    }
  },

  setColumn: (col: number) => {
    const { grid, currentPiece, piecePos, status } = get();
    if (status !== 'playing' || !currentPiece) return;
    
    set({ targetCol: col });
    
    const getRotated = (shape: number[][]) => shape[0].map((_, index) => shape.map(row => row[index]).reverse());
    const shapes = [
      currentPiece.shape,
      getRotated(currentPiece.shape),
      getRotated(getRotated(currentPiece.shape)),
      getRotated(getRotated(getRotated(currentPiece.shape)))
    ];

    const evaluate = (shape: number[][], x: number, startY: number) => {
      let dropY = startY;
      const direction = get().gravity === 'up' ? -1 : 1;
      while (!checkCollision(grid, shape, x, dropY + direction)) dropY += direction;
      
      let contacts = 0;
      let holes = 0;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            // Contacts
            const checkY = dropY + r + direction;
            if (checkY >= TETRIS_ROWS || checkY < 0 || grid[checkY][x + c] !== null) contacts++;
            if (x + c - 1 < 0 || grid[dropY + r][x + c - 1] !== null) contacts++;
            if (x + c + 1 >= TETRIS_COLS || grid[dropY + r][x + c + 1] !== null) contacts++;
            
            // Check if there's an empty cell directly underneath it that is blocked from above (a hole)
            if (checkY >= 0 && checkY < TETRIS_ROWS && grid[checkY][x + c] === null) {
                if (get().gravity === 'up') {
                   if (r - 1 < 0 || shape[r-1][c] === 0) holes++;
                } else {
                   if (r + 1 >= shape.length || shape[r+1][c] === 0) holes++;
                }
            }
          }
        }
      }
      return (get().gravity === 'up' ? -dropY : dropY) * 100 + contacts * 10 - holes * 50; 
    };

    let bestScore = -Infinity;
    let bestX = piecePos.x;
    let bestShape = currentPiece.shape;

    shapes.forEach((shape, rotIndex) => {
      // 1. Can we even rotate to this shape?
      let validStartX: number | null = null;
      const offsets = [0, -1, 1, -2, 2];
      for(const dx of offsets) {
        if(!checkCollision(grid, shape, piecePos.x + dx, piecePos.y)) {
            validStartX = piecePos.x + dx;
            break;
        }
      }

      if (validStartX !== null) {
        // 2. Trace towards col from validStartX
        const targetIntX = Math.round(col - (shape[0].length / 2));
        const clampedTargetX = Math.max(0, Math.min(TETRIS_COLS - shape[0].length, targetIntX));
        
        const step = clampedTargetX > validStartX ? 1 : -1;
        let currX = validStartX;
        const reachableXs = [currX];
        
        while (currX !== clampedTargetX) {
          const nextX = currX + step;
          if (checkCollision(grid, shape, nextX, piecePos.y)) {
              break; // hit a wall
          }
          currX = nextX;
          reachableXs.push(currX);
        }
        
        // 3. Evaluate all reachable Xs
        for (const testX of reachableXs) {
          const sc = evaluate(shape, testX, piecePos.y);

          const desiredX = col - (shape[0].length / 2);
          const clampedDesiredX = Math.max(0, Math.min(TETRIS_COLS - shape[0].length, desiredX));

          // Penalty for being far from clamped desired position (reduces edge hugging)
          const distPenalty = Math.abs(testX - Math.round(clampedDesiredX)) * 10000;
          
          // Tiny penalty for rotating to prevent jumping back and forth when scores are equal
          const rotPenalty = rotIndex === 0 ? 0 : 0.1;
          
          const totalScore = sc - distPenalty - rotPenalty;

          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestX = testX;
            bestShape = shape;
          }
        }
      }
    });

    if (bestScore !== -Infinity) {
      set({ 
        currentPiece: { ...currentPiece, shape: bestShape },
        piecePos: { ...piecePos, x: bestX }
      });
    }
  },

  tick: (isHardDrop = false, dropDistance = 0) => {
    const { grid, currentPiece, piecePos, status, score, addForce, gravity } = get();
    if (status !== 'playing' || !currentPiece) return;

    const direction = gravity === 'up' ? -1 : 1;

    if (!checkCollision(grid, currentPiece.shape, piecePos.x, piecePos.y + direction)) {
      set({ piecePos: { ...piecePos, y: piecePos.y + direction } });
      const currentTargetCol = get().targetCol;
      if (currentTargetCol !== null) {
        get().setColumn(currentTargetCol);
      }
      return;
    }

    // Merge piece
    const newGrid = grid.map(row => [...row]);
    let mergedOffScreen = false;
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c] !== 0) {
          const y = piecePos.y + r;
          if (y < 0) {
            mergedOffScreen = true;
          } else {
            newGrid[y][piecePos.x + c] = currentPiece.color;
          }
        }
      }
    }

    if (mergedOffScreen) {
      synth.playGameOverSound();
      set({ status: 'gameover', grid: newGrid });
      return;
    }

    if (isHardDrop) {
      synth.playHardDropSound();
      
      let intensity = 1;
      if (currentPiece.name === 'I' && dropDistance > 8) {
        intensity = 3;
        synth.playClearSound(); // Extra impact sound
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]); // Strong rumble
        }
      } else if (dropDistance > 10) {
        intensity = 2;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50); // Small rumble
        }
      }
      get().triggerShake(intensity);
      
      // Explosion on hard drop
      for (let r = 0; r < currentPiece.shape.length; r++) {
         for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c] !== 0) {
               const worldX = -(TETRIS_COLS / 2) + piecePos.x + c + 0.5;
               const worldY = (TETRIS_ROWS / 2) - piecePos.y - r - 0.5;
               get().addExplosion({ x: worldX, y: worldY, z: 0 }, currentPiece.color);
            }
         }
      }
    } else {
      synth.playPlaceSound();
    }

    const dropCenterWorldY = (TETRIS_ROWS / 2) - piecePos.y - currentPiece.shape.length / 2;
    // Spawn repulsors symmetrically outside the grid
    addForce({ x: -(TETRIS_COLS / 2) - 4, y: dropCenterWorldY, z: 0 }, 'repulsor', currentPiece.color);
    addForce({ x: (TETRIS_COLS / 2) + 4, y: dropCenterWorldY, z: 0 }, 'repulsor', currentPiece.color);

    // Clear lines
    let linesCleared = 0;
    let finalGrid = newGrid.filter((row, y) => {
      if (row.every(cell => cell !== null)) {
        linesCleared++;
        const worldY = (TETRIS_ROWS / 2) - y - 0.5;
        
        // Spawn attractors symmetrically outside the grid
        addForce({ x: -(TETRIS_COLS / 2) - 4, y: worldY, z: 0 }, 'attractor', '#ffffff');
        addForce({ x: (TETRIS_COLS / 2) + 4, y: worldY, z: 0 }, 'attractor', '#ffffff');
        
        row.forEach((cell, x) => {
          if (cell) {
             const worldX = -(TETRIS_COLS / 2) + x + 0.5;
             get().addExplosion({ x: worldX, y: worldY, z: 0 }, cell as string);
          }
        });

        return false;
      }
      return true;
    });

    if (linesCleared >= 2) {
      // Massive explosion when multiple lines cleared simultaneously
      for (let i = 0; i < linesCleared * 10; i++) {
        get().addExplosion(
          { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15, z: (Math.random() - 0.5) * 10 }, 
          '#ffffff'
        );
      }
    }

    while (finalGrid.length < TETRIS_ROWS) {
      if (gravity === 'up') {
        finalGrid.push(Array(TETRIS_COLS).fill(null));
      } else {
        finalGrid.unshift(Array(TETRIS_COLS).fill(null));
      }
    }

    let newCombo = get().combo;
    let newLastClearText = get().lastClearText;
    let newClearTextTrigger = get().clearTextTrigger;

    if (linesCleared > 0) {
      get().triggerShake();
      synth.playClearSound();
      newCombo++;
      switch(linesCleared) {
        case 1: newLastClearText = 'SINGLE'; break;
        case 2: newLastClearText = 'DOUBLE!'; break;
        case 3: newLastClearText = 'TRIPLE!!'; break;
        case 4: newLastClearText = 'TETRIS!!!'; break;
      }
      newClearTextTrigger = Date.now();
    } else {
        newCombo = 0;
    }

    const comboMultiplier = Math.max(1, newCombo);
    const points = linesCleared > 0 ? [0, 100, 300, 500, 800][linesCleared] * comboMultiplier : 0;
    
    if (points > 0) {
      const dropPointX = (piecePos.x - TETRIS_COLS / 2) + Math.floor(currentPiece.shape[0].length / 2);
      const dropPointY = (TETRIS_ROWS / 2) - piecePos.y - Math.floor(currentPiece.shape.length / 2);
      get().addFloatingText(`+${points}`, dropPointX, dropPointY, '#ffff00');
    }

    const newEnergy = Math.min(160, get().energy + linesCleared * 10 * comboMultiplier);
    const { nextPieces } = get();
    const nextPiece = nextPieces[0];
    const newNextPieces = [...nextPieces.slice(1), getRandomTetromino()];
    const startX = Math.floor(TETRIS_COLS / 2) - Math.floor(nextPiece.shape[0].length / 2);
    
    const newScore = score + points;
    const newHighScore = Math.max(get().highScore, newScore);
    if (newHighScore > get().highScore) {
       localStorage.setItem('tetrisHighScore', newHighScore.toString());
    }

    let newLevel = Math.floor(newScore / 2000) + 1;
    let newGravity = gravity;
    let newStatus = status;

    let newSingularityUses = get().singularityUses;

    if (newLevel > get().level) {
      synth.setLevel(newLevel);
      if (newLevel % 5 === 0) {
        const newColorList = generateUniqueColors();
        const colorMap = new Map<string, string>();
        Object.keys(TETROMINOS).forEach((type, index) => {
          const t = type as TetrominoType;
          colorMap.set(TETROMINOS[t].color, newColorList[index]);
          TETROMINOS[t].color = newColorList[index];
        });
        
        for (let r = 0; r < finalGrid.length; r++) {
          for (let c = 0; c < finalGrid[r].length; c++) {
            const cell = finalGrid[r][c];
            if (cell && colorMap.has(cell)) {
               finalGrid[r][c] = colorMap.get(cell)!;
            }
          }
        }
        
        const mapPiece = (p: Tetromino | null) => {
           if (!p) return null;
           return { ...p, color: colorMap.get(p.color) || p.color };
        };
        
        set({ 
          heldPiece: mapPiece(get().heldPiece)
        });
        
        nextPiece.color = colorMap.get(nextPiece.color) || nextPiece.color;
        newNextPieces.forEach(p => p.color = colorMap.get(p.color) || p.color);
      }

      if (newLevel % 10 === 0) {
        newStatus = 'switching_gravity';
        newGravity = newGravity === 'down' ? 'up' : 'down';
        newSingularityUses += 1;
        
        synth.playSingularitySound();
        get().addExplosion({ x: 0, y: 0, z: 0 }, '#a855f7');
        get().addExplosion({ x: -2, y: 3, z: -2 }, '#c084fc');
        get().addExplosion({ x: 2, y: -3, z: 2 }, '#e879f9');

        const forceY = newGravity === 'up' ? TETRIS_ROWS/2 + 2 : -TETRIS_ROWS/2 - 2;
        get().addForce({ x: 0, y: forceY, z: -10 }, 'attractor', '#9333ea');
        get().addForce({ x: 0, y: forceY > 0 ? forceY - 2 : forceY - 4, z: -10 }, 'attractor', '#c084fc');
        
        const packedGrid = Array(TETRIS_ROWS).fill(null).map(() => Array(TETRIS_COLS).fill(null));
        if (newGravity === 'down') {
          for (let c = 0; c < TETRIS_COLS; c++) {
            let writeRow = TETRIS_ROWS - 1;
            for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
              if (finalGrid[r][c] !== null) {
                packedGrid[writeRow][c] = finalGrid[r][c];
                writeRow--;
              }
            }
          }
        } else {
          for (let c = 0; c < TETRIS_COLS; c++) {
            let writeRow = 0;
            for (let r = 0; r < TETRIS_ROWS; r++) {
              if (finalGrid[r][c] !== null) {
                packedGrid[writeRow][c] = finalGrid[r][c];
                writeRow++;
              }
            }
          }
        }
        
        finalGrid = packedGrid.filter(row => !row.every(cell => cell !== null));
        
        while (finalGrid.length < TETRIS_ROWS) {
            if (newGravity === 'up') {
                finalGrid.push(Array(TETRIS_COLS).fill(null));
            } else {
                finalGrid.unshift(Array(TETRIS_COLS).fill(null));
            }
        }
        
        setTimeout(() => {
          if (useGameStore.getState().status === 'switching_gravity') {
             useGameStore.setState({ status: 'playing' });
          }
        }, 500);
      }
    }

    let { gameMode, sprintLinesCleared, rouletteNextShift } = get();
    
    let sprintEndTime = get().sprintEndTime;
    if (gameMode === 'sprint') {
       sprintLinesCleared += linesCleared;
       if (sprintLinesCleared >= 40) {
          synth.playClearSound();
          newStatus = 'won';
          sprintEndTime = Date.now();
       }
    }
    
    if (gameMode === 'roulette' && rouletteNextShift && Date.now() > rouletteNextShift) {
       newGravity = newGravity === 'down' ? 'up' : 'down';
       newStatus = 'switching_gravity';
       rouletteNextShift = Date.now() + 5000 + Math.random() * 10000;
       synth.playSingularitySound();
       get().triggerShake(3);
       
       // Flip the board vertically!
       finalGrid = [...finalGrid].reverse();
       
       setTimeout(() => {
          if (useGameStore.getState().status === 'switching_gravity') {
             useGameStore.setState({ status: 'playing' });
          }
       }, 500);
    }

    const startY = newGravity === 'up' ? TETRIS_ROWS - nextPiece.shape.length : 0;
    
     // Check game over on spawn
    if (newStatus !== 'gameover' && newStatus !== 'won' && checkCollision(finalGrid, nextPiece.shape, startX, startY)) {
       if (newEnergy >= 100 && newStatus !== 'switching_gravity') {
         set({ 
           status: newStatus,
           gravity: newGravity,
           grid: finalGrid, 
           currentPiece: nextPiece, 
           nextPieces: newNextPieces,
           piecePos: { x: startX, y: startY },
           score: newScore,
           combo: newCombo,
           lastClearText: newLastClearText,
           clearTextTrigger: newClearTextTrigger,
           energy: newEnergy,
           highScore: newHighScore,
           level: newLevel,
           singularityUses: newSingularityUses,
           canHold: true,
           sprintLinesCleared,
           rouletteNextShift,
           sprintEndTime
         });
         get().activateSingularity();
       } else {
         synth.playGameOverSound();
         set({ status: 'gameover', grid: finalGrid, score: newScore, combo: newCombo, lastClearText: newLastClearText, clearTextTrigger: newClearTextTrigger, highScore: newHighScore, energy: newEnergy, singularityUses: newSingularityUses, sprintLinesCleared, rouletteNextShift, sprintEndTime });
       }
    } else {
      set({ 
        status: newStatus,
        gravity: newGravity,
        grid: finalGrid, 
        currentPiece: nextPiece, 
        nextPieces: newNextPieces,
        piecePos: { x: startX, y: startY },
        score: newScore,
        combo: newCombo,
        lastClearText: newLastClearText,
        clearTextTrigger: newClearTextTrigger,
        energy: newEnergy,
        highScore: newHighScore,
        level: newLevel,
        singularityUses: newSingularityUses,
        canHold: true,
        sprintLinesCleared,
        rouletteNextShift,
        sprintEndTime
      });
    }
  },

  addForce: (position: Vector3, type: 'attractor' | 'repulsor', color: string) => {
    const forceId = Math.random().toString(36).substring(7);
    const force: ForceField = {
      id: forceId,
      position,
      type,
      ownerId: 'local',
      createdAt: Date.now(),
      color
    };
    set(state => {
      // Just add the new force, let clearForces handle lifetime
      const newForces = { ...state.forceFields };
      newForces[forceId] = force;

      const keys = Object.keys(newForces);
      if (keys.length > 50) {
        const sortedKeys = keys.sort((a, b) => newForces[b].createdAt - newForces[a].createdAt);
        for (let i = 50; i < sortedKeys.length; i++) {
          delete newForces[sortedKeys[i]];
        }
      }
      return { forceFields: newForces };
    });
  },

  addExplosion: (position, color) => set(state => ({ explosions: [...state.explosions, { position, color }] })),
  clearExplosions: () => set({ explosions: [] }),
  addTrail: (start, end, color) => set(state => ({ trails: [...state.trails, { start, end, color }] })),
  clearTrails: () => set({ trails: [] }),

  clearForces: () => {
    const now = Date.now();
    set(state => {
      const newForces = { ...state.forceFields };
      let changed = false;
      for (const [id, f] of Object.entries(newForces)) {
        // Attractors (line clear) last longer than Repulsors (drop)
        // Make them last much longer to clutter the screen and force singularity usage
        const lifetime = f.type === 'attractor' ? 12000 : 8000;
        if (now - f.createdAt > lifetime) {
          delete newForces[id];
          changed = true;
        }
      }
      return changed ? { forceFields: newForces } : state;
    });
  },

  addFloatingText: (text, x, y, color) => set(state => ({
    floatingTexts: [...state.floatingTexts, { id: Date.now() + Math.random(), text, x, y, color }]
  })),

  removeFloatingText: (id) => set(state => ({
    floatingTexts: state.floatingTexts.filter(t => t.id !== id)
  }))
}));

