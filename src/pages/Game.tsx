import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, query, where, orderBy, limit, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Game Constants & Logic ---
const BLOCK_HEIGHT = 40;
const INITIAL_BLOCK_WIDTH = 250;
const INITIAL_SPEED = 4;
const CAMERA_LERP = 0.1;

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  emotion?: 'happy' | 'scared' | 'sweat' | 'focused' | 'neutral';
}

interface MovingBlock extends Block {
  speed: number;
  direction: 1 | -1;
  colorIndex: number;
  targetY: number;
  isDropping: boolean;
  time?: number;
  angle?: number;
  trolleyX?: number;
  dropX?: number;
  dropAngle?: number;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8F94',
  '#6B5B95', '#f97316', '#90EE90', '#FFB6B9',
  '#45B8AC', '#EFC050', '#8b5cf6', '#f43f5e'
];

interface ScoreEntry {
  name: string;
  score: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  
  const [highScore, setHighScore] = useState(0);
  
  // Game session saving & Ads
  const [showAd, setShowAd] = useState(false);
  const [adTimer, setAdTimer] = useState(30);
  const gamesPlayedRef = useRef(0);

  // Refs for closures
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  const leaderboardRef = useRef(leaderboard);
  leaderboardRef.current = leaderboard;
  const highScoreRef = useRef(highScore);
  highScoreRef.current = highScore;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('towerstack_highscore');
    if (saved) setHighScore(parseInt(saved, 10));

    const savedName = localStorage.getItem('gt_player_name');
    if (savedName) setPlayerName(savedName);

    if (localStorage.getItem('gt_save')) {
        setHasSavedGame(true);
    }
    
