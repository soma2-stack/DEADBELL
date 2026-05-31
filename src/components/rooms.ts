import * as THREE from 'three';

const WALL_H           = 4.5;
const HALLWAY_X_CENTER = 18;
const HALLWAY_D        = 50;
const DOOR_OPENING     = 4.0;

const CLA_W = 28; const CLA_D = 24;
const CLA_CX = HALLWAY_X_CENTER;
const CLA_CZ = -(HALLWAY_D / 2) - CLA_D / 2;  // -37

const CLB_W = 28; const CLB_D = 24;
const CLB_CX = HALLWAY_X_CENTER;
const CLB_CZ =  (HALLWAY_D / 2) + CLB_D / 2;  //  +37

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

// NO castShadow on any point/spot light — only the one dirLight in mapBuilder casts shadows
function addLight(scene: THREE.Scene, x: number, y: number, z: number, color: number, power: number) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 0.3),
    new THREE.MeshBasicMaterial({ color }),
  );
  glass.position.set(0, -0.15, 0);
  g.add(glass);
  const casing = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.15, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 }),
  );
  casing.position.set(0, -0.075, 0);
  g.add(casing);
  const light = new THREE.PointLight(color, power, 30);
  light.decay = 2.0;
  light.position.set(0, -0.3, 0);
  // castShadow intentionally OFF
  g.add(light);
  g.position.set(x, y, z);
  scene.add(g);
}

function addWall(scene: THREE.Scene, mat: THREE.MeshStandardMaterial, w: number, h: number, d: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

function createDesk(
  scene: THREE.Scene,
  wood: THREE.MeshStandardMaterial,
  metal: THREE.MeshStandardMaterial,
  obstacles: THREE.Box3[],
  px: number, pz: number, tipped = false,
) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), wood); top.position.y = 0.72; top.castShadow = true; g.add(top);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), metal); frame.position.y = 0.63; g.add(frame);
  const legG = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 6);
  [[-0.68,-0.36],[0.68,-0.36],[-0.68,0.36],[0.68,0.36]].forEach(([lx,lz]) => {
    const l = new THREE.Mesh(legG, metal); l.position.set(lx, 0.34, lz); l.castShadow = true; g.add(l);
  });
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68,0.04,0.68), wood); seat.position.y=0.42; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.68,0.38,0.04), wood); back.position.set(0,0.68,-0.30); chair.add(back);
  const tG = new THREE.CylinderGeometry(0.016,0.016,0.88,6);
  const bt1 = new THREE.Mesh(tG,metal); bt1.position.set(-0.30,0.44,-0.30); chair.add(bt1);
  const bt2 = bt1.clone(); bt2.position.x=0.30; chair.add(bt2);
  const fG = new THREE.CylinderGeometry(0.016,0.016,0.40,6);
  const fl1 = new THREE.Mesh(fG,metal); fl1.position.set(-0.30,0.20,0.28); chair.add(fl1);
  const fl2 = fl1.clone(); fl2.position.x=0.30; chair.add(fl2);
  chair.rotation.y=Math.PI; chair.position.set(0,0,0.98); g.add(chair);
  if (tipped) { g.rotation.z=Math.PI/2.3; g.rotation.x=0.3; g.position.set(px,0.25,pz); }
  else g.position.set(px,0,pz);
  scene.add(g);
  obstacles.push(new THREE.Box3().setFromObject(g));
}

function makePoster(lines: string[], bg: string, fg: string, w=1.6, h=1.1): THREE.Mesh {
  const c = document.createElement('canvas'); c.width=512; c.height=352;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle=bg; ctx.fillRect(0,0,512,352);
  ctx.fillStyle=fg; ctx.font='bold 36px "Courier New"'; ctx.textAlign='center';
  lines.forEach((l,i)=>ctx.fillText(l,256,60+i*52));
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
}

