import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Shield, Settings, Play, RefreshCw, Eye, MousePointer, Users } from 'lucide-react';
import { sound } from '../sound';
import { TeammateState } from '../types';

interface HUDProps {
  health: number;
  maxHealth: number;
  points: number;
  kills: number;
  currentRound: number;
  activeWeaponId: 'pistol' | 'shotgun' | 'smg';
  ammoClip: number;
  ammoReserve: number;
  isADS: boolean;
  isReloading: boolean;
  hitmarker: 'hit' | 'kill' | null;
  interactMessage: string | null;
  gameState: 'menu' | 'playing' | 'gameover' | 'paused' | 'loading';
  setGameState: React.Dispatch<React.SetStateAction<'menu' | 'playing' | 'gameover' | 'paused' | 'loading'>>;
  onStartGame: () => void;
  onRestartGame: () => void;
  scorePopups: Array<{ id: string; amount: number; text: string }>;
  showWaveBanner: boolean;
  hasFastHands: boolean;

  // Co-op & Revive props
  isCoop: boolean;
  setIsCoop: (val: boolean) => void;
  teammates: TeammateState[];
  playerReviveProgress: number;
  teammateReviveProgress: number;
  revivingName: string | null;

  // Real multiplayer properties & actions
  socket: WebSocket | null;
  roomId: string;
  roomState: any;
  clientId: string;
  playerName: string;
  setPlayerName: (val: string) => void;
  playerColor: number;
  setPlayerColor: (val: number) => void;
  connectAndJoinLobby: (targetRoomId: string) => void;
  hostNewLobby: () => void;
  sendChatMessage: (text: string) => void;
  triggerStartMatch: () => void;
  chatLog: Array<{ sender: string, text: string, timestamp: number }>;
}

