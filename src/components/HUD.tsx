import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Shield, Settings, Play, RefreshCw, Eye, MousePointer, Users, Tv, Gamepad2, SlidersHorizontal } from 'lucide-react';
import { sound } from '../sound';
import { TeammateState } from '../types';

interface HUDProps {
  health: number;
  maxHealth: number;
  points: number;
  kills: number;
  currentRound: number;
  activeWeaponId: 'pistol' | 'shotgun';
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

  isCoop: boolean;
  setIsCoop: (val: boolean) => void;
  teammates: TeammateState[];
  playerReviveProgress: number;
  teammateReviveProgress: number;
  revivingName: string | null;

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

// ─── Reusable styled slider ───────────────────────────────────────────────────
const SettingsSlider = ({
  label, icon, value, min, max, unit = '', color = 'red',
  onChange, hint
}: {
  label: string; icon?: React.ReactNode; value: number;
  min: number; max: number; unit?: string; color?: string;
  onChange: (v: number) => void; hint?: string;
}) => {
  const accent = color === 'yellow' ? 'text-yellow-400' : color === 'green' ? 'text-green-400' : 'text-red-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm font-bold text-neutral-200 uppercase tracking-wide">
          {icon}{label}
        </label>
        <span className={`text-sm font-black font-mono ${accent} bg-black/60 px-2 py-0.5 rounded border border-neutral-800`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseEnter={() => sound.playHover()}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-neutral-800 accent-red-600"
      />
      {hint && <p className="text-[11px] text-neutral-500 uppercase tracking-wide">{hint}</p>}
    </div>
  );
};

// ─── Toggle row ───────────────────────────────────────────────────────────────
const SettingsToggle = ({
  label, description, checked, onChange
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-3 border-t border-neutral-800/60">
    <div className="pr-4">
      <span className="text-sm font-bold text-neutral-200 uppercase tracking-wide block">{label}</span>
      {description && <span className="text-[11px] text-neutral-500 uppercase block mt-0.5">{description}</span>}
    </div>
    <button
      onClick={() => { sound.playClick(); onChange(!checked); }}
      className={`relative w-12 h-6 rounded-full border-2 transition-all cursor-pointer flex-shrink-0 ${
        checked ? 'bg-red-700 border-red-500' : 'bg-neutral-800 border-neutral-700'
      }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
        checked ? 'left-6 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'left-0.5 bg-neutral-500'
      }`} />
    </button>
  </div>
);

export const HUD: React.FC<HUDProps> = ({
  health, maxHealth, points, kills, currentRound,
  activeWeaponId, ammoClip, ammoReserve, isADS, isReloading,
  hitmarker, interactMessage, gameState, setGameState,
  onStartGame, onRestartGame, scorePopups, showWaveBanner,
  isCoop, setIsCoop, teammates, playerReviveProgress, teammateReviveProgress, revivingName,
  socket, roomId, roomState, clientId, playerName, setPlayerName,
  playerColor, setPlayerColor, connectAndJoinLobby, hostNewLobby,
  sendChatMessage, triggerStartMatch, chatLog
}) => {

  const [showSettings, setShowSettings] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'multiplayer'>('main');
  const [pauseMenuSubView, setPauseMenuSubView] = useState<'main' | 'settings' | 'controls'>('main');

  useEffect(() => {
    if (gameState === 'paused') setPauseMenuSubView('main');
  }, [gameState]);

  const [activeTab, setActiveTab] = useState<'audio' | 'controls' | 'display' | 'gameplay'>('audio');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fps, setFps] = useState(60);
  const [showFps, setShowFps] = useState(true);

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
      setCurrentTip(survivalTips[Math.floor(Math.random() * survivalTips.length)]);
    }
  }, [gameState]);

  // ── Settings state ────────────────────────────────────────────────────────
  const [masterVol, setMasterVol] = useState(50);
  const [sfxVol, setSFXVol] = useState(60);
  const [musicVol, setMusicVol] = useState(35);
  const [sensitivity, setSensitivity] = useState(35);
  const [zoomSensitivity, setZoomSensitivity] = useState(75);
  const [lookSmoothing, setLookSmoothing] = useState(30);
  const [fov, setFov] = useState(75);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [crtEffect, setCrtEffect] = useState(true);
  const [vignetteOpacity, setVignetteOpacity] = useState(45);
  const [crosshairColor, setCrosshairColor] = useState('#22c55e');
  const [showDmgNumbers, setShowDmgNumbers] = useState(true);
  const [bloodScreen, setBloodScreen] = useState(true);
  const [weaponSway, setWeaponSway] = useState(100);

  useEffect(() => {
    const saved = localStorage.getItem('codz_settings');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.audio) {
          setMasterVol(p.audio.master ?? 50);
          setSFXVol(p.audio.sfx ?? 60);
          setMusicVol(p.audio.music ?? 35);
          sound.setMasterVolume((p.audio.master ?? 50) / 100);
          sound.setSFXVolume((p.audio.sfx ?? 60) / 100);
          sound.setMusicVolume((p.audio.music ?? 35) / 100);
        } else {
          sound.setMasterVolume(0.5); sound.setSFXVolume(0.6); sound.setMusicVolume(0.35);
        }
        if (p.controls) {
          setSensitivity(p.controls.sensitivity ?? 35);
          setZoomSensitivity(p.controls.zoomSensitivity ?? 75);
          setLookSmoothing(p.controls.lookSmoothing ?? 30);
        }
        if (p.graphics) {
          setFov(p.graphics.fov ?? 75);
          setGraphicsQuality(p.graphics.quality ?? 'high');
          setCrtEffect(p.graphics.crtEffect ?? true);
          setVignetteOpacity(p.graphics.vignetteOpacity ?? 45);
        }
        if (p.gameplay) {
          setCrosshairColor(p.gameplay.crosshairColor ?? '#22c55e');
          setShowDmgNumbers(p.gameplay.damageNumbers ?? true);
          setBloodScreen(p.gameplay.bloodScreen ?? true);
          setWeaponSway(p.gameplay.weaponSway ?? 100);
        }
      } catch (e) { console.warn('Could not parse saved settings'); }
    } else {
      sound.setMasterVolume(0.5); sound.setSFXVolume(0.6); sound.setMusicVolume(0.35);
    }
  }, []);

  const saveSettingPiece = (section: string, key: string, value: any) => {
    const fresh = localStorage.getItem('codz_settings');
    let data: any = {};
    if (fresh) { try { data = JSON.parse(fresh); } catch (e) {} }
    if (!data[section]) data[section] = {};
    data[section][key] = value;
    localStorage.setItem('codz_settings', JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('settings-update', { detail: data }));
  };

  const handleMasterVolChange = (val: number) => { setMasterVol(val); sound.setMasterVolume(val / 100); saveSettingPiece('audio', 'master', val); };
  const handleSFXVolChange = (val: number) => { setSFXVol(val); sound.setSFXVolume(val / 100); saveSettingPiece('audio', 'sfx', val); };
  const handleMusicVolChange = (val: number) => { setMusicVol(val); sound.setMusicVolume(val / 100); saveSettingPiece('audio', 'music', val); };
  const handleSensChange = (val: number) => { setSensitivity(val); saveSettingPiece('controls', 'sensitivity', val); };
  const handleZoomSensChange = (val: number) => { setZoomSensitivity(val); saveSettingPiece('controls', 'zoomSensitivity', val); };
  const handleLookSmoothingChange = (val: number) => { setLookSmoothing(val); saveSettingPiece('controls', 'lookSmoothing', val); };
  const handleFovChange = (val: number) => { setFov(val); saveSettingPiece('graphics', 'fov', val); };
  const handleGraphicsQualityChange = (val: 'low' | 'medium' | 'high') => { setGraphicsQuality(val); saveSettingPiece('graphics', 'quality', val); };
  const handleCrtEffectChange = (val: boolean) => { setCrtEffect(val); saveSettingPiece('graphics', 'crtEffect', val); };
  const handleVignetteOpacityChange = (val: number) => { setVignetteOpacity(val); saveSettingPiece('graphics', 'vignetteOpacity', val); };
  const handleCrosshairColorChange = (val: string) => { setCrosshairColor(val); saveSettingPiece('gameplay', 'crosshairColor', val); };
  const handleDmgNumbersChange = (val: boolean) => { setShowDmgNumbers(val); saveSettingPiece('gameplay', 'damageNumbers', val); };
  const handleBloodScreenChange = (val: boolean) => { setBloodScreen(val); saveSettingPiece('gameplay', 'bloodScreen', val); };
  const handleWeaponSwayChange = (val: number) => { setWeaponSway(val); saveSettingPiece('gameplay', 'weaponSway', val); };

  const [damageFlash, setDamageFlash] = useState(0);
  const prevHealthRef = useRef(health);
  useEffect(() => {
    if (health < prevHealthRef.current) setDamageFlash(0.65);
    prevHealthRef.current = health;
  }, [health]);
  useEffect(() => {
    if (damageFlash > 0) {
      const timer = setTimeout(() => setDamageFlash(prev => Math.max(0, prev - 0.05)), 30);
      return () => clearTimeout(timer);
    }
  }, [damageFlash]);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLowHealth = healthPercent <= 35;

  // ── Settings panel content ────────────────────────────────────────────────
  const settingsTabs = [
    { id: 'audio' as const, label: 'Audio', icon: <Volume2 size={15} /> },
    { id: 'controls' as const, label: 'Controls', icon: <MousePointer size={15} /> },
    { id: 'display' as const, label: 'Display', icon: <Tv size={15} /> },
    { id: 'gameplay' as const, label: 'Gameplay', icon: <Gamepad2 size={15} /> },
  ];

  const SettingsPanel = () => (
    <div className="absolute inset-0 bg-black/96 flex items-center justify-center pointer-events-auto z-[60] px-4 backdrop-blur-sm">
      <div
        className="relative bg-[#0d0d0f] border border-neutral-800 w-full max-w-xl rounded-lg overflow-hidden flex flex-col shadow-[0_0_60px_rgba(220,38,38,0.15)] max-h-[88vh]"
        style={{ fontFamily: 'inherit' }}
      >
        {/* Red glow top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/70 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-red-950/50 border border-red-900/60 flex items-center justify-center">
              <Settings className="text-red-400" size={16} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-widest text-white uppercase">Settings</h3>
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Survival Configuration</p>
            </div>
          </div>
          <button
            onClick={() => { sound.playClick(); setShowSettings(false); }}
            onMouseEnter={() => sound.playHover()}
            className="text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-widest cursor-pointer border border-neutral-800 hover:border-neutral-600 rounded-md px-3 py-1.5 transition-all bg-neutral-900/50 hover:bg-neutral-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800/70 bg-black/30">
          {settingsTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { sound.playClick(); setActiveTab(tab.id as any); }}
              onMouseEnter={() => sound.playHover()}
              className={`flex-1 py-3.5 flex flex-col items-center gap-1 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'text-red-400 border-red-500 bg-red-950/10'
                  : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:bg-neutral-900/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {activeTab === 'audio' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Volume2 size={14} className="text-red-400" />
                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">Audio Levels</h4>
              </div>
              <SettingsSlider label="Master Volume" icon={<Volume2 size={14}/>} value={masterVol} min={0} max={100} unit="%" onChange={handleMasterVolChange} hint="Controls overall game output level" />
              <SettingsSlider label="Sound FX" value={sfxVol} min={0} max={100} unit="%" color="yellow" onChange={handleSFXVolChange} hint="Gunshots, impacts, and UI feedback" />
              <SettingsSlider label="Ambient Score" value={musicVol} min={0} max={100} unit="%" onChange={handleMusicVolChange} hint="Background horror drone volume" />
              <div className="mt-4 p-3 bg-red-950/10 border border-red-900/20 rounded-md">
                <p className="text-[11px] text-neutral-400 uppercase tracking-wide">
                  💡 Click <strong className="text-red-400">APPLY & SAVE</strong> below to keep settings after closing.
                </p>
              </div>
            </>
          )}

          {activeTab === 'controls' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <MousePointer size={14} className="text-red-400" />
                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">Mouse & Camera</h4>
              </div>
              <SettingsSlider label="Look Sensitivity" icon={<MousePointer size={14}/>} value={sensitivity} min={5} max={100} onChange={handleSensChange} hint="FPS mouse look speed" />
              <SettingsSlider label="ADS Zoom Sensitivity" value={zoomSensitivity} min={30} max={120} unit="%" onChange={handleZoomSensChange} hint="Multiplier when aiming down sights [R-Click]" />
              <SettingsSlider label="Camera Smoothing" value={lookSmoothing} min={0} max={80} unit="%" onChange={handleLookSmoothingChange} hint="Inertia for smooth panning feel" />
              <SettingsSlider label="Field of View" icon={<Eye size={14}/>} value={fov} min={60} max={110} unit="°" onChange={handleFovChange} hint="Higher values widen peripheral vision" />
            </>
          )}

          {activeTab === 'display' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Tv size={14} className="text-red-400" />
                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">Display & Visual</h4>
              </div>

              {/* Graphics preset */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-200 uppercase tracking-wide block">Graphics Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => { sound.playClick(); handleGraphicsQualityChange(q); }}
                      onMouseEnter={() => sound.playHover()}
                      className={`py-3 text-xs font-black uppercase tracking-wider rounded-md border-2 transition-all cursor-pointer ${
                        graphicsQuality === q
                          ? 'border-red-500 bg-red-950/25 text-red-300 shadow-[0_0_10px_rgba(220,38,38,0.2)]'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                      }`}
                    >
                      {q === 'low' ? '🔋 Low' : q === 'medium' ? '⚡ Mid' : '🔥 High'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 uppercase">Low mode dis