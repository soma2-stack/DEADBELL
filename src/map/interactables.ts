import * as THREE from 'three';

// 1. Define the paints and variables we need from GameCanvas
export interface InteractableDeps {
  scene: THREE.Scene;
  emissionGreen: THREE.Material;
  blackMetalMaterial: THREE.Material;
  woodMaterial: THREE.Material;
  woodTex: THREE.Texture;
  CLASSROOM_W: number;
}

// 2. The Shotgun Wall Buy
export const addShotgunWallbuy = (deps: InteractableDeps) => {
  const g = new THREE.Group();
  
  const buySign = new THREE.Group();
  const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
  buySign.add(wallSign);
  
  const frameBuy = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.02), deps.emissionGreen);
  frameBuy.position.z = -0.01;
  buySign.add(frameBuy);
  
  buySign.position.set(0, 0.4, 0);
  g.add(buySign);

  const shotgunG = new THREE.Group();
  
  const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), deps.blackMetalMaterial);
  barrelL.rotation.x = Math.PI / 2;
  barrelL.position.set(-0.018, 0.05, -0.1);
  shotgunG.add(barrelL);

  const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), deps.blackMetalMaterial);
  barrelR.rotation.x = Math.PI / 2;
  barrelR.position.set(0.018, 0.05, -0.1);
  shotgunG.add(barrelR);
  
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.25), deps.blackMetalMaterial);
  receiver.position.set(0, 0.05, 0.3);
  shotgunG.add(receiver);

  const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.035, 0.4), deps.woodMaterial);
  pumpHandle.position.set(0, 0.02, 0.0);
  shotgunG.add(pumpHandle);

  const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.45), deps.woodMaterial);
  woodenButt.position.set(0, -0.01, 0.6);
  woodenButt.rotation.x = -0.15;
  shotgunG.add(woodenButt);

  shotgunG.rotation.y = -Math.PI / 2;
  shotgunG.position.set(0, -0.12, 0.15);
  g.add(shotgunG);

  const wallBuyX = -deps.CLASSROOM_W / 2 + 0.28; 
  const wallBuyY = 1.7;
  const wallBuyZ = -1.5;
  
  g.position.set(wallBuyX, wallBuyY, wallBuyZ);
  g.rotation.y = Math.PI / 2; 
  deps.scene.add(g);

  return {
    id: 'wall-shotgun',
    weaponId: 'shotgun',
    position: [wallBuyX + 0.2, wallBuyY, wallBuyZ], 
    rotationY: Math.PI / 2,
    price: 700,
    purchased: false,
    textMesh: g
  };
};

// 3. The Buyable Exit Door
export const buildBuyableDoor = (deps: InteractableDeps) => {
  const g = new THREE.Group();

  const width = 0.25;
  const height = 3.6;
  const dLength = 4.0;

  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, dLength),
    new THREE.MeshStandardMaterial({ map: deps.woodTex, roughness: 0.8, metalness: 0.1 })
  );
  doorMesh.position.y = height / 2;
  doorMesh.castShadow = true;
  g.add(doorMesh);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sc = signCanvas.getContext('2d')!;
  sc.fillStyle = 'rgba(0,0,0,0.85)';
  sc.fillRect(0,0,512,128);
  sc.strokeStyle = '#22c55e';
  sc.lineWidth = 6;
  sc.strokeRect(4,4,504,120);
  sc.fillStyle = '#22c55e';
  sc.font = 'bold 38px Courier New';
  sc.textAlign = 'center';
  sc.fillText('DOOR', 256, 45);
  sc.font = 'bold 28px Courier New';
  sc.fillText('Press E to Open [$1200]', 256, 95);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const buySignOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.75),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true })
  );
  buySignOverlay.position.set(-0.25, 3.2, 0);
  buySignOverlay.rotation.y = -Math.PI / 2; 
  g.add(buySignOverlay);

  const dX = deps.CLASSROOM_W / 2;
  const dY = 0;
  const dZ = 0;

  g.position.set(dX, dY, dZ);
  deps.scene.add(g);

  return {
    id: 'door-classroom-exit',
    price: 1200,
    position: [dX, dY, dZ],
    rotationY: 0,
    width,
    height,
    purchased: false,
    group: g,
    doorMesh,
    sinkOffset: 0
  };
};