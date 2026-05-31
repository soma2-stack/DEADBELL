// src/core/playerMovement.ts
import * as THREE from 'three';

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  stamina: number;
  isOnGround: boolean;
  isSprinting: boolean;
}

const CONFIG = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  sprintDrain: 18,
  sprintRegen: 12,
  minStamina: 15,
  acceleration: 12,
  friction: 8,
  jumpForce: 8.5,
  gravity: -22,
  height: 1.65,
  radius: 0.35
};

export function createPlayer(startPos: THREE.Vector3): PlayerState {
  return {
    position: startPos.clone(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    stamina: 100,
    isOnGround: true,
    isSprinting: false
  };
}

export function updatePlayer(
  player: PlayerState,
  keys: Record<string, boolean>,
  mouse: { x: number; y: number },
  delta: number,
  checkCollision: (pos: THREE.Vector3, r: number, h: number) => boolean
) {
  // 🎮 Input handling
  const forward = (keys['KeyW'] ? -1 : 0) + (keys['KeyS'] ? 1 : 0);
  const strafe = (keys['KeyA'] ? -1 : 0) + (keys['KeyD'] ? 1 : 0);
  const moving = Math.abs(forward) > 0 || Math.abs(strafe) > 0;
  const wantSprint = keys['ShiftLeft'] && moving && player.stamina >= CONFIG.minStamina;
  
  // 🔄 Stamina
  if (wantSprint && player.isSprinting) {
    player.stamina = Math.max(0, player.stamina - CONFIG.sprintDrain * delta);
    if (player.stamina <= 0) player.isSprinting = false;
  } else if (!wantSprint && player.stamina < 100) {
    player.stamina = Math.min(100, player.stamina + CONFIG.sprintRegen * delta);
  }
  player.isSprinting = wantSprint && player.stamina >= CONFIG.minStamina;
  
  // 🎯 Mouse look
  player.yaw -= mouse.x * 0.002;
  player.pitch = THREE.MathUtils.clamp(player.pitch - mouse.y * 0.002, -1.5, 1.5);
  
  // 🏃 Movement
  const speed = player.isSprinting ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
  const moveDir = new THREE.Vector3(strafe, 0, forward).normalize();
  const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.yaw, 0));
  moveDir.applyQuaternion(yawQuat);
  
  const targetVel = moveDir.multiplyScalar(speed);
  player.velocity.x = THREE.MathUtils.damp(player.velocity.x, targetVel.x, CONFIG.acceleration, delta);
  player.velocity.z = THREE.MathUtils.damp(player.velocity.z, targetVel.z, CONFIG.acceleration, delta);
  
  // 🪂 Jump & gravity
  if (keys['Space'] && player.isOnGround) {
    player.velocity.y = CONFIG.jumpForce;
    player.isOnGround = false;
  } else if (!player.isOnGround) {
    player.velocity.y += CONFIG.gravity * delta;
  }
  
  // 🧱 Collision & position update
  const tentative = player.position.clone().add(
    new THREE.Vector3(player.velocity.x * delta, player.velocity.y * delta, player.velocity.z * delta)
  );
  
  if (checkCollision(tentative, CONFIG.radius, CONFIG.height)) {
    // Try X axis
    const tryX = player.position.clone().setX(tentative.x);
    if (!checkCollision(tryX, CONFIG.radius, CONFIG.height)) player.position.x = tentative.x;
    // Try Z axis
    const tryZ = player.position.clone().setZ(tentative.z);
    if (!checkCollision(tryZ, CONFIG.radius, CONFIG.height)) player.position.z = tentative.z;
    // Y axis (ground)
    if (tentative.y <= CONFIG.height && player.velocity.y < 0) {
      player.position.y = CONFIG.height;
      player.velocity.y = 0;
      player.isOnGround = true;
    }
  } else {
    player.position.copy(tentative);
    if (player.position.y <= CONFIG.height) {
      player.position.y = CONFIG.height;
      player.velocity.y = 0;
      player.isOnGround = true;
    }
  }
  
  // Apply friction when idle
  if (!moving) {
    player.velocity.x = THREE.MathUtils.damp(player.velocity.x, 0, CONFIG.friction, delta);
    player.velocity.z = THREE.MathUtils.damp(player.velocity.z, 0, CONFIG.friction, delta);
  }
  
  return player;
}

export function getPlayerSpeed(player: PlayerState): number {
  return Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
}
