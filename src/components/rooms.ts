import * as THREE from 'three';

// ─── Shared constants (mirror mapBuilder.ts) ─────────────────────────────────
const WALL_H       = 4.5;
const HALLWAY_X_CENTER = 18;   // hallway center X
const HALLWAY_W    = 8;        // hallway width  (X axis: 14 → 22)
const HALLWAY_D    = 50;       // hallway depth  (Z axis: -25 → 25)

// North-room (Armory) — sits above the hallway north cap at z = -25
const ARMORY_W     = 18;
const ARMORY_D     = 16;
const ARMORY_Z_CENTER = -(HALLWAY_D / 2) - (ARMORY_D / 2); // -25 - 8 = -33
const ARMORY_X_CENTER = HALLWAY_X_CENTER;                   //  18

// South-room (Cafeteria) — sits below the hallway south cap at z = +25
const CAFETERIA_W  = 22;
const CAFETERIA_D  = 18;
const CAFETERIA_Z_CENTER = (HALLWAY_D / 2) + (CAFETERIA_D / 2); // 25 + 9 = 34
const CAFETERIA_X_CENTER = HALLWAY_X_CENTER;                     // 18

// Door opening width
const DOOR_W = 4;

export interface RoomDeps {
  scene: THREE.Scene;
  wallMaterial: THREE.MeshStandardMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  ceilingMaterial: THREE.MeshStandardMaterial;
  woodTex: THREE.Texture;
  blackMetalMaterial: THREE.MeshStandardMaterial;
  obstacles: THREE.Box3[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build buyable-door sign canvas
// ─────────────────────────────────────────────────────────────────────────────
function makeDoorSignMesh(label: string, price: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width  = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 506, 122);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 36px "Courier New"';
  ctx.textAlign = 'center';
  ctx.fillText(label, 256, 44);
  ctx.font = 'bold 26px "Courier New"';
  ctx.fillText(`Press E  [$${price}]`, 256, 94);

  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a buyable-door block + sign and return the BuyableDoor data
// ─────────────────────────────────────────────────────────────────────────────
function buildBuyableDoor(
  deps: RoomDeps,
  id: string,
  cx: number, cy: number, cz: number,
  rotY: number,
  price: number,
  label: string,
) {
  const g = new THREE.Group();

  const doorH = WALL_H;
  const doorD = 0.3;  // thin slab thickness

  const woodMat = new THREE.MeshStandardMaterial({
    map: deps.woodTex,
    roughness: 0.8,
    metalness: 0.05,
  });

  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_W, doorH, doorD),
    woodMat,
  );
  doorMesh.position.y = doorH / 2;
  doorMesh.castShadow  = true;
  doorMesh.receiveShadow = true;
  g.add(doorMesh);

