import { generateWornWallTexture, generateConcreteFloorTexture, generateCeilingTexture, generateWoodTexture } from '../map/textures';
import { buildStaticMap } from './mapBuilder';
import { spawnSingleZombie as spawnZombieHelper } from '../entities/zombies';
import { buildPistolGroup, buildShotgunGroup } from '../weapons/models';
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
    // This allows the user to drop customized .glb files into their /public/models/ directory
    // (e.g., /public/models/zombie.glb, /public/models/pistol.glb, /public/models/shotgun.glb)
    const loaded3DModels = {
      zombie: null as THREE.Group | null,
      pistol: null as THREE.Group | null,
      shotgun: null as THREE.Group | null
    };

    const modelLoader = new GLTFLoader();
    
    // Load Zombie custom GLB if available
    modelLoader.load(
      '/models/zombie.glb',
      (gltf) => {
        console.log('✓ SUCCESS: Custom Zombie 3D GLB model loaded.');
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        loaded3DModels.zombie = gltf.scene;
      },
      undefined,
      () => {
        console.log('💡 Custom Zombie GLB fallback active. To load your own custom 3D zombie model, place a "zombie.glb" inside the "/public/models/" folder.');
      }
    );

    // Load Pistol custom GLB if available
    modelLoader.load(
      '/models/pistol.glb',
      (gltf) => {
        console.log('✓ SUCCESS: Custom Pistol 3D GLB model loaded.');
        loaded3DModels.pistol = gltf.scene;
        if (stateRef.current.activeWeaponId === 'pistol') {
          updateActiveGunModel('pistol');
        }
      },
      undefined,
      () => {
        console.log('💡 Custom Pistol GLB fallback active. To load your own custom 3D pistol model, place a "pistol.glb" inside the "/public/models/" folder.');
      }
    );

    // Load Shotgun custom GLB if available
    modelLoader.load(
      '/models/shotgun.glb',
      (gltf) => {
        console.log('✓ SUCCESS: Custom Shotgun 3D GLB model loaded.');
        loaded3DModels.shotgun = gltf.scene;
        if (stateRef.current.activeWeaponId === 'shotgun') {
          updateActiveGunModel('shotgun');
        }
      },
      undefined,
      () => {
        console.log('💡 Custom Shotgun GLB fallback active. To load your own custom 3D shotgun model, place a "shotgun.glb" inside the "/public/models/" folder.');
      }
    );

    // --- PROCEDURAL TEXTURES ---
   
    

    const wallTex = generateWornWallTexture();
    wallTex.repeat.set(4, 1); // Correct vertical striping mapping
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
    const chalkboardMaterial = new THREE.MeshStandardMaterial({ color: 0x112d1b, roughness: 0.9 }); // School dark green boards
    const emissionGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const bloodSplashMat = new THREE.MeshBasicMaterial({ color: 0x991b1b, transparent: true, opacity: 0.85 });

    // --- MAP BUILDING BLOCK COORDINATES ---
    const CLASSROOM_W = 28;
    const CLASSROOM_D = 24;
    const WALL_H = 4.5;
    
    // Connected Hallway dimensions (rotated 90 degrees to run horizontal/North-South along Z)
    const HALLWAY_W = 10;
    const HALLWAY_D = 32;
    const HALLWAY_X_CENTER = 19; // Hallway spans x = 14 to x = 24 past the exit doorway

    // Lights group list to trigger flicker

    // Call our new map builder and get the obstacles array back
    // Declare the lights array BEFORE passing it in
    const halogenLights: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[] = [];

    // Call our new map builder and properly type the returned obstacles array
    const classroomObstacles: THREE.Box3[] = buildStaticMap(
      scene, 
      { wallMaterial, floorMaterial, ceilingMaterial, woodMaterial, blackMetalMaterial, chalkboardMaterial },
      halogenLights,
      []
    );
    // --- WINDOWS WITH REPAIRABLE BARRICADES ---
    // Barricades prevent immediate zombie intrusion. Spawning walks to barricades. Destroying boards first.
    const barricadeDetails: Barricade[] = [];
    
    // --- PARTICLE / IMPACT SPRAY DETAILS POOL ---
    const particleList: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];
    const bulletTracers: { mesh: THREE.Line; age: number; maxAge: number }[] = [];

    // --- DEAD BELL CINEMATIC GROUND SPAWNERS ---
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
      const dirtMat = new THREE.MeshStandardMaterial({ color: 0x221a11, roughness: 0.95 }); // dark floor tile / soil debris
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(pGeom, dirtMat);
        p.position.set(pos.x + (Math.random() - 0.5) * 1.2, 0.02, pos.z + (Math.random() - 0.5) * 1.2);
        scene.add(p);
        
        particleList.push({
          mesh: p,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            Math.random() * 2.0 + 1.2,
            (Math.random() - 0.5) * 1.5
          ),
          age: 0,
          maxAge: 0.6 + Math.random() * 0.4
        });
      }
    };

    // Dynamic obstacle mapping from map structures
    // Add peripheral boundary bounds to avoid getting clipped outside classroom walls
    const mapBoundingLimits = {
      minX: -CLASSROOM_W / 2 + 0.65,
      maxX: CLASSROOM_W / 2 - 0.65,
      minZ: -CLASSROOM_D / 2 + 0.65,
      maxZ: CLASSROOM_D / 2 - 0.65,
      
      // Hallway bounding box
      hallMinX: 14.5,
      hallMaxX: HALLWAY_X_CENTER + HALLWAY_W/2 - 0.65,
      hallMinZ: -HALLWAY_D / 2 + 0.65,
      hallMaxZ: HALLWAY_D / 2 - 0.65,
    };

    // --- EXPONENTIAL SHOTGUN WALL BUY SETUP ---
    const addShotgunWallbuy = (): WallBuy => {
      const g = new THREE.Group();
      
      // Floating glowing label green
      const buySign = new THREE.Group();
      const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
      buySign.add(wallSign);
      
      const frameBuy = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.02), emissionGreen);
      frameBuy.position.z = -0.01;
      buySign.add(frameBuy);
      
      buySign.position.set(0, 0.4, 0);
      g.add(buySign);

      // Render actual double barrel shotgun model replica on wall
      const shotgunG = new THREE.Group();
      
      const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), blackMetalMaterial);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.018, 0.05, -0.1);
      shotgunG.add(barrelL);

      const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), blackMetalMaterial);
      barrelR.rotation.x = Math.PI / 2;
      barrelR.position.set(0.018, 0.05, -0.1);
      shotgunG.add(barrelR);
      
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.25), blackMetalMaterial);
      receiver.position.set(0, 0.05, 0.3);
      shotgunG.add(receiver);

      const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.035, 0.4), woodMaterial);
      pumpHandle.position.set(0, 0.02, 0.0);
      shotgunG.add(pumpHandle);

      const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.45), woodMaterial);
      woodenButt.position.set(0, -0.01, 0.6);
      woodenButt.rotation.x = -0.15;
      shotgunG.add(woodenButt);

      // Rotate shotgun itself to lie flat along the West Wall (parallel to global Z axis)
      shotgunG.rotation.y = -Math.PI / 2;
      // Position shotgun model 15cm outward from the wall inside the classroom space
      shotgunG.position.set(0, -0.12, 0.15);
      g.add(shotgunG);

      // Positioning wall buy on classroom West Wall (face of wall is at X = -13.75)
      const wallBuyX = -CLASSROOM_W / 2 + 0.28; 
      const wallBuyY = 1.7;
      const wallBuyZ = -1.5;
      
      g.position.set(wallBuyX, wallBuyY, wallBuyZ);
      g.rotation.y = Math.PI / 2; // Face inwards (+X direction)
      scene.add(g);

      return {
        id: 'wall-shotgun',
        weaponId: 'shotgun',
        position: [wallBuyX + 0.2, wallBuyY, wallBuyZ], // Actual interaction boundary slightly offset into play space
        rotationY: Math.PI / 2,
        price: 700,
        purchased: false,
        textMesh: g
      };
    };

    const shotgunWallBuy = addShotgunWallbuy();

    // --- SOLID BUYABLE DOOR OBSTACLE SYSTEM ---
    const buildBuyableDoor = (): BuyableDoor => {
      const g = new THREE.Group();

      // Double side swinging doors on classroom Exit Border (x = 14)
      const width = 0.25;
      const height = 3.6;
      const dLength = 4.0;

      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, dLength),
        new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, metalness: 0.1 })
      );
      doorMesh.position.y = height / 2;
      doorMesh.castShadow = true;
      g.add(doorMesh);

      // Large glowing green floating text banner above buyable doors matching standard specs
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
      buySignOverlay.rotation.y = -Math.PI / 2; // Facing the classroom player
      g.add(buySignOverlay);

      // Sits on classroom eastern doorway threshold
      const dX = CLASSROOM_W / 2;
      const dY = 0;
      const dZ = 0;

      g.position.set(dX, dY, dZ);
      scene.add(g);

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

    const classroomExitDoor = buildBuyableDoor();

    // Register active door blocker collision
    let doorBlockerBox = new THREE.Box3().setFromObject(classroomExitDoor.doorMesh!);

    // --- PROCEDURAL TEAMMATES CHASSIS DESIGNER ---
    const designTeammateMesh = (clothesColor: number): THREE.Group => {
       const g = new THREE.Group();
       const shirtMat = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.75 });
       const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d2c3d, roughness: 0.8 });
       const skinMat = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.85 });
       const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });

       // Torso
       const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat);
       torso.position.y = 1.05;
       torso.castShadow = true;
       g.add(torso);

       // Head
       const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
       head.position.y = 1.55;
       head.castShadow = true;
       g.add(head);

       // Hair
       const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), hairMat);
       hair.position.set(0, 1.7, 0.02);
       g.add(hair);

       // Left arm
       const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMat);
       armL.position.set(-0.35, 1.1, 0.05);
       armL.castShadow = true;
       g.add(armL);

       // Right arm holding gun
       const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), skinMat);
       armR.position.set(0.35, 1.1, 0.15);
       armR.rotation.x = -Math.PI / 3;
       armR.castShadow = true;
       g.add(armR);

       // Legs
       const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.26), jeansMat);
       legs.position.y = 0.355;
       legs.castShadow = true;
       g.add(legs);

       // Gun barrel representation
       const gunMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.5 });
       const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.32), gunMat);
       gunBox.position.set(0.35, 1.1, 0.45);
       gunBox.rotation.x = -Math.PI / 18;
       g.add(gunBox);

       return g;
    };

    // Since we are running real multiplayer, we keep activeTeammatesList empty here.
    // It will be filled dynamically inside the animation loop from real remote connections.
    const activeTeammatesList: any[] = [];
    const teammatesGroup = new THREE.Group();
    scene.add(teammatesGroup);

    // --- ZOMBIES H Horde IMPLEMENTATION ---
    // --- ZOMBIES H Horde IMPLEMENTATION ---
    const activeZombiesList: Zombie[] = [];
    const zombieGroup = new THREE.Group();
    scene.add(zombieGroup);

    // We use a tiny wrapper here so we don't have to rewrite the rest of your game loop!
    const spawnSingleZombie = (spawnerIdx: number) => {
      spawnZombieHelper(
        spawnerIdx,
        groundSpawners,
        zombieGroup,
        activeZombiesList,
        camera.position,
        stateRef.current.currentRound,
        loaded3DModels.zombie
      );
    };

    // Trigger next wave mechanics
    let roundTransitionActive = false;
    let roundKillsRemaining = 0;
    let zombiesLeftToSpawn = 0;
    let spawnTimer = 0;

    const startNextRoundWave = () => {
      if (roundTransitionActive) return;
      roundTransitionActive = true;
      
      // Display large wave transition overlay card plus atmospheric synth sound
      setShowWaveBanner(true);
      sound.playWaveStart();

      setTimeout(() => {
        setShowWaveBanner(false);
        roundTransitionActive = false;
        
        // Spawn sizing equation matching cod formulas
        const zCount = Math.floor(8 + stateRef.current.currentRound * 3.5);
        zombiesLeftToSpawn = zCount;
        roundKillsRemaining = zCount;
        spawnTimer = 0;
      }, 4000);
    };

    // Trigger initial round spawning setup
    startNextRoundWave();
    // Trigger initial round spawning setup
    startNextRoundWave();

    // --- BLOOD EXPLOSION SPLASH FX ---
    const triggerBloodExplosion = (pos: THREE.Vector3) => {
      const pGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(pGeom, bloodSplashMat);
        p.position.copy(pos);
        scene.add(p);
        
        particleList.push({
          mesh: p,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 2.5,
            Math.random() * 3.0 + 1.0,
            (Math.random() - 0.5) * 2.5
          ),
          age: 0,
          maxAge: 0.5 + Math.random() * 0.4
        });
      }
    };

    const triggerBulletTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
      const material = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, transparent: true, opacity: 0.85 });
      const pointsList = [start.clone(), end.clone()];
      const geom = new THREE.BufferGeometry().setFromPoints(pointsList);
      const line = new THREE.Line(geom, material);
      scene.add(line);
      bulletTracers.push({
        mesh: line,
        age: 0,
        maxAge: 0.08
      });
    };

    // Dynamic 3D Floating Combat Damage Numbers Above Zombies (Arcade classic styling)
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
      
      floatingDmgNumbers.push({
        element: el,
        pos: pos.clone(),
        age: 0,
        maxAge: 0.75
      });
    };

    // --- PLAYER STATS / CHARACTER RIGID ENGINE ---
    const pVelocity = new THREE.Vector3();
    const pDirection = new THREE.Vector3();
    const posOffsetAdjust = new THREE.Vector3();

    // Spawn coordinate centered in classroom
    camera.position.set(0, 1.65, 2.5);

    let lastInteractionPulse = 0;
    let lastDamageTime = 0;
    let playerReviveTimer = 0;

    let pYaw = 0;
    let pPitch = 0;
    const recoilOffset = { x: 0, y: 0 };
    const maxRecoilOffset = { x: 0, y: 0 };
    let gunRecoilZOffset = 0;

    // --- CONTROLLER BINDINGS ---
    const keysMap: Record<string, boolean> = {};

    const handlePointerLock = () => {
      if (stateRef.current.gameState === 'playing') {
        try {
          const promise = containerRef.current?.requestPointerLock();
          if (promise && typeof promise.catch === 'function') {
            promise.catch((err) => {
              console.warn("Pointer lock request ignored or deferred:", err);
            });
          }
        } catch (err) {
          console.warn("Pointer lock error caught synchronously in canvas:", err);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      if (stateRef.current.gameState !== 'playing') return;

      const sensMult = stateRef.current.isADS ? 0.45 : 1.0;
      const lookDeltaX = e.movementX * stateRef.current.mouseSensitivity * sensMult;
      const lookDeltaY = e.movementY * stateRef.current.mouseSensitivity * sensMult;

      pYaw -= lookDeltaX;
      pPitch -= lookDeltaY;
      pPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pPitch));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysMap[e.code] = true;

      if (e.code === 'KeyR' && !stateRef.current.isReloading) {
        // Trigger manual weapon reload mechanism
        triggerWeaponReload();
      }

      if (e.code === 'KeyE' && stateRef.current.gameState === 'playing') {
        processInteractEvent();
      }

      // Quick hotkeys weapon swap matching standard console stats
      if (e.code === 'Digit1' && stateRef.current.activeWeaponId !== 'pistol') {
        swapWeapon('pistol');
      }
      if (e.code === 'Digit2' && stateRef.current.activeWeaponId !== 'shotgun') {
        swapWeapon('shotgun');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysMap[e.code] = false;
    };

    // --- FIREWEAPON LOGIC ---
    let fireCooldownLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      if (stateRef.current.gameState !== 'playing') return;

      if (e.button === 0) {
        // LEFT CLICK: Shoot Weapon
        triggerShootWeapon();
      }
      if (e.button === 2) {
        // RIGHT CLICK: Aim Down Sights
        setIsADS(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        setIsADS(false);
      }
    };

    const triggerShootWeapon = () => {
      if (fireCooldownLeft > 0 || stateRef.current.isReloading) return;
      if (stateRef.current.ammoClip <= 0) {
        sound.playReloadClick(0.3); // trigger dry fire click
        return;
      }

      const id = stateRef.current.activeWeaponId;
      setAmmoClip(prev => {
        const next = Math.max(0, prev - 1);
        stateRef.current.ammoClip = next;
        weaponAmmoRef.current[id].clip = next;
        return next;
      });

      // SFX
      if (id === 'pistol') {
        sound.playPistol();
        fireCooldownLeft = 0.25; // 250ms fire rate
        // Add random slight look recoil kickback
        maxRecoilOffset.y += 0.035;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.02;
        gunRecoilZOffset = 0.12; // Pistol kickback z-axis offset
      } else {
        sound.playShotgun();
        fireCooldownLeft = 0.85; // 850ms fire rate
        maxRecoilOffset.y += 0.088;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.04;
        gunRecoilZOffset = 0.28; // Shotgun massive kickback z-axis offset
      }

      // Send multiplayer shoot sync packet over WS
      if (isCoop && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'player-shoot',
          wpnId: id
        }));
      }

      // --- FX OVERLAYS ---
      // 1. Muzzle flash 3D cylinder
      const flashGeo = new THREE.CylinderGeometry(0.01, 0.08, 0.22, 6);
      flashGeo.rotateX(Math.PI / 2);
      const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffe285, transparent: true, opacity: 0.9 }));
      flash.position.set(0.12, -0.11, -0.44);
      camera.add(flash);
      setTimeout(() => camera.remove(flash), 50);

      // 2. Perform Raycasting hit tests
      const raycaster = new THREE.Raycaster();
      const numPellets = id === 'shotgun' ? 7 : 1;
      const spreadParam = stateRef.current.isADS ? 0.015 : (id === 'shotgun' ? 0.065 : 0.022);

      for (let i = 0; i < numPellets; i++) {
        const targetDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        // Apply slight inaccurate spread deviation
        if (i > 0 || id === 'shotgun') {
          targetDir.x += (Math.random() - 0.5) * spreadParam;
          targetDir.y += (Math.random() - 0.5) * spreadParam;
          targetDir.z += (Math.random() - 0.5) * spreadParam;
          targetDir.normalize();
        }

        raycaster.set(camera.position, targetDir);

        // Check objects hits in zombie groups
        const possibleGroupHits = raycaster.intersectObjects(zombieGroup.children, true);
        if (possibleGroupHits.length > 0) {
          const hit = possibleGroupHits[0];
          let parentMesh: THREE.Object3D | null = hit.object;
          
          // Climb up hierarchy to find master Zombie Group Object3D
          while (parentMesh && parentMesh.parent && parentMesh.parent !== zombieGroup) {
            parentMesh = parentMesh.parent;
          }

          if (parentMesh) {
            const zId = parentMesh.uuid;
            const targetZ = activeZombiesList.find(z => z.mesh.uuid === zId);
            
            if (targetZ && targetZ.health > 0) {
              const baseDmg = id === 'pistol' ? 24 : 18; // Shotgun deals pellet damage
              
              // Headshot and critical damage computation
              const isHeadshot = hit.object.name === 'head' || (hit.point.y - parentMesh.position.y) > 1.35;
              const finalDmg = isHeadshot ? baseDmg * 2 : baseDmg;
              
              targetZ.health -= finalDmg;

              // Send multiplayer hit sync packet over WS
              if (isCoop && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: 'zombie-damage',
                  zombieId: targetZ.id,
                  damage: finalDmg,
                  isFatal: targetZ.health <= 0
                }));
              }

              // Register points and play impact sounds
              triggerZombieHit(targetZ, finalDmg, hit.point, isHeadshot);
            }
          }
        } else {
          // Trigger default wall spark tracer line endpoint
          const tracerDest = camera.position.clone().add(targetDir.multiplyScalar(22));
          triggerBulletTracer(camera.position.clone().add(new THREE.Vector3(0.12, -0.15, -0.45).applyQuaternion(camera.quaternion)), tracerDest);
        }
      }
    };

    const triggerZombieHit = (z: Zombie, val: number, point: THREE.Vector3, isHeadshot: boolean = false) => {
      sound.playHitmarker();
      setHitmarker(isHeadshot || z.health <= 0 ? 'kill' : 'hit');
      setTimeout(() => setHitmarker(null), 100);

      triggerBloodExplosion(point);
      triggerBulletTracer(camera.position.clone().add(new THREE.Vector3(0.12, -0.15, -0.45).applyQuaternion(camera.quaternion)), point);

      // Score points additions - Survival Points Reward Engine
      const ptsReward = isHeadshot ? 15 : 10;
      setPoints(prev => {
        const next = prev + ptsReward;
        stateRef.current.points = next;
        return next;
      });

      // Floating Cash and popup on hit
      addScorePopup(ptsReward, `+${ptsReward} Cash`);
      createFloatingDamageNumber(point, `+${ptsReward} Cash`, isHeadshot ? 'headshot-hit' : 'hit');

      if (z.health <= 0) {
        // Dispatched zombie! Add kill bonus
        const killReward = isHeadshot ? 120 : 60;
        setPoints(prev => {
          const next = prev + killReward;
          stateRef.current.points = next;
          return next;
        });

        // Award kill reward and text notifications
        addScorePopup(killReward, `+${killReward} Cash`);
        addScorePopup(killReward, isHeadshot ? `Headshot Kill` : `Bodyshot Kill`);
        createFloatingDamageNumber(z.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), isHeadshot ? 'Headshot Kill' : 'Bodyshot Kill', isHeadshot ? 'headshot-kill' : 'kill');

        setKills(prev => {
          const next = prev + 1;
          stateRef.current.kills = next;
          return next;
        });

        // Kill Animation
        zombieGroup.remove(z.mesh);
        activeZombiesList.splice(activeZombiesList.indexOf(z), 1);
        roundKillsRemaining = Math.max(0, roundKillsRemaining - 1);

        // Play zombie collapse death sfx
        sound.playHitImpact();

        // Check if wave is cleared
        const isHost = !isCoop || (roomStateRef.current && roomStateRef.current.hostId === clientIdRef.current);
        if (isHost && roundKillsRemaining <= 0 && zombiesLeftToSpawn <= 0) {
          stateRef.current.currentRound++;
          setCurrentRound(stateRef.current.currentRound);
          startNextRoundWave();
        }
      }
    };

    const triggerWeaponReload = () => {
      const id = stateRef.current.activeWeaponId;
      const maxClip = id === 'pistol' ? 12 : 6;
      if (stateRef.current.ammoClip === maxClip || stateRef.current.ammoReserve <= 0) return;

      setIsReloading(true);
      sound.playReloadClick(0.85);

      setTimeout(() => {
        const needed = maxClip - stateRef.current.ammoClip;
        const insert = Math.min(needed, stateRef.current.ammoReserve);
        
        const newClip = stateRef.current.ammoClip + insert;
        const newReserve = stateRef.current.ammoReserve - insert;

        setAmmoClip(newClip);
        stateRef.current.ammoClip = newClip;

        setAmmoReserve(newReserve);
        stateRef.current.ammoReserve = newReserve;

        // Persist back to inventory IMMEDIATELY!
        weaponAmmoRef.current[id].clip = newClip;
        weaponAmmoRef.current[id].reserve = newReserve;

        setIsReloading(false);
        sound.playReloadClick(1.2);
      }, id === 'pistol' ? 1500 : 2200);
    };

    const swapWeapon = (target: 'pistol' | 'shotgun') => {
      if (stateRef.current.isReloading) return;
      
      // Prevent players from switching to weapons they do not own!
      if (!weaponsOwnedRef.current.includes(target)) {
        return;
      }

      // Save current weapon's ammo state before switching!
      const current = stateRef.current.activeWeaponId;
      weaponAmmoRef.current[current].clip = stateRef.current.ammoClip;
      weaponAmmoRef.current[current].reserve = stateRef.current.ammoReserve;

      // Switch active weapon
      setActiveWeaponId(target);
      stateRef.current.activeWeaponId = target;
      
      // Load target weapon's ammo state!
      const targetAmmo = weaponAmmoRef.current[target];
      setAmmoClip(targetAmmo.clip);
      stateRef.current.ammoClip = targetAmmo.clip;
      setAmmoReserve(targetAmmo.reserve);
      stateRef.current.ammoReserve = targetAmmo.reserve;
      
      // Trigger visual model switch
      updateActiveGunModel(target);

      // Trigger a smooth selection bob-in animation by pulling weapon back/down
      gunRecoilZOffset = 0.35;

      sound.playReloadClick(0.7);
    };

    // --- INTERACT PROMPT SENSORS & TRIGGER LOGIC ---
    const processInteractEvent = () => {
      // 1. Barricade repairing is completely removed!

      // 2. Buy shotgun wall buy or refill ammo
      const distanceToWallbuy = camera.position.distanceTo(new THREE.Vector3(...shotgunWallBuy.position));
      if (distanceToWallbuy <= 2.45) {
        // If they already own the shotgun, Wall Buy REFILLS shotgun reserve ammo for $350 instead of buying it again
        if (weaponsOwnedRef.current.includes('shotgun')) {
          const refillPrice = 350;
          if (stateRef.current.points >= refillPrice) {
            setPoints(p => {
              const next = p - refillPrice;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-refillPrice, `-$350 Ammo`);
            
            // Set max reserve
            const targetAmmo = weaponAmmoRef.current['shotgun'];
            const maxReserve = targetAmmo.maxReserve;
            
            targetAmmo.reserve = maxReserve;
            if (stateRef.current.activeWeaponId === 'shotgun') {
              setAmmoReserve(maxReserve);
              stateRef.current.ammoReserve = maxReserve;
            }
            sound.playBuy();
          } else {
            sound.playReloadClick(0.35); // reject beep
          }
        } else {
          // Buying shotgun for the first time
          if (stateRef.current.points >= shotgunWallBuy.price) {
            setPoints(p => {
              const next = p - shotgunWallBuy.price;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-shotgunWallBuy.price, `-$700 Shotgun`);
            shotgunWallBuy.purchased = true;
            weaponsOwnedRef.current.push('shotgun'); // Add to inventory OWNED!
            
            // Initialize shotgun ammo state persistent ref
            weaponAmmoRef.current.shotgun.clip = 6;
            weaponAmmoRef.current.shotgun.reserve = 24;

            sound.playBuy();
            swapWeapon('shotgun');
          } else {
            sound.playReloadClick(0.35); // reject beep
          }
        }
        return;
      }

      // 3. Purchase buyable door to access hallway
      const distanceToDoor = camera.position.distanceTo(new THREE.Vector3(...classroomExitDoor.position));
      if (distanceToDoor <= 3.2 && !classroomExitDoor.purchased) {
        if (stateRef.current.points >= classroomExitDoor.price) {
          setPoints(p => {
            const next = p - classroomExitDoor.price;
            stateRef.current.points = next;
            return next;
          });
          addScorePopup(-classroomExitDoor.price, `-$1200 Gate Unlock`);
          classroomExitDoor.purchased = true;
          sound.playBuy();
          
          // Smoothly remove the door barrier
          // Door Group is removed from collision bounds below
          classroomExitDoor.sinkOffset = 0.01;
        } else {
          sound.playReloadClick(0.35);
        }
      }
    };

    // Listen on container interactions
    containerRef.current.addEventListener('click', handlePointerLock);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Dynamic weapon positioning sway inside camera frame
    const activeGunModel = new THREE.Group();

    // Function to dynamically design and replace the weapon model in the group
const updateActiveGunModel = (weaponId: 'pistol' | 'shotgun') => {
      while(activeGunModel.children.length > 0){ 
          activeGunModel.remove(activeGunModel.children[0]); 
      }

      // We are recreating the missing paint materials right here!
      const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.85 });
      const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2c3d, roughness: 0.9 });
      const watchStrapsMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
      const watchBezelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 });
      const watchGlassMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.4 });

      const deps = {
        skinMaterial,
        watchStrapsMat,
        watchBezelMat,
        watchGlassMat,
        sleeveMaterial,
        woodTex,
        loaded3DModels
      };

      if (weaponId === 'pistol') {
        activeGunModel.add(buildPistolGroup(deps));
      } else {
        activeGunModel.add(buildShotgunGroup(deps));
      }
    };

    updateActiveGunModel('pistol');

    camera.add(activeGunModel);
   
    // Add dynamic weapon flashlight bound straight to the client viewport camera
    const flashlight = new THREE.SpotLight(0xfffdf4, 4.2, 26, Math.PI / 4.5, 0.45, 0.82);
    flashlight.position.set(0.12, -0.15, -0.4); // Sits right alongside the gun body
    flashlight.castShadow = true;
    flashlight.shadow.bias = -0.0015;
    flashlight.shadow.mapSize.width = 512;
    flashlight.shadow.mapSize.height = 512;
    camera.add(flashlight);

    // Build static target anchor forward in virtual space to orient the light cone
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0.12, -0.15, -10.0);
    camera.add(flashlightTarget);
    flashlight.target = flashlightTarget;

    scene.add(camera);

    // --- MAIN HIGH FREQUENCY TICK / PHYSICS RENDER LOOP ---
    const clock = new THREE.Clock();
    let animFrameId: number;

    const gameTick = () => {
      animFrameId = requestAnimationFrame(gameTick);
      if (stateRef.current.gameState !== 'playing') {
        renderer.render(scene, camera);
        return;
      }

      const d = Math.min(clock.getDelta(), 0.1); // Clamp physics lag
      const time = clock.getElapsedTime();

      // Real-time peer player mesh synchronization and HUD state push
      activeTeammatesList.length = 0;
      if (isCoop && roomStateRef.current && roomStateRef.current.players) {
        Object.keys(roomStateRef.current.players).forEach(pId => {
          if (pId === clientIdRef.current) return; // Skip self representation
          const pData = roomStateRef.current.players[pId];
          
          let peer = remotePlayersRef.current.get(pId);
          if (!peer) {
            // Spawn dynamic 3D graphic mesh body
            const mesh = designTeammateMesh(pData.color || 0xf97316);
            scene.add(mesh);
            peer = {
              id: pId,
              name: pData.name,
              color: pData.color,
              mesh,
              state: pData.isDowned ? 'DOWNED' : 'ALIVE',
              health: pData.health,
              points: pData.points,
              kills: pData.kills,
              activeWeapon: pData.weapon || 'pistol'
            };
            remotePlayersRef.current.set(pId, peer);
          }
          
          // Smooth delta position updates
          peer.mesh.position.lerp(new THREE.Vector3(pData.x || 0, pData.y || 4.1, pData.z || 0), d * 15);
          peer.mesh.rotation.y = pData.ry || 0;
          peer.state = pData.isDowned ? 'DOWNED' : 'ALIVE';
          peer.health = pData.health;
          peer.points = pData.points;
          peer.kills = pData.kills;
          peer.activeWeapon = pData.weapon || 'pistol';
          
          if (peer.state === 'DOWNED') {
            peer.mesh.position.y = -0.4;
            peer.mesh.rotation.z = Math.PI / 2.5;
          } else {
            peer.mesh.position.y = 0;
            peer.mesh.rotation.z = 0;
          }
          
          activeTeammatesList.push(peer);
        });
        
        // Remove left peers
        remotePlayersRef.current.forEach((peer, pId) => {
          if (!roomStateRef.current.players[pId]) {
            scene.remove(peer.mesh);
            remotePlayersRef.current.delete(pId);
          }
        });
        
        // Push actual players to React state sidebar
        setTeammates(activeTeammatesList.map(tm => ({
          id: tm.id,
          name: tm.name,
          color: tm.color,
          health: tm.health,
          maxHealth: 100,
          points: tm.points,
          state: tm.state,
          activeWeapon: tm.activeWeapon
        })));
      }

      // Send local state updates over the socket throttled to once every 45ms
      if (isCoop && socketRef.current && socketRef.current.readyState === WebSocket.OPEN && roomId) {
        const lastSent = lastUpdateSentTimeRef.current;
        const nowMs = performance.now();
        if (nowMs - lastSent > 45) {
          lastUpdateSentTimeRef.current = nowMs;
          
          let activeRevivee: string | null = null;
          if (keysMap.KeyE) {
            activeTeammatesList.forEach(tm => {
              if (tm.state === 'DOWNED' && camera.position.distanceTo(tm.mesh.position) <= 1.95) {
                activeRevivee = tm.name;
              }
            });
          }

          socketRef.current.send(JSON.stringify({
            type: 'player-update',
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            rx: camera.rotation.x,
            ry: camera.rotation.y,
            rz: camera.rotation.z,
            weapon: activeWeaponId,
            health: health,
            points: points,
            kills: kills,
            isADS: isADS,
            isReloading: isReloading,
            isDowned: health <= 0,
            isReviving: activeRevivee
          }));
        }
      }

      // Periodic drift/lerp correction for zombies if we are active host
      const isHost = !isCoop || (roomStateRef.current && roomStateRef.current.hostId === clientIdRef.current);
      if (isCoop && isHost && socketRef.current && socketRef.current.readyState === WebSocket.OPEN && roomId) {
        const lastZSync = lastZombieSyncTimeRef.current;
        const nowMs = performance.now();
        if (nowMs - lastZSync > 75) {
          lastZombieSyncTimeRef.current = nowMs;
          const zombiesSync = activeZombiesList
            .filter(z => z.state !== 'dead')
            .map(z => ({
              id: z.id,
              x: z.mesh.position.x,
              y: z.mesh.position.y,
              z: z.mesh.position.z,
              hp: z.health,
              state: z.state
            }));
          socketRef.current.send(JSON.stringify({
            type: 'sync-state',
            zombies: zombiesSync,
            currentRound: stateRef.current.currentRound
          }));
        }
      }

      // Decrement firearm fire rates
      if (fireCooldownLeft > 0) {
        fireCooldownLeft -= d;
      }

      // --- 1. SINK BUYABLE DOOR MODEL ANIMATION ---
      if (classroomExitDoor.purchased && classroomExitDoor.group.position.y > -WALL_H) {
        classroomExitDoor.group.position.y -= d * 3.5; // Smooth sink sliding down animation
        if (classroomExitDoor.group.position.y <= -WALL_H) {
          scene.remove(classroomExitDoor.group);
        }
      }

      // --- 2. PLAYER LOOK INTERPOLATIONS & CAM CAMERA RIG ---
      // Recoil kick smooth recovery
      recoilOffset.x = THREE.MathUtils.lerp(recoilOffset.x, maxRecoilOffset.x, d * 18);
      recoilOffset.y = THREE.MathUtils.lerp(recoilOffset.y, maxRecoilOffset.y, d * 18);
      maxRecoilOffset.x = THREE.MathUtils.lerp(maxRecoilOffset.x, 0, d * 12);
      maxRecoilOffset.y = THREE.MathUtils.lerp(maxRecoilOffset.y, 0, d * 12);

      camera.rotation.order = 'YXZ';
      camera.rotation.y = pYaw + recoilOffset.x;
      camera.rotation.x = pPitch + recoilOffset.y;

      // Adjust field of view smoothly depending on Aim Down Sight toggle
      const fovGoal = stateRef.current.isADS ? stateRef.current.fov - 15 : stateRef.current.fov;
      camera.fov = THREE.MathUtils.lerp(camera.fov, fovGoal, d * 15);
      camera.updateProjectionMatrix();

      // Gun recoil translation kickback animation lerped smoothly back to rest
      gunRecoilZOffset = THREE.MathUtils.lerp(gunRecoilZOffset, 0, d * 14);

      const walking = (keysMap.KeyW || keysMap.KeyS || keysMap.KeyA || keysMap.KeyD);
      const weaponSprinting = keysMap.ShiftLeft && (keysMap.KeyW || keysMap.KeyS || keysMap.KeyA || keysMap.KeyD) && !stateRef.current.isADS;

      let targetGunX = stateRef.current.isADS ? -0.12 : 0.08;
      let targetGunY = -0.12;
      if (stateRef.current.isADS) {
        // Lower weapon slightly and align iron sights to exact center coordinate
        targetGunY = stateRef.current.activeWeaponId === 'shotgun' ? 0.114 : 0.095;
      }
      let targetGunZ = stateRef.current.isADS ? -0.18 + gunRecoilZOffset * 0.45 : -0.22 + gunRecoilZOffset;

      if (!stateRef.current.isADS) {
        if (weaponSprinting) {
          const sprintCycle = time * 9.5;
          targetGunX += Math.sin(sprintCycle) * 0.012;
          targetGunY += Math.abs(Math.cos(sprintCycle)) * 0.015 - 0.01;
          targetGunZ += Math.sin(sprintCycle) * 0.008;
        } else if (walking) {
          const walkCycle = time * 6.0;
          targetGunX += Math.sin(walkCycle) * 0.006;
          targetGunY += Math.abs(Math.cos(walkCycle)) * 0.005 - 0.003;
        }
      }

      activeGunModel.position.x = THREE.MathUtils.lerp(activeGunModel.position.x, targetGunX, d * 12);
      activeGunModel.position.y = THREE.MathUtils.lerp(activeGunModel.position.y, targetGunY, d * 12);
      activeGunModel.position.z = THREE.MathUtils.lerp(activeGunModel.position.z, targetGunZ, d * 12);

      // Rotational weapon animations (Reloading tilt/dipping and Sprint swaying)
      let targetGunRotX = 0;
      let targetGunRotY = 0;
      let targetGunRotZ = 0;

      if (stateRef.current.isReloading) {
        // Dip and tilt weapon sideways physically for mechanical reloading visual feedback
        targetGunRotX = -0.55;
        targetGunRotY = 0.35;
        targetGunRotZ = -0.15;
      } else if (weaponSprinting) {
        // Sway/bounce weapons when run-sprinting
        const sprintBobCycle = Math.sin(time * 9.5);
        targetGunRotX = 0.10 + Math.abs(sprintBobCycle) * 0.05;
        targetGunRotY = -0.15 + sprintBobCycle * 0.03;
        targetGunRotZ = sprintBobCycle * 0.04;
      } else if (walking) {
        // Gentle walking passive weapon sway bob
        const walkBob = Math.sin(time * 6.0);
        targetGunRotX = walkBob * 0.02;
        targetGunRotY = walkBob * 0.02;
        targetGunRotZ = walkBob * 0.015;
      }

      activeGunModel.rotation.x = THREE.MathUtils.lerp(activeGunModel.rotation.x, targetGunRotX, d * 10);
      activeGunModel.rotation.y = THREE.MathUtils.lerp(activeGunModel.rotation.y, targetGunRotY, d * 10);
      activeGunModel.rotation.z = THREE.MathUtils.lerp(activeGunModel.rotation.z, targetGunRotZ, d * 10);

      // --- 3. CLASSROOM ACCELERATIONS MOTION ENGINE ---
      const isPlayerDowned = stateRef.current.health <= 0;
      const moveFwd = keysMap.KeyW ? 1 : keysMap.KeyS ? -1 : 0;
      const moveRight = keysMap.KeyD ? 1 : keysMap.KeyA ? -1 : 0;
      const sprinting = keysMap.ShiftLeft && moveFwd > 0 && !stateRef.current.isADS && !isPlayerDowned;

      pDirection.set(0, 0, 0);
      const camYawCos = Math.cos(pYaw);
      const camYawSin = Math.sin(pYaw);

      if (moveFwd !== 0) {
        // Project direction locked on floor plane
        pDirection.x += -camYawSin * moveFwd;
        pDirection.z += -camYawCos * moveFwd;
      }
      if (moveRight !== 0) {
        pDirection.x += camYawCos * moveRight;
        pDirection.z += -camYawSin * moveRight;
      }
      pDirection.normalize();

      const calculatedBaseSpeed = isPlayerDowned ? 1.1 : (sprinting ? 7.2 : 4.4);
      pVelocity.x = pDirection.x * calculatedBaseSpeed;
      pVelocity.z = pDirection.z * calculatedBaseSpeed;

      // Vertical gravity
      const groundHeight = isPlayerDowned ? 0.55 : 1.65;
      if (camera.position.y > groundHeight) {
        pVelocity.y -= 18.0 * d;
      } else {
        pVelocity.y = 0;
        camera.position.y = groundHeight;
        if (keysMap.Space && stateRef.current.gameState === 'playing' && !isPlayerDowned) {
          pVelocity.y = 5.2; // Jump force kick
        }
      }

      // Translate coordinates smoothly
      camera.position.x += pVelocity.x * d;
      camera.position.y += pVelocity.y * d;
      camera.position.z += pVelocity.z * d;

      // --- 4. MAP COLLISION DECISION SOLVER ---
      // Hard bounds limits to avoid getting out of maps
      const limit = mapBoundingLimits;
      
      if (classroomExitDoor.purchased) {
        // Classroom + Door transitional zone + Hallway zone form ONE single connected playable space!
        // Rebuilt the collision boundaries cleanly to remove any invisible walls and teleport logic.
        const inClassroom = camera.position.x <= 13.2;
        const inHallway = camera.position.x >= 14.3;
        
        if (inClassroom) {
          camera.position.x = Math.max(limit.minX, camera.position.x);
          camera.position.z = Math.max(limit.minZ, Math.min(limit.maxZ, camera.position.z));
        } else if (inHallway) {
          camera.position.x = Math.min(limit.hallMaxX, camera.position.x);
          camera.position.z = Math.max(limit.hallMinZ, Math.min(limit.hallMaxZ, camera.position.z));
        } else {
          // Transitional doorway zone (13.2 < x < 14.3)
          // Allow full natural passage, clamping Z to the door width aperture
          camera.position.z = Math.max(-1.75, Math.min(1.75, camera.position.z));
        }
      } else {
        // Locked inside main classroom bounds
        camera.position.x = Math.max(limit.minX, Math.min(limit.maxX, camera.position.x));
        camera.position.z = Math.max(limit.minZ, Math.min(limit.maxZ, camera.position.z));

        // Prevent walking past exit door threshold if locked
        if (camera.position.x > 13.15) {
          camera.position.x = 13.15;
        }
      }

      // Check simple radial collisions with student tables
      classroomObstacles.forEach(obs => {
        const pRadius = 0.5;
        const testPos = new THREE.Vector3(camera.position.x, 0.4, camera.position.z);
        if (obs.containsPoint(testPos)) {
          // Push player backwards
          const delta = new THREE.Vector3().subVectors(testPos, obs.getCenter(new THREE.Vector3())).normalize();
          camera.position.x += delta.x * 0.15;
          camera.position.z += delta.z * 0.15;
        }
      });

      // --- HEALTH REGENERATION ENGINE ---
      if (time - lastDamageTime > 4.5 && stateRef.current.health > 0 && stateRef.current.health < 100) {
        setHealth(prev => {
          const next = Math.min(100, prev + 35 * d);
          stateRef.current.health = next;
          return next;
        });
      }

      // --- PLAYER ALLY REVIVING ACTION ---
      let isAnyReviveActivated = false;
      if (isCoop && stateRef.current.health > 0) {
        activeTeammatesList.forEach(tm => {
          if (tm.state === 'DOWNED') {
            const checkDist = camera.position.distanceTo(tm.mesh.position);
            if (checkDist <= 1.95) {
              if (keysMap.KeyE) {
                isAnyReviveActivated = true;
                playerReviveTimer += d;
                setTeammateReviveProgress(Math.min(99, Math.floor((playerReviveTimer / 3.0) * 100)));
                setRevivingName(tm.name);

                if (playerReviveTimer >= 3.0) {
                  tm.state = 'ALIVE';
                  tm.health = 100;
                  tm.mesh.rotation.z = 0;
                  tm.mesh.position.y = 0;
                  playerReviveTimer = 0;
                  setTeammateReviveProgress(-1);
                  setRevivingName(null);
                  sound.playBuy(); // success sound
                  addScorePopup(150, `REVIVED ${tm.name.toUpperCase()}!`);
                }
              }
            }
          }
        });
      }

      if (!isAnyReviveActivated) {
         playerReviveTimer = 0;
         setTeammateReviveProgress(-1);
      }

      // --- 5. ZOMBIE SPANNER & PATH GENERATION CONTROL ---
      const isSpawnHost = !isCoop || (roomStateRef.current && roomStateRef.current.hostId === clientIdRef.current);
      if (isSpawnHost && zombiesLeftToSpawn > 0 && !roundTransitionActive) {
        spawnTimer += d;
        if (spawnTimer >= 1.85) { // Spawn every 1.85 seconds
          spawnTimer = 0;
          // Determine active ground spawners based on door purchase
          const maxSpawnIndex = classroomExitDoor.purchased ? 8 : 6;
          const spawnerIdx = Math.floor(Math.random() * maxSpawnIndex);
          spawnSingleZombie(spawnerIdx);
          zombiesLeftToSpawn = Math.max(0, zombiesLeftToSpawn - 1);
        }
      }

      // --- 6. UNDEAD MOTION AI, COLLISION ENGINE & CO-OP SQUAD TARGETING ---
      activeZombiesList.forEach(z => {
        z.animTime += d;

        if (z.state === 'spawning') {
          // Creepy ground rise crawling animation
          if (z.mesh.position.y < 0.0) {
            z.mesh.position.y += 1.0 * d; // rise slow & cinematic
            
            // Spawn debris popping out from floor while breaking surface
            if (Math.random() < 0.15) {
              triggerGravelEruption(z.mesh.position);
            }

            // Ominous zombie crawl animation (swinging arms dynamically up/down)
            const climbSway = Math.sin(z.animTime * 8.0);
            z.mesh.children[3].rotation.x = -Math.PI / 3 + climbSway * 0.8; // Left Arm crawls
            z.mesh.children[4].rotation.x = -Math.PI / 3 - climbSway * 0.8; // Right arm crawls
          } else {
            z.mesh.position.y = 0.0;
            z.state = 'chasing';
          }
        } else {
          // Under active pursuit tracking player or bot coordinates
          let targetPos = camera.position.clone();
          let distanceToTarget = z.mesh.position.distanceTo(camera.position);

          const isPlayerDowned = stateRef.current.health <= 0;
          if (isCoop && activeTeammatesList.length > 0) {
            activeTeammatesList.forEach(tm => {
              if (tm.state === 'ALIVE' || (tm.state === 'DOWNED' && isPlayerDowned)) {
                const distToBot = z.mesh.position.distanceTo(tm.mesh.position);
                // Prioritize alive target or closer downed target
                if (distToBot < distanceToTarget) {
                  distanceToTarget = distToBot;
                  targetPos = tm.mesh.position.clone();
                }
              }
            });
          }

          const dirToTarget = new THREE.Vector3().subVectors(targetPos, z.mesh.position);
          dirToTarget.y = 0; // lock vector on floor plane
          const distanceXY = dirToTarget.length();
          dirToTarget.normalize();

          // Smooth rotation looking at their target
          z.mesh.lookAt(new THREE.Vector3(targetPos.x, 0.0, targetPos.z));

          if (distanceXY > 1.1) {
            z.mesh.position.addScaledVector(dirToTarget, z.speed * d);
            
            // Walk animation: simple offset sin wave swaying shoulder limbs
            const walkSway = Math.sin(z.animTime * 6.5);
            z.mesh.children[3].rotation.x = -Math.PI / 1.8 + walkSway * 0.15; // Left Arm swing
            z.mesh.children[4].rotation.x = -Math.PI / 1.8 - walkSway * 0.15; // Right Arm swing
          } else {
            // Close attack contact!
            const attackInt = time - z.lastAttackTime;
            if (attackInt >= 1.25) {
              z.lastAttackTime = time;
              // Swipe arms animation
              z.mesh.children[3].rotation.x = -Math.PI / 0.8;
              setTimeout(() => {
                if (z.mesh && z.mesh.children[3]) {
                  z.mesh.children[3].rotation.x = -Math.PI / 1.81;
                }
              }, 200);

              // Inflict damage to whichever target is in range
              const playerPosH = new THREE.Vector3(camera.position.x, 0, camera.position.z);
              const zombiePosH = new THREE.Vector3(z.mesh.position.x, 0, z.mesh.position.z);
              const distToPlayer = zombiePosH.distanceTo(playerPosH);

              let closestBot: BotTeammate | null = null;
              let minBotDist = 999;
              if (isCoop) {
                activeTeammatesList.forEach(tm => {
                  if (tm.state !== 'DEAD') {
                    const botPosH = new THREE.Vector3(tm.mesh.position.x, 0, tm.mesh.position.z);
                    const dBot = zombiePosH.distanceTo(botPosH);
                    if (dBot < minBotDist) {
                      minBotDist = dBot;
                      closestBot = tm;
                    }
                  }
                });
              }

              const attackTargetBot = (isCoop && closestBot && minBotDist < distToPlayer && minBotDist <= 1.35);
              const attackTargetPlayer = (!attackTargetBot && distToPlayer <= 1.35 && stateRef.current.health > 0);

              let hitWall = false;
              if (attackTargetBot || attackTargetPlayer) {
                const origin = z.mesh.position.clone();
                origin.y = 0.5; // check mid-height
                
                const targetCenter = attackTargetBot ? (closestBot as unknown as BotTeammate).mesh.position.clone() : camera.position.clone();
                targetCenter.y = 0.5; // same height
                
                const rayDir = new THREE.Vector3().subVectors(targetCenter, origin);
                const targetDist = rayDir.length();
                rayDir.normalize();
                
                const ray = new THREE.Ray(origin, rayDir);
                for (const obs of classroomObstacles) {
                  const intersectPt = new THREE.Vector3();
                  if (ray.intersectBox(obs, intersectPt)) {
                    const distToWall = origin.distanceTo(intersectPt);
                    if (distToWall < targetDist) {
                      hitWall = true;
                      break;
                    }
                  }
                }
              }

              if (!hitWall) {
                if (attackTargetBot && closestBot) {
                  // Inflict bot damage!
                  const targetBot = closestBot as BotTeammate;
                  targetBot.health = Math.max(0, targetBot.health - z.damage);
                  if (targetBot.health <= 0 && targetBot.state === 'ALIVE') {
                    targetBot.state = 'DOWNED';
                    targetBot.downedTime = time;
                    targetBot.health = 100; // Reset as downed bleed out progress tracker
                    targetBot.mesh.rotation.z = Math.PI / 2.5; // fall over
                    sound.playHitImpact();
                    addScorePopup(0, `${targetBot.name.toUpperCase()} DOWNED!`);
                  }
                } else if (attackTargetPlayer) {
                  // Inflict player damage
                  lastDamageTime = time;
                  setHealth(prev => {
                    const updated = Math.max(0, prev - z.damage);
                    stateRef.current.health = updated;
                    sound.playHitImpact();
                    if (updated <= 0) {
                      if (isCoop) {
                        addScorePopup(0, `YOU ARE DOWNED!`);
                        camera.position.y = 0.55; // crawling perspective
                        if (stateRef.current.activeWeaponId !== 'pistol') {
                          swapWeapon('pistol');
                        }
                      } else {
                        // Solo direct gameover
                        setGameState('gameover');
                        document.exitPointerLock();
                      }
                    }
                    return updated;
                  });
                }
              }
            }
          }

          // --- ZOMBIE TO CLASSROOM DESK COLLISIONS ---
          classroomObstacles.forEach(obs => {
            const zPos = new THREE.Vector3(z.mesh.position.x, 0.4, z.mesh.position.z);
            if (obs.containsPoint(zPos)) {
              const pushBack = new THREE.Vector3().subVectors(zPos, obs.getCenter(new THREE.Vector3())).normalize();
              pushBack.y = 0;
              z.mesh.position.addScaledVector(pushBack, 0.15);
            }
          });

          // Locked exit door boundary collisions for zombies
          if (!classroomExitDoor.purchased && z.mesh.position.x > 13.15) {
            z.mesh.position.x = 13.15;
          }

          // --- ZOMBIE-TO-ZOMBIE CO-ACCELERATION RESOLVER ---
          activeZombiesList.forEach(otherZ => {
            if (z.id !== otherZ.id && z.state !== 'dead' && otherZ.state !== 'dead') {
              const dist = z.mesh.position.distanceTo(otherZ.mesh.position);
              if (dist < 0.65) {
                const pushDir = new THREE.Vector3().subVectors(z.mesh.position, otherZ.mesh.position).normalize();
                pushDir.y = 0;
                z.mesh.position.addScaledVector(pushDir, 0.25 * d);
              }
            }
          });
        }
      });

      // --- 6.5 SQUAD CO-OP AI TEAMMATES ENGINE ---
      if (isCoop && activeTeammatesList.length > 0) {
        // Evaluate unified wipes: Are ALL players downed or dead?
        const allTeammatesDownedOrDead = activeTeammatesList.every(tm => tm.state === 'DOWNED' || tm.state === 'DEAD');
        if (isPlayerDowned && allTeammatesDownedOrDead) {
          setGameState('gameover');
          document.exitPointerLock();
        }

        activeTeammatesList.forEach(tm => {
          if (tm.state === 'DEAD') {
            tm.mesh.visible = false;
            return;
          }

          // Downed bot teammate bleed-out checks
          if (tm.state === 'DOWNED') {
            tm.mesh.position.y = -0.4;
            tm.mesh.rotation.z = Math.PI / 2.5;

            const downedElapsed = time - tm.downedTime;
            const bleedOutPercent = Math.max(0, 100 - (downedElapsed / 45) * 100);
            tm.health = Math.floor(bleedOutPercent); // health reflects bleed-out progress

            if (bleedOutPercent <= 0) {
              tm.state = 'DEAD';
              tm.mesh.visible = false;
              addScorePopup(0, `${tm.name.toUpperCase()} HAS BLED OUT!`);
            }

            // Down downed defensive shooting AI
            if (time - tm.lastShotTime > 1.4) {
              let closeZombie: Zombie | null = null;
              let bestDist = 6.0;
              activeZombiesList.forEach(z => {
                if (z.state !== 'dead' && z.mesh) {
                  const dst = tm.mesh.position.distanceTo(z.mesh.position);
                  if (dst < bestDist) {
                    bestDist = dst;
                    closeZombie = z;
                  }
                }
              });

              if (closeZombie) {
                const activeZombie = closeZombie as Zombie;
                tm.lastShotTime = time;
                tm.mesh.lookAt(new THREE.Vector3(activeZombie.mesh.position.x, tm.mesh.position.y, activeZombie.mesh.position.z));
                activeZombie.health -= 35; // default pistol bullet damage
                sound.playHitImpact();

                // Draw bullet tracer line
                const tracerGeo = new THREE.BufferGeometry();
                const pts = [
                  tm.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
                  activeZombie.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0))
                ];
                tracerGeo.setFromPoints(pts);
                const tracerLine = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xeab308, linewidth: 2 }));
                scene.add(tracerLine);
                setTimeout(() => scene.remove(tracerLine), 65);

                if (activeZombie.health <= 0) {
                  activeZombie.state = 'dead';
                  zombieGroup.remove(activeZombie.mesh);
                  tm.points += 100;
                  setKills(k => k + 1);
                  addScorePopup(100, `ALLY PISTOL KILL`);
                } else {
                  tm.points += 10;
                }
              }
            }
            return; // skip standard active followers routines
          }

          // Stand upright status
          tm.mesh.visible = true;
          tm.mesh.position.y = 0;
          tm.mesh.rotation.z = 0;

          // Check if there are Downing allies that need rescuing
          let reviveTargetBot: BotTeammate | null = null;
          let reviveTargetPlayer = false;

          if (isPlayerDowned) {
            const distToPlayer = tm.mesh.position.distanceTo(camera.position);
            if (distToPlayer < 9.5) {
              reviveTargetPlayer = true;
            }
          }

          if (!reviveTargetPlayer) {
            activeTeammatesList.forEach(other => {
              if (other.id !== tm.id && other.state === 'DOWNED') {
                const distToOther = tm.mesh.position.distanceTo(other.mesh.position);
                if (distToOther < 9.5) {
                  reviveTargetBot = other;
                }
              }
            });
          }

          // Squad loyal action: Rushing for immediate revive
          if (reviveTargetPlayer) {
            const distToPlayer = tm.mesh.position.distanceTo(camera.position);
            if (distToPlayer > 1.25) {
              const dir = new THREE.Vector3().subVectors(camera.position, tm.mesh.position);
              dir.y = 0;
              dir.normalize();
              tm.mesh.position.addScaledVector(dir, 3.2 * d);
              tm.mesh.lookAt(new THREE.Vector3(camera.position.x, tm.mesh.position.y, camera.position.z));

              const sSway = Math.sin(time * 9.0);
              tm.mesh.children[3].rotation.x = -Math.PI / 4 + sSway * 0.35;
              tm.mesh.children[4].rotation.x = -Math.PI / 3 - sSway * 0.35;
              setPlayerReviveProgress(-1);
              tm.reviveTimer = 0;
            } else {
              tm.mesh.lookAt(new THREE.Vector3(camera.position.x, tm.mesh.position.y, camera.position.z));
              tm.reviveTimer += d;
              setPlayerReviveProgress(Math.min(99, Math.floor((tm.reviveTimer / 3.5) * 100)));
              setRevivingName(tm.name);

              if (tm.reviveTimer >= 3.5) {
                setHealth(100);
                stateRef.current.health = 100;
                setPlayerReviveProgress(-1);
                setRevivingName(null);
                tm.reviveTimer = 0;
                addScorePopup(150, `REVIVED BY ${tm.name.toUpperCase()}!`);
              }
            }
          } else if (reviveTargetBot) {
            const targetBot = reviveTargetBot as BotTeammate;
            const distToBot = tm.mesh.position.distanceTo(targetBot.mesh.position);
            if (distToBot > 1.25) {
              const dir = new THREE.Vector3().subVectors(targetBot.mesh.position, tm.mesh.position);
              dir.y = 0;
              dir.normalize();
              tm.mesh.position.addScaledVector(dir, 3.2 * d);
              tm.mesh.lookAt(new THREE.Vector3(targetBot.mesh.position.x, tm.mesh.position.y, targetBot.mesh.position.z));

              const sSway = Math.sin(time * 9.0);
              tm.mesh.children[3].rotation.x = -Math.PI / 4 + sSway * 0.35;
              tm.mesh.children[4].rotation.x = -Math.PI / 3 - sSway * 0.35;
              tm.reviveTimer = 0;
            } else {
              tm.mesh.lookAt(new THREE.Vector3(targetBot.mesh.position.x, tm.mesh.position.y, targetBot.mesh.position.z));
              tm.reviveTimer += d;
              if (tm.reviveTimer >= 3.5) {
                targetBot.state = 'ALIVE';
                targetBot.health = 100;
                targetBot.mesh.rotation.z = 0;
                targetBot.mesh.position.y = 0;
                tm.reviveTimer = 0;
                addScorePopup(0, `${tm.name} REVIVED ${targetBot.name}!`);
              }
            }
          } else {
            // No downed targets! Defend and Follow systems
            setPlayerReviveProgress(-1);

            // Purchase weapons upgrade checking:
            if (tm.points >= 1200 && tm.activeWeapon === 'pistol') {
               tm.activeWeapon = 'shotgun';
               tm.points -= 1200;
               const oldGun = tm.mesh.children[tm.mesh.children.length - 1];
               tm.mesh.remove(oldGun);
               
               const shotMesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.44), new THREE.MeshStandardMaterial({ color: 0x543c2c, roughness: 0.8 }));
               shotMesh.position.set(0.35, 1.1, 0.45);
               shotMesh.rotation.x = -Math.PI / 18;
               tm.mesh.add(shotMesh);
               addScorePopup(0, `${tm.name} BOUGHT SHOTGUN!`);
            }

            // Find nearest zombie in 18 meters
            let targetZ: Zombie | null = null;
            let minZDist = 18.0;
            activeZombiesList.forEach(z => {
              if (z.state !== 'dead' && z.mesh) {
                const dst = tm.mesh.position.distanceTo(z.mesh.position);
                if (dst < minZDist) {
                  minZDist = dst;
                  targetZ = z;
                }
              }
            });

            if (targetZ) {
              const activeZombie = targetZ as Zombie;
              tm.mesh.lookAt(new THREE.Vector3(activeZombie.mesh.position.x, tm.mesh.position.y, activeZombie.mesh.position.z));

              // Back-pedalling defensive strafes
              if (minZDist < 3.0) {
                const backDir = new THREE.Vector3().subVectors(tm.mesh.position, activeZombie.mesh.position);
                backDir.y = 0;
                backDir.normalize();
                tm.mesh.position.addScaledVector(backDir, 1.85 * d);
              }

              const weaponInterval = tm.activeWeapon === 'shotgun' ? 1.65 : 0.85;
              if (time - tm.lastShotTime > weaponInterval) {
                 tm.lastShotTime = time;
                 const isShotgun = tm.activeWeapon === 'shotgun';
                 const dmgDealt = isShotgun ? 95 : 35;
                 activeZombie.health -= dmgDealt;

                 if (isShotgun) {
                    sound.playReloadClick(0.6); // shot pop
                 } else {
                    sound.playReloadClick(1.0);
                 }

                 // Golden Tracer visual line
                 const tracerGeo = new THREE.BufferGeometry();
                 const pts = [
                   tm.mesh.position.clone().add(new THREE.Vector3(0.35, 1.1, 0.2)),
                   activeZombie.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0))
                 ];
                 tracerGeo.setFromPoints(pts);
                 const tracerMat = new THREE.LineBasicMaterial({ color: isShotgun ? 0xf59e0b : 0xeab308, linewidth: 3 });
                 const tracerLine = new THREE.Line(tracerGeo, tracerMat);
                 scene.add(tracerLine);
                 setTimeout(() => scene.remove(tracerLine), 60);

                 if (activeZombie.health <= 0) {
                   activeZombie.state = 'dead';
                   zombieGroup.remove(activeZombie.mesh);
                   tm.points += 100;
                   setKills(k => k + 1);
                   addScorePopup(100, `ALLY KILL`);
                 } else {
                   tm.points += 10;
                 }
              }
            } else {
              // Idle follow player to regroup
              const dToPlayer = tm.mesh.position.distanceTo(camera.position);
              if (dToPlayer > 5.5) {
                const approachDir = new THREE.Vector3().subVectors(camera.position, tm.mesh.position);
                approachDir.y = 0;
                approachDir.normalize();
                tm.mesh.position.addScaledVector(approachDir, 2.3 * d);
                tm.mesh.lookAt(new THREE.Vector3(camera.position.x, tm.mesh.position.y, camera.position.z));

                const wSway = Math.sin(time * 5.5);
                tm.mesh.children[3].rotation.x = wSway * 0.22;
                tm.mesh.children[4].rotation.x = -wSway * 0.22 - Math.PI/4;
              }
            }
          }

          // Enforce maps hard physical constraints bounds on AI bots
          const limit = mapBoundingLimits;
          const inClassroom = tm.mesh.position.x <= 13.2;
          const inHallway = tm.mesh.position.x >= 14.3;
          if (classroomExitDoor.purchased) {
            if (inClassroom) {
              tm.mesh.position.x = Math.max(limit.minX, tm.mesh.position.x);
              tm.mesh.position.z = Math.max(limit.minZ, Math.min(limit.maxZ, tm.mesh.position.z));
            } else if (inHallway) {
              tm.mesh.position.x = Math.min(limit.hallMaxX, tm.mesh.position.x);
              tm.mesh.position.z = Math.max(limit.hallMinZ, Math.min(limit.hallMaxZ, tm.mesh.position.z));
            } else {
              tm.mesh.position.z = Math.max(-1.75, Math.min(1.75, tm.mesh.position.z));
            }
          } else {
            tm.mesh.position.x = Math.max(limit.minX, Math.min(limit.maxX, tm.mesh.position.x));
            tm.mesh.position.z = Math.max(limit.minZ, Math.min(limit.maxZ, tm.mesh.position.z));
            if (tm.mesh.position.x > 13.15) {
              tm.mesh.position.x = 13.15;
            }
          }

          // Desk boundaries collisions for AI bots
          classroomObstacles.forEach(obs => {
            const botPos = new THREE.Vector3(tm.mesh.position.x, 0.4, tm.mesh.position.z);
            if (obs.containsPoint(botPos)) {
              const pushBack = new THREE.Vector3().subVectors(botPos, obs.getCenter(new THREE.Vector3())).normalize();
              pushBack.y = 0;
              tm.mesh.position.addScaledVector(pushBack, 0.15);
            }
          });
        });

        // Sync state back to React HUD container
        setTeammates(activeTeammatesList.map(tm => ({
          id: tm.id,
          name: tm.name,
          color: tm.color,
          health: tm.health,
          maxHealth: tm.maxHealth,
          points: tm.points,
          state: tm.state,
          activeWeapon: tm.activeWeapon
        })));
      }

      // --- 7. BIND INTERACTION HOVER HUD ALERTS ---
      let matchLabel: string | null = null;
      const ticks = time;

      if (ticks - lastInteractionPulse >= 0.18) {
        lastInteractionPulse = ticks;

        // Proximity checks
        const checkDoor = camera.position.distanceTo(new THREE.Vector3(...classroomExitDoor.position));
        const checkBuy = camera.position.distanceTo(new THREE.Vector3(...shotgunWallBuy.position));

        // Evaluate downed teammate co-op prompt
        let reviveTarget: BotTeammate | null = null;
        if (isCoop) {
          activeTeammatesList.forEach(tm => {
            if (tm.state === 'DOWNED') {
              const dToBot = camera.position.distanceTo(tm.mesh.position);
              if (dToBot <= 1.95) {
                reviveTarget = tm;
              }
            }
          });
        }

        if (reviveTarget) {
          matchLabel = `HOLD [E] TO REVIVE ${(reviveTarget as BotTeammate).name.toUpperCase()}`;
        } else if (checkBuy <= 2.45) {
          if (weaponsOwnedRef.current.includes('shotgun')) {
            const ammo = weaponAmmoRef.current.shotgun;
            if (ammo.reserve < ammo.maxReserve) {
              matchLabel = `REFILL SHOTGUN AMMO [E]\nPRICE: $350`;
            } else {
              matchLabel = `SHOTGUN AMMO FULL_`;
            }
          } else {
            matchLabel = `BUY DOUBLE BARREL SHOTGUN [E]\nPRICE: $700`;
          }
        } else if (checkDoor <= 3.2 && !classroomExitDoor.purchased) {
          matchLabel = `PERFORM CLASSROOM OUTLET BUY [E]\nACCESS HALLWAY: $1200\n`;
        }

        // Hide irrelevant messages when player sits downed crawling in co-op matches unless there is a revive prompt!
        if (stateRef.current.health <= 0 && !reviveTarget) {
          matchLabel = `YOU ARE DOWNED - ALLIES ARE COMING TO HELP_`;
        }

        setInteractMessage(matchLabel);
      }

      // --- 8. REPAIR DUST COLLISION FLICKERS & PARTICLES ---
      // Randomly flick neon fluorescent tubes occasionally to enhance spooky vibe
      halogenLights.forEach(item => {
        if (Math.random() < 0.005) { // 0.5% chance per frame
          item.mesh.visible = false;
          item.light.power = 0.05;
          setTimeout(() => {
            item.mesh.visible = true;
            item.light.power = item.basePower * 9.5; // restore halogen discharge
          }, 60 + Math.random() * 120);
        }
      });

      // Render pool blood particles fade limits
      particleList.forEach(p => {
        p.age += d;
        p.vel.y -= 9.8 * d; // gravity
        p.mesh.position.addScaledVector(p.vel, d);
        if (p.mesh.position.y < 0.01) {
          p.mesh.position.y = 0.012; // smear on tile Floor
          p.vel.set(0, 0, 0);
        }
        if (p.age >= p.maxAge) {
          scene.remove(p.mesh);
        }
      });
      // Eliminate spent blood sprays
      const survivors = particleList.filter(p => p.age < p.maxAge);
      particleList.length = 0;
      particleList.push(...survivors);

      // Fade spent laser tracer lines smoothly
      bulletTracers.forEach(line => {
        line.age += d;
        const mat = line.mesh.material as THREE.LineBasicMaterial;
        if (mat) {
          mat.opacity = Math.max(0, 0.85 * (1 - line.age / line.maxAge));
        }
        if (line.age >= line.maxAge) {
          scene.remove(line.mesh);
        }
      });
      const traceSurvivors = bulletTracers.filter(l => l.age < l.maxAge);
      bulletTracers.length = 0;
      bulletTracers.push(...traceSurvivors);

      // Calculate Floating damage screens
      floatingDmgNumbers.forEach(item => {
        item.age += d;
        item.pos.y += d * 1.1; // Float upward
        
        // Translate 3D location coordinate into 2D display offset
        const screenPos = item.pos.clone().project(camera);
        const screenX = (screenPos.x *  .5 + .5) * width;
        const screenY = (screenPos.y * -.5 + .5) * height;

        item.element.style.left = `${screenX}px`;
        item.element.style.top = `${screenY}px`;
        item.element.style.opacity = `${THREE.MathUtils.lerp(1, 0, item.age / item.maxAge)}`;

        if (item.age >= item.maxAge) {
          item.element.remove();
        }
      });
      const textSurvivors = floatingDmgNumbers.filter(f => f.age < f.maxAge);
      floatingDmgNumbers.length = 0;
      floatingDmgNumbers.push(...textSurvivors);

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(gameTick);

    // Dynamic resized stages responsive adjustments
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);

    // --- GRACEFUL DESTROY & MEMORY LEAKS PREVENTER ---
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      
      containerRef.current?.removeEventListener('click', handlePointerLock);

      // Sweep outstanding floating dom tags
      floatingDmgNumbers.forEach(f => f.element.remove());

      // Sweep three context
      renderer.dispose();
    };
  }, []); 

  return <div id="fps-canvas-container" ref={containerRef} className="w-full h-full block relative cursor-crosshair bg-neutral-950 pointer-events-auto" />;
};
