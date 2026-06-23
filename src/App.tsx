/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CosmicCanvas } from './components/CosmicCanvas';
import { useGameStore, TETRIS_COLS, TETRIS_ROWS, checkCollision } from './store/useGameStore';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { synth } from './lib/audio';

function TetrisBoard() {
  const { grid, currentPiece, piecePos, status, level } = useGameStore();

  // Combine grid and current piece for rendering
  const renderGrid = grid.map(row => [...row]);

  if (currentPiece && status === 'playing') {
    const gravity = useGameStore.getState().gravity;
    // Generate Ghost Piece
    let ghostY = piecePos.y;
    const direction = gravity === 'up' ? -1 : 1;
    while (!checkCollision(grid, currentPiece.shape, piecePos.x, ghostY + direction)) {
      ghostY += direction;
    }

    // Render Ghost Piece
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c] !== 0) {
          const y = ghostY + r;
          const x = piecePos.x + c;
          if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS && !renderGrid[y][x]) {
            renderGrid[y][x] = `ghost:${currentPiece.color}`;
          }
        }
      }
    }

    // Render Current Piece
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c] !== 0) {
          const y = piecePos.y + r;
          const x = piecePos.x + c;
          if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS) {
            renderGrid[y][x] = currentPiece.color;
          }
        }
      }
    }
  }

  // Calculate intensity based on level
  const noiseSpeed = Math.max(2, 20 - level * 1.5);
  const filterIntensity = Math.min(1.0, level * 0.05);

  return (
    <div 
      className="relative mx-auto w-min p-2 rounded-xl transition-all duration-1000 border border-white/5"
      style={{
        backgroundColor: `transparent`
      }}
    >
      <div 
        className="grid gap-[1px] relative z-10" 
        style={{ 
          gridTemplateColumns: `repeat(${TETRIS_COLS}, 24px)`,
          gridTemplateRows: `repeat(${TETRIS_ROWS}, 24px)`
        }}
      >
        {renderGrid.map((row, y) => (
          row.map((cellValue, x) => (
            <div 
              key={`${y}-${x}`} 
              className="w-full h-full"
            />
          ))
        ))}
      </div>
      
      {status === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-20 rounded-xl">
          <h2 className="text-3xl font-bold text-red-500 mb-4 tracking-widest uppercase">Game Over</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => useGameStore.getState().startGame()}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 transition-colors border border-white/20 rounded-full font-medium"
            >
              Play Again
            </button>
            <button 
              onClick={() => useGameStore.setState({ status: 'idle' })}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-gray-300 rounded-full font-medium"
            >
              Menu
            </button>
          </div>
        </div>
      )}

      {status === 'won' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-20 rounded-xl">
          <h2 className="text-4xl font-bold text-yellow-400 mb-2 tracking-widest uppercase drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">Sprint Clear!</h2>
          <div className="text-2xl font-mono text-white mb-6 bg-white/10 px-4 py-2 rounded-lg border border-white/20">
            Time: {useGameStore.getState().sprintEndTime ? 
              (() => {
                const elapsed = useGameStore.getState().sprintEndTime! - useGameStore.getState().sprintStartTime!;
                const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
                const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
                const ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
                return `${mins}:${secs}.${ms}`;
              })() : '00:00.00'}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => useGameStore.getState().startGame()}
              className="px-6 py-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors border border-yellow-500/50 rounded-full font-bold uppercase tracking-widest text-sm"
            >
              Play Again
            </button>
            <button 
              onClick={() => useGameStore.setState({ status: 'idle' })}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-gray-300 rounded-full font-medium"
            >
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { level, singularityUses, nextPieces, heldPiece, holdPiece, energy, activateSingularity, shiftGridLeft, shiftGridRight, status, score, highScore, startGame, togglePause, toggleAutoplay, cycleAutoplaySpeed, autoplay, autoplaySpeed, moveLeft, moveRight, moveDown, rotate, hardDrop, tick, clearForces, setColumn, piecePos, currentPiece, combo, lastClearText, clearTextTrigger, settings, updateSettings, shakeTrigger, shakeIntensity, gameMode, sprintLinesCleared, setGameMode, sprintStartTime, sprintEndTime } = useGameStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showClearText, setShowClearText] = useState(false);
  const prevLevelRef = useRef(level);
  const [sprintTimeStr, setSprintTimeStr] = useState('00:00.00');

  useEffect(() => {
    if (gameMode !== 'sprint' || !sprintStartTime) return;
    
    let req: number;
    const updateTime = () => {
       if (useGameStore.getState().status !== 'playing' && useGameStore.getState().status !== 'switching_gravity' && useGameStore.getState().status !== 'won' && useGameStore.getState().status !== 'gameover') return;
       const end = useGameStore.getState().sprintEndTime;
       const elapsed = (end || Date.now()) - sprintStartTime;
       const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
       const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
       const ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
       setSprintTimeStr(`${mins}:${secs}.${ms}`);
       if (!end && useGameStore.getState().status === 'playing' || useGameStore.getState().status === 'switching_gravity') {
          req = requestAnimationFrame(updateTime);
       }
    };
    req = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(req);
  }, [status, gameMode, sprintStartTime]);

  useEffect(() => {
     if (clearTextTrigger > 0) {
        setShowClearText(true);
        const timer = setTimeout(() => setShowClearText(false), 2000);
        return () => clearTimeout(timer);
     }
  }, [clearTextTrigger]);

  useEffect(() => {
    if (shakeTrigger > 0) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 150); // Shorter shake for hard drops and clears
    }
  }, [shakeTrigger]);

  useEffect(() => {
    if (level > prevLevelRef.current) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500); // Longer shake for level up
    }
    prevLevelRef.current = level;
  }, [level]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && (status === 'playing' || status === 'paused')) {
        togglePause();
        return;
      }
      if (status !== 'playing') return;
      switch (e.code) {
        case 'ArrowLeft': 
        case 'KeyA': moveLeft(); break;
        case 'ArrowRight': 
        case 'KeyD': moveRight(); break;
        case 'ArrowDown': 
        case 'KeyS': moveDown(); break;
        case 'ArrowUp': 
        case 'KeyW': rotate(); break;
        case 'Space': hardDrop(); break;
        case 'ShiftLeft':
        case 'ShiftRight': activateSingularity(); break;
        case 'KeyQ': shiftGridLeft(); break;
        case 'KeyE': shiftGridRight(); break;
        case 'KeyC':
        case 'KeyH': holdPiece(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, moveLeft, moveRight, moveDown, rotate, hardDrop, holdPiece, togglePause, activateSingularity, shiftGridLeft, shiftGridRight]);

  useEffect(() => {
    if (status !== 'playing') return;
    
    // Every 2 singularity uses decreases the effective speed level by 1
    const effectiveSpeedLevel = Math.max(1, level - Math.floor(singularityUses / 2));
    const intervalTime = Math.max(80, 600 * Math.pow(0.85, effectiveSpeedLevel - 1));
    const autoplaySpeed = useGameStore.getState().autoplaySpeed;
    const finalIntervalTime = useGameStore.getState().autoplay ? intervalTime / autoplaySpeed : intervalTime;

    const interval = setInterval(() => {
      if (useGameStore.getState().autoplay && status === 'playing') {
        useGameStore.getState().performAutoplayMove();
      } else {
        tick();
      }
      clearForces();
    }, finalIntervalTime); // game speed tick
    return () => clearInterval(interval);
  }, [status, tick, clearForces, level, singularityUses, useGameStore.getState().autoplaySpeed, useGameStore.getState().autoplay]);

  return (
    <div 
      className={`relative w-screen h-screen overflow-hidden bg-black text-white font-sans flex items-center justify-center ${isShaking ? 'animate-shake' : ''}`}
      style={isShaking ? { '--shake-int': shakeIntensity } as React.CSSProperties : {}}
    >
      <CosmicCanvas />
      
      {/* Floaty Text */}
      <AnimatePresence mode="popLayout">
        {showClearText && lastClearText && (
           <motion.div 
             key={clearTextTrigger}
             initial={{ opacity: 0, scale: 0.5, y: -20, rotate: -5 }}
             animate={{ opacity: 1, scale: 1, y: -60, rotate: 0 }}
             exit={{ opacity: 0, scale: 1.2, filter: 'blur(5px)' }}
             transition={{ duration: 0.8, type: 'spring', bounce: 0.6 }}
             className="absolute md:-left-40 top-1/4 z-40 pointer-events-none drop-shadow-2xl flex flex-col items-center justify-center opacity-70"
             style={{ textShadow: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.5)' }}
             onAnimationComplete={() => {
                // To auto-remove if we want, but letting AnimatePresence handle it with a timeout below.
             }}
           >
             <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-white to-fuchsia-400">
               {lastClearText}
             </h2>
             {combo > 1 && (
               <motion.span 
                 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                 className="text-2xl text-yellow-300 font-bold mt-1"
               >
                 {combo}x COMBO!
               </motion.span>
             )}
           </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
         {status === 'playing' && checkCollision(useGameStore.getState().grid, currentPiece?.shape || [], piecePos.x, piecePos.y) === false && (
             // Hidden text used for syncing state removal. We'll use a local state to clean up.
             null
         )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearText && (
          <motion.div 
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-0 bg-white/20 pointer-events-none z-30 mix-blend-screen"
          />
        )}
      </AnimatePresence>
      
      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-6">
        
        <div className="absolute top-8 left-8">
           <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-mono italic">
            COSMIC TETRIS
          </h1>
          <p className="mt-2 text-gray-400 max-w-xs text-sm">
            Use Arrow Keys to move & rotate.<br/>Space to hard drop.<br />C to Hold Piece.
          </p>

          <div className="mt-8 font-mono">
            <div className="text-sm text-gray-500 uppercase tracking-widest mb-2">Hold</div>
            <div className="w-32 h-32 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center p-2 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
              {heldPiece && (
                <div 
                  className="grid gap-[2px]" 
                  style={{ 
                    gridTemplateColumns: `repeat(${heldPiece.shape[0].length}, 20px)`,
                    gridTemplateRows: `repeat(${heldPiece.shape.length}, 20px)`
                  }}
                >
                  {heldPiece.shape.map((row, y) => (
                    row.map((cell, x) => (
                      <div 
                        key={`${y}-${x}`} 
                        className="w-full h-full rounded-[3px]"
                        style={{
                          backgroundColor: cell ? heldPiece.color : 'transparent',
                          boxShadow: cell ? `0 0 10px ${heldPiece.color}, inset 0 0 5px rgba(255,255,255,0.5)` : 'none',
                          border: cell ? `2px solid ${heldPiece.color}` : 'none'
                        }}
                      />
                    ))
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-8 right-8 text-right font-mono flex flex-col items-end">
          <div className="text-sm text-gray-500 uppercase tracking-widest">High Score</div>
          <div className="text-2xl font-bold text-yellow-200/80 mb-4 shadow-yellow-200/50 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            {highScore.toString().padStart(6, '0')}
          </div>

          <div className="text-sm text-gray-500 uppercase tracking-widest">Score</div>
          <div className="text-4xl font-bold text-white shadow-cyan-400/50 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
            {score.toString().padStart(6, '0')}
          </div>
          
          <div className="mt-4 text-sm text-gray-500 uppercase tracking-widest">Level</div>
          <div className="text-2xl font-bold text-cyan-200 shadow-cyan-400/50 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]">
            {level}
          </div>
          <div className="w-full h-1 mt-1 bg-white/10 rounded overflow-hidden max-w-[80px]">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300" 
              style={{ width: `${(score % 2000) / 2000 * 100}%` }} 
            />
          </div>

          {gameMode === 'sprint' && (
            <div className="mt-6 flex flex-col items-end">
              <div className="text-sm text-yellow-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">Time</div>
              <div className="text-2xl font-bold font-mono text-white">{sprintTimeStr}</div>
              <div className="text-sm text-yellow-400 uppercase tracking-widest mt-2 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">Lines</div>
              <div className="text-xl font-bold text-white max-w-[80px] w-full text-right">
                <span className="text-cyan-300">{sprintLinesCleared}</span> <span className="text-gray-500">/ 40</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col items-end w-32">
            <div className={`text-sm tracking-widest uppercase ${energy >= 100 ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : 'text-gray-500'}`}>
              Singularity
            </div>
            <div className="w-full h-2 mt-2 bg-white/10 rounded-full overflow-hidden shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-300 transition-all duration-300" 
                style={{ width: `${Math.min(100, energy)}%`, boxShadow: energy >= 100 ? '0 0 15px rgba(167,139,250,0.9)' : 'none' }} 
              />
            </div>
            {energy > 100 && (
               <div className="text-[10px] text-yellow-300 mt-1 uppercase tracking-wider font-bold text-right">
                Overcap: {energy - 100} / 60
              </div>
            )}
            {energy >= 100 && (
              <div className="text-[10px] text-fuchsia-300 mt-2 uppercase tracking-wider animate-pulse font-bold text-right drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]">
                [SHIFT] Collapse
              </div>
            )}
            {energy >= 10 && (
               <div className="text-[10px] text-cyan-300 mt-2 uppercase tracking-wider font-bold text-right drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">
                [Q] / [E] Grid Shift
              </div>
            )}
          </div>

          <div className="mt-8 font-mono flex flex-col items-end gap-2">
            <div className="text-sm text-gray-500 uppercase tracking-widest mb-1 text-right">Next</div>
            {nextPieces && nextPieces.slice(0, 3).map((piece, pieceIndex) => (
              <div 
                key={`next-box-${pieceIndex}`} 
                className={`flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-[0_0_30px_rgba(255,255,255,0.02)]
                  ${pieceIndex === 0 ? 'w-32 h-32' : 'w-24 h-24 opacity-60'}`}
              >
                <div 
                  className="grid gap-[2px]" 
                  style={{ 
                    gridTemplateColumns: `repeat(${piece.shape[0].length}, ${pieceIndex === 0 ? '20' : '12'}px)`,
                    gridTemplateRows: `repeat(${piece.shape.length}, ${pieceIndex === 0 ? '20' : '12'}px)`
                  }}
                >
                  {piece.shape.map((row, y) => (
                    row.map((cell, x) => (
                      <div 
                        key={`next-${pieceIndex}-${y}-${x}`} 
                        className="w-full h-full rounded-[3px]"
                        style={{
                          backgroundColor: cell ? piece.color : 'transparent',
                          boxShadow: cell ? `0 0 ${pieceIndex === 0 ? '10' : '5'}px ${piece.color}, inset 0 0 5px rgba(255,255,255,0.5)` : 'none',
                          border: cell ? `2px solid ${piece.color}` : 'none'
                        }}
                      />
                    ))
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsMuted(synth.toggleMute())}
            className="mt-8 pointer-events-auto flex items-center justify-end gap-2 text-gray-400 hover:text-white transition-colors ml-auto text-sm tracking-widest"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>
        </div>

        <div 
          className="pointer-events-auto touch-none select-none" 
          ref={boardRef}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (status === 'playing') rotate(); }}
          onPointerDown={(e) => {
            if (status !== 'playing' || !currentPiece || !boardRef.current) return;
            const rect = boardRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const colWidth = rect.width / TETRIS_COLS;
            const targetCol = x / colWidth;
            
            if (e.button === 0) {
              setColumn(targetCol);
              hardDrop();
            } else if (e.button === 2) {
              setColumn(targetCol);
              rotate();
            } else if (e.button === 1) {
              holdPiece();
            }
          }}
          onWheel={(e) => {
            if (status !== 'playing') return;
            rotate();
          }}
          onPointerMove={(e) => {
            // Must have buttons pressed or just freely hovering? 
            // In tetris, hovering to control column is easiest for mouse only.
            if (status !== 'playing' || !currentPiece || !boardRef.current) return;
            const rect = boardRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const colWidth = rect.width / TETRIS_COLS;
            const targetCol = x / colWidth;
            setColumn(targetCol);
          }}
        >
          {status === 'idle' ? (
             <div className="flex flex-col items-center justify-center bg-white/5 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] cursor-default">
               
               <div className="flex gap-4 mb-8">
                 <button 
                  onClick={() => setGameMode('standard')}
                  className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all border ${gameMode === 'standard' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                 >
                   Standard
                 </button>
                 <button 
                  onClick={() => setGameMode('sprint')}
                  className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all border ${gameMode === 'sprint' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                 >
                   40-Line Sprint
                 </button>
                 <button 
                  onClick={() => setGameMode('roulette')}
                  className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all border ${gameMode === 'roulette' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                 >
                   Gravity Roulette
                 </button>
               </div>

               <button 
                onClick={() => startGame()}
                className="flex items-center gap-3 px-8 py-4 bg-white text-black hover:bg-gray-200 transition-colors rounded-full font-bold text-xl uppercase tracking-widest cursor-pointer"
               >
                 <Play size={24} fill="currentColor" />
                 Start {gameMode.charAt(0).toUpperCase() + gameMode.slice(1)} Game
               </button>
             </div>
          ) : status === 'paused' ? (
             <div className="flex flex-col items-center justify-center bg-white/5 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] cursor-default">
                <div className="text-4xl font-bold tracking-widest mb-6 uppercase text-cyan-200 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]">
                  Paused
                </div>
               <div className="flex gap-4 mb-6">
                 <button 
                  onClick={() => togglePause()}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-black hover:bg-gray-200 transition-colors rounded-full font-bold text-xl uppercase tracking-widest cursor-pointer"
                 >
                   <Play size={24} fill="currentColor" />
                   Resume
                 </button>
                 <button 
                  onClick={() => useGameStore.setState({ status: 'idle' })}
                  className="flex items-center gap-3 px-8 py-4 bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-colors rounded-full font-bold text-xl uppercase tracking-widest cursor-pointer"
                 >
                   Menu
                 </button>
               </div>
               
               {/* Settings */}
               <div className="flex flex-col gap-2 mb-6 w-full max-w-[250px]">
                 <div className="text-sm text-gray-400 font-bold uppercase tracking-widest text-center mb-2">Visuals</div>
                 <button onClick={() => updateSettings({ showBackgroundStars: !settings.showBackgroundStars })} className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border transition-all ${settings.showBackgroundStars ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}>
                   Background Stars: {settings.showBackgroundStars ? 'ON' : 'OFF'}
                 </button>
                 <button onClick={() => updateSettings({ showBlockTrails: !settings.showBlockTrails })} className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border transition-all ${settings.showBlockTrails ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}>
                   Block Trails: {settings.showBlockTrails ? 'ON' : 'OFF'}
                 </button>
                 <button onClick={() => updateSettings({ showExplosions: !settings.showExplosions })} className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border transition-all ${settings.showExplosions ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}>
                   Explosions: {settings.showExplosions ? 'ON' : 'OFF'}
                 </button>
                 <button onClick={() => updateSettings({ showForceFields: !settings.showForceFields })} className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border transition-all ${settings.showForceFields ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}>
                   Force Fields: {settings.showForceFields ? 'ON' : 'OFF'}
                 </button>
                 <button onClick={() => updateSettings({ showGhostPiece: !settings.showGhostPiece })} className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border transition-all ${settings.showGhostPiece ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}>
                   Ghost Piece: {settings.showGhostPiece ? 'ON' : 'OFF'}
                 </button>
               </div>

               <div className="flex gap-2">
                 <button 
                  onClick={() => toggleAutoplay()}
                  className={`flex items-center gap-2 px-4 py-2 opacity-50 hover:opacity-100 ${autoplay ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50' : 'bg-white/5 text-gray-500 border-white/10'} transition-all rounded-full font-bold text-xs uppercase tracking-widest cursor-pointer border`}
                 >
                  Autoplay {autoplay ? 'ON' : 'OFF'}
                 </button>
                 {autoplay && (
                   <button 
                    onClick={() => cycleAutoplaySpeed()}
                    className="flex items-center gap-2 px-4 py-2 opacity-50 hover:opacity-100 bg-white/5 text-gray-400 border-white/10 transition-all rounded-full font-bold text-xs uppercase tracking-widest cursor-pointer border"
                   >
                    Speed {autoplaySpeed}x
                   </button>
                 )}
               </div>
             </div>
          ) : status === 'switching_gravity' ? (
             <div className="flex flex-col items-center justify-center bg-white/5 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] cursor-default animate-pulse">
                <div className="text-4xl font-bold tracking-widest uppercase text-fuchsia-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.9)]">
                  GRAVITY SHIFT
                </div>
             </div>
          ) : (
            <TetrisBoard />
          )}
        </div>
      </div>
    </div>
  );
}

