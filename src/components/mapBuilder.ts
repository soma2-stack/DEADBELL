import * as THREE from 'three';

export const buildStaticMap = (
scene: THREE.Scene, materials: {
  wallMaterial: THREE.MeshStandardMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  ceilingMaterial: THREE.MeshStandardMaterial;
  woodMaterial: THREE.MeshStandardMaterial;
  blackMetalMaterial: THREE.MeshStandardMaterial;
  chalkboardMaterial: THREE.MeshStandardMaterial;
}, halogenLights?: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number; }[], p0?: never[],

) => {
  const {
    wallMaterial,
    floorMaterial,
    ceilingMaterial,
    woodMaterial,
    blackMetalMaterial,
    chalkboardMaterial
  } = materials;

  // Force texture repeat & needsUpdate NOW so BoxGeometry UVs pick them up
  if (wallMaterial.map)    { wallMaterial.map.repeat.set(4, 1);    wallMaterial.map.wrapS    = THREE.RepeatWrapping; wallMaterial.map.wrapT    = THREE.RepeatWrapping; wallMaterial.map.needsUpdate    = true; }
  if (floorMaterial.map)   { floorMaterial.map.repeat.set(6, 6);   floorMaterial.map.wrapS   = THREE.RepeatWrapping; floorMaterial.map.wrapT   = THREE.RepeatWrapping; floorMaterial.map.needsUpdate   = true; }
  if (ceilingMaterial.map) { ceilingMaterial.map.repeat.set(8, 8); ceilingMaterial.map.wrapS = THREE.RepeatWrapping; ceilingMaterial.map.wrapT = THREE.RepeatWrapping; ceilingMaterial.map.needsUpdate = true; }
  if (woodMaterial.map)    { woodMaterial.map.wrapS = THREE.RepeatWrapping; woodMaterial.map.wrapT = THREE.RepeatWrapping; woodMaterial.map.needsUpdate = true; }
  wallMaterial.needsUpdate    = true;
  floorMaterial.needsUpdate   = true;
  ceilingMaterial.needsUpdate = true;
  woodMaterial.needsUpdate    = true;

  const CLASSROOM_W = 28;
  const CLASSROOM_D = 24;
  const WALL_H = 4.5;
  const HALLWAY_W = 8;
  const HALLWAY_D = 50;
  const HALLWAY_X_CENTER = 18;

  // --- STATIC MAP CONSTRUCTION ---
  const classroomFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(CLASSROOM_W, CLASSROOM_D), floorMaterial);
  classroomFloorMesh.rotation.x = -Math.PI / 2;
  classroomFloorMesh.receiveShadow = true;
  scene.add(classroomFloorMesh);

  const classroomCeilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(CLASSROOM_W, CLASSROOM_D), ceilingMaterial);
  classroomCeilingMesh.rotation.x = Math.PI / 2;
  classroomCeilingMesh.position.y = WALL_H;
  scene.add(classroomCeilingMesh);

  const westWallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLASSROOM_D), wallMaterial);
  westWallMesh.position.set(-CLASSROOM_W/2, WALL_H/2, 0);
  westWallMesh.receiveShadow = true;
  westWallMesh.castShadow = true;
  scene.add(westWallMesh);

  let doorZSize = 4;
  const eastWallNorth = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, (CLASSROOM_D - doorZSize) / 2), wallMaterial);
  eastWallNorth.position.set(CLASSROOM_W/2, WALL_H/2, -(CLASSROOM_D + doorZSize) / 4);
  eastWallNorth.receiveShadow = true;
  eastWallNorth.castShadow = true;
  scene.add(eastWallNorth);

  const eastWallSouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, (CLASSROOM_D - doorZSize) / 2), wallMaterial);
  eastWallSouth.position.set(CLASSROOM_W/2, WALL_H/2, (CLASSROOM_D + doorZSize) / 4);
  eastWallSouth.receiveShadow = true;
  eastWallSouth.castShadow = true;
  scene.add(eastWallSouth);

  const northWallMesh = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_W, WALL_H, 0.5), wallMaterial);
  northWallMesh.position.set(0, WALL_H/2, -CLASSROOM_D/2);
  northWallMesh.receiveShadow = true;
  northWallMesh.castShadow = true;
  scene.add(northWallMesh);

  const southWallMesh = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_W, WALL_H, 0.5), wallMaterial);
  southWallMesh.position.set(0, WALL_H/2, CLASSROOM_D/2);
  southWallMesh.receiveShadow = true;
  southWallMesh.castShadow = true;
  scene.add(southWallMesh);

  const hallwayFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALLWAY_W, HALLWAY_D), floorMaterial);
  hallwayFloorMesh.rotation.x = -Math.PI / 2;
  hallwayFloorMesh.position.set(HALLWAY_X_CENTER, 0, 0);
  hallwayFloorMesh.receiveShadow = true;
  scene.add(hallwayFloorMesh);

  const hallwayCeilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALLWAY_W, HALLWAY_D), ceilingMaterial);
  hallwayCeilingMesh.rotation.x = Math.PI / 2;
  hallwayCeilingMesh.position.set(HALLWAY_X_CENTER, WALL_H, 0);
  scene.add(hallwayCeilingMesh);

  const hallwayEastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, HALLWAY_D), wallMaterial);
  hallwayEastWall.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, WALL_H/2, 0);
  hallwayEastWall.receiveShadow = true;
  hallwayEastWall.castShadow = true;
  scene.add(hallwayEastWall);

  const hallwayWestWallNorthExtra = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 4), wallMaterial);
  hallwayWestWallNorthExtra.position.set(CLASSROOM_W/2, WALL_H/2, -14);
  hallwayWestWallNorthExtra.receiveShadow = true;
  hallwayWestWallNorthExtra.castShadow = true;
  scene.add(hallwayWestWallNorthExtra);

  const hallwayWestWallSouthExtra = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 4), wallMaterial);
  hallwayWestWallSouthExtra.position.set(CLASSROOM_W/2, WALL_H/2, 14);
  hallwayWestWallSouthExtra.receiveShadow = true;
  hallwayWestWallSouthExtra.castShadow = true;
  scene.add(hallwayWestWallSouthExtra);

  const hallwayNorthWall = new THREE.Mesh(new THREE.BoxGeometry(HALLWAY_W, WALL_H, 0.5), wallMaterial);
  hallwayNorthWall.position.set(HALLWAY_X_CENTER, WALL_H/2, -HALLWAY_D/2);
  hallwayNorthWall.receiveShadow = true;
  hallwayNorthWall.castShadow = true;
  scene.add(hallwayNorthWall);

  const hallwaySouthWall = new THREE.Mesh(new THREE.BoxGeometry(HALLWAY_W, WALL_H, 0.5), wallMaterial);
  hallwaySouthWall.position.set(HALLWAY_X_CENTER, WALL_H/2, HALLWAY_D/2);
  hallwaySouthWall.receiveShadow = true;
  hallwaySouthWall.castShadow = true;
  scene.add(hallwaySouthWall);

  // --- PROPS ---
  const cbFrame = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.15), blackMetalMaterial);
  cbFrame.position.set(0, 2.1, -CLASSROOM_D/2 + 0.12);
  scene.add(cbFrame);

  const cbPanel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.9, 0.05), chalkboardMaterial);
  cbPanel.position.set(0, 2.1, -CLASSROOM_D/2 + 0.2);
  cbPanel.receiveShadow = true;
  scene.add(cbPanel);

  const teacherDeskGroup = new THREE.Group();
  const tdTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.6), woodMaterial);
  tdTop.position.y = 0.95;
  tdTop.castShadow = true;
  teacherDeskGroup.add(tdTop);

  const tdBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.3), blackMetalMaterial);
  tdBody.position.y = 0.45;
  tdBody.castShadow = true;
  teacherDeskGroup.add(tdBody);

  const laptopGroup = new THREE.Group();
  const lBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), blackMetalMaterial);
  lBase.position.y = 1.01;
  laptopGroup.add(lBase);
  const lScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), blackMetalMaterial);
  lScreen.position.set(0, 1.15, -0.13);
  lScreen.rotation.x = -0.28;
  laptopGroup.add(lScreen);
  const emissionS = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide }));
  emissionS.position.set(0, 1.15, -0.115);
  emissionS.rotation.x = -0.28;
  laptopGroup.add(emissionS);
  laptopGroup.position.set(-0.6, 0, 0);
  teacherDeskGroup.add(laptopGroup);
  teacherDeskGroup.position.set(0, 0, -CLASSROOM_D/2 + 4.5);
  scene.add(teacherDeskGroup);

  // --- LIGHTS ---
  const addHalogenBox = (x: number, y: number, z: number, colorHex: number = 0xf0f5ff, powerValue: number = 3.2) => {
    const g = new THREE.Group();
    const casing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 0.4), blackMetalMaterial);
    casing.position.set(0, -0.075, 0);
    casing.castShadow = true;
    g.add(casing);

    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: colorHex }));
    glassMesh.position.set(0, -0.15, 0);
    g.add(glassMesh);

    const light = new THREE.PointLight(colorHex, powerValue, 28);
    light.decay = 2.0;
    light.position.set(0, -0.3, 0);
    light.castShadow = true;
    light.shadow.bias = -0.0006;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    g.add(light);

    g.position.set(x, y, z);
    scene.add(g);

    // Push to halogenLights so GameCanvas animate loop can flicker them
    if (halogenLights) {
      halogenLights.push({ mesh: glassMesh, light, basePower: powerValue });
    }
  };

  addHalogenBox(-7, WALL_H, -6, 0xffecd2, 3.4);
  addHalogenBox( 7, WALL_H, -6, 0xfff7ed, 3.5);
  addHalogenBox(-7, WALL_H,  6, 0xfef3c7, 2.9);
  addHalogenBox( 7, WALL_H,  6, 0xfff7ed, 3.5);
  addHalogenBox(19, WALL_H, -8, 0xef4444, 4.2);
  addHalogenBox(19, WALL_H,  8, 0x38bdf8, 3.6);

  const ambientLight = new THREE.AmbientLight(0xffedd5, 0.14);
  scene.add(ambientLight);

  const addWindowMoonlight = (x: number, y: number, z: number, targetX: number, targetZ: number) => {
    const spotLight = new THREE.SpotLight(0x4080ff, 4.5, 26, Math.PI / 4.5, 0.45, 0.55);
    spotLight.position.set(x, y + 2.0, z);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(targetX, 0, targetZ);
    scene.add(targetObj);
    spotLight.target = targetObj;
    spotLight.castShadow = true;
    spotLight.shadow.bias = -0.0006;
    spotLight.shadow.mapSize.width = 512;
    spotLight.shadow.mapSize.height = 512;
    scene.add(spotLight);
  };

  addWindowMoonlight(-10, WALL_H/2, -CLASSROOM_D/2 + 0.1, -6, -4);
  addWindowMoonlight( 10, WALL_H/2, -CLASSROOM_D/2 + 0.1,  6, -4);
  addWindowMoonlight(-10, WALL_H/2,  CLASSROOM_D/2 - 0.1, -6,  4);
  addWindowMoonlight( 10, WALL_H/2,  CLASSROOM_D/2 - 0.1,  6,  4);

  const subLight = new THREE.DirectionalLight(0x1a2e4c, 0.75);
  subLight.position.set(5, 10, -5);
  scene.add(subLight);

  // --- STUDENT DESKS ---
  const deskRows = 3;
  const deskCols = 4;
  const xSpacing = 4.5;
  const zSpacing = 4.2;
  const leftStart = -((deskCols - 1) * xSpacing) / 2;
  const frontStart = -0.7;

  const classroomObstacles: THREE.Box3[] = [];
  const tdBox = new THREE.Box3().setFromObject(teacherDeskGroup);
  classroomObstacles.push(tdBox);

  const createStudentDesk = (posX: number, posZ: number, isTipped: boolean = false) => {
    const g = new THREE.Group();

    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), woodMaterial);
    topMesh.position.y = 0.72;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    g.add(topMesh);

    const frameY = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), blackMetalMaterial);
    frameY.position.y = 0.63;
    frameY.castShadow = true;
    g.add(frameY);

    const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 6);
    const legL1 = new THREE.Mesh(legGeom, blackMetalMaterial);
    legL1.position.set(-0.68, 0.34, -0.36);
    legL1.castShadow = true;
    g.add(legL1);
    const legR1 = legL1.clone(); legR1.position.set( 0.68, 0.34, -0.36); g.add(legR1);
    const legL2 = legL1.clone(); legL2.position.set(-0.68, 0.34,  0.36); g.add(legL2);
    const legR2 = legL1.clone(); legR2.position.set( 0.68, 0.34,  0.36); g.add(legR2);

    const chairGroup = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), woodMaterial);
    seat.position.y = 0.42; seat.castShadow = true; seat.receiveShadow = true;
    chairGroup.add(seat);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.04), woodMaterial);
    chairBack.position.set(0, 0.68, -0.30); chairBack.castShadow = true; chairBack.receiveShadow = true;
    chairGroup.add(chairBack);
    const frameBack = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.88, 6), blackMetalMaterial);
    frameBack.position.set(-0.30, 0.44, -0.30); frameBack.castShadow = true;
    chairGroup.add(frameBack);
    const frameBackR = frameBack.clone(); frameBackR.position.x = 0.30; chairGroup.add(frameBackR);
    const legFront = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.40, 6), blackMetalMaterial);
    legFront.position.set(-0.30, 0.20, 0.28); legFront.castShadow = true;
    chairGroup.add(legFront);
    const legFrontR = legFront.clone(); legFrontR.position.x = 0.30; chairGroup.add(legFrontR);
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
    classroomObstacles.push(new THREE.Box3().setFromObject(g));
  };

  for (let row = 0; row < deskRows; row++) {
    for (let col = 0; col < deskCols; col++) {
      createStudentDesk(
        leftStart + col * xSpacing,
        frontStart + row * zSpacing,
        row === 1 && col === 1
      );
    }
  }

  // --- SCATTERED PAPERS ---
  const paperGeom = new THREE.PlaneGeometry(0.35, 0.25);
  const paperMat  = new THREE.MeshBasicMaterial({ color: 0xdcdcdc, side: THREE.DoubleSide });
  for (let i = 0; i < 24; i++) {
    const pm = new THREE.Mesh(paperGeom, paperMat);
    pm.position.set((Math.random() - 0.5) * (CLASSROOM_W - 4), 0.01, (Math.random() - 0.5) * (CLASSROOM_D - 4));
    pm.rotation.x = -Math.PI / 2;
    pm.rotation.z = Math.random() * Math.PI;
    scene.add(pm);
  }

  // --- HALLWAY LOCKERS ---
  const createHallwayLocker = (xPos: number, zPos: number, rotY: number) => {
    const group = new THREE.Group();
    const width = 1.1, height = 3.6, depth = 0.95;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0x1f3c4d, roughness: 0.65, metalness: 0.4 })
    );
    base.position.y = height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xcca43b, metalness: 0.9 })
    );
    handle.position.set(width / 2.5, height / 2, depth / 1.95);
    group.add(handle);
    group.position.set(xPos, 0, zPos);
    group.rotation.y = rotY;
    scene.add(group);
    classroomObstacles.push(new THREE.Box3().setFromObject(group));
  };

  createHallwayLocker(23.5, -12.0, -Math.PI / 2);
  createHallwayLocker(23.5,  -9.5, -Math.PI / 2);
  createHallwayLocker(23.5,  -7.0, -Math.PI / 2);
  createHallwayLocker(23.5,   7.0, -Math.PI / 2);
  createHallwayLocker(23.5,   9.5, -Math.PI / 2);
  createHallwayLocker(23.5,  12.0, -Math.PI / 2);
  createHallwayLocker(14.5, -14.0,  Math.PI / 2);
  createHallwayLocker(14.5,  14.0,  Math.PI / 2);

  return classroomObstacles;
};
