import * as THREE from 'three';
import { Zombie } from '../types';

/**
 * Spawns a single zombie at a given spawner index.
 * Called from GameCanvas.tsx as spawnZombieHelper(spawnerIdx, groundSpawners, zombieGroup, activeZombiesList, cameraPos, round, customModel)
 */
export function spawnSingleZombie(
  spawnerIdx: number,
  groundSpawners: { x: number; z: number; label: string }[],
  zombieGroup: THREE.Group,
  activeZombiesList: Zombie[],
  cameraPosition: THREE.Vector3,
  currentRound: number,
  customModel: THREE.Group | null
): void {
  const spawner = groundSpawners[spawnerIdx % groundSpawners.length];
  if (!spawner) return;

  const g = new THREE.Group();

  // If a custom GLB model was loaded, clone and use it
  if (customModel) {
    const cloned = customModel.clone();
    cloned.scale.set(1, 1, 1);
    g.add(cloned);
  } else {
    // Procedural zombie mesh fallback
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.9 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), shirtMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    g.add(torso); // index 0

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
    head.name = 'head';
    head.position.y = 1.5;
    head.castShadow = true;
    g.add(head); // index 1

    // Eyes (red glowing)
    const eyeGeoL = new THREE.SphereGeometry(0.045, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeoL, eyeMat);
    eyeL.position.set(-0.08, 1.52, 0.155);
    g.add(eyeL); // index 2

    // Left arm
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), skinMat);
    armL.position.set(-0.33, 1.0, 0.08);
    armL.rotation.x = -Math.PI / 1.8;
    armL.castShadow = true;
    g.add(armL); // index 3

    // Right arm
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), skinMat);
    armR.position.set(0.33, 1.0, 0.08);
    armR.rotation.x = -Math.PI / 1.8;
    armR.castShadow = true;
    g.add(armR); // index 4

    // Legs
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.25), shirtMat);
    legs.position.y = 0.35;
    legs.castShadow = true;
    g.add(legs); // index 5
  }

  // Spawn below ground for cinematic rise animation
  g.position.set(spawner.x, -1.5, spawner.z);

  zombieGroup.add(g);

  // Scale speed and health with round progression
  const speed = 1.55 + currentRound * 0.12;
  const health = 100 + (currentRound - 1) * 25;
  const damage = 10 + currentRound * 2;

  const zombie: Zombie = {
    id: THREE.MathUtils.generateUUID(),
    mesh: g,
    health,
    maxHealth: health,
    speed,
    damage,
    state: 'spawning',
    animTime: 0,
    lastAttackTime: 0,
  };

  activeZombiesList.push(zombie);
}
