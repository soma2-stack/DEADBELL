import { PlayerModel } from './PlayerModel';
import { RoundModel, RoundPhase } from './RoundModel';
import { PowerUpModel } from './PowerUpModel';

export type GameMode = 'singleplayer' | 'multiplayer';
export type GameStatus = 'lobby' | 'in_progress' | 'game_over';

export interface GameSessionModel {
  sessionId: string;
  mode: GameMode;
  status: GameStatus;
  players: Record<string, PlayerModel>;
  round: RoundModel;
  activePowerUps: PowerUpModel[];
  highScore: number;
  createdAt: number;
  updatedAt: number;
}

export function createGameSession(
  sessionId: string,
  mode: GameMode,
  hostPlayer: PlayerModel
): GameSessionModel {
  return {
    sessionId,
    mode,
    status: 'lobby',
    players: { [hostPlayer.id]: hostPlayer },
    round: {
      roundNumber: 0,
      phase: 'waiting' as RoundPhase,
      zombiesTotal: 0,
      zombiesRemaining: 0,
      zombiesSpawned: 0,
      startTime: Date.now(),
      intermissionDuration: 15000,
    },
    activePowerUps: [],
    highScore: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
