export type ZombieType = 'walker' | 'runner' | 'brute' | 'screamer';
export type ZombieState = 'spawning' | 'chasing' | 'attacking' | 'dead';

export interface ZombieModel {
  id: string;
  type: ZombieType;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scoreReward: number;
  pointReward: number;
  lastAttackTime: number;
  state: ZombieState;
  spawnerIndex: number;
  animTime: number;
  position: [number, number, number];
}

export const ZOMBIE_DEFINITIONS: Record<ZombieType, Omit<ZombieModel, 'id' | 'state' | 'lastAttackTime' | 'animTime' | 'spawnerIndex' | 'position'>> = {
  walker: {
    type: 'walker',
    health: 150,
    maxHealth: 150,
    speed: 1.8,
    damage: 40,
    scoreReward: 100,
    pointReward: 10,
  },
  runner: {
    type: 'runner',
    health: 80,
    maxHealth: 80,
    speed: 4.5,
    damage: 25,
    scoreReward: 150,
    pointReward: 15,
  },
  brute: {
    type: 'brute',
    health: 600,
    maxHealth: 600,
    speed: 1.0,
    damage: 100,
    scoreReward: 500,
    pointReward: 50,
  },
  screamer: {
    type: 'screamer',
    health: 100,
    maxHealth: 100,
    speed: 2.2,
    damage: 20,
    scoreReward: 300,
    pointReward: 30,
  },
};

export function createZombie(
  id: string,
  type: ZombieType,
  spawnerIndex: number,
  position: [number, number, number]
): ZombieModel {
  const def = ZOMBIE_DEFINITIONS[type];
  return {
    ...def,
    id,
    state: 'spawning',
    lastAttackTime: 0,
    animTime: 0,
    spawnerIndex,
    position,
  };
}
