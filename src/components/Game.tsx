import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Languages } from 'lucide-react';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  SCORE_PER_ROCKET, 
  WIN_SCORE, 
  ENEMY_SPEED_MIN, 
  ENEMY_SPEED_MAX, 
  PLAYER_MISSILE_SPEED,
  EXPLOSION_RADIUS_MAX,
  EXPLOSION_SPEED,
  COLORS,
  CITY_COUNT,
  BATTERY_COUNT
} from '../constants';
import { EnemyRocket, PlayerMissile, Explosion, City, Battery, GameState, Language, Point } from '../types';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<Language>('zh');
  
  // Game entities refs to avoid re-renders on every frame
  const entitiesRef = useRef({
    enemyRockets: [] as EnemyRocket[],
    playerMissiles: [] as PlayerMissile[],
    explosions: [] as Explosion[],
    cities: [] as City[],
    batteries: [] as Battery[],
    frameCount: 0,
    lastEnemySpawn: 0,
    isFiring: false,
    lastFireTime: 0,
    targetPos: { x: 0, y: 0 } as Point,
    lastSpecialScore: 0,
  });

  const initGame = () => {
    const batteries: Battery[] = [];
    for (let i = 0; i < BATTERY_COUNT; i++) {
      batteries.push({
        id: `battery-${i}`,
        x: (GAME_WIDTH / (BATTERY_COUNT + 1)) * (i + 1),
        y: GAME_HEIGHT - 30,
        active: true,
        missiles: 15
      });
    }

    const cityPositions = [
      GAME_WIDTH * 0.1, GAME_WIDTH * 0.2, 
      GAME_WIDTH * 0.4, GAME_WIDTH * 0.6,
      GAME_WIDTH * 0.8, GAME_WIDTH * 0.9
    ];

    const cities: City[] = [];
    for (let i = 0; i < CITY_COUNT; i++) {
      cities.push({
        id: `city-${i}`,
        x: cityPositions[i],
        y: GAME_HEIGHT - 20,
        active: true
      });
    }

    entitiesRef.current = {
      enemyRockets: [],
      playerMissiles: [],
      explosions: [],
      cities,
      batteries,
      frameCount: 0,
      lastEnemySpawn: 0,
      isFiring: false,
      lastFireTime: 0,
      targetPos: { x: 0, y: 0 },
      lastSpecialScore: 0,
    };
    setScore(0);
    setGameState('PLAYING');
  };

  const spawnEnemy = () => {
    const { cities, batteries } = entitiesRef.current;
    const activeTargets = [
      ...cities.filter(c => c.active),
      ...batteries.filter(b => b.active)
    ];

    if (activeTargets.length === 0) return;

    const target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
    const startX = Math.random() * GAME_WIDTH;
    const speed = ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN);
    
    const angle = Math.atan2(target.y - 0, target.x - startX);

    entitiesRef.current.enemyRockets.push({
      id: `enemy-${Date.now()}-${Math.random()}`,
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed,
      angle
    });
  };

  const fireMissile = (targetX: number, targetY: number) => {
    const activeBatteries = entitiesRef.current.batteries.filter(b => b.active);
    if (activeBatteries.length === 0) return;

    let nearestBattery = activeBatteries[0];
    let minDist = Infinity;

    activeBatteries.forEach(b => {
      const dist = Math.sqrt((b.x - targetX) ** 2 + (b.y - targetY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestBattery = b;
      }
    });

    entitiesRef.current.playerMissiles.push({
      id: `player-missile-${Date.now()}-${Math.random()}`,
      x: nearestBattery.x,
      y: nearestBattery.y,
      startX: nearestBattery.x,
      startY: nearestBattery.y,
      targetX,
      targetY,
      speed: PLAYER_MISSILE_SPEED
    });
  };

  const updateTargetPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    entitiesRef.current.targetPos = {
      x: (clientX - rect.left) * (GAME_WIDTH / rect.width),
      y: (clientY - rect.top) * (GAME_HEIGHT / rect.height)
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    entitiesRef.current.isFiring = true;
    updateTargetPos(e);
    
    // Fire immediately on click
    const now = Date.now();
    if (now - entitiesRef.current.lastFireTime > 200) {
      fireMissile(entitiesRef.current.targetPos.x, entitiesRef.current.targetPos.y);
      entitiesRef.current.lastFireTime = now;
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    updateTargetPos(e);
  };

  const handleMouseUp = () => {
    entitiesRef.current.isFiring = false;
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      const { enemyRockets, playerMissiles, explosions, cities, batteries, isFiring, targetPos, lastFireTime } = entitiesRef.current;

      // Continuous firing: 5 missiles per second (1 every 200ms)
      if (isFiring) {
        const now = Date.now();
        if (now - lastFireTime > 200) {
          fireMissile(targetPos.x, targetPos.y);
          entitiesRef.current.lastFireTime = now;
        }
      }

      // Spawn enemies
      entitiesRef.current.frameCount++;
      const spawnRate = Math.max(20, 100 - Math.floor(score / 100) * 10);
      if (entitiesRef.current.frameCount - entitiesRef.current.lastEnemySpawn > spawnRate) {
        spawnEnemy();
        entitiesRef.current.lastEnemySpawn = entitiesRef.current.frameCount;
      }

      // Update enemy rockets
      for (let i = enemyRockets.length - 1; i >= 0; i--) {
        const rocket = enemyRockets[i];
        rocket.x += Math.cos(rocket.angle) * rocket.speed;
        rocket.y += Math.sin(rocket.angle) * rocket.speed;

        // Check if hit target
        const distToTarget = Math.sqrt((rocket.x - rocket.targetX) ** 2 + (rocket.y - rocket.targetY) ** 2);
        if (distToTarget < 5) {
          // Hit!
          const city = cities.find(c => c.x === rocket.targetX && c.y === rocket.targetY);
          if (city) city.active = false;
          const battery = batteries.find(b => b.x === rocket.targetX && b.y === rocket.targetY);
          if (battery) battery.active = false;

          // Create explosion at impact
          explosions.push({
            id: `exp-impact-${Date.now()}`,
            x: rocket.x,
            y: rocket.y,
            radius: 0,
            maxRadius: EXPLOSION_RADIUS_MAX,
            growing: true,
            life: 0
          });

          enemyRockets.splice(i, 1);
          
          // Check lose condition
          if (batteries.every(b => !b.active)) {
            setGameState('LOST');
          }
          continue;
        }

        // Check if hit by explosion
        for (const exp of explosions) {
          const distToExp = Math.sqrt((rocket.x - exp.x) ** 2 + (rocket.y - exp.y) ** 2);
          if (distToExp < exp.radius) {
            enemyRockets.splice(i, 1);
            setScore(s => {
              const newScore = s + SCORE_PER_ROCKET;
              if (newScore >= WIN_SCORE) setGameState('WON');
              return newScore;
            });
            
            // Create secondary explosion
            explosions.push({
              id: `exp-enemy-${Date.now()}`,
              x: rocket.x,
              y: rocket.y,
              radius: 0,
              maxRadius: EXPLOSION_RADIUS_MAX,
              growing: true,
              life: 0
            });
            break;
          }
        }
      }

      // Update player missiles
      for (let i = playerMissiles.length - 1; i >= 0; i--) {
        const missile = playerMissiles[i];
        const angle = Math.atan2(missile.targetY - missile.y, missile.targetX - missile.x);
        missile.x += Math.cos(angle) * missile.speed;
        missile.y += Math.sin(angle) * missile.speed;

        const distToTarget = Math.sqrt((missile.x - missile.targetX) ** 2 + (missile.y - missile.targetY) ** 2);
        if (distToTarget < missile.speed) {
          // Create explosion
          explosions.push({
            id: `exp-player-${Date.now()}`,
            x: missile.targetX,
            y: missile.targetY,
            radius: 0,
            maxRadius: EXPLOSION_RADIUS_MAX,
            growing: true,
            life: 0
          });
          playerMissiles.splice(i, 1);
        }
      }

      // Update explosions
      for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        if (exp.growing) {
          exp.radius += EXPLOSION_SPEED;
          if (exp.radius >= exp.maxRadius) {
            exp.growing = false;
          }
        } else {
          exp.radius -= EXPLOSION_SPEED * 0.5;
          if (exp.radius <= 0) {
            explosions.splice(i, 1);
          }
        }
      }
    };

    const draw = () => {
      ctx.fillStyle = COLORS.BACKGROUND;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const { enemyRockets, playerMissiles, explosions, cities, batteries } = entitiesRef.current;

      // Draw Cities
      cities.forEach(city => {
        if (city.active) {
          ctx.fillStyle = COLORS.CITY;
          ctx.beginPath();
          ctx.rect(city.x - 15, city.y - 10, 30, 20);
          ctx.fill();
          // Windows
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(city.x - 10, city.y - 5, 4, 4);
          ctx.fillRect(city.x + 6, city.y - 5, 4, 4);
        }
      });

      // Draw Batteries
      batteries.forEach(battery => {
        if (battery.active) {
          ctx.fillStyle = COLORS.BATTERY;
          ctx.beginPath();
          ctx.moveTo(battery.x - 20, battery.y + 10);
          ctx.lineTo(battery.x, battery.y - 15);
          ctx.lineTo(battery.x + 20, battery.y + 10);
          ctx.fill();
        }
      });

      // Draw Enemy Rockets
      enemyRockets.forEach(rocket => {
        ctx.strokeStyle = COLORS.ENEMY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rocket.x - Math.cos(rocket.angle) * 10, rocket.y - Math.sin(rocket.angle) * 10);
        ctx.lineTo(rocket.x, rocket.y);
        ctx.stroke();
        
        ctx.fillStyle = COLORS.ENEMY;
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Player Missiles
      playerMissiles.forEach(missile => {
        ctx.strokeStyle = COLORS.PLAYER_MISSILE;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(missile.startX, missile.startY);
        ctx.lineTo(missile.x, missile.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1; // Reset for other drawings

        // Target X
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(missile.targetX - 5, missile.targetY - 5);
        ctx.lineTo(missile.targetX + 5, missile.targetY + 5);
        ctx.moveTo(missile.targetX + 5, missile.targetY - 5);
        ctx.lineTo(missile.targetX - 5, missile.targetY + 5);
        ctx.stroke();
      });

      // Draw Explosions
      explosions.forEach(exp => {
        const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, '#fbbf24');
        gradient.addColorStop(0.6, '#f97316');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, score]);

  const t = {
    zh: {
      title: 'Tina新星防御',
      start: '开始游戏',
      win: '恭喜！你成功保卫了地球！',
      lose: '防线崩溃，城市陷落...',
      score: '得分',
      target: '目标',
      playAgain: '再玩一次',
      instructions: '点击屏幕发射拦截导弹，摧毁敌方火箭。',
      winScore: '达成 1000 分即获胜。'
    },
    en: {
      title: 'Tina Nova Defense',
      start: 'Start Game',
      win: 'Victory! You saved the planet!',
      lose: 'Defense breached, cities fallen...',
      score: 'Score',
      target: 'Target',
      playAgain: 'Play Again',
      instructions: 'Click to fire interceptors and destroy enemy rockets.',
      winScore: 'Reach 1000 points to win.'
    }
  }[lang];

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Header UI */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-white tracking-tighter flex items-center gap-2">
            <Shield className="text-blue-500" />
            {t.title}
          </h1>
          <div className="text-emerald-400 font-mono text-sm">
            {t.score}: {score} / {WIN_SCORE}
          </div>
        </div>
        
        <button 
          onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          className="pointer-events-auto bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors text-white"
        >
          <Languages size={20} />
        </button>
      </div>

      {/* Game Canvas */}
      <div className="relative w-full max-w-4xl aspect-[4/3] bg-neutral-900 shadow-2xl border border-white/10 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="w-full h-full cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <Target className="w-16 h-16 text-blue-500 mx-auto mb-6" />
                <h2 className="text-4xl font-bold text-white mb-4">{t.title}</h2>
                <p className="text-neutral-400 mb-8">{t.instructions} {t.winScore}</p>
                <button
                  onClick={initGame}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                >
                  {t.start}
                </button>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'WON' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-emerald-900/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <Trophy className="w-20 h-20 text-yellow-400 mb-6" />
              <h2 className="text-4xl font-bold text-white mb-4">{t.win}</h2>
              <p className="text-emerald-100 mb-8 text-xl">{t.score}: {score}</p>
              <button
                onClick={initGame}
                className="px-8 py-3 bg-white text-emerald-900 rounded-full font-bold text-lg transition-all hover:bg-emerald-50 flex items-center gap-2"
              >
                <RefreshCw size={20} />
                {t.playAgain}
              </button>
            </motion.div>
          )}

          {gameState === 'LOST' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-red-900/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <AlertTriangle className="w-20 h-20 text-white mb-6" />
              <h2 className="text-4xl font-bold text-white mb-4">{t.lose}</h2>
              <p className="text-red-100 mb-8 text-xl">{t.score}: {score}</p>
              <button
                onClick={initGame}
                className="px-8 py-3 bg-white text-red-900 rounded-full font-bold text-lg transition-all hover:bg-red-50 flex items-center gap-2"
              >
                <RefreshCw size={20} />
                {t.playAgain}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Instructions */}
      <div className="mt-8 text-neutral-500 text-sm hidden md:block">
        {lang === 'zh' ? '提示：预判火箭落点进行拦截' : 'Tip: Predict rocket trajectory for interception'}
      </div>
    </div>
  );
};

export default Game;
