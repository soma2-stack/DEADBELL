export type PowerUpType =
  | 'max_ammo'
  | 'nuke'
  | 'double_points'
  | 'insta_kill'
  | 'carpenter';

export interface PowerUpModel {
  id: string;
  type: PowerUpType;
  position: [number, number, number];
  spawnedAt: number;
  expiresAt: number;       // time the drop disappears if uncollected
  activatedAt?: number;   // time the effect was triggered
  duration?: number;       // ms — only for timed power-ups
  isActive: boolean;
  isCollected: boolean;
}

export const POWER_UP_DURATIONS: Partial<Record<PowerUpType, number>> = {
  double_points: 30_000,
  insta_kill: 30_000,
};

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  max_ammo: 'Max Ammo',
  nuke: 'Nuke',
  double_points: 'Double Points',
  insta_kill: 'Insta-Kill',
  carpenter: 'Carpenter',
};

export function createPowerUp(
  id: string,
  type: PowerUpType,
  position: [number, number, number]
): PowerUpModel {
  return {
    id,
    type,
    position,
    spawnedAt: Date.now(),
    expiresAt: Date.now() + 30_000,
    duration: POWER_UP_DURATIONS[type],
    isActive: false,
    isCollected: false,
  };
}
