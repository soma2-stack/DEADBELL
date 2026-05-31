import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Shield, Settings, Play, RefreshCw, Eye, MousePointer, Users, Tv, Gamepad2, SlidersHorizontal, Skull, Wifi, WifiOff, Copy, Check, LogOut, ChevronRight, ChevronLeft, Zap, Crosshair } from 'lucide-react';
import { sound } from '../sound';
import { TeammateState } from '../types';

interface HUDProps {
  health: number;
  maxHealth: number;
  points: number;
  kills: number;
  currentRound: number;
  activeWeaponId: 'pistol' | 'shotgun' | 'smg' | 'm16' | 'magnum' | 'sniper' | 'wonder_weapon';
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
  chatLog: Array<{ sender: string; text: string; timestamp: number }>;
}

// ─── Utility: hex color number → css string ──────────────────────────────────
const hexNumToCSS = (n: number) => '#' + n.toString(16).padStart(6, '0');

// ─── Reusable button with hover + click sounds ────────────────────────────────
const SoundBtn: React.FC<{
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, className = '', children, disabled }) => (
  <button
    disabled={disabled}
    onClick={() => { sound.playClick(); onClick(); }}
    onMouseEnter={() => sound.playHover()}
    className={className}
  >
    {children}
  </button>
);

// ─── Reusable styled slider ───────────────────────────────────────────────────
const SettingsSlider = ({
  label, icon, value, min, max, unit = '', color = 'red',
  onChange, hint,
}: {
  label: string; icon?: React.ReactNode; value: number;
  min: number; max: number; unit?: string; color?: string;
  onChange: (v: number) => void; hint?: string;
}) => {
  const accent =
    color === 'yellow' ? 'text-yellow-300' :
    color === 'green'  ? 'text-green-400'  :
    color === 'blue'   ? 'text-blue-400'   : 'text-red-400';
  const track =
    color === 'yellow' ? 'accent-yellow-400' :
    color === 'green'  ? 'accent-green-400'  :
    color === 'blue'   ? 'accent-blue-400'   : 'accent-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-widest">
          {icon && <span className={accent}>{icon}</span>}
          {label}
        </label>
        <span className={`text-sm font-black font-mono ${accent} bg-black/80 px-2.5 py-1 rounded border border-neutral-700 min-w-[56px] text-center`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseEnter={() => sound.playHover()}
        className={`w-full h-2.5 rounded-full appearance-none cursor-pointer bg-neutral-800 ${track}`}
      />
      {hint && <p className="text-[11px] text-neutral-400 uppercase tracking-wider">{hint}</p>}
    </div>
  );
};

