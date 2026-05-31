import * as THREE from 'three';

// This interface tells the file exactly what materials to expect from GameCanvas
export interface WeaponDeps {
  skinMaterial: THREE.Material;
  watchStrapsMat: THREE.Material;
  watchBezelMat: THREE.Material;
  watchGlassMat: THREE.Material;
  sleeveMaterial: THREE.Material;
  woodTex: THREE.Texture;
  loaded3DModels: { pistol?: THREE.Group | null, shotgun?: THREE.Group | null };
}

export const buildProceduralGripHand = (isLeft: boolean, weaponType: 'pistol' | 'shotgun', deps: WeaponDeps) => {
  const handGroup = new THREE.Group();

  const palmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.044), deps.skinMaterial);
  palmMesh.castShadow = true;
  handGroup.add(palmMesh);

  const wristMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.024), deps.skinMaterial);
  wristMesh.position.set(0, -0.01, -0.022);
  wristMesh.castShadow = true;
  handGroup.add(wristMesh);

  for (let f = 0; f < 5; f++) {
    const fingerGroup = new THREE.Group();
    const fOffsetY = (f - 2) * 0.0072;
    
    let fingerLength = 0.025;
    if (f === 0) fingerLength = 0.016; 
    if (f === 4) fingerLength = 0.019; 

    const knuckleJoint = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.007, fingerLength / 2), deps.skinMaterial);
    knuckleJoint.castShadow = true;
    knuckleJoint.position.set(isLeft ? -0.014 : 0.014, fOffsetY, 0.015);
    fingerGroup.add(knuckleJoint);

    const distalJoint = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.006, fingerLength / 2.2), deps.skinMaterial);
    distalJoint.castShadow = true;
    distalJoint.position.set(knuckleJoint.position.x + (isLeft ? -0.006 : 0.006), fOffsetY, knuckleJoint.position.z + 0.01);
    fingerGroup.add(distalJoint);

    if (weaponType === 'pistol') {
      if (f === 0) { 
        knuckleJoint.rotation.set(-0.25, isLeft ? 0.35 : -0.35, 0.1);
        distalJoint.rotation.set(-0.15, isLeft ? 0.5 : -0.5, 0);
      } else if (f === 1) { 
        knuckleJoint.rotation.set(0.12, isLeft ? -0.45 : 0.45, 0.15);
        distalJoint.rotation.set(0.08, isLeft ? -0.75 : 0.75, 0.1);
      } else { 
        knuckleJoint.rotation.set(0.08, isLeft ? -0.85 : 0.85, 0.05);
        distalJoint.rotation.set(0.04, isLeft ? -1.25 : 1.25, 0);
      }
    } else { 
      if (f === 0) { 
        knuckleJoint.rotation.set(-0.35, isLeft ? 0.15 : -0.15, -0.08);
        distalJoint.rotation.set(-0.2, isLeft ? 0.25 : -0.25, -0.05);
      } else { 
        knuckleJoint.rotation.set(0.38, isLeft ? -0.82 : 0.82, -0.05);
        distalJoint.rotation.set(0.24, isLeft ? -1.35 : 1.35, -0.02);
      }
    }
    handGroup.add(fingerGroup);
  }

  if (isLeft) {
    const watchGroup = new THREE.Group();
    watchGroup.position.set(0, -0.012, -0.022);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.022, 0.015), deps.watchStrapsMat);
    watchGroup.add(strap);

    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8), deps.watchBezelMat);
    bezel.position.set(0, 0.012, 0);
    bezel.rotation.x = Math.PI / 2;
    watchGroup.add(bezel);

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.013, 8), deps.watchGlassMat);
    glass.position.set(0, 0.0125, 0);
    glass.rotation.x = Math.PI / 2;
    watchGroup.add(glass);

    handGroup.add(watchGroup);
  }

  return handGroup;
};