    // Auth and global leaderboard
    const setupFirebase = async () => {
      try {
        await signInAnonymously(auth);
        
        const q = query(
          collection(db, 'leaderboard'),
          where('score', '>=', 0),
          orderBy('score', 'desc'),
          limit(5)
        );
        
        onSnapshot(q, (snapshot) => {
          const globalLeaderboard: ScoreEntry[] = [];
          snapshot.forEach((doc) => {
             const data = doc.data();
             globalLeaderboard.push({ name: data.name, score: data.score });
          });
          setLeaderboard(globalLeaderboard);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'leaderboard');
        });

      } catch (error) {
        console.error("Auth failed: ", error);
      }
    };
    setupFirebase();
  }, []);

  useEffect(() => {
    let interval: any;
    if (showAd && adTimer > 0) {
      interval = setInterval(() => setAdTimer(t => t - 1), 1000);
    } else if (adTimer === 0 && showAd) {
      setShowAd(false);
    }
    return () => clearInterval(interval);
  }, [showAd, adTimer]);

  // Mutable game data used in requestAnimationFrame
  const engine = useRef({
    blocks: [] as Block[],
    currentBlock: null as MovingBlock | null,
    cameraY: 0,
    targetCameraY: 0,
    width: 0,
    height: 0,
    lastTime: 0,
    reqId: 0,
    particles: [] as {x: number, y: number, vx: number, vy: number, life: number, color: string, size: number}[],
    clouds: [] as {x: number, y: number, size: number, speed: number}[],
  });

  // Initialization & Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      const state = engine.current;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        state.width = canvas.width;
        state.height = canvas.height;
        
        // Initial setup if not started
        if (engine.current.blocks.length === 0) {
           initGame();
        }
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    const loop = (time: number) => {
      const dt = time - engine.current.lastTime;
      engine.current.lastTime = time;
      
      update(dt);
      draw(ctx);
      
      engine.current.reqId = requestAnimationFrame(loop);
    };
    
    engine.current.reqId = requestAnimationFrame(loop);
    
    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(engine.current.reqId);
    };
  }, [gameState]); // Restart loop if state changes slightly, but mutable state keeps it stable

  const initGame = () => {
    const state = engine.current;
    state.blocks = [{
      x: state.width / 2 - INITIAL_BLOCK_WIDTH / 2,
      y: state.height - 150, // Start higher to be clearly visible above the bottom
      width: INITIAL_BLOCK_WIDTH,
      height: BLOCK_HEIGHT * 2, // Make base block thicker
      color: '#cbd5e1', // Base pedestal color
      emotion: 'happy'
    }];
    
    state.cameraY = 0;
    state.targetCameraY = 0;
    state.particles = [];
    
    state.clouds = [];
    for(let i=0; i<10; i++) {
        state.clouds.push({
            x: Math.random() * state.width,
            y: state.height * 0.5 - Math.random() * state.height * 3, // mostly upwards
            size: 20 + Math.random() * 40,
            speed: 0.1 + Math.random() * 0.3
        });
    }

    spawnBlock();
  };

  const spawnBlock = () => {
    const state = engine.current;
    const lastBlock = state.blocks[state.blocks.length - 1];
    const newY = lastBlock.y - BLOCK_HEIGHT;
    
    // Choose starting side randomly
    const startLeft = Math.random() > 0.5;
    
    // Pick next color index based on length
    const colorIndex = (state.blocks.length - 1) % COLORS.length;

    state.currentBlock = {
      x: state.width / 2 - lastBlock.width / 2,
      y: newY - 150,
      targetY: newY,
      isDropping: false,
      width: lastBlock.width,
      height: BLOCK_HEIGHT,
      colorIndex: colorIndex,
      color: COLORS[colorIndex],
      speed: INITIAL_SPEED + (state.blocks.length * 0.05), // Increase speed gradually
      direction: startLeft ? 1 : -1,
      emotion: 'focused',
      time: startLeft ? 1.5 : 4.5
    };

    // Calculate camera target to keep active block at 60% of screen height
    // meaning the bottom 40% will show previous blocks (~4 blocks)
    state.targetCameraY = Math.max(0, state.height * 0.6 - newY);
  };

  const createParticles = (x: number, y: number, width: number, color: string) => {
    const amount = 15;
    for(let i=0; i<amount; i++) {
       engine.current.particles.push({
         x: x + Math.random() * width,
         y: y + Math.random() * BLOCK_HEIGHT,
         vx: (Math.random() - 0.5) * 8,
         vy: Math.random() * 5 + 2,
         life: 1.0,
         color,
         size: Math.random() * 8 + 4
       });
    }
  };

  const handleAction = () => {
    if (gameState === 'MENU' || showAd) {
      return; // Handled by buttons if menu or ad is showing
    }
    
    if (gameState === 'GAMEOVER') {
      initGame();
      setScore(0);
      setGameState('PLAYING');
      return;
    }

    // PLAYING ACTION (trigger drop drop)
    const state = engine.current;
    if (!state.currentBlock || state.currentBlock.isDropping) return;

    state.currentBlock.isDropping = true;
    state.currentBlock.dropAngle = state.currentBlock.angle;
    state.currentBlock.dropX = state.currentBlock.x;
    state.currentBlock.emotion = 'scared';
  };

  const startGameFn = () => {
      if (!playerName.trim()) return;
      localStorage.setItem('gt_player_name', playerName);
      initGame();
      setScore(0);
      setGameState('PLAYING');
  };

  const resumeGame = () => {
      const savedData = localStorage.getItem('gt_save');
      if (savedData) {
          try {
              const { score: s, blocks } = JSON.parse(savedData);
              engine.current.blocks = blocks;
              engine.current.cameraY = 0;
              engine.current.targetCameraY = 0;
              
              if (blocks.length > 0) {
                  const topY = blocks[blocks.length-1].y;
                  engine.current.targetCameraY = Math.max(0, engine.current.height * 0.6 - topY);
                  engine.current.cameraY = engine.current.targetCameraY;
              }
              
              setScore(s);
              spawnBlock();
              setGameState('PLAYING');
              setHasSavedGame(false);
          } catch(e) {
              console.error(e);
              startGameFn();
          }
      }
  };

  const finalizePlacement = () => {
    const state = engine.current;
    const current = state.currentBlock;
    const previous = state.blocks[state.blocks.length - 1];

    if (!current) return;

    const currentLeft = current.x;
    const currentRight = current.x + current.width;
    const previousLeft = previous.x;
    const previousRight = previous.x + previous.width;

    // Check overlap
    if (currentRight < previousLeft || currentLeft > previousRight) {
      // Missed completely - Game Over
      setGameState('GAMEOVER');
      
      const pName = playerNameRef.current;
      const currentScore = scoreRef.current;
      
      if (pName.trim() && auth.currentUser) {
        const uid = auth.currentUser.uid;
        
        let oldScore = 0;
        getDoc(doc(db, 'leaderboard', uid)).then(docSnap => {
            if (docSnap.exists()) {
                oldScore = docSnap.data().score || 0;
            }
            
            if (currentScore > oldScore) {
                setDoc(doc(db, 'leaderboard', uid), {
                    name: pName,
                    score: currentScore,
                    userId: uid,
                    updatedAt: serverTimestamp()
                }).catch(err => {
                    handleFirestoreError(err, OperationType.WRITE, 'leaderboard');
                });
            }
        }).catch(err => {
            handleFirestoreError(err, OperationType.GET, 'leaderboard');
        });
      }

      if (currentScore > highScoreRef.current) {
        setHighScore(currentScore);
        localStorage.setItem('towerstack_highscore', currentScore.toString());
      }
      
      // Clear game save
      localStorage.removeItem('gt_save');

      // Ads logic: show Ad every 2 games played
      gamesPlayedRef.current += 1;
      if (gamesPlayedRef.current >= 2) {
          gamesPlayedRef.current = 0;
          setShowAd(true);
          setAdTimer(30);
      }
      return;
    }

    // Calculate overlap and crop
    const overlapLeft = Math.max(currentLeft, previousLeft);
    const overlapRight = Math.min(currentRight, previousRight);
    
    // Perfect match tolerance (e.g. within 5px) counts as perfect
    const diff = Math.abs(current.x - previous.x);
    const tolerance = 6;
    
    let finalX, finalWidth;
    let newEmotion: 'happy' | 'scared' | 'sweat' | 'focused' | 'neutral' = 'neutral';
    
    let pointsEarned = 1;

    if (diff < tolerance) {
      // Perfect placement!
      finalX = previous.x;
      finalWidth = previous.width;
      newEmotion = 'happy';
      pointsEarned = 2; // Perfect drop gives 2 points!
      createParticles(finalX, current.y + BLOCK_HEIGHT, finalWidth, 'white');
    } else {
      // Cropped
      finalX = overlapLeft;
      finalWidth = overlapRight - overlapLeft;
      
      if (finalWidth < previous.width * 0.4) {
          newEmotion = 'scared';
      } else {
          newEmotion = 'sweat';
      }
      
      const brokenX = current.x < previous.x ? current.x : previous.x + previous.width;
      const brokenWidth = current.width - finalWidth;
      createParticles(brokenX, current.y, brokenWidth, current.color);
    }

    // Update block and stack it
    state.blocks.push({
      x: finalX,
      y: current.targetY,
      width: finalWidth,
      height: BLOCK_HEIGHT,
      color: current.color,
      emotion: newEmotion
    });

    state.currentBlock = null;
    const newScore = scoreRef.current + pointsEarned;
    setScore(newScore);

    // Save game progress
    localStorage.setItem('gt_save', JSON.stringify({ 
      score: newScore, 
      blocks: state.blocks 
    }));

    // Spawn next block
    spawnBlock();
  };

  const update = (dt: number) => {
    const state = engine.current;
    if (gameState !== 'PLAYING') return;

    // Update camera Lerp
    state.cameraY += (state.targetCameraY - state.cameraY) * CAMERA_LERP;

    // Update current block
    if (state.currentBlock) {
      const b = state.currentBlock;
      // frame-rate independent movement approx (dt base 16.6ms)
      const adjustedSpeed = b.speed * (dt / 16.6) || b.speed;
      
      if (!b.isDropping) {
        if (b.time === undefined) b.time = 0;
        
        const yOffset = state.cameraY;
        const craneY = -yOffset + Math.max(80, state.height * 0.12);
        const pivotY = craneY + 24;
        
        // Trolley is fixed in the center
        b.trolleyX = state.width / 2;
        
        const speedMultiplier = b.speed * 0.0006;
        b.time += dt * speedMultiplier;
        
        const swingY = b.targetY - 140;
        const ropeLength = Math.max(80, swingY - pivotY);
        
        // Pendulum swing effect from the fixed trolley
        const maxAngle = Math.PI / 3; // Wider swing angle for gameplay
        b.angle = Math.sin(b.time) * maxAngle;
        
        b.x = b.trolleyX + Math.sin(b.angle) * ropeLength - b.width / 2;
        b.y = pivotY + Math.cos(b.angle) * ropeLength;

      } else {
        // Dropping physics
        const dropSpeed = Math.max(15, adjustedSpeed * 3);
        b.y += dropSpeed;
        
        // Slight pendulum effect on the drop adding touch of realism
        if (b.dropAngle !== undefined) {
           // Move x slightly based on the angle it was released at
           b.x += Math.sin(b.dropAngle) * dropSpeed * 0.4;
           // Dampen the angle as it falls naturally
           b.dropAngle *= 0.92;
        } else {
           if (b.dropX === undefined) b.dropX = b.x;
           b.x = b.dropX;
        }
        
        if (b.y >= b.targetY) {
            b.y = b.targetY;
            finalizePlacement();
        }
      }
    }

    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // gravity
      p.life -= 0.02;
      
      if (p.life <= 0 || p.y > state.height + state.cameraY) {
        state.particles.splice(i, 1);
      }
    }

    // Update clouds
    state.clouds.forEach(c => {
       c.x += c.speed;
       if (c.x > state.width + 100) {
          c.x = -100;
          c.y = state.height * 0.5 - state.cameraY - Math.random() * state.height * 1.5;
       }
    });
  };

  const drawFace = (ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, emotion: string) => {
     ctx.save();
     ctx.translate(cx, cy);
     ctx.fillStyle = 'rgba(0,0,0,0.5)';
     ctx.strokeStyle = 'rgba(0,0,0,0.5)';
     ctx.lineWidth = 3;
     ctx.lineCap = 'round';

     if (width < 30) {
       // Too small for a generic face, draw a dot
       ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
       ctx.restore(); return;
     }

     if (emotion === 'happy') {
         // ^ ^
         ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(-8, -4, -4, 2); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(4, 2); ctx.quadraticCurveTo(8, -4, 12, 2); ctx.stroke();
         // smile
         ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI, false); ctx.fill();
     } else if (emotion === 'scared') {
         // O O
         ctx.beginPath(); ctx.arc(-8, 0, 4, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI*2); ctx.fill();
         // open mouth
         ctx.beginPath(); ctx.ellipse(0, 8, 3, 5, 0, 0, Math.PI*2); ctx.fill();
     } else if (emotion === 'sweat') {
         // > < 
         ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(-6, 2); ctx.lineTo(-12, 6); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(12, -2); ctx.lineTo(6, 2); ctx.lineTo(12, 6); ctx.stroke();
         // wavy mouth
         ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.stroke();
         // sweat drop
         ctx.fillStyle = '#60a5fa';
         ctx.beginPath(); ctx.arc(14, -4, 3, 0, Math.PI*2); ctx.fill();
     } else if (emotion === 'focused') {
         // Focused eyes
         ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-4, 2); ctx.lineTo(-10, 6); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(4, 2); ctx.lineTo(10, 6); ctx.stroke();
         ctx.beginPath(); ctx.arc(0, 6, 2, 0, Math.PI*2); ctx.fill();
     } else {
         // Base cute neutral face: o o
         ctx.beginPath(); ctx.arc(-8, 0, 3, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI*2); ctx.fill();
         ctx.beginPath(); ctx.moveTo(-3, 6); ctx.quadraticCurveTo(0, 9, 3, 6); ctx.stroke();
     }
     ctx.restore();
  }

  const drawBlock3D = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, isBase: boolean, emotion?: string) => {
    // Candy Block rendering
    ctx.fillStyle = color;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x, y, width, height, 8); else ctx.rect(x,y,width,height);
    ctx.fill();

    if (!isBase) {
      // Glass/Candy Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x, y, width, height * 0.4, [8, 8, 0, 0]); else ctx.fillRect(x, y, width, height * 0.4);
      ctx.fill();

      // Bottom shadow edge
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x, y + height * 0.7, width, height * 0.3, [0, 0, 8, 8]); else ctx.fillRect(x, y + height * 0.7, width, height * 0.3);
      ctx.fill();
      
      // Thick border
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x, y, width, height, 8); else ctx.rect(x,y,width,height);
      ctx.stroke();

      if (emotion) drawFace(ctx, x + width/2, y + height/2, width, emotion);
    } else {
       // Base styling
       ctx.fillStyle = 'rgba(255,255,255,0.1)';
       ctx.fillRect(x, y, width, height*0.2);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const state = engine.current;
    ctx.clearRect(0, 0, state.width, state.height);

    ctx.save();
    // Move world down depending on camera
    const yOffset = state.cameraY; 

    // ---- Draw Parallax Background (Clouds) ----
    ctx.save();
    ctx.translate(0, yOffset * 0.3); // Moves 30% speed
    state.clouds.forEach(c => {
       ctx.fillStyle = score >= 20 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)';
       ctx.beginPath();
       ctx.arc(c.x, c.y, c.size, 0, Math.PI*2);
       ctx.arc(c.x + c.size*0.8, c.y - c.size*0.4, c.size*0.8, 0, Math.PI*2);
       ctx.arc(c.x + c.size*1.6, c.y, c.size*0.9, 0, Math.PI*2);
       ctx.fill();
    });
    ctx.restore();

    ctx.translate(0, yOffset);
    
    // ---- Draw Ground ----
    ctx.save();
    const baseBlock = state.blocks[0];
    const groundY = baseBlock ? baseBlock.y + baseBlock.height : state.height - 100;

    // Deep earth layer
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(state.width/2, groundY + 15, state.width * 0.85, 110, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(0, groundY + 15, state.width, state.height);

    // Lush grass top layer
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.ellipse(state.width/2, groundY, state.width * 0.8, 100, 0, Math.PI, 0);
    ctx.fill();

    // Grass outline for polish
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(state.width/2, groundY, state.width * 0.8, 100, 0, 0, Math.PI);
    ctx.stroke();

    // Pedestal shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(state.width/2, groundY, INITIAL_BLOCK_WIDTH * 0.6, 25, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // ---- Draw blocks ----
    state.blocks.forEach((b, index) => {
      drawBlock3D(ctx, b.x, b.y, b.width, b.height, b.color, index === 0, b.emotion);
    });

    // Draw current moving block with a string/rope
    if (state.currentBlock && gameState === 'PLAYING') {
      const cb = state.currentBlock;
      const craneY = -yOffset + Math.max(80, state.height * 0.12);
      const mastX = Math.max(60, state.width * 0.15);
      const jibRight = Math.min(state.width - 20, state.width * 0.95);
      const jibLeft = mastX - 80;
      const pivotY = craneY + 24;

      ctx.save();
      // ---- Draw Horizontal Jib ----
      // Top structure
      ctx.fillStyle = '#0f172a'; 
      ctx.fillRect(jibLeft, craneY, jibRight - jibLeft, 8); 
      // Bottom rail
      ctx.fillRect(jibLeft, craneY + 24, jibRight - jibLeft, 6); 
      // Zig-zag truss support
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for(let x = jibLeft; x < jibRight - 20; x += 30) {
          ctx.moveTo(x, craneY + 8);
          ctx.lineTo(x + 15, craneY + 24);
          ctx.lineTo(x + 30, craneY + 8);
      }
      ctx.stroke();

      // ---- Draw Vertical Mast ----
      const mastWidth = 32;
      const halfMast = mastWidth / 2;
      ctx.fillStyle = '#0f172a';
      // Left and right vertical beams
      ctx.fillRect(mastX - halfMast, craneY - 30, 8, state.height * 3 + yOffset);
      ctx.fillRect(mastX + halfMast - 8, craneY - 30, 8, state.height * 3 + yOffset);
      
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for(let y = craneY + 50; y < craneY + state.height * 3 + yOffset; y += 40) {
          ctx.moveTo(mastX - halfMast + 8, y);
          ctx.lineTo(mastX + halfMast - 8, y + 20);
          ctx.moveTo(mastX + halfMast - 8, y);
          ctx.lineTo(mastX - halfMast + 8, y + 20);
          ctx.moveTo(mastX - halfMast, y);
          ctx.lineTo(mastX + halfMast, y);
      }
      ctx.stroke();

      // Base of Crane
      const baseBlock = state.blocks[0];
      const groundY = baseBlock ? baseBlock.y + baseBlock.height : state.height - 100;
      ctx.fillStyle = '#cbd5e1'; // concrete light
      ctx.fillRect(mastX - 40, groundY - 20, 80, 20);
      ctx.fillStyle = '#94a3b8'; // concrete dark
      ctx.fillRect(mastX - 30, groundY - 40, 60, 20);

      // Top block above jib
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mastX - halfMast, craneY - 30, mastWidth, 30);
      
      // Yellow highlight level on mast
      ctx.fillStyle = '#eab308';
      ctx.fillRect(mastX - halfMast, craneY + 140, mastWidth, 30);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mastX - halfMast + 4, craneY + 144);
      ctx.lineTo(mastX + halfMast - 4, craneY + 166);
      ctx.moveTo(mastX + halfMast - 4, craneY + 144);
      ctx.lineTo(mastX - halfMast + 4, craneY + 166);
      ctx.stroke();

      // Yellow counterweight at the end of the left jib
      ctx.fillStyle = '#eab308';
      ctx.fillRect(jibLeft, craneY, 30, 30);
      ctx.restore();

      const trolleyX = cb.trolleyX || mastX;
      
      // ---- Draw Trolley ----
      ctx.save();
      const trolleyWidth = 30;
      ctx.fillStyle = '#eab308'; // Construction yellow
      if(ctx.roundRect) ctx.roundRect(trolleyX - trolleyWidth/2, pivotY - 4, trolleyWidth, 8, 2);
      else ctx.fillRect(trolleyX - trolleyWidth/2, pivotY - 4, trolleyWidth, 8);
      ctx.fill();
      
      // Trolley Wheels
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(trolleyX - 8, pivotY - 4, 3, 0, Math.PI*2);
      ctx.arc(trolleyX + 8, pivotY - 4, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // ---- Draw Cable and Hook ----
      if (!cb.isDropping) {
        ctx.save();
        ctx.beginPath();
        const hookX = cb.x + cb.width / 2;
        const hookY = cb.y;
        
        ctx.moveTo(trolleyX, pivotY + 4);
        ctx.lineTo(hookX, hookY - 20); // Cable to top of hook
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Simple hook connector
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(hookX - 10, hookY - 20, 20, 6); // Top bar
        
        // Hook shape
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hookX, hookY - 14);
        ctx.lineTo(hookX, hookY - 6);
        ctx.arc(hookX - 2, hookY - 2, 4, Math.PI*2, Math.PI);
        ctx.stroke();
        
        ctx.restore();
      } else {
        // Draw retracted hook on trolley when dropped
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trolleyX, pivotY + 4);
        ctx.lineTo(trolleyX, pivotY + 40);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const hookX = trolleyX;
        const hookY = pivotY + 46;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(hookX - 10, hookY - 6, 20, 6);
        
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hookX, hookY);
        ctx.lineTo(hookX, hookY + 8);
        ctx.arc(hookX - 2, hookY + 12, 4, Math.PI*2, Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      drawBlock3D(ctx, cb.x, cb.y, cb.width, cb.height, cb.color, false, cb.emotion);
    }

    // Draw particles
    state.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      // Little square particles
      if(ctx.roundRect) ctx.roundRect(p.x, p.y, p.size, p.size, 2); else ctx.rect(p.x, p.y, p.size, p.size);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  return (
    <div 
       className="relative w-full h-[100dvh] overflow-hidden cursor-pointer select-none touch-manipulation"
       onPointerDown={handleAction}
    >
       {/* Background decorative elements */}
       <div className="absolute inset-0 z-0 bg-sky-300">
          <div className={`absolute inset-0 bg-gradient-to-b from-sky-300 to-blue-200 transition-opacity duration-1000 ${score < 10 ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute inset-0 bg-gradient-to-b from-orange-300 to-rose-300 transition-opacity duration-1000 ${score >= 10 && score < 20 ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute inset-0 bg-gradient-to-b from-indigo-900 to-purple-800 transition-opacity duration-1000 ${score >= 20 && score < 30 ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute inset-0 bg-gradient-to-b from-slate-900 to-black transition-opacity duration-1000 ${score >= 30 ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`stars absolute inset-0 transition-opacity duration-1000 ${score >= 20 ? 'opacity-40' : 'opacity-0'}`} />
       </div>

       <canvas 
          ref={canvasRef} 
          className="absolute inset-0 z-10 w-full h-full block" 
       />

       {/* UI Layer */}
       <div className="absolute inset-0 z-20 pointer-events-none flex flex-col pt-24 pb-8 px-6">
          
           {/* Header Score Info */}
           <div className="flex justify-between items-start">
             <div className="text-white drop-shadow-md">
                {gameState !== 'MENU' && (
                   <div className="flex flex-col items-center bg-slate-900/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 shadow-lg">
                      <span className="text-xs text-white/80 uppercase tracking-widest font-bold">النقاط</span>
                      <span className="text-4xl font-black text-white">{score}</span>
                   </div>
                )}
             </div>
             
             {/* Leaderboard Area on Top Left */}
             <div className="flex flex-col gap-2 pointer-events-auto">
               {highScore > 0 && (
                  <div className="flex flex-col items-end bg-slate-900/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 shadow-lg">
                    <span className="text-xs text-white/80 uppercase tracking-widest font-bold">أفضل رقم</span>
                    <span className="text-xl font-bold text-yellow-300">{highScore}</span>
                  </div>
               )}
               {leaderboard.length > 0 && (
                 <div className="bg-slate-900/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 shadow-lg text-right min-w-[120px] max-w-[160px]">
                    <span className="text-xs text-white/80 font-bold block mb-2 border-b border-white/20 pb-1">أفضل 5 لاعبين</span>
                    <div className="flex flex-col gap-1">
                      {leaderboard.map((entry, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                           <span className="font-bold text-yellow-400">{entry.score}</span>
                           <span className="text-white truncate max-w-[80px] ml-2" dir="ltr">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
             </div>
           </div>

          {/* Menus */}
          {gameState === 'MENU' && (
             <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
               <div className="bg-slate-900/80 backdrop-blur-md p-8 pt-10 rounded-3xl border border-white/20 shadow-2xl text-center max-w-sm w-full mx-4 pointer-events-auto">
                 <img src="https://img.sanishtech.com/u/fcd2c5fc16d776c77696c4416f266e43.png" alt="Gamerspaces Logo" className="h-24 mx-auto mb-6" />
                 <h1 className="text-3xl font-black text-white mb-2 drop-shadow-lg">Gamerspaces Tower</h1>
                 <p className="text-white/80 mb-6 font-medium drop-shadow">قم ببناء أطول برج ممكن!</p>
                 
                 <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="أدخل اسمك"
                    className="w-full bg-slate-800/50 border border-white/20 rounded-xl px-4 py-3 text-white text-center mb-6 focus:outline-none focus:border-blue-500 transition-colors"
                 />
                 
                 <div className="flex flex-col gap-3">
                   <button 
                      onClick={startGameFn}
                      disabled={!playerName.trim()}
                      className="w-full bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white text-xl font-black py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95"
                   >
                      لعبة جديدة
                   </button>
                   
                   {hasSavedGame && (
                     <button 
                        onClick={resumeGame}
                        disabled={!playerName.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xl font-black py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95"
                     >
                        متابعة اللعبة
                     </button>
                   )}
                 </div>
               </div>
             </div>
          )}

          {gameState === 'GAMEOVER' && !showAd && (
             <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-300">
               <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-3xl border border-red-500/30 shadow-2xl text-center max-w-sm w-full mx-4 pointer-events-auto">
                 <h2 className="text-4xl font-black text-red-400 mb-2 drop-shadow">انتهت اللعبة!</h2>
                 <p className="text-white/80 mb-6 font-medium">البرج فقد توازنه</p>
                 
                 <div className="bg-black/30 rounded-xl p-4 mb-8">
                   <div className="text-sm text-white/70 mb-1">النتيجة النهائية</div>
                   <div className="text-5xl font-black text-white">{score}</div>
                 </div>
                 
                 <button 
                    onClick={() => {
                        initGame();
                        setScore(0);
                        setGameState('PLAYING');
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white text-xl font-black py-4 px-8 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                    حاول مرة أخرى
                 </button>
               </div>
             </div>
          )}

          {/* Ad Overlay */}
          {showAd && gameState === 'GAMEOVER' && (
             <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 pointer-events-auto bg-black/80">
               <div className="bg-slate-800 p-8 rounded-3xl border-2 border-slate-600 shadow-2xl text-center max-w-md w-full mx-4 flex flex-col items-center">
                 <div className="w-16 h-16 bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center text-2xl font-black mb-4">
                    {adTimer}
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-4">إعلان ممول</h2>
                 <p className="text-slate-300 mb-8">يرجى الانتظار بينما نحضر لك أفضل العروض...</p>
                 
                 <div className="w-full h-32 bg-slate-700/50 rounded-xl border border-slate-500/30 flex items-center justify-center mb-8">
                    <span className="text-slate-400 uppercase tracking-widest text-sm">مساحة إعلانية</span>
                 </div>
                 
                 {adTimer <= 20 ? ( // Skip allowed after 10 seconds (30 to 20)
                   <button 
                     onClick={() => setShowAd(false)}
                     className="bg-transparent border border-white/20 text-white/70 hover:text-white hover:bg-white/10 px-6 py-2 rounded-full transition-all"
                   >
                     تخطي الإعلان
                   </button>
                 ) : (
                   <button disabled className="bg-transparent border border-white/5 mx-auto text-white/30 px-6 py-2 rounded-full">
                     يمكنك التخطي قريباً...
                   </button>
                 )}
               </div>
             </div>
          )}

          {/* Tutorial text during play */}
          {gameState === 'PLAYING' && score === 0 && (
             <div className="mt-auto pb-20 text-center animate-pulse drop-shadow-lg">
                <p className="text-xl font-bold text-white/90 bg-black/30 inline-block px-4 py-2 rounded-full">انقر مع كل مستوى للحفاظ على التوازن!</p>
             </div>
          )}

       </div>
    </div>
  );
}
