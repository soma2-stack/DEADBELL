import * as THREE from 'three';

// ─── Constants mirroring mapBuilder.ts exactly ────────────────────────────────
const WALL_H           = 4.5;
const HALLWAY_X_CENTER = 18;
const HALLWAY_W        = 8;    // hallway spans x: 14 → 22
const HALLWAY_D        = 50;   // hallway spans z: -25 → +25
const DOOR_OPENING     = 4.0;  // same door width as starter classroom

// Classroom A (Science) — north of hallway, door on its south wall (z = -25)
const CLA_W = 28;  // same width as starter classroom
const CLA_D = 24;  // same depth as starter classroom
const CLA_CX = HALLWAY_X_CENTER;                            //  18
const CLA_CZ = -(HALLWAY_D / 2) - CLA_D / 2;              // -25 - 12 = -37

// Classroom B (Abandoned) — south of hallway, door on its north wall (z = +25)
const CLB_W = 28;
const CLB_D = 24;
const CLB_CX = HALLWAY_X_CENTER;                            //  18
const CLB_CZ = (HALLWAY_D / 2) + CLB_D / 2;               // +25 + 12 = +37

// ─── Interface ────────────────────────────────────────────────────────────────
export interface RoomDeps {
  scene:              THREE.Scene;
  wallMaterial:       THREE.MeshStandardMaterial;
  floorMaterial:      THREE.MeshStandardMaterial;
  ceilingMaterial:    THREE.MeshStandardMaterial;
  woodMaterial:       THREE.MeshStandardMaterial;
  blackMetalMaterial: THREE.MeshStandardMaterial;
  chalkboardMaterial: THREE.MeshStandardMaterial;
  woodTex:            THREE.Texture;
  obstacles:          THREE.Box3[];
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Halogen ceiling fixture — identical to mapBuilder's addHalogenBox */
function addHalogenBox(
  scene: THREE.Scene,
  blackMetalMaterial: THREE.MeshStandardMaterial,
  x: number, y: number, z: number,
  colorHex: number = 0xf0f5ff,
  powerValue: number = 3.2,
) {
  const g = new THREE.Group();
  const casing = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.15, 0.4), blackMetalMaterial,
  );
  casing.position.set(x, y - 0.075, z);
  g.add(casing);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 0.3),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  glass.position.set(x, y - 0.15, z);
  g.add(glass);
  scene.add(g);

  const light = new THREE.PointLight(colorHex, powerValue, 28);
  light.decay = 2.0;
  light.position.set(x, y - 0.3, z);
  light.castShadow = true;
  light.shadow.bias = -0.0006;
  light.shadow.mapSize.width  = 1024;
  light.shadow.mapSize.height = 1024;
  scene.add(light);
}

/** Moonbeam spotlight — identical to mapBuilder's addWindowMoonlight */
function addWindowMoonlight(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  targetX: number, targetZ: number,
) {
  const spot = new THREE.SpotLight(0x4080ff, 4.5, 26, Math.PI / 4.5, 0.45, 0.55);
  spot.position.set(x, y + 2.0, z);
  const tgt = new THREE.Object3D();
  tgt.position.set(targetX, 0, targetZ);
  scene.add(tgt);
  spot.target = tgt;
  spot.castShadow = true;
  spot.shadow.bias = -0.0006;
  spot.shadow.mapSize.width  = 1024;
  spot.shadow.mapSize.height = 1024;
  scene.add(spot);
}