export const buildPistolGroup = (deps: WeaponDeps): THREE.Group => {
  const group = new THREE.Group();

  if (deps.loaded3DModels.pistol) {
    const customPistol = deps.loaded3DModels.pistol.clone();
    customPistol.position.set(0.12, -0.15, -0.45);
    customPistol.scale.set(1.0, 1.0, 1.0);
    group.add(customPistol);
    
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), deps.sleeveMaterial);
    rArm.position.set(0.14, -0.25, -0.3);
    rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
    group.add(rArm);

    const rHand = buildProceduralGripHand(false, 'pistol', deps);
    rHand.position.set(0.12, -0.21, -0.42);
    rHand.rotation.set(0.25, 0, 0);
    group.add(rHand);
    return group;
  }

  const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.32, metalness: 0.88 }); 
  const gunDarkMetalMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.48, metalness: 0.9 }); 
  const polymerGripMat = new THREE.MeshStandardMaterial({ color: 0x3a2512, roughness: 0.72, metalness: 0.1 }); 
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.12, metalness: 0.95 }); 
  const tritGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e }); 

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.038, 0.24), gunSteelMat);
  slide.position.set(0.12, -0.12, -0.44);
  slide.castShadow = true;
  group.add(slide);

  for (let idx = 0; idx < 5; idx++) {
    const serration = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.02, 0.003), gunDarkMetalMat);
    serration.position.set(0.12, -0.12, -0.36 - idx * 0.006);
    group.add(serration);
  }

  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.045), chromeMat);
  ejPort.position.set(0.125, -0.101, -0.43);
  group.add(ejPort);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.034, 0.20), gunDarkMetalMat);
  frame.position.set(0.12, -0.155, -0.445);
  frame.castShadow = true;
  group.add(frame);

  const innerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 8), chromeMat);
  innerBarrel.rotation.x = Math.PI / 2;
  innerBarrel.position.set(0.12, -0.118, -0.56);
  group.add(innerBarrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.042), gunDarkMetalMat);
  grip.position.set(0.12, -0.22, -0.42);
  grip.rotation.x = 0.25;
  grip.castShadow = true;
  group.add(grip);

  const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.034), polymerGripMat);
  gripL.position.set(0.103, -0.21, -0.42);
  gripL.rotation.x = 0.25;
  group.add(gripL);

  const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.034), polymerGripMat);
  gripR.position.set(0.137, -0.21, -0.42);
  gripR.rotation.x = 0.25;
  group.add(gripR);

  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.04), gunDarkMetalMat);
  trigGuard.position.set(0.12, -0.178, -0.47);
  group.add(trigGuard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.006), chromeMat);
  trigger.position.set(0.12, -0.175, -0.468);
  trigger.rotation.x = -0.2;
  group.add(trigger);

  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.012), gunDarkMetalMat);
  sightF.position.set(0.12, -0.097, -0.55);
  group.add(sightF);
  const dotF = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
  dotF.position.set(0.12, -0.095, -0.548);
  group.add(dotF);

  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.008), gunDarkMetalMat);
  sightR.position.set(0.12, -0.097, -0.34);
  group.add(sightR);
  const dotRL = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
  dotRL.position.set(0.114, -0.095, -0.342);
  group.add(dotRL);
  const dotRR = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
  dotRR.position.set(0.126, -0.095, -0.342);
  group.add(dotRR);

  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), deps.sleeveMaterial);
  rArm.position.set(0.14, -0.25, -0.3);
  rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
  rArm.castShadow = true;
  group.add(rArm);

  const rHand = buildProceduralGripHand(false, 'pistol', deps);
  rHand.position.set(0.12, -0.21, -0.42);
  rHand.rotation.set(0.25, 0, 0);
  group.add(rHand);

  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25), deps.sleeveMaterial);
  lArm.position.set(0.02, -0.26, -0.35);
  lArm.rotation.set(Math.PI / 4, Math.PI / 6, 0);
  lArm.castShadow = true;
  group.add(lArm);

  const lHand = buildProceduralGripHand(true, 'pistol', deps);
  lHand.position.set(0.09, -0.21, -0.42);
  lHand.rotation.set(0.15, -0.25, 0);
  group.add(lHand);

  return group;
};

