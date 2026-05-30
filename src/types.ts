import * as THREE from 'three';

export interface Weapon {
  id: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
  name: string;
  damage: number;
  fireRate: number; // in ms
  clipSize: number;
  maxReserve: number;
  recoilX: number;
  recoilY: number;
  spread: number;
  reloadTime: number; // in ms
  price: number;
  isAutomatic: boolean;
  kickback: number;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  points: number;
  score: number;
  kills: number;
  currentWeaponId: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
  weaponsOwned: {
    pistol: { clip: number; reserve: number };
    shotgun?: { clip: number; reserve: number };
    smg?: { clip: number; reserve: number };
    m16?: { clip: number; reserve: number };
    magnum?: { clip: number; reserve: number };
    sniper?: { clip: number; reserve: number };
    wonder_weapon?: { clip: number; reserve: number };
  };
  isADS: boolean;
  isSprinting: boolean;
  isReloading: boolean;
  reloadProgress: number; // 0 to 1
  lastShotTime: number;
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
  planks: number; // 0 to 6 planks left
  maxPlanks: number;
  plankMeshes: THREE.Mesh[];
  mesh: THREE.Group;
  repairProgress: number;
}

export interface WallBuy {
  id: string;
  weaponId: 'shotgun' | 'smg';
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
  activeWeapon: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
}