export const HUD: React.FC<HUDProps> = ({
  health,
  maxHealth,
  points,
  kills,
  currentRound,
  activeWeaponId,
  ammoClip,
  ammoReserve,
  isADS,
  isReloading,
  hitmarker,
  interactMessage,
  gameState,
  setGameState,
  onStartGame,
  onRestartGame,
  scorePopups,
  showWaveBanner,
  hasFastHands,
  
  // Co-op fields destructuring
  isCoop,
  setIsCoop,
  teammates,
  playerReviveProgress,
  teammateReviveProgress,
  revivingName,

  // Real multiplayer properties & actions
  socket,
  roomId,
  roomState,
  clientId,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  connectAndJoinLobby,
  hostNewLobby,
  sendChatMessage,
  triggerStartMatch,
  chatLog
}) => {

  const [showSettings, setShowSettings] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'multiplayer'>('main');
  const [pauseMenuSubView, setPauseMenuSubView] = useState<'main' | 'settings' | 'controls'>('main');

  useEffect(() => {
    if (gameState === 'paused') {
      setPauseMenuSubView('main');
    }
  }, [gameState]);
  const [activeTab, setActiveTab] = useState<'audio' | 'controls' | 'graphics' | 'gameplay'>('audio');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // FPS tracking state
  const [fps, setFps] = useState(60);
  const [showFps, setShowFps] = useState(true);

  // Tactical Outbreak tips
  const survivalTips = [
    "AIM DOWN SIGHTS [R-CLICK] TO TIGHTEN THE SHOTGUN PELLET INWARD CONE FLUX.",
    "WHEN A TEAMMATE IS DOWNED, RUN NEXT TO THEM AND HOLD [E] TO REVIVE THEM IN TIME!",
    "ZOMBIES SPAWN MUCH FASTER AS ROUNDS PROGRESS. REFILL AMMO AT THE SHOTGUN AREA.",
    "ALL TEAMMATE BOTS WILL AUTOMATICALLY ACCUMULATE POINTS AND BUY DOUBLE BARREL SHOTGUNS!",
    "AFTER DETECTING NO MELEE STRIKES FOR 4.5 SECONDS, HEALTH REGENERATES RAPIDLY TO 100 HP.",
    "HEADSHOTS DAMAGE MULTIPLIES X2 AND GRANTS BONUS SCORE PER KILLED FOE."
  ];
  const [currentTip, setCurrentTip] = useState(survivalTips[0]);

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animId: number;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (gameState === 'loading') {
      const idx = Math.floor(Math.random() * survivalTips.length);
      setCurrentTip(survivalTips[idx]);
    }
  }, [gameState]);

  // Load and apply direct settings states
  const [masterVol, setMasterVol] = useState(50); // Set default slightly lower as requested
  const [sfxVol, setSFXVol] = useState(60);
  const [musicVol, setMusicVol] = useState(35);
  const [sensitivity, setSensitivity] = useState(35);
  const [zoomSensitivity, setZoomSensitivity] = useState(75);
  const [lookSmoothing, setLookSmoothing] = useState(30);
  const [fov, setFov] = useState(75);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [crtEffect, setCrtEffect] = useState(true);
  const [vignetteOpacity, setVignetteOpacity] = useState(45);
  const [crosshairColor, setCrosshairColor] = useState('#22c55e'); // Green-500
  const [showDmgNumbers, setShowDmgNumbers] = useState(true);
  const [bloodScreen, setBloodScreen] = useState(true);
  const [weaponSway, setWeaponSway] = useState(100);

  useEffect(() => {
    // Attempt to load settings from storage
    const saved = localStorage.getItem('codz_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.audio) {
          setMasterVol(parsed.audio.master ?? 50);
          setSFXVol(parsed.audio.sfx ?? 60);
          setMusicVol(parsed.audio.music ?? 35);
          sound.setMasterVolume((parsed.audio.master ?? 50) / 100);
          sound.setSFXVolume((parsed.audio.sfx ?? 60) / 100);
          sound.setMusicVolume((parsed.audio.music ?? 35) / 100);
        } else {
          sound.setMasterVolume(0.5);
          sound.setSFXVolume(0.6);
          sound.setMusicVolume(0.35);
        }
        if (parsed.controls) {
          setSensitivity(parsed.controls.sensitivity ?? 35);
          setZoomSensitivity(parsed.controls.zoomSensitivity ?? 75);
          setLookSmoothing(parsed.controls.lookSmoothing ?? 30);
        }
        if (parsed.graphics) {
          setFov(parsed.graphics.fov ?? 75);
          setGraphicsQuality(parsed.graphics.quality ?? 'high');
          setCrtEffect(parsed.graphics.crtEffect ?? true);
          setVignetteOpacity(parsed.graphics.vignetteOpacity ?? 45);
        }
        if (parsed.gameplay) {
          setCrosshairColor(parsed.gameplay.crosshairColor ?? '#22c55e');
          setShowDmgNumbers(parsed.gameplay.damageNumbers ?? true);
          setBloodScreen(parsed.gameplay.bloodScreen ?? true);
          setWeaponSway(parsed.gameplay.weaponSway ?? 100);
        }
      } catch (e) {
        console.warn('Could not parse saved settings');
      }
    } else {
      // Set initial sound volumes to sync with local state
      sound.setMasterVolume(0.5);
      sound.setSFXVolume(0.6);
      sound.setMusicVolume(0.35);
    }
  }, []);

  const saveSettingPiece = (section: string, key: string, value: any) => {
    const fresh = localStorage.getItem('codz_settings');
    let data: any = {};
    if (fresh) {
      try { data = JSON.parse(fresh); } catch (e) {}
    }
    if (!data[section]) data[section] = {};
    data[section][key] = value;
    localStorage.setItem('codz_settings', JSON.stringify(data));
    
    // Dispatch custom event to notify 3D engine elements in real-time
    window.dispatchEvent(new CustomEvent('settings-update', { detail: data }));
  };

  const handleMasterVolChange = (val: number) => {
    setMasterVol(val);
    sound.setMasterVolume(val / 100);
    saveSettingPiece('audio', 'master', val);
  };

  const handleSFXVolChange = (val: number) => {
    setSFXVol(val);
    sound.setSFXVolume(val / 100);
    saveSettingPiece('audio', 'sfx', val);
  };

  const handleMusicVolChange = (val: number) => {
    setMusicVol(val);
    sound.setMusicVolume(val / 100);
    saveSettingPiece('audio', 'music', val);
  };

  const handleSensChange = (val: number) => {
    setSensitivity(val);
    saveSettingPiece('controls', 'sensitivity', val);
  };

  const handleZoomSensChange = (val: number) => {
    setZoomSensitivity(val);
    saveSettingPiece('controls', 'zoomSensitivity', val);
  };

  const handleLookSmoothingChange = (val: number) => {
    setLookSmoothing(val);
    saveSettingPiece('controls', 'lookSmoothing', val);
  };

  const handleFovChange = (val: number) => {
    setFov(val);
    saveSettingPiece('graphics', 'fov', val);
  };

  const handleGraphicsQualityChange = (val: 'low' | 'medium' | 'high') => {
    setGraphicsQuality(val);
    saveSettingPiece('graphics', 'quality', val);
  };

  const handleCrtEffectChange = (val: boolean) => {
    setCrtEffect(val);
    saveSettingPiece('graphics', 'crtEffect', val);
  };

  const handleVignetteOpacityChange = (val: number) => {
    setVignetteOpacity(val);
    saveSettingPiece('graphics', 'vignetteOpacity', val);
  };

  const handleCrosshairColorChange = (val: string) => {
    setCrosshairColor(val);
    saveSettingPiece('gameplay', 'crosshairColor', val);
  };

  const handleDmgNumbersChange = (val: boolean) => {
    setShowDmgNumbers(val);
    saveSettingPiece('gameplay', 'damageNumbers', val);
  };

  const handleBloodScreenChange = (val: boolean) => {
    setBloodScreen(val);
    saveSettingPiece('gameplay', 'bloodScreen', val);
  };

  const handleWeaponSwayChange = (val: number) => {
    setWeaponSway(val);
    saveSettingPiece('gameplay', 'weaponSway', val);
  };

  const [damageFlash, setDamageFlash] = useState(0);
  const prevHealthRef = useRef(health);

  useEffect(() => {
    if (health < prevHealthRef.current) {
      setDamageFlash(0.65);
    }
    prevHealthRef.current = health;
  }, [health]);

  useEffect(() => {
    if (damageFlash > 0) {
      const timer = setTimeout(() => {
        setDamageFlash(prev => Math.max(0, prev - 0.05));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [damageFlash]);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLowHealth = healthPercent <= 35;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-sans z-50">
      
      {/* 1. ATMOSPHERE VIGNETTE OVERLAYS & BLOOD FLASHES */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black opacity-45 z-0" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(0,0,0,0.85)_100%)] z-0" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.7)] border-[25px] md:border-[35px] border-transparent z-40" />

      {gameState === 'playing' && damageFlash > 0 && (
        <div 
          className="absolute inset-0 pointer-events-none z-40 bg-red-600/35 transition-opacity duration-75"
          style={{ opacity: damageFlash }}
        />
      )}

      {gameState === 'playing' && isLowHealth && (
        <div 
          className="absolute inset-0 bg-radial-[circle,transparent_40%,rgba(185,28,28,0.7)_100%] animate-pulse z-40 transition-opacity duration-300 pointer-events-none"
          style={{ opacity: (1 - (healthPercent / 100)) * 0.9 }}
        />
      )}
      
      {/* 2. MAIN MENU */}
      {gameState === 'menu' && (
        <>
          {menuView === 'main' ? (
            <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center pointer-events-auto z-50 text-center px-4 overflow-hidden select-none">
              {/* Scanline CRT overlay filter */}
              {crtEffect && (
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(18,24,38,0.22)_0%,rgba(0,0,0,0.85)_100%)] z-10 before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] before:bg-[length:100%_4px]" />
              )}
              {/* Walls & Perspective Simulated Background */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#18181a] to-[#050505] opacity-95 z-0"></div>
              <div className="absolute bottom-0 w-full h-[40%] bg-[#0a0a0a] opacity-30 z-0" style={{ backgroundImage: "radial-gradient(#222 1px, transparent 1px)", backgroundSize: "50px 50px" }}></div>
              
              {/* Chalkboard Styled Main Board */}
              <div className="relative z-10 w-full max-w-2xl bg-[#1c2e1f]/95 border-[12px] border-[#311f11] rounded-sm shadow-2xl p-6 md:p-8 flex items-center justify-center mb-8">
                <div className="absolute top-4 left-6 text-[#ffffff22] text-xs font-mono italic">Ms. Miller's Class - Oct 12</div>
                <div className="absolute bottom-4 right-6 text-[#ffffff15] text-4xl rotate-[-5deg] pointer-events-none italic font-serif">HELP US</div>
                
                <div className="text-center py-4">
                  <span className="text-[11px] tracking-[0.55em] text-[#22c55e] font-bold uppercase mb-2 block drop-shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse">SURVIVE THE DETENTION</span>
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-[#e0e0e0] uppercase border-b-4 border-red-750 pb-3 font-serif">
                    DEAD <span className="text-red-650 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]">BELL</span>
                  </h1>
                  <p className="text-xs font-mono text-neutral-400 tracking-wider mt-2.5 uppercase">CLASSROOM OUTBREAK SURVIVAL</p>
                </div>
              </div>

              {/* Main CTA */}
              <div className="relative z-10 flex flex-col gap-3 w-full max-w-sm mb-12">
                <button 
                  id="btn-play-solo"
                  onClick={() => {
                    sound.init(); 
                    setIsCoop(false);
                    onStartGame();
                  }}
                  className="flex items-center justify-center gap-3 bg-red-700 hover:bg-neutral-800 hover:text-white text-white font-bold text-base px-6 py-3.5 rounded-sm border-b-4 border-red-900 transition-all cursor-pointer shadow-lg w-full uppercase tracking-wider font-extrabold"
                >
                  <Play className="fill-white" size={18} /> SOLO SURVIVAL
                </button>

                <button 
                  id="btn-open-multiplayer"
                  onClick={() => {
                    sound.init();
                    setIsCoop(true);
                    setMenuView('multiplayer');
                  }}
                  className="flex items-center justify-center gap-3 bg-emerald-750 hover:bg-[#10b981] hover:text-black hover:border-emerald-600 text-white font-bold text-base px-6 py-3.5 rounded-sm border-b-4 border-emerald-900 transition-all cursor-pointer shadow-lg w-full uppercase tracking-wider font-extrabold animate-[pulse_2s_infinite]"
                >
                  <Users size={18} /> CO-OP SURVIVAL LOBBY
                </button>

                <button 
                  id="btn-open-settings"
                  onClick={() => {
                    sound.init();
                    setShowSettings(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-[#141416]/90 hover:bg-neutral-800 text-[#e0e0e0] font-bold text-sm px-6 py-3 rounded-sm border border-neutral-850 hover:border-neutral-750 transition-all cursor-pointer w-full uppercase tracking-wider font-bold shadow-md"
                >
                  <Settings size={18} /> SURVIVAL SETTINGS
                </button>
              </div>

              {/* Instruction Footer Card */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-black/80 border border-neutral-850 rounded backdrop-blur-md max-w-xl text-left w-full">
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Movement</span>
                  <span className="text-xs font-semibold text-neutral-300 font-mono">WASD / SPACE</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Gunplay & ADS</span>
                  <span className="text-xs font-semibold text-neutral-300 font-mono">L-CLICK / R-CLICK</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Interact / Buy</span>
                  <span className="text-xs font-semibold text-neutral-300 font-mono">E KEY</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Reload / Swap</span>
                  <span className="text-xs font-semibold text-neutral-300 font-mono">R KEY / 1, 2 KEYS</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-[#060608] flex flex-col pointer-events-auto z-50 overflow-y-auto select-none font-sans">
              <style>{`
                @keyframes flicker {
                  0%, 100% { opacity: 0.15; }
                  3% { opacity: 0.35; }
                  6% { opacity: 0.12; }
                  7% { opacity: 0.55; }
                  9% { opacity: 0.15; }
                  45% { opacity: 0.20; }
                  46% { opacity: 0.05; }
                  47% { opacity: 0.40; }
                  48% { opacity: 0.15; }
                  70% { opacity: 0.18; }
                  71% { opacity: 0.65; }
                  72% { opacity: 0.22; }
                  73% { opacity: 0.15; }
                }
                @keyframes sway {
                  0%, 100% { transform: scale(1.02) translate(0px, 0px) rotate(0deg); }
                  50% { transform: scale(1.05) translate(8px, -4px) rotate(0.4deg); }
                }
                @keyframes fog-drift {
                  0% { transform: translate(-10%, 5%); }
                  50% { transform: translate(10%, -5%); }
                  100% { transform: translate(-10%, 5%); }
                }
                @keyframes zombie-shadow {
                  0%, 100% { opacity: 0; transform: scale(1) translate(-50px, 20px); filter: blur(15px); }
                  35% { opacity: 0.02; filter: blur(12px); }
                  45% { opacity: 0.07; transform: scale(1.05) translate(20px, -5px); filter: blur(8px); }
                  55% { opacity: 0.03; filter: blur(10px); }
                  75% { opacity: 0; transform: scale(1) translate(60px, 10px); filter: blur(15px); }
                }
                .menu-bg-sway {
                  animation: sway 18s ease-in-out infinite;
                }
                .fog-overlay-1 {
                  animation: fog-drift 28s ease-in-out infinite;
                }
                .fog-overlay-2 {
                  animation: fog-drift 35s ease-in-out infinite alternate;
                }
                .zombie-overlay-silhouette {
                  animation: zombie-shadow 25s ease-in-out infinite;
                }
              `}</style>

              {/* Atmospheric Background & Moving Environment */}
              <div className="absolute inset-0 z-0 overflow-hidden menu-bg-sway select-none pointer-events-none">
                {/* School background with vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020302] via-[#090d0b] to-[#040504] opacity-100" />
                
                {/* 3D-like floor tile lines */}
                <div 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[160%] h-[55%] opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(0deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '120px 40px',
                    transform: 'perspective(500px) rotateX(60deg) translateY(40px)',
                    transformOrigin: 'bottom center'
                  }}
                />

                {/* Left wall locker shapes */}
                <div className="absolute top-[20%] left-4 w-12 h-[60%] border-r border-neutral-900 bg-neutral-950/20 opacity-20" />
                {/* Right wall locker shapes */}
                <div className="absolute top-[20%] right-4 w-12 h-[60%] border-l border-neutral-900 bg-neutral-950/20 opacity-20" />

                {/* Chalk board silhouette */}
                <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-4xl h-52 border-[6px] border-[#22160d] bg-[#14231b]/30 opacity-30 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)]" />

                {/* Splatters of dark horror decal */}
                <div className="absolute top-[22%] left-[12%] w-56 h-56 bg-red-950/15 rounded-full filter blur-2xl mix-blend-color-burn" />
                <div className="absolute bottom-[28%] right-[18%] w-72 h-72 bg-red-950/10 rounded-full filter blur-2xl mix-blend-color-burn" />

                {/* Zombie silhouette */}
                <div 
                  className="absolute left-[20%] bottom-[25%] w-36 h-72 bg-contain bg-no-repeat opacity-0 zombie-overlay-silhouette mix-blend-multiply pointer-events-none grayscale brightness-0 select-none" 
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 200' fill='%23000000'%3E%3Cpath d='M50,20 C42,20 38,25 38,32 C38,40 43,44 50,44 C57,44 62,40 62,32 C62,25 58,20 50,20 Z M35,46 C25,48 20,55 18,65 C16,75 5,80 8,92 C10,100 25,95 24,85 C23,78 30,62 38,58 L38,120 L32,185 C31,192 40,195 42,185 L48,130 L52,130 L58,185 C60,195 69,192 68,185 L62,120 L62,58 C70,62 77,78 76,85 C75,95 90,100 92,92 C95,80 84,75 82,65 C80,55 75,48 65,46 L35,46 Z'/%3E%3C/svg%3E")`,
                    transformOrigin: 'bottom center'
                  }} 
                />

                {/* Volumetric Fog Layers */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#000000_95%)] z-10" />
                
                <div className="absolute -inset-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.012)_0%,transparent_50%)] fog-overlay-1 mix-blend-screen pointer-events-none" />
                <div className="absolute -inset-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(220,38,38,0.025)_0%,transparent_50%)] fog-overlay-2 mix-blend-screen pointer-events-none" />

                {/* Flickering light effect overlay */}
                <div className="absolute inset-0 bg-[#ffd6e8]/[0.015] mix-blend-overlay pointer-events-none z-20 animate-[flicker_6s_infinite]" />
                <div className="absolute inset-0 bg-black/45 z-10 pointer-events-none" />
              </div>

              {/* Scanline CRT overlay filter */}
              {crtEffect && (
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(18,24,38,0.18)_0%,rgba(0,0,0,0.85)_100%)] z-40 before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.22)_50%)] before:bg-[length:100%_4px]" />
              )}

              {/* Main Column Dashboard Container */}
              <main className="relative z-30 flex-1 w-full max-w-sm md:max-w-md mx-auto px-4 py-4 md:py-6 flex flex-col justify-center items-center text-center gap-3">
                
                {/* 1. Header logo section */}
                <div className="mt-2 mb-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-2.5 drop-shadow-[0_0_20px_rgba(220,38,38,0.85)] select-none">
                    {/* Ominous tactical target crosshair */}
                    <div className="w-9 h-9 flex items-center justify-center border-4 border-red-650 rounded-full p-1 shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse">
                      <svg className="w-full h-full text-red-650" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="8" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <line x1="1" y1="12" x2="23" y2="12" />
                      </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black font-sans tracking-tighter text-white uppercase drop-shadow-lg leading-none">
                      Classroom <span className="text-red-650">Outbreak</span>
                    </h1>
                  </div>
                  
                  <p className="text-[10px] uppercase font-typewriter tracking-[0.25em] text-neutral-400 mt-1.5 font-bold leading-none">
                    WAVE SURVIVAL — DEFEND THE SCHOOL
                  </p>
                </div>

                {/* 2. Character Name input configuration row */}
                <div className="w-full max-w-sm flex items-center gap-2 bg-neutral-950/65 border border-neutral-900 rounded p-1.5 shadow-xl backdrop-blur-md">
                  <input 
                    type="text"
                    maxLength={14}
                    value={playerName}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_\s-]/g, '').toUpperCase();
                      setPlayerName(val);
                    }}
                    className="flex-1 bg-black/80 border border-neutral-850 hover:border-neutral-750 focus:border-red-600 outline-none text-neutral-100 font-mono text-center text-xs tracking-wider uppercase py-1.5 px-3 rounded transition-all"
                    placeholder="PLAYER_NAME"
                  />
                  <button
                    onClick={() => {
                      sound.playClick();
                    }}
                    className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-sans text-xs font-bold px-3 py-1.5 rounded transition-all uppercase tracking-wider cursor-pointer transform active:scale-95"
                  >
                    Set Name
                  </button>
                </div>

                {/* 3. Online Co-op Title Block */}
                <div className="flex items-center gap-1.5">
                  <span className="text-lg filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse">🌐</span>
                  <h2 className="text-base font-bold font-sans uppercase text-neutral-200 tracking-wider">
                    Online Co-op (4P)
                  </h2>
                </div>

                {/* 4. Main Config Container block */}
                <div className="w-full max-w-sm bg-neutral-950/85 border-2 border-neutral-900/90 rounded-sm p-3.5 flex flex-col gap-3.5 shadow-2xl backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-650 via-rose-550 to-red-650/40 opacity-70" />

                  {/* ROOM WARNING/ERROR CODES */}
                  {roomError && (
                    <div className="text-[10px] font-mono font-bold text-red-500 uppercase bg-red-950/30 border border-red-900/50 p-1.5 rounded text-center animate-[pulse_1.5s_infinite] leading-tight">
                      ⚠️ CONNECTION ALARM: {roomError}
                    </div>
                  )}

                  {/* HOST A GAME SECTION */}
                  <div className="text-left flex flex-col gap-1.5 border-b border-neutral-900 pb-3">
                    <span className="text-[10px] font-bold text-neutral-500 font-mono tracking-wider uppercase block leading-none">
                      HOST A GAME
                    </span>
                    <button
                      onClick={() => {
                        sound.playClick();
                        setRoomError(null);
                        hostNewLobby();
                      }}
                      onMouseEnter={() => sound.playHover()}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#be123c] hover:bg-[#e11d48] text-white font-sans font-black text-xs px-4 py-2.5 rounded border-b-4 border-rose-950 hover:border-red-950 transition-all cursor-pointer transform duration-100 active:translate-y-0.5 active:border-b-0 uppercase tracking-widest shadow-lg shadow-rose-950/15"
                    >
                      ▶ Create Room — Get Code
                    </button>

                    {/* Room Code Card Sub-Container with Copy functionality */}
                    <div className="mt-1.5 bg-emerald-950/15 border border-emerald-900/60 p-2.5 rounded text-center flex flex-col relative shadow-[inset_0_0_8px_rgba(16,185,129,0.06)] gap-1">
                      <div className="text-[9px] text-[#10b981] font-mono tracking-widest uppercase font-bold flex items-center justify-center gap-1">
                        ROOM CODE (CLICK TO COPY)
                      </div>
                      <div 
                        onClick={() => {
                          if (roomId) {
                            navigator.clipboard.writeText(roomId);
                            setCopied(true);
                            sound.playClick();
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className="text-xl md:text-2xl font-black font-mono text-[#10b981] tracking-[0.45em] uppercase py-1 select-all drop-shadow-[0_0_8px_rgba(16,185,129,0.65)] cursor-pointer hover:text-emerald-300 transition-all active:scale-95 block"
                        title="Click to copy Room Code"
                      >
                        {roomId ? roomId.split('').join(' ') : '— — — —'}
                      </div>
                      <div className="text-[8px] text-emerald-500 font-mono uppercase tracking-wider leading-none font-bold">
                        {copied ? '✓ COPIED CODE TO CLIPBOARD!' : roomId 
                          ? `${Object.keys(roomState?.players || {}).length > 1 ? 'SQUAD INFILTRATING' : 'Waiting for player 2...'}` 
                          : 'Awaiting lobby generation...'}
                      </div>
                    </div>
                  </div>

                  {/* JOIN A GAME SECTION */}
                  <div className="text-left flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-neutral-500 font-mono tracking-wider uppercase block leading-none">
                      JOIN A GAME
                    </span>
                    <div className="flex gap-1.5 items-stretch">
                      <input 
                        type="text"
                        id="lobby-code-input"
                        maxLength={12}
                        placeholder="ROOM CODE"
                        className="flex-1 min-w-0 bg-black/75 border border-neutral-850 hover:border-neutral-750 focus:border-red-600 outline-none text-neutral-200 font-mono text-xs px-2 py-2 rounded uppercase tracking-[0.25em] text-center transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (document.getElementById('lobby-code-input') as HTMLInputElement)?.value?.trim()?.toUpperCase();
                            if (val) {
                              setRoomError(null);
                              connectAndJoinLobby(val);
                            } else {
                              setRoomError("PLEASE SECURE VALID ROOM SEED CODE");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          sound.playClick();
                          try {
                            const text = await navigator.clipboard.readText();
                            const cleaned = text.trim().toUpperCase().replace(/\s+/g, '');
                            const inputElem = document.getElementById('lobby-code-input') as HTMLInputElement;
                            if (inputElem) {
                              inputElem.value = cleaned;
                            }
                          } catch (err) {
                            setRoomError("MANUALLY PRESS CTRL+V TO PASTE");
                          }
                        }}
                        className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 px-2.5 flex items-center justify-center text-[10px] font-bold text-neutral-400 select-none hover:text-white rounded cursor-pointer transition-all active:scale-95 whitespace-nowrap uppercase font-mono"
                        title="Paste room code from clipboard"
                      >
                        📋 Paste
                      </button>
                      <button
                        onClick={() => {
                          sound.playClick();
                          const val = (document.getElementById('lobby-code-input') as HTMLInputElement)?.value?.trim()?.toUpperCase();
                          if (val) {
                            setRoomError(null);
                            connectAndJoinLobby(val);
                          } else {
                            setRoomError("PLEASE SECURE VALID ROOM SEED CODE");
                          }
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="bg-[#be123c] hover:bg-[#e11d48] text-white font-sans font-bold text-xs px-4 rounded cursor-pointer uppercase tracking-wider transition-all shadow-md transform active:scale-95 flex items-center justify-center font-extrabold whitespace-nowrap"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. 1/4 Players status meter */}
                <div className="text-center mt-1">
                  <div className="text-cyan-400 font-mono font-bold text-[11px] uppercase tracking-[0.2em] drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                    {roomId ? `${Object.keys(roomState?.players || {}).length}/4 Players` : '1/4 Players'}
                  </div>
                </div>

                {/* 6. Squad statuses list */}
                <div className="w-full max-w-sm flex flex-col gap-1 font-mono text-xs max-h-[110px] overflow-y-auto">
                  {roomId ? (
                    roomState && roomState.players && Object.values(roomState.players).map((p: any) => {
                      const isLocal = p.id === clientId;
                      const isHost = roomState.hostId === p.id;
                      return (
                        <div 
                          key={p.id}
                          className="flex items-center justify-between py-1.5 px-3 bg-black/45 border border-neutral-900 rounded-sm shadow"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-3 rounded-sm border border-white/10" style={{ backgroundColor: `#${(p.color ?? 0xf97316).toString(16).padStart(6, '0')}` }} />
                            <span className="text-neutral-200 font-bold uppercase tracking-wider text-[11px]">
                              {p.name.toUpperCase()} {isLocal ? '(YOU)' : ''}
                            </span>
                          </div>
                          <span className="text-[9px] text-[#10b981] font-bold uppercase tracking-widest leading-none">
                            {isHost ? 'WAITING [HOST]' : 'CONNECTED'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    // Default / Offline simulation list matching reference image style
                    <div className="flex items-center justify-between py-1.5 px-3 bg-black/45 border border-neutral-900 rounded-sm shadow">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3 bg-red-650 rounded-sm border border-white/10 animate-pulse" />
                        <span className="text-neutral-200 font-bold uppercase tracking-wider text-[11px]">
                          {playerName ? playerName.toUpperCase() : 'SURVIVOR'} [YOU]
                        </span>
                      </div>
                      <span className="text-[9px] text-orange-400 font-bold uppercase tracking-widest leading-none animate-pulse">
                        WAITING
                      </span>
                    </div>
                  )}
                </div>

                {/* 7. Primary Actions bottom block */}
                <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
                  {roomId ? (
                    // In-lobby deployment CTAs
                    roomState && roomState.hostId === clientId ? (
                      <button
                        onClick={() => {
                          sound.playClick();
                          triggerStartMatch();
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="w-full flex items-center justify-center gap-2 bg-[#be123c] hover:bg-[#e11d48] text-white font-sans font-black text-xs px-6 py-2.5 border-b-4 border-rose-950 hover:border-red-950 transition-all cursor-pointer transform active:scale-95 uppercase tracking-widest shadow-xl"
                      >
                        ✓ Ready Up // Deploy Squad
                      </button>
                    ) : (
                      <div className="w-full text-center font-mono text-[9px] font-bold bg-black/85 border border-rose-950/60 text-red-500/90 py-2.5 px-3 rounded-sm uppercase tracking-widest animate-pulse">
                        AWAITING CO-OP HOST TO DEPLOY SEED LINK...
                      </div>
                    )
                  ) : (
                    // Out-of-room fallback start solo or notify to create
                    <button
                      onClick={() => {
                        sound.playClick();
                        // Starts a solo session immediately
                        setIsCoop(false);
                        onStartGame();
                      }}
                      onMouseEnter={() => sound.playHover()}
                      className="w-full flex items-center justify-center gap-2 bg-[#be123c] hover:bg-[#e11d48] text-white font-sans font-black text-xs px-6 py-2.5 border-b-4 border-rose-950 hover:border-red-950 transition-all cursor-pointer transform active:scale-95 uppercase tracking-widest shadow-xl"
                    >
                      ✓ Ready Up
                    </button>
                  )}

                  <button
                    onClick={() => {
                      sound.playClick();
                      if (socket) {
                        socket.close();
                      }
                      setMenuView('main');
                      setIsCoop(false);
                    }}
                    onMouseEnter={() => sound.playHover()}
                    className="w-full bg-neutral-950/85 hover:bg-neutral-900 border border-neutral-900/90 text-neutral-450 hover:text-white font-sans font-bold text-xs py-2 rounded cursor-pointer tracking-widest uppercase transition-all flex items-center justify-center gap-1"
                  >
                    ← Back
                  </button>
                </div>

              </main>

              {/* Bottom control labels exactly as asked */}
              <footer className="relative z-30 w-full bg-black/60 border-t border-neutral-950 px-6 py-4 mt-auto">
                <div className="max-w-md mx-auto flex justify-center font-typewriter text-[11px] text-neutral-500 tracking-widest text-center uppercase font-bold">
                  WASD Move - Shift Sprint - Space Jump
                </div>
              </footer>
            </div>
          )}
        </>
      )}

      {/* 3. LOADING OVERLAY */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center z-50 text-center px-6 md:px-12">
          {/* Creepy black-canvas with vertical grid scanlines */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.3)_0%,#000_100%)] z-10" />
          
          <div className="relative z-20 max-w-3xl w-full flex flex-col items-center">
            {/* Spinning Syringe Outbreak Logo */}
            <div className="w-14 h-14 border-4 border-neutral-900 border-t-red-600 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
            
            <h2 className="text-2xl md:text-3xl font-black tracking-[0.25em] text-neutral-200 uppercase animate-pulse mb-1 font-serif">
              PREPARING ENDLESS WAVE PROTOCOL_
            </h2>
            <div className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-10">
              MAP: CLASSROOM OF THE UNDEAD // SURVIVE THE ENDLESS HORDE
            </div>
            
            {/* Matchmaking status checklist */}
            <div className="w-full max-w-md bg-neutral-950/90 border border-neutral-900 rounded p-4 text-left font-mono text-xs text-neutral-400 space-y-2 mb-10 shadow-2xl">
              <div className="border-b border-neutral-900 pb-2 flex justify-between items-center text-[10px] font-bold text-neutral-500">
                <span>{isCoop ? 'SQUAD ENCRYPTED CHANNEL SYNCHRONIZING...' : 'SOLO SURVIVAL CORRIDOR PREPARATION...'}</span>
                <span className="animate-ping text-green-500">● LIVE</span>
              </div>
              
              {isCoop ? (
                <>
                  {roomState && roomState.players && Object.values(roomState.players).map((p: any) => {
                    const isLocal = p.id === clientId;
                    return (
                      <div key={p.id} className="flex justify-between items-center text-neutral-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: `#${(p.color ?? 0xf97316).toString(16).padStart(6, '0')}` }} /> 
                          {p.name.toUpperCase()} {isLocal && '(YOU)'}
                        </span>
                        <span className="text-green-500 font-bold uppercase tracking-wider">DEPLOYED</span>
                      </div>
                    );
                  })}
                  {(!roomState || !roomState.players || Object.keys(roomState.players).length <= 1) && (
                    <div className="text-[10px] text-neutral-500 block italic text-center py-2 uppercase">
                      NO EXTRA SQUAD ALLIES - SURVIVE UNLIMITED WAVE PROGRESSION
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10px] text-neutral-500 block italic text-center py-2 uppercase">
                  SOLO PROTOCOL ENGAGED -- NO RESCUE COMING -- FIGHT FOR YOUR LIFE
                </div>
              )}

              <div className="flex justify-between items-center border-t border-neutral-900/40 pt-2 text-neutral-200">
                <span className="font-bold flex items-center gap-2">STATUS OUTCOME</span>
                <span className="text-red-500 font-black animate-pulse uppercase">NO EXFIL - ONLY DEATH LIMIT</span>
              </div>
            </div>

            {/* Tactical Loading Progress indicators */}
            <div className="w-full max-w-sm mb-8">
              <div className="h-1 bg-neutral-900 rounded-sm overflow-hidden border border-neutral-900">
                <div className="h-full bg-red-650 animate-loading-bar" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Animated survive notes */}
            <div className="border border-red-950/35 bg-red-950/5 max-w-lg p-3.5 rounded text-center">
              <span className="text-[9px] font-bold text-red-500 font-mono tracking-widest block uppercase mb-1.5">DEAD BELL COMBAT GUIDE:</span>
              <p className="text-xs font-mono text-neutral-400 italic">
                "{currentTip}"
              </p>
            </div>
          </div>
        </div>
      )}


      {/* 4. SETTINGS PANEL OVERLAY */}
      {showSettings && (
        <div className="absolute inset-0 bg-[#050505]/95 flex items-center justify-center pointer-events-auto z-[60] px-4">
          <div className="bg-[#111111] border border-neutral-850 w-full max-w-lg rounded-md overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
            {/* Header */}
            <div className="bg-black border-b border-neutral-850 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="text-red-500" size={20} />
                <h3 className="font-black text-lg tracking-wide text-[#e0e0e0] uppercase">SYSTEM SETTINGS</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-neutral-500 hover:text-neutral-200 font-mono text-xs cursor-pointer border border-neutral-800 rounded px-2 py-1"
              >
                CLOSE [ESC]
              </button>
            </div>

            {/* Quick Tabs */}
            <div className="flex border-b border-neutral-850 bg-black/50">
              <button
                onClick={() => setActiveTab('audio')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'audio' 
                    ? 'text-red-500 border-red-500 bg-neutral-900/30' 
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                AUDIO
              </button>
              <button
                onClick={() => setActiveTab('controls')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'controls' 
                    ? 'text-red-500 border-red-500 bg-neutral-900/30' 
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                CONTROLS / FOV
              </button>
              <button
                onClick={() => setActiveTab('hud')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'hud' 
                    ? 'text-red-500 border-red-500 bg-neutral-900/30' 
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                GAMEPLAY / HUD
              </button>

            </div>

            {/* Config Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {activeTab === 'audio' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                      <label className="flex items-center gap-2"><Volume2 size={16} /> Master Output</label>
                      <span className="text-xs font-mono text-red-500">{masterVol}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={masterVol} 
                      onChange={(e) => handleMasterVolChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-400">
                      <label>Sound FX Volume</label>
                      <span className="text-xs font-mono text-yellow-500">{sfxVol}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={sfxVol} 
                      onChange={(e) => handleSFXVolChange(Number(e.target.value))}
                      className="w-full accent-yellow-600 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-400">
                      <label>Ambient Score Drone</label>
                      <span className="text-xs font-mono text-red-400">{musicVol}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={musicVol} 
                      onChange={(e) => handleMusicVolChange(Number(e.target.value))}
                      className="w-full accent-red-500 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'controls' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                      <label className="flex items-center gap-2"><MousePointer size={16} /> Mouse Look Sensitivity</label>
                      <span className="text-xs font-mono text-red-500">{sensitivity}</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" max="100" 
                      value={sensitivity} 
                      onChange={(e) => handleSensChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase">Adjusts look sensitivity in FPS stage mode</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                      <label className="flex items-center gap-2"><Eye size={16} /> Player Camera FOV</label>
                      <span className="text-xs font-mono text-red-500">{fov}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" max="110" 
                      value={fov} 
                      onChange={(e) => handleFovChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase">Higher degrees widen peripheral visibility</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                      <label className="flex items-center gap-2">ADS Zoom Sensitivity Scale</label>
                      <span className="text-xs font-mono text-red-500">{zoomSensitivity}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="30" max="120" 
                      value={zoomSensitivity} 
                      onChange={(e) => handleZoomSensChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase">Multiplier scaling when aiming down sights [R-click]</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                      <label className="flex items-center gap-2">Camera Look Smoothing</label>
                      <span className="text-xs font-mono text-red-500">{lookSmoothing}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="80" 
                      value={lookSmoothing} 
                      onChange={(e) => handleLookSmoothingChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase">Slight motion inertia for high quality mouse panning</p>
                  </div>
                </div>
              )}

              {activeTab === 'hud' && (
                <div className="space-y-6 text-left">
                  {/* Category: Display & Graphics Quality */}
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase font-bold text-red-500 tracking-wider border-b border-neutral-900 pb-1.5 flex items-center gap-1.5">
                      📺 DISPLAY & VISUAL QUALITY
                    </div>
                    
                    <div>
                      <label className="text-sm font-semibold text-neutral-300 block mb-2">Graphics Rendering Preset</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['low', 'medium', 'high'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => handleGraphicsQualityChange(q)}
                            className={`py-2 px-3 text-xs font-bold uppercase rounded border transition-all cursor-pointer text-center ${
                              graphicsQuality === q
                                ? 'border-red-600 bg-red-950/20 text-red-400'
                                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            {q} PRESET
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-1.5 uppercase leading-normal">Low disables shadow maps and drops lighting cascades for faster frame rate</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-900 pt-4">
                      <div>
                        <span className="text-sm font-semibold text-neutral-300 block">CRT Scanline Display Overlay</span>
                        <span className="text-[10px] text-neutral-500 block uppercase">Immersive retro cathode-ray tube screen flicker effects</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={crtEffect}
                        onChange={(e) => handleCrtEffectChange(e.target.checked)}
                        className="w-5 h-5 accent-red-650 rounded cursor-pointer bg-neutral-900 border-neutral-800"
                      />
                    </div>

                    <div className="border-t border-neutral-900 pt-4">
                      <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                        <label>Cinematic Vignette Opacity</label>
                        <span className="text-xs font-mono text-red-500">{vignetteOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="90" 
                        value={vignetteOpacity} 
                        onChange={(e) => handleVignetteOpacityChange(Number(e.target.value))}
                        className="w-full accent-red-650 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Category: Gameplay HUD Elements */}
                  <div className="space-y-4 pt-2">
                    <div className="text-[10px] uppercase font-bold text-red-500 tracking-wider border-b border-neutral-900 pb-1.5 flex items-center gap-1.5">
                      🎮 GAMEPLAY & TARGET HUD
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-neutral-300 block mb-2 font-sans">Tactical Crosshair Color</label>
                      <div className="flex gap-3">
                        {['#22c55e', '#ffffff', '#ef4444', '#3b82f6'].map((col) => (
                          <button
                            key={col}
                            onClick={() => handleCrosshairColorChange(col)}
                            className="w-8 h-8 rounded-full border-2 transition-all cursor-pointer animate-none"
                            style={{ 
                              backgroundColor: col, 
                              borderColor: crosshairColor === col ? '#ffffff' : 'transparent',
                              transform: crosshairColor === col ? 'scale(1.15)' : 'scale(1)'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-900 pt-4">
                      <div>
                        <span className="text-sm font-semibold text-neutral-300 block">Render Collision Damage Text</span>
                        <span className="text-[10px] text-neutral-500 block uppercase">Display popup points numbers directly above hit zombies</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={showDmgNumbers}
                        onChange={(e) => handleDmgNumbersChange(e.target.checked)}
                        className="w-5 h-5 accent-red-650 rounded border-neutral-800 bg-neutral-900 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-900 pt-4">
                      <div>
                        <span className="text-sm font-semibold text-neutral-300 block">Low HP Blood Vignette Pulse</span>
                        <span className="text-[10px] text-neutral-500 block uppercase">Pulsate intense eye-safe blood vignette when taking critical melee strikes</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={bloodScreen}
                        onChange={(e) => handleBloodScreenChange(e.target.checked)}
                        className="w-5 h-5 accent-red-650 rounded border-neutral-800 bg-neutral-900 cursor-pointer"
                      />
                    </div>

                    <div className="border-t border-neutral-900 pt-4">
                      <div className="flex justify-between items-center text-sm font-semibold mb-1 text-neutral-300">
                        <label>Idle Weapon Sway Intensity</label>
                        <span className="text-xs font-mono text-red-500">{weaponSway}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="200" 
                        value={weaponSway} 
                        onChange={(e) => handleWeaponSwayChange(Number(e.target.value))}
                        className="w-full accent-red-650 bg-neutral-800 h-1 rounded-sm appearance-none cursor-pointer"
                      />
                      <p className="text-[10px] text-neutral-500 mt-1 uppercase leading-normal">Idle firearm movement amplitude coefficient</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-black p-4 border-t border-neutral-850 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-sm transition-all cursor-pointer animate-pulse"
              >
                APPLY & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. PLAYING PAUSED POPUP PROMPT */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-[#050505]/90 backdrop-blur-md flex items-center justify-center pointer-events-auto z-40 p-4 transition-all">
          <div className="bg-[#111111]/95 border-2 border-neutral-800/80 w-full max-w-4xl h-[85vh] md:h-[75vh] max-h-[640px] rounded-sm overflow-hidden flex flex-col md:flex-row shadow-2xl animate-fade-in text-left">
            
            {/* Left Column: Navigation buttons */}
            <div className="w-full md:w-5/12 bg-black/60 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-neutral-800/80 justify-between select-none">
              <div className="space-y-6">
                <div>
                  <span className="text-red-500 font-bold text-[10px] uppercase tracking-[0.3em] block mb-1">STAGE SUSPENDED</span>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#e0e0e0] uppercase border-b border-neutral-800 pb-2 font-serif">
                    DEAD <span className="text-red-650 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">BELL</span>
                  </h2>
                </div>

                {/* Subtitle / Round Summary */}
                <div className="bg-neutral-900/60 border border-neutral-800/30 rounded p-3 space-y-1">
                  <div className="flex justify-between text-xs font-mono uppercase">
                    <span className="text-neutral-500">CURRENT WAVE :</span>
                    <span className="text-red-500 font-bold">{currentRound}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono uppercase">
                    <span className="text-neutral-500 font-bold">KILLS :</span>
                    <span className="text-[#e2e8f0] font-bold">{kills}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono uppercase">
                    <span className="text-neutral-500 font-bold">CASH :</span>
                    <span className="text-[#00ff00] font-bold">${points}</span>
                  </div>
                </div>

                {/* Vertical buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const el = document.getElementById('fps-canvas-container');
                      try {
                        const promise = el?.requestPointerLock();
                        if (promise && typeof promise.catch === 'function') {
                          promise.catch((err) => {
                            console.warn("Pointer lock request deferred:", err);
                          });
                        }
                      } catch (err) {
                        console.warn("Pointer lock error:", err);
                      }
                    }}
                    className="text-left px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer bg-red-700 hover:bg-red-650 border-red-600 text-white shadow-[0_0_12px_rgba(220,10,10,0.25)] animate-pulse"
                  >
                    RESUME SURVIVAL
                  </button>

                  <button
                    onClick={() => setPauseMenuSubView('settings')}
                    className={`text-left px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${
                      pauseMenuSubView === 'settings'
                        ? 'bg-neutral-800 text-red-500 border-neutral-750 font-bold'
                        : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    SYSTEM SETTINGS
                  </button>

                  <button
                    onClick={() => setPauseMenuSubView('controls')}
                    className={`text-left px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${
                      pauseMenuSubView === 'controls'
                        ? 'bg-neutral-800 text-red-500 border-neutral-750 font-bold'
                        : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    CONTROLS INFOGRAPHIC
                  </button>

                  <button
                    onClick={() => {
                      sound.playReloadClick(0.3);
                      // Clear and reset state directly back to the main menu
                      setGameState('menu');
                    }}
                    className="text-left px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider text-red-600/80 hover:text-red-500 border border-transparent hover:border-red-900/30 hover:bg-red-950/15 transition-all cursor-pointer rounded-sm"
                  >
                    RETURN TO LOBBY
                  </button>
                </div>
              </div>

              {/* Tips at bottom */}
              <div className="hidden md:block text-[9px] font-mono leading-relaxed text-neutral-500 uppercase mt-4">
                <span>PRESS ESC TO RESUME AT ANY TIME</span>
              </div>
            </div>

            {/* Right Column: Active Subview Content Panel */}
            <div className="flex-1 bg-neutral-900/40 p-6 md:p-8 overflow-y-auto">
              {pauseMenuSubView === 'main' && (
                <div className="h-full flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">SESSION IN PROGRESS</span>
                    <h3 className="text-lg font-black text-[#e0e0e0] uppercase tracking-wide">SURVIVE THE INFECTED STUDENTS</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed uppercase">
                      The high school campus is quarantined. Collect ammunition, explore options, purchase double barrel shotguns, and team up with survivor bots to survive as many rounds as possible. Use the tabs on the left to configure your FOV, look sensitivity, master volume, and other metrics.
                    </p>
                  </div>

                  {/* Interactive Quick Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-black/60 border border-neutral-800/40 p-3 rounded">
                      <span className="text-[9px] text-neutral-500 block uppercase font-mono tracking-wider">ACTIVE FOE CLASS</span>
                      <span className="text-sm font-bold text-red-500 uppercase font-mono">CAMPUS OUTBREAK</span>
                    </div>
                    <div className="bg-black/60 border border-neutral-800/40 p-3 rounded">
                      <span className="text-[9px] text-neutral-500 block uppercase font-mono tracking-wider">LOCAL SYSTEM PIN</span>
                      <span className="text-sm font-bold text-neutral-400 font-mono">3000 // RUN</span>
                    </div>
                  </div>

                  <div className="bg-red-950/20 border border-red-900/10 p-4 rounded-sm mt-4">
                    <span className="text-[10px] text-red-500 font-bold block uppercase mb-1">PRO-TIP:</span>
                    <p className="text-[10px] leading-relaxed text-neutral-400 uppercase">
                      HEADSHOTS DO X2 DAMAGE AND GRANT DUAL BONUSES. AIM DOWN SIGHTS [RIGHT-CLICK] TO VASTLY TIGHTEN PELLET HUBS.
                    </p>
                  </div>
                </div>
              )}

              {pauseMenuSubView === 'settings' && (
                <div className="space-y-6 text-left">
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 mb-4">
                    <Settings className="text-red-500" size={16} />
                    <h3 className="text-sm font-extrabold text-[#e0e0e0] uppercase tracking-wide">SYSTEM SETTINGS</h3>
                  </div>

                  {/* Master Volume */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1 text-neutral-300 uppercase">
                      <label className="flex items-center gap-2"><Volume2 size={14} /> Master Volume</label>
                      <span className="text-xs font-mono text-red-500">{masterVol}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={masterVol} 
                      onChange={(e) => handleMasterVolChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Mouse Sensitivity */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1 text-neutral-300 uppercase">
                      <label className="flex items-center gap-2"><MousePointer size={14} /> Mouse Sensitivity</label>
                      <span className="text-xs font-mono text-red-500">{sensitivity}</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" max="100" 
                      value={sensitivity} 
                      onChange={(e) => handleSensChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* FOV */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1 text-neutral-300 uppercase">
                      <label className="flex items-center gap-2"><Eye size={14} /> Field Of View (FOV)</label>
                      <span className="text-xs font-mono text-red-500">{fov}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" max="110" 
                      value={fov} 
                      onChange={(e) => handleFovChange(Number(e.target.value))}
                      className="w-full accent-red-650 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Graphics Quality */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 block uppercase font-mono">Graphics Quality Preset</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => handleGraphicsQualityChange(q)}
                          className={`py-2 text-[10px] font-mono uppercase tracking-wider border transition-all cursor-pointer rounded-sm ${
                            graphicsQuality === q
                              ? 'bg-red-700/25 border-red-600 font-bold text-red-400'
                              : 'bg-black/40 border-neutral-850 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {pauseMenuSubView === 'controls' && (
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 mb-4">
                    <Shield className="text-red-500" size={16} />
                    <h3 className="text-sm font-extrabold text-[#e0e0e0] uppercase tracking-wide">SURVIVOR CONTROLS</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-neutral-850 text-[10px] font-mono leading-none">
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">WASD</span>
                      <span className="text-[#e2e8f0] font-bold uppercase">Move</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">Shift</span>
                      <span className="text-[#e2e8f0] font-bold uppercase">Sprint</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">Space</span>
                      <span className="text-[#e2e8f0] font-bold uppercase">Jump</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">Left Click</span>
                      <span className="text-red-450 font-bold uppercase">Shoot Weapon</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">Right Click</span>
                      <span className="text-red-450 font-bold uppercase font-mono">ADS (Aim Sights)</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">R</span>
                      <span className="text-[#e2e8f0] font-bold uppercase">Reload</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">E</span>
                      <span className="text-yellow-500 font-bold uppercase">Interact</span>
                    </div>
                    <div className="flex justify-between p-2 bg-black/45 rounded-sm border border-neutral-800/40">
                      <span className="text-neutral-500 uppercase">ESC</span>
                      <span className="text-red-500 font-bold uppercase">Pause</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. GAME OVER BOARD */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-[#050505]/98 flex flex-col items-center justify-center pointer-events-auto z-50 text-center px-4">
          <div className="max-w-md w-full p-8 bg-[#111111] border border-neutral-800 rounded shadow-2xl">
            <span className="text-[10px] text-red-600 font-bold uppercase tracking-[0.3em] block mb-2">STAGE SUMMARY</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#e0e0e0] uppercase tracking-tighter mb-1 select-text">YOU DIED</h2>
            <p className="text-xs text-neutral-500 font-mono uppercase mb-6">Classroom Arena Session Terminated</p>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-black p-4 border border-neutral-800/60 rounded">
                <span className="text-[9px] text-neutral-500 block uppercase tracking-wider font-bold">Total Cash</span>
                <span className="text-2xl font-black text-[#00ff00] font-mono">${points}</span>
              </div>
              <div className="bg-black p-4 border border-neutral-800/60 rounded">
                <span className="text-[9px] text-neutral-500 block uppercase tracking-wider font-bold">Waves Survived</span>
                <span className="text-2xl font-black text-red-500 font-mono">{currentRound}</span>
              </div>
              <div className="bg-black p-4 border border-neutral-800/60 rounded col-span-2">
                <span className="text-[9px] text-neutral-500 block uppercase tracking-wider font-bold">Kills</span>
                <span className="text-2xl font-black text-[#e0e0e0] font-mono">{kills}</span>
              </div>
            </div>

            <button 
              onClick={onRestartGame}
              className="flex items-center justify-center gap-3 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold text-lg px-8 py-4 rounded-sm border-b-4 border-red-900 transition-all cursor-pointer shadow-lg w-full"
            >
              <RefreshCw size={18} /> SURVIVE ONCE MORE
            </button>
          </div>
        </div>
      )}

      {/* 7. IN-GAME HUD STATUS OVERLAYS (ONLY ACTIVE WHEN PLAYING/PAUSED) */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <React.Fragment>
          {/* SQUAD TEAMMATES LIST (TOP-LEFT CORNER) */}
          {isCoop && teammates && teammates.length > 0 && (
            <div className="absolute top-10 left-8 md:left-10 flex flex-col z-40 select-none pointer-events-none gap-2.5 text-left bg-black/55 backdrop-blur-md p-3.5 border border-neutral-900 border-l-[3px] border-l-red-600 rounded shadow-2xl w-56 md:w-60">
              <div className="flex items-center gap-2 mb-1 border-b border-neutral-900 pb-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping inline-block" />
                <span className="text-[10px] font-black text-neutral-400 font-mono tracking-widest uppercase">FIRETEAM SQUAD STATUS</span>
              </div>
              <div className="space-y-3">
                {teammates.map((tm) => (
                  <div key={tm.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-black text-neutral-300 uppercase font-mono tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2.5 rounded-sm inline-block" style={{ backgroundColor: `#${tm.color.toString(16).padStart(6, '0')}` }} />
                        {tm.name}
                      </span>
                      <span className="text-xs font-black text-green-500 font-mono">${tm.points}</span>
                    </div>
                    
                    {/* Teammate health bar and active weapon/state */}
                    <div className="flex items-center gap-2">
                      <div className="w-28 bg-neutral-950 border border-neutral-900 h-1.5 rounded-sm overflow-hidden shadow-inner flex">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            tm.state === 'DOWNED' 
                              ? 'bg-red-600 animate-pulse' 
                              : tm.state === 'DEAD'
                              ? 'bg-neutral-800'
                              : 'bg-neutral-300 shadow-[0_0_4px_rgba(255,255,255,0.4)]'
                          }`}
                          style={{ width: tm.state === 'DOWNED' ? '100%' : tm.state === 'DEAD' ? '0%' : `${(tm.health / tm.maxHealth) * 100}%` }}
                        />
                      </div>
                      
                      <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                        {tm.state === 'DOWNED' ? (
                          <span className="text-red-500 font-black animate-pulse">DOWNED_</span>
                        ) : tm.state === 'DEAD' ? (
                          <span className="text-neutral-600">DEAD</span>
                        ) : (
                          tm.activeWeapon === 'shotgun' ? 'DB-12' : 'M1911'
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REAL-TIME STATS & GREEN FPS COUNTER (TOP-RIGHT CORNER) */}
          {showFps && (
            <div className="absolute top-10 right-8 md:right-10 flex flex-col items-end z-40 select-none pointer-events-none font-mono text-[9px] text-neutral-400 gap-1 bg-black/45 backdrop-blur-sm p-2 border border-neutral-900 rounded">
              <div className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">{fps} FPS</span>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-500">PING: 18ms</span>
              </div>
              <div className="text-[8px] text-neutral-600 uppercase tracking-widest font-mono">
                GPU: WebGL 2.0 Renderer
              </div>
            </div>
          )}

          {/* ACTIVE SYRINGE REVIVE PROGRESS OVERLAYS (CENTER SIGHT) */}
          {teammateReviveProgress >= 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 flex flex-col items-center gap-1.5 bg-black/85 border border-red-950 p-3 rounded pointer-events-none z-50 shadow-2xl animate-pulse">
              <span className="text-red-500 text-[10px] font-mono tracking-widest font-bold uppercase animate-pulse">REVIVING {revivingName ? revivingName.toUpperCase() : 'TEAMMATE'}...</span>
              <div className="w-52 bg-neutral-950 border border-neutral-900 h-2.5 rounded-sm overflow-hidden flex">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_10px_rgba(220,38,38,0.7)] transition-all duration-75" 
                  style={{ width: `${teammateReviveProgress}%` }} 
                />
              </div>
              <span className="text-[8px] font-mono font-bold text-neutral-400 uppercase tracking-widest">HOLD [E] KEY TO COMPLY_</span>
            </div>
          )}

          {playerReviveProgress >= 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 flex flex-col items-center gap-1.5 bg-black/85 border border-green-950 p-3 rounded pointer-events-none z-50 shadow-2xl animate-pulse">
              <span className="text-green-500 text-[10px] font-mono tracking-widest font-bold uppercase animate-pulse">BEING REVIVED BY SQUAD ALLY...</span>
              <div className="w-52 bg-neutral-950 border border-neutral-900 h-2.5 rounded-sm overflow-hidden flex">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 shadow-[0_0_10px_rgba(34,197,94,0.7)] transition-all duration-75" 
                  style={{ width: `${playerReviveProgress}%` }} 
                />
              </div>
            </div>
          )}

          {/* Top-Center Wave Announcer / Interact Prompts */}
          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center">
            {interactMessage && (
              <div className="bg-black/90 border border-neutral-800 text-white text-xs font-bold font-mono px-4 py-2 bg-gradient-to-r from-transparent via-neutral-950/95 to-transparent shadow-lg text-center backdrop-blur-sm max-w-lg mb-4 whitespace-pro-line leading-relaxed pointer-events-auto rounded uppercase">
                {interactMessage}
              </div>
            )}
          </div>

          {/* Full Wave Start Animation Text Card */}
          {showWaveBanner && (
            <div className="absolute top-[32%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 text-center animate-pulse pointer-events-none">
              <h1 className="text-7xl font-extrabold text-[#9d0505] tracking-widest uppercase filter drop-shadow-[0_5px_15px_rgba(239,68,68,0.73)] scale-in font-serif">
                ROUND {currentRound}
              </h1>
              <p className="text-xs font-mono text-neutral-450 tracking-[0.4em] uppercase mt-1">THE SCHOOL HORDE HAS SPAWNED</p>
            </div>
          )}

          {/* Hitmarkers (Diagonal lines) around crosshair - Precise & Shorter */}
          {hitmarker && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none w-5 h-5 animate-out fade-out duration-100">
              <div className={`absolute top-0 left-0 w-1.5 h-[1.5px] rotate-45 transform-gpu ${hitmarker === 'kill' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-300 shadow-[0_0_4px_#ffffff]'}`} />
              <div className={`absolute top-0 right-0 w-1.5 h-[1.5px] -rotate-45 transform-gpu ${hitmarker === 'kill' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-300 shadow-[0_0_4px_#ffffff]'}`} />
              <div className={`absolute bottom-0 left-0 w-1.5 h-[1.5px] -rotate-45 transform-gpu ${hitmarker === 'kill' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-300 shadow-[0_0_4px_#ffffff]'}`} />
              <div className={`absolute bottom-0 right-0 w-1.5 h-[1.5px] rotate-45 transform-gpu ${hitmarker === 'kill' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-300 shadow-[0_0_4px_#ffffff]'}`} />
            </div>
          )}

          {/* Center Crosshair - Ominous Tiny Minimal Sight */}
          {!isADS && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none w-6 h-6 animate-pulse">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2.5 opacity-70" style={{ backgroundColor: crosshairColor }}></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2.5 opacity-70" style={{ backgroundColor: crosshairColor }}></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-[1.5px] opacity-70" style={{ backgroundColor: crosshairColor }}></div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-[1.5px] opacity-70" style={{ backgroundColor: crosshairColor }}></div>
              <div className="absolute w-1 h-1 rounded-full opacity-90 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: crosshairColor }} />
            </div>
          )}

          {/* HUD: Bottom Left (Points & Round Number - Black Ops Zombies inspired) */}
          <div className="absolute bottom-8 left-8 md:bottom-10 md:left-10 flex flex-col z-40 select-none pointer-events-none gap-3">
            {/* Ominous Red Round Counter */}
            <div className="flex items-center gap-4">
              <div className="text-red-650 font-extrabold text-6xl md:text-7xl font-serif filter drop-shadow-[0_0_15px_rgba(220,38,38,0.85)] tracking-tighter leading-none transition-all">
                {currentRound}
              </div>
              <div className="flex flex-col select-none">
                <span className="text-red-700 text-[10px] font-bold tracking-[0.3em] uppercase leading-none">ROUND</span>
                <span className="text-neutral-500 text-[8px] font-mono tracking-wider ml-0.5 mt-0.5 uppercase">SURVIVAL WAVE</span>
              </div>
            </div>

            {/* Neon Green Score/Points Display */}
            <div className="relative flex items-center gap-3">
              {/* Neon bright green glowing left bar marker */}
              <div className="w-1.5 h-9 bg-[#00ff00] shadow-[0_0_10px_#00ff00]" />
              
              <div className="flex flex-col">
                <div className="relative flex items-center select-text">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#00ff00] drop-shadow-[0_0_8px_rgba(0,255,0,0.65)] leading-none">
                    ${points}
                  </span>
                  
                  {/* Score Modifications Cascade Popups */}
                  <div className="absolute -right-32 top-0.5 flex flex-col items-start gap-1 font-mono font-bold text-xs pointer-events-none">
                    {scorePopups.map((pop) => (
                      <span 
                        key={pop.id} 
                        className={`block animate-bounce text-xs font-bold tracking-tighter whitespace-nowrap ${
                          pop.text.includes('Headshot') 
                            ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.7)]' 
                            : pop.amount > 0 || pop.text.includes('Kill') || pop.text.includes('Cash')
                              ? 'text-[#00ff00] drop-shadow-[0_0_6px_rgba(0,255,0,0.5)]' 
                              : 'text-red-500'
                        }`}
                      >
                        {pop.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Health Bar styled in Elegant Minimal Dark style */}
            <div className="flex flex-col gap-1 w-56 md:w-64 mt-1 select-none">
              <div className="flex justify-end items-center text-[10px] font-mono font-bold">
                <span className="text-[#a5a5a5] tracking-wider">{health} / {maxHealth} HP</span>
              </div>
              <div className="bg-black/60 border border-neutral-850 h-3.5 rounded-sm overflow-hidden flex shadow-inner">
                <div 
                  className={`h-full transition-all duration-200 ${
                    healthPercent > 40 
                      ? 'bg-red-700 shadow-[0_0_8px_rgba(220,38,38,0.85)]' 
                      : 'bg-red-650 animate-pulse'
                  }`}
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
            </div>

            {/* Passive perk/armament badges decor */}
            <div className="flex gap-1.5 mt-1">
              <div className="w-6 h-6 rounded-full border border-neutral-800 bg-[#070707] flex items-center justify-center grayscale opacity-50">
                <span className="text-[7px] font-mono text-white text-center font-bold">HP</span>
              </div>
              <div className="w-6 h-6 rounded-full border border-neutral-800 bg-[#070707] flex items-center justify-center grayscale opacity-50">
                <div className="w-1 h-3 bg-red-600 shadow-[0_0_2px_red] rounded-t-sm"></div>
              </div>
              <div className="w-6 h-6 rounded-full border border-neutral-800 bg-[#070707] flex items-center justify-center grayscale opacity-50">
                <div className="w-2.5 h-2.5 border-2 border-green-500 rounded-full"></div>
              </div>
              
              {/* Real Fast Hands Active Badge */}
              <div className={`w-6 h-6 rounded-full border ${hasFastHands ? 'border-amber-500 bg-amber-950/40 text-amber-400 font-black animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'border-neutral-800 bg-[#070707] text-neutral-700 opacity-40'} flex items-center justify-center transition-all duration-300`} title="Fast Hands - 50% Faster Reload Speed">
                <span className="text-[7.5px] font-mono text-center leading-none font-bold">FH</span>
              </div>
            </div>
          </div>

          {/* HUD: Bottom Right (Clean Black Ops Style Active Weapon info) */}
          <div className="absolute bottom-8 right-8 md:bottom-10 md:right-10 text-right z-40 select-none pointer-events-none flex flex-col items-end">
            {/* High-quality Vector Weapon HUD Icon */}
            <div className="mb-2 h-12 flex items-center justify-end">
              {activeWeaponId === 'pistol' ? (
                <svg width="84" height="42" viewBox="0 0 84 42" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 filter drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]">
                  {/* Slide */}
                  <path d="M12 8h56v14H12z" />
                  {/* Slide grooves */}
                  <path d="M18 10v10M22 10v10M26 10v10M30 10v10" strokeWidth="1" opacity="0.6" />
                  {/* Barrel tip */}
                  <path d="M12 11H8v5h4" />
                  {/* Frame and grip guard */}
                  <path d="M38 22h30l2 6-4 12H52l-6-14H38v-4" />
                  {/* Grip panel outline */}
                  <path d="M54 24l5 12h-6l-5-12z" fill="currentColor" fillOpacity="0.15" />
                  {/* Trigger guard and trigger */}
                  <path d="M38 22c-8 0-8 8 0 8" />
                  <path d="M34 25c-2 0-3 3-3 3" strokeWidth="1.2" />
                </svg>
              ) : activeWeaponId === 'shotgun' ? (
                <svg width="112" height="32" viewBox="0 0 112 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 filter drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]">
                  {/* Main Dual Barrels */}
                  <path d="M4 8h76v6H4zM4 11h76" />
                  {/* Forend Stock wood under the barrels */}
                  <path d="M48 14h20l2 5H52z" fill="currentColor" fillOpacity="0.15" strokeWidth="1.5" />
                  {/* Action Chamber/Receiver */}
                  <path d="M80 8h12v10H80z" />
                  <path d="M86 8v10" opacity="0.5" />
                  {/* Stock Neck / Grip */}
                  <path d="M92 10l6 8-4 10h-6l-2-10" />
                  {/* Skeletal Wooden Buttstock */}
                  <path d="M94 15l14-2v15l-10-5z" fill="currentColor" fillOpacity="0.15" />
                  {/* Dual Triggers inside guard */}
                  <path d="M82 18c0 4 6 4 6 0" />
                  <path d="M84 18c0 2 1 3 1 3M86 18c0 2 1 3 1 3" strokeWidth="1.2" />
                </svg>
              ) : (
                <svg width="98" height="42" viewBox="0 0 98 42" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 filter drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]">
                  {/* Receiver & barrel */}
                  <path d="M12 10h56v8H12z" />
                  <path d="M6 12h6v4H6z" />
                  {/* Curved MP5 curving magazine */}
                  <path d="M38 18l-3 14c-0.5 2-2 3-4 3h-2" />
                  {/* Handguard */}
                  <path d="M20 18h18v-8M21 13h16" opacity="0.6" strokeWidth="1" />
                  {/* Pistol Grip */}
                  <path d="M48 18l6 10H44l-4-10" />
                  {/* Stock frame sleeve */}
                  <path d="M68 12h12l10-4v14l-10-2z" fill="currentColor" fillOpacity="0.15" />
                  {/* Rear sight & front sight */}
                  <path d="M64 10V6M15 10V5M15 5a2 2 0 100-4 2 2 0 000 4" />
                  {/* Trigger and trigger guard */}
                  <path d="M40 18a4 4 0 005 5v-5" />
                </svg>
              )}
            </div>

            <div className="text-neutral-400 text-[11px] md:text-xs font-black uppercase tracking-[0.25em] mb-1.5 font-mono drop-shadow-[0_0_4px_rgba(255,255,255,0.15)]">
              {activeWeaponId === 'pistol' ? 'M1911 PISTOL' : activeWeaponId === 'shotgun' ? 'DOUBLE BARREL SHOTGUN' : 'MP5 SUBMACHINE GUN'}
            </div>
            
            <div className="flex items-baseline justify-end select-text gap-2">
              <div className={`text-4xl md:text-5xl font-mono font-black tracking-tighter ${isReloading ? 'text-red-500 animate-pulse text-2xl' : 'text-neutral-100'}`}>
                {isReloading ? 'RELOADING' : String(ammoClip)}
              </div>
              {!isReloading && (
                <React.Fragment>
                  <span className="text-xl md:text-2xl text-neutral-650 font-mono font-light select-none">/</span>
                  <div className="text-2xl md:text-3xl font-mono font-bold text-neutral-400">
                    {ammoReserve}
                  </div>
                </React.Fragment>
              )}
            </div>

            {/* Clean segment bar bullets indicator */}
            {!isReloading && (
              <div className="mt-2.5 flex justify-end gap-1">
                {Array.from({ length: activeWeaponId === 'pistol' ? 12 : 6 }).map((_, idx) => {
                  const isActive = idx < ammoClip;
                  return (
                    <div 
                      key={idx} 
                      className={`w-1 h-3 transition-all duration-150 rounded-sm ${
                        isActive 
                          ? 'bg-neutral-100 shadow-[0_0_2px_rgba(255,255,255,0.7)]' 
                          : 'bg-neutral-800'
                      }`} 
                    />
                  );
                })}
              </div>
            )}
          </div>
        </React.Fragment>
      )}

    </div>
  );
};
