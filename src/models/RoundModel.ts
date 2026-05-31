export type RoundPhase = 'waiting' | 'active' | 'intermission' | 'gameover';

export interface RoundModel {
  roundNumber: number;
  phase: RoundPhase;
  zombiesRemaining: number;
  zombiesTotal: number;
  zombiesSpawned: number;
  startTime: number;
  endTime?: number;
  intermissionDuration: number; // ms
}

export function calculateZombieCount(round: number, playerCount: number): number {
  const base = 6 + (round - 1) * 3;
  return Math.floor(base * (1 + (playerCount - 1) * 0.5));
}

export function calculateZombieHealth(round: number): number {
  if (round <= 10) return 150 + (round - 1) * 100;
  return 150 + 9 * 100 + (round - 10) * 200;
}

export function createRound(roundNumber: number, playerCount: number): RoundModel {
  return {
    roundNumber,
    phase: 'waiting',
    zombiesTotal: calculateZombieCount(roundNumber, playerCount),
    zombiesRemaining: calculateZombieCount(roundNumber, playerCount),
    zombiesSpawned: 0,
    startTime: Date.now(),
    intermissionDuration: 15000,
  };
}
