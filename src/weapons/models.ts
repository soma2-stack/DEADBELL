import * as THREE from 'three';

export interface WeaponDeps {
  skinMaterial: THREE.Material;
  watchStrapsMat: THREE.Material;
  watchBezelMat: THREE.Material;
  watchGlassMat: THREE.Material;
  sleeveMaterial: THREE.Material;
  woodTex: THREE.Texture;
  loaded3DModels: { pistol?: THREE.Group | null; shotgun?: THREE.Group | null };
}

// ─── RELOAD ANIMATION STATE ───────────────────────────────────────────────────
export interface ReloadAnimState {
  active: boolean;
  time: number;
  duration: number;
  weaponId: 'pistol' | 'shotgun';
  // named parts that animate
  magazine?: THREE.Object3D | null;
  slide?: THREE.Object3D | null;
  pump?: THREE.Object3D | null;
  breachGroup?: THREE.Object3D | null;
}

// Call this every frame. Returns true while animation is running.
export function tickReloadAnimation(
  state: ReloadAnimState,
  weaponGroup: THREE.Group,
  delta: number
): boolean {
  if (!state.active) return false;
  state.time += delta;
  const t = Math.min(state.time / state.duration, 1.0);

  if (state.weaponId === 'pistol') {
    // Phase 1: mag drops (0–0.35) → Phase 2: new mag seated (0.35–0.65) → Phase 3: rack slide (0.65–1.0)
    if (state.magazine) {
      if (t < 0.35) {
        const drop = t / 0.35;
        state.magazine.position.y = -drop * 0.18;
        state.magazine.rotation.x = drop * 0.3;
      } else if (t < 0.65) {
        const seat = (t - 0.35) / 0.30;
        state.magazine.position.y = -0.18 + seat * 0.18;
        state.magazine.rotation.x = 0.3 - seat * 0.3;
      } else {
        state.magazine.position.y = 0;
        state.magazine.rotation.x = 0;
      }
    }
    if (state.slide) {
      if (t >= 0.62 && t < 0.80) {
        const rack = (t - 0.62) / 0.18;
        state.slide.position.z = rack * 0.05;
      } else if (t >= 0.80 && t < 0.95) {
        const snap = (t - 0.80) / 0.15;
        state.slide.position.z = 0.05 - snap * 0.05;
      } else if (t >= 0.95) {
        state.slide.position.z = 0;
      }
    }
  } else {
    // Shotgun: Phase 1: break open (0–0.30) → Phase 2: eject/insert shells (0.30–0.70) → Phase 3: snap shut (0.70–1.0)
    if (state.breachGroup) {
      if (t < 0.30) {
        const open = t / 0.30;
        state.breachGroup.rotation.x = open * 0.55;
      } else if (t < 0.70) {
        state.breachGroup.rotation.x = 0.55;
      } else {
        const close = (t - 0.70) / 0.30;
        state.breachGroup.rotation.x = 0.55 - close * 0.55;
      }
    }
    if (state.pump) {
      if (t >= 0.68 && t < 0.82) {
        const pull = (t - 0.68) / 0.14;
        state.pump.position.z = pull * 0.07;
      } else if (t >= 0.82 && t < 0.92) {
        const push = (t - 0.82) / 0.10;
        state.pump.position.z = 0.07 - push * 0.07;
      } else if (t >= 0.92) {
        state.pump.position.z = 0;
      }
    }
  }

  if (t >= 1.0) {
    state.active = false;
    state.time = 0;
    return false;
  }
  return true;
}