/** Student desk + chair — exact copy of createStudentDesk from mapBuilder */
function createStudentDesk(
  scene: THREE.Scene,
  woodMaterial: THREE.MeshStandardMaterial,
  blackMetalMaterial: THREE.MeshStandardMaterial,
  obstacles: THREE.Box3[],
  posX: number,
  posZ: number,
  isTipped: boolean = false,
) {
  const g = new THREE.Group();

  // Desk slab
  const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), woodMaterial);
  topMesh.position.y = 0.72;
  topMesh.castShadow = topMesh.receiveShadow = true;
  g.add(topMesh);

  // Steel under-frame
  const frameY = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), blackMetalMaterial);
  frameY.position.y = 0.63;
  frameY.castShadow = true;
  g.add(frameY);

  // Four legs
  const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 6);
  const makeL = (lx: number, lz: number) => {
    const l = new THREE.Mesh(legGeom, blackMetalMaterial);
    l.position.set(lx, 0.34, lz);
    l.castShadow = true;
    return l;
  };
  g.add(makeL(-0.68, -0.36));
  g.add(makeL( 0.68, -0.36));
  g.add(makeL(-0.68,  0.36));
  g.add(makeL( 0.68,  0.36));

  // Chair
  const chairGroup = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), woodMaterial);
  seat.position.y = 0.42;
  seat.castShadow = seat.receiveShadow = true;
  chairGroup.add(seat);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.04), woodMaterial);
  chairBack.position.set(0, 0.68, -0.30);
  chairBack.castShadow = chairBack.receiveShadow = true;
  chairGroup.add(chairBack);

  const backTubeGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.88, 6);
  const bt1 = new THREE.Mesh(backTubeGeom, blackMetalMaterial);
  bt1.position.set(-0.30, 0.44, -0.30);
  bt1.castShadow = true;
  chairGroup.add(bt1);
  const bt2 = bt1.clone(); bt2.position.x = 0.30; chairGroup.add(bt2);

  const frontLegGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.40, 6);
  const fl1 = new THREE.Mesh(frontLegGeom, blackMetalMaterial);
  fl1.position.set(-0.30, 0.20, 0.28);
  fl1.castShadow = true;
  chairGroup.add(fl1);
  const fl2 = fl1.clone(); fl2.position.x = 0.30; chairGroup.add(fl2);

  chairGroup.rotation.y = Math.PI;
  chairGroup.position.set(0, 0, 0.98);
  g.add(chairGroup);

  if (isTipped) {
    g.rotation.z = Math.PI / 2.3;
    g.rotation.x = 0.3;
    g.position.set(posX, 0.25, posZ);
  } else {
    g.position.set(posX, 0, posZ);
  }

  scene.add(g);
  obstacles.push(new THREE.Box3().setFromObject(g));
}

/** Teacher desk with optional paper stack prop instead of laptop */
function createTeacherDesk(
  scene: THREE.Scene,
  woodMaterial: THREE.MeshStandardMaterial,
  blackMetalMaterial: THREE.MeshStandardMaterial,
  obstacles: THREE.Box3[],
  cx: number, cz: number,
  variant: 'laptop' | 'papers',
) {
  const g = new THREE.Group();

  const tdTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.6), woodMaterial);
  tdTop.position.y = 0.95;
  tdTop.castShadow = true;
  g.add(tdTop);

  const tdBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.3), blackMetalMaterial);
  tdBody.position.y = 0.45;
  tdBody.castShadow = true;
  g.add(tdBody);

  if (variant === 'laptop') {
    const lBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), blackMetalMaterial);
    lBase.position.set(-0.6, 1.01, 0);
    g.add(lBase);
    const lScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), blackMetalMaterial);
    lScreen.position.set(-0.6, 1.15, -0.13);
    lScreen.rotation.x = -0.28;
    g.add(lScreen);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide }),
    );
    glow.position.set(-0.6, 1.15, -0.115);
    glow.rotation.x = -0.28;
    g.add(glow);
  } else {
    // Scattered paper stack — quick worn-classroom detail
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xd4cbb0, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.004, 0.26), paperMat);
      p.position.set(0.4 + i * 0.015, 1.0 + i * 0.005, (Math.random() - 0.5) * 0.2);
      p.rotation.y = (Math.random() - 0.5) * 0.4;
      g.add(p);
    }
  }

  g.position.set(cx, 0, cz);
  scene.add(g);
  obstacles.push(new THREE.Box3().setFromObject(g));
}

/** Chalkboard / whiteboard on a wall */
function createBoard(
  scene: THREE.Scene,
  blackMetalMaterial: THREE.MeshStandardMaterial,
  chalkboardMaterial: THREE.MeshStandardMaterial,
  x: number, y: number, z: number,
  rotY: number = 0,
) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.15), blackMetalMaterial);
  frame.position.set(x, y, z);
  frame.rotation.y = rotY;
  scene.add(frame);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.9, 0.05), chalkboardMaterial);
  // Offset the panel slightly in front of the frame
  const offset = 0.08;
  panel.position.set(
    x + Math.sin(rotY) * offset,
    y,
    z + Math.cos(rotY) * offset,
  );
  panel.rotation.y = rotY;
  panel.receiveShadow = true;
  scene.add(panel);
}

