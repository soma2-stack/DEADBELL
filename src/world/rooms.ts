// src/world/rooms.ts
import * as THREE from 'three';
import { CollisionSystem } from '../core/collision';

export type Room = {
  id: string;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walls: { x: number; z: number; length: number; isX: boolean }[];
  obstacles: { x: number; y: number; z: number; w: number; h: number; d: number }[];
  doors: { x: number; z: number; rotation: number; price: number; id: string; target: string }[];
  spawns: { x: number; z: number; weight: number }[];
};

export const ROOMS: Record<string, Room> = {
  spawnClassroom: {
    id: 'spawnClassroom',
    name: 'Starting Classroom',
    bounds: { minX: 14, maxX: 24, minZ: -50, maxZ: -30 },
    walls: [
      { x: 14, z: -50, length: 20, isX: false }, // West
      { x: 24, z: -50, length: 20, isX: false }, // East
      { x: 14, z: -50, length: 10, isX: true },  // North
      { x: 14, z: -30, length: 10, isX: true },  // South (with door gap)
    ],
    obstacles: [
      { x: 17, y: 0.75, z: -45, w: 1.5, h: 0.75, d: 0.8 }, // Desk
      { x: 21, y: 0.75, z: -45, w: 1.5, h: 0.75, d: 0.8 },
      { x: 19, y: 2.5, z: -49.9, w: 6, h: 2, d: 0.1 },    // Chalkboard
    ],
    doors: [
      { x: 14, z: -40, rotation: Math.PI, price: 1200, id: 'door-spawn-hall', target: 'hallway' }
    ],
    spawns: [
      { x: 19, z: -45, weight: 1 }, // Player start
      { x: 16, z: -48, weight: 2 }, // Zombie spawn
      { x: 22, z: -32, weight: 2 },
    ]
  },
  
  scienceClassroom: {
    id: 'scienceClassroom',
    name: 'Science Classroom',
    bounds: { minX: 14, maxX: 24, minZ: -30, maxZ: -10 },
    walls: [
      { x: 14, z: -30, length: 20, isX: false },
      { x: 24, z: -30, length: 20, isX: false },
      { x: 14, z: -30, length: 10, isX: true },
      { x: 14, z: -10, length: 10, isX: true },
    ],
    obstacles: [
      { x: 17, y: 0.9, z: -25, w: 2, h: 0.9, d: 1.2 }, // Lab table
      { x: 21, y: 0.9, z: -25, w: 2, h: 0.9, d: 1.2 },
      { x: 17, y: 0.9, z: -15, w: 2, h: 0.9, d: 1.2 },
      { x: 19, y: 2.5, z: -29.9, w: 6, h: 2, d: 0.1 }, // Chalkboard
    ],
    doors: [
      { x: 14, z: -20, rotation: Math.PI, price: 1500, id: 'door-science-hall', target: 'hallway' }
    ],
    spawns: [
      { x: 16, z: -28, weight: 2 },
      { x: 22, z: -12, weight: 1 },
    ]
  },
  
  abandonedClassroom: {
    id: 'abandonedClassroom',
    name: 'Abandoned Classroom',
    bounds: { minX: 14, maxX: 24, minZ: 10, maxZ: 30 },
    walls: [
      { x: 14, z: 10, length: 20, isX: false },
      { x: 24, z: 10, length: 20, isX: false },
      { x: 14, z: 10, length: 10, isX: true },
      { x: 14, z: 30, length: 10, isX: true },
    ],
    obstacles: [
      { x: 16, y: 0.75, z: 15, w: 1.5, h: 0.75, d: 0.8 }, // Broken desk
      { x: 20, y: 0.75, z: 22, w: 1.2, h: 0.75, d: 1.5 },
      { x: 22, y: 0.75, z: 18, w: 0.8, h: 0.75, d: 1.2 },
      { x: 18, y: 0.4, z: 25, w: 2, h: 0.4, d: 2 },      // Debris
    ],
    doors: [
      { x: 14, z: 20, rotation: Math.PI, price: 1800, id: 'door-abandoned-hall', target: 'hallway' }
    ],
    spawns: [
      { x: 15, z: 28, weight: 3 },
      { x: 23, z: 12, weight: 2 },
    ]
  },
  
  hallway: {
    id: 'hallway',
    name: 'Main Hallway',
    bounds: { minX: 14, maxX: 24, minZ: -10, maxZ: 10 },
    walls: [
      { x: 14, z: -10, length: 20, isX: false },
      { x: 24, z: -10, length: 20, isX: false },
      { x: 14, z: -10, length: 10, isX: true },
      { x: 14, z: 10, length: 10, isX: true },
    ],
    obstacles: [
      // Lockers along west wall
      ...Array.from({ length: 6 }, (_, i) => ({
        x: 14.15, y: 1.8, z: -8 + i * 3, w: 0.2, h: 1.8, d: 0.6
      })),
      // Wall buy stations
      { x: 14.3, y: 1.7, z: -5, w: 0.3, h: 0.4, d: 0.2 },
      { x: 14.3, y: 1.7, z: 5, w: 0.3, h: 0.4, d: 0.2 },
    ],
    doors: [
      { x: 14, z: 0, rotation: Math.PI, price: 1200, id: 'door-hall-spawn', target: 'spawnClassroom' },
      { x: 14, z: -20, rotation: 0, price: 1500, id: 'door-hall-science', target: 'scienceClassroom' },
      { x: 14, z: 20, rotation: 0, price: 1800, id: 'door-hall-abandoned', target: 'abandonedClassroom' },
    ],
    spawns: [
      { x: 19, z: -9, weight: 1 },
      { x: 19, z: 9, weight: 1 },
    ]
  }
};