// ─── PROCEDURAL HAND ──────────────────────────────────────────────────────────
export const buildProceduralGripHand = (
  isLeft: boolean,
  weaponType: 'pistol' | 'shotgun',
  deps: WeaponDeps
) => {
  const handGroup = new THREE.Group();
  const s = deps.skinMaterial;

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.044), s);
  palm.castShadow = true;
  handGroup.add(palm);

  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.024), s);
  wrist.position.set(0, -0.01, -0.022);
  handGroup.add(wrist);

  for (let f = 0; f < 5; f++) {
    const fg = new THREE.Group();
    const fy = (f - 2) * 0.0072;
    let fl = f === 0 ? 0.016 : f === 4 ? 0.019 : 0.025;

    const k = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.007, fl / 2), s);
    k.castShadow = true;
    k.position.set(isLeft ? -0.014 : 0.014, fy, 0.015);
    fg.add(k);

    const d = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.006, fl / 2.2), s);
    d.castShadow = true;
    d.position.set(k.position.x + (isLeft ? -0.006 : 0.006), fy, k.position.z + 0.01);
    fg.add(d);

    if (weaponType === 'pistol') {
      if (f === 0) { k.rotation.set(-0.25, isLeft ? 0.35 : -0.35, 0.1); d.rotation.set(-0.15, isLeft ? 0.5 : -0.5, 0); }
      else if (f === 1) { k.rotation.set(0.12, isLeft ? -0.45 : 0.45, 0.15); d.rotation.set(0.08, isLeft ? -0.75 : 0.75, 0.1); }
      else { k.rotation.set(0.08, isLeft ? -0.85 : 0.85, 0.05); d.rotation.set(0.04, isLeft ? -1.25 : 1.25, 0); }
    } else {
      if (f === 0) { k.rotation.set(-0.35, isLeft ? 0.15 : -0.15, -0.08); d.rotation.set(-0.2, isLeft ? 0.25 : -0.25, -0.05); }
      else { k.rotation.set(0.38, isLeft ? -0.82 : 0.82, -0.05); d.rotation.set(0.24, isLeft ? -1.35 : 1.35, -0.02); }
    }
    handGroup.add(fg);
  }

  if (isLeft) {
    const wg = new THREE.Group();
    wg.position.set(0, -0.012, -0.022);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.022, 0.015), deps.watchStrapsMat);
    wg.add(strap);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8), deps.watchBezelMat);
    bezel.position.set(0, 0.012, 0); bezel.rotation.x = Math.PI / 2;
    wg.add(bezel);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.013, 8), deps.watchGlassMat);
    glass.position.set(0, 0.0125, 0); glass.rotation.x = Math.PI / 2;
    wg.add(glass);
    handGroup.add(wg);
  }
  return handGroup;
};

