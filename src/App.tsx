import { useState, useCallback, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { TeammateState, WeaponId } from './types';

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'paused' | 'loading'>('menu');
  const [gameSessionId, setGameSessionId] = useState(() => Math.random().toString());
  
  // Game states managed at top level to feed the HUD in real-time
  const [health, setHealth] = useState(100);
  const [maxHealth] = useState(100);
  const [points, setPoints] = useState(500);
  const [kills, setKills] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  
  // Co-op & Real Multiplayer online states
  const [isCoop, setIsCoop] = useState<boolean>(true);
  const [teammates, setTeammates] = useState<TeammateState[]>([]);
  const [playerReviveProgress, setPlayerReviveProgress] = useState<number>(-1);
  const [teammateReviveProgress, setTeammateReviveProgress] = useState<number>(-1);
  const [revivingName, setRevivingName] = useState<string | null>(null);

  // Real WebSocket state declarations
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [roomState, setRoomState] = useState<any>(null);
  const [clientId] = useState(() => localStorage.getItem('codz_clientId') || 'usr-' + Math.random().toString(36).substr(2, 9));
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('codz_playerName') || 'SURVIVOR_' + Math.floor(Math.random() * 900 + 100));
  const [playerColor, setPlayerColor] = useState<number>(0xf97316); // Hex representations: defaults to orange
  const [chatLog, setChatLog] = useState<Array<{ sender: string, text: string, timestamp: number }>>([]);

  useEffect(() => {
    localStorage.setItem('codz_clientId', clientId);
  }, [clientId]);

  useEffect(() => {
    localStorage.setItem('codz_playerName', playerName);
  }, [playerName]);

  // Score popups feedback cascade
  const addScorePopup = useCallback((amount: number, text: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setScorePopups(prev => [...prev, { id, amount, text }]);
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== id));
    }, 1200);
  }, []);

  const handleStartGame = useCallback(() => {
    setGameState('loading');
    setGameSessionId(Math.random().toString());
    
    // Reset state parameters
    setHealth(100);
    setPoints(500);
    setKills(0);
    setCurrentRound(1);
    setActiveWeaponId('pistol');
    setAmmoClip(8);
    setAmmoReserve(64);
    setHasFastHands(false);
    setIsADS(false);
    setIsReloading(false);
    
    // Reset co-op progression vars
    setTeammates([]);
    setPlayerReviveProgress(-1);
    setTeammateReviveProgress(-1);
    setRevivingName(null);

    // Transition to active field play
    setTimeout(() => {
      setGameState('playing');
    }, 3500);
  }, []);

  const handleRestartGame = useCallback(() => {
    handleStartGame();
  }, [handleStartGame]);

  // Establish online co-op matchmaking link
  const connectAndJoinLobby = useCallback((targetRoomId: string) => {
    if (socket) {
      socket.close();
    }
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In production, use the same host (server serves both HTTP and WS).
    // In development, Vite proxies /ws -> localhost:3000 so window.location.host works correctly.
    const socketUrl = `${wsProtocol}//${window.location.host}/ws`;
    const ws = new WebSocket(socketUrl);
    
    ws.onopen = () => {
      console.log("WebSocket matchmaking connected to room:", targetRoomId);
      ws.send(JSON.stringify({
        type: 'join-room',
        roomId: targetRoomId,
        clientId,
        playerName,
        playerColor
      }));
      setSocket(ws);
      setRoomId(targetRoomId);
      setChatLog([]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room-state') {
          setRoomState(data.room);
          if (data.room.gameState === 'playing' && gameState !== 'playing') {
            handleStartGame();
          }
        } else if (data.type === 'start-match') {
          handleStartGame();
        } else if (data.type === 'chat-message') {
          setChatLog(prev => [...prev, {
            sender: data.sender,
            text: data.text,
            timestamp: data.timestamp
          }]);
        } else if (data.type === 'player-disconnected') {
          setRoomState((prev: any) => {
            if (!prev) return null;
            const updated = { ...prev.players };
            delete updated[data.clientId];
            return {
              ...prev,
              hostId: data.hostId,
              players: updated
            };
          });
        }
      } catch (err) {
        console.warn("Error parsing WS packet:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket socket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket matchmaking disconnected");
      setSocket(null);
      setRoomId('');
      setRoomState(null);
    };
  }, [socket, clientId, playerName, playerColor, gameState, handleStartGame]);

  const hostNewLobby = useCallback(() => {
    // Elegant room codes like BELL-ABCD
    const suffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    connectAndJoinLobby(`BELL-${suffix}`);
  }, [connectAndJoinLobby]);

  const sendChatMessage = useCallback((text: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat-message',
        text
      }));
    }
  }, [socket]);

  const triggerStartMatch = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'start-match'
      }));
    }
  }, [socket]);

  // WeaponId is imported from types.ts — always stays in sync with WEAPON_DEFINITIONS
  const [activeWeaponId, setActiveWeaponId] = useState<WeaponId>('pistol');
  const [ammoClip, setAmmoClip] = useState(8);
  const [ammoReserve, setAmmoReserve] = useState(64);
  const [hasFastHands, setHasFastHands] = useState(false);
  
  const [isADS, setIsADS] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  
  const [hitmarker, setHitmarker] = useState<'hit' | 'kill' | null>(null);
  const [interactMessage, setInteractMessage] = useState<string | null>(null);
  const [scorePopups, setScorePopups] = useState<Array<{ id: string; amount: number; text: string }>>([]);
  const [showWaveBanner, setShowWaveBanner] = useState(false);

  // Capture window level pointer lock changes and sync pause states
  useEffect(() => {
    const handleLockChange = () => {
      const isLocked = document.pointerLockElement === document.getElementById('fps-canvas-container');
      if (!isLocked && gameState === 'playing') {
        setGameState('paused');
      } else if (isLocked && gameState === 'paused') {
        setGameState('playing');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState === 'paused') {
        const el = document.getElementById('fps-canvas-container');
        el?.requestPointerLock();
      }
    };

    document.addEventListener('pointerlockchange', handleLockChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 flex select-none">
      
      {/* 3D WebGL Canvas Layer */}
      {gameState !== 'menu' && (
        <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto">
          <GameCanvas
            key={gameSessionId}
            gameState={gameState}
            setGameState={setGameState}
            health={health}
            setHealth={setHealth}
            points={points}
            setPoints={setPoints}
            kills={kills}
            setKills={setKills}
            currentRound={currentRound}
            setCurrentRound={setCurrentRound}
            activeWeaponId={activeWeaponId}
            setActiveWeaponId={setActiveWeaponId}
            ammoClip={ammoClip}
            setAmmoClip={setAmmoClip}
            ammoReserve={ammoReserve}
            setAmmoReserve={setAmmoReserve}
            isADS={isADS}
            setIsADS={setIsADS}
            isReloading={isReloading}
            setIsReloading={setIsReloading}
            setHitmarker={setHitmarker}
            setInteractMessage={setInteractMessage}
            addScorePopup={addScorePopup}
            setShowWaveBanner={setShowWaveBanner}
            
            // Inject Co-op parameters
            isCoop={isCoop}
            setTeammates={setTeammates}
            setPlayerReviveProgress={setPlayerReviveProgress}
            setTeammateReviveProgress={setTeammateReviveProgress}
            setRevivingName={setRevivingName}

            // Real multiplayer states
            socket={socket}
            roomId={roomId}
            roomState={roomState}
            clientId={clientId}
            hasFastHands={hasFastHands}
            setHasFastHands={setHasFastHands}
          />
        </div>
      )}

      {/* 2D HTML/CSS Core HUD Overlay & Systems Interface */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
        <HUD
          health={health}
          maxHealth={maxHealth}
          points={points}
          kills={kills}
          currentRound={currentRound}
          activeWeaponId={activeWeaponId}
          ammoClip={ammoClip}
          ammoReserve={ammoReserve}
          isADS={isADS}
          isReloading={isReloading}
          hitmarker={hitmarker}
          interactMessage={interactMessage}
          gameState={gameState}
          setGameState={setGameState}
          onStartGame={handleStartGame}
          onRestartGame={handleRestartGame}
          scorePopups={scorePopups}
          showWaveBanner={showWaveBanner}
          hasFastHands={hasFastHands}
          
          // Inject Co-op parameters
          isCoop={isCoop}
          setIsCoop={setIsCoop}
          teammates={teammates}
          playerReviveProgress={playerReviveProgress}
          teammateReviveProgress={teammateReviveProgress}
          revivingName={revivingName}

          // Real multiplayer properties & actions
          socket={socket}
          roomId={roomId}
          roomState={roomState}
          clientId={clientId}
          playerName={playerName}
          setPlayerName={setPlayerName}
          playerColor={playerColor}
          setPlayerColor={setPlayerColor}
          connectAndJoinLobby={connectAndJoinLobby}
          hostNewLobby={hostNewLobby}
          sendChatMessage={sendChatMessage}
          triggerStartMatch={triggerStartMatch}
          chatLog={chatLog}
        />
      </div>

    </div>
  );
}