export function buildRoom(room: Room, scene: THREE.Scene, collision: CollisionSystem, materials: any) {
  const { bounds, walls, obstacles, doors, spawns } = room;
  const wallHeight = 4.5;
  
  // 🟧 Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
    materials.floor
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  
  // 🧱 Walls
  for (const w of walls) {
    const geo = new THREE.BoxGeometry(w.isX ? 0.25 : w.length, wallHeight, w.isX ? w.length : 0.25);
    const mesh = new THREE.Mesh(geo, materials.wall);
    mesh.position.set(
      w.isX ? w.x : w.x + w.length / 2,
      wallHeight / 2,
      w.isX ? w.z + w.length / 2 : w.z
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    // Collision
    const halfX = w.isX ? 0.125 : w.length / 2;
    const halfZ = w.isX ? w.length / 2 : 0.125;
    collision.addBox(
      new THREE.Vector3(mesh.position.x - halfX, 0, mesh.position.z - halfZ),
      new THREE.Vector3(mesh.position.x + halfX, wallHeight, mesh.position.z + halfZ),
      { type: 'wall', id: `wall-${room.id}-${w.x}-${w.z}` }
    );
  }
  
  // 🪑 Obstacles
  for (const obs of obstacles) {
    const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
    const mesh = new THREE.Mesh(geo, materials.obstacle);
    mesh.position.set(obs.x, obs.y / 2 + 0.01, obs.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    // Collision
    const half = new THREE.Vector3(obs.w / 2, obs.h, obs.d / 2);
    collision.addBox(
      new THREE.Vector3(obs.x - half.x, 0, obs.z - half.z),
      new THREE.Vector3(obs.x + half.x, obs.h, obs.z + half.z),
      { type: 'obstacle', id: `obs-${room.id}-${obs.x}-${obs.z}` }
    );
  }
  
  // 🚪 Doors (as blockers)
  for (const door of doors) {
    const geo = new THREE.BoxGeometry(0.25, 3.6, 4);
    const mesh = new THREE.Mesh(geo, materials.wood);
    mesh.position.set(door.x, 1.8, door.z);
    mesh.rotation.y = door.rotation;
    mesh.castShadow = true;
    scene.add(mesh);
    
    // Collision blocker (remove when purchased)
    const min = new THREE.Vector3(door.x - 0.125, 0, door.z - 2)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), door.rotation)
      .add(new THREE.Vector3(door.x, 0, door.z));
    const max = new THREE.Vector3(door.x + 0.125, 3.6, door.z + 2)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), door.rotation)
      .add(new THREE.Vector3(door.x, 0, door.z));
    collision.addBox(min, max, { type: 'door', id: door.id });
  }
  
  return { floor, walls: scene.children.filter(c => c.userData.type === 'wall'), doors };
}