// ─── PISTOL (Glock-style) ─────────────────────────────────────────────────────
export const buildPistolGroup = (deps: WeaponDeps): THREE.Group => {
  const group = new THREE.Group();

  if (deps.loaded3DModels.pistol) {
    const c = deps.loaded3DModels.pistol.clone();
    c.position.set(0.12, -0.15, -0.45);
    group.add(c);
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), deps.sleeveMaterial);
    rArm.position.set(0.14, -0.25, -0.3); rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
    group.add(rArm);
    const rHand = buildProceduralGripHand(false, 'pistol', deps);
    rHand.position.set(0.12, -0.21, -0.42); rHand.rotation.set(0.25, 0, 0);
    group.add(rHand);
    return group;
  }

  const steelMat   = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.28, metalness: 0.92 });
  const darkMat    = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.45, metalness: 0.90 });
  const polymerMat = new THREE.MeshStandardMaterial({ color: 0x2e1e0e, roughness: 0.74, metalness: 0.05 });
  const chromeMat  = new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.10, metalness: 0.96 });
  const tritMat    = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const railMat    = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.35, metalness: 0.88 });

  // ── Slide (animatable — exposed as named child) ──
  const slideGroup = new THREE.Group();
  slideGroup.name = 'pistol_slide';

  const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.040, 0.245), steelMat);
  slideBody.position.set(0, 0, 0);
  slideBody.castShadow = true;
  slideGroup.add(slideBody);

  // Slide serrations (back)
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.0025), darkMat);
    s.position.z = 0.04 + i * 0.0055;
    slideGroup.add(s);
  }

  // Ejection port
  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.048), chromeMat);
  ejPort.position.set(0.002, 0.012, -0.032);
  slideGroup.add(ejPort);

  // Front sight
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.008), darkMat);
  sightF.position.set(0, 0.024, -0.114);
  slideGroup.add(sightF);
  const dotF = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), tritMat);
  dotF.position.set(0, 0.027, -0.112);
  slideGroup.add(dotF);

  // Rear sight
  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.010, 0.008), darkMat);
  sightR.position.set(0, 0.024, 0.095);
  slideGroup.add(sightR);
  const dotRL = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), tritMat);
  dotRL.position.set(-0.006, 0.027, 0.093);
  slideGroup.add(dotRL);
  const dotRR = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), tritMat);
  dotRR.position.set(0.006, 0.027, 0.093);
  slideGroup.add(dotRR);

  // Barrel (peeking out muzzle)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.062, 10), chromeMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.002, -0.148);
  slideGroup.add(barrel);

  // Muzzle crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.010, 0.006, 10), darkMat);
  crown.rotation.x = Math.PI / 2;
  crown.position.set(0, -0.002, -0.176);
  slideGroup.add(crown);

  slideGroup.position.set(0.12, -0.118, -0.44);
  group.add(slideGroup);

  // ── Frame ──
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.036, 0.205), darkMat);
  frame.position.set(0.12, -0.158, -0.445);
  frame.castShadow = true;
  group.add(frame);

  // Picatinny rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.09), railMat);
  rail.position.set(0.12, -0.178, -0.50);
  group.add(rail);
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.009, 0.004), darkMat);
    slot.position.set(0.12, -0.178, -0.47 - i * 0.012);
    group.add(slot);
  }

  // ── Magazine (animatable) ──
  const magGroup = new THREE.Group();
  magGroup.name = 'pistol_mag';
  const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.090, 0.018), darkMat);
  magBody.castShadow = true;
  magGroup.add(magBody);
  const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.022), polymerMat);
  magFloor.position.y = -0.048;
  magGroup.add(magFloor);
  magGroup.position.set(0.12, -0.218, -0.428);
  magGroup.rotation.x = 0.25;
  group.add(magGroup);

  // ── Grip panels ──
  const gripMain = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.108, 0.042), darkMat);
  gripMain.position.set(0.12, -0.222, -0.422); gripMain.rotation.x = 0.25;
  group.add(gripMain);
  const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.092, 0.036), polymerMat);
  gripL.position.set(0.102, -0.212, -0.422); gripL.rotation.x = 0.25;
  group.add(gripL);
  const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.092, 0.036), polymerMat);
  gripR.position.set(0.138, -0.212, -0.422); gripR.rotation.x = 0.25;
  group.add(gripR);

  // Grip texture bumps
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), polymerMat);
      bump.scale.set(1.0, 0.5, 1.0);
      bump.position.set(0.103 - c * 0.001, -0.195 - r * 0.014, -0.41 + r * 0.003);
      group.add(bump);
    }
  }

  // ── Trigger guard + trigger ──
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.030, 0.042), darkMat);
  guard.position.set(0.12, -0.178, -0.472);
  group.add(guard);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.019, 0.006), chromeMat);
  trigger.position.set(0.12, -0.176, -0.470); trigger.rotation.x = -0.2;
  group.add(trigger);

  // Thumb safety
  const safety = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.018), darkMat);
  safety.position.set(0.103, -0.152, -0.412);
  group.add(safety);

  // Slide release lever
  const release = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.024), steelMat);
  release.position.set(0.104, -0.148, -0.448);
  group.add(release);

  // ── Arms ──
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.28), deps.sleeveMaterial);
  rArm.position.set(0.14, -0.25, -0.30); rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
  rArm.castShadow = true;
  group.add(rArm);
  const rHand = buildProceduralGripHand(false, 'pistol', deps);
  rHand.position.set(0.12, -0.21, -0.42); rHand.rotation.set(0.25, 0, 0);
  group.add(rHand);

  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25), deps.sleeveMaterial);
  lArm.position.set(0.02, -0.26, -0.35); lArm.rotation.set(Math.PI / 4, Math.PI / 6, 0);
  lArm.castShadow = true;
  group.add(lArm);
  const lHand = buildProceduralGripHand(true, 'pistol', deps);
  lHand.position.set(0.09, -0.21, -0.42); lHand.rotation.set(0.15, -0.25, 0);
  group.add(lHand);

  return group;
};

