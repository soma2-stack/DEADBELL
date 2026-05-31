import * as THREE from 'three';
import { Zombie } from '../types';

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

  if (customModel) {
    const cloned = customModel.clone();
    cloned.scale.set(1, 1, 1);
    g.add(cloned);
  } else {
    // Procedural CoD-style zombie
    const skinMat  = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.9 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95 });
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xff2200 });

    // Legs
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.25), shirtMat);
    legs.position.y = 0.30; legs.castShadow = true; g.add(legs);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.65, 0.30), shirtMat);
    torso.position.y = 1.0; torso.castShadow = true; g.add(torso);

    // Head — named so headshot detection works
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.30), skinMat);
    head.name = 'head'; head.position.y = 1.52; head.castShadow = true; g.add(head);

    // Red eyes
    const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.08, 1.54, 0.155); g.add(eyeL);
    const eyeR   = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set( 0.08, 1.54, 0.155); g.add(eyeR);

    // Arms outstretched (classic zombie pose)
    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    const armL   = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.35, 1.05, 0.10); armL.rotation.x = -Math.PI / 1.8; armL.castShadow = true; g.add(armL);
    const armR   = new THREE.Mesh(armGeo, skinMat);
    armR.position.set( 0.35, 1.05, 0.10); armR.rotation.x = -Math.PI / 1.8; armR.castShadow = true; g.add(armR);
  }

  g.position.set(spawner.x, -1.5, spawner.z);
  zombieGroup.add(g);

  const speed      = 1.55 + currentRound * 0.12;
  const health     = 100  + (currentRound - 1) * 25;
  const damage     = 10   + currentRound * 2;
  // scoreReward MUST be defined — missing it causes NaN points
  const scoreReward = 100 + (currentRound - 1) * 10;

  const zombie: Zombie = {
    id: THREE.MathUtils.generateUUID(),
    mesh: g,
    health,
    maxHealth: health,
    speed,
    damage,
    scoreReward,
    state: 'spawning',
    animTime: 0,
    lastAttackTime: 0,
    spawnerIndex: spawnerIdx,
  };

  activeZombiesList.push(zombie);
}
