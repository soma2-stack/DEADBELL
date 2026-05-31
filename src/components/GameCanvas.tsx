import { generateWornWallTexture, generateConcreteFloorTexture, generateCeilingTexture, generateWoodTexture } from '../map/textures';
import { buildStaticMap } from './mapBuilder';
import { buildClassroomA, buildClassroomB } from './rooms';
import { spawnSingleZombie as spawnZombieHelper } from '../entities/zombies';
import { buildPistolGroup, buildShotgunGroup, buildTomeOfPowerMachine, buildFastHandsMachine, tickReloadAnimation, ReloadAnimState, PerkMachine } from '../weapons/models';
import { addShotgunWallbuy, buildBuyableDoor } from '../map/interactables';


import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sound } from '../sound';
import { Zombie, Barricade, WallBuy, BuyableDoor, TeammateState } from '../types';

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

  // New Co-Op & Revive state setters
  isCoop: boolean;
  setTeammates: React.Dispatch<React.SetStateAction<TeammateState[]>>;
  setPlayerReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setTeammateReviveProgress: React.Dispatch<React.SetStateAction<number>>;
  setRevivingName: React.Dispatch<React.SetStateAction<string | null>>;

  // Real Multiplayer Prop
  socket?: WebSocket | null;
  roomId?: string;
  roomState?: any;
  clientId?: string;


}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  health,
  setHealth,
  points,
  setPoints,
  kills,
  setKills,
  currentRound,
  setCurrentRound,
  activeWeaponId,
  setActiveWeaponId,
  ammoClip,
  setAmmoClip,
  ammoReserve,
  setAmmoReserve,
  isADS,
  setIsADS,
  isReloading,
  setIsReloading,
  setHitmarker,
  setInteractMessage,
  addScorePopup,
  setShowWaveBanner,

  // Destructure Co-op props
  isCoop,
  setTeammates,
  setPlayerReviveProgress,
  setTeammateReviveProgress,
  setRevivingName,
  
  // Destructure Real Multiplayer Props
  socket,
  roomId,
  roomState,
  clientId
}) => {

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Inventory and Owned Weapons States
  const weaponsOwnedRef = useRef<string[]>(['pistol']);
  const weaponAmmoRef = useRef({
    pistol: { clip: 12, reserve: 60, maxClip: 12, maxReserve: 120 },
    shotgun: { clip: 0, reserve: 0, maxClip: 6, maxReserve: 48 },
  });
  
  // Refs to share reactive state with the Three.js render loop without overhead
  const stateRef = useRef({
    gameState,
    health,
    points,
    kills,
    currentRound,
    activeWeaponId,
    ammoClip,
    ammoReserve,
    isADS,
    isReloading,
    mouseSensitivity: 0.002,
    fov: 75,
    crosshairColor: '#22c55e',
    damageNumbers: true,
    // Perk flags
    hasFastHands: false,
    hasTomeOfPower: false,
  });

  // Real multiplayer tracking
  const remotePlayersRef = useRef<Map<string, {
    id: string;
    name: string;
    color: number;
    mesh: THREE.Group;
    state: 'ALIVE' | 'DOWNED' | 'DEAD';
    health: number;
    points: number;
    kills: number;
    activeWeapon: 'pistol' | 'shotgun';
  }>>(new Map());

  const lastUpdateSentTimeRef = useRef<number>(0);
  const lastZombieSyncTimeRef = useRef<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const roomStateRef = useRef<any>(null);
  const clientIdRef = useRef<string>('');

  useEffect(() => { socketRef.current = socket || null; }, [socket]);
  useEffect(() => { roomStateRef.current = roomState || null; }, [roomState]);
  useEffect(() => { clientIdRef.current = clientId || ''; }, [clientId]);

  // Sync state changes into ref for rendering threads
  useEffect(() => {
    stateRef.current.gameState = gameState;
    stateRef.current.health = health;
    stateRef.current.points = points;
    stateRef.current.kills = kills;
    stateRef.current.currentRound = currentRound;
    stateRef.current.activeWeaponId = activeWeaponId;
    stateRef.current.ammoClip = ammoClip;
    stateRef.current.ammoReserve = ammoReserve;
    stateRef.current.isADS = isADS;
    stateRef.current.isReloading = isReloading;
  }, [gameState, health, points, kills, currentRound, activeWeaponId, ammoClip, ammoReserve, isADS, isReloading]);

  useEffect(() => {
    // Listen for settings changes via modern custom events
    const handleSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (data) {
        if (data.controls?.sensitivity) {
          stateRef.current.mouseSensitivity = (data.controls.sensitivity / 10000) * 0.6;
        }
        if (data.graphics?.fov) {
          stateRef.current.fov = data.graphics.fov;
        }
        if (data.gameplay) {
          stateRef.current.crosshairColor = data.gameplay.crosshairColor ?? '#22c55e';
          stateRef.current.damageNumbers = data.gameplay.damageNumbers !== false;
        }
      }
    };

    window.addEventListener('settings-update', handleSettingsUpdate);
    
    // Read initial settings from localStorage if available
    const initial = localStorage.getItem('codz_settings');
    if (initial) {
      try {
        const parsed = JSON.parse(initial);
        if (parsed.controls?.sensitivity) {
          stateRef.current.mouseSensitivity = (parsed.controls.sensitivity / 10000) * 0.6;
        }
        if (parsed.graphics?.fov) {
          stateRef.current.fov = parsed.graphics.fov;
        }
        if (parsed.gameplay) {
          stateRef.current.crosshairColor = parsed.gameplay.crosshairColor ?? '#22c55e';
          stateRef.current.damageNumbers = parsed.gameplay.damageNumbers !== false;
        }
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('settings-update', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- SETUP THREEJS VIEWPORT ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0f11);
    // Dark moody volumetric classroom fog
    scene.fog = new THREE.FogExp2(0x090a0c, 0.026);

    const camera = new THREE.PerspectiveCamera(stateRef.current.fov, width / height, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: false });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Clear initial container children
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // --- 3D GLB MODEL DOWNLOADS & FALLBACK INTEGRATIONS ---
    const loaded3DModels = {
      zombie: null as THREE.Group | null,
      pistol: null as THREE.Group | null,
      shotgun: null as THREE.Group | null
    };

    const modelLoader = new GLTFLoader();
    
    modelLoader.load('/models/zombie.glb', (gltf) => {
      console.log('✓ SUCCESS: Custom Zombie 3D GLB model loaded.');
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      loaded3DModels.zombie = gltf.scene;
    }, undefined, () => { console.log('💡 Custom Zombie GLB fallback active.'); });

    modelLoader.load('/models/pistol.glb', (gltf) => {
      console.log('✓ SUCCESS: Custom Pistol 3D GLB model loaded.');
      loaded3DModels.pistol = gltf.scene;
      if (stateRef.current.activeWeaponId === 'pistol') updateActiveGunModel('pistol');
    }, undefined, () => { console.log('💡 Custom Pistol GLB fallback active.'); });

    modelLoader.load('/models/shotgun.glb', (gltf) => {
      console.log('✓ SUCCESS: Custom Shotgun 3D GLB model loaded.');
      loaded3DModels.shotgun = gltf.scene;
      if (stateRef.current.activeWeaponId === 'shotgun') updateActiveGunModel('shotgun');
    }, undefined, () => { console.log('💡 Custom Shotgun GLB fallback active.'); });

    // --- PROCEDURAL TEXTURES ---
    const wallTex = generateWornWallTexture();
    wallTex.repeat.set(4, 1);
    const floorTex = generateConcreteFloorTexture();
    floorTex.repeat.set(6, 6);
    const ceilingTex = generateCeilingTexture();
    ceilingTex.repeat.set(8, 8);
    const woodTex = generateWoodTexture();

    // --- MATERIALS ---
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0.05 });
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.78, metalness: 0.1 });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ map: ceilingTex, roughness: 0.92, metalness: 0.02 });
    const woodMaterial = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 });
    const blackMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.85 });
    const chalkboardMaterial = new THREE.MeshStandardMaterial({ color: 0x112d1b, roughness: 0.9 });
    const emissionGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const bloodSplashMat = new THREE.MeshBasicMaterial({ color: 0x991b1b, transparent: true, opacity: 0.85 });

    // --- MAP BUILDING BLOCK COORDINATES ---
    const CLASSROOM_W = 28;
    const CLASSROOM_D = 24;
    const WALL_H = 4.5;
    
    const HALLWAY_W = 10;
    const HALLWAY_D = 32;
    const HALLWAY_X_CENTER = 19;

    const halogenLights: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[] = [];

    const classroomObstacles: THREE.Box3[] = buildStaticMap(
      scene, 
      { wallMaterial, floorMaterial, ceilingMaterial, woodMaterial, blackMetalMaterial, chalkboardMaterial },
      halogenLights,
      []
    );

    // --- PERK MACHINES ---
    const tomePerk: PerkMachine = buildTomeOfPowerMachine(scene);
    const fastHandsPerk: PerkMachine = buildFastHandsMachine(scene);
    const perkMachines: PerkMachine[] = [tomePerk, fastHandsPerk];

    // --- BARRICADES & PARTICLES ---
    const barricadeDetails: Barricade[] = [];
    const particleList: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];
    const bulletTracers: { mesh: THREE.Line; age: number; maxAge: number }[] = [];

    // --- GROUND SPAWNERS ---
    const groundSpawners = [
      { x: -10.0, z: -8.0, label: 'Classroom NW' },
      { x: 10.0, z: -8.0, label: 'Classroom NE' },
      { x: -10.0, z: 8.0, label: 'Classroom SW' },
      { x: 10.0, z: 8.0, label: 'Classroom SE' },
      { x: -6.0, z: 1.0, label: 'Classroom West Side' },
      { x: 6.0, z: -1.0, label: 'Classroom East Side' },
      { x: 19.0, z: -12.0, label: 'Hallway North' },
      { x: 19.0, z: 12.0, label: 'Hallway South' }
    ];

    const triggerGravelEruption = (pos: THREE.Vector3) => {
      const pGeom = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const dirtMat = new THREE.MeshStandardMaterial({ color: 0x221a11, roughness: 0.95 });
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(pGeom, dirtMat);
        p.position.set(pos.x + (Math.random() - 0.5) * 1.2, 0.02, pos.z + (Math.random() - 0.5) * 1.2);
        scene.add(p);
        particleList.push({ mesh: p, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 2.0 + 1.2, (Math.random() - 0.5) * 1.5), age: 0, maxAge: 0.6 + Math.random() * 0.4 });
      }
    };

    const mapBoundingLimits = {
      minX: -CLASSROOM_W / 2 + 0.65, maxX: CLASSROOM_W / 2 - 0.65,
      minZ: -CLASSROOM_D / 2 + 0.65, maxZ: CLASSROOM_D / 2 - 0.65,
      hallMinX: 14.5, hallMaxX: HALLWAY_X_CENTER + HALLWAY_W/2 - 0.65,
      hallMinZ: -HALLWAY_D / 2 + 0.65, hallMaxZ: HALLWAY_D / 2 - 0.65,
    };

    // --- SHOTGUN WALL BUY ---
    const addShotgunWallbuy = (): WallBuy => {
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
      barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.018, 0.05, -0.1);
      shotgunG.add(barrelL);
      const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), blackMetalMaterial);
      barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.018, 0.05, -0.1);
      shotgunG.add(barrelR);
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.25), blackMetalMaterial);
      receiver.position.set(0, 0.05, 0.3);
      shotgunG.add(receiver);
      const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.035, 0.4), woodMaterial);
      pumpHandle.position.set(0, 0.02, 0.0);
      shotgunG.add(pumpHandle);
      const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.45), woodMaterial);
      woodenButt.position.set(0, -0.01, 0.6); woodenButt.rotation.x = -0.15;
      shotgunG.add(woodenButt);

      shotgunG.rotation.y = -Math.PI / 2;
      shotgunG.position.set(0, -0.12, 0.15);
      g.add(shotgunG);

      const wallBuyX = -CLASSROOM_W / 2 + 0.28;
      const wallBuyY = 1.7;
      const wallBuyZ = -1.5;
      g.position.set(wallBuyX, wallBuyY, wallBuyZ);
      g.rotation.y = Math.PI / 2;
      scene.add(g);

      return { id: 'wall-shotgun', weaponId: 'shotgun', position: [wallBuyX + 0.2, wallBuyY, wallBuyZ], rotationY: Math.PI / 2, price: 700, purchased: false, textMesh: g };
    };

    const shotgunWallBuy = addShotgunWallbuy();

    // --- BUYABLE DOOR ---
    const buildBuyableDoor = (): BuyableDoor => {
      const g = new THREE.Group();
      const width = 0.25, height = 3.6, dLength = 4.0;
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, dLength), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, metalness: 0.1 }));
      doorMesh.position.y = height / 2;
      doorMesh.castShadow = true;
      g.add(doorMesh);

      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512; signCanvas.height = 128;
      const sc = signCanvas.getContext('2d')!;
      sc.fillStyle = 'rgba(0,0,0,0.85)'; sc.fillRect(0,0,512,128);
      sc.strokeStyle = '#22c55e'; sc.lineWidth = 6; sc.strokeRect(4,4,504,120);
      sc.fillStyle = '#22c55e'; sc.font = 'bold 38px Courier New'; sc.textAlign = 'center';
      sc.fillText('DOOR', 256, 45); sc.font = 'bold 28px Courier New';
      sc.fillText('Press E to Open [$1200]', 256, 95);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const buySignOverlay = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.75), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true }));
      buySignOverlay.position.set(-0.25, 3.2, 0); buySignOverlay.rotation.y = -Math.PI / 2;
      g.add(buySignOverlay);

      const dX = CLASSROOM_W / 2, dY = 0, dZ = 0;
      g.position.set(dX, dY, dZ);
      scene.add(g);

      return { id: 'door-classroom-exit', price: 1200, position: [dX, dY, dZ], rotationY: 0, width, height, purchased: false, group: g, doorMesh, sinkOffset: 0 };
    };

    const classroomExitDoor = buildBuyableDoor();
    let doorBlockerBox = new THREE.Box3().setFromObject(classroomExitDoor.doorMesh!);

    // --- TEAMMATE MESH BUILDER ---
    const designTeammateMesh = (clothesColor: number): THREE.Group => {
       const g = new THREE.Group();
       const shirtMat = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.75 });
       const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d2c3d, roughness: 0.8 });
       const skinMat = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.85 });
       const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
       const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat);
       torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
       const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
       head.position.y = 1.55; head.castShadow = true; g.add(head);
       const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), hairMat);
       hair.position.set(0, 1.7, 0.02); g.add(hair);
       const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMat);
       armL.position.set(-0.35, 1.1, 0.05); armL.castShadow = true; g.add(armL);
       const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMat);
       armR.position.set(0.35, 1.1, 0.15); armR.rotation.x = -Math.PI / 3; armR.castShadow = true; g.add(armR);
       const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.26), jeansMat);
       legs.position.y = 0.355; legs.castShadow = true; g.add(legs);
       const gunMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.5 });
       const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.32), gunMat);
       gunBox.position.set(0.35, 1.1, 0.45); gunBox.rotation.x = -Math.PI / 18; g.add(gunBox);
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
      spawnZombieHelper(spawnerIdx, groundSpawners, zombieGroup, activeZombiesList, camera.position, stateRef.current.currentRound, loaded3DModels.zombie);
    };

    let roundTransitionActive = false;
    let roundKillsRemaining = 0;
    let zombiesLeftToSpawn = 0;
    let spawnTimer = 0;

    const startNextRoundWave = () => {
      if (roundTransitionActive) return;
      roundTransitionActive = true;
      setShowWaveBanner(true);
      sound.playWaveStart();
      setTimeout(() => {
        setShowWaveBanner(false);
        roundTransitionActive = false;
        const zCount = Math.floor(8 + stateRef.current.currentRound * 3.5);
        zombiesLeftToSpawn = zCount;
        roundKillsRemaining = zCount;
        spawnTimer = 0;
      }, 4000);
    };

    startNextRoundWave();
    startNextRoundWave();

    // --- BLOOD FX ---
    const triggerBloodExplosion = (pos: THREE.Vector3) => {
      const pGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(pGeom, bloodSplashMat);
        p.position.copy(pos);
        scene.add(p);
        particleList.push({ mesh: p, vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 3.0 + 1.0, (Math.random() - 0.5) * 2.5), age: 0, maxAge: 0.5 + Math.random() * 0.4 });
      }
    };

    const triggerBulletTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
      const material = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, transparent: true, opacity: 0.85 });
      const geom = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
      const line = new THREE.Line(geom, material);
      scene.add(line);
      bulletTracers.push({ mesh: line, age: 0, maxAge: 0.08 });
    };

    // --- FLOATING DAMAGE NUMBERS ---
    const floatingDmgNumbers: { element: HTMLSpanElement; pos: THREE.Vector3; age: number; maxAge: number }[] = [];

    const createFloatingDamageNumber = (pos: THREE.Vector3, text: string, type: 'hit' | 'headshot-hit' | 'kill' | 'headshot-kill' = 'hit') => {
      if (!stateRef.current.damageNumbers) return;
      const el = document.createElement('span');
      if (type === 'headshot-kill') {
        el.className = 'absolute font-black text-sm md:text-base font-mono pointer-events-none select-none z-30 transition-all duration-300 transform -translate-x-1/2 text-yellow-400 drop-shadow-[0_2px_10px_rgba(234,179,8,1)] uppercase tracking-widest font-bold';
      } else if (type === 'kill') {
        el.className = 'absolute font-black text-xs md:text-sm font-mono pointer-events-none select-none z-30 transition-all duration-300 transform -translate-x-1/2 text-white drop-shadow-[0_1px_5px_rgba(220,38,38,0.9)] uppercase tracking-wide font-bold';
      } else if (type === 'headshot-hit') {
        el.className = 'absolute font-bold text-xs md:text-sm font-mono pointer-events-none select-none z-30 transition-all duration-300 transform -translate-x-1/2 text-yellow-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]';
      } else {
        el.className = 'absolute font-bold text-xs md:text-sm font-mono pointer-events-none select-none z-30 transition-all duration-300 transform -translate-x-1/2 text-green-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]';
      }
      el.textContent = text;
      document.body.appendChild(el);
      floatingDmgNumbers.push({ element: el, pos: pos.clone(), age: 0, maxAge: 0.75 });
    };

    // --- PLAYER ---
    const pVelocity = new THREE.Vector3();
    const pDirection = new THREE.Vector3();
    camera.position.set(0, 1.65, 2.5);

    let lastInteractionPulse = 0;
    let lastDamageTime = 0;
    let playerReviveTimer = 0;
    let pYaw = 0;
    let pPitch = 0;
    const recoilOffset = { x: 0, y: 0 };
    const maxRecoilOffset = { x: 0, y: 0 };
    let gunRecoilZOffset = 0;

    const keysMap: Record<string, boolean> = {};

    const handlePointerLock = () => {
      if (stateRef.current.gameState === 'playing') {
        try {
          const promise = containerRef.current?.requestPointerLock();
          if (promise && typeof promise.catch === 'function') promise.catch((err) => { console.warn("Pointer lock request ignored or deferred:", err); });
        } catch (err) { console.warn("Pointer lock error caught synchronously in canvas:", err); }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      if (stateRef.current.gameState !== 'playing') return;
      const sensMult = stateRef.current.isADS ? 0.45 : 1.0;
      pYaw -= e.movementX * stateRef.current.mouseSensitivity * sensMult;
      pPitch -= e.movementY * stateRef.current.mouseSensitivity * sensMult;
      pPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pPitch));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysMap[e.code] = true;
      if (e.code === 'KeyR' && !stateRef.current.isReloading) triggerWeaponReload();
      if (e.code === 'KeyE' && stateRef.current.gameState === 'playing') processInteractEvent();
      if (e.code === 'Digit1' && stateRef.current.activeWeaponId !== 'pistol') swapWeapon('pistol');
      if (e.code === 'Digit2' && stateRef.current.activeWeaponId !== 'shotgun') swapWeapon('shotgun');
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
      setAmmoClip(prev => {
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
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.02;
        gunRecoilZOffset = 0.12;
      } else {
        sound.playShotgun();
        fireCooldownLeft = 0.85;
        maxRecoilOffset.y += 0.088;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.04;
        gunRecoilZOffset = 0.28;
      }

      if (isCoop && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'player-shoot', wpnId: id }));
      }

      const flashGeo = new THREE.CylinderGeometry(0.01, 0.08, 0.22, 6);
      flashGeo.rotateX(Math.PI / 2);
      const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffe285, transparent: true, opacity: 0.9 }));
      flash.position.set(0.12, -0.11, -0.44);
      camera.add(flash);
      setTimeout(() => camera.remove(flash), 50);

      const raycaster = new THREE.Raycaster();
      const numPellets = id === 'shotgun' ? 7 : 1;
      const spreadParam = stateRef.current.isADS ? 0.015 : (id === 'shotgun' ? 0.065 : 0.022);

      for (let i = 0; i < numPellets; i++) {
        const targetDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (i > 0 || id === 'shotgun')