// ─── CLASSROOM A — Science Lab (z ≈ -37) ─────────────────────────────────────
export function buildClassroomA(deps: RoomDeps) {
  const cx=CLA_CX, cz=CLA_CZ, hw=CLA_W/2, hd=CLA_D/2;
  const { scene, wallMaterial: wm, floorMaterial: fm, ceilingMaterial: cm,
          woodMaterial: wood, blackMetalMaterial: metal, chalkboardMaterial: chalk, obstacles } = deps;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CLA_W,CLA_D), fm); floor.rotation.x=-Math.PI/2; floor.position.set(cx,0,cz); floor.receiveShadow=true; scene.add(floor);
  const ceil  = new THREE.Mesh(new THREE.PlaneGeometry(CLA_W,CLA_D), cm); ceil.rotation.x=Math.PI/2;  ceil.position.set(cx,WALL_H,cz); scene.add(ceil);

  addWall(scene,wm, CLA_W,WALL_H,0.5, cx, WALL_H/2, cz-hd);  // north
  addWall(scene,wm, 0.5,WALL_H,CLA_D, cx-hw, WALL_H/2, cz);  // west
  addWall(scene,wm, 0.5,WALL_H,CLA_D, cx+hw, WALL_H/2, cz);  // east
  const sL=(CLA_W-DOOR_OPENING)/2;
  addWall(scene,wm, sL,WALL_H,0.5, cx-DOOR_OPENING/2-sL/2, WALL_H/2, cz+hd); // south left
  addWall(scene,wm, sL,WALL_H,0.5, cx+DOOR_OPENING/2+sL/2, WALL_H/2, cz+hd); // south right

  // Chalkboard
  const cbf = new THREE.Mesh(new THREE.BoxGeometry(12,2.2,0.15), metal); cbf.position.set(cx,2.1,cz-hd+0.12); scene.add(cbf);
  const cbp = new THREE.Mesh(new THREE.BoxGeometry(11.6,1.9,0.05), chalk); cbp.position.set(cx,2.1,cz-hd+0.2); cbp.receiveShadow=true; scene.add(cbp);

  // Teacher desk
  const td = new THREE.Group();
  const tdT = new THREE.Mesh(new THREE.BoxGeometry(3.5,0.1,1.6),wood); tdT.position.y=0.95; tdT.castShadow=true; td.add(tdT);
  const tdB = new THREE.Mesh(new THREE.BoxGeometry(3.1,0.9,1.3),metal); tdB.position.y=0.45; tdB.castShadow=true; td.add(tdB);
  const lScr = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.28,0.02),metal); lScr.position.set(-0.6,1.15,-0.13); lScr.rotation.x=-0.28; td.add(lScr);
  const lGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.24), new THREE.MeshBasicMaterial({color:0x22d3ee,side:THREE.DoubleSide})); lGlow.position.set(-0.6,1.15,-0.115); lGlow.rotation.x=-0.28; td.add(lGlow);
  td.position.set(cx,0,cz-hd+4.5); scene.add(td);
  obstacles.push(new THREE.Box3().setFromObject(td));

  // Student desks
  const cols=[-5.5,-1.8,1.8,5.5], rows=[-1.0,3.2,7.2];
  cols.forEach((dx,ci)=>rows.forEach((dz,ri)=>createDesk(scene,wood,metal,obstacles, cx+dx, cz-hd+8.5+dz, ri===1&&ci===2)));

  // Posters
  const p1=makePoster(['PERIODIC','TABLE','OF ELEMENTS'],'#0f172a','#38bdf8'); p1.position.set(cx-hw+0.06,2.8,cz-3); p1.rotation.y=Math.PI/2; scene.add(p1);
  const p2=makePoster(['HUMAN','ANATOMY'],'#1a0a00','#fb923c'); p2.position.set(cx-hw+0.06,2.8,cz+3); p2.rotation.y=Math.PI/2; scene.add(p2);

  // Papers
  const pMat=new THREE.MeshBasicMaterial({color:0xdcdcdc,side:THREE.DoubleSide}); const pGeo=new THREE.PlaneGeometry(0.35,0.25);
  for(let i=0;i<24;i++){const pm=new THREE.Mesh(pGeo,pMat); pm.position.set(cx+(Math.random()-0.5)*(CLA_W-4),0.01,cz+(Math.random()-0.5)*(CLA_D-4)); pm.rotation.x=-Math.PI/2; pm.rotation.z=Math.random()*Math.PI; scene.add(pm);}

  // Lights — no shadows
  addLight(scene, cx-7,WALL_H,cz-5, 0xd4f5e0,3.2);
  addLight(scene, cx+7,WALL_H,cz-5, 0xe0f5d4,3.3);
  addLight(scene, cx-7,WALL_H,cz+5, 0xfef3c7,2.7);
  addLight(scene, cx+7,WALL_H,cz+5, 0xfff7ed,2.8);
}

