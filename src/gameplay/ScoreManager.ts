import type { GameStats } from '../types/game';

export const MAX_LIVES = 5;

export function calculateScore(params: {
  correct: number;
  wrong: number;
  keysCollected: number;
  lives: number;
  bestStreak: number;
  won: boolean;
}): number {
  const raw =
    params.correct * 100 +
    params.keysCollected * 150 +
    Math.max(0, params.lives) * 50 +
    params.bestStreak * 20 -
    params.wrong * 30 +
    (params.won ? 400 : 0);
  return Math.max(0, raw);
}

export function getRankForScore(score: number): string {
  if (score >= 1700) return 'S';
  if (score >= 1300) return 'A';
  if (score >= 950) return 'B';
  if (score >= 650) return 'C';
  if (score >= 380) return 'D';
  return 'E';
}

export function applyQuizOutcome(params: {
  correct: boolean;
  isGuardEncounter: boolean;
  lives: number;
  streak: number;
  bestStreak: number;
  stats: GameStats;
}): {
  lives: number;
  streak: number;
  bestStreak: number;
  healed: boolean;
  lostLife: boolean;
  stats: GameStats;
} {
  const nextStats: GameStats = { ...params.stats };
  let lives = params.lives;
  let streak = params.streak;
  let bestStreak = params.bestStreak;
  let healed = false;
  let lostLife = false;

  if (params.correct) {
    nextStats.correct += 1;
    streak += 1;
    if (streak > bestStreak) bestStreak = streak;
    if (streak % 3 === 0 && lives < MAX_LIVES) {
      lives += 1;
      healed = true;
    }
  } else {
    nextStats.wrong += 1;
    streak = 0;
    if (params.isGuardEncounter) {
      lives = Math.max(0, lives - 1);
      lostLife = true;
    }
  }

  return { lives, streak, bestStreak, healed, lostLife, stats: nextStats };
}