// ─── SHOTGUN (Break-action over/under) ───────────────────────────────────────
export const buildShotgunGroup = (deps: WeaponDeps): THREE.Group => {
  const group = new THREE.Group();

  if (deps.loaded3DModels.shotgun) {
    const c = deps.loaded3DModels.shotgun.clone();
    c.position.set(0.12, -0.16, -0.52); c.scale.set(1.1, 1.1, 1.1);
    group.add(c);
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), deps.sleeveMaterial);
    rArm.position.set(0.16, -0.24, -0.2); rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
    group.add(rArm);
    const rHand = buildProceduralGripHand(false, 'shotgun', deps);
    rHand.position.set(0.12, -0.18, -0.32); rHand.rotation.set(-0.15, 0.12, 0);
    group.add(rHand);
    return group;
  }

  const steelMat   = new THREE.MeshStandardMaterial({ color: 0x28292e, roughness: 0.30, metalness: 0.90 });
  const darkMat    = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.48, metalness: 0.90 });
  const chromeMat  = new THREE.MeshStandardMaterial({ color: 0xcdd1d8, roughness: 0.10, metalness: 0.96 });
  const brassMat   = new THREE.MeshStandardMaterial({ color: 0xc9820a, roughness: 0.20, metalness: 0.86 });
  const walnutMat  = new THREE.MeshStandardMaterial({ map: deps.woodTex, color: 0x7a3e18, roughness: 0.44, metalness: 0.04 });
  const redShellMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65, metalness: 0.05 });
  const brassHeadMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.15, metalness: 0.90 });

  // ── Breach group (animatable — rotates open on reload) ──
  const breachGroup = new THREE.Group();
  breachGroup.name = 'shotgun_breach';

  // Double barrels (over/under)
  const bTop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.62, 12), steelMat);
  bTop.rotation.x = Math.PI / 2; bTop.position.set(0.12, -0.118, -0.565);
  bTop.castShadow = true;
  breachGroup.add(bTop);
  const bBot = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.62, 12), steelMat);
  bBot.rotation.x = Math.PI / 2; bBot.position.set(0.12, -0.142, -0.565);
  bBot.castShadow = true;
  breachGroup.add(bBot);

  // Muzzle end caps
  for (const [y, z] of [[-0.118, -0.872], [-0.142, -0.872]] as [number,number][]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 12), darkMat);
    cap.rotation.x = Math.PI / 2; cap.position.set(0.12, y, z);
    breachGroup.add(cap);
  }

  // Barrel rib (top)
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.60), darkMat);
  rib.position.set(0.12, -0.103, -0.565);
  breachGroup.add(rib);

  // Brass bead sight
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), brassMat);
  bead.position.set(0.12, -0.097, -0.856);
  breachGroup.add(bead);

  // Shell tubes visible at breach (before close)
  for (const [y, label] of [[-0.118, 'top'], [-0.142, 'bot']] as [number,string][]) {
    const shellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.048, 10), redShellMat);
    shellBody.rotation.x = Math.PI / 2; shellBody.position.set(0.12, y, -0.24);
    breachGroup.add(shellBody);
    const shellHead = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 10), brassHeadMat);
    shellHead.rotation.x = Math.PI / 2; shellHead.position.set(0.12, y, -0.216);
    breachGroup.add(shellHead);
  }

  // Pivot point at hinge
  breachGroup.position.set(0, 0, 0);
  group.add(breachGroup);

  // ── Receiver ──
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.066, 0.165), darkMat);
  receiver.position.set(0.12, -0.138, -0.22);
  receiver.castShadow = true;
  group.add(receiver);

  // Chrome side plates
  const pL = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.050, 0.135), chromeMat);
  pL.position.set(0.093, -0.138, -0.22);
  group.add(pL);
  const pR = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.050, 0.135), chromeMat);
  pR.position.set(0.147, -0.138, -0.22);
  group.add(pR);

  // Decorative engraving strip
  const engrave = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.028, 0.10), brassMat);
  engrave.position.set(0.092, -0.134, -0.215);
  group.add(engrave);

  // Hinge pin
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.056, 10), chromeMat);
  hinge.rotation.z = Math.PI / 2; hinge.position.set(0.12, -0.167, -0.296);
  group.add(hinge);

  // Top lever
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.040), steelMat);
  lever.position.set(0.12, -0.112, -0.158); lever.rotation.x = -0.3;
  group.add(lever);

  // ── Pump forend (animatable) ──
  const pumpGroup = new THREE.Group();
  pumpGroup.name = 'shotgun_pump';
  const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.034, 0.215), walnutMat);
  pumpBody.castShadow = true;
  pumpGroup.add(pumpBody);
  // Pump checkering lines
  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.057, 0.002, 0.002), darkMat);
    line.position.z = -0.08 + i * 0.026;
    pumpGroup.add(line);
  }
  pumpGroup.position.set(0.12, -0.158, -0.425);
  group.add(pumpGroup);

  // ── Pistol grip neck ──
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.050, 0.160), walnutMat);
  neck.position.set(0.12, -0.162, -0.105); neck.rotation.x = -0.1;
  neck.castShadow = true;
  group.add(neck);

  // ── Stock ──
  const stockMain = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.096, 0.225), walnutMat);
  stockMain.position.set(0.12, -0.202, 0.062); stockMain.rotation.x = -0.14;
  stockMain.castShadow = true;
  group.add(stockMain);

  // Stock comb (raised cheekpiece)
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.14), walnutMat);
  comb.position.set(0.12, -0.164, 0.02); comb.rotation.x = -0.1;
  group.add(comb);

  const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.098, 0.014), darkMat);
  buttpad.position.set(0.12, -0.204, 0.170); buttpad.rotation.x = -0.14;
  group.add(buttpad);

  // Buttpad grip lines
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.003, 0.015), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    l.position.set(0.12, -0.185 - i * 0.016, 0.170); l.rotation.x = -0.14;
    group.add(l);
  }

  // ── Trigger group ──
  const tGuard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.026, 0.050), darkMat);
  tGuard.position.set(0.12, -0.180, -0.220);
  group.add(tGuard);
  const tL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.005), chromeMat);
  tL.position.set(0.115, -0.177, -0.222); tL.rotation.x = -0.15;
  group.add(tL);
  const tR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.005), chromeMat);
  tR.position.set(0.125, -0.177, -0.213); tR.rotation.x = -0.15;
  group.add(tR);

  // ── Arms ──
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), deps.sleeveMaterial);
  rArm.position.set(0.16, -0.24, -0.20); rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
  rArm.castShadow = true;
  group.add(rArm);
  const rHand = buildProceduralGripHand(false, 'shotgun', deps);
  rHand.position.set(0.12, -0.18, -0.32); rHand.rotation.set(-0.15, 0.12, 0);
  group.add(rHand);

  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.34), deps.sleeveMaterial);
  lArm.position.set(-0.04, -0.22, -0.44); lArm.rotation.set(Math.PI / 3.4, Math.PI / 10, 0);
  lArm.castShadow = true;
  group.add(lArm);
  const lHand = buildProceduralGripHand(true, 'shotgun', deps);
  lHand.position.set(0.12, -0.15, -0.46); lHand.rotation.set(0.12, -0.18, 0);
  group.add(lHand);

  return group;
};

