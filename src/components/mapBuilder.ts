import * as THREE from 'three';
import { ROOMS } from '../world/rooms';

// ---------------------------------------------------------------------------
// buildStaticMap
// Builds the STARTING CLASSROOM legacy geometry (chalkboard, teacher desk,
// student desks, halogen ceiling lights) that pre-dates the ROOMS system,
// plus the shared ambient/directional lighting that covers the whole map.
// Every other room (Hallway 1, Classroom 102, Classroom 103) is built by
// buildRoom() in src/world/rooms.ts — driven entirely from ROOMS data.
// ---------------------------------------------------------------------------

export const buildStaticMap = (
  scene: THREE.Scene,
  materials: {
    wallMaterial:       THREE.MeshStandardMaterial;
    floorMaterial:      THREE.MeshStandardMaterial;
    ceilingMaterial:    THREE.MeshStandardMaterial;
    woodMaterial:       THREE.MeshStandardMaterial;
    blackMetalMaterial: THREE.MeshStandardMaterial;
    chalkboardMaterial: THREE.MeshStandardMaterial;
  },
  halogenLights?: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[],
  _p0?: never[],
) => {
  const {
    wallMaterial,
    floorMaterial,
    ceilingMaterial,
    woodMaterial,
    blackMetalMaterial,
    chalkboardMaterial,
  } = materials;

  // Ensure textures repeat correctly on BoxGeometry UVs
  if (wallMaterial.map)    { wallMaterial.map.repeat.set(4,1);    wallMaterial.map.wrapS = THREE.RepeatWrapping; wallMaterial.map.wrapT = THREE.RepeatWrapping; wallMaterial.map.needsUpdate = true; }
  if (floorMaterial.map)   { floorMaterial.map.repeat.set(6,6);   floorMaterial.map.wrapS = THREE.RepeatWrapping; floorMaterial.map.wrapT = THREE.RepeatWrapping; floorMaterial.map.needsUpdate = true; }
  if (ceilingMaterial.map) { ceilingMaterial.map.repeat.set(8,8); ceilingMaterial.map.wrapS = THREE.RepeatWrapping; ceilingMaterial.map.wrapT = THREE.RepeatWrapping; ceilingMaterial.map.needsUpdate = true; }
  if (woodMaterial.map)    { woodMaterial.map.wrapS = THREE.RepeatWrapping; woodMaterial.map.wrapT = THREE.RepeatWrapping; woodMaterial.map.needsUpdate = true; }
  wallMaterial.needsUpdate    = true;
  floorMaterial.needsUpdate   = true;
  ceilingMaterial.needsUpdate = true;
  woodMaterial.needsUpdate    = true;

  const WALL_H = 4.5;
  const sc     = ROOMS.startingClassroom.bounds;
  const rW     = sc.maxX - sc.minX;  // 50
  const rD     = sc.maxZ - sc.minZ;  // 44
  const cx     = (sc.minX + sc.maxX) / 2; // -33
  const cz     = (sc.minZ + sc.maxZ) / 2; // 0

  // ── FLOOR & CEILING ──────────────────────────────────────────────────────
  const classroomFloor = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), floorMaterial);
  classroomFloor.rotation.x = -Math.PI / 2;
  classroomFloor.position.set(cx, 0, cz);
  classroomFloor.receiveShadow = true;
  scene.add(classroomFloor);

  const classroomCeiling = new THREE.Mesh(new THREE.PlaneGeometry(rW, rD), ceilingMaterial);
  classroomCeiling.rotation.x = Math.PI / 2;
  classroomCeiling.position.set(cx, WALL_H, cz);
  scene.add(classroomCeiling);

  // ── WALLS (matching ROOMS.startingClassroom wall definitions) ────────────
  const addWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMaterial);
    m.position.set(x, y, z);
    m.castShadow    = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  const doorW = 10; // gap width on east wall (Z: -5 .. 5)
  addWall(0.25, WALL_H, rD,              sc.minX,            WALL_H/2, cz);           // west
  addWall(rW,   WALL_H, 0.25,            cx,                 WALL_H/2, sc.minZ);      // north
  addWall(rW,   WALL_H, 0.25,            cx,                 WALL_H/2, sc.maxZ);      // south
  addWall(0.25, WALL_H, (rD-doorW)/2,   sc.maxX,            WALL_H/2, sc.minZ + (rD-doorW)/4);  // east north
  addWall(0.25, WALL_H, (rD-doorW)/2,   sc.maxX,            WALL_H/2, sc.maxZ - (rD-doorW)/4);  // east south

  // ── CHALKBOARD ───────────────────────────────────────────────────────────
  const cbFrame = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.15), blackMetalMaterial);
  cbFrame.position.set(cx, 2.1, sc.minZ + 0.12);
  scene.add(cbFrame);
  const cbPanel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.9, 0.05), chalkboardMaterial);
  cbPanel.position.set(cx, 2.1, sc.minZ + 0.2);
  cbPanel.receiveShadow = true;
  scene.add(cbPanel);

  // ── TEACHER DESK ─────────────────────────────────────────────────────────
  const teacherDeskGroup = new THREE.Group();
  const tdTop  = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.6), woodMaterial);
  tdTop.position.y = 0.95; tdTop.castShadow = true; teacherDeskGroup.add(tdTop);
  const tdBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.3), blackMetalMaterial);
  tdBody.position.y = 0.45; tdBody.castShadow = true; teacherDeskGroup.add(tdBody);
  const lBase  = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), blackMetalMaterial);
  lBase.position.set(-0.6, 1.01, 0); teacherDeskGroup.add(lBase);
  const lScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), blackMetalMaterial);
  lScreen.position.set(-0.6, 1.15, -0.13); lScreen.rotation.x = -0.28; teacherDeskGroup.add(lScreen);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
  );
  glow.position.set(-0.6, 1.15, -0.115); glow.rotation.x = -0.28; teacherDeskGroup.add(glow);
  teacherDeskGroup.position.set(cx, 0, sc.minZ + 4.5);
  scene.add(teacherDeskGroup);

  // ── LIGHTS ───────────────────────────────────────────────────────────────
  // ONE directional light casts shadows; everything else is shadow-free
  // (WebGL hard-limits shadow maps; exceeding it blacks out the scene)
  const dirLight = new THREE.DirectionalLight(0x1a2e4c, 0.75);
  dirLight.position.set(5, 10, -5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near   =   0.5;
  dirLight.shadow.camera.far    =  80;
  dirLight.shadow.camera.left   = -20;
  dirLight.shadow.camera.right  =  20;
  dirLight.shadow.camera.top    =  20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffedd5, 0.28));

  const addHalogenBox = (x: number, y: number, z: number, colorHex = 0xf0f5ff, powerValue = 3.2) => {
    const g      = new THREE.Group();
    const casing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 0.4), blackMetalMaterial);
    casing.position.set(0, -0.075, 0); g.add(casing);
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.05, 0.3),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    glassMesh.position.set(0, -0.15, 0); g.add(glassMesh);
    const light = new THREE.PointLight(colorHex, powerValue, 28);
    light.decay = 2.0;
    light.position.set(0, -0.3, 0);
    // castShadow intentionally OFF
    g.add(light);
    g.position.set(x, y, z);
    scene.add(g);
    if (halogenLights) halogenLights.push({ mesh: glassMesh, light, basePower: powerValue });
  };

  addHalogenBox(cx - 7, WALL_H, cz - 6, 0xffecd2, 3.4);
  addHalogenBox(cx + 7, WALL_H, cz - 6, 0xfff7ed, 3.5);
  addHalogenBox(cx - 7, WALL_H, cz + 6, 0xfef3c7, 2.9);
  addHalogenBox(cx + 7, WALL_H, cz + 6, 0xfff7ed, 3.5);

  // Moonbeam spotlights
  const addSpot = (x: number, y: number, z: number, tx: number, tz: number) => {
    const spot = new THREE.SpotLight(0x4080ff, 4.5, 26, Math.PI/4.5, 0.45, 0.55);
    spot.position.set(x, y + 2.0, z);
    const tgt = new THREE.Object3D();
    tgt.position.set(tx, 0, tz);
    scene.add(tgt);
    spot.target = tgt;
    scene.add(spot);
  };
  addSpot(cx - 10, WALL_H/2, sc.minZ + 0.1, cx - 6, cz - 4);
  addSpot(cx + 10, WALL_H/2, sc.minZ + 0.1, cx + 6, cz - 4);
  addSpot(cx - 10, WALL_H/2, sc.maxZ - 0.1, cx - 6, cz + 4);
  addSpot(cx + 10, WALL_H/2, sc.maxZ - 0.1, cx + 6, cz + 4);

  // ── STUDENT DESKS ────────────────────────────────────────────────────────
  const classroomObstacles: THREE.Box3[] = [];
  classroomObstacles.push(new THREE.Box3().setFromObject(teacherDeskGroup));

  const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 6);
  const createDesk = (posX: number, posZ: number, tipped = false) => {
    const g   = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), woodMaterial);
    top.position.y = 0.72; top.castShadow = true; g.add(top);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), blackMetalMaterial);
    frame.position.y = 0.63; g.add(frame);
    [[-0.68,-0.36],[0.68,-0.36],[-0.68,0.36],[0.68,0.36]].forEach(([lx,lz]) => {
      const l = new THREE.Mesh(legGeom, blackMetalMaterial);
      l.position.set(lx, 0.34, lz); l.castShadow = true; g.add(l);
    });
    const chair = new THREE.Group();
    const seat  = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), woodMaterial);
    seat.position.y = 0.42; chair.add(seat);
    const back  = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.04), woodMaterial);
    back.position.set(0, 0.68, -0.30); chair.add(back);
    const tubeG = new THREE.CylinderGeometry(0.016, 0.016, 0.88, 6);
    const bt1   = new THREE.Mesh(tubeG, blackMetalMaterial); bt1.position.set(-0.30, 0.44, -0.30); chair.add(bt1);
    const bt2   = bt1.clone(); bt2.position.x = 0.30; chair.add(bt2);
    const fleg  = new THREE.CylinderGeometry(0.016, 0.016, 0.40, 6);
    const fl1   = new THREE.Mesh(fleg, blackMetalMaterial); fl1.position.set(-0.30, 0.20, 0.28); chair.add(fl1);
    const fl2   = fl1.clone(); fl2.position.x = 0.30; chair.add(fl2);
    chair.rotation.y = Math.PI; chair.position.set(0, 0, 0.98); g.add(chair);
    if (tipped) { g.rotation.z = Math.PI/2.3; g.rotation.x = 0.3; g.position.set(posX, 0.25, posZ); }
    else g.position.set(posX, 0, posZ);
    scene.add(g);
    classroomObstacles.push(new THREE.Box3().setFromObject(g));
  };

  const deskCols = 4, deskRows = 3, xSp = 4.5, zSp = 4.2;
  const xStart = cx - ((deskCols - 1) * xSp) / 2;
  for (let row = 0; row < deskRows; row++)
    for (let col = 0; col < deskCols; col++)
      createDesk(xStart + col * xSp, cz - 3 + row * zSp, row === 1 && col === 1);

  // ── PAPERS ───────────────────────────────────────────────────────────────
  const pMat = new THREE.MeshBasicMaterial({ color: 0xdcdcdc, side: THREE.DoubleSide });
  const pGeo = new THREE.PlaneGeometry(0.35, 0.25);
  for (let i = 0; i < 24; i++) {
    const pm = new THREE.Mesh(pGeo, pMat);
    pm.position.set(
      cx + (Math.random()-0.5)*(rW-4),
      0.01,
      cz + (Math.random()-0.5)*(rD-4)
    );
    pm.rotation.x = -Math.PI/2; pm.rotation.z = Math.random()*Math.PI;
    scene.add(pm);
  }

  // ── HALLWAY LOCKERS ───────────────────────────────────────────────────────
  const hl = ROOMS.hallway.bounds;
  const hcx = (hl.minX + hl.maxX) / 2;
  const createLocker = (lx: number, lz: number, ry: number) => {
    const g    = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 3.6, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x1f3c4d, roughness: 0.65, metalness: 0.4 })
    );
    base.position.y = 1.8; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xcca43b, metalness: 0.9 })
    );
    handle.position.set(0.44, 1.8, 0.48); g.add(handle);
    g.position.set(lx, 0, lz); g.rotation.y = ry;
    scene.add(g);
    classroomObstacles.push(new THREE.Box3().setFromObject(g));
  };
  createLocker(hcx - 5, hl.minZ + 0.55, 0);
  createLocker(hcx,     hl.minZ + 0.55, 0);
  createLocker(hcx + 5, hl.minZ + 0.55, 0);
  createLocker(hcx - 5, hl.maxZ - 0.55, 0);
  createLocker(hcx,     hl.maxZ - 0.55, 0);
  createLocker(hcx + 5, hl.maxZ - 0.55, 0);

  return classroomObstacles;
};
