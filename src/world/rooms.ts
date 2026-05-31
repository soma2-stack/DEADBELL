// src/world/rooms.ts
//
// Ft. Knell Academy – revised layout:
//
//  [Starting Classroom] ── [Short Hallway] ── [Main Classroom]
//       X:-58..-8              X:-8..8            X:8..48
//       Z:-22..22              Z:-5..5            Z:-25..25
//
// The two classrooms are merged into one large "Main Classroom"
// directly east of the Starting Classroom, connected by a short hallway.
// Both Fast Hands and the Forbidden Tome live inside the Main Classroom.
//
// Three.js axes:  X+ = East,  Z+ = South,  Y = Up

import * as THREE from 'three';
import { CollisionSystem } from '../core/collision';

const WALL_H = 4.5;
const CEIL_H = 4.5;

// ─── Types ───────────────────────────────────────────────────────────────────
export type Door = {
  id: string;
  x: number;
  z: number;
  rotationY: number;
  price: number;
  target: string;
  width?: number;
  height?: number;
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
  isX: boolean; // true = runs along X axis, false = along Z axis
};

type ObstacleDef = {
  id?: string;
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  rotY?: number;
  type?: 'desk' | 'chair' | 'locker' | 'board' | 'debris' | 'perk' | 'tome' | 'generic';
};