  // Green-glow frame around doorway
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.6,
    roughness: 0.4, metalness: 0.7,
  });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.2, 0.12, 0.12), frameMat);
  frameTop.position.set(0, doorH + 0.06, 0);
  g.add(frameTop);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH, 0.12), frameMat);
  frameL.position.set(-(DOOR_W / 2) - 0.06, doorH / 2, 0);
  g.add(frameL);
  const frameR = frameL.clone();
  frameR.position.x = (DOOR_W / 2) + 0.06;
  g.add(frameR);

  // Sign
  const sign = makeDoorSignMesh(label, price);
  sign.position.set(0, doorH + 0.7, 0.2);
  g.add(sign);

  g.position.set(cx, cy, cz);
  g.rotation.y = rotY;
  deps.scene.add(g);

  // Collision
  const box = new THREE.Box3().setFromObject(g);
  deps.obstacles.push(box);

  return {
    id,
    price,
    position: [cx, cy, cz] as [number, number, number],
    rotationY: rotY,
    width: DOOR_W,
    height: doorH,
    purchased: false,
    group: g,
    doorMesh,
    sinkOffset: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NORTH ROOM — "THE ARMORY"  (z ≈ -33, x ≈ 18)
// Connected to hallway north end via a buyable door in the south wall
// ─────────────────────────────────────────────────────────────────────────────
export function buildArmoryRoom(deps: RoomDeps) {
  const cx = ARMORY_X_CENTER;
  const cz = ARMORY_Z_CENTER;
  const hw = ARMORY_W / 2;
  const hd = ARMORY_D / 2;

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARMORY_W, ARMORY_D), deps.floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  deps.scene.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ARMORY_W, ARMORY_D), deps.ceilingMaterial);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  deps.scene.add(ceil);

  // North wall (solid)
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(ARMORY_W, WALL_H, 0.5), deps.wallMaterial);
  northWall.position.set(cx, WALL_H / 2, cz - hd);
  northWall.castShadow = northWall.receiveShadow = true;
  deps.scene.add(northWall);

  // West wall (solid)
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, ARMORY_D), deps.wallMaterial);
  westWall.position.set(cx - hw, WALL_H / 2, cz);
  westWall.castShadow = westWall.receiveShadow = true;
  deps.scene.add(westWall);

  // East wall (solid)
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, ARMORY_D), deps.wallMaterial);
  eastWall.position.set(cx + hw, WALL_H / 2, cz);
  eastWall.castShadow = eastWall.receiveShadow = true;
  deps.scene.add(eastWall);

  // South wall — split for buyable-door opening centered at cx
  const sideLen = (ARMORY_W - DOOR_W) / 2;
  const southWallL = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  southWallL.position.set(cx - (DOOR_W / 2) - (sideLen / 2), WALL_H / 2, cz + hd);
  southWallL.castShadow = southWallL.receiveShadow = true;
  deps.scene.add(southWallL);

  const southWallR = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  southWallR.position.set(cx + (DOOR_W / 2) + (sideLen / 2), WALL_H / 2, cz + hd);
  southWallR.castShadow = southWallR.receiveShadow = true;
  deps.scene.add(southWallR);

  // Transition connector: fill the gap between hallway north cap and armory south wall
  // The hallway north cap sits at z = -25; armory south wall sits at z = cz + hd = -25
  // They share the same Z so no connector needed — hallwayNorthWall already replaced by the door gap.

  // ── Lighting ─────────────────────────────────────────────────────────────
  const redLight = new THREE.PointLight(0xff2200, 4.5, 22);
  redLight.decay = 2.0;
  redLight.position.set(cx - 4, WALL_H - 0.4, cz);
  redLight.castShadow = true;
  deps.scene.add(redLight);

  const greenLight = new THREE.PointLight(0x22ff88, 3.2, 18);
  greenLight.decay = 2.0;
  greenLight.position.set(cx + 4, WALL_H - 0.4, cz);
  deps.scene.add(greenLight);

  // ── Weapon rack props ────────────────────────────────────────────────────
  const rackMat = deps.blackMetalMaterial;
  const addRack = (x: number, z: number, rotY: number) => {
    const rg = new THREE.Group();
    // Backboard
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 0.08), rackMat);
    back.position.y = 1.8;
    rg.add(back);
    // Horizontal pegs
    for (let i = 0; i < 3; i++) {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), rackMat);
      peg.rotation.x = Math.PI / 2;
      peg.position.set((i - 1) * 0.9, 2.5 - i * 0.55, 0.18);
      rg.add(peg);
    }
    rg.position.set(x, 0, z);
    rg.rotation.y = rotY;
    deps.scene.add(rg);
    deps.obstacles.push(new THREE.Box3().setFromObject(rg));
  };

  addRack(cx - hw + 0.6, cz - 4, Math.PI / 2);
  addRack(cx - hw + 0.6, cz,     Math.PI / 2);
  addRack(cx - hw + 0.6, cz + 4, Math.PI / 2);
  addRack(cx + hw - 0.6, cz - 4, -Math.PI / 2);
  addRack(cx + hw - 0.6, cz,     -Math.PI / 2);

  // ── Buyable door (south wall of Armory / north end of Hallway) ───────────
  // Remove the static hallwayNorthWall that was placed in mapBuilder — the
  // door geometry covers that gap.  The door sits exactly at z = cz + hd.
  const door = buildBuyableDoor(
    deps,
    'door-armory',
    cx, 0, cz + hd,   // south wall of armory == north end of hallway
    0,                  // no rotation needed, wall runs along X axis
    1500,
    'ARMORY  – $1500',
  );

  return { door };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUTH ROOM — "THE CAFETERIA"  (z ≈ +34, x ≈ 18)
