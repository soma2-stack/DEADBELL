// src/world/rooms.ts
// Full 3D level matching the Ft. Knell Academy reference layout:
//
//   [Starting Classroom] --- [Hallway 1] --- [Classroom 102 / Fast Hands]
//                                  |--- [Classroom 103 / Forbidden Tome]
//
// Coordinate system (Three.js):
//   X+ = East   X- = West
//   Z- = North  Z+ = South
//   Y  = Up
//
// Layout overview:
//   Starting Classroom : X: -55 .. -5   Z: -22 .. 22   (50×44 units)
//   Hallway 1          : X:  -5 ..  5   Z: -44 .. 44   ( 10×88 units)
//   Classroom 102      : X:   5 ..  45  Z: -44 .. -4   ( 40×40 units)
//   Classroom 103      : X:   5 ..  45  Z:   4 ..  44  ( 40×40 units)

import * as THREE from 'three';
import { CollisionSystem } from '../core/collision';

const WALL_H = 4.5;
const CEIL_H = 4.5;

// ─── Types ──────────────────────────────────────────────────────────────────
export type Door = {
  id: string;
  x: number;
  z: number;
  rotationY: number;
  price: number;
  target: string;
  width?: number;   // door leaf width (default 1.2)
  height?: number;  // door leaf height (default 3.6)
};

export type Room = {
  id: string;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walls: WallDef[];
  obstacles: ObstacleDef[];
  doors: Door[];
  spawns: { x: number; z: number; weight: number }[];
};

type WallDef = {
  x: number; z: number;
  length: number;
  isX: boolean;        // true = wall runs along X axis, false = along Z axis
  gap?: { start: number; size: number }; // opening (doorway) in wall
};

type ObstacleDef = {
  id?: string;
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  rotY?: number;
  type?: 'desk' | 'chair' | 'locker' | 'board' | 'debris' | 'perk' | 'tome' | 'generic';
};