/** Canvas-texture poster mesh */
function makePosterMesh(
  lines: string[],
  bgColor: string,
  textColor: string,
  width = 1.6,
  height = 1.1,
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 352;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 352);
  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px "Courier New"';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, 256, 60 + i * 52));
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
}

/** Buyable door — same style as interactables.ts */
function buildBuyableDoor(
  deps: RoomDeps,
  id: string,
  x: number, z: number,
  price: number,
  label: string,
) {
  const g = new THREE.Group();
  const dH = WALL_H;

  const woodMat = new THREE.MeshStandardMaterial({
    map: deps.woodTex, roughness: 0.8, metalness: 0.05,
  });
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_OPENING, dH, 0.28), woodMat);
  doorMesh.position.y = dH / 2;
  doorMesh.castShadow = doorMesh.receiveShadow = true;
  g.add(doorMesh);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.55,
    roughness: 0.4, metalness: 0.7,
  });
  const fTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_OPENING + 0.2, 0.12, 0.12), frameMat);
  fTop.position.set(0, dH + 0.06, 0);
  g.add(fTop);
  const fL = new THREE.Mesh(new THREE.BoxGeometry(0.12, dH, 0.12), frameMat);
  fL.position.set(-(DOOR_OPENING / 2) - 0.06, dH / 2, 0);
  g.add(fL);
  const fR = fL.clone(); fR.position.x = (DOOR_OPENING / 2) + 0.06; g.add(fR);

  // Sign
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 506, 122);
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 34px "Courier New"'; ctx.textAlign = 'center';
  ctx.fillText(label, 256, 46);
  ctx.font = 'bold 25px "Courier New"';
  ctx.fillText(`Press E  [$${price}]`, 256, 95);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide, transparent: true }),
  );
  sign.position.set(0, dH + 0.7, 0.2);
  g.add(sign);

  g.position.set(x, 0, z);
  deps.scene.add(g);
  deps.obstacles.push(new THREE.Box3().setFromObject(g));

  return {
    id, price,
    position: [x, 0, z] as [number, number, number],
    rotationY: 0,
    width: DOOR_OPENING, height: dH,
    purchased: false,
    group: g, doorMesh,
    sinkOffset: 0,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// CLASSROOM A — "SCIENCE LAB"  (north of hallway, z ≈ -37)
// Door opens from hallway north end into this room's south wall
// ═════════════════════════════════════════════════════════════════════════════
export function buildClassroomA(deps: RoomDeps) {
  const cx = CLA_CX;
  const cz = CLA_CZ;
  const hw = CLA_W / 2;   // 14
  const hd = CLA_D / 2;   // 12

  // ── Shell ────────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CLA_W, CLA_D), deps.floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  deps.scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CLA_W, CLA_D), deps.ceilingMaterial);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  deps.scene.add(ceil);

  // North wall — solid
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(CLA_W, WALL_H, 0.5), deps.wallMaterial);
  northWall.position.set(cx, WALL_H / 2, cz - hd);
  northWall.castShadow = northWall.receiveShadow = true;
  deps.scene.add(northWall);

  // West wall — solid
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLA_D), deps.wallMaterial);
  westWall.position.set(cx - hw, WALL_H / 2, cz);
  westWall.castShadow = westWall.receiveShadow = true;
  deps.scene.add(westWall);

  // East wall — solid
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLA_D), deps.wallMaterial);
  eastWall.position.set(cx + hw, WALL_H / 2, cz);
  eastWall.castShadow = eastWall.receiveShadow = true;
  deps.scene.add(eastWall);

  // South wall — split for door (door centered on cx)
  const sideLen = (CLA_W - DOOR_OPENING) / 2;
  const swL = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  swL.position.set(cx - DOOR_OPENING / 2 - sideLen / 2, WALL_H / 2, cz + hd);
  swL.castShadow = swL.receiveShadow = true;
  deps.scene.add(swL);
  const swR = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  swR.position.set(cx + DOOR_OPENING / 2 + sideLen / 2, WALL_H / 2, cz + hd);
  swR.castShadow = swR.receiveShadow = true;
  deps.scene.add(swR);

  // ── Chalkboard on north wall ──────────────────────────────────────────────
  createBoard(
    deps.scene, deps.blackMetalMaterial, deps.chalkboardMaterial,
    cx, 2.1, cz - hd + 0.12,
  );

  // ── Teacher desk (with laptop — same as starter) ──────────────────────────
  createTeacherDesk(
    deps.scene, deps.woodMaterial, deps.blackMetalMaterial, deps.obstacles,
    cx, cz - hd + 4.5,
    'laptop',
  );

  // ── Student desks — staggered two-column layout (science lab feel) ────────
  // Left cluster: 3 rows × 2 cols
  // Right cluster: 3 rows × 2 cols with a centre aisle
  const deskConfigs: Array<{ x: number; z: number; tipped: boolean }> = [];
  const colOffsets = [-5.5, -1.8, 1.8, 5.5];   // 4 cols with wider centre aisle
  const rowOffsets = [-1.0, 3.2, 7.2];           // 3 rows shifted north

  colOffsets.forEach((dx, ci) => {
    rowOffsets.forEach((dz, ri) => {
      deskConfigs.push({
        x: cx + dx,
        z: cz - hd + 8.5 + dz,
        tipped: ri === 1 && ci === 2, // one tipped desk — different position to starter
      });
    });
  });

  deskConfigs.forEach(({ x, z, tipped }) =>
    createStudentDesk(
      deps.scene, deps.woodMaterial, deps.blackMetalMaterial, deps.obstacles,
      x, z, tipped,
    ),
  );

  // ── Science posters on west wall ──────────────────────────────────────────
  const sciencePoster1 = makePosterMesh(
    ['PERIODIC', 'TABLE', 'OF ELEMENTS'],
    '#0f172a', '#38bdf8',
  );
  sciencePoster1.position.set(cx - hw + 0.06, 2.8, cz - 3);
  sciencePoster1.rotation.y = Math.PI / 2;
  deps.scene.add(sciencePoster1);

  const sciencePoster2 = makePosterMesh(
    ['HUMAN', 'ANATOMY'],
    '#1a0a00', '#fb923c',
  );
  sciencePoster2.position.set(cx - hw + 0.06, 2.8, cz + 3);
  sciencePoster2.rotation.y = Math.PI / 2;
  deps.scene.add(sciencePoster2);

  // ── Damaged ceiling tiles (dark patch meshes on ceiling plane) ────────────
  const damageMat = new THREE.MeshBasicMaterial({ color: 0x1a1208, side: THREE.DoubleSide });
  const damagePatch = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), damageMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, WALL_H - 0.02, z);
    deps.scene.add(m);
  };
  damagePatch(cx - 4, cz - 2, 3.5, 2.0);
  damagePatch(cx + 6, cz + 4, 2.2, 1.4);
  damagePatch(cx - 8, cz + 6, 1.8, 2.8);

  // ── Scattered papers ──────────────────────────────────────────────────────
  const paperMat = new THREE.MeshBasicMaterial({ color: 0xdcdcdc, side: THREE.DoubleSide });
  for (let i = 0; i < 24; i++) {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), paperMat);
    pm.position.set(
      cx + (Math.random() - 0.5) * (CLA_W - 4),
      0.01,
      cz + (Math.random() - 0.5) * (CLA_D - 4),
    );
    pm.rotation.x = -Math.PI / 2;
    pm.rotation.z = Math.random() * Math.PI;
    deps.scene.add(pm);
  }

  // ── Ceiling lights — same addHalogenBox style as starter ─────────────────
  // Two lights slightly cool/greenish (science lab fluorescents)
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx - 7, WALL_H, cz - 5, 0xd4f5e0, 3.2);
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx + 7, WALL_H, cz - 5, 0xe0f5d4, 3.3);
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx - 7, WALL_H, cz + 5, 0xfef3c7, 2.7); // dimmer back
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx + 7, WALL_H, cz + 5, 0xfff7ed, 2.8);

  // ── Moonbeam spotlights through windows ───────────────────────────────────
  addWindowMoonlight(deps.scene, cx - 10, WALL_H / 2, cz - hd + 0.1, cx - 6, cz - hd + 4);
  addWindowMoonlight(deps.scene, cx + 10, WALL_H / 2, cz - hd + 0.1, cx + 6, cz - hd + 4);
  addWindowMoonlight(deps.scene, cx - 10, WALL_H / 2, cz + hd - 0.1, cx - 6, cz + hd - 4);
  addWindowMoonlight(deps.scene, cx + 10, WALL_H / 2, cz + hd - 0.1, cx + 6, cz + hd - 4);

  // ── Buyable door ──────────────────────────────────────────────────────────
  const door = buildBuyableDoor(deps, 'door-classroom-a', cx, cz + hd, 1500, 'SCIENCE LAB');

  return { door };
}