// ─── PERK MACHINE BUILDERS ────────────────────────────────────────────────────

export interface PerkMachine {
  id: string;
  name: string;
  price: number;
  position: [number, number, number];
  group: THREE.Group;
  purchased: boolean;
  glowLight: THREE.PointLight;
}

/**
 * Tome of Power — grants double damage for 30 seconds.
 * Placed against the back (North) wall of classroom 102.
 */
export const buildTomeOfPowerMachine = (scene: THREE.Scene): PerkMachine => {
  const g = new THREE.Group();

  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.65, metalness: 0.20 });
  const glowPurpleMat = new THREE.MeshBasicMaterial({ color: 0x9333ea });
  const goldMat  = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.20, metalness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.55 });

  // Cabinet body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.85, 0.45), cabinetMat);
  body.position.y = 0.925;
  body.castShadow = true;
  g.add(body);

  // Gold trim edges
  for (const [x, y] of [[-0.355, 0.925], [0.355, 0.925]] as [number,number][]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.85, 0.46), goldMat);
    trim.position.set(x, y, 0);
    g.add(trim);
  }
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.014, 0.46), goldMat);
  topTrim.position.set(0, 1.85, 0);
  g.add(topTrim);

  // Glass panel (glowing purple)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.9, 0.04), glassMat);
  glass.position.set(0, 1.15, 0.24);
  g.add(glass);

  // Tome book icon on glass (raised pentagram-ish shape)
  const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.025), goldMat);
  bookCover.position.set(0, 1.15, 0.265);
  g.add(bookCover);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.027), goldMat);
  spine.position.set(0, 1.15, 0.267);
  g.add(spine);

  // Eye symbol
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), glowPurpleMat);
  eye.position.set(0, 1.22, 0.29);
  eye.scale.set(1.0, 0.55, 0.25);
  g.add(eye);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pupil.position.set(0, 1.22, 0.295);
  g.add(pupil);

  // Coin slot
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.025), goldMat);
  slot.position.set(0.15, 0.72, 0.25);
  g.add(slot);

  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.52), cabinetMat);
  base.position.y = 0.06;
  g.add(base);

  // Runic glow strips (sides)
  for (const x of [-0.38, 0.38]) {
    for (let i = 0; i < 4; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.08), glowPurpleMat);
      rune.position.set(x, 0.5 + i * 0.28, 0.06);
      g.add(rune);
    }
  }

  // Buy sign above
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 128;
  const sc = signCanvas.getContext('2d')!;
  sc.fillStyle = 'rgba(0,0,0,0.88)'; sc.fillRect(0,0,512,128);
  sc.strokeStyle = '#9333ea'; sc.lineWidth = 5; sc.strokeRect(3,3,506,122);
  sc.fillStyle = '#d8b4fe'; sc.font = 'bold 34px Courier New'; sc.textAlign = 'center';
  sc.fillText('TOME OF POWER', 256, 46);
  sc.fillStyle = '#9333ea'; sc.font = 'bold 26px Courier New';
  sc.fillText('Press E — $1500', 256, 95);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true }));
  sign.position.set(0, 2.18, 0.01);
  g.add(sign);

  // Glow point light
  const glow = new THREE.PointLight(0x9333ea, 2.8, 5.5);
  glow.position.set(0, 1.2, 0.5);
  g.add(glow);

  // Place against back wall (North), centred in classroom
  const px = -2.0, pz = -CLASSROOM_D_HALF + 0.35;
  g.position.set(px, 0, pz);
  scene.add(g);

  return { id: 'tome-of-power', name: 'Tome of Power', price: 1500, position: [px, 0.9, pz], group: g, purchased: false, glowLight: glow };
};