// ─── Toggle row ───────────────────────────────────────────────────────────────
const SettingsToggle = ({
  label, description, checked, onChange,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-3.5 border-t border-neutral-800/70">
    <div className="pr-4">
      <span className="text-sm font-bold text-white uppercase tracking-widest block">{label}</span>
      {description && <span className="text-[11px] text-neutral-400 uppercase block mt-0.5">{description}</span>}
    </div>
    <button
      onClick={() => { sound.playClick(); onChange(!checked); }}
      onMouseEnter={() => sound.playHover()}
      className={`relative w-14 h-7 rounded-full border-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${
        checked ? 'bg-red-700 border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.4)]' : 'bg-neutral-900 border-neutral-700'
      }`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ${
        checked ? 'left-[30px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]' : 'left-0.5 bg-neutral-600'
      }`} />
    </button>
  </div>
);

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-neutral-800/80">
    <span className="text-red-400">{icon}</span>
    <h4 className="text-xs font-black text-red-400 uppercase tracking-[0.2em]">{label}</h4>
    <div className="flex-1 h-px bg-gradient-to-r from-red-900/40 to-transparent" />
  </div>
);

// ─── Main HUD export ──────────────────────────────────────────────────────────
export const HUD: React.FC<HUDProps> = ({
  health, maxHealth, points, kills, currentRound,
  activeWeaponId, ammoClip, ammoReserve, isADS, isReloading,
  hitmarker, interactMessage, gameState, setGameState,
  onStartGame, onRestartGame, scorePopups, showWaveBanner,
  hasFastHands,
  isCoop, setIsCoop, teammates, playerReviveProgress, teammateReviveProgress, revivingName,
  socket, roomId, roomState, clientId, playerName, setPlayerName,
  playerColor, setPlayerColor, connectAndJoinLobby, hostNewLobby,
  sendChatMessage, triggerStartMatch, chatLog,
}) => {

  const [showSettings, setShowSettings] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'multiplayer'>('main');
  const [pauseMenuSubView, setPauseMenuSubView] = useState<'main' | 'settings' | 'controls'>('main');

  useEffect(() => {
    if (gameState === 'paused') setPauseMenuSubView('main');
  }, [gameState]);

  const [activeTab, setActiveTab] = useState<'audio' | 'controls' | 'display' | 'gameplay'>('audio');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [fps, setFps] = useState(60);
  const [showFps, setShowFps] = useState(true);

  const survivalTips = [
    "AIM DOWN SIGHTS [R-CLICK] TO TIGHTEN SHOTGUN PELLET SPREAD.",
    "WHEN A TEAMMATE IS DOWNED, HOLD [E] NEARBY TO REVIVE THEM.",
    "ZOMBIES SPAWN FASTER EACH ROUND — REFILL AMMO BETWEEN WAVES.",
    "BOT TEAMMATES AUTO-ACCUMULATE POINTS AND BUY BETTER WEAPONS.",
    "HEALTH REGENERATES RAPIDLY AFTER 4.5s WITH NO MELEE HITS.",
    "HEADSHOTS DEAL 2× DAMAGE AND GRANT BONUS SCORE.",
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

  // ── Settings state ──────────────────────────────────────────────────────────
  const [masterVol, setMasterVol]           = useState(50);
  const [sfxVol, setSFXVol]                 = useState(60);
  const [musicVol, setMusicVol]             = useState(35);
  const [sensitivity, setSensitivity]       = useState(35);
  const [zoomSensitivity, setZoomSensitivity] = useState(75);
  const [lookSmoothing, setLookSmoothing]   = useState(30);
  const [fov, setFov]                       = useState(75);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [crtEffect, setCrtEffect]           = useState(true);
  const [vignetteOpacity, setVignetteOpacity] = useState(45);
  const [crosshairColor, setCrosshairColor] = useState('#22c55e');
  const [showDmgNumbers, setShowDmgNumbers] = useState(true);
  const [bloodScreen, setBloodScreen]       = useState(true);
  const [weaponSway, setWeaponSway]         = useState(100);

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

  const handleMasterVolChange  = (v: number) => { setMasterVol(v);        sound.setMasterVolume(v / 100); saveSettingPiece('audio',    'master',         v); };
  const handleSFXVolChange     = (v: number) => { setSFXVol(v);           sound.setSFXVolume(v / 100);    saveSettingPiece('audio',    'sfx',            v); };
  const handleMusicVolChange   = (v: number) => { setMusicVol(v);         sound.setMusicVolume(v / 100);  saveSettingPiece('audio',    'music',          v); };
  const handleSensChange       = (v: number) => { setSensitivity(v);                                      saveSettingPiece('controls', 'sensitivity',    v); };
  const handleZoomSensChange   = (v: number) => { setZoomSensitivity(v);                                  saveSettingPiece('controls', 'zoomSensitivity', v); };
  const handleLookSmoothChange = (v: number) => { setLookSmoothing(v);                                    saveSettingPiece('controls', 'lookSmoothing',  v); };
  const handleFovChange        = (v: number) => { setFov(v);                                              saveSettingPiece('graphics', 'fov',            v); };
  const handleGraphicsChange   = (v: 'low' | 'medium' | 'high') => { setGraphicsQuality(v);              saveSettingPiece('graphics', 'quality',        v); };
  const handleCrtChange        = (v: boolean) => { setCrtEffect(v);                                       saveSettingPiece('graphics', 'crtEffect',      v); };
  const handleVigChange        = (v: number) => { setVignetteOpacity(v);                                  saveSettingPiece('graphics', 'vignetteOpacity', v); };
  const handleXhairChange      = (v: string) => { setCrosshairColor(v);                                   saveSettingPiece('gameplay', 'crosshairColor', v); };
  const handleDmgNumsChange    = (v: boolean) => { setShowDmgNumbers(v);                                  saveSettingPiece('gameplay', 'damageNumbers',  v); };
  const handleBloodChange      = (v: boolean) => { setBloodScreen(v);                                     saveSettingPiece('gameplay', 'bloodScreen',    v); };
  const handleSwayChange       = (v: number) => { setWeaponSway(v);                                       saveSettingPiece('gameplay', 'weaponSway',     v); };

  // ── Damage flash ────────────────────────────────────────────────────────────
  const [damageFlash, setDamageFlash] = useState(0);
  const prevHealthRef = useRef(health);
  useEffect(() => {
    if (health < prevHealthRef.current) setDamageFlash(0.65);
    prevHealthRef.current = health;
  }, [health]);
  useEffect(() => {
    if (damageFlash > 0) {
      const t = setTimeout(() => setDamageFlash(prev => Math.max(0, prev - 0.05)), 30);
      return () => clearTimeout(t);
    }
  }, [damageFlash]);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLowHealth   = healthPercent <= 35;

  // ── Colour presets ──────────────────────────────────────────────────────────
  const colorPresets = [
    { label: 'Orange', value: 0xf97316 },
    { label: 'Red',    value: 0xef4444 },
    { label: 'Blue',   value: 0x3b82f6 },
    { label: 'Green',  value: 0x22c55e },
    { label: 'Purple', value: 0xa855f7 },
    { label: 'White',  value: 0xffffff },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // SETTINGS PANEL
  // ──────────────────────────────────────────────────────────────────────────
  const settingsTabs = [
    { id: 'audio'    as const, label: 'Audio',    icon: <Volume2     size={16} /> },
    { id: 'controls' as const, label: 'Controls', icon: <MousePointer size={16} /> },
    { id: 'display'  as const, label: 'Display',  icon: <Tv          size={16} /> },
    { id: 'gameplay' as const, label: 'Gameplay', icon: <Gamepad2    size={16} /> },
  ];

  const SettingsPanel = () => (
    <div className="absolute inset-0 bg-black/95 flex items-center justify-center pointer-events-auto z-[60] px-4 backdrop-blur-md">
      {/* Panel */}
      <div className="relative bg-[#0a0a0c] border border-red-900/40 w-full max-w-2xl rounded-xl overflow-hidden flex flex-col shadow-[0_0_80px_rgba(220,38,38,0.25),0_0_20px_rgba(0,0,0,0.8)] max-h-[90vh]">

        {/* Animated top accent */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-300/30 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-red-900/30 bg-gradient-to-r from-red-950/20 to-black/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <Settings className="text-red-400" size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-[0.2em] text-white uppercase">Settings</h3>
              <p className="text-[11px] text-red-400/70 uppercase tracking-[0.15em] font-bold">Survival Configuration</p>
            </div>
          </div>
          <SoundBtn
            onClick={() => setShowSettings(false)}
            className="text-neutral-400 hover:text-white font-black text-xs uppercase tracking-widest cursor-pointer border border-neutral-700 hover:border-red-700 rounded-lg px-4 py-2 transition-all bg-neutral-900/60 hover:bg-red-950/30 hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
          >
            ✕ Close
          </SoundBtn>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800/70 bg-black/40">
          {settingsTabs.map(tab => (
            <SoundBtn
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 flex flex-col items-center gap-1.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'text-red-400 border-red-500 bg-red-950/15 shadow-[inset_0_-2px_10px_rgba(220,38,38,0.1)]'
                  : 'text-neutral-500 border-transparent hover:text-neutral-200 hover:bg-neutral-900/40 hover:border-neutral-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </SoundBtn>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6 scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-red-900/60">

          {/* ── AUDIO ── */}
          {activeTab === 'audio' && (
            <>
              <SectionHeader icon={<Volume2 size={15} />} label="Audio Levels" />
              <SettingsSlider label="Master Volume" icon={<Volume2 size={14} />} value={masterVol} min={0} max={100} unit="%" onChange={handleMasterVolChange} hint="Overall game output level" />
              <SettingsSlider label="Sound FX" icon={<Zap size={14} />} value={sfxVol} min={0} max={100} unit="%" color="yellow" onChange={handleSFXVolChange} hint="Gunshots, impacts, and UI feedback" />
              <SettingsSlider label="Ambient Score" icon={<Volume2 size={14} />} value={musicVol} min={0} max={100} unit="%" color="blue" onChange={handleMusicVolChange} hint="Background horror drone volume" />
              <div className="mt-2 p-4 bg-red-950/15 border border-red-900/25 rounded-lg flex items-start gap-3">
                <span className="text-red-400 mt-0.5"><Volume2 size={14} /></span>
                <p className="text-xs text-neutral-300 uppercase tracking-wide leading-relaxed">
                  Audio changes apply <strong className="text-red-400">instantly</strong> — no need to save separately.
                </p>
              </div>
            </>
          )}

          {/* ── CONTROLS ── */}
          {activeTab === 'controls' && (
            <>
              <SectionHeader icon={<MousePointer size={15} />} label="Mouse & Camera" />
              <SettingsSlider label="Look Sensitivity"     icon={<MousePointer size={14} />} value={sensitivity}    min={5}  max={100} onChange={handleSensChange}       hint="FPS mouse look speed" />
              <SettingsSlider label="ADS Zoom Sensitivity" icon={<Eye          size={14} />} value={zoomSensitivity} min={30} max={120} unit="%" color="yellow" onChange={handleZoomSensChange}  hint="Multiplier when aiming down sights [R-Click]" />
              <SettingsSlider label="Camera Smoothing"     icon={<SlidersHorizontal size={14} />} value={lookSmoothing} min={0} max={80} unit="%" color="blue" onChange={handleLookSmoothChange} hint="Motion inertia for smooth panning" />
              <SettingsSlider label="Field of View"        icon={<Eye          size={14} />} value={fov}            min={60} max={110} unit="°" onChange={handleFovChange}        hint="Higher values widen peripheral vision" />

              <SectionHeader icon={<Gamepad2 size={15} />} label="Key Bindings" />
              {[
                ['Move',      'W A S D'],
                ['Sprint',    'L-SHIFT'],
                ['ADS',       'R-CLICK'],
                ['Fire',      'L-CLICK'],
                ['Reload',    'R'],
                ['Interact',  'E'],
                ['Pause',     'ESC'],
              ].map(([action, key]) => (
                <div key={action} className="flex items-center justify-between py-2 border-t border-neutral-800/50 first:border-0">
                  <span className="text-sm font-bold text-neutral-300 uppercase tracking-widest">{action}</span>
                  <kbd className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-xs font-black text-yellow-300 tracking-wider">{key}</kbd>
                </div>
              ))}
            </>
          )}

          {/* ── DISPLAY ── */}
          {activeTab === 'display' && (
            <>
              <SectionHeader icon={<Tv size={15} />} label="Display & Visual" />

              <div className="space-y-2.5">
                <label className="text-sm font-bold text-white uppercase tracking-widest block">Graphics Preset</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['low', 'medium', 'high'] as const).map(q => (
                    <SoundBtn
                      key={q}
                      onClick={() => handleGraphicsChange(q)}
                      className={`py-4 text-xs font-black uppercase tracking-widest rounded-lg border-2 transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        graphicsQuality === q
                          ? 'border-red-500 bg-red-950/30 text-red-300 shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                          : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800/40'
                      }`}
                    >
                      <span className="text-lg">{q === 'low' ? '🔋' : q === 'medium' ? '⚡' : '🔥'}</span>
                      {q === 'low' ? 'Low' : q === 'medium' ? 'Medium' : 'High'}
                    </SoundBtn>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Low disables shadow and particle effects for better performance</p>
              </div>

              <SettingsSlider label="Field of View" icon={<Eye size={14} />} value={fov} min={60} max={110} unit="°" color="blue" onChange={handleFovChange} hint="Widen or narrow your view angle" />
              <SettingsSlider label="Vignette Intensity" icon={<Eye size={14} />} value={vignetteOpacity} min={0} max={100} unit="%" onChange={handleVigChange} hint="Edge darkening effect" />

              <SectionHeader icon={<Tv size={15} />} label="Post Processing" />
              <SettingsToggle label="CRT Scanline Effect"   description="Retro monitor overlay across the viewport"  checked={crtEffect}   onChange={handleCrtChange} />
              <SettingsToggle label="Show FPS Counter"      description="Display frame rate in the top-left corner"  checked={showFps}     onChange={v => { sound.playClick(); setShowFps(v); }} />
            </>
          )}

          {/* ── GAMEPLAY ── */}
          {activeTab === 'gameplay' && (
            <>
              <SectionHeader icon={<Gamepad2 size={15} />} label="Gameplay Preferences" />

              <div className="space-y-2.5">
                <label className="text-sm font-bold text-white uppercase tracking-widest block flex items-center gap-2">
                  <Crosshair size={14} className="text-red-400" /> Crosshair Color
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {['#22c55e','#ef4444','#3b82f6','#f59e0b','#a855f7','#ffffff','#f97316'].map(c => (
                    <button
                      key={c}
                      onClick={() => { sound.playClick(); handleXhairChange(c); }}
                      onMouseEnter={() => sound.playHover()}
                      style={{ backgroundColor: c }}
                      className={`w-9 h-9 rounded-full border-4 transition-all cursor-pointer hover:scale-110 ${crosshairColor === c ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] scale-110' : 'border-neutral-700'}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={crosshairColor}
                    onChange={e => { sound.playClick(); handleXhairChange(e.target.value); }}
                    className="w-9 h-9 rounded-full border-2 border-neutral-700 cursor-pointer bg-transparent"
                    title="Custom color"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 uppercase tracking-wider">
                  Current: <span className="font-black" style={{ color: crosshairColor }}>{crosshairColor.toUpperCase()}</span>
                </p>
              </div>

              <SettingsSlider label="Weapon Sway" icon={<SlidersHorizontal size={14} />} value={weaponSway} min={0} max={100} unit="%" color="yellow" onChange={handleSwayChange} hint="Idle and movement bob intensity" />

              <SectionHeader icon={<Shield size={15} />} label="HUD Options" />
              <SettingsToggle label="Damage Numbers"   description="Show floating damage indicators above enemies" checked={showDmgNumbers} onChange={handleDmgNumsChange} />
              <SettingsToggle label="Blood Screen"     description="Red overlay flash when taking damage"         checked={bloodScreen}    onChange={handleBloodChange} />
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800/70 bg-black/50 flex items-center justify-between">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider">All changes save automatically</p>
          <SoundBtn
            onClick={() => setShowSettings(false)}
            className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-lg border border-red-500 transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] cursor-pointer"
          >
            ✓ Done
          </SoundBtn>
        </div>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN MENU
  // ──────────────────────────────────────────────────────────────────────────
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-neutral-950 overflow-hidden select-none">

        {/* Atmospheric background grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(220,38,38,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.8) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
        {/* Radial red glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(120,0,0,0.35)_0%,transparent_65%)]" />
        {/* Bottom fog */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />

        {showSettings && <SettingsPanel />}

        {menuView === 'main' && (
          <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6 gap-0">

            {/* ── Title block ── */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-red-700" />
                <Skull className="text-red-600 opacity-70" size={18} />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-red-700" />
              </div>
              <h1
                className="text-7xl font-black uppercase text-white tracking-[-0.02em] leading-none"
                style={{ textShadow: '0 0 40px rgba(220,38,38,0.8), 0 0 80px rgba(220,38,38,0.3), 0 4px 0 #7f1d1d' }}
              >
                DEAD
                <span className="text-red-500" style={{ textShadow: '0 0 30px rgba(239,68,68,1)' }}>BELL</span>
              </h1>
              <p className="text-[11px] font-black text-red-400/70 uppercase tracking-[0.4em] mt-2">Survive The Dead</p>
            </div>

            {/* ── Menu buttons ── */}
            <div className="w-full flex flex-col gap-3">

              <SoundBtn
                onClick={() => { onStartGame(); }}
                className="group relative w-full py-4 bg-red-700 hover:bg-red-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-red-500 transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.6),0_0_60px_rgba(220,38,38,0.2)] overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-400/10 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative flex items-center justify-center gap-2.5">
                  <Play size={16} /> Play Solo
                </span>
              </SoundBtn>

              <SoundBtn
                onClick={() => { setMenuView('multiplayer'); }}
                className="group relative w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-neutral-700 hover:border-red-800/60 transition-all hover:shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden"
              >
                <span className="relative flex items-center justify-center gap-2.5">
                  <Users size={16} className="text-red-400" /> Co-op Online
                </span>
              </SoundBtn>

              <SoundBtn
                onClick={() => setShowSettings(true)}
                className="w-full py-4 bg-neutral-900/60 hover:bg-neutral-800/80 text-neutral-300 hover:text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-neutral-800 hover:border-neutral-600 transition-all cursor-pointer flex items-center justify-center gap-2.5"
              >
                <Settings size={16} className="text-neutral-500" /> Settings
              </SoundBtn>
            </div>

            {/* ── Co-op toggle ── */}
            <div className="mt-5 w-full flex items-center justify-between px-4 py-3.5 bg-neutral-900/60 rounded-xl border border-neutral-800/70">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-widest block">Co-op Bots</span>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">AI teammate assist</span>
              </div>
              <button
                onClick={() => { sound.playClick(); setIsCoop(!isCoop); }}
                onMouseEnter={() => sound.playHover()}
                className={`relative w-14 h-7 rounded-full border-2 transition-all duration-300 cursor-pointer ${
                  isCoop ? 'bg-red-700 border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.4)]' : 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ${isCoop ? 'left-[30px] bg-white' : 'left-0.5 bg-neutral-600'}`} />
              </button>
            </div>

            {/* ── Version ── */}
            <p className="mt-8 text-[10px] text-neutral-700 uppercase tracking-[0.3em] font-bold">v0.1 — Alpha Build</p>
          </div>
        )}

        {/* ── Multiplayer View ── */}
        {menuView === 'multiplayer' && (
          <div className="relative z-10 w-full max-w-lg px-6 flex flex-col gap-0">

            {/* Back */}
            <SoundBtn
              onClick={() => setMenuView('main')}
              className="flex items-center gap-2 text-xs font-black text-neutral-400 hover:text-white uppercase tracking-widest mb-6 cursor-pointer transition-colors w-fit"
            >
              <ChevronLeft size={14} /> Back
            </SoundBtn>

            <div className="bg-[#0a0a0c] border border-red-900/30 rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] relative">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />

              <div className="px-6 py-5 border-b border-neutral-800/60 bg-red-950/10">
                <h2 className="text-lg font-black text-white uppercase tracking-[0.15em] flex items-center gap-2.5">
                  <Users size={18} className="text-red-400" /> Online Co-op
                </h2>
                <p className="text-[11px] text-neutral-400 uppercase tracking-wider mt-0.5">Real-time multiplayer matchmaking</p>
              </div>

              <div className="px-6 py-5 space-y-5">

                {/* Player name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-white uppercase tracking-widest block">Callsign</label>
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value.slice(0, 20).toUpperCase())}
                    onFocus={() => sound.playHover()}
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-red-700 text-white font-black text-sm uppercase tracking-widest rounded-lg px-4 py-3 outline-none transition-all placeholder-neutral-600"
                    placeholder="ENTER NAME…"
                    maxLength={20}
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-white uppercase tracking-widest block">Player Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {colorPresets.map(c => (
                      <button
                        key={c.value}
                        onClick={() => { sound.playClick(); setPlayerColor(c.value); }}
                        onMouseEnter={() => sound.playHover()}
                        style={{ backgroundColor: hexNumToCSS(c.value) }}
                        className={`w-9 h-9 rounded-full border-4 transition-all cursor-pointer hover:scale-110 ${playerColor === c.value ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-neutral-700'}`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Room code */}
                {roomId && (
                  <div className="flex items-center gap-3 p-3.5 bg-red-950/20 border border-red-900/40 rounded-lg">
                    <div className="flex-1">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Room Code</p>
                      <p className="text-lg font-black text-red-400 tracking-widest">{roomId}</p>
                    </div>
                    <SoundBtn
                      onClick={() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-black text-neutral-300 hover:text-white uppercase tracking-wider border border-neutral-700 cursor-pointer transition-all"
                    >
                      {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
                    </SoundBtn>
                  </div>
                )}

                {/* Join / Host */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      value={roomInput}
                      onChange={e => setRoomInput(e.target.value.toUpperCase())}
                      onFocus={() => sound.playHover()}
                      placeholder="ROOM CODE…"
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-red-700 text-white font-black text-sm uppercase tracking-widest rounded-lg px-4 py-3 outline-none transition-all placeholder-neutral-600"
                    />
                  </div>
                  <SoundBtn
                    onClick={() => {
                      if (!roomInput.trim()) { setRoomError('Enter a room code'); return; }
                      setRoomError(null);
                      connectAndJoinLobby(roomInput.trim());
                    }}
                    className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 text-white font-black text-xs uppercase tracking-wider rounded-lg cursor-pointer transition-all"
                  >
                    Join
                  </SoundBtn>
                </div>

                {roomError && <p className="text-xs text-red-400 font-black uppercase tracking-widest">{roomError}</p>}

                <SoundBtn
                  onClick={hostNewLobby}
                  className="group w-full py-4 bg-red-700 hover:bg-red-600 text-white font-black text-sm uppercase tracking-[0.15em] rounded-xl border border-red-500 transition-all hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Users size={16} /> Host New Lobby
                </SoundBtn>

                {/* Players in room */}
                {roomState && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Players in Room ({Object.keys(roomState.players || {}).length}/4)</p>
                    <div className="space-y-1.5">
                      {Object.entries(roomState.players || {}).map(([pid, p]: any) => (
                        <div key={pid} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800/60">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hexNumToCSS(p.color || 0xf97316), boxShadow: `0 0 8px ${hexNumToCSS(p.color || 0xf97316)}60` }} />
                          <span className="text-sm font-black text-white uppercase tracking-wider flex-1">{p.name || 'SURVIVOR'}</span>
                          {pid === roomState.hostId && <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wider">HOST</span>}
                          {pid === clientId && <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">YOU</span>}
                        </div>
                      ))}
                    </div>
                    {roomState.hostId === clientId && (
                      <SoundBtn
                        onClick={triggerStartMatch}
                        disabled={Object.keys(roomState.players || {}).length < 1}
                        className="w-full py-3.5 bg-green-800 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-[0.15em] rounded-xl border border-green-600 transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play size={15} /> Start Match
                      </SoundBtn>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (gameState === 'loading') {
    return (
      <div className="absolute inset-0 bg-black flex flex-col items-center justify-center select-none pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(80,0,0,0.4)_0%,transparent_70%)]" />

        <div className="text-center z-10 px-8 max-w-lg">
          <h2
            className="text-6xl font-black text-white uppercase tracking-tight mb-2"
            style={{ textShadow: '0 0 30px rgba(220,38,38,0.7)' }}
          >
            DEAD<span className="text-red-500">BELL</span>
          </h2>
          <p className="text-xs font-black text-red-400/60 uppercase tracking-[0.4em] mb-12">Loading…</p>

          {/* Animated loading bar */}
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-10">
            <div className="h-full bg-gradient-to-r from-red-800 via-red-500 to-red-800 rounded-full animate-pulse"
              style={{ width: '100%', animation: 'loadbar 3.2s ease-in-out forwards' }}
            />
          </div>

          {/* Tip */}
          <div className="p-5 bg-red-950/20 border border-red-900/30 rounded-xl">
            <p className="text-[10px] font-black text-red-400/60 uppercase tracking-widest mb-2">Survival Tip</p>
            <p className="text-sm font-bold text-neutral-200 uppercase tracking-wider leading-relaxed">{currentTip}</p>
          </div>
        </div>

        <style>{`@keyframes loadbar { 0%{width:5%} 100%{width:100%} }`}</style>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GAME OVER SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/92 backdrop-blur-sm select-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(100,0,0,0.5)_0%,transparent_60%)]" />

        <div className="relative z-10 text-center px-6 w-full max-w-sm">
          <Skull className="text-red-600 mx-auto mb-4 opacity-80" size={52} style={{ filter: 'drop-shadow(0 0 20px rgba(220,38,38,0.8))' }} />
          <h2
            className="text-5xl font-black text-red-500 uppercase tracking-tight mb-1"
            style={{ textShadow: '0 0 40px rgba(220,38,38,0.9), 0 0 80px rgba(220,38,38,0.3)' }}
          >
            You Died
          </h2>
          <p className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em] mb-8">The dead have claimed you</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Round',  value: currentRound },
              { label: 'Kills',  value: kills },
              { label: 'Points', value: points },
            ].map(s => (
              <div key={s.label} className="bg-neutral-900/70 border border-neutral-800 rounded-xl py-4 px-2">
                <p className="text-xl font-black text-white">{s.value.toLocaleString()}</p>
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <SoundBtn
              onClick={onRestartGame}
              className="group w-full py-4 bg-red-700 hover:bg-red-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-red-500 transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] cursor-pointer flex items-center justify-center gap-2.5"
            >
              <RefreshCw size={16} /> Play Again
            </SoundBtn>
            <SoundBtn
              onClick={() => setGameState('menu')}
              className="w-full py-3.5 bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-neutral-800 hover:border-neutral-600 transition-all cursor-pointer"
            >
              Main Menu
            </SoundBtn>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PAUSE MENU
  // ──────────────────────────────────────────────────────────────────────────
  if (gameState === 'paused') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/85 backdrop-blur-sm select-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(60,0,0,0.4)_0%,transparent_60%)]" />
        {showSettings && <SettingsPanel />}

        <div className="relative z-10 w-full max-w-xs px-4 flex flex-col gap-0">

          {/* Header */}
          <div className="text-center mb-7">
            <h2
              className="text-4xl font-black text-white uppercase tracking-[0.1em]"
              style={{ textShadow: '0 0 20px rgba(220,38,38,0.5)' }}
            >
              Paused
            </h2>
            <p className="text-[10px] font-black text-red-400/60 uppercase tracking-[0.35em] mt-1">Round {currentRound} · {kills} Kills</p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <SoundBtn
              onClick={() => {
                const el = document.getElementById('fps-canvas-container');
                el?.requestPointerLock();
              }}
              className="group w-full py-4 bg-red-700 hover:bg-red-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-red-500 transition-all hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] cursor-pointer flex items-center justify-center gap-2.5"
            >
              <Play size={16} /> Resume
            </SoundBtn>

            <SoundBtn
              onClick={() => setShowSettings(true)}
              className="w-full py-4 bg-neutral-900/70 hover:bg-neutral-800 text-neutral-200 hover:text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-neutral-800 hover:border-neutral-600 transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <Settings size={16} className="text-neutral-500" /> Settings
            </SoundBtn>

            <SoundBtn
              onClick={onRestartGame}
              className="w-full py-4 bg-neutral-900/70 hover:bg-neutral-800 text-neutral-200 hover:text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl border border-neutral-800 hover:border-neutral-600 transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <RefreshCw size={16} className="text-neutral-500" /> Restart Round
            </SoundBtn>

            <SoundBtn
              onClick={() => setGameState('menu')}
              className="w-full py-3.5 bg-transparent hover:bg-red-950/20 text-neutral-500 hover:text-red-400 font-black text-xs uppercase tracking-[0.2em] rounded-xl border border-neutral-800/60 hover:border-red-900/50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut size={14} /> Quit to Menu
            </SoundBtn>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { label: 'HP',     value: `${health}/${maxHealth}`, color: isLowHealth ? 'text-red-400' : 'text-green-400' },
              { label: 'Points', value: points.toLocaleString(),  color: 'text-yellow-400' },
              { label: 'Kills',  value: kills,                    color: 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-neutral-900/60 border border-neutral-800/70 rounded-xl py-3 px-2 text-center">
                <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[10px] text-center text-neutral-700 uppercase tracking-widest font-bold">Press ESC to resume</p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IN-GAME HUD (playing state)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none">

      {/* FPS Counter */}
      {showFps && (
        <div className="absolute top-3 left-3 z-50">
          <span className={`text-[11px] font-black font-mono uppercase tracking-widest px-2 py-1 rounded bg-black/70 border border-neutral-800/60 ${fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {fps} FPS
          </span>
        </div>
      )}

      {/* Wave Banner */}
      {showWaveBanner && (
        <div className="absolute inset-x-0 top-1/4 flex flex-col items-center z-40 pointer-events-none">
          <div className="px-8 py-4 bg-black/90 border border-red-700/60 rounded-2xl text-center shadow-[0_0_40px_rgba(220,38,38,0.4)] backdrop-blur-sm">
            <p className="text-[10px] font-black text-red-400/70 uppercase tracking-[0.4em] mb-0.5">Incoming</p>
            <p className="text-3xl font-black text-white uppercase tracking-[0.15em]" style={{ textShadow: '0 0 20px rgba(220,38,38,0.8)' }}>
              Round {currentRound}
            </p>
          </div>
        </div>
      )}

      {/* Interact message */}
      {interactMessage && (
        <div className="absolute inset-x-0 bottom-1/3 flex justify-center z-40">
          <div className="px-5 py-3 bg-black/85 border border-neutral-700/70 rounded-xl text-center backdrop-blur-sm">
            <p className="text-sm font-black text-white uppercase tracking-widest">{interactMessage}</p>
          </div>
        </div>
      )}

      {/* Hitmarker */}
      {hitmarker && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className={`w-5 h-5 relative ${hitmarker === 'kill' ? 'text-red-500' : 'text-white'}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Crosshair size={hitmarker === 'kill' ? 20 : 16} className={hitmarker === 'kill' ? 'text-red-500' : 'text-white'} />
            </div>
          </div>
        </div>
      )}

      {/* Damage flash overlay */}
      {damageFlash > 0 && bloodScreen && (
        <div className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(200,0,0,${damageFlash * 0.6}) 100%)`,
            boxShadow: `inset 0 0 120px rgba(200,0,0,${damageFlash})`,
          }}
        />
      )}

      {/* Low health pulse */}
      {isLowHealth && (
        <div className="absolute inset-0 z-20 pointer-events-none animate-pulse"
          style={{ boxShadow: 'inset 0 0 100px rgba(220,38,38,0.3)' }}
        />
      )}

      {/* Score popups */}
      <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-1 z-30 pointer-events-none">
        {scorePopups.map(p => (
          <div key={p.id} className="flex flex-col items-center animate-bounce">
            <span className="text-xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">+{p.amount}</span>
            <span className="text-[10px] font-black text-yellow-300/80 uppercase tracking-widest">{p.text}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom HUD ── */}
      <div className="absolute bottom-0 inset-x-0 px-5 pb-4 flex items-end justify-between z-30">

        {/* Health */}
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <div className="flex items-center gap-2">
            <Shield size={13} className={isLowHealth ? 'text-red-500 animate-pulse' : 'text-green-400'} />
            <span className={`text-xs font-black uppercase tracking-widest ${isLowHealth ? 'text-red-400 animate-pulse' : 'text-neutral-300'}`}>Health</span>
            <span className={`text-sm font-black font-mono ml-auto ${isLowHealth ? 'text-red-400' : 'text-green-400'}`}>{health}</span>
          </div>
          <div className="w-40 h-2 bg-neutral-800/80 rounded-full overflow-hidden border border-neutral-700/40">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isLowHealth ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]' : 'bg-green-500'}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>

        {/* Points + Round center */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-2xl font-black text-yellow-400 font-mono" style={{ textShadow: '0 0 10px rgba(250,204,21,0.5)' }}>
            {points.toLocaleString()}
          </p>
          <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Points</p>
          <div className="px-3 py-1 bg-red-950/40 border border-red-900/40 rounded-lg mt-0.5">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Round {currentRound}</p>
          </div>
        </div>

        {/* Ammo */}
        <div className="flex flex-col items-end gap-1.5">
          {isReloading ? (
            <p className="text-sm font-black text-yellow-400 uppercase tracking-widest animate-pulse">Reloading…</p>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white font-mono" style={{ textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>{ammoClip}</span>
              <span className="text-lg font-black text-neutral-600 font-mono">/</span>
              <span className="text-lg font-black text-neutral-400 font-mono">{ammoReserve}</span>
            </div>
          )}
          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{activeWeaponId.replace('_', ' ').toUpperCase()}</p>
        </div>
      </div>

      {/* Teammate panels */}
      {isCoop && teammates.length > 0 && (
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
          {teammates.map(tm => (
            <div key={tm.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-black/75 border border-neutral-800/70 rounded-xl backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hexNumToCSS(tm.color || 0xf97316) }} />
              <div className="flex flex-col gap-1 min-w-[90px]">
                <span className="text-[10px] font-black text-white uppercase tracking-wider">{tm.name}</span>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(tm.health / (tm.maxHealth || 100)) * 100}%` }} />
                </div>
              </div>
              <span className="text-xs font-black text-neutral-400">{tm.health}</span>
              {tm.isDown && <span className="text-[9px] font-black text-red-400 uppercase animate-pulse">DOWN</span>}
            </div>
          ))}
        </div>
      )}

      {/* Revive progress */}
      {playerReviveProgress >= 0 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-40 pointer-events-none">
          <p className="text-sm font-black text-white uppercase tracking-widest">Reviving {revivingName}…</p>
          <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${playerReviveProgress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Teammate reviving you */}
      {teammateReviveProgress >= 0 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-40 pointer-events-none">
          <p className="text-sm font-black text-green-400 uppercase tracking-widest animate-pulse">Being Revived…</p>
          <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden border border-green-900">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${teammateReviveProgress * 100}%` }} />
          </div>
        </div>
      )}

    </div>
  );
};
