import { generateWornWallTexture, generateConcreteFloorTexture, generateCeilingTexture, generateWoodTexture } from '../map/textures';
import { buildStaticMap } from './mapBuilder';
import { buildClassroomA, buildClassroomB } from './rooms';
import { spawnSingleZombie as spawnZombieHelper } from '../entities/zombies';
import { buildPistolGroup, buildShotgunGroup, buildTomeOfPowerMachine, buildFastHandsMachine, tickReloadAnimation, ReloadAnimState, PerkMachine, WeaponDeps } from '../weapons/models';
import { addShotgunWallbuy as _addShotgunWallbuy, buildBuyableDoor as _buildBuyableDoor } from '../map/interactables';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sound } from '../sound';
import { Zombie, Barricade, WallBuy, BuyableDoor, TeammateState, WEAPON_DEFINITIONS, WeaponId } from '../types';

interface BotTeammate {
  id: string;
  name: string;
  color: number;
  health: number;
  maxHealth: number;
  points: number;
  state: 'ALIVE' | 'DOWNED' | 'DEAD';
  activeWeapon: 'pistol' | 'shotgun';
  mesh: THREE.Group;
  lastTargetZombieId: string | null;
  lastShotTime: number;
  cannotBeSavedTime: number;
  downedTime: number;
  revivingTargetId: string | null;
  reviveTimer: number;
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'gameover' | 'paused' | 'loading';
  setGameState: React.Dispatch<React.SetStateAction<'menu' | 'playing' | 'gameover' | 'paused' | 'loading'>>;
  health: number;
  setHealth: React.Dispatch<React.SetStateAction<number>>;
  points: number;
  setPoints: React.Dispatch<React.SetStateAction<number>>;
  kills: number;
  setKills: React.Dispatch<React.SetStateAction<number>>;
  currentRound: number;
  setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
  activeWeaponId: 'pistol' | 'shotgun';
  setActiveWeaponId: React.Dispatch<React.SetStateAction<'pistol' | 'shotgun'>>;
  ammoClip: number;
  setAmmoClip: React.Dispatch<React.SetStateAction<number>>;
  ammoReserve: number;
  setAmmoReserve: React.Dispatch<React.SetStateAction<number>>;
  isADS: boolean;
  setIsADS: React.Dispatch<React.SetStateAction<boolean>>;
  isReloading: boolean;
  setIsReloading: React.Dispatch<React.SetStateAction<boolean>>;
  setHitmarker: React.Dispatch<React.SetStateAction<'hit' | 'kill' | null>>;
  setInteractMessage: React.Dispatch<React.SetStateAction<string | null>>;
  addScorePopup: (amount: number, text: string) => void;
  setShowWaveBanner: React.Dispatch<React.SetStateAction<boolean>>;
  isCoop: boolean;
  setTeammates: React.Dispatch<React.SetStateAction<TeammateState[]>>;
  setPlayerReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setTeammateReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setRevivingName: React.Dispatch<React.SetStateAction<string | null>>;
  socket?: WebSocket | null;
  roomId?: string;
  roomState?: any;
  clientId?: string;
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
  socket, roomId, roomState, clientId
}) => {

  const containerRef = useRef<HTMLDivElement>(null);

  const weaponsOwnedRef = useRef<string[]>(['pistol']);
  const weaponAmmoRef = useRef({
    pistol:  { clip: 12, reserve: 60,  maxClip: 12, maxReserve: 120 },
    shotgun: { clip: 0,  reserve: 0,   maxClip: 6,  maxReserve: 48  },
  });

  const stateRef = useRef({
    gameState, health, points, kills, currentRound,
    activeWeaponId, ammoClip, ammoReserve, isADS, isReloading,
    mouseSensitivity: 0.002,
    fov: 75,
    crosshairColor: '#22c55e',
    damageNumbers: true,
    hasFastHands: false,
    hasTomeOfPower: false,
  });

  const remotePlayersRef = useRef<Map<string, {
    id: string; name: string; color: number; mesh: THREE.Group;
    state: 'ALIVE' | 'DOWNED' | 'DEAD';
    health: number; points: number; kills: number; activeWeapon: 'pistol' | 'shotgun';
  }>>(new Map());

  const lastUpdateSentTimeRef  = useRef<number>(0);
  const lastZombieSyncTimeRef  = useRef<number>(0);
  const socketRef    = useRef<WebSocket | null>(null);
  const roomStateRef = useRef<any>(null);
  const clientIdRef  = useRef<string>('');

  useEffect(() => { socketRef.current    = socket    || null; }, [socket]);
  useEffect(() => { roomStateRef.current = roomState || null; }, [roomState]);
  useEffect(() => { clientIdRef.current  = clientId  || '';   }, [clientId]);

  useEffect(() => {
    stateRef.current.gameState     = gameState;
    stateRef.current.health        = health;
    stateRef.current.points        = points;
    stateRef.current.kills         = kills;
    stateRef.current.currentRound  = currentRound;
    stateRef.current.activeWeaponId = activeWeaponId;
    stateRef.current.ammoClip      = ammoClip;
    stateRef.current.ammoReserve   = ammoReserve;
    stateRef.current.isADS         = isADS;
    stateRef.current.isReloading   = isReloading;
  }, [gameState, health, points, kills, currentRound, activeWeaponId, ammoClip, ammoReserve, isADS, isReloading]);

  useEffect(() => {
    const handleSettingsUpdate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;
      if (data.controls?.sensitivity)  stateRef.current.mouseSensitivity = (data.controls.sensitivity / 10000) * 0.6;
      if (data.graphics?.fov)          stateRef.current.fov = data.graphics.fov;
      if (data.gameplay) {
        stateRef.current.crosshairColor = data.gameplay.crosshairColor ?? '#22c55e';
        stateRef.current.damageNumbers  = data.gameplay.damageNumbers !== false;
      }
    };
    window.addEventListener('settings-update', handleSettingsUpdate);
    const initial = localStorage.getItem('codz_settings');
    if (initial) {
      try {
        const parsed = JSON.parse(initial);
        if (parsed.controls?.sensitivity)  stateRef.current.mouseSensitivity = (parsed.controls.sensitivity / 10000) * 0.6;
        if (parsed.graphics?.fov)          stateRef.current.fov = parsed.graphics.fov;
        if (parsed.gameplay) {
          stateRef.current.crosshairColor = parsed.gameplay.crosshairColor ?? '#22c55e';
          stateRef.current.damageNumbers  = parsed.gameplay.damageNumbers !== false;
        }
      } catch (_) {}
    }
    return () => window.removeEventListener('settings-update', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const width  = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0f11);
    scene.fog = new THREE.FogExp2(0x090a0c, 0.026);

    const camera   = new THREE.PerspectiveCamera(stateRef.current.fov, width / height, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: false });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled  = true;
    renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // --- GLB MODELS ---
    const loaded3DModels: WeaponDeps['loaded3DModels'] = {
      pistol:  null,
      shotgun: null,
    };
    const modelLoader = new GLTFLoader();
    modelLoader.load('/models/zombie.glb',  (g) => { g.scene.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } }); (loaded3DModels as any).zombie = g.scene; }, undefined, () => {});
    modelLoader.load('/models/pistol.glb',  (g) => { loaded3DModels.pistol  = g.scene; if (stateRef.current.activeWeaponId === 'pistol')  updateActiveGunModel('pistol');  }, undefined, () => {});
    modelLoader.load('/models/shotgun.glb', (g) => { loaded3DModels.shotgun = g.scene; if (stateRef.current.activeWeaponId === 'shotgun') updateActiveGunModel('shotgun'); }, undefined, () => {});

    // --- TEXTURES ---
    const wallTex    = generateWornWallTexture();      wallTex.repeat.set(4, 1);
    const floorTex   = generateConcreteFloorTexture(); floorTex.repeat.set(6, 6);
    const ceilingTex = generateCeilingTexture();       ceilingTex.repeat.set(8, 8);
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

    // Weapon deps object for model builders
    const skinMaterial      = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.85 });
    const sleeveMaterial    = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const watchStrapsMat    = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
    const watchBezelMat     = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.2, metalness: 0.9 });
    const watchGlassMat     = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.05, transparent: true, opacity: 0.6 });
    const weaponDeps: WeaponDeps = { skinMaterial, sleeveMaterial, watchStrapsMat, watchBezelMat, watchGlassMat, woodTex, loaded3DModels };

    // --- CONSTANTS ---
    const CLASSROOM_W      = 28;
    const CLASSROOM_D      = 24;
    const WALL_H           = 4.5;
    const HALLWAY_W        = 10;
    const HALLWAY_D        = 32;
    const HALLWAY_X_CENTER = 19;

    const halogenLights: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[] = [];

    // --- BUILD MAIN MAP ---
    const classroomObstacles: THREE.Box3[] = buildStaticMap(
      scene,
      { wallMaterial, floorMaterial, ceilingMaterial, woodMaterial, blackMetalMaterial, chalkboardMaterial },
      halogenLights,
      []
    );

    // --- BUILD SIDE ROOMS ---
    const roomDeps = { scene, wallMaterial, floorMaterial, ceilingMaterial, woodMaterial, blackMetalMaterial, chalkboardMaterial, woodTex, obstacles: classroomObstacles };
    buildClassroomA(roomDeps);
    buildClassroomB(roomDeps);

    // --- PERK MACHINES ---
    const tomePerk:      PerkMachine   = buildTomeOfPowerMachine(scene);
    const fastHandsPerk: PerkMachine   = buildFastHandsMachine(scene);
    const perkMachines:  PerkMachine[] = [tomePerk, fastHandsPerk];

    // --- PARTICLES / TRACERS ---
    const barricadeDetails: Barricade[] = [];
    const particleList: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];
    const bulletTracers: { mesh: THREE.Line; age: number; maxAge: number }[] = [];

    // --- SPAWNERS ---
    const groundSpawners = [
      { x: -10.0, z:  -8.0, label: 'Classroom NW' },
      { x:  10.0, z:  -8.0, label: 'Classroom NE' },
      { x: -10.0, z:   8.0, label: 'Classroom SW' },
      { x:  10.0, z:   8.0, label: 'Classroom SE' },
      { x:  -6.0, z:   1.0, label: 'Classroom West' },
      { x:   6.0, z:  -1.0, label: 'Classroom East' },
      { x:  19.0, z: -12.0, label: 'Hallway North' },
      { x:  19.0, z:  12.0, label: 'Hallway South' },
      { x:  18.0, z: -37.0, label: 'Science Lab' },
      { x:  18.0, z:  37.0, label: 'Abandoned Classroom' },
    ];

    // --- HELPERS ---
    const triggerGravelEruption = (pos: THREE.Vector3) => {
      const pGeom = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const dirtMat = new THREE.MeshStandardMaterial({ color: 0x221a11, roughness: 0.95 });
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(pGeom, dirtMat);
        p.position.set(pos.x + (Math.random() - 0.5) * 1.2, 0.02, pos.z + (Math.random() - 0.5) * 1.2);
        scene.add(p);
        particleList.push({ mesh: p, vel: new THREE.Vector3((Math.random()-0.5)*1.5, Math.random()*2+1.2, (Math.random()-0.5)*1.5), age: 0, maxAge: 0.6 + Math.random()*0.4 });
      }
    };

    const mapBoundingLimits = {
      minX: -CLASSROOM_W/2 + 0.65, maxX:  CLASSROOM_W/2 - 0.65,
      minZ: -CLASSROOM_D/2 + 0.65, maxZ:  CLASSROOM_D/2 - 0.65,
      hallMinX: 14.5, hallMaxX: HALLWAY_X_CENTER + HALLWAY_W/2 - 0.65,
      hallMinZ: -HALLWAY_D/2 + 0.65, hallMaxZ: HALLWAY_D/2 - 0.65,
    };

    // --- SHOTGUN WALL BUY ---
    const buildShotgunWallBuy = (): WallBuy => {
      const g = new THREE.Group();
      const buySign = new THREE.Group();
      const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
      buySign.add(wallSign);
      const frameBuy = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.02), emissionGreen);
      frameBuy.position.z = -0.01;
      buySign.add(frameBuy);
      buySign.position.set(0, 0.4, 0);
      g.add(buySign);
      const shotgunG = new THREE.Group();
      const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), blackMetalMaterial);
      barrelL.rotation.x = Math.PI/2; barrelL.position.set(-0.018, 0.05, -0.1); shotgunG.add(barrelL);
      const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), blackMetalMaterial);
      barrelR.rotation.x = Math.PI/2; barrelR.position.set(0.018, 0.05, -0.1);  shotgunG.add(barrelR);
      const receiver   = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.25), blackMetalMaterial); receiver.position.set(0, 0.05, 0.3);   shotgunG.add(receiver);
      const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.035, 0.4), woodMaterial);        pumpHandle.position.set(0, 0.02, 0.0); shotgunG.add(pumpHandle);
      const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.45), woodMaterial);         woodenButt.position.set(0, -0.01, 0.6); woodenButt.rotation.x = -0.15; shotgunG.add(woodenButt);
      shotgunG.rotation.y = -Math.PI/2;
      shotgunG.position.set(0, -0.12, 0.15);
      g.add(shotgunG);
      const wallBuyX = -CLASSROOM_W/2 + 0.28, wallBuyY = 1.7, wallBuyZ = -1.5;
      g.position.set(wallBuyX, wallBuyY, wallBuyZ);
      g.rotation.y = Math.PI/2;
      scene.add(g);
      return { id: 'wall-shotgun', weaponId: 'pump_shotgun', position: [wallBuyX+0.2, wallBuyY, wallBuyZ], rotationY: Math.PI/2, price: 700, purchased: false, textMesh: g };
    };
    const shotgunWallBuy = buildShotgunWallBuy();

    // --- BUYABLE DOOR ---
    const buildMainDoor = (): BuyableDoor => {
      const g = new THREE.Group();
      const doorW = 0.25, doorH = 3.6, doorLen = 4.0;
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorLen), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, metalness: 0.1 }));
      doorMesh.position.y = doorH/2;
      doorMesh.castShadow = true;
      g.add(doorMesh);
      const sc2 = document.createElement('canvas'); sc2.width = 512; sc2.height = 128;
      const ctx = sc2.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0,0,512,128);
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 6; ctx.strokeRect(4,4,504,120);
      ctx.fillStyle = '#22c55e'; ctx.font = 'bold 38px Courier New'; ctx.textAlign = 'center';
      ctx.fillText('DOOR', 256, 45); ctx.font = 'bold 28px Courier New';
      ctx.fillText('Press E to Open [$1200]', 256, 95);
      const signTex2 = new THREE.CanvasTexture(sc2);
      const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.75), new THREE.MeshBasicMaterial({ map: signTex2, side: THREE.DoubleSide, transparent: true }));
      overlay.position.set(-0.25, 3.2, 0); overlay.rotation.y = -Math.PI/2;
      g.add(overlay);
      const dX = CLASSROOM_W/2, dY = 0, dZ = 0;
      g.position.set(dX, dY, dZ);
      scene.add(g);
      return { id: 'door-classroom-exit', price: 1200, position: [dX, dY, dZ], rotationY: 0, width: doorW, height: doorH, purchased: false, group: g, doorMesh, sinkOffset: 0 };
    };
    const classroomExitDoor = buildMainDoor();
    let doorBlockerBox = new THREE.Box3().setFromObject(classroomExitDoor.doorMesh!);

    // --- TEAMMATE MESH ---
    const designTeammateMesh = (clothesColor: number): THREE.Group => {
      const g = new THREE.Group();
      const shirtMat  = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.75 });
      const jeansMat  = new THREE.MeshStandardMaterial({ color: 0x1d2c3d, roughness: 0.8 });
      const hairMat   = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat); torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
      const head  = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMaterial);  head.position.y  = 1.55; head.castShadow  = true; g.add(head);
      const hair  = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.34), hairMat);  hair.position.set(0, 1.7, 0.02); g.add(hair);
      const armL  = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMaterial);  armL.position.set(-0.35, 1.1, 0.05); armL.castShadow = true; g.add(armL);
      const armR  = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMaterial);  armR.position.set(0.35, 1.1, 0.15); armR.rotation.x = -Math.PI/3; armR.castShadow = true; g.add(armR);
      const legs  = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.65, 0.26), jeansMat); legs.position.y  = 0.355; legs.castShadow = true; g.add(legs);
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.5 });
      const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.32), gunMat); gunBox.position.set(0.35, 1.1, 0.45); gunBox.rotation.x = -Math.PI/18; g.add(gunBox);
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

    // --- BLOOD / TRACER FX ---
    const triggerBloodExplosion = (pos: THREE.Vector3) => {
      const pGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(pGeom, bloodSplashMat);
        p.position.copy(pos);
        scene.add(p);
        particleList.push({ mesh: p, vel: new THREE.Vector3((Math.random()-0.5)*2.5, Math.random()*3+1, (Math.random()-0.5)*2.5), age: 0, maxAge: 0.5+Math.random()*0.4 });
      }
    };

    const triggerBulletTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
      const mat  = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, transparent: true, opacity: 0.85 });
      const geom = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
      const line = new THREE.Line(geom, mat);
      scene.add(line);
      bulletTracers.push({ mesh: line, age: 0, maxAge: 0.08 });
    };

    // --- FLOATING DAMAGE NUMBERS ---
    const floatingDmgNumbers: { element: HTMLSpanElement; pos: THREE.Vector3; age: number; maxAge: number }[] = [];
    const createFloatingDamageNumber = (pos: THREE.Vector3, text: string, type: 'hit'|'headshot-hit'|'kill'|'headshot-kill' = 'hit') => {
      if (!stateRef.current.damageNumbers) return;
      const el = document.createElement('span');
      if      (type === 'headshot-kill') el.className = 'absolute font-black text-sm font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-yellow-400 uppercase tracking-widest';
      else if (type === 'kill')          el.className = 'absolute font-black text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-white uppercase tracking-wide';
      else if (type === 'headshot-hit')  el.className = 'absolute font-bold  text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-yellow-300';
      else                               el.className = 'absolute font-bold  text-xs font-mono pointer-events-none select-none z-30 transform -translate-x-1/2 text-green-400';
      el.textContent = text;
      document.body.appendChild(el);
      floatingDmgNumbers.push({ element: el, pos: pos.clone(), age: 0, maxAge: 0.75 });
    };

    // --- PLAYER ---
    const pDirection = new THREE.Vector3();
    camera.position.set(0, 1.65, 2.5);
    let lastInteractionPulse = 0;
    let lastDamageTime       = 0;
    let pYaw   = 0;
    let pPitch = 0;
    const recoilOffset    = { x: 0, y: 0 };
    const maxRecoilOffset = { x: 0, y: 0 };
    let gunRecoilZOffset  = 0;
    const keysMap: Record<string, boolean> = {};

    const handlePointerLock = () => {
      if (stateRef.current.gameState === 'playing') {
        try {
          const p = containerRef.current?.requestPointerLock();
          if (p && typeof (p as any).catch === 'function') (p as any).catch((err: unknown) => { console.warn('Pointer lock deferred:', err); });
        } catch (err) { console.warn('Pointer lock error:', err); }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      if (stateRef.current.gameState !== 'playing') return;
      const sensMult = stateRef.current.isADS ? 0.45 : 1.0;
      pYaw   -= e.movementX * stateRef.current.mouseSensitivity * sensMult;
      pPitch -= e.movementY * stateRef.current.mouseSensitivity * sensMult;
      pPitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, pPitch));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysMap[e.code] = true;
      if (e.code === 'KeyR'    && !stateRef.current.isReloading) triggerWeaponReload();
      if (e.code === 'KeyE'    && stateRef.current.gameState === 'playing') processInteractEvent();
      if (e.code === 'Digit1'  && stateRef.current.activeWeaponId !== 'pistol')  swapWeapon('pistol');
      if (e.code === 'Digit2'  && stateRef.current.activeWeaponId !== 'shotgun') swapWeapon('shotgun');
    };
    const onKeyUp = (e: KeyboardEvent) => { keysMap[e.code] = false; };

    let fireCooldownLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
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
        raycaster.set(camera.position, targetDir);
        const zombieMeshes = activeZombiesList.map(z => z.mesh).filter(Boolean);
        const hits = raycaster.intersectObjects(zombieMeshes, true);
        if (hits.length > 0) {
          const hitObj = hits[0];
          let hitZombie: Zombie | undefined;
          for (const z of activeZombiesList) {
            if (z.mesh && hitObj.object.parent === z.mesh || hitObj.object === z.mesh ||
                (hitObj.object.parent && hitObj.object.parent.parent === z.mesh)) {
              hitZombie = z; break;
            }
          }
          if (!hitZombie) {
            for (const z of activeZombiesList) {
              if (z.mesh) {
                let cur: THREE.Object3D | null = hitObj.object;
                while (cur) { if (cur === z.mesh) { hitZombie = z; break; } cur = cur.parent; }
              }
              if (hitZombie) break;
            }
          }
          if (hitZombie && hitZombie.state !== 'dead') {
            const isHeadshot = hitObj.object.name?.toLowerCase().includes('head') || (hitObj.point.y - hitZombie.mesh.position.y) > 1.5;
            const baseDmg    = id === 'pistol' ? 38 : 22;
            const dmg        = Math.round(baseDmg * dmgMult * (isHeadshot ? 2 : 1));
            hitZombie.health -= dmg;
            triggerBulletTracer(camera.position.clone(), hitObj.point.clone());
            if (hitZombie.health <= 0) {
              hitZombie.state = 'dead';
              triggerBloodExplosion(hitZombie.mesh.position.clone());
              setTimeout(() => { zombieGroup.remove(hitZombie!.mesh); const idx = activeZombiesList.indexOf(hitZombie!); if (idx > -1) activeZombiesList.splice(idx, 1); }, 800);
              const reward = hitZombie.scoreReward + (isHeadshot ? 50 : 0);
              setPoints((p: number) => p + reward); stateRef.current.points += reward;
              setKills((k: number) => k + 1);       stateRef.current.kills  += 1;
              addScorePopup(reward, isHeadshot ? '💀 HEADSHOT' : 'KILL');
              setHitmarker('kill');
              createFloatingDamageNumber(hitZombie.mesh.position.clone(), isHeadshot ? `💀 ${dmg}` : `${dmg}`, isHeadshot ? 'headshot-kill' : 'kill');
              roundKillsRemaining--;
              if (isCoop && socket && socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: 'zombie-killed', zombieId: hitZombie.id }));
              if (roundKillsRemaining <= 0 && zombiesLeftToSpawn <= 0) {
                setTimeout(() => {
                  setCurrentRound((r: number) => { const nr = r + 1; stateRef.current.currentRound = nr; return nr; });
                  startNextRoundWave();
                }, 2500);
              }
            } else {
              setHitmarker('hit');
              createFloatingDamageNumber(hitZombie.mesh.position.clone().add(new THREE.Vector3(0,1.8,0)), `${dmg}`, isHeadshot ? 'headshot-hit' : 'hit');
            }
          }
        }
      }
    };

    // --- GUN VIEWMODEL ---
    let pistolGroup:  THREE.Group | null = null;
    let shotgunGroup: THREE.Group | null = null;
    let activeGunGroup: THREE.Group | null = null;

    const updateActiveGunModel = (weapId: string) => {
      if (activeGunGroup) camera.remove(activeGunGroup);
      if (weapId === 'pistol') {
        if (!pistolGroup) { pistolGroup = buildPistolGroup(weaponDeps); }
        activeGunGroup = pistolGroup;
      } else {
        if (!shotgunGroup) { shotgunGroup = buildShotgunGroup(weaponDeps); }
        activeGunGroup = shotgunGroup;
      }
      if (activeGunGroup) camera.add(activeGunGroup);
    };
    updateActiveGunModel(stateRef.current.activeWeaponId);

    const swapWeapon = (weapId: 'pistol' | 'shotgun') => {
      if (!weaponsOwnedRef.current.includes(weapId)) return;
      if (stateRef.current.activeWeaponId === weapId) return;
      const cur = stateRef.current.activeWeaponId as 'pistol'|'shotgun';
      weaponAmmoRef.current[cur].clip     = stateRef.current.ammoClip;
      weaponAmmoRef.current[cur].reserve  = stateRef.current.ammoReserve;
      stateRef.current.activeWeaponId     = weapId;
      setActiveWeaponId(weapId);
      const { clip, reserve } = weaponAmmoRef.current[weapId];
      stateRef.current.ammoClip    = clip;
      stateRef.current.ammoReserve = reserve;
      setAmmoClip(clip);
      setAmmoReserve(reserve);
      updateActiveGunModel(weapId);
    };

    // --- RELOAD ---
    let reloadAnimState: ReloadAnimState = { active: false, time: 0, duration: 1.5, weaponId: 'pistol' };

    const triggerWeaponReload = () => {
      if (stateRef.current.isReloading) return;
      const id = stateRef.current.activeWeaponId as 'pistol'|'shotgun';
      const ammo = weaponAmmoRef.current[id];
      if (ammo.clip >= ammo.maxClip || ammo.reserve <= 0) return;
      const reloadDuration = id === 'shotgun' ? (stateRef.current.hasFastHands ? 2.0 : 3.2) : (stateRef.current.hasFastHands ? 0.9 : 1.5);
      reloadAnimState = { active: true, time: 0, duration: reloadDuration, weaponId: id };
      setIsReloading(true);
      stateRef.current.isReloading = true;
      sound.playReloadClick(1.0);
      setTimeout(() => {
        const needed = ammo.maxClip - ammo.clip;
        const give   = Math.min(needed, ammo.reserve);
        ammo.clip    += give;
        ammo.reserve -= give;
        stateRef.current.ammoClip    = ammo.clip;
        stateRef.current.ammoReserve = ammo.reserve;
        setAmmoClip(ammo.clip);
        setAmmoReserve(ammo.reserve);
        setIsReloading(false);
        stateRef.current.isReloading = false;
        reloadAnimState.active = false;
      }, reloadDuration * 1000);
    };

    // --- INTERACT ---
    const processInteractEvent = () => {
      const now = performance.now();
      if (now - lastInteractionPulse < 300) return;
      lastInteractionPulse = now;
      const playerPos = camera.position;

      // Wall buy
      if (!shotgunWallBuy.purchased) {
        const wbp = shotgunWallBuy.position;
        const dist = playerPos.distanceTo(new THREE.Vector3(wbp[0], wbp[1], wbp[2]));
        if (dist < 2.2) {
          if (stateRef.current.points >= shotgunWallBuy.price) {
            shotgunWallBuy.purchased = true;
            setPoints((p: number) => p - shotgunWallBuy.price); stateRef.current.points -= shotgunWallBuy.price;
            weaponsOwnedRef.current.push('shotgun');
            weaponAmmoRef.current.shotgun = { clip: 6, reserve: 24, maxClip: 6, maxReserve: 48 };
            addScorePopup(-shotgunWallBuy.price, 'Shotgun Bought!');
            swapWeapon('shotgun');
          } else {
            addScorePopup(0, 'Need ' + shotgunWallBuy.price + ' pts!');
          }
          return;
        }
      }

      // Buyable door
      if (!classroomExitDoor.purchased) {
        const dp = classroomExitDoor.position;
        const doorPos = new THREE.Vector3(dp[0], dp[1], dp[2]);
        if (playerPos.distanceTo(doorPos) < 2.8) {
          if (stateRef.current.points >= classroomExitDoor.price) {
            classroomExitDoor.purchased = true;
            setPoints((p: number) => p - classroomExitDoor.price); stateRef.current.points -= classroomExitDoor.price;
            addScorePopup(-classroomExitDoor.price, 'Door Opened!');
            scene.remove(classroomExitDoor.group);
            doorBlockerBox = new THREE.Box3();
          } else {
            addScorePopup(0, 'Need ' + classroomExitDoor.price + ' pts!');
          }
          return;
        }
      }

      // Perk machines
      for (const perk of perkMachines) {
        const pDist = playerPos.distanceTo(perk.position instanceof THREE.Vector3 ? perk.position : new THREE.Vector3(perk.position[0], perk.position[1], perk.position[2]));
        if (pDist < 2.0) {
          if (perk.id === 'tome-of-power' && !stateRef.current.hasTomeOfPower) {
            if (stateRef.current.points >= perk.price) {
              stateRef.current.hasTomeOfPower = true;
              setPoints((p: number) => p - perk.price); stateRef.current.points -= perk.price;
              addScorePopup(-perk.price, '🔮 Tome of Power!');
            } else { addScorePopup(0, 'Need ' + perk.price + ' pts!'); }
          } else if (perk.id === 'fast-hands' && !stateRef.current.hasFastHands) {
            if (stateRef.current.points >= perk.price) {
              stateRef.current.hasFastHands = true;
              setPoints((p: number) => p - perk.price); stateRef.current.points -= perk.price;
              addScorePopup(-perk.price, '⚡ Fast Hands!');
            } else { addScorePopup(0, 'Need ' + perk.price + ' pts!'); }
          }
          return;
        }
      }
    };

    // --- INTERACT PROMPT ---
    const updateInteractMessage = () => {
      const playerPos = camera.position;
      const wbp = shotgunWallBuy.position;
      if (!shotgunWallBuy.purchased && playerPos.distanceTo(new THREE.Vector3(wbp[0], wbp[1], wbp[2])) < 2.2) {
        setInteractMessage(`[E] Buy Shotgun - ${shotgunWallBuy.price} pts`); return;
      }
      const dp = classroomExitDoor.position;
      if (!classroomExitDoor.purchased && playerPos.distanceTo(new THREE.Vector3(dp[0], dp[1], dp[2])) < 2.8) {
        setInteractMessage(`[E] Open Door - ${classroomExitDoor.price} pts`); return;
      }
      for (const perk of perkMachines) {
        const pp = perk.position;
        const pv = pp instanceof THREE.Vector3 ? pp : new THREE.Vector3(pp[0], pp[1], pp[2]);
        if (playerPos.distanceTo(pv) < 2.0) {
          const owned = perk.id === 'tome-of-power' ? stateRef.current.hasTomeOfPower : stateRef.current.hasFastHands;
          if (!owned) { setInteractMessage(`[E] Buy ${perk.name} - ${perk.price} pts`); return; }
        }
      }
      setInteractMessage(null);
    };

    // --- EVENTS ---
    containerRef.current.addEventListener('click', handlePointerLock);
    document.addEventListener('mousemove',   onMouseMove);
    document.addEventListener('keydown',     onKeyDown);
    document.addEventListener('keyup',       onKeyUp);
    document.addEventListener('mousedown',   onMouseDown);
    document.addEventListener('mouseup',     onMouseUp);

    // --- RESIZE ---
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // --- ANIMATE LOOP ---
    let lastTime  = performance.now();
    let animFrameId = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const now   = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime    = now;

      if (stateRef.current.gameState !== 'playing') {
        renderer.render(scene, camera);
        return;
      }

      // FOV update
      const targetFov = stateRef.current.isADS ? stateRef.current.fov * 0.65 : stateRef.current.fov;
      camera.fov += (targetFov - camera.fov) * 0.18;
      camera.updateProjectionMatrix();

      // Spawn zombies
      if (zombiesLeftToSpawn > 0 && !roundTransitionActive) {
        spawnTimer -= delta;
        if (spawnTimer <= 0) {
          spawnTimer = 0.8 + Math.random() * 0.6;
          spawnSingleZombie(Math.floor(Math.random() * groundSpawners.length));
          zombiesLeftToSpawn--;
        }
      }

      // Zombie AI
      for (const zombie of activeZombiesList) {
        if (zombie.state === 'dead') continue;
        zombie.animTime += delta;
        if (zombie.state === 'spawning') {
          triggerGravelEruption(zombie.mesh.position);
          if (zombie.animTime > 1.2) zombie.state = 'chasing';
          continue;
        }
        const toPlayer = new THREE.Vector3().subVectors(camera.position, zombie.mesh.position);
        const dist     = toPlayer.length();
        toPlayer.normalize();
        if (dist > 1.1) {
          zombie.state = 'chasing';
          zombie.mesh.position.addScaledVector(toPlayer, zombie.speed * delta);
          zombie.mesh.lookAt(camera.position.x, zombie.mesh.position.y, camera.position.z);
          zombie.mesh.position.y = Math.abs(Math.sin(zombie.animTime * 6)) * 0.06;
        } else {
          zombie.state = 'attacking';
          const attackNow = now;
          if (attackNow - zombie.lastAttackTime > 900) {
            zombie.lastAttackTime = attackNow;
            if (stateRef.current.health > 0) {
              const newHp = Math.max(0, stateRef.current.health - zombie.damage);
              stateRef.current.health = newHp;
              setHealth(newHp);
              lastDamageTime = now;
              if (newHp <= 0) {
                setGameState('gameover');
              }
            }
          }
        }
      }

      // Player movement
      const moveSpeed = 6.5 * delta;
      pDirection.set(0, 0, 0);
      if (keysMap['KeyW'] || keysMap['ArrowUp'])    pDirection.z -= 1;
      if (keysMap['KeyS'] || keysMap['ArrowDown'])  pDirection.z += 1;
      if (keysMap['KeyA'] || keysMap['ArrowLeft'])  pDirection.x -= 1;
      if (keysMap['KeyD'] || keysMap['ArrowRight']) pDirection.x += 1;

      if (pDirection.length() > 0) {
        pDirection.normalize();
        const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pYaw, 0));
        pDirection.applyQuaternion(yawQ);
        const nextPos = camera.position.clone().addScaledVector(pDirection, moveSpeed);

        // Collision
        const inClassroom = nextPos.x >= mapBoundingLimits.minX && nextPos.x <= mapBoundingLimits.maxX &&
                            nextPos.z >= mapBoundingLimits.minZ && nextPos.z <= mapBoundingLimits.maxZ;
        const inHallway   = nextPos.x >= mapBoundingLimits.hallMinX && nextPos.x <= mapBoundingLimits.hallMaxX &&
                            nextPos.z >= mapBoundingLimits.hallMinZ && nextPos.z <= mapBoundingLimits.hallMaxZ;

        const playerBox = new THREE.Box3(
          new THREE.Vector3(nextPos.x - 0.3, 0, nextPos.z - 0.3),
          new THREE.Vector3(nextPos.x + 0.3, 2, nextPos.z + 0.3)
        );
        let blocked = false;
        if (!classroomExitDoor.purchased) {
          if (playerBox.intersectsBox(doorBlockerBox)) blocked = true;
        }
        for (const obs of classroomObstacles) {
          if (!blocked && playerBox.intersectsBox(obs)) { blocked = true; break; }
        }

        if (!blocked && (inClassroom || inHallway)) {
          camera.position.copy(nextPos);
        } else if (!blocked) {
          camera.position.copy(nextPos);
        }
        camera.position.y = 1.65;
      }

      // Camera rotation
      const euler = new THREE.Euler(pPitch + recoilOffset.y, pYaw + recoilOffset.x, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      // Recoil decay
      recoilOffset.x += (maxRecoilOffset.x - recoilOffset.x) * 0.18;
      recoilOffset.y += (maxRecoilOffset.y - recoilOffset.y) * 0.18;
      maxRecoilOffset.x *= 0.82;
      maxRecoilOffset.y *= 0.82;
      gunRecoilZOffset  *= 0.78;

      // Gun viewmodel position
      if (activeGunGroup) {
        const adsLerp = stateRef.current.isADS ? 0.12 : 0;
        activeGunGroup.position.set(
          0.12 - adsLerp * 0.12,
          -0.11 + adsLerp * 0.06,
          -0.38 + gunRecoilZOffset
        );
        tickReloadAnimation(reloadAnimState, activeGunGroup, delta);
      }

      // Fire cooldown
      if (fireCooldownLeft > 0) fireCooldownLeft -= delta;

      // Particle update
      for (let i = particleList.length - 1; i >= 0; i--) {
        const pt = particleList[i];
        pt.age += delta;
        pt.mesh.position.addScaledVector(pt.vel, delta);
        pt.vel.y -= 9.8 * delta;
        if (pt.age >= pt.maxAge) { scene.remove(pt.mesh); particleList.splice(i, 1); }
      }

      // Tracer update
      for (let i = bulletTracers.length - 1; i >= 0; i--) {
        const tr = bulletTracers[i];
        tr.age += delta;
        if (tr.age >= tr.maxAge) { scene.remove(tr.mesh); bulletTracers.splice(i, 1); }
      }

      // Floating damage numbers
      for (let i = floatingDmgNumbers.length - 1; i >= 0; i--) {
        const fn = floatingDmgNumbers[i];
        fn.age += delta;
        fn.pos.y += delta * 1.2;
        const projected = fn.pos.clone().project(camera);
        const screenX   = (projected.x *  0.5 + 0.5) * window.innerWidth;
        const screenY   = (projected.y * -0.5 + 0.5) * window.innerHeight;
        fn.element.style.left    = screenX + 'px';
        fn.element.style.top     = screenY + 'px';
        fn.element.style.opacity = String(1 - fn.age / fn.maxAge);
        if (fn.age >= fn.maxAge) { document.body.removeChild(fn.element); floatingDmgNumbers.splice(i, 1); }
      }

      // Halogen light flicker
      for (const hl of halogenLights) {
        if (Math.random() < 0.004) hl.light.intensity = hl.basePower * (0.3 + Math.random() * 0.7);
        else                       hl.light.intensity += (hl.basePower - hl.light.intensity) * 0.05;
      }

      // Interact prompt
      updateInteractMessage();

      // Multiplayer position broadcast
      if (isCoop && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const t = now;
        if (t - lastUpdateSentTimeRef.current > 50) {
          lastUpdateSentTimeRef.current = t;
          socketRef.current.send(JSON.stringify({
            type: 'player-update',
            pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            yaw: pYaw,
            health: stateRef.current.health,
            points: stateRef.current.points,
            activeWeapon: stateRef.current.activeWeaponId,
          }));
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animFrameId);
      containerRef.current?.removeEventListener('click', handlePointerLock);
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('keydown',    onKeyDown);
      document.removeEventListener('keyup',      onKeyUp);
      document.removeEventListener('mousedown',  onMouseDown);
      document.removeEventListener('mouseup',    onMouseUp);
      window.removeEventListener('resize',       onResize);
      renderer.dispose();
      for (const fn of floatingDmgNumbers) {
        if (fn.element.parentNode) document.body.removeChild(fn.element);
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};