// ─── CLASSROOM B — Abandoned (z ≈ +37) ───────────────────────────────────────
export function buildClassroomB(deps: RoomDeps) {
  const cx=CLB_CX, cz=CLB_CZ, hw=CLB_W/2, hd=CLB_D/2;
  const { scene, wallMaterial: wm, floorMaterial: fm, ceilingMaterial: cm,
          woodMaterial: wood, blackMetalMaterial: metal, chalkboardMaterial: chalk, obstacles } = deps;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CLB_W,CLB_D), fm); floor.rotation.x=-Math.PI/2; floor.position.set(cx,0,cz); floor.receiveShadow=true; scene.add(floor);
  const ceil  = new THREE.Mesh(new THREE.PlaneGeometry(CLB_W,CLB_D), cm); ceil.rotation.x=Math.PI/2;  ceil.position.set(cx,WALL_H,cz); scene.add(ceil);

  addWall(scene,wm, CLB_W,WALL_H,0.5, cx, WALL_H/2, cz+hd);  // south
  addWall(scene,wm, 0.5,WALL_H,CLB_D, cx-hw, WALL_H/2, cz);  // west
  addWall(scene,wm, 0.5,WALL_H,CLB_D, cx+hw, WALL_H/2, cz);  // east
  const sL=(CLB_W-DOOR_OPENING)/2;
  addWall(scene,wm, sL,WALL_H,0.5, cx-DOOR_OPENING/2-sL/2, WALL_H/2, cz-hd); // north left
  addWall(scene,wm, sL,WALL_H,0.5, cx+DOOR_OPENING/2+sL/2, WALL_H/2, cz-hd); // north right

  // Chalkboard
  const cbf = new THREE.Mesh(new THREE.BoxGeometry(12,2.2,0.15), metal); cbf.position.set(cx,2.1,cz+hd-0.12); cbf.rotation.y=Math.PI; scene.add(cbf);
  const cbp = new THREE.Mesh(new THREE.BoxGeometry(11.6,1.9,0.05), chalk); cbp.position.set(cx,2.1,cz+hd-0.2); cbp.rotation.y=Math.PI; cbp.receiveShadow=true; scene.add(cbp);

  // Teacher desk
  const td = new THREE.Group();
  const tdT = new THREE.Mesh(new THREE.BoxGeometry(3.5,0.1,1.6),wood); tdT.position.y=0.95; tdT.castShadow=true; td.add(tdT);
  const tdB = new THREE.Mesh(new THREE.BoxGeometry(3.1,0.9,1.3),metal); tdB.position.y=0.45; tdB.castShadow=true; td.add(tdB);
  for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.004,0.26),new THREE.MeshStandardMaterial({color:0xd4cbb0,roughness:0.9})); p.position.set(0.4+i*0.015,1.0+i*0.005,(Math.random()-0.5)*0.2); p.rotation.y=(Math.random()-0.5)*0.4; td.add(p);}
  td.position.set(cx,0,cz+hd-4.5); scene.add(td);
  obstacles.push(new THREE.Box3().setFromObject(td));

  // Student desks — chaotic layout
  const xSp=4.5, zSp=4.2, xStart=cx-((4-1)*xSp)/2, zStart=cz-hd+5.5;
  for(let row=0;row<3;row++){
    const shift=row===0?0.6:row===2?-0.8:0;
    for(let col=0;col<4;col++){
      createDesk(scene,wood,metal,obstacles, xStart+col*xSp+shift, zStart+row*zSp, (row===0&&col===3)||(row===2&&col===0));
    }
  }

  // Posters
  const bp=makePoster(['HOMEWORK DUE','MONDAY','-- MISSING --'],'#2d1a00','#fbbf24',2.4,1.6); bp.position.set(cx+hw-0.06,2.6,cz); bp.rotation.y=-Math.PI/2; scene.add(bp);
  const ep=makePoster(['EMERGENCY','EVACUATION','ROUTE →'],'#3b0000','#ef4444'); ep.position.set(cx+hw-0.06,2.6,cz+5); ep.rotation.y=-Math.PI/2; scene.add(ep);

  // Books on floor
  const bColors=[0x8b1a1a,0x1a3c8b,0x1a6b1a,0x6b5e1a,0x4a1a6b];
  for(let i=0;i<18;i++){const bk=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.06,0.30),new THREE.MeshStandardMaterial({color:bColors[i%5],roughness:0.85})); bk.position.set(cx+(Math.random()-0.5)*(CLB_W-4),0.03,cz+(Math.random()-0.5)*(CLB_D-4)); bk.rotation.y=Math.random()*Math.PI; bk.castShadow=true; scene.add(bk);}

  // Papers
  const pMat=new THREE.MeshBasicMaterial({color:0xdcdcdc,side:THREE.DoubleSide}); const pGeo=new THREE.PlaneGeometry(0.35,0.25);
  for(let i=0;i<30;i++){const pm=new THREE.Mesh(pGeo,pMat); pm.position.set(cx+(Math.random()-0.5)*(CLB_W-4),0.01,cz+(Math.random()-0.5)*(CLB_D-4)); pm.rotation.x=-Math.PI/2; pm.rotation.z=Math.random()*Math.PI; scene.add(pm);}

  // Lights — no shadows
  addLight(scene, cx-7,WALL_H,cz-5, 0xffecd2,3.4);
  addLight(scene, cx+7,WALL_H,cz-5, 0xfff7ed,3.5);
  addLight(scene, cx-7,WALL_H,cz+5, 0xfef3c7,2.1);
  addLight(scene, cx+7,WALL_H,cz+5, 0xfff7ed,1.8);
}
