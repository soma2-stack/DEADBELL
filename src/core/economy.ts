// src/core/economy.ts
export type TxType = 'reward' | 'purchase';

export class Economy {
  points: number;
  onChange?: (points: number, tx: { amount: number; type: TxType; reason: string }) => void;
  
  constructor(start = 500, onChange?: Economy['onChange']) {
    this.points = start;
    this.onChange = onChange;
  }
  
  add(amount: number, reason: string) {
    if (amount <= 0) return false;
    this.points += amount;
    this.onChange?.(this.points, { amount, type: 'reward', reason });
    return true;
  }
  
  spend(amount: number, reason: string) {
    if (amount < 0 || this.points < amount) return false;
    this.points -= amount;
    this.onChange?.(this.points, { amount: -amount, type: 'purchase', reason });
    return true;
  }
  
  canAfford(amount: number) { return this.points >= amount; }
  
  // 🎯 Predefined rewards (use these in game logic)
  static REWARD = {
    HIT: 10,
    KILL: 60,
    HEADSHOT: 100,
    ASSIST: 25,
    WAVE: 150
  };
}