// ═════════════════════════════════════════════════════════════════════════════
// CLASSROOM B — "ABANDONED CLASSROOM"  (south of hallway, z ≈ +37)
// Door opens from hallway south end into this room's north wall
// ═════════════════════════════════════════════════════════════════════════════
export function buildClassroomB(deps: RoomDeps) {
  const cx = CLB_CX;
  const cz = CLB_CZ;
  const hw = CLB_W / 2;
  const hd = CLB_D / 2;

  // ── Shell ────────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CLB_W, CLB_D), deps.floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  deps.scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CLB_W, CLB_D), deps.ceilingMaterial);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  deps.scene.add(ceil);

  // South wall — solid
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(CLB_W, WALL_H, 0.5), deps.wallMaterial);
  southWall.position.set(cx, WALL_H / 2, cz + hd);
  southWall.castShadow = southWall.receiveShadow = true;
  deps.scene.add(southWall);

  // West wall — solid
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLB_D), deps.wallMaterial);
  westWall.position.set(cx - hw, WALL_H / 2, cz);
  westWall.castShadow = westWall.receiveShadow = true;
  deps.scene.add(westWall);

  // East wall — solid
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLB_D), deps.wallMaterial);
  eastWall.position.set(cx + hw, WALL_H / 2, cz);
  eastWall.castShadow = eastWall.receiveShadow = true;
  deps.scene.add(eastWall);

  // North wall — split for door
  const sideLen = (CLB_W - DOOR_OPENING) / 2;
  const nwL = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  nwL.position.set(cx - DOOR_OPENING / 2 - sideLen / 2, WALL_H / 2, cz - hd);
  nwL.castShadow = nwL.receiveShadow = true;
  deps.scene.add(nwL);
  const nwR = new THREE.Mesh(new THREE.BoxGeometry(sideLen, WALL_H, 0.5), deps.wallMaterial);
  nwR.position.set(cx + DOOR_OPENING / 2 + sideLen / 2, WALL_H / 2, cz - hd);
  nwR.castShadow = nwR.receiveShadow = true;
  deps.scene.add(nwR);

  // ── Chalkboard on south wall (room faces south — chalkboard faces players) ─
  createBoard(
    deps.scene, deps.blackMetalMaterial, deps.chalkboardMaterial,
    cx, 2.1, cz + hd - 0.12,
    Math.PI,
  );

  // ── Teacher desk (scattered papers — worn variant) ────────────────────────
  createTeacherDesk(
    deps.scene, deps.woodMaterial, deps.blackMetalMaterial, deps.obstacles,
    cx, cz + hd - 4.5,
    'papers',
  );

  // ── Student desks — diagonal/scattered layout (abandoned feel) ───────────
  // 3×4 grid but with staggered offsets per row simulating partial evacuation
  const rows = 3;
  const cols = 4;
  const xSp = 4.5;
  const zSp = 4.2;
  const xStart = cx - ((cols - 1) * xSp) / 2;
  const zStart = cz - hd + 5.5;

  for (let row = 0; row < rows; row++) {
    // Row 1 shifted slightly right, row 2 left — chaotic feel
    const rowShift = row === 0 ? 0.6 : row === 2 ? -0.8 : 0;
    for (let col = 0; col < cols; col++) {
      const px = xStart + col * xSp + rowShift;
      const pz = zStart + row * zSp;
      // Two tipped desks instead of one — more chaotic
      const tipped = (row === 0 && col === 3) || (row === 2 && col === 0);
      createStudentDesk(
        deps.scene, deps.woodMaterial, deps.blackMetalMaterial, deps.obstacles,
        px, pz, tipped,
      );
    }
  }

  // ── Bulletin board on east wall ───────────────────────────────────────────
  const bulletinBoard = makePosterMesh(
    ['HOMEWORK DUE', 'MONDAY', '-- MISSING --'],
    '#2d1a00', '#fbbf24',
    2.4, 1.6,
  );
  bulletinBoard.position.set(cx + hw - 0.06, 2.6, cz);
  bulletinBoard.rotation.y = -Math.PI / 2;
  deps.scene.add(bulletinBoard);

  const emergencyPoster = makePosterMesh(
    ['EMERGENCY', 'EVACUATION', 'ROUTE →'],
    '#3b0000', '#ef4444',
  );
  emergencyPoster.position.set(cx + hw - 0.06, 2.6, cz + 5);
  emergencyPoster.rotation.y = -Math.PI / 2;
  deps.scene.add(emergencyPoster);

  // ── Scattered books on floor ──────────────────────────────────────────────
  const bookColors = [0x8b1a1a, 0x1a3c8b, 0x1a6b1a, 0x6b5e1a, 0x4a1a6b];
  for (let i = 0; i < 18; i++) {
    const bookMat = new THREE.MeshStandardMaterial({
      color: bookColors[i % bookColors.length],
      roughness: 0.85, metalness: 0.0,
    });
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.30), bookMat);
    book.position.set(
      cx + (Math.random() - 0.5) * (CLB_W - 4),
      0.03,
      cz + (Math.random() - 0.5) * (CLB_D - 4),
    );
    book.rotation.y = Math.random() * Math.PI;
    book.castShadow = true;
    deps.scene.add(book);
  }

  // ── Student supplies pile near teacher desk ───────────────────────────────
  const supplyMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 });
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.22), supplyMat);
  backpack.position.set(cx - 2, 0.25, cz + hd - 5.5);
  backpack.castShadow = true;
  deps.scene.add(backpack);

  // ── Scattered papers ──────────────────────────────────────────────────────
  const paperMat = new THREE.MeshBasicMaterial({ color: 0xdcdcdc, side: THREE.DoubleSide });
  for (let i = 0; i < 30; i++) { // more papers — more abandoned
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), paperMat);
    pm.position.set(
      cx + (Math.random() - 0.5) * (CLB_W - 4),
      0.01,
      cz + (Math.random() - 0.5) * (CLB_D - 4),
    );
    pm.rotation.x = -Math.PI / 2;
    pm.rotation.z = Math.random() * Math.PI;
    deps.scene.add(pm);
  }

  // ── Ceiling lights — warmer / one slightly flickery (lower power) ─────────
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx - 7, WALL_H, cz - 5, 0xffecd2, 3.4);
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx + 7, WALL_H, cz - 5, 0xfff7ed, 3.5);
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx - 7, WALL_H, cz + 5, 0xfef3c7, 2.1); // noticeably dimmer
  addHalogenBox(deps.scene, deps.blackMetalMaterial, cx + 7, WALL_H, cz + 5, 0xfff7ed, 1.8); // near dead

  // ── Moonbeam spotlights ───────────────────────────────────────────────────
  addWindowMoonlight(deps.scene, cx - 10, WALL_H / 2, cz - hd + 0.1, cx - 6, cz - hd + 4);
  addWindowMoonlight(deps.scene, cx + 10, WALL_H / 2, cz - hd + 0.1, cx + 6, cz - hd + 4);
  addWindowMoonlight(deps.scene, cx - 10, WALL_H / 2, cz + hd - 0.1, cx - 6, cz + hd - 4);
  addWindowMoonlight(deps.scene, cx + 10, WALL_H / 2, cz + hd - 0.1, cx + 6, cz + hd - 4);

  // ── Buyable door ──────────────────────────────────────────────────────────
  const door = buildBuyableDoor(deps, 'door-classroom-b', cx, cz - hd, 1000, 'CLASSROOM B');

  return { door };
}