export const buildShotgunGroup = (deps: WeaponDeps): THREE.Group => {
  const group = new THREE.Group();

  if (deps.loaded3DModels.shotgun) {
    const customShotgun = deps.loaded3DModels.shotgun.clone();
    customShotgun.position.set(0.12, -0.16, -0.52);
    customShotgun.scale.set(1.1, 1.1, 1.1);
    group.add(customShotgun);

    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), deps.sleeveMaterial);
    rArm.position.set(0.16, -0.24, -0.2);
    rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
    group.add(rArm);

    const rHand = buildProceduralGripHand(false, 'shotgun', deps);
    rHand.position.set(0.12, -0.18, -0.32);
    rHand.rotation.set(-0.15, 0.12, 0);
    group.add(rHand);
    return group;
  }

  const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.32, metalness: 0.88 }); 
  const gunDarkMetalMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.48, metalness: 0.9 }); 
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.12, metalness: 0.95 }); 
  const brassBeadMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.22, metalness: 0.85 }); 
  const richWalnutMat = new THREE.MeshStandardMaterial({ map: deps.woodTex, color: 0x8a4f24, roughness: 0.45, metalness: 0.05 }); 

  const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 8), gunSteelMat);
  barrelL.rotation.x = Math.PI / 2;
  barrelL.position.set(0.106, -0.13, -0.56);
  barrelL.castShadow = true;
  group.add(barrelL);

  const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 8), gunSteelMat);
  barrelR.rotation.x = Math.PI / 2;
  barrelR.position.set(0.134, -0.13, -0.56);
  barrelR.castShadow = true;
  group.add(barrelR);

  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.006, 0.58), gunDarkMetalMat);
  rib.position.set(0.12, -0.12, -0.56);
  group.add(rib);

  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), brassBeadMat);
  bead.position.set(0.12, -0.114, -0.83);
  group.add(bead);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.062, 0.16), gunDarkMetalMat);
  receiver.position.set(0.12, -0.14, -0.22);
  receiver.castShadow = true;
  group.add(receiver);

  const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.046, 0.12), chromeMat);
  plateL.position.set(0.094, -0.14, -0.22);
  group.add(plateL);

  const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.046, 0.12), chromeMat);
  plateR.position.set(0.146, -0.14, -0.22);
  group.add(plateR);

  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.046, 8), chromeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0.12, -0.165, -0.28);
  group.add(hinge);

  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.034, 0.22), richWalnutMat);
  pump.position.set(0.12, -0.155, -0.42);
  pump.castShadow = true;
  group.add(pump);

  const woodenButtNeck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.048, 0.16), richWalnutMat);
  woodenButtNeck.position.set(0.12, -0.16, -0.11);
  woodenButtNeck.rotation.x = -0.1;
  woodenButtNeck.castShadow = true;
  group.add(woodenButtNeck);

  const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.094, 0.22), richWalnutMat);
  woodenButt.position.set(0.12, -0.20, 0.06);
  woodenButt.rotation.x = -0.14;
  woodenButt.castShadow = true;
  group.add(woodenButt);

  const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.096, 0.012), gunDarkMetalMat);
  buttPad.position.set(0.12, -0.203, 0.168);
  buttPad.rotation.x = -0.14;
  group.add(buttPad);

  const sgGuard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.048), gunDarkMetalMat);
  sgGuard.position.set(0.12, -0.178, -0.22);
  group.add(sgGuard);

  const triggerL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.005), chromeMat);
  triggerL.position.set(0.116, -0.176, -0.222);
  triggerL.rotation.x = -0.15;
  group.add(triggerL);

  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), deps.sleeveMaterial);
  rArm.position.set(0.16, -0.24, -0.2);
  rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
  rArm.castShadow = true;
  group.add(rArm);

  const rHand = buildProceduralGripHand(false, 'shotgun', deps);
  rHand.position.set(0.12, -0.18, -0.32);
  rHand.rotation.set(-0.15, 0.12, 0);
  group.add(rHand);

  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.34), deps.sleeveMaterial);
  lArm.position.set(-0.04, -0.22, -0.44);
  lArm.rotation.set(Math.PI / 3.4, Math.PI / 10, 0);
  lArm.castShadow = true;
  group.add(lArm);

  const lHand = buildProceduralGripHand(true, 'shotgun', deps);
  lHand.position.set(0.12, -0.15, -0.46); 
  lHand.rotation.set(0.12, -0.18, 0);
  group.add(lHand);

  return group;
};