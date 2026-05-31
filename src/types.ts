import * as THREE from 'three';

export type WeaponId =
  | 'pistol'
  | 'revolver'
  | 'pump_shotgun'
  | 'break_shotgun'
  | 'hunting_rifle'
  | 'lever_rifle'
  | 'battle_rifle'
  | 'smg'
  | 'tactical_shotgun'
  | 'cursed_grimoire';

export interface Weapon {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number;        // ms between shots
  clipSize: number;
  maxReserve: number;
  recoilX: number;
  recoilY: number;
  spread: number;
  reloadTime: number;      // ms
  price: number;
  isAutomatic: boolean;
  kickback: number;
  pellets?: number;        // shotgun pellet count
  isBoltAction?: boolean;
  isLeverAction?: boolean;
  isRevolver?: boolean;
  isBreakAction?: boolean;
  isPumpAction?: boolean;
}

export const WEAPON_DEFINITIONS: Record<WeaponId, Weapon> = {
  pistol: {
    id: 'pistol', name: 'M1911 Pistol',
    damage: 38, fireRate: 240, clipSize: 8, maxReserve: 64,
    recoilX: 0.012, recoilY: 0.035, spread: 0.022, reloadTime: 1600,
    price: 0, isAutomatic: false, kickback: 0.10,
  },
  revolver: {
    id: 'revolver', name: '.357 Revolver',
    damage: 85, fireRate: 420, clipSize: 6, maxReserve: 36,
    recoilX: 0.018, recoilY: 0.065, spread: 0.012, reloadTime: 2800,
    price: 0, isAutomatic: false, kickback: 0.22, isRevolver: true,
  },
  pump_shotgun: {
    id: 'pump_shotgun', name: 'Pump Shotgun',
    damage: 22, fireRate: 900, clipSize: 6, maxReserve: 48,
    recoilX: 0.025, recoilY: 0.090, spread: 0.065, reloadTime: 3200,
    price: 0, isAutomatic: false, kickback: 0.32, pellets: 8, isPumpAction: true,
  },
  break_shotgun: {
    id: 'break_shotgun', name: 'Break-Action Shotgun',
    damage: 28, fireRate: 1100, clipSize: 2, maxReserve: 24,
    recoilX: 0.022, recoilY: 0.088, spread: 0.055, reloadTime: 2400,
    price: 0, isAutomatic: false, kickback: 0.30, pellets: 9, isBreakAction: true,
  },
  hunting_rifle: {
    id: 'hunting_rifle', name: 'Hunting Rifle',
    damage: 140, fireRate: 1200, clipSize: 5, maxReserve: 30,
    recoilX: 0.010, recoilY: 0.080, spread: 0.004, reloadTime: 2600,
    price: 0, isAutomatic: false, kickback: 0.28, isBoltAction: true,
  },
  lever_rifle: {
    id: 'lever_rifle', name: 'Lever-Action Rifle',
    damage: 95, fireRate: 650, clipSize: 8, maxReserve: 48,
    recoilX: 0.014, recoilY: 0.055, spread: 0.015, reloadTime: 3400,
    price: 0, isAutomatic: false, kickback: 0.20, isLeverAction: true,
  },
  battle_rifle: {
    id: 'battle_rifle', name: 'Battle Rifle',
    damage: 70, fireRate: 180, clipSize: 20, maxReserve: 120,
    recoilX: 0.016, recoilY: 0.048, spread: 0.018, reloadTime: 2200,
    price: 0, isAutomatic: true, kickback: 0.16,
  },
  smg: {
    id: 'smg', name: 'SMG',
    damage: 28, fireRate: 80, clipSize: 30, maxReserve: 180,
    recoilX: 0.010, recoilY: 0.028, spread: 0.032, reloadTime: 1800,
    price: 0, isAutomatic: true, kickback: 0.08,
  },
  tactical_shotgun: {
    id: 'tactical_shotgun', name: 'Tactical Shotgun',
    damage: 20, fireRate: 500, clipSize: 8, maxReserve: 48,
    recoilX: 0.020, recoilY: 0.075, spread: 0.045, reloadTime: 2800,
    price: 0, isAutomatic: false, kickback: 0.25, pellets: 6,
  },
  cursed_grimoire: {
    id: 'cursed_grimoire', name: 'The Cursed Grimoire',
    damage: 280, fireRate: 900, clipSize: 8, maxReserve: 32,
    recoilX: 0.005, recoilY: 0.020, spread: 0.002, reloadTime: 3000,
    price: 0, isAutomatic: false, kickback: 0.05,
  },
};

export interface PlayerState {
  health: number;
  maxHealth: number;
  points: number;
  score: number;
  kills: number;
  slot1: WeaponId | null;
  slot2: WeaponId | null;
  activeSlot: 1 | 2;
  isADS: boolean;
  isSprinting: boolean;
  isReloading: boolean;
  reloadProgress: number;
  lastShotTime: number;
}

export interface WeaponAmmoState {
  clip: number;
  reserve: number;
  maxClip: number;
  maxReserve: number;
}

export interface Zombie {
  id: string;
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scoreReward: number;
  lastAttackTime: number;
  state: 'spawning' | 'chasing' | 'attacking' | 'dead';
  spawnerIndex: number;
  animTime: number;
}

export interface Barricade {
  id: string;
  position: [number, number, number];
  rotationY: number;
  planks: number;
  maxPlanks: number;
  plankMeshes: THREE.Mesh[];
  mesh: THREE.Group;
  repairProgress: number;
}

export interface WallBuy {
  id: string;
  weaponId: WeaponId;
  position: [number, number, number];
  rotationY: number;
  price: number;
  purchased: boolean;
  textMesh: THREE.Group;
}

export interface BuyableDoor {
  id: string;
  price: number;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  purchased: boolean;
  group: THREE.Group;
  wallMeshLeft?: THREE.Mesh;
  wallMeshRight?: THREE.Mesh;
  doorMesh?: THREE.Mesh;
  panelGroup?: any;
  sinkOffset: number;
}

export interface TeammateState {
  id: string;
  name: string;
  color: number;
  health: number;
  maxHealth: number;
  points: number;
  state: 'ALIVE' | 'DOWNED' | 'DEAD';
  activeWeapon: WeaponId;
}
