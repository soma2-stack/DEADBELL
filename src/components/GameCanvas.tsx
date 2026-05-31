import { generateWornWallTexture, generateConcreteFloorTexture, generateCeilingTexture, generateWoodTexture } from '../map/textures';
import { buildStaticMap } from './mapBuilder';
import { spawnSingleZombie as spawnZombieHelper } from '../entities/zombies';
import { buildPistolGroup, buildShotgunGroup, buildTomeOfPowerMachine, buildFastHandsMachine, tickReloadAnimation, ReloadAnimState, PerkMachine, WeaponDeps } from '../weapons/models';
import { addShotgunWallbuy as _addShotgunWallbuy, buildBuyableDoor as _buildBuyableDoor } from '../map/interactables';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sound } from '../sound';
import { Zombie, Barricade, WallBuy, BuyableDoor, TeammateState, WEAPON_DEFINITIONS, WeaponId } from '../types';

// ✅ New core system imports
import { createPlayer, updatePlayer, getPlayerSpeed } from '../core/playerMovement';
import { CollisionSystem } from '../core/collision';
import { Economy } from '../core/economy';
import { ROOMS, buildRoom } from '../world/rooms';

interface BotTeammate {
  id: string; name: string; color: number; health: number; maxHealth: number;
  points: number; state: 'ALIVE' | 'DOWNED' | 'DEAD'; activeWeapon: 'pistol' | 'shotgun';
  mesh: THREE.Group; lastTargetZombieId: string | null; lastShotTime: number;
  cannotBeSavedTime: number; downedTime: number; revivingTargetId: string | null;
  reviveTimer: number;
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'gameover' | 'paused' | 'loading';
  setGameState: React.Dispatch<React.SetStateAction<'menu' | 'playing' | 'gameover' | 'paused' | 'loading'>>;
  health: number; setHealth: React.Dispatch<React.SetStateAction<number>>;
  points: number; setPoints: React.Dispatch<React.SetStateAction<number>>;
  kills: number;  setKills:  React.Dispatch<React.SetStateAction<number>>;
  currentRound: number; setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
  activeWeaponId: 'pistol' | 'shotgun'; setActiveWeaponId: React.Dispatch<React.SetStateAction<'pistol' | 'shotgun'>>;
  ammoClip: number;    setAmmoClip:    React.Dispatch<React.SetStateAction<number>>;
  ammoReserve: number; setAmmoReserve: React.Dispatch<React.SetStateAction<number>>;
  isADS: boolean; setIsADS: React.Dispatch<React.SetStateAction<boolean>>;
  isReloading: boolean; setIsReloading: React.Dispatch<React.SetStateAction<boolean>>;
  setHitmarker: React.Dispatch<React.SetStateAction<'hit' | 'kill' | null>>;
  setInteractMessage: React.Dispatch<React.SetStateAction<string | null>>;
  addScorePopup: (amount: number, text: string) => void;
  setShowWaveBanner: React.Dispatch<React.SetStateAction<boolean>>;
  isCoop: boolean;
  setTeammates: React.Dispatch<React.SetStateAction<TeammateState[]>>;
  setPlayerReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setTeammateReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setRevivingName: React.Dispatch<React.SetStateAction<string | null>>;
  socket?: WebSocket | null; roomId?: string; roomState?: any; clientId?: string;
  hasFastHands: boolean; setHasFastHands: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState, setGameState,
  health, setHealth,
  points, setPoints,
  kills, setKills,
  currentRound, setCurrentRound,
  activeWeaponId, setActiveWeaponId,
  ammoClip, setAmmoClip,
  ammoReserve, setAmmoReserve,
  isADS, setIsADS,
  isReloading, setIsReloading,
  setHitmarker, setInteractMessage, addScorePopup, setShowWaveBanner,
  isCoop, setTeammates, setPlayerReviveProgress, setTeammateReviveProgress, setRevivingName,
  socket, roomId, roomState, clientId,
  hasFastHands, setHasFastHands,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const weaponsOwnedRef = useRef<string[]>(['pistol']);
  const weaponAmmoRef   = useRef({
    pistol:  { clip: 12, reserve: 60, maxClip: 12, maxReserve: 120 },
    shotgun: { clip: 0,  reserve: 0,  maxClip: 6,  maxReserve: 48  },
  });
  const stateRef = useRef({
    gameState, health, points, kills, currentRound,
    activeWeaponId, ammoClip, ammoReserve, isADS, isReloading,
    mouseSensitivity: 0.002, fov: 75,
    crosshairColor: '#22c55e', damageNumbers: true,
    hasFastHands: false, hasTomeOfPower: false,
  });