// ─── Room Definitions ───────────────────────────────────────────────────────
export const ROOMS: Record<string, Room> = {

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  STARTING CLASSROOM  (left side, largest room)                          │
  // │  X: -55 .. -5   Z: -22 .. 22   inner 50×44                             │
  // └─────────────────────────────────────────────────────────────────────────┘
  startingClassroom: {
    id: 'startingClassroom',
    name: 'Starting Classroom',
    bounds: { minX: -55, maxX: -5, minZ: -22, maxZ: 22 },
    walls: [
      // West wall  (full)
      { x: -55, z: -22, length: 44, isX: false },
      // East wall  (two sections — gap at Z=-4..4 for hallway door, Z=4..12 second gap)
      { x: -5, z: -22, length: 18, isX: false },                  // north section
      { x: -5, z: -4,  length: 8,  isX: false },                  // middle gap filler removed → door gaps
      { x: -5, z:  4,  length: 18, isX: false },                  // south section
      // North wall (full)
      { x: -55, z: -22, length: 50, isX: true },
      // South wall (full)
      { x: -55, z:  22, length: 50, isX: true },
    ],
    obstacles: [
      // ── Teacher area (north wall) ──
      // Teacher desk (large, front-center)
      { id: 'td', x: -30, y: 0.75, z: -18, w: 4.0, h: 0.75, d: 1.6, type: 'desk' },
      // Chair behind teacher desk
      { id: 'tc', x: -30, y: 0.45, z: -16.5, w: 0.5, h: 0.45, d: 0.5, type: 'chair' },
      // Whiteboard (on north wall)
      { id: 'wb', x: -30, y: 2.5, z: -21.9, w: 10, h: 2.2, d: 0.08, type: 'board' },

      // ── Student desks — 4 rows × 4 cols ──
      ...studentDesks(-47, -48, -14,  4,  3, 3.2, 2.8),

      // ── Lockers along west wall ──
      { id: 'lk0', x: -54.1, y: 1.8, z: -16, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'lk1', x: -54.1, y: 1.8, z: -13, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'lk2', x: -54.1, y: 1.8, z: -10, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },

      // ── Debris ──
      { id: 'db0', x: -48, y: 0.2, z: 16, w: 1.2, h: 0.2, d: 0.8, type: 'debris' },
      { id: 'db1', x: -10, y: 0.15, z: 18, w: 0.8, h: 0.15, d: 1.0, type: 'debris' },
      { id: 'db2', x: -20, y: 0.1,  z: -4, w: 1.0, h: 0.1,  d: 0.6, type: 'debris' },
    ],
    doors: [
      {
        id: 'door-start-hall-north',
        x: -5, z: -8,
        rotationY: 0,
        price: 1000,
        target: 'hallway',
      },
      {
        id: 'door-start-hall-south',
        x: -5, z: 8,
        rotationY: 0,
        price: 1000,
        target: 'hallway',
      },
    ],
    spawns: [
      { x: -30, z:  0,  weight: 1 }, // player start
      { x: -50, z: -18, weight: 2 },
      { x: -10, z: -18, weight: 2 },
      { x: -50, z:  18, weight: 2 },
      { x: -10, z:  18, weight: 2 },
      { x: -30, z:  18, weight: 1 },
    ],
  },

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  HALLWAY 1  (center vertical connector)                                  │
  // │  X: -5 .. 5   Z: -44 .. 44   inner 10×88                               │
  // └─────────────────────────────────────────────────────────────────────────┘
  hallway: {
    id: 'hallway',
    name: 'Hallway 1',
    bounds: { minX: -5, maxX: 5, minZ: -44, maxZ: 44 },
    walls: [
      // West wall — two sections with classroom doorway gaps at Z=-8..8
      { x: -5, z: -44, length: 36, isX: false }, // North section (Z: -44 .. -8)
      { x: -5, z:   8, length: 36, isX: false }, // South section (Z: 8 .. 44)
      // East wall — two sections with classroom doorway gaps
      { x:  5, z: -44, length: 20, isX: false }, // Classroom 102 north
      { x:  5, z: -24, length: 20, isX: false }, // Classroom 102 south to gap
      { x:  5, z:  4,  length: 20, isX: false }, // Classroom 103 north
      { x:  5, z:  24, length: 20, isX: false }, // Classroom 103 south
      // North cap
      { x: -5, z: -44, length: 10, isX: true },
      // South cap
      { x: -5, z:  44, length: 10, isX: true },
    ],
    obstacles: [
      // Lockers along west wall of hallway (north half)
      { id: 'hlk0', x: -4.1, y: 1.8, z: -36, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk1', x: -4.1, y: 1.8, z: -33, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk2', x: -4.1, y: 1.8, z: -30, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk3', x: -4.1, y: 1.8, z: -27, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk4', x: -4.1, y: 1.8, z: -24, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      // Lockers south half
      { id: 'hlk5', x: -4.1, y: 1.8, z: 24, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk6', x: -4.1, y: 1.8, z: 27, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk7', x: -4.1, y: 1.8, z: 30, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      { id: 'hlk8', x: -4.1, y: 1.8, z: 33, w: 0.2, h: 1.8, d: 0.6, type: 'locker' },
      // Wall-buy station north
      { id: 'wbn', x: -4.3, y: 1.8, z: -12, w: 0.3, h: 0.5, d: 0.25, type: 'generic' },
      // Wall-buy station south
      { id: 'wbs', x: -4.3, y: 1.8, z:  12, w: 0.3, h: 0.5, d: 0.25, type: 'generic' },
      // Debris
      { id: 'hdb0', x: 0, y: 0.1, z: -40, w: 0.8, h: 0.1, d: 0.5, type: 'debris' },
      { id: 'hdb1', x: 0, y: 0.1, z:  40, w: 0.8, h: 0.1, d: 0.5, type: 'debris' },
    ],
    doors: [
      // West doors — to Starting Classroom
      { id: 'door-hall-start-north', x: -5, z: -8, rotationY: Math.PI, price:    0, target: 'startingClassroom' },
      { id: 'door-hall-start-south', x: -5, z:  8, rotationY: Math.PI, price:    0, target: 'startingClassroom' },
      // East doors — to Classroom 102
      { id: 'door-hall-102',         x:  5, z: -22, rotationY: 0,        price: 1500, target: 'classroom102' },
      // East doors — to Classroom 103
      { id: 'door-hall-103',         x:  5, z:  22, rotationY: 0,        price: 1800, target: 'classroom103' },
    ],
    spawns: [
      { x: 0, z: -40, weight: 2 },
      { x: 0, z:   0, weight: 1 },
      { x: 0, z:  40, weight: 2 },
    ],
  },

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  CLASSROOM 102  (upper-right)  →  FAST HANDS perk                       │
  // │  X: 5 .. 45   Z: -44 .. -4   inner 40×40                               │
  // └─────────────────────────────────────────────────────────────────────────┘
  classroom102: {
    id: 'classroom102',
    name: 'Classroom 102',
    bounds: { minX: 5, maxX: 45, minZ: -44, maxZ: -4 },
    walls: [
      // West wall — gap at Z=-28..−16 for hallway door
      { x:  5, z: -44, length: 16, isX: false }, // North section
      { x:  5, z: -28, length: 12, isX: false }, // Middle section (south of door)
      // East wall (full)
      { x: 45, z: -44, length: 40, isX: false },
      // North wall (full)
      { x:  5, z: -44, length: 40, isX: true },
      // South wall (full)
      { x:  5, z:  -4, length: 40, isX: true },
    ],
    obstacles: [
      // ── Teacher desk + board (north wall) ──
      { id: '102td',  x: 25, y: 0.75, z: -40, w: 3.6, h: 0.75, d: 1.4, type: 'desk' },
      { id: '102wb',  x: 25, y: 2.5,  z: -43.9, w: 9, h: 2.2, d: 0.08, type: 'board' },

      // ── Student desks — 3 rows × 3 cols ──
      ...studentDesks(12, 38, -36, 3, 3, 3.5, 3.0),

      // ── Debris (abandoned) ──
      { id: '102db0', x: 42, y: 0.2, z: -8,  w: 1.0, h: 0.2, d: 0.6, type: 'debris' },
      { id: '102db1', x: 10, y: 0.15, z: -42, w: 0.7, h: 0.15, d: 0.9, type: 'debris' },

      // ── FAST HANDS perk machine (south-east corner) ──
      { id: 'fastHandsMachine', x: 42, y: 1.4, z: -8, w: 1.2, h: 2.8, d: 0.6, type: 'perk' },
    ],
    doors: [
      {
        id: 'door-102-hall',
        x: 5, z: -22,
        rotationY: Math.PI,
        price: 1500,
        target: 'hallway',
      },
    ],
    spawns: [
      { x: 10, z: -40, weight: 2 },
      { x: 40, z: -40, weight: 2 },
      { x: 40, z: -10, weight: 1 },
      { x: 25, z: -24, weight: 2 },
    ],
  },

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  CLASSROOM 103  (lower-right)  →  FORBIDDEN TOME                        │
  // │  X: 5 .. 45   Z: 4 .. 44   inner 40×40                                 │
  // └─────────────────────────────────────────────────────────────────────────┘
  classroom103: {
    id: 'classroom103',
    name: 'Classroom 103',
    bounds: { minX: 5, maxX: 45, minZ: 4, maxZ: 44 },
    walls: [
      // West wall — gap at Z=16..28 for hallway door
      { x:  5, z:  4, length: 12, isX: false }, // North section
      { x:  5, z: 28, length: 16, isX: false }, // South section
      // East wall (full)
      { x: 45, z:  4, length: 40, isX: false },
      // North wall (full)
      { x:  5, z:  4, length: 40, isX: true },
      // South wall (full)
      { x:  5, z: 44, length: 40, isX: true },
    ],
    obstacles: [
      // ── Teacher desk + board (north wall) ──
      { id: '103td', x: 25, y: 0.75, z: 8,  w: 3.6, h: 0.75, d: 1.4, type: 'desk' },
      { id: '103wb', x: 25, y: 2.5,  z: 4.1, w: 9,  h: 2.2, d: 0.08, type: 'board' },

      // ── Student desks — 3 rows × 3 cols ──
      ...studentDesks(12, 38, 12, 3, 3, 3.5, 3.0),

      // ── Debris ──
      { id: '103db0', x: 8,  y: 0.2,  z: 42, w: 1.0, h: 0.2, d: 0.7, type: 'debris' },
      { id: '103db1', x: 40, y: 0.15, z: 8,  w: 0.6, h: 0.15, d: 1.0, type: 'debris' },

      // ── FORBIDDEN TOME — mounted on east wall ──
      { id: 'forbiddenTomePedestal', x: 44, y: 0.9, z: 24, w: 0.8, h: 0.9, d: 0.8, type: 'generic' },
      { id: 'forbiddenTomeBook',     x: 44, y: 2.1, z: 24, w: 0.6, h: 0.05, d: 0.9, type: 'tome' },
    ],
    doors: [
      {
        id: 'door-103-hall',
        x: 5, z: 22,
        rotationY: Math.PI,
        price: 1800,
        target: 'hallway',
      },
    ],
    spawns: [
      { x: 10, z: 8,  weight: 2 },
      { x: 40, z: 8,  weight: 2 },
      { x: 40, z: 40, weight: 1 },
      { x: 25, z: 36, weight: 2 },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a grid of student desk+chair obstacles */
function studentDesks(
  startX: number, endX: number, startZ: number,
  cols: number, rows: number,
  xSpacing: number, zSpacing: number
): ObstacleDef[] {
  const out: ObstacleDef[] = [];
  const usableX = endX - startX;
  const xStep = usableX / (cols - 1 || 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = startX + c * xStep;
      const cz = startZ + r * zSpacing;
      out.push({
        id: `desk-${cx.toFixed(0)}-${cz.toFixed(0)}`,
        x: cx, y: 0.75, z: cz,
        w: 1.6, h: 0.75, d: 0.9,
        type: 'desk',
      });
      out.push({
        id: `chair-${cx.toFixed(0)}-${cz.toFixed(0)}`,
        x: cx, y: 0.45, z: cz + 1.2,
        w: 0.5, h: 0.45, d: 0.5,
        type: 'chair',
      });
    }
  }
  return out;
}

// ─── buildRoom ───────────────────────────────────────────────────────────────
// Materializes one Room into a Three.js Scene with collision.
//
// materials expected keys:
//   floor, wall, ceiling, obstacle, wood, locker, board, debris, perk, tome

export function buildRoom(
  room: Room,
  scene: THREE.Scene,
  collision: CollisionSystem,
  materials: Record<string, THREE.Material>
) {
  const { bounds, walls, obstacles, doors } = room;
  const rW = bounds.maxX - bounds.minX;
  const rD = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  // ── Floor ──────────────────────────────────────────────────────────────────
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(rW, rD),
    materials.floor
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(cx, 0, cz);
  floorMesh.receiveShadow = true;
  floorMesh.userData = { type: 'floor', room: room.id };
  scene.add(floorMesh);

  // ── Ceiling ─────────────────────────────────────────────────────────────────
  const ceilMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(rW, rD),
    materials.ceiling ?? materials.wall
  );
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.set(cx, CEIL_H, cz);
  ceilMesh.receiveShadow = true;
  ceilMesh.userData = { type: 'ceiling', room: room.id };
  scene.add(ceilMesh);

  // Ceiling lights (simple point lights spaced across room)
  const lightCount = Math.max(1, Math.floor(rW / 12));
  for (let i = 0; i < lightCount; i++) {
    const lx = bounds.minX + (rW / (lightCount + 1)) * (i + 1);
    const pl = new THREE.PointLight(0xffe8c0, 0.9, 22);
    pl.position.set(lx, CEIL_H - 0.2, cz);
    pl.castShadow = true;
    pl.shadow.mapSize.set(512, 512);
    scene.add(pl);
    // Fixture mesh
    const fix = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe8c0, emissiveIntensity: 0.7 })
    );
    fix.position.set(lx, CEIL_H - 0.05, cz);
    scene.add(fix);
  }

  // ── Walls ───────────────────────────────────────────────────────────────────
  for (const w of walls) {
    const wLen = w.length;
    const geo = new THREE.BoxGeometry(
      w.isX ? wLen    : 0.25,
      WALL_H,
      w.isX ? 0.25    : wLen
    );
    const mesh = new THREE.Mesh(geo, materials.wall);
    mesh.position.set(
      w.isX ? w.x + wLen / 2 : w.x,
      WALL_H / 2,
      w.isX ? w.z            : w.z + wLen / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'wall', room: room.id };
    scene.add(mesh);

    const hx = w.isX ? wLen / 2 : 0.125;
    const hz = w.isX ? 0.125    : wLen / 2;
    const px = mesh.position.x;
    const pz = mesh.position.z;
    collision.addBox(
      new THREE.Vector3(px - hx, 0,      pz - hz),
      new THREE.Vector3(px + hx, WALL_H, pz + hz),
      { type: 'wall', id: `wall-${room.id}-${w.x}-${w.z}` }
    );
  }

  // ── Obstacles (furniture, lockers, boards) ──────────────────────────────────
  for (const obs of obstacles) {
    let mat = materials.obstacle;
    if (obs.type === 'locker')  mat = materials.locker  ?? materials.obstacle;
    if (obs.type === 'board')   mat = materials.board   ?? materials.wall;
    if (obs.type === 'debris')  mat = materials.debris  ?? materials.floor;
    if (obs.type === 'perk')    mat = materials.perk    ?? materials.obstacle;
    if (obs.type === 'tome')    mat = materials.tome    ?? materials.obstacle;
    if (obs.type === 'chair')   mat = materials.chair   ?? materials.obstacle;

    const geo  = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(obs.x, obs.y, obs.z);
    if (obs.rotY) mesh.rotation.y = obs.rotY;
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: obs.type ?? 'obstacle', id: obs.id, room: room.id };
    scene.add(mesh);

    // Perk / tome get glowing emissive overlay ring
    if (obs.type === 'perk' || obs.type === 'tome') {
      const ringGeo = new THREE.TorusGeometry(obs.w * 0.65, 0.04, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: obs.type === 'perk' ? 0x22ffcc : 0xff9900,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(obs.x, obs.y + obs.h + 0.25, obs.z);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    }

    // Skip collision for pure decorative debris and boards
    if (obs.type === 'debris' || obs.type === 'board') continue;

    collision.addBox(
      new THREE.Vector3(obs.x - obs.w / 2, 0,      obs.z - obs.d / 2),
      new THREE.Vector3(obs.x + obs.w / 2, obs.h,  obs.z + obs.d / 2),
      { type: obs.type ?? 'obstacle', id: obs.id ?? `obs-${room.id}-${obs.x}` }
    );
  }

  // ── Doors (blockers until purchased) ────────────────────────────────────────
  for (const door of doors) {
    const dW = door.width  ?? 1.2;
    const dH = door.height ?? 3.6;

    // Door frame
    const frameThick = 0.18;
    const frameGeo   = new THREE.BoxGeometry(frameThick, dH + 0.1, dW + frameThick * 2);
    const frameMesh  = new THREE.Mesh(frameGeo, materials.wall);
    frameMesh.position.set(door.x, dH / 2, door.z);
    frameMesh.rotation.y = door.rotationY;
    scene.add(frameMesh);

    // Door leaf
    const leafGeo  = new THREE.BoxGeometry(frameThick * 0.6, dH - 0.05, dW - 0.06);
    const leafMesh = new THREE.Mesh(leafGeo, materials.wood ?? materials.obstacle);
    leafMesh.position.set(door.x, dH / 2, door.z);
    leafMesh.rotation.y = door.rotationY;
    leafMesh.castShadow = true;
    leafMesh.userData   = { type: 'door-leaf', id: door.id };
    scene.add(leafMesh);

    // Price sign
    if (door.price > 0) {
      const canvas = document.createElement('canvas');
      canvas.width  = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 3;
      ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle   = '#22c55e';
      ctx.font        = 'bold 22px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(`[E] Open  $${door.price}`, 128, 38);
      const tex  = new THREE.CanvasTexture(canvas);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })
      );
      sign.position.set(door.x + (Math.cos(door.rotationY) * 0.15), 2.8, door.z + 0.15);
      sign.rotation.y = door.rotationY;
      scene.add(sign);
    }

    // Collision blocker (axis-aligned approximation)
    const isZ = Math.abs(Math.sin(door.rotationY)) < 0.5; // door spans along Z
    const hx = isZ ? 0.15  : dW / 2;
    const hz = isZ ? dW / 2 : 0.15;
    collision.addBox(
      new THREE.Vector3(door.x - hx, 0,  door.z - hz),
      new THREE.Vector3(door.x + hx, dH, door.z + hz),
      { type: 'door', id: door.id }
    );
  }
}
