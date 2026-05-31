import { WeaponId, WeaponAmmoState } from '../types';

export interface PlayerModel {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  points: number;
  score: number;
  kills: number;
  slot1: WeaponId | null;
  slot2: WeaponId | null;
  activeSlot: 1 | 2;
  ammo: Record<WeaponId, WeaponAmmoState>;
  isADS: boolean;
  isSprinting: boolean;
  isReloading: boolean;
  reloadProgress: number;
  lastShotTime: number;
  isAlive: boolean;
  downdedAt?: number;
}

export function createDefaultPlayer(id: string, name: string): PlayerModel {
  return {
    id,
    name,
    health: 100,
    maxHealth: 100,
    points: 500,
    score: 0,
    kills: 0,
    slot1: 'pistol',
    slot2: null,
    activeSlot: 1,
    ammo: {} as Record<WeaponId, WeaponAmmoState>,
    isADS: false,
    isSprinting: false,
    isReloading: false,
    reloadProgress: 0,
    lastShotTime: 0,
    isAlive: true,
  };
}