  const remotePlayersRef    = useRef<Map<string, any>>(new Map());
  const lastUpdateSentTimeRef = useRef<number>(0);
  const socketRef    = useRef<WebSocket | null>(null);
  const roomStateRef = useRef<any>(null);
  const clientIdRef  = useRef<string>('');

  useEffect(() => { socketRef.current    = socket    || null; }, [socket]);
  useEffect(() => { roomStateRef.current = roomState || null; }, [roomState]);
  useEffect(() => { clientIdRef.current  = clientId  || '';   }, [clientId]);

  useEffect(() => {
    stateRef.current.gameState      = gameState;
    stateRef.current.health         = health;
    stateRef.current.points         = points;
    stateRef.current.kills          = kills;
    stateRef.current.currentRound   = currentRound;
    stateRef.current.activeWeaponId = activeWeaponId;
    stateRef.current.ammoClip       = ammoClip;
    stateRef.current.ammoReserve    = ammoReserve;
    stateRef.current.isADS          = isADS;
    stateRef.current.isReloading    = isReloading;
  }, [gameState, health, points, kills, currentRound, activeWeaponId, ammoClip, ammoReserve, isADS, isReloading]);

  useEffect(() => {
    const handleSettingsUpdate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;
      if (data.controls?.sensitivity) stateRef.current.mouseSensitivity = (data.controls.sensitivity / 10000) * 0.6;
      if (data.graphics?.fov)         stateRef.current.fov = data.graphics.fov;
      if (data.gameplay) {
        stateRef.current.crosshairColor = data.gameplay.crosshairColor ?? '#22c55e';
        stateRef.current.damageNumbers  = data.gameplay.damageNumbers !== false;
      }
    };
    window.addEventListener('settings-update', handleSettingsUpdate);
    const initial = localStorage.getItem('codz_settings');
    if (initial) {
      try {
        const p = JSON.parse(initial);
        if (p.controls?.sensitivity) stateRef.current.mouseSensitivity = (p.controls.sensitivity / 10000) * 0.6;
        if (p.graphics?.fov)         stateRef.current.fov = p.graphics.fov;
        if (p.gameplay) {
          stateRef.current.crosshairColor = p.gameplay.crosshairColor ?? '#22c55e';
          stateRef.current.damageNumbers  = p.gameplay.damageNumbers !== false;
        }
      } catch (_) {}
    }
    return () => window.removeEventListener('settings-update', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const width  = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0f11);
    scene.fog        = new THREE.FogExp2(0x090a0c, 0.026);

    const camera   = new THREE.PerspectiveCamera(stateRef.current.fov, width / height, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled   = true;
    renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    containerRef.current.id = 'fps-canvas-container';
    scene.add(camera);

    // --- GLB LOADER ---
    const loaded3DModels: WeaponDeps['loaded3DModels'] = { pistol: null, shotgun: null };
    const modelLoader = new GLTFLoader();
    modelLoader.load('/models/zombie.glb',  (g) => { g.scene.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } }); (loaded3DModels as any).zombie = g.scene; }, undefined, () => {});
    modelLoader.load('/models/pistol.glb',  (g) => { loaded3DModels.pistol  = g.scene; updateActiveGunModel(stateRef.current.activeWeaponId); }, undefined, () => {});
    modelLoader.load('/models/shotgun.glb', (g) => { loaded3DModels.shotgun = g.scene; if (stateRef.current.activeWeaponId === 'shotgun') updateActiveGunModel('shotgun'); }, undefined, () => {});

    // --- TEXTURES ---
    const wallTex    = generateWornWallTexture();
    const floorTex   = generateConcreteFloorTexture();
    const ceilingTex = generateCeilingTexture();
    const woodTex    = generateWoodTexture();

    // --- MATERIALS ---
    const wallMaterial       = new THREE.MeshStandardMaterial({ map: wallTex,    roughness: 0.95, metalness: 0.05 });
    const floorMaterial      = new THREE.MeshStandardMaterial({ map: floorTex,   roughness: 0.78, metalness: 0.10 });
    const ceilingMaterial    = new THREE.MeshStandardMaterial({ map: ceilingTex, roughness: 0.92, metalness: 0.02 });
    const woodMaterial       = new THREE.MeshStandardMaterial({ map: woodTex,    roughness: 0.75 });
    const blackMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.85 });
    const chalkboardMaterial = new THREE.MeshStandardMaterial({ color: 0x112d1b, roughness: 0.90 });
    const emissionGreen      = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const bloodSplashMat     = new THREE.MeshBasicMaterial({ color: 0x991b1b, transparent: true, opacity: 0.85 });

    const skinMaterial   = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.85 });
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const watchStrapsMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
    const watchBezelMat  = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.2, metalness: 0.9 });
    const watchGlassMat  = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.05, transparent: true, opacity: 0.6 });
    const weaponDeps: WeaponDeps = { skinMaterial, sleeveMaterial, watchStrapsMat, watchBezelMat, watchGlassMat, woodTex, loaded3DModels };

    // --- CONSTANTS ---
    const CLASSROOM_W      = 50;
    const CLASSROOM_D      = 44;
    const WALL_H           = 4.5;
    const HALLWAY_W        = 22;
    const HALLWAY_D        = 10;
    const PLAYER_HEIGHT    = 1.65;
    const GRAVITY          = -22.0;
    const JUMP_FORCE       =  8.5;

    const halogenLights: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[] = [];

    // --- BUILD MAP ---
    // Step 1: Starting classroom legacy geometry (props, lights, walls)
    const classroomObstacles: THREE.Box3[] = buildStaticMap(
      scene,
      { wallMaterial, floorMaterial, ceilingMaterial, woodMaterial, blackMetalMaterial, chalkboardMaterial },
      halogenLights, []
    );

    // Step 2: Build all ROOMS (hallway + classrooms 102/103) from ROOMS data
    // ─── FIXED: material keys now match what buildRoom() expects ────────────
    const collision = new CollisionSystem();
    const roomMaterials: Record<string, THREE.Material> = {
      floor:    floorMaterial,
      wall:     wallMaterial,
      ceiling:  ceilingMaterial,
      wood:     woodMaterial,
      obstacle: blackMetalMaterial,
      board:    chalkboardMaterial,
      locker:   new THREE.MeshStandardMaterial({ color: 0x1f3c4d, roughness: 0.65, metalness: 0.4 }),
      debris:   floorMaterial,
      perk:     new THREE.MeshStandardMaterial({ color: 0x22ffcc, roughness: 0.4, metalness: 0.6 }),
      tome:     new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.5, metalness: 0.3 }),
      chair:    woodMaterial,
    };
    Object.values(ROOMS).forEach(room => {
      buildRoom(room, scene, collision, roomMaterials);
    });

    const economy = new Economy(500, (pts, tx) => {
      setPoints(pts);
      if (tx.type === 'reward') addScorePopup(tx.amount, tx.reason);
    });

    // Player spawns at Starting Classroom center
    const sc = ROOMS.startingClassroom.bounds;
    const playerStart = new THREE.Vector3(
      (sc.minX + sc.maxX) / 2,
      PLAYER_HEIGHT,
      (sc.minZ + sc.maxZ) / 2
    );
    const player = createPlayer(playerStart);

    const checkPlayerCollision = (pos: THREE.Vector3, r: number, h: number) =>
      collision.check(pos, r, h);

    camera.position.copy(player.position);

    // --- PERK MACHINES ---
    const tomePerk:      PerkMachine   = buildTomeOfPowerMachine(scene);
    const fastHandsPerk: PerkMachine   = buildFastHandsMachine(scene);
    const perkMachines:  PerkMachine[] = [tomePerk, fastHandsPerk];

    const barricadeDetails: Barricade[] = [];
    const particleList: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];
    const bulletTracers: { mesh: THREE.Line; age: number; maxAge: number }[] = [];

    // --- SPAWNERS — derived from ROOMS.spawns so they stay in sync ---
    const groundSpawners = Object.values(ROOMS).flatMap(room =>
      room.spawns.map(s => ({ x: s.x, z: s.z, label: room.name }))
    );

    // --- PARTICLES ---
    const triggerGravelEruption = (pos: THREE.Vector3) => {
      const geo  = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const mat  = new THREE.MeshStandardMaterial({ color: 0x221a11, roughness: 0.95 });
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(geo, mat);
        p.position.set(pos.x + (Math.random()-0.5)*1.2, 0.02, pos.z + (Math.random()-0.5)*1.2);
        scene.add(p);
        particleList.push({ mesh: p, vel: new THREE.Vector3((Math.random()-0.5)*1.5, Math.random()*2+1.2, (Math.random()-0.5)*1.5), age: 0, maxAge: 0.6+Math.random()*0.4 });
      }
    };

    const mapBoundingLimits = {
      minX: sc.minX + 0.65, maxX: sc.maxX - 0.65,
      minZ: sc.minZ + 0.65, maxZ: sc.maxZ - 0.65,
      hallMinX: ROOMS.hallway.bounds.minX + 0.5, hallMaxX: ROOMS.hallway.bounds.maxX - 0.5,
      hallMinZ: ROOMS.hallway.bounds.minZ + 0.5, hallMaxZ: ROOMS.hallway.bounds.maxZ - 0.5,
    };

    // --- WALL BUY ---
    const buildShotgunWallBuy = (): WallBuy => {
      const g = new THREE.Group();
      const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
      const buySign  = new THREE.Group(); buySign.add(wallSign);
      const frameBuy = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.02), emissionGreen); frameBuy.position.z = -0.01; buySign.add(frameBuy);
      buySign.position.set(0, 0.4, 0); g.add(buySign);
      const sG = new THREE.Group();
      const bL = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.1,8), blackMetalMaterial); bL.rotation.x=Math.PI/2; bL.position.set(-0.018,0.05,-0.1); sG.add(bL);
      const bR = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.1,8), blackMetalMaterial); bR.rotation.x=Math.PI/2; bR.position.set( 0.018,0.05,-0.1); sG.add(bR);
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.065,0.25), blackMetalMaterial); rec.position.set(0,0.05,0.3); sG.add(rec);
      const ph  = new THREE.Mesh(new THREE.BoxGeometry(0.052,0.035,0.4), woodMaterial); ph.position.set(0,0.02,0.0); sG.add(ph);
      const wb  = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.45), woodMaterial); wb.position.set(0,-0.01,0.6); wb.rotation.x=-0.15; sG.add(wb);
      sG.rotation.y=-Math.PI/2; sG.position.set(0,-0.12,0.15); g.add(sG);
      const wX = sc.minX + 0.28, wY = 1.7, wZ = (sc.minZ + sc.maxZ) / 2 - 1.5;
      g.position.set(wX, wY, wZ); g.rotation.y = Math.PI / 2;
      scene.add(g);
      return { id:'wall-shotgun', weaponId:'pump_shotgun', position:[wX+0.2,wY,wZ], rotationY:Math.PI/2, price:700, purchased:false, textMesh:g };
    };
    const shotgunWallBuy = buildShotgunWallBuy();

    // --- BUYABLE DOOR (starting classroom → hallway) ---
    const buildMainDoor = (): BuyableDoor => {
      const g = new THREE.Group();
      const doorW=0.25, doorH=3.6, doorLen=4.0;
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW,doorH,doorLen), new THREE.MeshStandardMaterial({ map:woodTex, roughness:0.8, metalness:0.1 }));
      doorMesh.position.y=doorH/2; doorMesh.castShadow=true; g.add(doorMesh);
      const sc2=document.createElement('canvas'); sc2.width=512; sc2.height=128;
      const ctx=sc2.getContext('2d')!;
      ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,512,128);
      ctx.strokeStyle='#22c55e'; ctx.lineWidth=6; ctx.strokeRect(4,4,504,120);
      ctx.fillStyle='#22c55e'; ctx.font='bold 38px Courier New'; ctx.textAlign='center';
      ctx.fillText('DOOR',256,45); ctx.font='bold 28px Courier New';
      ctx.fillText('Press E to Open [$750]',256,95);
      const overlay=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.75), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(sc2), side:THREE.DoubleSide, transparent:true }));
      overlay.position.set(-0.25,3.2,0); overlay.rotation.y=-Math.PI/2; g.add(overlay);
      const dX = sc.maxX, dY = 0, dZ = 0;
      g.position.set(dX,dY,dZ); scene.add(g);
      return { id:'door-classroom-exit', price:750, position:[dX,dY,dZ], rotationY:0, width:doorW, height:doorH, purchased:false, group:g, doorMesh, sinkOffset:0 };
    };
    const classroomExitDoor = buildMainDoor();
    let doorBlockerBox = new THREE.Box3().setFromObject(classroomExitDoor.doorMesh!);

    // --- TEAMMATE MESH ---
    const designTeammateMesh = (clothesColor: number): THREE.Group => {
      const g=new THREE.Group();
      const shirtMat=new THREE.MeshStandardMaterial({color:clothesColor,roughness:0.75});
      const jeansMat=new THREE.MeshStandardMaterial({color:0x1d2c3d,roughness:0.8});
      const hairMat =new THREE.MeshStandardMaterial({color:0x1c1917,roughness:0.95});
      const torso=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.75,0.32),shirtMat); torso.position.y=1.05; torso.castShadow=true; g.add(torso);
      const head =new THREE.Mesh(new THREE.BoxGeometry(0.32,0.32,0.32),skinMaterial); head.position.y=1.55; head.castShadow=true; g.add(head);
      const hair =new THREE.Mesh(new THREE.BoxGeometry(0.34,0.10,0.34),hairMat); hair.position.set(0,1.7,0.02); g.add(hair);
      const armL =new THREE.Mesh(new THREE.BoxGeometry(0.13,0.62,0.13),skinMaterial); armL.position.set(-0.35,1.1,0.05); armL.castShadow=true; g.add(armL);
      const armR =new THREE.Mesh(new THREE.BoxGeometry(0.13,0.62,0.13),skinMaterial); armR.position.set(0.35,1.1,0.15); armR.rotation.x=-Math.PI/3; armR.castShadow=true; g.add(armR);
      const legs =new THREE.Mesh(new THREE.BoxGeometry(0.50,0.65,0.26),jeansMat); legs.position.y=0.355; legs.castShadow=true; g.add(legs);
      const gunMat=new THREE.MeshStandardMaterial({color:0x242424,roughness:0.5});
      const gunBox=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.05,0.32),gunMat); gunBox.position.set(0.35,1.1,0.45); gunBox.rotation.x=-Math.PI/18; g.add(gunBox);
      return g;
    };

    const activeTeammatesList: any[] = [];
    const teammatesGroup = new THREE.Group();
    scene.add(teammatesGroup);

    // --- ZOMBIES ---
    const activeZombiesList: Zombie[] = [];
    const zombieGroup = new THREE.Group();
    scene.add(zombieGroup);

    const spawnSingleZombie = (spawnerIdx: number) => {
      spawnZombieHelper(spawnerIdx, groundSpawners, zombieGroup, activeZombiesList, camera.position, stateRef.current.currentRound, (loaded3DModels as any).zombie ?? null);
    };

    let roundTransitionActive = false;
    let roundKillsRemaining   = 0;
    let zombiesLeftToSpawn    = 0;
    let spawnTimer            = 0;

    const startNextRoundWave = () => {
      if (roundTransitionActive) return;
      roundTransitionActive = true;
      setShowWaveBanner(true);
      sound.playWaveStart();
      setTimeout(() => {
        setShowWaveBanner(false);
        roundTransitionActive = false;
        const zCount = Math.floor(8 + stateRef.current.currentRound * 3.5);
        zombiesLeftToSpawn  = zCount;
        roundKillsRemaining = zCount;
        spawnTimer = 0;
      }, 4000);
    };
    startNextRoundWave();

    // --- FX ---
    const triggerBloodExplosion = (pos: THREE.Vector3) => {
      const geo = new THREE.BoxGeometry(0.04,0.04,0.04);
      for (let i=0; i<8; i++) {
        const p=new THREE.Mesh(geo,bloodSplashMat); p.position.copy(pos); scene.add(p);
        particleList.push({ mesh:p, vel:new THREE.Vector3((Math.random()-0.5)*2.5, Math.random()*3+1, (Math.random()-0.5)*2.5), age:0, maxAge:0.5+Math.random()*0.4 });
      }
    };
    const triggerBulletTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
      const mat=new THREE.LineBasicMaterial({color:0xfacc15,linewidth:2,transparent:true,opacity:0.85});
      const geo=new THREE.BufferGeometry().setFromPoints([start.clone(),end.clone()]);
      const line=new THREE.Line(geo,mat); scene.add(line);
      bulletTracers.push({ mesh:line, age:0, maxAge:0.08 });
    };

    // --- FLOATING DAMAGE NUMBERS ---
    const floatingDmgNumbers: { element: HTMLSpanElement; pos: THREE.Vector3; age: number; maxAge: number }[] = [];
    const createFloatingDamageNumber = (pos: THREE.Vector3, text: string, type: 'hit'|'headshot-hit'|'kill'|'headshot-kill'='hit') => {
      if (!stateRef.current.damageNumbers) return;
      const el=document.createElement('span');
      if      (type==='headshot-kill') el.className='absolute font-black text-sm font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-yellow-400 uppercase tracking-widest';
      else if (type==='kill')          el.className='absolute font-black text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-white uppercase tracking-wide';
      else if (type==='headshot-hit')  el.className='absolute font-bold  text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-yellow-300';
      else                             el.className='absolute font-bold  text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-green-400';
      el.textContent=text;
      document.body.appendChild(el);
      floatingDmgNumbers.push({ element:el, pos:pos.clone(), age:0, maxAge:0.75 });
    };

    // --- PLAYER INPUT STATE ---
    const keysMap: Record<string, boolean> = {};
    const mouseDeltas = { x: 0, y: 0 };
    let lastInteractionPulse = 0;
    let lastDamageTime       = 0;
    const recoilOffset    = { x: 0, y: 0 };
    const maxRecoilOffset = { x: 0, y: 0 };
    let gunRecoilZOffset  = 0;

    // --- POINTER LOCK ---
    const handlePointerLock = () => {
      if (stateRef.current.gameState !== 'playing') return;
      if (document.pointerLockElement) return;
      try {
        const el = document.getElementById('fps-canvas-container');
        const p  = el?.requestPointerLock();
        if (p && typeof (p as any).catch === 'function') (p as any).catch((err: unknown) => { console.warn('Pointer lock deferred:', err); });
      } catch (err) { console.warn('Pointer lock error:', err); }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== document.getElementById('fps-canvas-container')) return;
      if (stateRef.current.gameState !== 'playing') return;
      const sensMult = stateRef.current.isADS ? 0.45 : 1.0;
      mouseDeltas.x = e.movementX * sensMult;
      mouseDeltas.y = e.movementY * sensMult;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysMap[e.code] = true;
      if (e.code === 'KeyR'   && !stateRef.current.isReloading) triggerWeaponReload();
      if (e.code === 'KeyE'   && stateRef.current.gameState === 'playing') processInteractEvent();
      if (e.code === 'Digit1' && stateRef.current.activeWeaponId !== 'pistol')  swapWeapon('pistol');
      if (e.code === 'Digit2' && stateRef.current.activeWeaponId !== 'shotgun') swapWeapon('shotgun');
    };
    const onKeyUp = (e: KeyboardEvent) => { keysMap[e.code] = false; };

    let fireCooldownLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== document.getElementById('fps-canvas-container')) return;
      if (stateRef.current.gameState !== 'playing') return;
      if (e.button === 0) triggerShootWeapon();
      if (e.button === 2) setIsADS(true);
    };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 2) setIsADS(false); };

    const triggerShootWeapon = () => {
      if (fireCooldownLeft > 0 || stateRef.current.isReloading) return;
      if (stateRef.current.ammoClip <= 0) { sound.playReloadClick(0.3); return; }

      const id = stateRef.current.activeWeaponId;
      setAmmoClip((prev: number) => {
        const next = Math.max(0, prev - 1);
        stateRef.current.ammoClip = next;
        weaponAmmoRef.current[id].clip = next;
        return next;
      });

      const dmgMult = stateRef.current.hasTomeOfPower ? 2.0 : 1.0;

      if (id === 'pistol') {
        sound.playPistol();
        fireCooldownLeft = 0.25;
        maxRecoilOffset.y += 0.035;
        maxRecoilOffset.x += (Math.random()-0.5)*0.02;
        gunRecoilZOffset   = 0.12;
      } else {
        sound.playShotgun();
        fireCooldownLeft = 0.85;
        maxRecoilOffset.y += 0.088;
        maxRecoilOffset.x += (Math.random()-0.5)*0.04;
        gunRecoilZOffset   = 0.28;
      }

      if (isCoop && socket && socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'player-shoot', wpnId: id }));

      // Muzzle flash
      const flashGeo = new THREE.CylinderGeometry(0.01, 0.08, 0.22, 6);
      flashGeo.rotateX(Math.PI/2);
      const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffe285, transparent: true, opacity: 0.9 }));
      flash.position.set(0.12, -0.11, -0.44);
      camera.add(flash);
      setTimeout(() => camera.remove(flash), 50);

      const raycaster  = new THREE.Raycaster();
      const numPellets = id === 'shotgun' ? 7 : 1;
      const spreadParam = stateRef.current.isADS ? 0.015 : (id === 'shotgun' ? 0.065 : 0.022);

      for (let i = 0; i < numPellets; i++) {
        const targetDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (i > 0 || id === 'shotgun') {
          targetDir.x += (Math.random()-0.5)*spreadParam*2;
          targetDir.y += (Math.random()-0.5)*spreadParam*2;
          targetDir.normalize();
        }
        raycaster.set(ca