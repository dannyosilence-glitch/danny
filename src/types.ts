export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface EnemyRocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  angle: number;
}

export interface PlayerMissile extends Entity {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  speed: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
  life: number;
}

export interface City extends Entity {
  active: boolean;
}

export interface Battery extends Entity {
  active: boolean;
  missiles: number;
}

export type GameState = 'START' | 'PLAYING' | 'WON' | 'LOST';
export type Language = 'zh' | 'en';
