import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Shield, Settings, Play, RefreshCw, Eye, MousePointer, Users, Skull, Zap, Monitor, Gamepad2, X, ChevronLeft, Wifi } from 'lucide-react';
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
  chatLog: Array<{ sender: string, text: string, timestamp: number }>;
}

// Reusable styled slider
const SettingSlider = ({ label, icon, value, min, max, unit = '', color = 'red', onChange }: {
  label: string; icon?: React.ReactNode; value: number; min: number; max: number;
  unit?: string; color?: string; onChange: (v: number) => void;
}) => {
  const accentMap: Record<string, string> = {
    red: 'accent-red-500', yellow: 'accent-yellow-500', green: 'accent-green-500', blue: 'accent-blue-500',
  };
  const valMap: Record<string, string> = {
    red: 'text-red-400', yellow: 'text-yellow-400', green: 'text-green-400', blue: 'text-blue-400',
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          {icon && <span className="text-neutral-400">{icon}</span>}
          {label}
        </label>
        <span className={`text-sm font-black font-mono ${valMap[color] || 'text-red-400'} min-w-[3rem] text-right`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-neutral-800 ${accentMap[color] || 'accent-red-500'}`}
      />
      <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
};

// Toggle switch
const SettingToggle = ({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800/50 last:border-0">
    <div>
      <div className="text-sm font-semibold text-neutral-200">{label}</div>
      {description && <div className="text-xs text-neutral-500 mt-0.5">{description}</div>}
    </div>
    <button
      onClick={() => { sound.playClick(); onChange(!checked); }}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 cursor-pointer border-2 ${
        checked ? 'bg-red-600 border-red-500' : 'bg-neutral-800 border-neutral-700'
      }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
        checked ? 'left-[1.375rem]' : 'left-0.5'
      }`} />
    </button>
  </div>
);

export const HUD: React.FC<HUDProps> = ({
  health, maxHealth, points, kills, currentRound,
  activeWeaponId, ammoClip, ammoReserve, isADS, isReloading,
  hitmarker, interactMessage, gameState, setGameState,
  onStartGame, onRestartGame, scorePopups, showWaveBanner, hasFastHands,
  isCoop, setIsCoop, teammates, playerReviveProgress, teammateReviveProgress, revivingName,
  socket, roomId, roomState, clientId, playerName, setPlayerName,
  playerColor, setPlayerColor, connectAndJoinLobby, hostNewLobby,
  sendChatMessage, triggerStartMatch, chatLog
}) => {

  const [showSettings, setShowSettings] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'multiplayer'>('main');
  const [pauseMenuSubView, setPauseMenuSubView] = useState<'main' | 'settings' | 'controls'>('main');
  const [activeTab, setActiveTab] = useState<'audio' | 'controls' | 'graphics' | 'gameplay'>('audio');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fps, setFps] = useState(60);
  const joinInputRef = useRef<HTMLInputElement>(null);

  const survivalTips = [
    "AIM DOWN SIGHTS [RIGHT CLICK] TO TIGHTEN THE SHOTGUN PELLET CONE.",
    "WHEN A TEAMMATE IS DOWNED, RUN NEXT TO THEM AND HOLD [E] TO REVIVE.",
    "ZOMBIES SPAWN FASTER EACH ROUND — BUY AMMO BETWEEN WAVES.",
    "BOT TEAMMATES AUTO-ACCUMULATE POINTS AND BUY SHOTGUNS OVER TIME.",
    "HEALTH REGENERATES AFTER 4.5 SECONDS WITH NO MELEE DAMAGE TAKEN.",
    "HEADSHOTS DEAL 2× DAMAGE AND GRANT BONUS SCORE PER KILL."
  ];
  const [currentTip, setCurrentTip] = useState(survivalTips[0]);

  useEffect(() => { if (gameState === 'paused') setPauseMenuSubView('main'); }, [gameState]);

  useEffect(() => {
    let lastTime = performance.now(), frames = 0;
    let animId: number;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) { setFps(Math.round((frames * 1000) / (now - lastTime))); frames = 0; lastTime = now; }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (gameState === 'loading') setCurrentTip(survivalTips[Math.floor(Math.random() * survivalTips.length)]);
  }, [gameState]);

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
        if (p.audio) { setMasterVol(p.audio.master ?? 50); setSFXVol(p.audio.sfx ?? 60); setMusicVol(p.audio.music ?? 35); sound.setMasterVolume((p.audio.master ?? 50) / 100); sound.setSFXVolume((p.audio.sfx ?? 60) / 100); sound.setMusicVolume((p.audio.music ?? 35) / 100); }
        else { sound.setMasterVolume(0.5); sound.setSFXVolume(0.6); sound.setMusicVolume(0.35); }
        if (p.controls) { setSensitivity(p.controls.sensitivity ?? 35); setZoomSensitivity(p.controls.zoomSensitivity ?? 75); setLookSmoothing(p.controls.lookSmoothing ?? 30); }
        if (p.graphics) { setFov(p.graphics.fov ?? 75); setGraphicsQuality(p.graphics.quality ?? 'high'); setCrtEffect(p.graphics.crtEffect ?? true); setVignetteOpacity(p.graphics.vignetteOpacity ?? 45); }
        if (p.gameplay) { setCrosshairColor(p.gameplay.crosshairColor ?? '#22c55e'); setShowDmgNumbers(p.gameplay.damageNumbers ?? true); setBloodScreen(p.gameplay.bloodScreen ?? true); setWeaponSway(p.gameplay.weaponSway ?? 100); }
      } catch (e) {}
    } else { sound.setMasterVolume(0.5); sound.setSFXVolume(0.6); sound.setMusicVolume(0.35); }
  }, []);

  const save = (section: string, key: string, value: any) => {
    const raw = localStorage.getItem('codz_settings');
    let data: any = {};
    try { if (raw) data = JSON.parse(raw); } catch (e) {}
    if (!data[section]) data[section] = {};
    data[section][key] = value;
    localStorage.setItem('codz_settings', JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('settings-update', { detail: data }));
  };

  const handleMasterVolChange = (v: number) => { setMasterVol(v); sound.setMasterVolume(v / 100); save('audio', 'master', v); };
  const handleSFXVolChange = (v: number) => { setSFXVol(v); sound.setSFXVolume(v / 100); save('audio', 'sfx', v); };
  const handleMusicVolChange = (v: number) => { setMusicVol(v); sound.setMusicVolume(v / 100); save('audio', 'music', v); };
  const handleSensChange = (v: number) => { setSensitivity(v); save('controls', 'sensitivity', v); };
  const handleZoomSensChange = (v: number) => { setZoomSensitivity(v); save('controls', 'zoomSensitivity', v); };
  const handleLookSmoothingChange = (v: number) => { setLookSmoothing(v); save('controls', 'lookSmoothing', v); };
  const handleFovChange = (v: number) => { setFov(v); save('graphics', 'fov', v); };
  const handleGraphicsQualityChange = (v: 'low' | 'medium' | 'high') => { setGraphicsQuality(v); save('graphics', 'quality', v); };
  const handleCrtEffectChange = (v: boolean) => { setCrtEffect(v); save('graphics', 'crtEffect', v); };
  const handleVignetteOpacityChange = (v: number) => { setVignetteOpacity(v); save('graphics', 'vignetteOpacity', v); };
  const handleCrosshairColorChange = (v: string) => { setCrosshairColor(v); save('gameplay', 'crosshairColor', v); };
  const handleDmgNumbersChange = (v: boolean) => { setShowDmgNumbers(v); save('gameplay', 'damageNumbers', v); };
  const handleBloodScreenChange = (v: boolean) => { setBloodScreen(v); save('gameplay', 'bloodScreen', v); };
  const handleWeaponSwayChange = (v: number) => { setWeaponSway(v); save('gameplay', 'weaponSway', v); };

  const [damageFlash, setDamageFlash] = useState(0);
  const prevHealthRef = useRef(health);
  useEffect(() => { if (health < prevHealthRef.current) setDamageFlash(0.65); prevHealthRef.current = health; }, [health]);
  useEffect(() => {
    if (damageFlash > 0) { const t = setTimeout(() => setDamageFlash(p => Math.max(0, p - 0.05)), 30); return () => clearTimeout(t); }
  }, [damageFlash]);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLowHealth = healthPercent <= 35;

  // Shared button click handler wrapper
  const btn = (fn: () => void) => () => { sound.playClick(); fn(); };

  const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#ffffff'];

  const settingsTabs = [
    { id: 'audio', label: 'Audio', icon: <Volume2 size={14} /> },
    { id: 'controls', label: 'Controls', icon: <MousePointer size={14} /> },
    { id: 'graphics', label: 'Display', icon: <Monitor size={14} /> },
    { id: 'gameplay', label: 'Gameplay', icon: <Gamepad2 size={14} /> },
  ] as const;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-sans z-50">
      <style>{`
        @keyframes flicker { 0%,100%{opacity:.15}3%{opacity:.35}6%{opacity:.12}7%{opacity:.55}9%{opacity:.15}45%{opacity:.20}46%{opacity:.05}47%{opacity:.40}70%{opacity:.18}71%{opacity:.65}72%{opacity:.22} }
        @keyframes sway { 0%,100%{transform:scale(1.02) translate(0,0) rotate(0deg)}50%{transform:scale(1.05) translate(8px,-4px) rotate(.4deg)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        .menu-bg-sway { animation: sway 18s ease-in-out infinite; }
        .anim-slide-up { animation: slideUp .35s ease forwards; }
        .anim-fade-in { animation: fadeIn .25s ease forwards; }
        input[type=range]::-webkit-slider-thumb { width:16px; height:16px; border-radius:50%; }
        .glass-panel { background: rgba(10,10,12,0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.07); }
        .glow-red { box-shadow: 0 0 20px rgba(220,38,38,0.25); }
        .btn-primary { background: linear-gradient(135deg, #dc2626, #991b1b); border: 1px solid rgba(239,68,68,0.4); transition: all .15s; }
        .btn-primary:hover { background: linear-gradient(135deg, #ef4444, #b91c1c); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(220,38,38,0.4); }
        .btn-primary:active { transform: translateY(0); }
        .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); transition: all .15s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .tab-active { background: rgba(220,38,38,0.15); border-bottom: 2px solid #ef4444; color: #fca5a5; }
        .tab-inactive { border-bottom: 2px solid transparent; color: #6b7280; }
        .tab-inactive:hover { color: #d1d5db; background: rgba(255,255,255,0.04); }
      `}</style>

      {/* ATMOSPHERE */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black opacity-45 z-0" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(0,0,0,0.85)_100%)] z-0" />

      {gameState === 'playing' && damageFlash > 0 && (
        <div className="absolute inset-0 pointer-events-none z-40 bg-red-600/35" style={{ opacity: damageFlash }} />
      )}
      {gameState === 'playing' && isLowHealth && (
        <div className="absolute inset-0 animate-pulse z-40 pointer-events-none" style={{ background: 'radial-gradient(circle,transparent 40%,rgba(185,28,28,0.7) 100%)', opacity: (1 - healthPercent / 100) * 0.9 }} />
      )}

      {/* ============================================================
          MAIN MENU
      ============================================================ */}
      {gameState === 'menu' && menuView === 'main' && (
        <div className="absolute inset-0 bg-[#060608] flex flex-col items-center justify-center pointer-events-auto z-50 overflow-hidden">
          {/* Animated bg */}
          <div className="absolute inset-0 menu-bg-sway pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#08080d] to-[#030304]" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[45%] opacity-10" style={{ backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '80px 40px', transform: 'perspective(400px) rotateX(65deg)', transformOrigin: 'bottom center' }} />
            <div className="absolute top-0 inset-x-0 h-1/2 bg-[radial-gradient(ellipse_at_top,rgba(120,10,10,0.08)_0%,transparent_60%)]" />
            {crtEffect && <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.18)_50%)] bg-[length:100%_4px] opacity-60 pointer-events-none" />}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_40%,rgba(0,0,0,0.9)_100%)]" />
            <div className="absolute inset-0 bg-black/30 animate-[flicker_8s_infinite]" />
          </div>

          <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center gap-6 anim-slide-up">
            {/* Logo block */}
            <div className="text-center">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border-2 border-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse">
                  <Skull size={18} className="text-red-400" />
                </div>
                <span className="text-xs font-black tracking-[0.5em] text-red-500 uppercase drop-shadow-[0_0_10px_rgba(220,38,38,0.6)]">CLASSROOM OUTBREAK</span>
              </div>
              <h1 className="text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-none">
                DEAD<span className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">BELL</span>
              </h1>
              <p className="text-neutral-500 text-xs tracking-[0.3em] uppercase mt-2 font-mono">WAVE SURVIVAL · DEFEND THE SCHOOL</p>
            </div>

            {/* Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={btn(() => { sound.init(); setIsCoop(false); onStartGame(); })}
                onMouseEnter={() => sound.playHover()}
                className="btn-primary w-full flex items-center justify-center gap-3 text-white font-black text-base px-6 py-4 rounded-lg cursor-pointer uppercase tracking-widest glow-red"
              >
                <Play size={18} className="fill-white" /> SOLO SURVIVAL
              </button>

              <button
                onClick={btn(() => { sound.init(); setIsCoop(true); setMenuView('multiplayer'); })}
                onMouseEnter={() => sound.playHover()}
                className="w-full flex items-center justify-center gap-3 bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 font-black text-base px-6 py-4 rounded-lg transition-all cursor-pointer uppercase tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <Users size={18} /> CO-OP LOBBY
              </button>

              <button
                onClick={btn(() => { sound.init(); setShowSettings(true); })}
                onMouseEnter={() => sound.playHover()}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-neutral-300 font-bold text-sm px-6 py-3.5 rounded-lg cursor-pointer uppercase tracking-wider"
              >
                <Settings size={16} /> SETTINGS
              </button>
            </div>

            {/* Controls bar */}
            <div className="w-full grid grid-cols-4 gap-2 glass-panel rounded-xl p-4">
              {[['WASD','Move'],['L-CLICK','Shoot'],['R-CLICK','ADS'],['E KEY','Interact/Buy']].map(([key, action]) => (
                <div key={key} className="text-center">
                  <div className="text-[10px] font-black font-mono text-neutral-400 bg-neutral-800 rounded px-2 py-1 mb-1 tracking-wider">{key}</div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider">{action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MULTIPLAYER LOBBY
      ============================================================ */}
      {gameState === 'menu' && menuView === 'multiplayer' && (
        <div className="absolute inset-0 bg-[#060608] flex flex-col pointer-events-auto z-50 overflow-y-auto">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#030304]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(6,78,59,0.12)_0%,transparent_60%)]" />
            {crtEffect && <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] opacity-50" />}
          </div>

          <main className="relative z-10 w-full max-w-md mx-auto px-5 py-8 flex flex-col gap-5 anim-slide-up">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={btn(() => { setMenuView('main'); setIsCoop(false); if (socket) socket.close(); })} onMouseEnter={() => sound.playHover()} className="btn-secondary p-2 rounded-lg cursor-pointer">
                <ChevronLeft size={18} className="text-neutral-300" />
              </button>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Wifi size={18} className="text-emerald-400" /> Online Co-op
                </h2>
                <p className="text-xs text-neutral-500 tracking-wider">Up to 4 players · Share room code to join</p>
              </div>
            </div>

            {/* Player name */}
            <div className="glass-panel rounded-xl p-4 space-y-3">
              <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">Your Callsign</label>
              <input
                type="text" maxLength={14} value={playerName}
                onChange={(e) => setPlayerName(e.target.value.replace(/[^a-zA-Z0-9_\s-]/g,'').toUpperCase())}
                onFocus={() => sound.playHover()}
                className="w-full bg-black/60 border border-neutral-700 hover:border-neutral-500 focus:border-red-500 outline-none text-white font-black font-mono text-center text-sm tracking-widest uppercase py-2.5 px-4 rounded-lg transition-all"
                placeholder="SURVIVOR_NAME"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-black text-neutral-400 uppercase tracking-widest block">Player Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={btn(() => setPlayerColor(parseInt(c.slice(1),16)))} onMouseEnter={() => sound.playHover()}
                      className="w-8 h-8 rounded-full cursor-pointer transition-all hover:scale-110 border-2"
                      style={{ backgroundColor: c, borderColor: `#${playerColor.toString(16).padStart(6,'0')}` === c ? '#fff' : 'transparent', transform: `#${playerColor.toString(16).padStart(6,'0')}` === c ? 'scale(1.15)' : '' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {roomError && (
              <div className="flex items-center gap-2 bg-red-950/50 border border-red-700/60 rounded-xl p-3 text-red-300 text-xs font-bold uppercase tracking-wider animate-pulse">
                <X size={14} className="flex-shrink-0" /> {roomError}
              </div>
            )}

            {/* Host */}
            <div className="glass-panel rounded-xl p-4 space-y-3">
              <div className="text-xs font-black text-neutral-400 uppercase tracking-widest">Host a Game</div>
              <button
                onClick={btn(() => { setRoomError(null); hostNewLobby(); })}
                onMouseEnter={() => sound.playHover()}
                className="btn-primary w-full py-3 rounded-lg text-white font-black text-sm uppercase tracking-widest cursor-pointer"
              >
                Create Room & Get Code
              </button>
              {roomId && (
                <div
                  onClick={btn(() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                  className="bg-emerald-950/30 border border-emerald-700/50 rounded-xl p-3 text-center cursor-pointer hover:border-emerald-500/70 transition-all group"
                >
                  <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">{copied ? '✓ COPIED!' : 'ROOM CODE — CLICK TO COPY'}</div>
                  <div className="text-2xl font-black font-mono text-emerald-400 tracking-[0.4em] drop-shadow-[0_0_10px_rgba(16,185,129,0.7)] group-hover:text-emerald-300 transition-all">
                    {roomId}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-1 uppercase tracking-wider font-bold">
                    {Object.keys(roomState?.players || {}).length}/4 players connected
                  </div>
                </div>
              )}
            </div>

            {/* Join */}
            <div className="glass-panel rounded-xl p-4 space-y-3">
              <div className="text-xs font-black text-neutral-400 uppercase tracking-widest">Join a Game</div>
              <div className="flex gap-2">
                <input
                  ref={joinInputRef} type="text" maxLength={12} placeholder="ENTER ROOM CODE"
                  onFocus={() => sound.playHover()}
                  className="flex-1 bg-black/60 border border-neutral-700 hover:border-neutral-500 focus:border-emerald-500 outline-none text-white font-black font-mono text-sm px-3 py-2.5 rounded-lg uppercase tracking-widest text-center transition-all"
                  onKeyDown={(e) => { if (e.key === 'Enter') { const v = joinInputRef.current?.value.trim().toUpperCase(); if (v) { sound.playClick(); setRoomError(null); connectAndJoinLobby(v); } else { setRoomError('Enter a valid room code'); } } }}
                />
                <button onClick={btn(async () => { try { const t = await navigator.clipboard.readText(); if (joinInputRef.current) joinInputRef.current.value = t.trim().toUpperCase(); } catch { setRoomError('Press Ctrl+V to paste manually'); } })} onMouseEnter={() => sound.playHover()} className="btn-secondary px-3 rounded-lg text-xs font-bold text-neutral-300 cursor-pointer uppercase tracking-wider">Paste</button>
                <button
                  onClick={btn(() => { const v = joinInputRef.current?.value.trim().toUpperCase(); if (v) { setRoomError(null); connectAndJoinLobby(v); } else { setRoomError('Enter a valid room code'); } })}
                  onMouseEnter={() => sound.playHover()}
                  className="btn-primary px-4 rounded-lg text-white font-black text-sm uppercase tracking-wider cursor-pointer"
                >Join</button>
              </div>
            </div>

            {/* Player list */}
            <div className="space-y-2">
              <div className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center justify-between">
                <span>Squad</span>
                <span className="text-emerald-400">{roomId ? `${Object.keys(roomState?.players || {}).length}/4` : '0/4'}</span>
              </div>
              <div className="space-y-1.5">
                {roomId && roomState?.players ? Object.values(roomState.players).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 glass-panel rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: `#${(p.color ?? 0xf97316).toString(16).padStart(6,'0')}` }} />
                      <span className="text-sm font-black text-white uppercase tracking-wider">{p.name} {p.id === clientId ? <span className="text-neutral-500 font-bold">(YOU)</span> : ''}</span>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider ${roomState.hostId === p.id ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {roomState.hostId === p.id ? '👑 HOST' : '✓ READY'}
                    </span>
                  </div>
                )) : (
                  <div className="flex items-center justify-between px-4 py-2.5 glass-panel rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-sm font-black text-white uppercase">{playerName || 'SURVIVOR'} <span className="text-neutral-500">(YOU)</span></span>
                    </div>
                    <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">WAITING</span>
                  </div>
                )}
              </div>
            </div>

            {/* Start / back */}
            <div className="flex flex-col gap-2 pb-4">
              {roomId ? (
                roomState?.hostId === clientId ? (
                  <button onClick={btn(triggerStartMatch)} onMouseEnter={() => sound.playHover()} className="btn-primary w-full py-4 rounded-xl text-white font-black text-base uppercase tracking-widest cursor-pointer glow-red">
                    🚀 Deploy Squad
                  </button>
                ) : (
                  <div className="w-full text-center font-mono text-xs font-bold bg-black/60 border border-neutral-800 text-neutral-500 py-3.5 px-4 rounded-xl uppercase tracking-widest animate-pulse">
                    Waiting for host to start...
                  </div>
                )
              ) : (
                <button onClick={btn(() => { setIsCoop(false); onStartGame(); })} onMouseEnter={() => sound.playHover()} className="btn-primary w-full py-4 rounded-xl text-white font-black text-base uppercase tracking-widest cursor-pointer">
                  Play Solo Instead
                </button>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ============================================================
          LOADING SCREEN
      ============================================================ */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center z-50 px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.4)_0%,#000_100%)]" />
          <div className="relative z-10 max-w-lg w-full flex flex-col items-center gap-6 anim-fade-in">
            <div className="w-16 h-16 border-4 border-neutral-800 border-t-red-500 rounded-full animate-spin shadow-[0_0_20px_rgba(220,38,38,0.4)]" />
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-widest text-white uppercase mb-1">PREPARING WAVE PROTOCOL</h2>
              <p className="text-xs font-mono text-red-500 uppercase tracking-widest">MAP: CLASSROOM OF THE UNDEAD</p>
            </div>
            <div className="w-full glass-panel rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-mono uppercase text-neutral-500 border-b border-neutral-800 pb-2">
                <span>{isCoop ? 'SQUAD SYNC...' : 'SOLO PROTOCOL'}</span>
                <span className="text-green-400 animate-pulse font-black">● LIVE</span>
              </div>
              {isCoop && roomState?.players ? Object.values(roomState.players).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-neutral-300 font-bold">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${(p.color ?? 0xf97316).toString(16).padStart(6,'0')}` }} />
                    {p.name} {p.id === clientId && '(YOU)'}
                  </span>
                  <span className="text-green-400 font-black text-xs uppercase tracking-wider">DEPLOYED</span>
                </div>
              )) : (
                <p className="text-xs text-neutral-600 italic uppercase text-center py-2">SOLO PROTOCOL ENGAGED — NO RESCUE COMING</p>
              )}
            </div>
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <div className="glass-panel rounded-xl p-4 text-center max-w-sm">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-2">COMBAT TIP</span>
              <p className="text-sm text-neutral-300 italic leading-relaxed">"{currentTip}"</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          SETTINGS PANEL
      ============================================================ */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto z-[60] px-4" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[88vh] shadow-2xl anim-slide-up border border-neutral-700/30">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/40 flex items-center justify-center">
                  <Settings size={16} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">Settings</h3>
                  <p className="text-xs text-neutral-500">Changes save automatically</p>
                </div>
              </div>
              <button onClick={btn(() => setShowSettings(false))} onMouseEnter={() => sound.playHover()} className="w-8 h-8 rounded-lg btn-secondary flex items-center justify-center cursor-pointer">
                <X size={16} className="text-neutral-300" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-800 bg-black/30">
              {settingsTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={btn(() => setActiveTab(tab.id))}
                  onMouseEnter={() => sound.playHover()}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {activeTab === 'audio' && (
                <div className="space-y-5">
                  <SettingSlider label="Master Volume" icon={<Volume2 size={14} />} value={masterVol} min={0} max={100} unit="%" color="red" onChange={handleMasterVolChange} />
                  <SettingSlider label="Sound Effects" value={sfxVol} min={0} max={100} unit="%" color="yellow" onChange={handleSFXVolChange} />
                  <SettingSlider label="Ambient Drone" value={musicVol} min={0} max={100} unit="%" color="blue" onChange={handleMusicVolChange} />
                </div>
              )}

              {activeTab === 'controls' && (
                <div className="space-y-5">
                  <SettingSlider label="Mouse Sensitivity" icon={<MousePointer size={14} />} value={sensitivity} min={5} max={100} color="red" onChange={handleSensChange} />
                  <SettingSlider label="ADS Zoom Scale" value={zoomSensitivity} min={30} max={120} unit="%" color="red" onChange={handleZoomSensChange} />
                  <SettingSlider label="Look Smoothing" value={lookSmoothing} min={0} max={80} unit="%" color="blue" onChange={handleLookSmoothingChange} />
                  <SettingSlider label="Field of View" icon={<Eye size={14} />} value={fov} min={60} max={110} unit="°" color="green" onChange={handleFovChange} />
                  {/* Keybind reference */}
                  <div className="pt-2 border-t border-neutral-800">
                    <div className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Keybinds</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[['WASD','Move'],['SHIFT','Sprint'],['SPACE','Jump'],['L-CLICK','Shoot'],['R-CLICK','ADS'],['R','Reload'],['E','Interact'],['1/2','Swap Weapon'],['ESC','Pause']].map(([k,a]) => (
                        <div key={k} className="flex items-center justify-between bg-neutral-900/60 rounded-lg px-3 py-2">
                          <span className="text-xs font-black font-mono text-neutral-300 bg-neutral-800 px-1.5 py-0.5 rounded">{k}</span>
                          <span className="text-xs text-neutral-500 uppercase tracking-wider">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'graphics' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-200 block">Graphics Preset</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low','medium','high'] as const).map(q => (
                        <button key={q} onClick={btn(() => handleGraphicsQualityChange(q))} onMouseEnter={() => sound.playHover()}
                          className={`py-2.5 px-3 text-xs font-black uppercase rounded-lg border transition-all cursor-pointer ${
                            graphicsQuality === q ? 'bg-red-900/30 border-red-500 text-red-300' : 'bg-neutral-900/40 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                          }`}
                        >{q}</button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-600">Low disables shadow maps for better performance.</p>
                  </div>
                  <SettingSlider label="Vignette Opacity" icon={<Monitor size={14} />} value={vignetteOpacity} min={0} max={90} unit="%" color="blue" onChange={handleVignetteOpacityChange} />
                  <SettingToggle label="CRT Scanline Effect" description="Retro cathode-ray tube screen overlay" checked={crtEffect} onChange={handleCrtEffectChange} />
                </div>
              )}

              {activeTab === 'gameplay' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-200 block">Crosshair Color</label>
                    <div className="flex gap-3">
                      {['#22c55e','#ffffff','#ef4444','#3b82f6','#f59e0b','#e879f9'].map(c => (
                        <button key={c} onClick={btn(() => handleCrosshairColorChange(c))} onMouseEnter={() => sound.playHover()}
                          className="w-9 h-9 rounded-full cursor-pointer transition-all hover:scale-110 border-2 shadow-lg"
                          style={{ backgroundColor: c, borderColor: crosshairColor === c ? '#fff' : 'rgba(255,255,255,0.15)', transform: crosshairColor === c ? 'scale(1.2)' : '' }}
                        />
                      ))}
                    </div>
                  </div>
                  <SettingSlider label="Weapon Sway" value={weaponSway} min={0} max={200} unit="%" color="red" onChange={handleWeaponSwayChange} />
                  <SettingToggle label="Damage Numbers" description="Show floating damage text above hit enemies" checked={showDmgNumbers} onChange={handleDmgNumbersChange} />
                  <SettingToggle label="Blood Vignette" description="Pulsing vignette effect at low health" checked={bloodScreen} onChange={handleBloodScreenChange} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-600 font-mono">All settings persist between sessions</span>
              <button onClick={btn(() => setShowSettings(false))} onMouseEnter={() => sound.playHover()} className="btn-primary px-6 py-2.5 rounded-xl text-white font-black text-sm uppercase tracking-wider cursor-pointer">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          PAUSE MENU
      ============================================================ */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-40 p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="glass-panel w-full max-w-3xl h-[80vh] max-h-[600px] rounded-2xl overflow-hidden flex border border-neutral-700/30 shadow-2xl anim-slide-up">

            {/* Left nav */}
            <div className="w-64 bg-black/50 border-r border-neutral-800 flex flex-col p-5 gap-3">
              <div className="mb-2">
                <div className="text-xs text-red-500 font-black uppercase tracking-widest mb-1">PAUSED</div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">DEAD<span className="text-red-500">BELL</span></h2>
              </div>

              {/* Stats */}
              <div className="glass-panel rounded-xl p-3 space-y-2">
                {[['WAVE', currentRound, 'text-red-400'],['KILLS', kills, 'text-white'],['CASH', `$${points}`, 'text-green-400']].map(([label, val, cls]) => (
                  <div key={label as string} className="flex justify-between items-center text-xs font-mono uppercase">
                    <span className="text-neutral-500 font-bold">{label}</span>
                    <span className={`font-black ${cls}`}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <button onClick={() => { sound.playClick(); const el = document.getElementById('fps-canvas-container'); try { const p = el?.requestPointerLock(); if (p && typeof (p as any).catch === 'function') (p as any).catch(()=>{}); } catch {} }} onMouseEnter={() => sound.playHover()}
                  className="btn-primary w-full text-left px-4 py-3 rounded-xl text-white font-black text-sm uppercase tracking-wider cursor-pointer">
                  ▶ Resume
                </button>
                {(['settings','controls'] as const).map(view => (
                  <button key={view} onClick={btn(() => setPauseMenuSubView(view))} onMouseEnter={() => sound.playHover()}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider cursor-pointer transition-all ${
                      pauseMenuSubView === view ? 'bg-neutral-800 text-red-400 border border-neutral-700' : 'btn-secondary text-neutral-400 hover:text-white'
                    }`}>
                    {view === 'settings' ? '⚙ Settings' : '🎮 Controls'}
                  </button>
                ))}
                <button onClick={btn(() => setGameState('menu'))} onMouseEnter={() => sound.playHover()}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-black text-red-600 hover:text-red-400 hover:bg-red-950/20 uppercase tracking-wider cursor-pointer transition-all mt-auto">
                  ← Main Menu
                </button>
              </div>

              <p className="text-[10px] text-neutral-600 font-mono uppercase text-center">ESC to resume</p>
            </div>

            {/* Right panel */}
            <div className="flex-1 p-6 overflow-y-auto bg-neutral-900/20">
              {pauseMenuSubView === 'main' && (
                <div className="space-y-4 anim-fade-in">
                  <h3 className="text-lg font-black text-white uppercase tracking-wider">Session Active</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    The campus is quarantined. Collect ammo, buy weapons, and survive as many waves as possible.
                    Use the navigation on the left to adjust your settings mid-game.
                  </p>
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Pro Tip</div>
                    <p className="text-sm text-neutral-300">Headshots deal 2× damage and grant bonus points. Use ADS [Right-Click] to tighten your aim.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-panel rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-red-400 font-mono">{currentRound}</div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Current Wave</div>
                    </div>
                    <div className="glass-panel rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-green-400 font-mono">{kills}</div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">Total Kills</div>
                    </div>
                  </div>
                </div>
              )}

              {pauseMenuSubView === 'settings' && (
                <div className="space-y-5 anim-fade-in">
                  <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Settings size={16} className="text-red-400" /> Settings
                  </h3>
                  <SettingSlider label="Master Volume" icon={<Volume2 size={14} />} value={masterVol} min={0} max={100} unit="%" color="red" onChange={handleMasterVolChange} />
                  <SettingSlider label="Mouse Sensitivity" icon={<MousePointer size={14} />} value={sensitivity} min={5} max={100} color="red" onChange={handleSensChange} />
                  <SettingSlider label="Field of View" icon={<Eye size={14} />} value={fov} min={60} max={110} unit="°" color="green" onChange={handleFovChange} />
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-200 block">Graphics Preset</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low','medium','high'] as const).map(q => (
                        <button key={q} onClick={btn(() => handleGraphicsQualityChange(q))} onMouseEnter={() => sound.playHover()}
                          className={`py-2 text-xs font-black uppercase rounded-lg border cursor-pointer transition-all ${
                            graphicsQuality === q ? 'bg-red-900/30 border-red-500 text-red-300' : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
                          }`}>{q}</button>
                      ))}
                    </div>
                  </div>
                  <SettingToggle label="CRT Effect" checked={crtEffect} onChange={handleCrtEffectChange} />
                </div>
              )}

              {pauseMenuSubView === 'controls' && (
                <div className="space-y-4 anim-fade-in">
                  <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield size={16} className="text-red-400" /> Controls
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[['WASD','Move'],['SHIFT','Sprint'],['SPACE','Jump'],['LEFT CLICK','Shoot'],['RIGHT CLICK','Aim Down Sights (ADS)'],['R','Reload'],['E','Interact / Buy'],['1 / 2','Swap Weapon'],['ESC','Pause Game']].map(([k,a]) => (
                      <div key={k} className="flex items-center justify-between px-4 py-2.5 glass-panel rounded-xl">
                        <span className="text-sm font-black font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">{k}</span>
                        <span className="text-sm text-neutral-400 uppercase tracking-wider">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          GAME OVER
      ============================================================ */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-50 px-4" style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-neutral-700/30 anim-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-b from-red-950/40 to-transparent p-8 text-center border-b border-neutral-800">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-950/50 border-2 border-red-700 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                <Skull size={28} className="text-red-400" />
              </div>
              <div className="text-xs font-black text-red-500 uppercase tracking-[0.4em] mb-2">Session Terminated</div>
              <h2 className="text-5xl font-black text-white uppercase tracking-tight">YOU DIED</h2>
              <p className="text-sm text-neutral-500 mt-2">Classroom Arena — Wave {currentRound}</p>
            </div>

            {/* Stats */}
            <div className="p-6 grid grid-cols-3 gap-3">
              {[['Points','$'+points,'text-green-400'],['Waves',currentRound,'text-red-400'],['Kills',kills,'text-white']].map(([label, val, cls]) => (
                <div key={label as string} className="glass-panel rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black font-mono ${cls}`}>{val}</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1 font-bold">{label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex flex-col gap-3">
              <button onClick={() => { sound.playClick(); onRestartGame(); }} onMouseEnter={() => sound.playHover()}
                className="btn-primary w-full flex items-center justify-center gap-3 text-white font-black text-base py-4 rounded-xl cursor-pointer uppercase tracking-widest glow-red">
                <RefreshCw size={18} /> Survive Again
              </button>
              <button onClick={btn(() => setGameState('menu'))} onMouseEnter={() => sound.playHover()}
                className="btn-secondary w-full py-3 rounded-xl text-neutral-300 font-black text-sm uppercase tracking-wider cursor-pointer">
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          IN-GAME HUD
      ============================================================ */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <React.Fragment>
          {/* Squad status */}
          {isCoop && teammates && teammates.length > 0 && (
            <div className="absolute top-10 left-8 flex flex-col z-40 pointer-events-none gap-2.5 text-left bg-black/55 backdrop-blur-md p-3.5 border border-neutral-900 border-l-[3px] border-l-red-600 rounded-xl shadow-2xl w-56">
              <div className="flex items-center gap-2 mb-1 border-b border-neutral-900 pb-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping inline-block" />
                <span className="text-[10px] font-black text-neutral-400 font-mono tracking-widest uppercase">SQUAD STATUS</span>
              </div>
              {teammates.map(tm => (
                <div key={tm.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2.5 rounded-sm" style={{ backgroundColor: `#${tm.color.toString(16).padStart(6,'0')}` }} />
                      {tm.name}
                    </span>
                    <span className="text-xs font-black text-green-500 font-mono">${tm.points}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${ tm.state==='DOWNED'?'bg-red-500 animate-pulse':tm.state==='DEAD'?'bg-neutral-700':'bg-neutral-200' }`}
                        style={{ width: tm.state==='DOWNED'?'100%':tm.state==='DEAD'?'0%':`${(tm.health/tm.maxHealth)*100}%` }} />
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase text-neutral-500">
                      {tm.state==='DOWNED'?<span className="text-red-500 animate-pulse">DOWN</span>:tm.state==='DEAD'?<span className="text-neutral-600">DEAD</span>:tm.activeWeapon==='shotgun'?'DB-12':'M1911'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FPS counter */}
          <div className="absolute top-10 right-8 flex flex-col items-end z-40 pointer-events-none font-mono text-xs text-neutral-400 bg-black/40 backdrop-blur-sm p-2 border border-neutral-900 rounded-lg">
            <span className="text-green-400 font-black">{fps} FPS</span>
            <span className="text-neutral-600 text-[10px]">WebGL 2.0</span>
          </div>

          {/* Revive progress */}
          {teammateReviveProgress >= 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 flex flex-col items-center gap-2 bg-black/90 border border-red-900 p-4 rounded-2xl pointer-events-none z-50 shadow-2xl">
              <span className="text-red-400 text-xs font-black font-mono tracking-widest uppercase animate-pulse">REVIVING {revivingName?.toUpperCase() || 'TEAMMATE'}...</span>
              <div className="w-52 bg-neutral-900 border border-neutral-800 h-3 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full transition-all duration-75" style={{ width: `${teammateReviveProgress}%` }} />
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">HOLD [E] TO REVIVE</span>
            </div>
          )}
          {playerReviveProgress >= 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 flex flex-col items-center gap-2 bg-black/90 border border-green-900 p-4 rounded-2xl pointer-events-none z-50 shadow-2xl">
              <span className="text-green-400 text-xs font-black font-mono tracking-widest uppercase animate-pulse">BEING REVIVED BY ALLY...</span>
              <div className="w-52 bg-neutral-900 border border-neutral-800 h-3 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-700 to-green-400 rounded-full transition-all duration-75" style={{ width: `${playerReviveProgress}%` }} />
              </div>
            </div>
          )}

          {/* Interact prompt */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40">
            {interactMessage && (
              <div className="bg-black/90 border border-neutral-700 text-white text-sm font-black font-mono px-5 py-2.5 rounded-xl shadow-lg text-center backdrop-blur-sm max-w-lg pointer-events-auto uppercase tracking-wider">
                {interactMessage}
              </div>
            )}
          </div>

          {/* Wave banner */}
          {showWaveBanner && (
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 text-center pointer-events-none">
              <h1 className="text-7xl font-black text-red-600 tracking-widest uppercase drop-shadow-[0_5px_20px_rgba(239,68,68,0.8)] font-serif animate-pulse">
                ROUND {currentRound}
              </h1>
              <p className="text-sm font-mono text-neutral-400 tracking-[0.4em] uppercase mt-2">THE HORDE HAS SPAWNED</p>
            </div>
          )}

          {/* Hitmarker */}
          {hitmarker && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none w-5 h-5">
              {[['top-0 left-0 rotate-45',''],['top-0 right-0 -rotate-45',''],['bottom-0 left-0 -rotate-45',''],['bottom-0 right-0 rotate-45','']].map(([pos],i) => (
                <div key={i} className={`absolute ${pos} w-1.5 h-[1.5px] ${hitmarker==='kill'?'bg-red-500 shadow-[0_0_6px_#ef4444]':'bg-white shadow-[0_0_4px_#fff]'}`} />
              ))}
            </div>
          )}

          {/* Crosshair */}
          {!isADS && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none w-6 h-6">
              {[['top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2.5'],['bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2.5'],['left-0 top-1/2 -translate-y-1/2 w-2.5 h-[1.5px]'],['right-0 top-1/2 -translate-y-1/2 w-2.5 h-[1.5px]']].map((cls,i) => (
                <div key={i} className={`absolute ${cls} opacity-70`} style={{ backgroundColor: crosshairColor }} />
              ))}
              <div className="absolute w-1 h-1 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: crosshairColor }} />
            </div>
          )}

          {/* Bottom-left HUD */}
          <div className="absolute bottom-8 left-8 flex flex-col z-40 pointer-events-none gap-3">
            <div className="flex items-center gap-3">
              <div className="text-red-500 font-black text-6xl font-serif drop-shadow-[0_0_15px_rgba(220,38,38,0.85)] tracking-tight">{currentRound}</div>
              <div>
                <div className="text-red-700 text-[10px] font-black tracking-[0.3em] uppercase">ROUND</div>
                <div className="text-neutral-500 text-[8px] font-mono tracking-wider uppercase">SURVIVAL WAVE</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-9 bg-green-400 shadow-[0_0_10px_#4ade80]" />
              <div>
                <div className="text-3xl font-black font-mono text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.6)] leading-none">${points}</div>
                <div className="absolute ml-0 flex flex-col gap-1 pointer-events-none" style={{ position: 'absolute', left: '5rem' }}>
                  {scorePopups.map(pop => (
                    <span key={pop.id} className={`text-xs font-black animate-bounce whitespace-nowrap ${ pop.text.includes('Headshot')?'text-yellow-400':pop.amount>0?'text-green-400':'text-red-500' }`}>{pop.text}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-56 flex flex-col gap-1">
              <div className="flex justify-end text-[10px] font-mono font-bold text-neutral-400">{health}/{maxHealth} HP</div>
              <div className="bg-black/60 border border-neutral-800 h-3 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-200 rounded-full ${ healthPercent>40?'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]':'bg-red-500 animate-pulse' }`} style={{ width: `${healthPercent}%` }} />
              </div>
            </div>
            {/* Perk badges */}
            <div className="flex gap-1.5">
              {[['HP','',''],['','',''],['','',''],['FH',hasFastHands?'border-amber-500 bg-amber-950/40 text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]':'border-neutral-800 bg-black/60 text-neutral-700 opacity-40','Fast Hands — 50% Faster Reload']].map(([label,cls,title],i) => (
                <div key={i} title={title as string} className={`w-6 h-6 rounded-full border flex items-center justify-center text-[7px] font-black font-mono transition-all ${cls || 'border-neutral-800 bg-black/60 text-neutral-700 opacity-40'}`}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-right HUD */}
          <div className="absolute bottom-8 right-8 text-right z-40 pointer-events-none flex flex-col items-end">
            <div className="mb-2 h-12 flex items-center justify-end">
              {activeWeaponId === 'pistol' ? (
                <svg width="84" height="42" viewBox="0 0 84 42" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">
                  <path d="M12 8h56v14H12z" />
                  <path d="M18 10v10M22 10v10M26 10v10M30 10v10" strokeWidth="1" opacity="0.5" />
                  <path d="M12 11H8v5h4" />
                  <path d="M38 22h30l2 6-4 12H52l-6-14H38v-4" />
                  <path d="M38 22c-8 0-8 8 0 8" />
                </svg>
              ) : activeWeaponId === 'shotgun' ? (
                <svg width="112" height="32" viewBox="0 0 112 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">
                  <path d="M4 8h76v6H4zM4 11h76" />
                  <path d="M80 8h12v10H80z" />
                  <path d="M92 10l6 8-4 10h-6l-2-10" />
                  <path d="M82 18c0 4 6 4 6 0" />
                </svg>
              ) : (
                <svg width="98" height="42" viewBox="0 0 98 42" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-100 opacity-90 drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">
                  <path d="M12 10h56v8H12z" />
                  <path d="M6 12h6v4H6z" />
                  <path d="M38 18l-3 14c-.5 2-2 3-4 3h-2" />
                  <path d="M48 18l6 10H44l-4-10" />
                  <path d="M68 12h12l10-4v14l-10-2z" fill="currentColor" fillOpacity="0.15" />
                </svg>
              )}
            </div>
            <div className="text-neutral-400 text-xs font-black uppercase tracking-[0.25em] mb-1.5 font-mono">
              {activeWeaponId==='pistol'?'M1911 PISTOL':activeWeaponId==='shotgun'?'DOUBLE BARREL':'MP5 SMG'}
            </div>
            <div className={`text-5xl font-black font-mono tracking-tight ${ isReloading?'text-red-400 animate-pulse text-xl':'text-white' }`}>
              {isReloading ? 'RELOADING...' : ammoClip}
            </div>
            {!isReloading && (
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-2xl text-neutral-600 font-mono">/</span>
                <span className="text-2xl font-black font-mono text-neutral-400">{ammoReserve}</span>
              </div>
            )}
            {!isReloading && (
              <div className="mt-2 flex justify-end gap-1">
                {Array.from({ length: activeWeaponId==='pistol'?12:6 }).map((_,i) => (
                  <div key={i} className={`w-1 h-3 rounded-sm transition-all ${ i<ammoClip?'bg-white shadow-[0_0_2px_rgba(255,255,255,0.7)]':'bg-neutral-800' }`} />
                ))}
              </div>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
};