/**
 * Fast Hands — reduces reload time by 50%.
 * Placed in the back-left corner of classroom 102.
 */
export const buildFastHandsMachine = (scene: THREE.Scene): PerkMachine => {
  const g = new THREE.Group();

  const cabinetMat  = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, roughness: 0.65, metalness: 0.20 });
  const glowGreenMat = new THREE.MeshBasicMaterial({ color: 0x16a34a });
  const silverMat   = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.22, metalness: 0.88 });
  const glassMat    = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.05, transparent: true, opacity: 0.50 });

  // Cabinet body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.85, 0.45), cabinetMat);
  body.position.y = 0.925;
  body.castShadow = true;
  g.add(body);

  // Silver trim
  for (const x of [-0.355, 0.355]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.85, 0.46), silverMat);
    trim.position.set(x, 0.925, 0);
    g.add(trim);
  }
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.014, 0.46), silverMat);
  topTrim.position.set(0, 1.85, 0);
  g.add(topTrim);

  // Glass panel
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.9, 0.04), glassMat);
  glass.position.set(0, 1.15, 0.24);
  g.add(glass);

  // Hands icon (stylised two-hand silhouette from cylinders)
  const handMat = glowGreenMat;
  for (const [xo, rot] of [[-0.09, -0.25], [0.09, 0.25]] as [number,number][]) {
    const palm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 6), handMat);
    palm.position.set(xo, 1.22, 0.268);
    palm.rotation.z = rot;
    g.add(palm);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.09, 5), handMat);
      finger.position.set(xo + (f - 1.5) * 0.025, 1.31, 0.268);
      g.add(finger);
    }
  }

  // Lightning bolt speed symbol
  const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.10, 3), glowGreenMat);
  bolt.position.set(0, 1.08, 0.272);
  bolt.rotation.z = Math.PI;
  g.add(bolt);

  // Coin slot
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.025), silverMat);
  slot.position.set(0.15, 0.72, 0.25);
  g.add(slot);

  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.52), cabinetMat);
  base.position.y = 0.06;
  g.add(base);

  // Glow strips
  for (const x of [-0.38, 0.38]) {
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.055, 0.07), glowGreenMat);
      strip.position.set(x, 0.48 + i * 0.28, 0.07);
      g.add(strip);
    }
  }

  // Buy sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 128;
  const sc = signCanvas.getContext('2d')!;
  sc.fillStyle = 'rgba(0,0,0,0.88)'; sc.fillRect(0,0,512,128);
  sc.strokeStyle = '#16a34a'; sc.lineWidth = 5; sc.strokeRect(3,3,506,122);
  sc.fillStyle = '#86efac'; sc.font = 'bold 34px Courier New'; sc.textAlign = 'center';
  sc.fillText('FAST HANDS', 256, 46);
  sc.fillStyle = '#16a34a'; sc.font = 'bold 26px Courier New';
  sc.fillText('Press E — $2000', 256, 95);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true }));
  sign.position.set(0, 2.18, 0.01);
  g.add(sign);

  // Glow light
  const glow = new THREE.PointLight(0x16a34a, 2.4, 5.0);
  glow.position.set(0, 1.2, 0.5);
  g.add(glow);

  // Back-left corner of classroom 102
  const px = -CLASSROOM_W_HALF + 1.2;
  const pz = -CLASSROOM_D_HALF + 0.35;
  g.position.set(px, 0, pz);
  // Face inward (+Z direction)
  g.rotation.y = Math.PI;
  scene.add(g);

  return { id: 'fast-hands', name: 'Fast Hands', price: 2000, position: [px, 0.9, pz], group: g, purchased: false, glowLight: glow };
};

// Classroom dimensions (must match GameCanvas.tsx)
const CLASSROOM_W_HALF = 14;
const CLASSROOM_D_HALF = 12;
