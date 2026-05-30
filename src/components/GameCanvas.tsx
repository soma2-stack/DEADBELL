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
  activeWeapon: 'pistol' | 'shotgun' | 'smg';
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
  activeWeaponId: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
  setActiveWeaponId: React.Dispatch<React.SetStateAction<'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon'>>;
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

  // Real Multiplayer Props
  socket?: WebSocket | null;
  roomId?: string;
  roomState?: any;
  clientId?: string;
  hasFastHands: boolean;
  setHasFastHands: React.Dispatch<React.SetStateAction<boolean>>;
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
  clientId,
  hasFastHands,
  setHasFastHands
}) => {

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Inventory and Owned Weapons States
  const weaponsOwnedRef = useRef<string[]>(['pistol']);
  const weaponAmmoRef = useRef<Record<string, { clip: number; reserve: number; maxClip: number; maxReserve: number }>>({
    pistol: { clip: 12, reserve: 60, maxClip: 12, maxReserve: 120 },
    shotgun: { clip: 0, reserve: 0, maxClip: 6, maxReserve: 48 },
    smg: { clip: 0, reserve: 0, maxClip: 30, maxReserve: 180 },
    m16: { clip: 0, reserve: 0, maxClip: 30, maxReserve: 240 },
    magnum: { clip: 0, reserve: 0, maxClip: 6, maxReserve: 60 },
    sniper: { clip: 0, reserve: 0, maxClip: 5, maxReserve: 30 },
    wonder_weapon: { clip: 0, reserve: 0, maxClip: 15, maxReserve: 45 }
  });

  // THE FORBIDDEN TOME (cursed book reward machine — formerly the "mystery box").
  // Stands against the East wall of the spawn classroom, clear of the exit doorway (z in
  // [-2,2]) with room in front for the player to approach and interact.
  const mysteryBoxRef = useRef({
    state: 'idle' as 'idle' | 'spinning' | 'ready',
    weaponId: 'pistol' as 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon',
    position: [12.3, 0, 8.0] as [number, number, number],
    rotationY: -Math.PI / 2, // book faces west, into the room (away from the east wall)
    price: 950,
    lidGroup: null as THREE.Group | null,
    weaponGlowGroup: null as THREE.Group | null,
    spinningWeaponMesh: null as THREE.Group | null,
    spinIdx: 0,
    spinTicks: 0,
    
    // Magical book references and animation tracking
    bookGroup: null as THREE.Group | null,
    leftCover: null as THREE.Group | null,
    rightCover: null as THREE.Group | null,
    flippingPages: [] as THREE.Group[],
    particlesGroup: null as THREE.Group | null,
    bookGlowLight: null as THREE.PointLight | null,
    bookOpenProgress: 0, // 0 to 1
    pageFlipTicks: 0,
    whisperingSoundActive: false,
    whisperTimeout: null as any,
    activeSpinTimer: null as any,
    readyTimeoutTimer: null as any
  });

  // Live mirror of hasFastHands so the once-created render-loop closure always sees the
  // current value (the main useEffect has an empty dep array and would otherwise capture
  // the initial `false`, breaking both the purchase guard and the reload-speed bonus).
  const hasFastHandsRef = useRef(hasFastHands);
  useEffect(() => { hasFastHandsRef.current = hasFastHands; }, [hasFastHands]);

  const perkMachineRef = useRef({
    // Far corner of the spawn classroom (NW), furthest from the east entrance door at (14,0).
    // Tucked against the west/north walls but offset enough not to block movement or paths.
    position: [-11.6, 0, -9.4] as [number, number, number],
    rotationY: Math.PI / 4, // angled to face the room centre (south-east) for visibility
    price: 2000,
    meshGroup: null as THREE.Group | null
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
    activeWeapon: 'pistol' | 'shotgun' | 'smg';
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
    const generateWornWallTexture = () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // Dual-tone paint grimy classroom look
      // Top section: faded yellowed cream drywall
      ctx.fillStyle = '#dfdcd4';
      ctx.fillRect(0, 0, size, size * 0.58);
      
      // Bottom section: academic sage green wainscoting/panels
      ctx.fillStyle = '#4c5d50';
      ctx.fillRect(0, size * 0.58, size, size * 0.42);
      
      // Reddish brown wooden molding separator trim
      ctx.fillStyle = '#3a2012';
      ctx.fillRect(0, size * 0.57, size, size * 0.015);

      // Fine plaster grain bump simulation
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const factor = (Math.random() - 0.5) * 10;
        data[i] = Math.max(0, Math.min(255, data[i] + factor));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + factor));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + factor));
      }
      ctx.putImageData(imgData, 0, 0);

      // Add dark corner water spots, damp ceiling runoffs, and rust stains
      const topGrad = ctx.createLinearGradient(0, 0, 0, size * 0.28);
      topGrad.addColorStop(0, 'rgba(12, 11, 10, 0.65)');
      topGrad.addColorStop(1, 'rgba(12, 11, 10, 0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, size, size * 0.28);

      const bottomGrad = ctx.createLinearGradient(0, size, 0, size * 0.72);
      bottomGrad.addColorStop(0, 'rgba(15, 14, 12, 0.78)');
      bottomGrad.addColorStop(1, 'rgba(15, 14, 12, 0)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, size * 0.72, size, size * 0.28);

      // Realistic jagged plaster hairline cracks
      ctx.strokeStyle = 'rgba(24, 20, 15, 0.55)';
      ctx.lineWidth = 1.5;
      for (let c = 0; c < 5; c++) {
        ctx.beginPath();
        let sx = Math.random() * size;
        let sy = Math.random() * size;
        ctx.moveTo(sx, sy);
        for (let j = 0; j < 5; j++) {
          sx += (Math.random() - 0.5) * 65;
          sy += (Math.random() - 0.5) * 65;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // Grungy splotches and water leaks
      ctx.fillStyle = 'rgba(40, 32, 22, 0.22)';
      for (let s = 0; s < 12; s++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size;
        const sr = Math.random() * 30 + 10;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        
        // vertical dripping
        if (Math.random() < 0.7) {
          ctx.fillRect(sx - 1.5, sy, 3, Math.random() * 90 + 20);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    const generateConcreteFloorTexture = () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // Dusty industrial school linoleum/concrete mix floor
      ctx.fillStyle = '#484c4a'; 
      ctx.fillRect(0, 0, size, size);

      // Floor tiles mesh grid lines (8x8 tile division)
      const tSize = size / 8;
      ctx.strokeStyle = 'rgba(12, 14, 13, 0.72)';
      ctx.lineWidth = 4;
      for (let col = 0; col <= 8; col++) {
        ctx.beginPath();
        ctx.moveTo(col * tSize, 0);
        ctx.lineTo(col * tSize, size);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, col * tSize);
        ctx.lineTo(size, col * tSize);
        ctx.stroke();
      }

      // Add tile discoloration & variance (damaged / darkened linoleum tiles)
      ctx.fillStyle = 'rgba(10, 10, 10, 0.16)';
      for (let tx = 0; tx < 8; tx++) {
        for (let ty = 0; ty < 8; ty++) {
          if (Math.random() < 0.38) {
            ctx.fillRect(tx * tSize + 2, ty * tSize + 2, tSize - 4, tSize - 4);
          }
        }
      }

      // Dynamic classroom scuff marks and sliding desk friction streaks
      ctx.strokeStyle = 'rgba(16, 16, 16, 0.65)';
      ctx.lineWidth = 3.0;
      for (let sm = 0; sm < 14; sm++) {
        ctx.beginPath();
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const r = Math.random() * 75 + 25;
        ctx.arc(cx, cy, r, Math.random() * Math.PI, Math.random() * Math.PI * 1.8);
        ctx.stroke();
      }

      // Jagged cracks on concrete slabs
      ctx.strokeStyle = 'rgba(8, 9, 8, 0.85)';
      ctx.lineWidth = 1.6;
      for (let fc = 0; fc < 4; fc++) {
        ctx.beginPath();
        let px = Math.random() * size;
        let py = Math.random() * size;
        ctx.moveTo(px, py);
        for (let j = 0; j < 6; j++) {
          px += (Math.random() - 0.5) * 55;
          py += (Math.random() - 0.5) * 55;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Dark organic decay vignette (representing dust, mold, and dark corners)
      const centerDampGrad = ctx.createRadialGradient(size/2, size/2, size/3, size/2, size/2, size * 0.72);
      centerDampGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      centerDampGrad.addColorStop(1, 'rgba(10, 8, 6, 0.72)');
      ctx.fillStyle = centerDampGrad;
      ctx.fillRect(0, 0, size, size);

      // Fine grain noise simulation for physical concrete roughness
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 12;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    const generateCeilingTexture = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Academic ceiling tiles dusty dark gray tone
      ctx.fillStyle = '#222426';
      ctx.fillRect(0, 0, size, size);

      // Metal grid borders around acoustical ceiling segments
      ctx.strokeStyle = '#121314';
      ctx.lineWidth = 5;
      const tSize = size / 4;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tSize, 0);
        ctx.lineTo(i * tSize, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * tSize);
        ctx.lineTo(size, i * tSize);
        ctx.stroke();
      }

      // Fibrous mineral panel craters and grimy pockmarks
      ctx.fillStyle = 'rgba(8, 8, 8, 0.5)';
      for (let px = 6; px < size; px += 10) {
        for (let py = 6; py < size; py += 10) {
          if (Math.random() < 0.75) {
            ctx.fillRect(px + (Math.random() - 0.5) * 3, py + (Math.random() - 0.5) * 3, 1.6, 1.6);
          }
        }
      }

      // Yellowed-brown rain water leakage & rust stains on selected acoustic tiles
      ctx.fillStyle = 'rgba(64, 48, 30, 0.25)';
      for (let leak = 0; leak < 5; leak++) {
        const lx = Math.random() * size;
        const ly = Math.random() * size;
        const r = Math.random() * 50 + 15;
        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(52, 36, 20, 0.18)';
        ctx.beginPath();
        ctx.arc(lx, ly, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    const generateWoodTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Antique worn dark school wood tone
      ctx.fillStyle = '#6d4520';
      ctx.fillRect(0, 0, 256, 256);
      
      // Grain patterns
      ctx.strokeStyle = '#3e240f';
      ctx.lineWidth = 2;
      for (let i = 0; i < 256; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.bezierCurveTo(80, i + Math.sin(i)*15, 170, i - Math.cos(i)*15, 256, i);
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

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
    const HALLWAY_W = 8;
    const HALLWAY_D = 50;
    const HALLWAY_X_CENTER = 18; // Hallway spans x = 14 to x = 22 past the exit doorway

    // Lights group list to trigger flicker
    const halogenLights: { mesh: THREE.Mesh; light: THREE.PointLight; basePower: number }[] = [];

    // --- STATIC MAP CONSTRUCTION ---
    // 1. Classroom Floor
    const classroomFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(CLASSROOM_W, CLASSROOM_D), floorMaterial);
    classroomFloorMesh.rotation.x = -Math.PI / 2;
    classroomFloorMesh.receiveShadow = true;
    scene.add(classroomFloorMesh);

    // 2. Classroom Ceiling
    const classroomCeilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(CLASSROOM_W, CLASSROOM_D), ceilingMaterial);
    classroomCeilingMesh.rotation.x = Math.PI / 2;
    classroomCeilingMesh.position.y = WALL_H;
    scene.add(classroomCeilingMesh);

    // Classroom Walls: North Wall (facing hallway/split)
    // The doorway will sit centered on the East Wall (x = +14)

    // West Wall
    const westWallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, CLASSROOM_D), wallMaterial);
    westWallMesh.position.set(-CLASSROOM_W/2, WALL_H/2, 0);
    westWallMesh.receiveShadow = true;
    westWallMesh.castShadow = true;
    scene.add(westWallMesh);

    // East Wall Split (To connect doorway to Hallway at z = 0, size of door is 4 units)
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

    // North Wall
    const northWallMesh = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_W, WALL_H, 0.5), wallMaterial);
    northWallMesh.position.set(0, WALL_H/2, -CLASSROOM_D/2);
    northWallMesh.receiveShadow = true;
    northWallMesh.castShadow = true;
    scene.add(northWallMesh);

    // South Wall
    const southWallMesh = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_W, WALL_H, 0.5), wallMaterial);
    southWallMesh.position.set(0, WALL_H/2, CLASSROOM_D/2);
    southWallMesh.receiveShadow = true;
    southWallMesh.castShadow = true;
    scene.add(southWallMesh);

    // 3. Rotated Hallway Setup (Spans from x = 14 to x = 24, z = -16 to z = 16)
    // Floor
    const hallwayFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALLWAY_W, HALLWAY_D), floorMaterial);
    hallwayFloorMesh.rotation.x = -Math.PI / 2;
    hallwayFloorMesh.position.set(HALLWAY_X_CENTER, 0, 0);
    hallwayFloorMesh.receiveShadow = true;
    scene.add(hallwayFloorMesh);

    // Ceiling
    const hallwayCeilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALLWAY_W, HALLWAY_D), ceilingMaterial);
    hallwayCeilingMesh.rotation.x = Math.PI / 2;
    hallwayCeilingMesh.position.set(HALLWAY_X_CENTER, WALL_H, 0);
    scene.add(hallwayCeilingMesh);

    // East Wall of Hallway (the back wall relative to classroom) - Split to accommodate doorways
    // North doorway center is at z = -12.5 with single door width 1.5 (span z = -13.25 to z = -11.75)
    // South doorway center is at z = 12.5 with single door width 1.5 (span z = 11.75 to z = 13.25)
    const wallPiece1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 11.75), wallMaterial);
    wallPiece1.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, WALL_H/2, -19.125);
    wallPiece1.receiveShadow = true;
    wallPiece1.castShadow = true;
    scene.add(wallPiece1);

    const wallPiece2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 23.5), wallMaterial);
    wallPiece2.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, WALL_H/2, 0);
    wallPiece2.receiveShadow = true;
    wallPiece2.castShadow = true;
    scene.add(wallPiece2);

    const wallPiece3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 11.75), wallMaterial);
    wallPiece3.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, WALL_H/2, 19.125);
    wallPiece3.receiveShadow = true;
    wallPiece3.castShadow = true;
    scene.add(wallPiece3);

    // North Header Wall Piece (above door frame top, y = 2.8 to 4.5)
    const headerPiece1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H - 2.8, 1.5), wallMaterial);
    headerPiece1.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, 2.8 + (WALL_H - 2.8)/2, -12.5);
    headerPiece1.receiveShadow = true;
    headerPiece1.castShadow = true;
    scene.add(headerPiece1);

    // South Header Wall Piece (above door frame top, y = 2.8 to 4.5)
    const headerPiece2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H - 2.8, 1.5), wallMaterial);
    headerPiece2.position.set(HALLWAY_X_CENTER + HALLWAY_W/2, 2.8 + (WALL_H - 2.8)/2, 12.5);
    headerPiece2.receiveShadow = true;
    headerPiece2.castShadow = true;
    scene.add(headerPiece2);

    // --- 2.5 CLASSROOM 2 (NORTH ELEMENTARY) CONSTRUCTION ---
    const buildClassroom2 = () => {
      // Floor
      const class2Floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), floorMaterial);
      class2Floor.rotation.x = -Math.PI / 2;
      class2Floor.position.set(30.0, 0, -12.5);
      class2Floor.receiveShadow = true;
      scene.add(class2Floor);

      // Ceiling
      const class2Ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), ceilingMaterial);
      class2Ceiling.rotation.x = Math.PI / 2;
      class2Ceiling.position.set(30.0, WALL_H, -12.5);
      scene.add(class2Ceiling);

      // North Wall
      const class2NorthWall = new THREE.Mesh(new THREE.BoxGeometry(16, WALL_H, 0.5), wallMaterial);
      class2NorthWall.position.set(30.0, WALL_H/2, -21.5);
      class2NorthWall.receiveShadow = true;
      class2NorthWall.castShadow = true;
      scene.add(class2NorthWall);

      // South Wall
      const class2SouthWall = new THREE.Mesh(new THREE.BoxGeometry(16, WALL_H, 0.5), wallMaterial);
      class2SouthWall.position.set(30.0, WALL_H/2, -3.5);
      class2SouthWall.receiveShadow = true;
      class2SouthWall.castShadow = true;
      scene.add(class2SouthWall);

      // East Wall (opposite side of the door)
      const class2EastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 18), wallMaterial);
      class2EastWall.position.set(38.0, WALL_H/2, -12.5);
      class2EastWall.receiveShadow = true;
      class2EastWall.castShadow = true;
      scene.add(class2EastWall);

      // Board Decoration
      const board1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 3.2), chalkboardMaterial);
      board1.position.set(37.9, 2.1, -12.5);
      scene.add(board1);
    };
    buildClassroom2();

    // --- 2.6 CLASSROOM 3 (SOUTH HIGH) CONSTRUCTION ---
    const buildClassroom3 = () => {
      // Floor
      const class3Floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), floorMaterial);
      class3Floor.rotation.x = -Math.PI / 2;
      class3Floor.position.set(30.0, 0, 12.5);
      class3Floor.receiveShadow = true;
      scene.add(class3Floor);

      // Ceiling
      const class3Ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), ceilingMaterial);
      class3Ceiling.rotation.x = Math.PI / 2;
      class3Ceiling.position.set(30.0, WALL_H, 12.5);
      scene.add(class3Ceiling);

      // North Wall
      const class3NorthWall = new THREE.Mesh(new THREE.BoxGeometry(16, WALL_H, 0.5), wallMaterial);
      class3NorthWall.position.set(30.0, WALL_H/2, 3.5);
      class3NorthWall.receiveShadow = true;
      class3NorthWall.castShadow = true;
      scene.add(class3NorthWall);

      // South Wall
      const class3SouthWall = new THREE.Mesh(new THREE.BoxGeometry(16, WALL_H, 0.5), wallMaterial);
      class3SouthWall.position.set(30.0, WALL_H/2, 21.5);
      class3SouthWall.receiveShadow = true;
      class3SouthWall.castShadow = true;
      scene.add(class3SouthWall);

      // East Wall
      const class3EastWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 18), wallMaterial);
      class3EastWall.position.set(38.0, WALL_H/2, 12.5);
      class3EastWall.receiveShadow = true;
      class3EastWall.castShadow = true;
      scene.add(class3EastWall);

      // Board Decoration
      const board2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 3.2), chalkboardMaterial);
      board2.position.set(37.9, 2.1, 12.5);
      scene.add(board2);
    };
    buildClassroom3();

    // West Extra Walls of Hallway (since classroom spans from z = -12 to z = 12, adding cap walls for the hallway extreme ends to prevent gaps)
    const hallwayWestWallNorthExtra = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 13), wallMaterial);
    hallwayWestWallNorthExtra.position.set(CLASSROOM_W/2, WALL_H/2, -18.5); // middle of z = -25 to z = -12
    hallwayWestWallNorthExtra.receiveShadow = true;
    hallwayWestWallNorthExtra.castShadow = true;
    scene.add(hallwayWestWallNorthExtra);

    const hallwayWestWallSouthExtra = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H, 13), wallMaterial);
    hallwayWestWallSouthExtra.position.set(CLASSROOM_W/2, WALL_H/2, 18.5); // middle of z = 12 to z = 25
    hallwayWestWallSouthExtra.receiveShadow = true;
    hallwayWestWallSouthExtra.castShadow = true;
    scene.add(hallwayWestWallSouthExtra);

    // North End Cap Wall
    const hallwayNorthWall = new THREE.Mesh(new THREE.BoxGeometry(HALLWAY_W, WALL_H, 0.5), wallMaterial);
    hallwayNorthWall.position.set(HALLWAY_X_CENTER, WALL_H/2, -HALLWAY_D/2);
    hallwayNorthWall.receiveShadow = true;
    hallwayNorthWall.castShadow = true;
    scene.add(hallwayNorthWall);

    // South End Cap Wall
    const hallwaySouthWall = new THREE.Mesh(new THREE.BoxGeometry(HALLWAY_W, WALL_H, 0.5), wallMaterial);
    hallwaySouthWall.position.set(HALLWAY_X_CENTER, WALL_H/2, HALLWAY_D/2);
    hallwaySouthWall.receiveShadow = true;
    hallwaySouthWall.castShadow = true;
    scene.add(hallwaySouthWall);

    // --- PROPS CREATION ---
    // Chalkboard on the North Wall of Classroom
    const cbFrame = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.15), blackMetalMaterial);
    cbFrame.position.set(0, 2.1, -CLASSROOM_D/2 + 0.12);
    scene.add(cbFrame);
    
    const cbPanel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.9, 0.05), chalkboardMaterial);
    cbPanel.position.set(0, 2.1, -CLASSROOM_D/2 + 0.2);
    cbPanel.receiveShadow = true;
    scene.add(cbPanel);

    // Teacher Desk
    const teacherDeskGroup = new THREE.Group();
    const deskTopMat = woodMaterial;
    const tdTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.6), deskTopMat);
    tdTop.position.y = 0.95;
    tdTop.castShadow = true;
    teacherDeskGroup.add(tdTop);

    const tdBody = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.3), blackMetalMaterial);
    tdBody.position.y = 0.45;
    tdBody.castShadow = true;
    teacherDeskGroup.add(tdBody);

    // Add laptop on teacher desk
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

    // Classroom lighting fixtures (Procedural Fluorescent boxes)
    const addHalogenBox = (x: number, y: number, z: number, colorHex: number = 0xf0f5ff, powerValue: number = 3.2) => {
      const g = new THREE.Group();
      const casing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 0.4), blackMetalMaterial);
      casing.position.set(x, y - 0.075, z);
      g.add(casing);
      
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: colorHex }));
      glass.position.set(x, y - 0.15, z);
      g.add(glass);

      // PointLight with physical decay and high-resolution shadow maps
      const light = new THREE.PointLight(colorHex, powerValue, 28);
      light.decay = 2.0;
      light.position.set(x, y - 0.3, z);
      light.castShadow = true;
      light.shadow.bias = -0.0006;
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      scene.add(light);

      halogenLights.push({ mesh: glass, light, basePower: powerValue });
      scene.add(g);
    };

    // Place lights in classroom with spooky organic color variations (faded fluorescent look)
    addHalogenBox(-7, WALL_H, -6, 0xffecd2, 3.4); // Cozy high-density warm bulb
    addHalogenBox(7, WALL_H, -6, 0xfff7ed, 3.5);  // Chalkboard spotlights
    addHalogenBox(-7, WALL_H, 6, 0xfef3c7, 2.9);   // Dimmer flickering neon tubes
    addHalogenBox(7, WALL_H, 6, 0xfff7ed, 3.5);

    // Hallway fluorescent boxes aligned down the horizontal hallway corridor
    addHalogenBox(19, WALL_H, -8, 0xef4444, 4.2); // Creepy red alarm lamp
    addHalogenBox(19, WALL_H, 8, 0x38bdf8, 3.6);  // Cool blue/cyan emergency beacon

    // Damped warm ambient light so shadows are deep and grimy details pop significantly
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.14);
    scene.add(ambientLight);

    // Spooky ambient moonbeam pouring from window barricades pointing inside the room
    const addWindowMoonlight = (x: number, y: number, z: number, targetX: number, targetZ: number) => {
      const spotLight = new THREE.SpotLight(0x4080ff, 4.5, 26, Math.PI / 4.5, 0.45, 0.55);
      spotLight.position.set(x, y + 2.0, z);
      const targetObj = new THREE.Object3D();
      targetObj.position.set(targetX, 0, targetZ);
      scene.add(targetObj);
      spotLight.target = targetObj;
      spotLight.castShadow = true;
      spotLight.shadow.bias = -0.0006;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      scene.add(spotLight);
    };

    // Moonlight cones flowing through windows for aesthetic CoD Zombies style rays of light
    addWindowMoonlight(-10, WALL_H/2, -CLASSROOM_D/2 + 0.1, -6, -4);
    addWindowMoonlight(10, WALL_H/2, -CLASSROOM_D/2 + 0.1, 6, -4);
    addWindowMoonlight(-10, WALL_H/2, CLASSROOM_D/2 - 0.1, -6, 4);
    addWindowMoonlight(10, WALL_H/2, CLASSROOM_D/2 - 0.1, 6, 4);

    // Ambient mood top-down highlight (creepier moonlight night filter)
    const subLight = new THREE.DirectionalLight(0x1a2e4c, 0.75);
    subLight.position.set(5, 10, -5);
    scene.add(subLight);

    // Student Desks Grid (Multiple rows of student desks and chairs)
    const deskRows = 3;
    const deskCols = 4;
    const xSpacing = 4.5;
    const zSpacing = 4.2;
    const leftStart = -((deskCols - 1) * xSpacing) / 2;
    const frontStart = -0.7; // Moved back slightly as requested

    const classroomObstacles: THREE.Box3[] = [];

    // Register Teacher Desk collision box
    const tdBox = new THREE.Box3().setFromObject(teacherDeskGroup);
    classroomObstacles.push(tdBox);

    const createStudentDesk = (posX: number, posZ: number, isTipped: boolean = false) => {
      const g = new THREE.Group();
      
      // Desk slab
      const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), woodMaterial);
      topMesh.position.y = 0.72;
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      g.add(topMesh);

      // Steel frame
      const frameY = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), blackMetalMaterial);
      frameY.position.y = 0.63;
      frameY.castShadow = true;
      g.add(frameY);

      // Legs
      const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 6);
      const legL1 = new THREE.Mesh(legGeom, blackMetalMaterial);
      legL1.position.set(-0.68, 0.34, -0.36);
      legL1.castShadow = true;
      g.add(legL1);

      const legR1 = legL1.clone();
      legR1.position.set(0.68, 0.34, -0.36);
      g.add(legR1);

      const legL2 = legL1.clone();
      legL2.position.set(-0.68, 0.34, 0.36);
      g.add(legL2);

      const legR2 = legL1.clone();
      legR2.position.set(0.68, 0.34, 0.36);
      g.add(legR2);

      // High-quality detailed Chair
      const chairGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), woodMaterial);
      seat.position.y = 0.42;
      seat.castShadow = true;
      seat.receiveShadow = true;
      chairGroup.add(seat);

      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.04), woodMaterial);
      chairBack.position.set(0, 0.68, -0.30);
      chairBack.castShadow = true;
      chairBack.receiveShadow = true;
      chairGroup.add(chairBack);

      // Back frame tubes (goes all the way from floor to the top of the backrest)
      const frameBack = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.88, 6), blackMetalMaterial);
      frameBack.position.set(-0.30, 0.44, -0.30);
      frameBack.castShadow = true;
      chairGroup.add(frameBack);

      const frameBackR = frameBack.clone();
      frameBackR.position.x = 0.30;
      chairGroup.add(frameBackR);

      // Completing the chair with solid front legs (from floor to seat cushion bottom)
      const legFront = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.40, 6), blackMetalMaterial);
      legFront.position.set(-0.30, 0.20, 0.28);
      legFront.castShadow = true;
      chairGroup.add(legFront);

      const legFrontR = legFront.clone();
      legFrontR.position.x = 0.30;
      chairGroup.add(legFrontR);

      // Align chair correctly with desk, giving natural student sitting distance spacing
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

      // Register collision box representing individual desk units
      const dBox = new THREE.Box3().setFromObject(g);
      classroomObstacles.push(dBox);
    };

    // Instantiate desk grid
    for (let row = 0; row < deskRows; row++) {
      for (let col = 0; col < deskCols; col++) {
        const px = leftStart + col * xSpacing;
        const pz = frontStart + row * zSpacing;
        // Tip one random table over completely to enhance school outbreak horror design
        const tipTable = row === 1 && col === 1;
        createStudentDesk(px, pz, tipTable);
      }
    }

    // Classroom 2 (North Classroom) Student Desks
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const px = 27.0 + c * 3.0;
        const pz = -16.5 + r * 4.0;
        const isTipped = r === 0 && c === 1;
        createStudentDesk(px, pz, isTipped);
      }
    }

    // Classroom 3 (South Classroom) Student Desks
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const px = 27.0 + c * 3.0;
        const pz = 8.5 + r * 4.0;
        const isTipped = r === 1 && c === 2;
        createStudentDesk(px, pz, isTipped);
      }
    }

    // Add cluttered scattered papers on the floor
    const paperGeom = new THREE.PlaneGeometry(0.35, 0.25);
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xdcdcdc, side: THREE.DoubleSide });
    for (let i = 0; i < 24; i++) {
      const pm = new THREE.Mesh(paperGeom, paperMat);
      // Random coordinates inside classroom limits
      pm.position.set(
        (Math.random() - 0.5) * (CLASSROOM_W - 4),
        0.01,
        (Math.random() - 0.5) * (CLASSROOM_D - 4)
      );
      pm.rotation.x = -Math.PI / 2;
      pm.rotation.z = Math.random() * Math.PI;
      scene.add(pm);
    }

    // --- HALLWAY LOCKERS ---
    // Creepy teal metallic lockers stretching along hallway bounds
    const createHallwayLocker = (xPos: number, zPos: number, rotY: number) => {
      const group = new THREE.Group();
      const width = 1.1;
      const height = 3.6;
      const depth = 0.95;

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0x1f3c4d, roughness: 0.65, metalness: 0.4 })
      );
      base.position.y = height / 2;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Vent lines and door handles
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.4, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xcca43b, metalness: 0.9 })
      );
      handle.position.set(width / 2.5, height / 2, depth / 1.95);
      group.add(handle);

      group.position.set(xPos, 0, zPos);
      group.rotation.y = rotY;
      scene.add(group);
      
      const coll = new THREE.Box3().setFromObject(group);
      classroomObstacles.push(coll);
    };

    // Place lockers in the rotated hallway parallel to the walls (East wall X = 21.5, West wall X = 14.5)
    // East Wall lockers
    createHallwayLocker(21.5, -20.0, -Math.PI / 2);
    createHallwayLocker(21.5, -8.0, -Math.PI / 2);
    createHallwayLocker(21.5, -5.5, -Math.PI / 2);
    createHallwayLocker(21.5, 5.5, -Math.PI / 2);
    createHallwayLocker(21.5, 8.0, -Math.PI / 2);
    createHallwayLocker(21.5, 17.5, -Math.PI / 2);
    createHallwayLocker(21.5, 20.0, -Math.PI / 2);
    
    // West Wall lockers
    createHallwayLocker(14.5, -22.5, Math.PI / 2);
    createHallwayLocker(14.5, -15.0, Math.PI / 2);
    createHallwayLocker(14.5, 15.0, Math.PI / 2);
    createHallwayLocker(14.5, 22.5, Math.PI / 2);

    // --- PROCEDURAL FAST HANDS PERK SHRINE (marble angel pedestal) ---
    // A worn marble pedestal topped by a stone angel that presents a glowing tome.
    // Buying the perk = the angel "presents the book" and reload speed increases.
    const buildPerkMachineMesh = () => {
      const pmGroup = new THREE.Group();

      // Procedural marble texture (worn, veined) reused across the stone parts.
      const marbleCanvas = document.createElement('canvas');
      marbleCanvas.width = 256; marbleCanvas.height = 256;
      const mc = marbleCanvas.getContext('2d')!;
      const mgrad = mc.createLinearGradient(0, 0, 256, 256);
      mgrad.addColorStop(0, '#d9d4c8');
      mgrad.addColorStop(0.5, '#c2bba9');
      mgrad.addColorStop(1, '#a8a08c');
      mc.fillStyle = mgrad; mc.fillRect(0, 0, 256, 256);
      // Grime blotches
      for (let i = 0; i < 40; i++) {
        mc.fillStyle = `rgba(60,55,45,${0.04 + Math.random() * 0.08})`;
        const r = 6 + Math.random() * 26;
        mc.beginPath(); mc.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); mc.fill();
      }
      // Marble veins
      mc.strokeStyle = 'rgba(90,84,70,0.45)'; mc.lineWidth = 1.4;
      for (let i = 0; i < 10; i++) {
        mc.beginPath();
        let x = Math.random() * 256, y = Math.random() * 256;
        mc.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; mc.lineTo(x, y); }
        mc.stroke();
      }
      const marbleTex = new THREE.CanvasTexture(marbleCanvas);
      marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
      const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex, color: 0xece7da, roughness: 0.55, metalness: 0.08 });
      const wornStoneMat = new THREE.MeshStandardMaterial({ map: marbleTex, color: 0xb8b09c, roughness: 0.85, metalness: 0.05 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9, emissive: 0x3a2c08, emissiveIntensity: 0.6 });

      // Stepped pedestal base
      const baseBottom = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 1.15), wornStoneMat);
      baseBottom.position.y = 0.11; baseBottom.castShadow = true; baseBottom.receiveShadow = true;
      pmGroup.add(baseBottom);
      const baseMid = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.95), wornStoneMat);
      baseMid.position.y = 0.31; baseMid.castShadow = true; baseMid.receiveShadow = true;
      pmGroup.add(baseMid);

      // Fluted column
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 16), marbleMat);
      column.position.y = 0.9; column.castShadow = true; column.receiveShadow = true;
      pmGroup.add(column);
      // Vertical flute grooves (thin gold inlays as glowing accents)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const flute = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.92, 0.025), goldMat);
        flute.position.set(Math.cos(a) * 0.345, 0.9, Math.sin(a) * 0.345);
        pmGroup.add(flute);
      }

      // Capital (top of column)
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.78), marbleMat);
      capital.position.y = 1.48; capital.castShadow = true; capital.receiveShadow = true;
      pmGroup.add(capital);

      // --- STONE ANGEL standing on the capital, presenting the book forward ---
      const angel = new THREE.Group();
      angel.position.y = 1.56;
      // Robe / body
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.75, 12), marbleMat);
      robe.position.y = 0.4; robe.castShadow = true; angel.add(robe);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), marbleMat);
      head.position.y = 0.92; head.castShadow = true; angel.add(head);
      // Halo (glowing gold ring)
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24), goldMat);
      halo.position.set(0, 1.02, -0.02); halo.rotation.x = Math.PI / 2.2; angel.add(halo);
      // Wings (flattened, swept back)
      const wingGeo = new THREE.BoxGeometry(0.06, 0.55, 0.34);
      const wingL = new THREE.Mesh(wingGeo, marbleMat);
      wingL.position.set(-0.2, 0.55, -0.12); wingL.rotation.z = 0.35; wingL.rotation.y = 0.5; wingL.castShadow = true; angel.add(wingL);
      const wingR = new THREE.Mesh(wingGeo, marbleMat);
      wingR.position.set(0.2, 0.55, -0.12); wingR.rotation.z = -0.35; wingR.rotation.y = -0.5; wingR.castShadow = true; angel.add(wingR);
      // Outstretched arms holding the offered book forward (+Z)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), marbleMat);
      armL.position.set(-0.13, 0.55, 0.2); angel.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), marbleMat);
      armR.position.set(0.13, 0.55, 0.2); angel.add(armR);
      // The presented "fast hands" tome resting on the hands, with a glowing cover
      const offeredBook = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.26), new THREE.MeshStandardMaterial({ color: 0x6b1414, roughness: 0.6, metalness: 0.2, emissive: 0xef4444, emissiveIntensity: 1.2 }));
      offeredBook.position.set(0, 0.5, 0.4); offeredBook.castShadow = true; angel.add(offeredBook);
      const bookGild = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.012, 0.28), goldMat);
      bookGild.position.set(0, 0.54, 0.4); angel.add(bookGild);
      pmGroup.add(angel);

      // FAST HANDS engraved plaque on the front of the pedestal
      const fhCanvas = document.createElement('canvas');
      fhCanvas.width = 256; fhCanvas.height = 96;
      const fhc = fhCanvas.getContext('2d')!;
      const pgrad = fhc.createLinearGradient(0, 0, 0, 96);
      pgrad.addColorStop(0, '#1a1410'); pgrad.addColorStop(1, '#0a0805');
      fhc.fillStyle = pgrad; fhc.fillRect(0, 0, 256, 96);
      fhc.strokeStyle = '#d4af37'; fhc.lineWidth = 3; fhc.strokeRect(4, 4, 248, 88);
      fhc.fillStyle = '#ef4444'; fhc.font = 'bold 32px Georgia, serif'; fhc.textAlign = 'center';
      fhc.fillText('FAST HANDS', 128, 44);
      fhc.fillStyle = '#d4af37'; fhc.font = 'italic 16px Georgia, serif';
      fhc.fillText('— swift reload —', 128, 72);
      const fhTex = new THREE.CanvasTexture(fhCanvas);
      const fhOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.26),
        new THREE.MeshBasicMaterial({ map: fhTex, side: THREE.DoubleSide, transparent: true })
      );
      fhOverlay.position.set(0, 0.9, 0.4);
      pmGroup.add(fhOverlay);

      // Glowing crimson accent light beneath the angel + faint up-light on the marble
      const fhLight = new THREE.PointLight(0xef4444, 2.6, 5.0);
      fhLight.position.set(0, 1.9, 0.35);
      pmGroup.add(fhLight);
      const baseGlow = new THREE.PointLight(0xffd27f, 1.2, 3.0);
      baseGlow.position.set(0, 0.5, 0.4);
      pmGroup.add(baseGlow);

      const px = perkMachineRef.current.position[0];
      const py = perkMachineRef.current.position[1];
      const pz = perkMachineRef.current.position[2];
      pmGroup.position.set(px, py, pz);
      pmGroup.rotation.y = perkMachineRef.current.rotationY;
      scene.add(pmGroup);

      perkMachineRef.current.meshGroup = pmGroup;

      const pmColl = new THREE.Box3().setFromObject(pmGroup);
      classroomObstacles.push(pmColl);
    };
    buildPerkMachineMesh();

    // --- PROCEDURAL FORBIDDEN TOME (cursed book on a stone pedestal) ---
    // The book itself IS the machine — it rests on a worn stone pedestal (no wooden crate).
    const buildMysteryBoxMesh = () => {
      const mbGroup = new THREE.Group();

      // Worn dark-stone pedestal texture
      const stoneCanvas = document.createElement('canvas');
      stoneCanvas.width = 256; stoneCanvas.height = 256;
      const sc2 = stoneCanvas.getContext('2d')!;
      const sgrad = sc2.createLinearGradient(0, 0, 0, 256);
      sgrad.addColorStop(0, '#3a3530'); sgrad.addColorStop(1, '#211e1a');
      sc2.fillStyle = sgrad; sc2.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 60; i++) {
        sc2.fillStyle = `rgba(20,18,15,${0.05 + Math.random() * 0.12})`;
        const r = 4 + Math.random() * 22;
        sc2.beginPath(); sc2.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); sc2.fill();
      }
      sc2.strokeStyle = 'rgba(10,9,7,0.5)'; sc2.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const y = Math.random() * 256; sc2.beginPath(); sc2.moveTo(0, y); sc2.lineTo(256, y + (Math.random() - 0.5) * 40); sc2.stroke(); }
      const stoneTex = new THREE.CanvasTexture(stoneCanvas);
      const pedestalMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6b6358, roughness: 0.92, metalness: 0.05 });
      const runicGoldMat = new THREE.MeshStandardMaterial({ color: 0x9c7441, roughness: 0.4, metalness: 0.8, emissive: 0x2a1d05, emissiveIntensity: 0.5 });

      // Stepped stone pedestal
      const pedBottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.0), pedestalMat);
      pedBottom.position.y = 0.1; pedBottom.castShadow = true; pedBottom.receiveShadow = true; mbGroup.add(pedBottom);
      const pedShaft = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.7, 0.7), pedestalMat);
      pedShaft.position.y = 0.55; pedShaft.castShadow = true; pedShaft.receiveShadow = true; mbGroup.add(pedShaft);
      const pedTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.9), pedestalMat);
      pedTop.position.y = 0.98; pedTop.castShadow = true; pedTop.receiveShadow = true; mbGroup.add(pedTop);
      // Glowing rune band around the pedestal shaft
      for (const sx of [-0.42, 0.42]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.62), runicGoldMat);
        band.position.set(sx, 0.55, 0); mbGroup.add(band);
      }
      for (const sz of [-0.36, 0.36]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.5, 0.02), runicGoldMat);
        band.position.set(0, 0.55, sz); mbGroup.add(band);
      }

      // --- PROCEDURAL ANCIENT FORBIDDEN TOME (the machine itself) ---
      const bookGroup = new THREE.Group();
      bookGroup.position.set(0, 1.12, 0); // resting on top of the pedestal
      bookGroup.rotation.y = -0.04; // slight off-axis alignment for visual charm
      mbGroup.add(bookGroup);
      mysteryBoxRef.current.bookGroup = bookGroup;

      // Leather Spine of the book (centers spine running from Z=-0.35 to +0.35)
      const leatherCoverMat = new THREE.MeshStandardMaterial({ color: 0x420d09, roughness: 0.8, metalness: 0.1 }); // creepy old blood red / dark maroon
      const spineGeo = new THREE.BoxGeometry(0.08, 0.05, 0.72);
      const spine = new THREE.Mesh(spineGeo, leatherCoverMat);
      spine.position.set(0, 0.025, 0);
      spine.castShadow = true;
      bookGroup.add(spine);

      // Gold metal lock hinges/details for spine
      const bookGoldMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, roughness: 0.35, metalness: 0.8 });
      for (let sz of [-0.25, 0, 0.25]) {
        const bands = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.056, 0.04), bookGoldMat);
        bands.position.set(0, 0.025, sz);
        bookGroup.add(bands);
      }

      // Procedural Ancient Hand-written Runes Canvas Texture (HIGH VISUAL FIDELITY)
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = 512;
      pageCanvas.height = 512;
      const pc = pageCanvas.getContext('2d')!;
      
      // Ancient worn parchment gradient filling
      const grad = pc.createRadialGradient(256, 256, 128, 256, 256, 360);
      grad.addColorStop(0, '#f2e6cb'); // lighter center
      grad.addColorStop(1, '#cca373'); // burnt edges
      pc.fillStyle = grad;
      pc.fillRect(0, 0, 512, 512);

      // Distressed ancient marks/grunge
      pc.strokeStyle = 'rgba(74, 45, 12, 0.15)';
      pc.lineWidth = 1;
      for (let i = 0; i < 15; i++) {
        pc.beginPath();
        pc.moveTo(Math.random() * 512, Math.random() * 512);
        pc.bezierCurveTo(Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512);
        pc.stroke();
      }

      // Border bounds
      pc.strokeStyle = '#5a3d1b';
      pc.lineWidth = 8;
      pc.strokeRect(20, 20, 472, 472);
      pc.strokeStyle = '#9c7441';
      pc.lineWidth = 2;
      pc.strokeRect(32, 32, 448, 448);

      // Ancient Ritual symbols
      pc.fillStyle = '#dc2626'; // Blood-red ritual ink symbols
      pc.font = 'normal 48px Symbol, sans-serif';
      pc.textAlign = 'center';
      pc.fillText("❂ 🕃 ⛧ 🕄 ❂", 256, 110);

      // Runes Text columns
      pc.fillStyle = '#1b1307';
      pc.font = 'normal italic 20px Times New Roman, serif';
      const sentences = [
        "In deep dark places they awake,",
        "With ancient bones and hearts that ache.",
        "Solve the riddle of the silver box,",
        "Unlocking all the dimensional locks.",
        "𐎥𐎤𐎵𐎨𐎵 𐎠𐎫 𐎤𐎵𐎨𐎵 𐎠𐎫𐎬",
        "The gun that hums with neon fire_."
      ];
      sentences.forEach((line, idx) => {
        pc.font = idx === 4 ? 'normal 22px Courier New' : 'normal italic 20px Times New Roman';
        pc.fillText(line, 256, 180 + idx * 32);
      });

      // Arcana symbol (pentagram/sigil)
      pc.strokeStyle = '#3b82f6'; // Bright glowing blue vector sigil in the center
      pc.lineWidth = 4;
      pc.beginPath();
      pc.arc(256, 400, 52, 0, Math.PI * 2);
      pc.stroke();

      pc.strokeStyle = '#10b981'; // Green glowing central pentagram stars
      pc.lineWidth = 3;
      pc.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const sx = 256 + Math.cos(ang) * 52;
        const sy = 400 + Math.sin(ang) * 52;
        if (i === 0) pc.moveTo(sx, sy);
        else pc.lineTo(sx, sy);
      }
      pc.closePath();
      pc.stroke();

      const pageTex = new THREE.CanvasTexture(pageCanvas);
      const pageMat = new THREE.MeshStandardMaterial({ 
        map: pageTex, 
        roughness: 0.95, 
        metalness: 0.05, 
        side: THREE.DoubleSide 
      });

      // Cover plate dimension geometry & decorations
      const coverCornerGeo = new THREE.BoxGeometry(0.04, 0.024, 0.04);

      // --- LEFT COVER GROUP ---
      const leftCoverGroup = new THREE.Group();
      leftCoverGroup.position.set(-0.04, 0.025, 0); // hinge pivot
      bookGroup.add(leftCoverGroup);
      mysteryBoxRef.current.leftCover = leftCoverGroup;

      const leftCoverPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.022, 0.74), leatherCoverMat);
      leftCoverPlate.position.set(-0.23, 0, 0); // pivot offset
      leftCoverPlate.castShadow = true;
      leftCoverGroup.add(leftCoverPlate);

      // Left Cover corners
      for (let cx of [-0.43, -0.03]) {
        for (let cz of [-0.34, 0.34]) {
          const corner = new THREE.Mesh(coverCornerGeo, bookGoldMat);
          corner.position.set(cx, 0.007, cz);
          leftCoverGroup.add(corner);
        }
      }

      // Static Left Page block (thick yellowed stack of pages that lies on left cover)
      const pageBlockGeo = new THREE.BoxGeometry(0.43, 0.04, 0.70);
      const pageEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd9cca3, roughness: 0.98 });
      const leftPageBlock = new THREE.Mesh(pageBlockGeo, pageEdgeMat);
      leftPageBlock.position.set(-0.235, 0.03, 0);
      leftPageBlock.receiveShadow = true;
      leftCoverGroup.add(leftPageBlock);

      // Decorative top page layer of the left block showing parchment text
      const topPageLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.69), pageMat);
      topPageLeft.rotation.x = -Math.PI / 2;
      topPageLeft.position.set(-0.235, 0.051, 0);
      topPageLeft.receiveShadow = true;
      leftCoverGroup.add(topPageLeft);


      // --- RIGHT COVER GROUP ---
      const rightCoverGroup = new THREE.Group();
      rightCoverGroup.position.set(0.04, 0.025, 0); // right hinge pivot
      bookGroup.add(rightCoverGroup);
      mysteryBoxRef.current.rightCover = rightCoverGroup;

      const rightCoverPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.022, 0.74), leatherCoverMat);
      rightCoverPlate.position.set(0.23, 0, 0);
      rightCoverPlate.castShadow = true;
      rightCoverGroup.add(rightCoverPlate);

      // Right Cover corners
      for (let cx of [0.03, 0.43]) {
        for (let cz of [-0.34, 0.34]) {
          const corner = new THREE.Mesh(coverCornerGeo, bookGoldMat);
          corner.position.set(cx, 0.007, cz);
          rightCoverGroup.add(corner);
        }
      }

      // Static Right Page block (thick yellowed pages)
      const rightPageBlock = new THREE.Mesh(pageBlockGeo, pageEdgeMat);
      rightPageBlock.position.set(0.235, 0.03, 0);
      rightPageBlock.receiveShadow = true;
      rightCoverGroup.add(rightPageBlock);

      // Decorative top page layer showing the right side page text
      const topPageRight = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.69), pageMat);
      topPageRight.rotation.x = -Math.PI / 2;
      topPageRight.position.set(0.235, 0.051, 0);
      topPageRight.receiveShadow = true;
      rightCoverGroup.add(topPageRight);


      // --- THREE DYNAMIC FLIPPING PAGES (SOUPED UP PAGE TURNING EFFECT) ---
      const flippingPages: THREE.Group[] = [];
      for (let i = 0; i < 3; i++) {
        const pageHolder = new THREE.Group();
        pageHolder.position.set(0, 0.056, 0); // pivot at spine center
        
        // Single sheet mesh
        const pageSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.69), pageMat);
        pageSheet.rotation.x = -Math.PI / 2;
        pageSheet.position.set(0.21, 0, 0); // pivot offset
        pageHolder.add(pageSheet);
        
        bookGroup.add(pageHolder);
        flippingPages.push(pageHolder);
      }
      mysteryBoxRef.current.flippingPages = flippingPages;

      // Close the book initially (Z rotation = Math.PI makes Left cover rotate 180° onto the Right cover)
      leftCoverGroup.rotation.z = Math.PI;
      // In closed state, dynamic flipping pages lie flat on the right cover (rotation.z = 0)
      flippingPages.forEach(p => { p.rotation.z = 0; });


      // --- WEAPON CONTAINER STAND & GLOW GROUP ---
      // Place the weapon glow/rise center directly in the book's center!
      const weaponGlowG = new THREE.Group();
      weaponGlowG.position.set(0, 1.16, 0); // starting height inside open book pages (on the pedestal)
      mbGroup.add(weaponGlowG);
      mysteryBoxRef.current.weaponGlowGroup = weaponGlowG;

      // Magical Point Light focused directly inside the center of the matching ancient text
      const bookGlow = new THREE.PointLight(0xeab308, 0, 5.0); // Gold initial glow light
      bookGlow.position.set(0, 1.24, 0);
      mbGroup.add(bookGlow);
      mysteryBoxRef.current.bookGlowLight = bookGlow;

      // Also support the previous direct boxLight mapping just in case
      (mbGroup as any).boxLight = bookGlow;


      // --- MAGICAL PARTICLE SYSTEM FOR RITUAL ATMOSPHERE ---
      const particlesGroup = new THREE.Group();
      particlesGroup.position.set(0, 1.18, 0);
      mbGroup.add(particlesGroup);
      mysteryBoxRef.current.particlesGroup = particlesGroup;

      // Generate pool of 24 floating particles (dust, magical embers, gold flakes, floating page scrap)
      const pCount = 24;
      const partColors = [0x10b981, 0xeab308, 0x3b82f6]; // Embers of green, gold, and blue
      for (let i = 0; i < pCount; i++) {
        const size = 0.012 + Math.random() * 0.018;
        const pGeo = new THREE.BoxGeometry(size, size, size);
        const pMat = new THREE.MeshBasicMaterial({ 
          color: partColors[i % partColors.length],
          transparent: true,
          opacity: 0.0 // hide completely when idle
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        
        // Random distribution refs stored as metadata
        (pMesh as any).vx = (Math.random() - 0.5) * 0.35;
        (pMesh as any).vy = 0.2 + Math.random() * 0.45;
        (pMesh as any).vz = (Math.random() - 0.5) * 0.35;
        (pMesh as any).rotSpeed = 0.5 + Math.random() * 3.0;
        (pMesh as any).age = Math.random() * 2.0;
        
        // Random offset
        pMesh.position.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * 0.3,
          (Math.random() - 0.5) * 0.4
        );
        particlesGroup.add(pMesh);
      }

      // Floating "THE FORBIDDEN TOME" banner above the pedestal for clear visibility
      const tomeSignCanvas = document.createElement('canvas');
      tomeSignCanvas.width = 512; tomeSignCanvas.height = 128;
      const tsc = tomeSignCanvas.getContext('2d')!;
      tsc.fillStyle = 'rgba(8,4,4,0.85)'; tsc.fillRect(0, 0, 512, 128);
      tsc.strokeStyle = '#9c2b2b'; tsc.lineWidth = 6; tsc.strokeRect(4, 4, 504, 120);
      tsc.fillStyle = '#e0b048'; tsc.font = 'bold 40px Georgia, serif'; tsc.textAlign = 'center';
      tsc.fillText('THE FORBIDDEN TOME', 256, 52);
      tsc.fillStyle = '#cbb27a'; tsc.font = 'italic 24px Georgia, serif';
      tsc.fillText('Press E — $950', 256, 96);
      const tomeSignTex = new THREE.CanvasTexture(tomeSignCanvas);
      const tomeSign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 0.5),
        new THREE.MeshBasicMaterial({ map: tomeSignTex, side: THREE.DoubleSide, transparent: true })
      );
      tomeSign.position.set(0, 2.05, 0);
      mbGroup.add(tomeSign);

      // Pedestal placement against the east wall of the spawn classroom
      const bx = mysteryBoxRef.current.position[0];
      const by = mysteryBoxRef.current.position[1];
      const bz = mysteryBoxRef.current.position[2];
      mbGroup.position.set(bx, by, bz);
      mbGroup.rotation.y = mysteryBoxRef.current.rotationY;
      scene.add(mbGroup);

      const mbColl = new THREE.Box3().setFromObject(mbGroup);
      classroomObstacles.push(mbColl);
    };
    buildMysteryBoxMesh();

    // --- PROCEDURAL HALLWAY DETAILS PASS ---
    const buildHallwayDetails = () => {
      // 1. Classroom Signs (glowing plastic label above exit door)
      const signBacking = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.1), blackMetalMaterial);
      signBacking.position.set(14.0, 3.8, 0);
      signBacking.rotation.y = -Math.PI / 2;
      scene.add(signBacking);
      
      const signLabel = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      signLabel.position.set(13.94, 3.8, 0);
      signLabel.rotation.y = -Math.PI / 2;
      scene.add(signLabel);

      // Warning hazard signs and signs inside the corridor
      const signBackingNorth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.1), blackMetalMaterial);
      signBackingNorth.position.set(18.0, 3.8, -24.8);
      scene.add(signBackingNorth);
      
      const signLabelNorth = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.12), new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff4400, emissiveIntensity: 1.5 }));
      signLabelNorth.position.set(18.0, 3.8, -24.72);
      scene.add(signLabelNorth);

      // 2. Bulletin Boards along the corridor
      const createBulletinBoard = (x: number, y: number, z: number, rotY: number) => {
        const board = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.08), woodMaterial);
        board.add(frame);
        
        const cork = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }));
        cork.position.z = 0.02;
        board.add(cork);
        
        // Add tiny white warning sheets pinned on board
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.95 }));
        paper.position.set(-0.5, 0.1, 0.04);
        paper.rotation.z = 0.1;
        board.add(paper);

        const paper2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0xdddddf, roughness: 0.95 }));
        paper2.position.set(0.4, -0.2, 0.04);
        paper2.rotation.z = -0.15;
        board.add(paper2);

        board.position.set(x, y, z);
        board.rotation.y = rotY;
        scene.add(board);
      };
      
      // Bulletin board on West wall north side and East wall south side
      createBulletinBoard(14.05, 2.0, -8.0, Math.PI / 2);
      createBulletinBoard(21.95, 2.2, 8.0, -Math.PI / 2);

      // 3. Fallen Ceiling Tiles on ground
      const tileGeom = new THREE.BoxGeometry(0.9, 0.04, 0.9);
      const tileMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
      for (let i = 0; i < 6; i++) {
        const tile = new THREE.Mesh(tileGeom, tileMat);
        // Scatter tiles in different quadrants of corridor floor
        const tz = (i - 3.0) * 14.0 + (Math.random() - 0.5) * 5.0;
        const tx = 18.0 + (Math.random() - 0.5) * 4.0;
        tile.position.set(tx, 0.02, tz);
        tile.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
        tile.castShadow = true;
        tile.receiveShadow = true;
        scene.add(tile);
      }

      // 4. Exposed Pipes running along ceiling
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x7c7c7c, roughness: 0.25, metalness: 0.85 });
      const pipeNorthGroup = new THREE.Group();
      
      // Main piping cylinder
      const longPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 50.0, 8), pipeMat);
      longPipe.rotation.x = Math.PI / 2;
      longPipe.position.set(0, 0, 0);
      pipeNorthGroup.add(longPipe);
      
      // Joint rings along plumbing lines
      for (let k = 0; k < 6; k++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8), pipeMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0, -25.0 + k * 10);
        pipeNorthGroup.add(ring);
      }

      // Place pipes near the East Ceiling corner of the hallway
      pipeNorthGroup.position.set(21.6, 4.25, 0);
      scene.add(pipeNorthGroup);

      // 5. Electrical Panel boxes on West corridor wall
      const panel = new THREE.Group();
      const pBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.7 }));
      panel.add(pBox);
      
      // Glowing green/red status light
      const statusLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      statusLight.position.set(-0.06, 0.35, 0.15);
      panel.add(statusLight);

      // Yellow caution warning badge
      const cautionSign = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ color: 0xeab308 }));
      cautionSign.position.set(-0.06, 0.1, -0.15);
      cautionSign.rotation.y = -Math.PI / 2;
      panel.add(cautionSign);

      panel.position.set(14.05, 2.2, -6.5);
      scene.add(panel);

      // 6. Scattered School Trash & Debris
      const trashPaperMat = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.95 });
      for (let i = 0; i < 15; i++) {
        const trashPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), trashPaperMat);
        trashPaper.position.set(
          14.5 + Math.random() * 6.5,
          0.008,
          (Math.random() - 0.5) * 44.0
        );
        trashPaper.rotation.x = -Math.PI / 2;
        trashPaper.rotation.z = Math.random() * Math.PI;
        scene.add(trashPaper);
      }

      // Broken chairs / flipped desks in corridor
      const chairGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), woodMaterial);
      seat.position.y = 0.38;
      chairGroup.add(seat);
      const support1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38), blackMetalMaterial);
      support1.position.set(-0.2, 0.19, -0.2);
      chairGroup.add(support1);
      const support2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38), blackMetalMaterial);
      support2.position.set(0.2, 0.19, 0.2);
      chairGroup.add(support2);
      chairGroup.position.set(19.2, 0, 16.0);
      chairGroup.rotation.set(0, 1.2, 1.4); // knocked down flat
      scene.add(chairGroup);
      
      const collBox = new THREE.Box3().setFromObject(chairGroup);
      classroomObstacles.push(collBox);
    };

    buildHallwayDetails();

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
      { x: 18.0, z: -6.0, label: 'Hallway Near North' },
      { x: 18.0, z: 6.0, label: 'Hallway Near South' },
      { x: 30.0, z: -18.5, label: 'Classroom 2 North' },
      { x: 32.0, z: -8.5, label: 'Classroom 2 South' },
      { x: 30.0, z: 8.5, label: 'Classroom 3 North' },
      { x: 32.0, z: 18.5, label: 'Classroom 3 South' }
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

    const addSmgWallbuy = (): WallBuy => {
      const g = new THREE.Group();

      const buySign = new THREE.Group();
      const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }));
      buySign.add(wallSign);

      const frameBuy = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.02), emissionGreen);
      frameBuy.position.z = -0.01;
      buySign.add(frameBuy);

      buySign.position.set(0, 0.4, 0);
      g.add(buySign);

      // Render actual SMG model replica on wall
      const smgG = new THREE.Group();

      // Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), blackMetalMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.06, -0.2);
      smgG.add(barrel);

      // Receiver (body of MP5)
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.45), blackMetalMaterial);
      receiver.position.set(0, 0.05, 0.15);
      smgG.add(receiver);

      // Magazine (curved MP5 mag)
      const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.045), blackMetalMaterial);
      magazine.position.set(0, -0.07, 0.05);
      magazine.rotation.x = 0.25;
      smgG.add(magazine);

      // Grip and stock
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), blackMetalMaterial);
      grip.position.set(0, -0.05, 0.22);
      grip.rotation.x = -0.3;
      smgG.add(grip);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.35), woodMaterial);
      stock.position.set(0, 0.02, 0.45);
      smgG.add(stock);

      // Rotate and position flat along East Wall (facing West, i.e., rotation Y = -Math.PI / 2)
      smgG.rotation.y = Math.PI / 2;
      smgG.position.set(-0.15, -0.1, 0);
      g.add(smgG);

      const wallBuyX = HALLWAY_X_CENTER + HALLWAY_W / 2 - 0.28; // Face of eastern wall (18 + 4 - 0.28 = 21.72)
      const wallBuyY = 1.6;
      const wallBuyZ = -17.0;

      g.position.set(wallBuyX, wallBuyY, wallBuyZ);
      g.rotation.y = -Math.PI / 2; // Facing the hallway looking West
      scene.add(g);

      return {
        id: 'wall-smg',
        weaponId: 'smg',
        position: [wallBuyX - 0.2, wallBuyY, wallBuyZ],
        rotationY: -Math.PI / 2,
        price: 1000,
        purchased: false,
        textMesh: g
      };
    };

    const smgWallBuy = addSmgWallbuy();

    // --- SOLID BUYABLE DOOR OBSTACLE SYSTEM ---
    const buildBuyableDoor = (
      id: string = 'door-classroom-exit',
      price: number = 1200,
      customX: number = CLASSROOM_W / 2,
      customY: number = 0,
      customZ: number = 0,
      width: number = 0.25,
      height: number = 2.8,
      dLength: number = 1.5,
      rotationY: number = 0,
      customLabelText: string = 'CLASSROOM OUTLET',
      signRotateY: number = -Math.PI / 2
    ): BuyableDoor => {
      const g = new THREE.Group();

      // Proportions: dLength is door width, height is door height, width is door thickness
      const doorGroup = new THREE.Group();

      // Outer trim/casing
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0.1 });
      const frameTh = width * 1.1; // frame is a bit thicker
      const frameW = 0.08; // width of casing frame

      // Left post
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, height + frameW, frameTh), trimMat);
      leftPost.position.set(-dLength / 2 - frameW / 2, height / 2, 0);
      leftPost.castShadow = true;
      leftPost.receiveShadow = true;
      doorGroup.add(leftPost);

      // Right post
      const rightPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, height + frameW, frameTh), trimMat);
      rightPost.position.set(dLength / 2 + frameW / 2, height / 2, 0);
      rightPost.castShadow = true;
      rightPost.receiveShadow = true;
      doorGroup.add(rightPost);

      // Top lintel
      const topLintel = new THREE.Mesh(new THREE.BoxGeometry(dLength + frameW * 2, frameW, frameTh), trimMat);
      topLintel.position.set(0, height + frameW / 2, 0);
      topLintel.castShadow = true;
      topLintel.receiveShadow = true;
      doorGroup.add(topLintel);

      // Door Slab(s)
      const isDoubleDoor = dLength > 1.8;
      const doorTh = 0.05; // 5cm thick slab
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5, // Pristine classroom door white
        roughness: 0.7,
        metalness: 0.05
      });

      const addSixPanels = (parentG: THREE.Object3D, sW: number, sH: number, isRightSidedHinged = false) => {
        // Parent slab is sW x sH. Local center is at sW/2, sH/2.
        // Add panel decorations on front (+Z) and back (-Z)
        const addPanelSet = (zSign: number) => {
          const panelMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.75, metalness: 0.02 });
          const pWidth = sW * 0.32;
          const pTh = 0.012;
          
          const rows = [
            { y: sH * 0.84, h: sH * 0.11 },
            { y: sH * 0.52, h: sH * 0.36 },
            { y: sH * 0.20, h: sH * 0.22 }
          ];

          rows.forEach(r => {
            const xOffsetLeft = isRightSidedHinged ? sW * 0.74 : sW * 0.26;
            const xOffsetRight = isRightSidedHinged ? sW * 0.26 : sW * 0.74;

            const pL = new THREE.Mesh(new THREE.BoxGeometry(pWidth, r.h, pTh), panelMat);
            pL.position.set(xOffsetLeft - sW/2, r.y - sH/2, zSign * (doorTh/2 + pTh/2));
            pL.castShadow = true;
            pL.receiveShadow = true;
            parentG.add(pL);

            const pR = new THREE.Mesh(new THREE.BoxGeometry(pWidth, r.h, pTh), panelMat);
            pR.position.set(xOffsetRight - sW/2, r.y - sH/2, zSign * (doorTh/2 + pTh/2));
            pR.castShadow = true;
            pR.receiveShadow = true;
            parentG.add(pR);
          });
        };

        addPanelSet(1);
        addPanelSet(-1);

        // Doorknob/handle hardware (matte charcoal paint finish)
        const kbMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.9 });
        const hG = new THREE.Group();
        const knobX = isRightSidedHinged ? sW * 0.12 - sW/2 : sW * 0.88 - sW/2;
        
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.01), kbMat);
        plate.position.set(knobX, sH * 0.45 - sH/2, 0);
        hG.add(plate);

        const knobF = new THREE.Mesh(new THREE.BoxGeometry(isRightSidedHinged ? -0.1 : 0.1, 0.02, 0.02), kbMat);
        knobF.position.set(knobX + (isRightSidedHinged ? -0.04 : 0.04), sH * 0.45 - sH/2, doorTh / 2 + 0.03);
        const knobFJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), kbMat);
        knobFJoint.rotation.x = Math.PI / 2;
        knobFJoint.position.set(knobX, sH * 0.45 - sH/2, doorTh / 2 + 0.015);
        hG.add(knobF);
        hG.add(knobFJoint);

        const knobB = new THREE.Mesh(new THREE.BoxGeometry(isRightSidedHinged ? -0.1 : 0.1, 0.02, 0.02), kbMat);
        knobB.position.set(knobX + (isRightSidedHinged ? -0.04 : 0.04), sH * 0.45 - sH/2, -doorTh / 2 - 0.03);
        const knobBJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), kbMat);
        knobBJoint.rotation.x = Math.PI / 2;
        knobBJoint.position.set(knobX, sH * 0.45 - sH/2, -doorTh / 2 - 0.015);
        hG.add(knobB);
        hG.add(knobBJoint);

        parentG.add(hG);
      };

      if (isDoubleDoor) {
        // Double doors: Left slab swings left, Right slab swings right.
        const halfW = dLength / 2;

        const slabGroupL = new THREE.Group();
        slabGroupL.position.set(-dLength / 2, 0, 0); // Hinge location
        const slabL = new THREE.Mesh(new THREE.BoxGeometry(halfW - 0.01, height - 0.02, doorTh), slabMat);
        slabL.position.set(halfW / 2, height / 2, 0);
        slabL.castShadow = true;
        slabL.receiveShadow = true;
        slabGroupL.add(slabL);
        addSixPanels(slabL, halfW, height, false);
        doorGroup.add(slabGroupL);
        
        const slabGroupR = new THREE.Group();
        slabGroupR.position.set(dLength / 2, 0, 0); // Hinge location
        const slabR = new THREE.Mesh(new THREE.BoxGeometry(halfW - 0.01, height - 0.02, doorTh), slabMat);
        slabR.position.set(-halfW / 2, height / 2, 0);
        slabR.castShadow = true;
        slabR.receiveShadow = true;
        slabGroupR.add(slabR);
        addSixPanels(slabR, halfW, height, true);
        doorGroup.add(slabGroupR);

        g.userData = { slabGroupL, slabGroupR, isDouble: true };
      } else {
        // Single door: pivots on Left hinge
        const panelGroup = new THREE.Group();
        panelGroup.position.set(-dLength / 2, 0, 0);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(dLength - 0.01, height - 0.02, doorTh), slabMat);
        slab.position.set(dLength / 2, height / 2, 0);
        slab.castShadow = true;
        slab.receiveShadow = true;
        panelGroup.add(slab);
        addSixPanels(slab, dLength, height, false);
        doorGroup.add(panelGroup);

        g.userData = { panelGroup, isDouble: false };
      }

      g.add(doorGroup);

      // Invisible box mesh used for raycast collision detection
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          rotationY !== 0 ? dLength : width,
          height,
          rotationY !== 0 ? width : dLength
        ),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      doorMesh.position.y = height / 2;
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
      sc.fillText(customLabelText, 256, 45);
      sc.font = 'bold 28px Courier New';
      sc.fillText(`Press E to Open [$${price}]`, 256, 95);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const buySignOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 0.75),
        new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true })
      );
      buySignOverlay.position.set(0, height + 0.5, 0);
      // signRotateY is the desired world-space facing; subtract the group rotation so the
      // banner keeps that facing regardless of how the door group itself is rotated.
      buySignOverlay.rotation.y = signRotateY - rotationY;
      g.add(buySignOverlay);
      g.userData.sign = buySignOverlay;

      g.position.set(customX, customY, customZ);
      g.rotation.y = rotationY;
      scene.add(g);

      return {
        id,
        price,
        position: [customX, customY, customZ],
        rotationY,
        width: rotationY !== 0 ? dLength : width,
        height,
        purchased: false,
        group: g,
        doorMesh,
        sinkOffset: 0
      };
    };

    // Doors sit in the vertical (Z-running) east walls of classroom 1 and the hallway.
    // The door slab is modelled along its local X axis, so each door group is rotated
    // -90° about Y to make the slab span the Z-axis doorway opening and sit flush in the
    // wall plane. The collider box and swing/sink animation are all relative to the group,
    // so they follow the rotation automatically.
    const classroomExitDoor = buildBuyableDoor('door-classroom-exit', 1200, CLASSROOM_W / 2, 0, 0, 0.25, 2.8, 2.4, -Math.PI / 2, 'EAST EXIT', -Math.PI / 2);
    const doorHallwayNorth = buildBuyableDoor('door-hallway-north', 1000, 22.0, 0, -12.5, 0.25, 2.8, 1.5, -Math.PI / 2, 'NORTH CLASSROOM', -Math.PI / 2);
    const doorHallwaySouth = buildBuyableDoor('door-hallway-south', 1500, 22.0, 0, 12.5, 0.25, 2.8, 1.5, -Math.PI / 2, 'SOUTH CLASSROOM', -Math.PI / 2);

    const hallwayDoors = [classroomExitDoor, doorHallwayNorth, doorHallwaySouth];

    // --- UNIFIED WALL COLLISION SYSTEM ---
    // Solid wall segments expressed as axis-aligned XZ rectangles. A segment whose
    // `gate` door has been purchased becomes passable (the doorway opening). This single
    // model is shared by the player, bots, and zombies so nobody clips through walls and
    // everyone is funnelled through the actual door openings.
    // `gate`: segment is solid until the door is purchased (then it becomes the opening).
    // `closedGate`: segment is solid only while the door is NOT purchased (the closed door slab).
    interface WallSeg { minX: number; maxX: number; minZ: number; maxZ: number; gate?: BuyableDoor; closedGate?: BuyableDoor; }
    const HT = 0.25; // half wall thickness used for collider rectangles
    const wallSegments: WallSeg[] = [
      // Classroom 1 perimeter
      { minX: -14 - HT, maxX: -14 + HT, minZ: -12, maxZ: 12 },             // West wall (solid)
      { minX: -14, maxX: 14, minZ: -12 - HT, maxZ: -12 + HT },            // North wall
      { minX: -14, maxX: 14, minZ: 12 - HT, maxZ: 12 + HT },              // South wall
      // East wall of classroom 1 — permanent wall flanking the doorway opening (z in [-2,2])
      { minX: 14 - HT, maxX: 14 + HT, minZ: -12, maxZ: -2 },
      { minX: 14 - HT, maxX: 14 + HT, minZ: 2, maxZ: 12 },
      // Exit-door slab fills the opening while locked; clears once purchased
      { minX: 14 - HT, maxX: 14 + HT, minZ: -2, maxZ: 2, closedGate: classroomExitDoor },

      // Hallway west-side cap walls (separate hallway ends from the void)
      { minX: 14 - HT, maxX: 14 + HT, minZ: -25, maxZ: -12 },
      { minX: 14 - HT, maxX: 14 + HT, minZ: 12, maxZ: 25 },
      // Hallway end caps
      { minX: 14, maxX: 22, minZ: -25 - HT, maxZ: -25 + HT },
      { minX: 14, maxX: 22, minZ: 25 - HT, maxZ: 25 + HT },
      // Hallway east wall — openings at z[-13.25,-11.75] (north door) & z[11.75,13.25] (south door)
      { minX: 22 - HT, maxX: 22 + HT, minZ: -25, maxZ: -13.25 },
      { minX: 22 - HT, maxX: 22 + HT, minZ: -11.75, maxZ: 11.75 },
      { minX: 22 - HT, maxX: 22 + HT, minZ: 13.25, maxZ: 25 },
      // Door slabs fill the openings while locked; clear once purchased
      { minX: 22 - HT, maxX: 22 + HT, minZ: -13.25, maxZ: -11.75, closedGate: doorHallwayNorth },
      { minX: 22 - HT, maxX: 22 + HT, minZ: 11.75, maxZ: 13.25, closedGate: doorHallwaySouth },

      // Classroom 2 (north) perimeter — entered through north door, x in [22,38], z in [-21.5,-3.5]
      { minX: 22, maxX: 38, minZ: -21.5 - HT, maxZ: -21.5 + HT },
      { minX: 22, maxX: 38, minZ: -3.5 - HT, maxZ: -3.5 + HT },
      { minX: 38 - HT, maxX: 38 + HT, minZ: -21.5, maxZ: -3.5 },

      // Classroom 3 (south) perimeter — x in [22,38], z in [3.5,21.5]
      { minX: 22, maxX: 38, minZ: 3.5 - HT, maxZ: 3.5 + HT },
      { minX: 22, maxX: 38, minZ: 21.5 - HT, maxZ: 21.5 + HT },
      { minX: 38 - HT, maxX: 38 + HT, minZ: 3.5, maxZ: 21.5 },
    ];

    // Resolve a circle (entity footprint) against all active wall segments by pushing it
    // out along the axis of least penetration. Mutates the passed position vector in place.
    const resolveWallCollisions = (pos: THREE.Vector3, radius: number) => {
      for (const seg of wallSegments) {
        if (seg.gate && seg.gate.purchased) continue;       // wall that opens up once bought
        if (seg.closedGate && seg.closedGate.purchased) continue; // door slab clears once bought
        // Closest point on the rectangle to the circle centre
        const cx = Math.max(seg.minX, Math.min(seg.maxX, pos.x));
        const cz = Math.max(seg.minZ, Math.min(seg.maxZ, pos.z));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= radius * radius) {
          if (distSq > 0) continue; // outside and clear of this segment
          // Centre is exactly on an edge with zero distance — fall through to penetration push
        }
        if (distSq > 0.000001) {
          // Circle centre is outside the rectangle but overlapping: push straight out
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Centre is inside the rectangle: eject along the nearest face
          const toLeft = pos.x - seg.minX;
          const toRight = seg.maxX - pos.x;
          const toBack = pos.z - seg.minZ;
          const toFront = seg.maxZ - pos.z;
          const minPen = Math.min(toLeft, toRight, toBack, toFront);
          if (minPen === toLeft) pos.x = seg.minX - radius;
          else if (minPen === toRight) pos.x = seg.maxX + radius;
          else if (minPen === toBack) pos.z = seg.minZ - radius;
          else pos.z = seg.maxZ + radius;
        }
      }
    };

    // --- ROOM ROUTING FOR ZOMBIES ---
    // Map regions and the doorway each zombie must reach to cross toward its target. This
    // gives crude but reliable navigation: a zombie in a different room steers to the
    // connecting doorway (only once the door is open) instead of grinding into a wall.
    type RoomId = 'classroom1' | 'hallway' | 'classroom2' | 'classroom3';
    const whichRoom = (x: number, z: number): RoomId => {
      if (x < 14) return 'classroom1';
      if (x < 22) return 'hallway';
      return z < 0 ? 'classroom2' : 'classroom3';
    };
    // Doorway centre points (the gap the entity should aim for to pass between rooms).
    const DOORWAY_EXIT = new THREE.Vector3(14, 0, 0);        // classroom1 <-> hallway
    const DOORWAY_NORTH = new THREE.Vector3(22, 0, -12.5);   // hallway <-> classroom2
    const DOORWAY_SOUTH = new THREE.Vector3(22, 0, 12.5);    // hallway <-> classroom3

    // Returns the point a zombie should currently steer toward to make progress to target.
    const computeSteerPoint = (from: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 => {
      const fromRoom = whichRoom(from.x, from.z);
      const targetRoom = whichRoom(target.x, target.z);
      if (fromRoom === targetRoom) return target;

      // Route hop-by-hop toward the target room through open doorways.
      switch (fromRoom) {
        case 'classroom1':
          return classroomExitDoor.purchased ? DOORWAY_EXIT : target;
        case 'hallway':
          if (targetRoom === 'classroom1') return classroomExitDoor.purchased ? DOORWAY_EXIT : target;
          if (targetRoom === 'classroom2') return doorHallwayNorth.purchased ? DOORWAY_NORTH : target;
          if (targetRoom === 'classroom3') return doorHallwaySouth.purchased ? DOORWAY_SOUTH : target;
          return target;
        case 'classroom2':
          return doorHallwayNorth.purchased ? DOORWAY_NORTH : target;
        case 'classroom3':
          return doorHallwaySouth.purchased ? DOORWAY_SOUTH : target;
        default:
          return target;
      }
    };

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
    const activeZombiesList: Zombie[] = [];
    const zombieGroup = new THREE.Group();
    scene.add(zombieGroup);

    // Create zombie 3D meshes and configure starting coordinates
    const designZombieMesh = (colorHex: number): THREE.Group => {
      // Use custom 3D zombie model if successfully loaded
      if (loaded3DModels.zombie) {
        const customZombie = loaded3DModels.zombie.clone();
        // Place custom model scale/position/rotation adjustments here for 3D model customizer
        customZombie.scale.set(1.1, 1.1, 1.1);
        
        // Wrap in parent group so standard movement rotation remains clean and identical
        const parentGrp = new THREE.Group();
        parentGrp.add(customZombie);
        return parentGrp;
      }

      const g = new THREE.Group();
      
      const headG = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.8 }));
      headG.name = "head";
      headG.position.y = 1.55;
      headG.castShadow = true;
      g.add(headG);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9 }));
      torso.position.y = 1.0;
      torso.castShadow = true;
      g.add(torso);

      // Glowing crimson zombie eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), eyeMat);
      eyeL.position.set(-0.1, 1.58, 0.175);
      g.add(eyeL);

      const eyeR = eyeL.clone();
      eyeR.position.x = 0.1;
      g.add(eyeR);

      // Attack arms
      const armMat = new THREE.MeshStandardMaterial({ color: 0xcca483, roughness: 0.8 });
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), armMat);
      armL.position.set(-0.35, 1.15, 0.25);
      armL.rotation.x = -Math.PI / 2.1; // Forward stretch zombie walk
      armL.castShadow = true;
      g.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), armMat);
      armR.position.set(0.35, 1.15, 0.25);
      armR.rotation.x = -Math.PI / 1.95;
      armR.castShadow = true;
      g.add(armR);

      // Tattered school jeans
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.25), new THREE.MeshStandardMaterial({ color: 0x1d2c3d, roughness: 0.9 }));
      legs.position.y = 0.355;
      legs.castShadow = true;
      g.add(legs);

      return g;
    };

    const spawnSingleZombie = (spawnerIdx: number) => {
      const spawnPoint = groundSpawners[spawnerIdx];
      if (!spawnPoint) return;

      const colors = [0x5f3f3f, 0x485a48, 0x3d4352];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const zombieMesh = designZombieMesh(randomColor);

      // Start the zombie crawling out of the floor plane
      zombieMesh.position.set(spawnPoint.x, -1.8, spawnPoint.z);
      
      // Face towards the player
      const dirVector = new THREE.Vector3().subVectors(camera.position, zombieMesh.position).normalize();
      const angle = Math.atan2(dirVector.x, dirVector.z);
      zombieMesh.rotation.y = angle;

      zombieGroup.add(zombieMesh);

      // Configure health and scale dynamic properties
      const healthMult = 1.0 + (stateRef.current.currentRound - 1) * 0.45;
      const startHealth = Math.floor(100 * healthMult);
      const isRunner = stateRef.current.currentRound >= 3 && Math.random() < Math.min(0.15 * stateRef.current.currentRound, 0.7);
      
      const actualSpeed = isRunner 
        ? 2.15 + Math.random() * 0.4 
        : 1.1 + Math.random() * 0.35;

      const crawlStartOffset = Math.random() * Math.PI;

      activeZombiesList.push({
        id: `z-${Math.random().toString(36).substr(2, 9)}`,
        mesh: zombieMesh,
        health: startHealth,
        maxHealth: startHealth,
        speed: actualSpeed,
        damage: isRunner ? 12 : 20,
        scoreReward: 10,
        lastAttackTime: 0,
        state: 'spawning', // Rising through floor
        spawnerIndex: spawnerIdx,
        animTime: crawlStartOffset
      });
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
        shootHeld = false;
        swapWeapon('pistol');
      }
      if (e.code === 'Digit2' && stateRef.current.activeWeaponId !== 'shotgun') {
        shootHeld = false;
        swapWeapon('shotgun');
      }
      if (e.code === 'Digit3' && stateRef.current.activeWeaponId !== 'smg') {
        shootHeld = false;
        swapWeapon('smg');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysMap[e.code] = false;
    };

    // --- FIREWEAPON LOGIC ---
    let fireCooldownLeft = 0;
    let shootHeld = false;

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      if (stateRef.current.gameState !== 'playing') return;

      if (e.button === 0) {
        // LEFT CLICK: Shoot Weapon
        shootHeld = true;
        triggerShootWeapon();
      }
      if (e.button === 2) {
        // RIGHT CLICK: Aim Down Sights
        setIsADS(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        shootHeld = false;
      }
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
        (weaponAmmoRef.current as any)[id].clip = next;
        return next;
      });

      // SFX & Fire timing characteristics
      if (id === 'pistol') {
        sound.playPistol();
        fireCooldownLeft = 0.25; // 250ms fire rate
        maxRecoilOffset.y += 0.035;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.02;
        gunRecoilZOffset = 0.12;
      } else if (id === 'smg') {
        sound.playSmg();
        fireCooldownLeft = 0.095; // fast 95ms fire rate
        maxRecoilOffset.y += 0.016;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.012;
        gunRecoilZOffset = 0.08;
      } else if (id === 'm16') {
        sound.playSmg(); // rapid fire rifle profile
        fireCooldownLeft = 0.12; // 120ms fire rate
        maxRecoilOffset.y += 0.025;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.015;
        gunRecoilZOffset = 0.14;
      } else if (id === 'magnum') {
        sound.playShotgun(); // heavy hand cannon roar
        fireCooldownLeft = 0.65; // slow revolver action
        maxRecoilOffset.y = Math.min(0.25, maxRecoilOffset.y + 0.12);
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.04;
        gunRecoilZOffset = 0.35;
      } else if (id === 'sniper') {
        sound.playShotgun(); // massive bolt action explosion
        fireCooldownLeft = 1.4; // very slow cycle time
        maxRecoilOffset.y = Math.min(0.35, maxRecoilOffset.y + 0.22);
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.06;
        gunRecoilZOffset = 0.48;
      } else if (id === 'wonder_weapon') {
        sound.playWonderBlast(); // unique synth chime attack sound added to sound.ts
        fireCooldownLeft = 1.0; // chime recharge time
        maxRecoilOffset.y += 0.04;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.02;
        gunRecoilZOffset = 0.18;

        // Custom Wonder Weapon Area-of-Effect shockwave code
        activeZombiesList.forEach(z => {
          if (z.health <= 0) return;
          const dist = camera.position.distanceTo(z.mesh.position);
          if (dist <= 7.5) {
            const toZ = z.mesh.position.clone().sub(camera.position).normalize();
            const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
            const dot = toZ.dot(facing);
            if (dot > 0.45) { // 70-degree cone in front of the player
              const dmg = 450;
              z.health -= dmg;
              if (isCoop && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: 'zombie-damage',
                  zombieId: z.id,
                  damage: dmg,
                  isFatal: z.health <= 0
                }));
              }
              triggerZombieHit(z, dmg, z.mesh.position.clone(), true);
            }
          }
        });

        // 3D visual expanding shockwave rings
        const ringGeo = new THREE.RingGeometry(0.1, 1.4, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1.2).applyQuaternion(camera.quaternion));
        ring.lookAt(camera.position);
        scene.add(ring);
        
        // Rapid expansion & fading
        let scaleSize = 1.0;
        const ringAnim = setInterval(() => {
          scaleSize += 0.35;
          ring.scale.set(scaleSize, scaleSize, scaleSize);
          ringMat.opacity -= 0.1;
          if (ringMat.opacity <= 0) {
            clearInterval(ringAnim);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 30);
      } else {
        sound.playShotgun();
        fireCooldownLeft = 0.85; // 850ms fire rate
        maxRecoilOffset.y += 0.088;
        maxRecoilOffset.x += (Math.random() - 0.5) * 0.04;
        gunRecoilZOffset = 0.28;
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
              const baseDmg = id === 'pistol' ? 24 
                            : id === 'smg' ? 18 
                            : id === 'shotgun' ? 22 
                            : id === 'm16' ? 45 
                            : id === 'magnum' ? 110 
                            : id === 'sniper' ? 260 
                            : 18;
              
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
      const maxClip = (weaponAmmoRef.current as any)[id].maxClip;
      if (stateRef.current.ammoClip === maxClip || stateRef.current.ammoReserve <= 0) return;

      setIsReloading(true);
      sound.playReloadClick(0.85);

      const baseReloadTime = id === 'pistol' ? 1500 : (id === 'smg' ? 1800 : 2200);
      const reloadTime = hasFastHandsRef.current ? baseReloadTime / 2 : baseReloadTime;

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
        (weaponAmmoRef.current as any)[id].clip = newClip;
        (weaponAmmoRef.current as any)[id].reserve = newReserve;

        setIsReloading(false);
        sound.playReloadClick(1.2);
      }, reloadTime);
    };

    const swapWeapon = (target: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon') => {
      if (stateRef.current.isReloading) return;
      
      // Prevent players from switching to weapons they do not own!
      if (!weaponsOwnedRef.current.includes(target)) {
        return;
      }

      // Save current weapon's ammo state before switching!
      const current = stateRef.current.activeWeaponId;
      (weaponAmmoRef.current as any)[current].clip = stateRef.current.ammoClip;
      (weaponAmmoRef.current as any)[current].reserve = stateRef.current.ammoReserve;

      // Switch active weapon
      setActiveWeaponId(target);
      stateRef.current.activeWeaponId = target;
      
      // Load target weapon's ammo state!
      const targetAmmo = (weaponAmmoRef.current as any)[target];
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

      // 2b. Buy SMG wall buy or refill ammo
      const distanceToSmgWallbuy = camera.position.distanceTo(new THREE.Vector3(...smgWallBuy.position));
      if (distanceToSmgWallbuy <= 2.45) {
        // If they already own the SMG, Wall Buy REFILLS SMG reserve ammo for $500 instead of buying it again
        if (weaponsOwnedRef.current.includes('smg')) {
          const refillPrice = 500;
          if (stateRef.current.points >= refillPrice) {
            setPoints(p => {
              const next = p - refillPrice;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-refillPrice, `-$500 Ammo`);
            
            const targetAmmo = weaponAmmoRef.current['smg'];
            const maxReserve = targetAmmo.maxReserve;
            
            targetAmmo.reserve = maxReserve;
            if (stateRef.current.activeWeaponId === 'smg') {
              setAmmoReserve(maxReserve);
              stateRef.current.ammoReserve = maxReserve;
            }
            sound.playBuy();
          } else {
            sound.playReloadClick(0.35); // reject beep
          }
        } else {
          // Buying SMG for the first time
          if (stateRef.current.points >= smgWallBuy.price) {
            setPoints(p => {
              const next = p - smgWallBuy.price;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-smgWallBuy.price, `-$1000 SMG`);
            smgWallBuy.purchased = true;
            weaponsOwnedRef.current.push('smg'); // Add to owned inventory
            
            weaponAmmoRef.current.smg.clip = 30;
            weaponAmmoRef.current.smg.reserve = 120;

            sound.playBuy();
            swapWeapon('smg');
          } else {
            sound.playReloadClick(0.35); // reject beep
          }
        }
        return;
      }

      // 2c. Buy Fast Hands Perk Shrine
      const distanceToPerk = camera.position.distanceTo(new THREE.Vector3(...perkMachineRef.current.position));
      if (distanceToPerk <= 2.8) {
        if (!hasFastHandsRef.current) {
          const perkPrice = 2000;
          if (stateRef.current.points >= perkPrice) {
            setPoints(p => {
              const next = p - perkPrice;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-perkPrice, `-$2000 Fast Hands`);
            setHasFastHands(true);
            sound.playBuy();
          } else {
            sound.playReloadClick(0.35);
          }
        }
        return;
      }

      // 2d. Interacting with the Forbidden Tome
      const distanceToMBox = camera.position.distanceTo(new THREE.Vector3(...mysteryBoxRef.current.position));
      if (distanceToMBox <= 2.85) {
        const mBox = mysteryBoxRef.current;
        if (mBox.state === 'idle') {
          if (stateRef.current.points >= mBox.price) {
            setPoints(p => {
              const next = p - mBox.price;
              stateRef.current.points = next;
              return next;
            });
            addScorePopup(-mBox.price, `-$950 Forbidden Tome`);
            
            // Set spin parameters
            mBox.state = 'spinning';
            mBox.spinIdx = 0;
            mBox.spinTicks = 0;
            sound.playBoxSpin();
            
            // Spin timer: cycles for 3 seconds then stops on a selected weapon!
            if (mBox.activeSpinTimer) clearTimeout(mBox.activeSpinTimer);
            mBox.activeSpinTimer = setTimeout(() => {
              const list: Array<'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon'> = [
                'm16', 'magnum', 'sniper', 'wonder_weapon', 'smg', 'shotgun', 'pistol'
              ];
              const r = Math.random();
              let chosen: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
              if (r < 0.12) chosen = 'wonder_weapon'; // 12% Wonder weapon!
              else if (r < 0.28) chosen = 'sniper';    // 16% Sniper
              else if (r < 0.44) chosen = 'magnum';    // 16% Magnum
              else if (r < 0.64) chosen = 'm16';       // 20% M16 Rifle
              else if (r < 0.82) chosen = 'smg';       // 18% SMG
              else chosen = 'shotgun';                 // 18% Shotgun
              
              mBox.weaponId = chosen;
              mBox.state = 'ready';
              sound.playBoxReady();
              
              // Render the static selected model in the container glow slot
              if (mBox.weaponGlowGroup) {
                while (mBox.weaponGlowGroup.children.length > 0) {
                  mBox.weaponGlowGroup.remove(mBox.weaponGlowGroup.children[0]);
                }
                const wMesh = new THREE.Group();
                const glowGoldMat = new THREE.MeshBasicMaterial({ color: chosen === 'wonder_weapon' ? 0x22c55e : 0xeab308 });
                
                if ((chosen as string) === 'pistol') {
                  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), glowGoldMat);
                  wMesh.add(box);
                } else if (chosen === 'shotgun') {
                  const tubes = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8), glowGoldMat);
                  tubes.rotation.x = Math.PI / 2;
                  wMesh.add(tubes);
                } else if (chosen === 'smg') {
                  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.06), glowGoldMat);
                  wMesh.add(receiver);
                } else if (chosen === 'm16') {
                  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.06), glowGoldMat);
                  wMesh.add(receiver);
                } else if (chosen === 'magnum') {
                  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), glowGoldMat);
                  wMesh.add(body);
                } else if (chosen === 'sniper') {
                  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.06), glowGoldMat);
                  wMesh.add(body);
                } else {
                  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 12), glowGoldMat);
                  wMesh.add(body);
                }
                mBox.weaponGlowGroup.add(wMesh);
              }
              
              if (mBox.readyTimeoutTimer) clearTimeout(mBox.readyTimeoutTimer);
              mBox.readyTimeoutTimer = setTimeout(() => {
                mBox.state = 'idle';
                sound.playReloadClick(0.3);
              }, 12000);
              
            }, 3000);
            
          } else {
            sound.playReloadClick(0.35);
          }
        } else if (mBox.state === 'ready') {
          const newWpn = mBox.weaponId;
          
          if (mBox.readyTimeoutTimer) {
            clearTimeout(mBox.readyTimeoutTimer);
            mBox.readyTimeoutTimer = null;
          }
          
          if (weaponsOwnedRef.current.includes(newWpn)) {
            const ammo = weaponAmmoRef.current[newWpn];
            ammo.clip = ammo.maxClip;
            ammo.reserve = ammo.maxReserve;
            if (stateRef.current.activeWeaponId === newWpn) {
              setAmmoClip(ammo.clip);
              setAmmoReserve(ammo.reserve);
              stateRef.current.ammoClip = ammo.clip;
              stateRef.current.ammoReserve = ammo.reserve;
            }
            addScorePopup(0, `Ammunition Refilled_`);
          } else if (weaponsOwnedRef.current.length < 2) {
            weaponsOwnedRef.current.push(newWpn);
            swapWeapon(newWpn);
            addScorePopup(0, `Added Secondary Gun_`);
          } else {
            const currentId = stateRef.current.activeWeaponId;
            const idx = weaponsOwnedRef.current.indexOf(currentId);
            if (idx > -1) {
              weaponsOwnedRef.current[idx] = newWpn;
            } else {
              weaponsOwnedRef.current[0] = newWpn;
            }
            swapWeapon(newWpn);
            addScorePopup(0, `Swapped Active weapon_`);
          }
          
          sound.playBuy();
          mBox.state = 'idle';
        }
        return;
      }

      // 3. Purchase buyable doors to access outer sectors
      for (const door of hallwayDoors) {
        if (!door.purchased) {
          const distanceToDoor = camera.position.distanceTo(new THREE.Vector3(...door.position));
          if (distanceToDoor <= 3.2) {
            if (stateRef.current.points >= door.price) {
              setPoints(p => {
                const next = p - door.price;
                stateRef.current.points = next;
                return next;
              });
              addScorePopup(-door.price, `-$${door.price} Gate Unlock`);
              door.purchased = true;
              sound.playBuy();
              
              // Smoothly trigger sliding sinking removal
              door.sinkOffset = 0.01;
            } else {
              sound.playReloadClick(0.35);
            }
            return;
          }
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
    const updateActiveGunModel = (weaponId: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon') => {
      // Clear out previous meshes securely
      while (activeGunModel.children.length > 0) {
        activeGunModel.remove(activeGunModel.children[0]);
      }

      // High quality tactical uniforms & human skin shaders
      const sleeveMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111625, 
        roughness: 0.88, 
        metalness: 0.05 
      }); // Dark tactical school jacket sleeves
      const skinMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdfab81, 
        roughness: 0.65, 
        metalness: 0.08 
      }); // Classmate tanned skin texture
      const watchStrapsMat = new THREE.MeshStandardMaterial({ 
        color: 0x1f2937, 
        roughness: 0.9 
      }); // Stealth survival watch strap
      const watchBezelMat = new THREE.MeshStandardMaterial({ 
        color: 0x374151, 
        metalness: 0.8, 
        roughness: 0.35 
      }); // Polished watch frame
      const watchGlassMat = new THREE.MeshBasicMaterial({ 
        color: 0x3bf73b 
      }); // Bright green glowing combat interface watch HUD

      // High-quality materials for weapons
      const gunSteelMat = new THREE.MeshStandardMaterial({ 
        color: 0x33363d, 
        roughness: 0.32, 
        metalness: 0.88 
      }); // Slightly reflective, gun metal steel
      const gunDarkMetalMat = new THREE.MeshStandardMaterial({ 
        color: 0x16181b, 
        roughness: 0.48, 
        metalness: 0.9 
      }); // Sights, triggers, and fine details
      const polymerGripMat = new THREE.MeshStandardMaterial({ 
        color: 0x1d1e22, 
        roughness: 0.72, 
        metalness: 0.1 
      }); // Polymer specialized firearm grip parts
      const chromeMat = new THREE.MeshStandardMaterial({ 
        color: 0xe5e7eb, 
        roughness: 0.12, 
        metalness: 0.95 
      }); // Chamber ejection port, slide rod, barrel front and triggers
      const brassBeadMat = new THREE.MeshStandardMaterial({ 
        color: 0xd97706, 
        roughness: 0.22, 
        metalness: 0.85 
      }); // Shotgun brass sight bead
      const richWalnutMat = new THREE.MeshStandardMaterial({ 
        map: woodTex, 
        color: 0x8a4f24, 
        roughness: 0.45, 
        metalness: 0.05 
      }); // Polished break-action stock wood
      const tritGreenMat = new THREE.MeshBasicMaterial({ 
        color: 0x22c55e 
      }); // Glowing tritium dots for iron sights

      // Helper to build a complete hand with palms, wrists, and 5 actual fingers
      const buildProceduralGripHand = (isLeft: boolean, weaponType: 'pistol' | 'shotgun') => {
        const handGroup = new THREE.Group();

        // 1. Palm of the hand
        const palmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.044), skinMaterial);
        palmMesh.castShadow = true;
        handGroup.add(palmMesh);

        // 2. Wrist Connector block
        const wristMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.024), skinMaterial);
        wristMesh.position.set(0, -0.01, -0.022);
        wristMesh.castShadow = true;
        handGroup.add(wristMesh);

        // 3. 5 Custom Fingers (Thumb, Index, Middle, Ring, Pinky)
        // Spacing offset the fingers along the palm width
        for (let f = 0; f < 5; f++) {
          const fingerGroup = new THREE.Group();
          
          // Compute spacing offset on hand Y-axis for grip orientation representation
          const fOffsetY = (f - 2) * 0.0072;
          
          let fingerLength = 0.025;
          if (f === 0) fingerLength = 0.016; // Thumb is short but stout
          if (f === 4) fingerLength = 0.019; // Pinky is tiny

          // Joint 1: Proximal knuckle
          const knuckleJoint = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.007, fingerLength / 2), skinMaterial);
          knuckleJoint.castShadow = true;
          // Position forward from the flat palm center
          knuckleJoint.position.set(isLeft ? -0.014 : 0.014, fOffsetY, 0.015);
          fingerGroup.add(knuckleJoint);

          // Joint 2: Distal finger bone
          const distalJoint = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.006, fingerLength / 2.2), skinMaterial);
          distalJoint.castShadow = true;
          distalJoint.position.set(knuckleJoint.position.x + (isLeft ? -0.006 : 0.006), fOffsetY, knuckleJoint.position.z + 0.01);
          fingerGroup.add(distalJoint);

          // Wrap around the pistol grip or round shotgun forestock pump!
          if (weaponType === 'pistol') {
            if (f === 0) { // Thumb
              knuckleJoint.rotation.set(-0.25, isLeft ? 0.35 : -0.35, 0.1);
              distalJoint.rotation.set(-0.15, isLeft ? 0.5 : -0.5, 0);
            } else if (f === 1) { // High Index trigger finger position
              knuckleJoint.rotation.set(0.12, isLeft ? -0.45 : 0.45, 0.15);
              distalJoint.rotation.set(0.08, isLeft ? -0.75 : 0.75, 0.1);
            } else { // Wrap lower grip handle
              knuckleJoint.rotation.set(0.08, isLeft ? -0.85 : 0.85, 0.05);
              distalJoint.rotation.set(0.04, isLeft ? -1.25 : 1.25, 0);
            }
          } else { // Shotgun pump or stock grip
            if (f === 0) { // Thumb along barrel flank
              knuckleJoint.rotation.set(-0.35, isLeft ? 0.15 : -0.15, -0.08);
              distalJoint.rotation.set(-0.2, isLeft ? 0.25 : -0.25, -0.05);
            } else { // Grab wooden foregrip wrapping under and over!
              knuckleJoint.rotation.set(0.38, isLeft ? -0.82 : 0.82, -0.05);
              distalJoint.rotation.set(0.24, isLeft ? -1.35 : 1.35, -0.02);
            }
          }

          handGroup.add(fingerGroup);
        }

        // Add a gorgeous survival tactical watch on the left wrist to deliver Triple-A high density feel
        if (isLeft) {
          const watchGroup = new THREE.Group();
          watchGroup.position.set(0, -0.012, -0.022);

          // Strap around wrist band
          const strap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.022, 0.015), watchStrapsMat);
          watchGroup.add(strap);

          // Black circular metal bezel frame
          const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8), watchBezelMat);
          bezel.position.set(0, 0.012, 0);
          bezel.rotation.x = Math.PI / 2;
          watchGroup.add(bezel);

          // Glowing survival green interface dial
          const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.013, 8), watchGlassMat);
          glass.position.set(0, 0.0125, 0);
          glass.rotation.x = Math.PI / 2;
          watchGroup.add(glass);

          handGroup.add(watchGroup);
        }

        return handGroup;
      };

      if (weaponId === 'pistol') {
        // If a custom 3D M1911 Pistol GLB is available, clone and render it!
        if (loaded3DModels.pistol) {
          const customPistol = loaded3DModels.pistol.clone();
          // Adjust positioning & scale of custom weapon model to fit player view frustum
          customPistol.position.set(0.12, -0.15, -0.45);
          customPistol.scale.set(1.0, 1.0, 1.0);
          activeGunModel.add(customPistol);
          
          // Render procedural arms/sleeves so gun does not look like it is floating
          const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), sleeveMaterial);
          rArm.position.set(0.14, -0.25, -0.3);
          rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
          activeGunModel.add(rArm);

          const rHand = buildProceduralGripHand(false, 'pistol');
          rHand.position.set(0.12, -0.21, -0.42);
          rHand.rotation.set(0.25, 0, 0);
          activeGunModel.add(rHand);
          return;
        }

        // Slide on top
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.038, 0.24), gunSteelMat);
        slide.position.set(0.12, -0.12, -0.44);
        slide.castShadow = true;
        activeGunModel.add(slide);

        // Slide serration lines at the back (for grip)
        for (let idx = 0; idx < 5; idx++) {
          const serration = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.02, 0.003), gunDarkMetalMat);
          serration.position.set(0.12, -0.12, -0.36 - idx * 0.006);
          activeGunModel.add(serration);
        }

        // Chrome Ejection Port
        const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.045), chromeMat);
        ejPort.position.set(0.125, -0.101, -0.43);
        activeGunModel.add(ejPort);

        // Lower Frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.034, 0.20), gunDarkMetalMat);
        frame.position.set(0.12, -0.155, -0.445);
        frame.castShadow = true;
        activeGunModel.add(frame);

        // Barrel tube coming out from the front
        const innerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 8), chromeMat);
        innerBarrel.rotation.x = Math.PI / 2;
        innerBarrel.position.set(0.12, -0.118, -0.56);
        activeGunModel.add(innerBarrel);

        // Grip handle
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.042), gunDarkMetalMat);
        grip.position.set(0.12, -0.22, -0.42);
        grip.rotation.x = 0.25;
        grip.castShadow = true;
        activeGunModel.add(grip);

        // Left Wood Grip plate
        const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.034), polymerGripMat);
        gripL.position.set(0.103, -0.21, -0.42);
        gripL.rotation.x = 0.25;
        activeGunModel.add(gripL);

        // Right Wood Grip plate
        const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.034), polymerGripMat);
        gripR.position.set(0.137, -0.21, -0.42);
        gripR.rotation.x = 0.25;
        activeGunModel.add(gripR);

        // Trigger Guard (loop)
        const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.04), gunDarkMetalMat);
        trigGuard.position.set(0.12, -0.178, -0.47);
        activeGunModel.add(trigGuard);

        // Trigger (inside the guard)
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.006), chromeMat);
        trigger.position.set(0.12, -0.175, -0.468);
        trigger.rotation.x = -0.2;
        activeGunModel.add(trigger);

        // Sights: Front sight block with tritium dot
        const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.012), gunDarkMetalMat);
        sightF.position.set(0.12, -0.097, -0.55);
        activeGunModel.add(sightF);
        const dotF = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
        dotF.position.set(0.12, -0.095, -0.548);
        activeGunModel.add(dotF);

        // Sights: Rear sight block with two tritium dots
        const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.008), gunDarkMetalMat);
        sightR.position.set(0.12, -0.097, -0.34);
        activeGunModel.add(sightR);
        const dotRL = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
        dotRL.position.set(0.114, -0.095, -0.342);
        activeGunModel.add(dotRL);
        const dotRR = new THREE.Mesh(new THREE.SphereGeometry(0.002, 4, 4), tritGreenMat);
        dotRR.position.set(0.126, -0.095, -0.342);
        activeGunModel.add(dotRR);

        // Right arm/sleeve cylinder supporting the weapon grip
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), sleeveMaterial);
        rArm.position.set(0.14, -0.25, -0.3);
        rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
        rArm.castShadow = true;
        activeGunModel.add(rArm);

        // Rigged right hand with 5 custom fingers grabbing the handle!
        const rHand = buildProceduralGripHand(false, 'pistol');
        rHand.position.set(0.12, -0.21, -0.42);
        rHand.rotation.set(0.25, 0, 0);
        activeGunModel.add(rHand);

        // Left supporting arm holding the pistol steady
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25), sleeveMaterial);
        lArm.position.set(0.02, -0.26, -0.35);
        lArm.rotation.set(Math.PI / 4, Math.PI / 6, 0);
        lArm.castShadow = true;
        activeGunModel.add(lArm);

        // Rigged left hand supporting pistol grip base
        const lHand = buildProceduralGripHand(true, 'pistol');
        lHand.position.set(0.09, -0.21, -0.42);
        lHand.rotation.set(0.15, -0.25, 0);
        activeGunModel.add(lHand);
      } else if (weaponId === 'shotgun') {
        // If a custom 3D M1014 Shotgun GLB is available, clone and render it!
        if (loaded3DModels.shotgun) {
          const customShotgun = loaded3DModels.shotgun.clone();
          // Adjust positioning & scale of custom weapon model to fit player view frustum
          customShotgun.position.set(0.12, -0.16, -0.52);
          customShotgun.scale.set(1.1, 1.1, 1.1);
          activeGunModel.add(customShotgun);

          // Render procedural arms/sleeves so shotgun does not look like it is floating
          const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), sleeveMaterial);
          rArm.position.set(0.16, -0.24, -0.2);
          rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
          activeGunModel.add(rArm);

          const rHand = buildProceduralGripHand(false, 'shotgun');
          rHand.position.set(0.12, -0.18, -0.32);
          rHand.rotation.set(-0.15, 0.12, 0);
          activeGunModel.add(rHand);
          return;
        }

        // Double Barrels (two parallel cylinders next to each other!)
        const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 8), gunSteelMat);
        barrelL.rotation.x = Math.PI / 2;
        barrelL.position.set(0.106, -0.13, -0.56);
        barrelL.castShadow = true;
        activeGunModel.add(barrelL);

        const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 8), gunSteelMat);
        barrelR.rotation.x = Math.PI / 2;
        barrelR.position.set(0.134, -0.13, -0.56);
        barrelR.castShadow = true;
        activeGunModel.add(barrelR);

        // Center connecting rib
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.006, 0.58), gunDarkMetalMat);
        rib.position.set(0.12, -0.12, -0.56);
        activeGunModel.add(rib);

        // Brass sight bead on visual tip
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), brassBeadMat);
        bead.position.set(0.12, -0.114, -0.83);
        activeGunModel.add(bead);

        // Break action receiver (engraved heavy breach block)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.062, 0.16), gunDarkMetalMat);
        receiver.position.set(0.12, -0.14, -0.22);
        receiver.castShadow = true;
        activeGunModel.add(receiver);

        // Detailed silver plates on sides of receiver representing exquisite engravings
        const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.046, 0.12), chromeMat);
        plateL.position.set(0.094, -0.14, -0.22);
        activeGunModel.add(plateL);

        const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.046, 0.12), chromeMat);
        plateR.position.set(0.146, -0.14, -0.22);
        activeGunModel.add(plateR);

        // Pivot break hinge cylinder
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.046, 8), chromeMat);
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(0.12, -0.165, -0.28);
        activeGunModel.add(hinge);

        // Walnut Stock foregrip under the barrels
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.034, 0.22), richWalnutMat);
        pump.position.set(0.12, -0.155, -0.42);
        pump.castShadow = true;
        activeGunModel.add(pump);

        // Wooden Butt Stock Assembly
        // Tapered grip neck
        const woodenButtNeck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.048, 0.16), richWalnutMat);
        woodenButtNeck.position.set(0.12, -0.16, -0.11);
        woodenButtNeck.rotation.x = -0.1;
        woodenButtNeck.castShadow = true;
        activeGunModel.add(woodenButtNeck);

        // Main skeletal buttstock block
        const woodenButt = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.094, 0.22), richWalnutMat);
        woodenButt.position.set(0.12, -0.20, 0.06);
        woodenButt.rotation.x = -0.14;
        woodenButt.castShadow = true;
        activeGunModel.add(woodenButt);

        // Dark recoil pad cushion on stock back face
        const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.096, 0.012), gunDarkMetalMat);
        buttPad.position.set(0.12, -0.203, 0.168);
        buttPad.rotation.x = -0.14;
        activeGunModel.add(buttPad);

        // Double trigger guard loop
        const sgGuard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.048), gunDarkMetalMat);
        sgGuard.position.set(0.12, -0.178, -0.22);
        activeGunModel.add(sgGuard);

        // Left / Right dual triggers
        const triggerL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.005), chromeMat);
        triggerL.position.set(0.116, -0.176, -0.222);
        triggerL.rotation.x = -0.15;
        activeGunModel.add(triggerL);

        // Shotgun Right Arm holding wooden stock
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32), sleeveMaterial);
        rArm.position.set(0.16, -0.24, -0.2);
        rArm.rotation.set(Math.PI / 3.5, 0, -Math.PI / 16);
        rArm.castShadow = true;
        activeGunModel.add(rArm);

        // Rigged right hand holding wooden handle
        const rHand = buildProceduralGripHand(false, 'shotgun');
        rHand.position.set(0.12, -0.18, -0.32);
        rHand.rotation.set(-0.15, 0.12, 0);
        activeGunModel.add(rHand);

        // Shotgun Left Arm stretched forward gripping the forend pump handle!
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.34), sleeveMaterial);
        lArm.position.set(-0.04, -0.22, -0.44);
        lArm.rotation.set(Math.PI / 3.4, Math.PI / 10, 0);
        lArm.castShadow = true;
        activeGunModel.add(lArm);

        // Left skin hand grabbing the pump exactly with actual surrounding fingers!
        const lHand = buildProceduralGripHand(true, 'shotgun');
        lHand.position.set(0.12, -0.15, -0.46); 
        lHand.rotation.set(0.12, -0.18, 0);
        activeGunModel.add(lHand);
      } else if (weaponId === 'smg') {
        const smgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.28), gunDarkMetalMat);
        smgReceiver.position.set(0.12, -0.13, -0.42);
        smgReceiver.castShadow = true;
        activeGunModel.add(smgReceiver);

        const cockingPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), chromeMat);
        cockingPlug.rotation.z = Math.PI / 2;
        cockingPlug.position.set(0.098, -0.11, -0.48);
        activeGunModel.add(cockingPlug);

        const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 8), gunSteelMat);
        smgBarrel.rotation.x = Math.PI / 2;
        smgBarrel.position.set(0.12, -0.12, -0.62);
        smgBarrel.castShadow = true;
        activeGunModel.add(smgBarrel);

        const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.02, 8), gunSteelMat);
        muzzleTip.rotation.x = Math.PI / 2;
        muzzleTip.position.set(0.12, -0.12, -0.68);
        activeGunModel.add(muzzleTip);

        const magHurt1 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.092, 0.03), polymerGripMat);
        magHurt1.position.set(0.12, -0.19, -0.47);
        magHurt1.rotation.x = 0.11;
        magHurt1.castShadow = true;
        activeGunModel.add(magHurt1);

        const magHurt2 = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.052, 0.028), polymerGripMat);
        magHurt2.position.set(0.12, -0.24, -0.462);
        magHurt2.rotation.x = 0.22;
        magHurt2.castShadow = true;
        activeGunModel.add(magHurt2);

        const smgHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.15), polymerGripMat);
        smgHandguard.position.set(0.12, -0.14, -0.52);
        smgHandguard.castShadow = true;
        activeGunModel.add(smgHandguard);

        const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.094, 0.038), polymerGripMat);
        smgGrip.position.set(0.12, -0.21, -0.36);
        smgGrip.rotation.x = 0.2;
        smgGrip.castShadow = true;
        activeGunModel.add(smgGrip);

        const stockTubeL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.16), chromeMat);
        stockTubeL.position.set(0.104, -0.12, -0.26);
        activeGunModel.add(stockTubeL);

        const stockTubeR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.16), chromeMat);
        stockTubeR.position.set(0.136, -0.12, -0.26);
        activeGunModel.add(stockTubeR);

        const stockButt = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.082, 0.016), polymerGripMat);
        stockButt.position.set(0.12, -0.14, -0.18);
        activeGunModel.add(stockButt);

        const frontSightRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), gunSteelMat);
        frontSightRing.position.set(0.12, -0.095, -0.61);
        activeGunModel.add(frontSightRing);

        const smgGuard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.034), gunDarkMetalMat);
        smgGuard.position.set(0.12, -0.175, -0.395);
        activeGunModel.add(smgGuard);

        const rArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.32), sleeveMaterial);
        rArmComp.position.set(0.15, -0.23, -0.22);
        rArmComp.rotation.set(Math.PI / 3.4, 0, -Math.PI / 16);
        rArmComp.castShadow = true;
        activeGunModel.add(rArmComp);

        const rHandGrip = buildProceduralGripHand(false, 'pistol');
        rHandGrip.position.set(0.12, -0.20, -0.36);
        rHandGrip.rotation.set(0.2, 0, 0);
        activeGunModel.add(rHandGrip);

        const lArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.32), sleeveMaterial);
        lArmComp.position.set(-0.02, -0.21, -0.45);
        lArmComp.rotation.set(Math.PI / 3.3, Math.PI / 8, 0);
        lArmComp.castShadow = true;
        activeGunModel.add(lArmComp);

        const lHandGrip = buildProceduralGripHand(true, 'shotgun');
        lHandGrip.position.set(0.12, -0.14, -0.52);
        lHandGrip.rotation.set(0.1, -0.15, 0);
        activeGunModel.add(lHandGrip);
      } else if (weaponId === 'm16') {
        // M16 Assault Rifle Model
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.052, 0.38), gunSteelMat);
        receiver.position.set(0.12, -0.13, -0.42);
        receiver.castShadow = true;
        activeGunModel.add(receiver);

        const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.18), gunDarkMetalMat);
        carryHandle.position.set(0.12, -0.09, -0.42);
        activeGunModel.add(carryHandle);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.28, 8), gunDarkMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.12, -0.12, -0.66);
        barrel.castShadow = true;
        activeGunModel.add(barrel);

        const m16Handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.18, 8), polymerGripMat);
        m16Handguard.rotation.x = Math.PI / 2;
        m16Handguard.position.set(0.12, -0.12, -0.48);
        activeGunModel.add(m16Handguard);

        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.046), polymerGripMat);
        mag.position.set(0.12, -0.19, -0.48);
        mag.rotation.x = 0.12;
        activeGunModel.add(mag);

        const rArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.32), sleeveMaterial);
        rArmComp.position.set(0.15, -0.23, -0.22);
        rArmComp.rotation.set(Math.PI / 3.4, 0, -Math.PI / 16);
        rArmComp.castShadow = true;
        activeGunModel.add(rArmComp);

        const rHandGrip = buildProceduralGripHand(false, 'pistol');
        rHandGrip.position.set(0.12, -0.20, -0.36);
        rHandGrip.rotation.set(0.2, 0, 0);
        activeGunModel.add(rHandGrip);

        const lArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.32), sleeveMaterial);
        lArmComp.position.set(-0.02, -0.21, -0.45);
        lArmComp.rotation.set(Math.PI / 3.3, Math.PI / 8, 0);
        lArmComp.castShadow = true;
        activeGunModel.add(lArmComp);

        const lHandGrip = buildProceduralGripHand(true, 'shotgun');
        lHandGrip.position.set(0.12, -0.14, -0.48);
        lHandGrip.rotation.set(0.1, -0.15, 0);
        activeGunModel.add(lHandGrip);

      } else if (weaponId === 'magnum') {
        // Heavy Magnum Revolver Model
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.05, 0.13), gunSteelMat);
        frame.position.set(0.12, -0.14, -0.4);
        frame.castShadow = true;
        activeGunModel.add(frame);

        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.07, 8), chromeMat);
        cylinder.rotation.x = Math.PI / 2;
        cylinder.position.set(0.12, -0.13, -0.38);
        activeGunModel.add(cylinder);

        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.038, 0.24), gunSteelMat);
        barrel.position.set(0.12, -0.13, -0.52);
        barrel.castShadow = true;
        activeGunModel.add(barrel);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.12, 0.048), polymerGripMat);
        grip.position.set(0.12, -0.21, -0.32);
        grip.rotation.x = 0.24;
        activeGunModel.add(grip);

        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), sleeveMaterial);
        rArm.position.set(0.14, -0.25, -0.3);
        rArm.rotation.set(Math.PI / 3, 0, -Math.PI / 18);
        rArm.castShadow = true;
        activeGunModel.add(rArm);

        const rHand = buildProceduralGripHand(false, 'pistol');
        rHand.position.set(0.12, -0.21, -0.32);
        rHand.rotation.set(0.25, 0, 0);
        activeGunModel.add(rHand);

        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25), sleeveMaterial);
        lArm.position.set(0.02, -0.26, -0.35);
        lArm.rotation.set(Math.PI / 4, Math.PI / 6, 0);
        lArm.castShadow = true;
        activeGunModel.add(lArm);

        const lHand = buildProceduralGripHand(true, 'pistol');
        lHand.position.set(0.09, -0.21, -0.32);
        lHand.rotation.set(0.15, -0.25, 0);
        activeGunModel.add(lHand);

      } else if (weaponId === 'sniper') {
        // High-caliber Bolt-Action Sniper Rifle Model
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.45), gunSteelMat);
        receiver.position.set(0.12, -0.13, -0.42);
        receiver.castShadow = true;
        activeGunModel.add(receiver);

        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), gunSteelMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0.12, -0.07, -0.42);
        activeGunModel.add(scope);

        const scopeRings = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.01), gunDarkMetalMat);
        scopeRings.position.set(0.12, -0.095, -0.42);
        activeGunModel.add(scopeRings);

        const taperedBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 0.58, 8), gunDarkMetalMat);
        taperedBarrel.rotation.x = Math.PI / 2;
        taperedBarrel.position.set(0.12, -0.12, -0.84);
        taperedBarrel.castShadow = true;
        activeGunModel.add(taperedBarrel);

        const bodyStock = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.08, 0.22), polymerGripMat);
        bodyStock.position.set(0.12, -0.15, -0.15);
        activeGunModel.add(bodyStock);

        const rArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.32), sleeveMaterial);
        rArmComp.position.set(0.15, -0.23, -0.22);
        rArmComp.rotation.set(Math.PI / 3.4, 0, -Math.PI / 16);
        rArmComp.castShadow = true;
        activeGunModel.add(rArmComp);

        const rHandGrip = buildProceduralGripHand(false, 'pistol');
        rHandGrip.position.set(0.12, -0.20, -0.36);
        rHandGrip.rotation.set(0.2, 0, 0);
        activeGunModel.add(rHandGrip);

        const lArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.32), sleeveMaterial);
        lArmComp.position.set(-0.02, -0.21, -0.45);
        lArmComp.rotation.set(Math.PI / 3.3, Math.PI / 8, 0);
        lArmComp.castShadow = true;
        activeGunModel.add(lArmComp);

        const lHandGrip = buildProceduralGripHand(true, 'shotgun');
        lHandGrip.position.set(0.12, -0.13, -0.56);
        lHandGrip.rotation.set(0.1, -0.15, 0);
        activeGunModel.add(lHandGrip);

      } else if (weaponId === 'wonder_weapon') {
        // "The Headmaster's Judgment" (Experimental brass glowing alarm school-bell weapon!)
        const shinyGoldMat = new THREE.MeshStandardMaterial({
          color: 0xd9ab26,
          roughness: 0.15,
          metalness: 0.95
        });
        const glowingGreenMat = new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.8
        });

        const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.22, 16), shinyGoldMat);
        bellBody.rotation.x = Math.PI / 2;
        bellBody.position.set(0.12, -0.16, -0.58);
        bellBody.castShadow = true;
        activeGunModel.add(bellBody);

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.2, 8), woodMaterial);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0.12, -0.16, -0.38);
        handle.castShadow = true;
        activeGunModel.add(handle);

        const glassRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.01, 8, 16), glowingGreenMat);
        glassRing1.position.set(0.12, -0.16, -0.66);
        activeGunModel.add(glassRing1);

        const glassRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.01, 8, 16), glowingGreenMat);
        glassRing2.position.set(0.12, -0.16, -0.55);
        activeGunModel.add(glassRing2);

        // A small clapper inside the bell dome colored in radioactive green
        const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), glowingGreenMat);
        clapper.position.set(0.12, -0.16, -0.62);
        activeGunModel.add(clapper);

        // Dynamic point light within the bell to cast a green glow forward on classroom walls
        const bellLight = new THREE.PointLight(0x22c55e, 2.5, 3.5);
        bellLight.position.set(0.12, -0.16, -0.62);
        activeGunModel.add(bellLight);

        // Arms holding this heavy instrument of curse & instruction
        const rArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3), sleeveMaterial);
        rArmComp.position.set(0.15, -0.23, -0.2);
        rArmComp.rotation.set(Math.PI / 3.2, 0, -Math.PI / 16);
        rArmComp.castShadow = true;
        activeGunModel.add(rArmComp);

        const rHandGrip = buildProceduralGripHand(false, 'pistol');
        rHandGrip.position.set(0.12, -0.18, -0.34);
        rHandGrip.rotation.set(0.2, 0, 0);
        activeGunModel.add(rHandGrip);

        const lArmComp = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.3), sleeveMaterial);
        lArmComp.position.set(-0.02, -0.22, -0.4);
        lArmComp.rotation.set(Math.PI / 3, Math.PI / 6, 0);
        lArmComp.castShadow = true;
        activeGunModel.add(lArmComp);

        const lHandGrip = buildProceduralGripHand(true, 'shotgun');
        lHandGrip.position.set(0.10, -0.16, -0.46);
        lHandGrip.rotation.set(0.1, -0.1, 0);
        activeGunModel.add(lHandGrip);
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

      // --- FORBIDDEN TOME TICK ANIMATION PASS ---
      if (mysteryBoxRef.current.bookGroup) {
        const mBox = mysteryBoxRef.current;
        const bookGlow = mBox.bookGlowLight;
        
        if (mBox.state === 'idle') {
          // Slowly fold the book shut-close (progress goes back to 0)
          mBox.bookOpenProgress = Math.max(0.0, mBox.bookOpenProgress - d * 2.2);
          
          if (mBox.leftCover) {
            // Unfolded open is 0, folded shut is Math.PI
            mBox.leftCover.rotation.z = Math.PI * (1.0 - mBox.bookOpenProgress);
          }
          
          // Pages relax flat on the right cover
          mBox.flippingPages.forEach((page, idx) => {
            page.rotation.z = Math.max(0.0, page.rotation.z - d * 5.0);
          });
          
          // Slowly dim magical point light
          if (bookGlow) {
            bookGlow.intensity = Math.max(0.0, bookGlow.intensity - d * 5.0);
          }
          
          // Fade out any floating particles
          if (mBox.particlesGroup) {
            mBox.particlesGroup.children.forEach(pm => {
              const pMesh = pm as THREE.Mesh;
              if (pMesh.material) {
                (pMesh.material as any).opacity = Math.max(0.0, (pMesh.material as any).opacity - d * 3.5);
              }
            });
          }
          
          // Clear looping whisper timeout if active
          if (mBox.whisperingSoundActive) {
            mBox.whisperingSoundActive = false;
            if (mBox.whisperTimeout) {
              clearTimeout(mBox.whisperTimeout);
              mBox.whisperTimeout = null;
            }
          }

          if (mBox.weaponGlowGroup && mBox.weaponGlowGroup.children.length > 0) {
            while (mBox.weaponGlowGroup.children.length > 0) {
              mBox.weaponGlowGroup.remove(mBox.weaponGlowGroup.children[0]);
            }
          }
          // Reset the rise height so the next reveal animates from inside the book again
          if (mBox.weaponGlowGroup) mBox.weaponGlowGroup.position.y = 1.16;
        } else if (mBox.state === 'spinning') {
          // Open the book! Progress grows to 1
          mBox.bookOpenProgress = Math.min(1.0, mBox.bookOpenProgress + d * 2.4);
          
          if (mBox.leftCover) {
            mBox.leftCover.rotation.z = Math.PI * (1.0 - mBox.bookOpenProgress);
          }
          
          // Spooky whispering sounds and creak on initial open
          if (!mBox.whisperingSoundActive) {
            mBox.whisperingSoundActive = true;
            sound.playBookOpen();
            sound.playPageFlipQuick();
            
            const whisperLoop = () => {
              if (mBox.state === 'spinning' || mBox.state === 'ready') {
                sound.playBookWhisper();
                mBox.whisperTimeout = setTimeout(whisperLoop, 2800);
              } else {
                mBox.whisperingSoundActive = false;
              }
            };
            whisperLoop();
          }

          // Pages rapid-flip waving through themselves!
          mBox.pageFlipTicks += d * 18.0;
          mBox.flippingPages.forEach((page, idx) => {
            // Sinusoidal flutter offset wave for eerie page flipping
            page.rotation.z = (Math.PI / 2) + Math.sin(mBox.pageFlipTicks - idx * 2.1) * (Math.PI / 2.05);
          });

          // Emerald/Gold magical glow fades up from inside pages
          if (bookGlow) {
            bookGlow.color.setHex(0x10b981); // eerie vibrant green
            bookGlow.intensity = mBox.bookOpenProgress * (3.2 + Math.sin(time * 15) * 0.6);
          }

          // Emit drifting magical particles upwards
          if (mBox.particlesGroup) {
            mBox.particlesGroup.children.forEach(pm => {
              const pMesh = pm as THREE.Mesh;
              const pData = pMesh as any;
              
              pMesh.position.y += pData.vy * d;
              pMesh.position.x += Math.sin(time * 3.5 + pData.age) * d * 0.16 + pData.vx * d * 0.35;
              pMesh.position.z += Math.cos(time * 2.5 + pData.age) * d * 0.16 + pData.vz * d * 0.35;
              pMesh.rotation.y += pData.rotSpeed * d;
              pMesh.rotation.x += pData.rotSpeed * d * 0.5;
              
              if (pMesh.material) {
                (pMesh.material as any).opacity = Math.min(0.9, (pMesh.material as any).opacity + d * 4.0);
              }
              
              // Reset particle loop when too high
              if (pMesh.position.y > 1.85) {
                pMesh.position.set(
                  (Math.random() - 0.5) * 0.45,
                  0.1,
                  (Math.random() - 0.5) * 0.45
                );
                if (pMesh.material) (pMesh.material as any).opacity = 0.0;
              }
            });
          }

          mBox.spinTicks += d;
          if (mBox.spinTicks >= 0.08) {
            mBox.spinTicks = 0;
            mBox.spinIdx++;
            
            const list: Array<'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon'> = [
              'pistol', 'shotgun', 'smg', 'm16', 'magnum', 'sniper', 'wonder_weapon'
            ];
            const cycler = list[mBox.spinIdx % list.length];
            
            if (mBox.weaponGlowGroup) {
              while (mBox.weaponGlowGroup.children.length > 0) {
                mBox.weaponGlowGroup.remove(mBox.weaponGlowGroup.children[0]);
              }
              
              const wpnMesh = new THREE.Group();
              const neonMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
              
              if (cycler === 'pistol') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.03), neonMat);
                wpnMesh.add(body);
              } else if (cycler === 'shotgun') {
                const barrels = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8), neonMat);
                barrels.rotation.x = Math.PI / 2;
                wpnMesh.add(barrels);
              } else if (cycler === 'smg') {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), neonMat);
                wpnMesh.add(receiver);
              } else if (cycler === 'm16') {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.04), neonMat);
                wpnMesh.add(receiver);
              } else if (cycler === 'magnum') {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.05), neonMat);
                wpnMesh.add(receiver);
              } else if (cycler === 'sniper') {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.05), neonMat);
                wpnMesh.add(receiver);
              } else {
                const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.18, 12), neonMat);
                wpnMesh.add(bell);
              }
              
              mBox.weaponGlowGroup.add(wpnMesh);
            }
          }
          
          if (mBox.weaponGlowGroup) {
            mBox.weaponGlowGroup.rotation.y += d * 6;
            // Rise selected weapon out from the center pages of the book (atop the pedestal)
            mBox.weaponGlowGroup.position.y = Math.min(1.7, mBox.weaponGlowGroup.position.y + d * 0.35);
          }
        } else if (mBox.state === 'ready') {
          // Keep book open completely
          mBox.bookOpenProgress = Math.min(1.0, mBox.bookOpenProgress + d * 2.4);
          if (mBox.leftCover) {
            mBox.leftCover.rotation.z = Math.PI * (1.0 - mBox.bookOpenProgress);
          }

          // Pages settle nicely left vs right
          mBox.flippingPages.forEach((page, idx) => {
            const targetZ = idx === 0 ? 0.03 : (idx === 1 ? Math.PI / 2.0 : Math.PI - 0.03);
            page.rotation.z += (targetZ - page.rotation.z) * d * 4.5;
          });

          // Gold/Amber rewards point light heartbeat
          if (bookGlow) {
            bookGlow.color.setHex(0xeab308); // Gold reveal color
            bookGlow.intensity = 2.4 + Math.sin(time * 12) * 0.5;
          }

          // Gentle magical particle float upward
          if (mBox.particlesGroup) {
            mBox.particlesGroup.children.forEach(pm => {
              const pMesh = pm as THREE.Mesh;
              const pData = pMesh as any;
              
              pMesh.position.y += pData.vy * d * 0.5; // slower float
              pMesh.position.x += Math.sin(time * 1.5 + pData.age) * d * 0.08;
              pMesh.position.z += Math.cos(time * 1.2 + pData.age) * d * 0.08;
              pMesh.rotation.y += pData.rotSpeed * d * 0.25;
              
              if (pMesh.position.y > 1.85) {
                pMesh.position.set(
                  (Math.random() - 0.5) * 0.45,
                  0.1,
                  (Math.random() - 0.5) * 0.45
                );
              }
            });
          }
          
          if (mBox.weaponGlowGroup) {
            mBox.weaponGlowGroup.rotation.y += d * 1.6;
            mBox.weaponGlowGroup.position.y = 1.7 + Math.sin(time * 3.5) * 0.07;
          }
        }
      }

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

      // Automatic shoot trigger for SMG
      if (shootHeld && stateRef.current.activeWeaponId === 'smg' && stateRef.current.gameState === 'playing' && document.pointerLockElement === containerRef.current) {
        triggerShootWeapon();
      }

      // --- 1. DOOR OPEN ANIMATION: swing slabs, then sink the frame into the floor ---
      for (const door of hallwayDoors) {
        if (door.purchased) {
          // Hide purchase floating sign once purchased
          if (door.group.userData && door.group.userData.sign) {
            door.group.userData.sign.visible = false;
          }

          let swungOpen = true;
          if (door.group.userData && door.group.userData.isDouble) {
            const targetRotL = Math.PI * 0.65;
            const targetRotR = -Math.PI * 0.65;
            const lSlab = door.group.userData.slabGroupL;
            const rSlab = door.group.userData.slabGroupR;

            if (lSlab && lSlab.rotation.y < targetRotL) {
              lSlab.rotation.y = Math.min(targetRotL, lSlab.rotation.y + d * 3.5);
              swungOpen = false;
            }
            if (rSlab && rSlab.rotation.y > targetRotR) {
              rSlab.rotation.y = Math.max(targetRotR, rSlab.rotation.y - d * 3.5);
              swungOpen = false;
            }
          } else if (door.group.userData && door.group.userData.panelGroup) {
            const targetRot = Math.PI * 0.65;
            const pSlab = door.group.userData.panelGroup;
            if (pSlab.rotation.y < targetRot) {
              pSlab.rotation.y = Math.min(targetRot, pSlab.rotation.y + d * 3.5);
              swungOpen = false;
            }
          }

          // After swinging fully open, sink the entire door frame down into the floor so
          // the doorway is left completely clear. sinkOffset (set to 0.01 on purchase)
          // grows toward the door height, dropping the group below floor level.
          if (swungOpen && door.sinkOffset > 0) {
            const sinkTarget = door.height + 0.3;
            door.sinkOffset = Math.min(sinkTarget, door.sinkOffset + d * 1.8);
            door.group.position.y = door.position[1] - door.sinkOffset;
            if (door.sinkOffset >= sinkTarget) {
              door.group.visible = false; // fully sunk: remove from view
            }
          }
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
      // Walls (including locked doors) are resolved by the unified segment collider, which
      // funnels the player through real door openings instead of brittle invisible-wall zones.
      resolveWallCollisions(camera.position, 0.45);

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
          // Determine active ground spawners based on door purchase progress
          const allowedSpawnerIndices = [0, 1, 2, 3, 4, 5]; // Classroom spawners
          if (classroomExitDoor.purchased) {
            allowedSpawnerIndices.push(6, 7); // Near hallway spawners
            if (doorHallwayNorth.purchased) {
              allowedSpawnerIndices.push(8, 9); // North spawners
            }
            if (doorHallwaySouth.purchased) {
              allowedSpawnerIndices.push(10, 11); // South spawners
            }
          }
          const randomIdx = Math.floor(Math.random() * allowedSpawnerIndices.length);
          const spawnerIdx = allowedSpawnerIndices[randomIdx];
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

          // Distance to the actual target (used for attack range / proximity checks)
          const toTargetFlat = new THREE.Vector3().subVectors(targetPos, z.mesh.position);
          toTargetFlat.y = 0;
          const distanceXY = toTargetFlat.length();

          // Steering goal: route through open doorways when the target is in another room
          const steerPoint = computeSteerPoint(z.mesh.position, targetPos);
          const dirToTarget = new THREE.Vector3().subVectors(steerPoint, z.mesh.position);
          dirToTarget.y = 0; // lock vector on floor plane
          dirToTarget.normalize();

          // Smooth rotation looking at where it is walking
          z.mesh.lookAt(new THREE.Vector3(steerPoint.x, 0.0, steerPoint.z));

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
                
                const targetCenter = attackTargetBot ? (closestBot as BotTeammate).mesh.position.clone() : camera.position.clone();
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

          // Walls & locked doors block zombies via the shared segment collider, so they
          // can only cross between rooms through opened doorways.
          resolveWallCollisions(z.mesh.position, 0.4);

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
              // Idle follow player to regroup, routing through open doorways
              const dToPlayer = tm.mesh.position.distanceTo(camera.position);
              if (dToPlayer > 5.5) {
                const botSteer = computeSteerPoint(tm.mesh.position, camera.position);
                const approachDir = new THREE.Vector3().subVectors(botSteer, tm.mesh.position);
                approachDir.y = 0;
                approachDir.normalize();
                tm.mesh.position.addScaledVector(approachDir, 2.3 * d);
                tm.mesh.lookAt(new THREE.Vector3(botSteer.x, tm.mesh.position.y, botSteer.z));

                const wSway = Math.sin(time * 5.5);
                tm.mesh.children[3].rotation.x = wSway * 0.22;
                tm.mesh.children[4].rotation.x = -wSway * 0.22 - Math.PI/4;
              }
            }
          }

          // Walls & locked doors block AI bots via the shared segment collider.
          resolveWallCollisions(tm.mesh.position, 0.4);

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
        } else if (camera.position.distanceTo(new THREE.Vector3(...smgWallBuy.position)) <= 2.45) {
          if (weaponsOwnedRef.current.includes('smg')) {
            const ammo = weaponAmmoRef.current.smg;
            if (ammo.reserve < ammo.maxReserve) {
              matchLabel = `REFILL SMG AMMO [E]\nPRICE: $500`;
            } else {
              matchLabel = `SMG AMMO FULL_`;
            }
          } else {
            matchLabel = `BUY MP5 SMG [E]\nPRICE: $1000`;
          }
        } else if (camera.position.distanceTo(new THREE.Vector3(...perkMachineRef.current.position)) <= 2.8) {
          if (!hasFastHandsRef.current) {
            matchLabel = `BUY FAST HANDS PERK [E]\nPRICE: $2000`;
          } else {
            matchLabel = `FAST HANDS PERK OWNED_`;
          }
        } else if (camera.position.distanceTo(new THREE.Vector3(...mysteryBoxRef.current.position)) <= 2.85) {
          const mBox = mysteryBoxRef.current;
          if (mBox.state === 'idle') {
            matchLabel = `OPEN THE FORBIDDEN TOME [E]\nPRICE: $950`;
          } else if (mBox.state === 'spinning') {
            matchLabel = `THE FORBIDDEN TOME STIRS_`;
          } else if (mBox.state === 'ready') {
            const names: Record<string, string> = {
              pistol: 'M1911 Pistol',
              shotgun: 'Double-Barrel Shotgun',
              smg: 'MP5 SMG',
              m16: 'M16 Combat Rifle',
              magnum: '.357 Magnum',
              sniper: 'M40 Bolt-Action Sniper',
              wonder_weapon: "The Headmaster's Judgment"
            };
            const wpnName = names[mBox.weaponId] || mBox.weaponId.toUpperCase();
            matchLabel = `TAKE ${wpnName} [E]`;
          }
        } else {
          for (const door of hallwayDoors) {
            const checkDoorDist = camera.position.distanceTo(new THREE.Vector3(...door.position));
            if (checkDoorDist <= 3.2 && !door.purchased) {
              const label = door.id === 'door-classroom-exit' ? 'CLASSROOM EXIT' : (door.id === 'door-hallway-north' ? 'NORTH CLASSROOM' : 'SOUTH CLASSROOM');
              matchLabel = `OPEN ${label} [E]\nPRICE: $${door.price}\n`;
              break;
            }
          }
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
      
      // Clear mystery box background timers
      if (mysteryBoxRef.current.activeSpinTimer) clearTimeout(mysteryBoxRef.current.activeSpinTimer);
      if (mysteryBoxRef.current.readyTimeoutTimer) clearTimeout(mysteryBoxRef.current.readyTimeoutTimer);

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