// Connected to hallway south end via a buyable door in the north wall
// ─────────────────────────────────────────────────────────────────────────────
export function buildCafeteriaRoom(deps: RoomDeps) {
  const cx = CAFETERIA_X_CENTER;
  const cz = CAFETERIA_Z_CENTER;
  const hw = CAFETERIA_W / 2;
  const hd = CAFETERIA_D / 2;

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CAFETERIA_W, CAFETERIA_D), deps.floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  deps.scene.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CAFETERIA_W, CAFETERIA_D), deps.ceilingMaterial);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  deps.scene.add(ceil);

  // South wall (solid)
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(CAFETERIA_W, WALL_H, 0.5), deps.wallMaterial);
  southWall.position.set(cx, WALL_H / 2, cz + hd);
  southWall.castShadow = southWall.receiveShadow = true;
  deps.scene.add(southWall);

  // West wall (solid)
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CAFETERIA_D), deps.wallMaterial);
  westWall.position.set(cx - hw, WALL_H / 2, cz);
  westWall.castShadow = westWall.receiveShadow = true;
  deps.scene.add(westWall);

  // East wall (solid)
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CAFETERIA_D), deps.wallMaterial);
  eastWall.position.set(cx + hw, WALL_H / 2, cz);
  eastWall.castShadow = eastWall.receiveShadow = true;
  deps.scene.add(eastWall);

  // North wall — split for buyable-door opening
  const sideLen = (CAFETERIA_W - DOOR_W) / 2;
  const northWallL = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  northWallL.position.set(cx - (DOOR_W / 2) - (sideLen / 2), WALL_H / 2, cz - hd);
  northWallL.castShadow = northWallL.receiveShadow = true;
  deps.scene.add(northWallL);

  const northWallR = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  northWallR.position.set(cx + (DOOR_W / 2) + (sideLen / 2), WALL_H / 2, cz - hd);
  northWallR.castShadow = northWallR.receiveShadow = true;
  deps.scene.add(northWallR);

  // ── Lighting ─────────────────────────────────────────────────────────────
  const warmLight = new THREE.PointLight(0xffa040, 3.8, 24);
  warmLight.decay = 2.0;
  warmLight.position.set(cx - 5, WALL_H - 0.4, cz - 3);
  warmLight.castShadow = true;
  deps.scene.add(warmLight);

  const coolLight = new THREE.PointLight(0x38bdf8, 3.0, 20);
  coolLight.decay = 2.0;
  coolLight.position.set(cx + 5, WALL_H - 0.4, cz + 3);
  deps.scene.add(coolLight);

  // ── Cafeteria table props ────────────────────────────────────────────────
  const tableMat = deps.blackMetalMaterial;
  const topMat   = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.75, metalness: 0.1 });

  const addCafeTable = (x: number, z: number) => {
    const tg = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.0), topMat);
    top.position.y = 0.92;
    top.castShadow = top.receiveShadow = true;
    tg.add(top);

    const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.90, 6);
    const positions: [number, number][] = [[-1.3, -0.4], [1.3, -0.4], [-1.3, 0.4], [1.3, 0.4]];
    positions.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeom, tableMat);
      leg.position.set(lx, 0.45, lz);
      leg.castShadow = true;
      tg.add(leg);
    });

    tg.position.set(x, 0, z);
    deps.scene.add(tg);
    deps.obstacles.push(new THREE.Box3().setFromObject(tg));
  };

  addCafeTable(cx - 5, cz - 4);
  addCafeTable(cx - 5, cz);
  addCafeTable(cx - 5, cz + 4);
  addCafeTable(cx + 2, cz - 4);
  addCafeTable(cx + 2, cz);
  addCafeTable(cx + 2, cz + 4);

  // ── Scattered food trays on floor ────────────────────────────────────────
  const trayMat = new THREE.MeshBasicMaterial({ color: 0xb0b0b0, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), trayMat);
    tray.rotation.x = -Math.PI / 2;
    tray.rotation.z = Math.random() * Math.PI;
    tray.position.set(
      cx + (Math.random() - 0.5) * (CAFETERIA_W - 4),
      0.01,
      cz + (Math.random() - 0.5) * (CAFETERIA_D - 4),
    );
    deps.scene.add(tray);
  }

  // ── Buyable door (north wall of Cafeteria / south end of Hallway) ────────
  const door = buildBuyableDoor(
    deps,
    'door-cafeteria',
    cx, 0, cz - hd,   // north wall of cafeteria == south end of hallway
    0,
    1000,
    'CAFETERIA – $1000',
  );

  return { door };
}