// ─── Room Definitions ────────────────────────────────────────────────────────
export const ROOMS: Record<string, Room> = {

  // ┌──────────────────────────────────────────────────────────────────────────┐
  // │  STARTING CLASSROOM  –  west, largest room                               │
  // │  X: -58 .. -8    Z: -22 .. 22   (50 × 44)                               │
  // └──────────────────────────────────────────────────────────────────────────┘
  startingClassroom: {
    id: 'startingClassroom',
    name: 'Starting Classroom',
    bounds: { minX: -58, maxX: -8, minZ: -22, maxZ: 22 },
    walls: [
      // West wall (full)
      { x: -58, z: -22, length: 44, isX: false },
      // North wall (full)
      { x: -58, z: -22, length: 50, isX: true  },
      // South wall (full)
      { x: -58, z:  22, length: 50, isX: true  },
      // East wall – gap Z:-5..5 (10 units wide) opens into hallway
      { x: -8,  z: -22, length: 17, isX: false }, // north section  Z:-22 → -5
      { x: -8,  z:   5, length: 17, isX: false }, // south section  Z:5  →  22
    ],
    obstacles: [
      // Teacher desk + chair (north wall)
      { id: 'td',  x: -33, y: 0.75, z: -18,   w: 4.0, h: 0.75, d: 1.6,  type: 'desk'  },
      { id: 'tc',  x: -33, y: 0.45, z: -16.5, w: 0.5, h: 0.45, d: 0.5,  type: 'chair' },
      // Whiteboard (north wall)
      { id: 'wb',  x: -33, y: 2.5,  z: -21.9, w: 10,  h: 2.2,  d: 0.08, type: 'board' },
      // Student desks – 4 cols × 3 rows
      ...studentDesks(-52, -14, -12, 4, 3, 0, 3.2),
      // Lockers – west wall
      { id: 'lk0', x: -57.1, y: 1.8, z: -14, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      { id: 'lk1', x: -57.1, y: 1.8, z: -11, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      { id: 'lk2', x: -57.1, y: 1.8, z:  -8, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      // Debris
      { id: 'db0', x: -50, y: 0.2,  z: 16, w: 1.2, h: 0.2,  d: 0.8, type: 'debris' },
      { id: 'db1', x: -12, y: 0.15, z: 18, w: 0.8, h: 0.15, d: 1.0, type: 'debris' },
      { id: 'db2', x: -22, y: 0.1,  z:  3, w: 1.0, h: 0.1,  d: 0.6, type: 'debris' },
    ],
    doors: [
      {
        id: 'door-start-hall',
        x: -8, z: 0,
        rotationY: 0,   // faces east → hallway
        price: 0,
        target: 'hallway',
        width: 4.0,
      },
    ],
    spawns: [
      { x: -33, z:   0, weight: 1 }, // player start
      { x: -52, z: -18, weight: 2 },
      { x: -14, z: -18, weight: 2 },
      { x: -52, z:  18, weight: 2 },
      { x: -14, z:  18, weight: 2 },
      { x: -33, z:  18, weight: 1 },
    ],
  },

  // ┌──────────────────────────────────────────────────────────────────────────┐
  // │  HALLWAY 1  –  short horizontal connector                                │
  // │  X: -8 .. 8    Z: -5 .. 5   (16 × 10)                                   │
  // └──────────────────────────────────────────────────────────────────────────┘
  hallway: {
    id: 'hallway',
    name: 'Hallway 1',
    bounds: { minX: -8, maxX: 8, minZ: -5, maxZ: 5 },
    walls: [
      // North wall – full (no side rooms branch off hallway anymore)
      { x: -8, z: -5, length: 16, isX: true },
      // South wall – full
      { x: -8, z:  5, length: 16, isX: true },
      // West opening handled by Starting Classroom east wall gap
      // East opening handled by Main Classroom west wall gap
    ],
    obstacles: [
      // Lockers on north wall
      { id: 'hlk0', x: -5, y: 1.8, z: -4.1, w: 0.7, h: 1.8, d: 0.2, type: 'locker' },
      { id: 'hlk1', x: -1, y: 1.8, z: -4.1, w: 0.7, h: 1.8, d: 0.2, type: 'locker' },
      { id: 'hlk2', x:  3, y: 1.8, z: -4.1, w: 0.7, h: 1.8, d: 0.2, type: 'locker' },
      // Wall-buy stations (north + south)
      { id: 'wbn', x: -3, y: 1.8, z: -4.3, w: 0.5, h: 0.5, d: 0.3, type: 'generic' },
      { id: 'wbs', x: -3, y: 1.8, z:  4.3, w: 0.5, h: 0.5, d: 0.3, type: 'generic' },
      // Debris
      { id: 'hdb', x: 0, y: 0.1, z: 0, w: 0.6, h: 0.1, d: 0.4, type: 'debris' },
    ],
    doors: [
      // East door – into Main Classroom (buyable)
      {
        id: 'door-hall-main',
        x: 8, z: 0,
        rotationY: 0,
        price: 1500,
        target: 'mainClassroom',
        width: 4.0,
      },
    ],
    spawns: [
      { x: 0, z: 0, weight: 2 },
    ],
  },

  // ┌──────────────────────────────────────────────────────────────────────────┐
  // │  MAIN CLASSROOM  –  east, combined 102+103 room                          │
  // │  X: 8 .. 48    Z: -25 .. 25   (40 × 50)                                 │
  // │  Contains: Fast Hands perk + Forbidden Tome                              │
  // └──────────────────────────────────────────────────────────────────────────┘
  mainClassroom: {
    id: 'mainClassroom',
    name: 'Main Classroom',
    bounds: { minX: 8, maxX: 48, minZ: -25, maxZ: 25 },
    walls: [
      // West wall – gap Z:-5..5 opens into hallway
      { x: 8, z: -25, length: 20, isX: false }, // north section  Z:-25 → -5
      { x: 8, z:   5, length: 20, isX: false }, // south section  Z:5  →  25
      // North wall (full)
      { x:  8, z: -25, length: 40, isX: true },
      // South wall (full)
      { x:  8, z:  25, length: 40, isX: true },
      // East wall (full)
      { x: 48, z: -25, length: 50, isX: false },
    ],
    obstacles: [
      // Teacher desk + whiteboard (north wall)
      { id: 'mtd', x: 28, y: 0.75, z: -21,   w: 4.0, h: 0.75, d: 1.6,  type: 'desk'  },
      { id: 'mtc', x: 28, y: 0.45, z: -19.5, w: 0.5, h: 0.45, d: 0.5,  type: 'chair' },
      { id: 'mwb', x: 28, y: 2.5,  z: -24.9, w: 12,  h: 2.2,  d: 0.08, type: 'board' },

      // Student desks – 4 cols × 3 rows (centre of room)
      ...studentDesks(13, 43, -14, 4, 3, 0, 4.0),

      // Lockers – east wall
      { id: 'mlk0', x: 47.1, y: 1.8, z: -18, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      { id: 'mlk1', x: 47.1, y: 1.8, z: -15, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      { id: 'mlk2', x: 47.1, y: 1.8, z:  15, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },
      { id: 'mlk3', x: 47.1, y: 1.8, z:  18, w: 0.2, h: 1.8, d: 0.7, type: 'locker' },

      // Debris
      { id: 'mdb0', x: 12,  y: 0.2,  z:  22, w: 1.0, h: 0.2,  d: 0.7, type: 'debris' },
      { id: 'mdb1', x: 44,  y: 0.15, z: -22, w: 0.6, h: 0.15, d: 0.9, type: 'debris' },
      { id: 'mdb2', x: 25,  y: 0.1,  z:   8, w: 1.2, h: 0.1,  d: 0.5, type: 'debris' },

      // ── FAST HANDS perk machine – north-east corner ──
      { id: 'fastHandsMachine', x: 45, y: 1.4, z: -22, w: 1.2, h: 2.8, d: 0.6, type: 'perk' },

      // ── FORBIDDEN TOME – south-east corner, east wall ──
      { id: 'forbiddenTomePedestal', x: 47, y: 0.9,  z: 22,  w: 0.8,  h: 0.9,  d: 0.8, type: 'generic' },
      { id: 'forbiddenTomeBook',     x: 47, y: 2.05, z: 22,  w: 0.55, h: 0.05, d: 0.85, type: 'tome'    },
    ],
    doors: [
      // West door back into hallway
      {
        id: 'door-main-hall',
        x: 8, z: 0,
        rotationY: Math.PI, // faces west → hallway
        price: 1500,
        target: 'hallway',
        width: 4.0,
      },
    ],
    spawns: [
      { x: 12,  z: -22, weight: 2 },
      { x: 44,  z: -22, weight: 2 },
      { x: 44,  z:  22, weight: 2 },
      { x: 12,  z:  22, weight: 2 },
      { x: 28,  z:   0, weight: 1 },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function studentDesks(
  startX: number,
  endX: number,
  startZ: number,
  cols: number,
  rows: number,
  _xSpacing: number,
  zSpacing: number
): ObstacleDef[] {
  const out: ObstacleDef[] = [];
  const xStep = (endX - startX) / Math.max(cols - 1, 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = startX + c * xStep;
      const dz = startZ + r * zSpacing;
      out.push({ id: `desk-${dx.toFixed(0)}-${dz.toFixed(0)}`, x: dx, y: 0.75, z: dz, w: 1.6, h: 0.75, d: 0.9, type: 'desk' });
      out.push({ id: `chair-${dx.toFixed(0)}-${dz.toFixed(0)}`, x: dx, y: 0.45, z: dz + 1.2, w: 0.5, h: 0.45, d: 0.5, type: 'chair' });
    }
  }
  return out;
}

// ─── buildRoom ────────────────────────────────────────────────────────────────
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

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  floor.userData = { type: 'floor', room: room.id };
  scene.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), materials.ceiling ?? materials.wall);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, CEIL_H, cz);
  ceil.userData = { type: 'ceiling', room: room.id };
  scene.add(ceil);

  // Ceiling lights
  const lightCols = Math.max(1, Math.floor(rW / 14));
  const lightRows = Math.max(1, Math.floor(rD / 14));
  for (let li = 0; li < lightCols; li++) {
    for (let lj = 0; lj < lightRows; lj++) {
      const lx = bounds.minX + (rW / (lightCols + 1)) * (li + 1);
      const lz = bounds.minZ + (rD / (lightRows + 1)) * (lj + 1);
      const pl = new THREE.PointLight(0xffe8c0, 0.85, 20);
      pl.position.set(lx, CEIL_H - 0.2, lz);
      pl.castShadow = true;
      pl.shadow.mapSize.set(512, 512);
      scene.add(pl);
      const fix = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.07, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe8c0, emissiveIntensity: 0.65 })
      );
      fix.position.set(lx, CEIL_H - 0.04, lz);
      scene.add(fix);
    }
  }

  // Walls
  for (const w of walls) {
    if (w.length <= 0) continue;
    const geo = new THREE.BoxGeometry(
      w.isX ? w.length : 0.25,
      WALL_H,
      w.isX ? 0.25 : w.length
    );
    const mesh = new THREE.Mesh(geo, materials.wall);
    mesh.position.set(
      w.isX ? w.x + w.length / 2 : w.x,
      WALL_H / 2,
      w.isX ? w.z : w.z + w.length / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'wall', room: room.id };
    scene.add(mesh);
    const hx = w.isX ? w.length / 2 : 0.125;
    const hz = w.isX ? 0.125 : w.length / 2;
    collision.addBox(
      new THREE.Vector3(mesh.position.x - hx, 0, mesh.position.z - hz),
      new THREE.Vector3(mesh.position.x + hx, WALL_H, mesh.position.z + hz),
      { type: 'wall', id: `wall-${room.id}-${w.x}-${w.z}` }
    );
  }

  // Obstacles
  for (const obs of obstacles) {
    let mat: THREE.Material = materials.obstacle;
    if (obs.type === 'locker') mat = materials.locker  ?? materials.obstacle;
    if (obs.type === 'board')  mat = materials.board   ?? materials.wall;
    if (obs.type === 'debris') mat = materials.debris  ?? materials.floor;
    if (obs.type === 'perk')   mat = materials.perk    ?? materials.obstacle;
    if (obs.type === 'tome')   mat = materials.tome    ?? materials.obstacle;
    if (obs.type === 'chair')  mat = materials.chair   ?? materials.obstacle;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(obs.w, obs.h, obs.d), mat);
    mesh.position.set(obs.x, obs.y, obs.z);
    if (obs.rotY) mesh.rotation.y = obs.rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: obs.type ?? 'obstacle', id: obs.id, room: room.id };
    scene.add(mesh);

    if (obs.type === 'perk' || obs.type === 'tome') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(obs.w * 0.65, 0.04, 8, 32),
        new THREE.MeshBasicMaterial({ color: obs.type === 'perk' ? 0x22ffcc : 0xff9900, transparent: true, opacity: 0.85 })
      );
      ring.position.set(obs.x, obs.y + obs.h + 0.3, obs.z);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    }

    if (obs.type === 'debris' || obs.type === 'board') continue;
    collision.addBox(
      new THREE.Vector3(obs.x - obs.w / 2, 0, obs.z - obs.d / 2),
      new THREE.Vector3(obs.x + obs.w / 2, obs.h, obs.z + obs.d / 2),
      { type: obs.type ?? 'obstacle', id: obs.id ?? `obs-${room.id}-${obs.x}` }
    );
  }

  // Doors
  for (const door of doors) {
    const dW = door.width  ?? 1.2;
    const dH = door.height ?? 3.6;

    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, dH + 0.1, dW + 0.36),
      materials.wall
    );
    frameMesh.position.set(door.x, dH / 2, door.z);
    frameMesh.rotation.y = door.rotationY;
    scene.add(frameMesh);

    const leafMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, dH - 0.05, dW - 0.06),
      materials.wood ?? materials.obstacle
    );
    leafMesh.position.set(door.x, dH / 2, door.z);
    leafMesh.rotation.y = door.rotationY;
    leafMesh.castShadow = true;
    leafMesh.userData = { type: 'door-leaf', id: door.id };
    scene.add(leafMesh);

    if (door.price > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = '#22c55e'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`[E] Open  $${door.price}`, 128, 38);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.35),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide, transparent: true })
      );
      sign.position.set(door.x, 2.9, door.z + 0.18);
      sign.rotation.y = door.rotationY;
      scene.add(sign);
    }

    const spansZ = Math.abs(Math.cos(door.rotationY)) > 0.5;
    const hx = spansZ ? 0.15   : dW / 2;
    const hz = spansZ ? dW / 2 : 0.15;
    collision.addBox(
      new THREE.Vector3(door.x - hx, 0,  door.z - hz),
      new THREE.Vector3(door.x + hx, dH, door.z + hz),
      { type: 'door', id: door.id }
    );
  }
}
