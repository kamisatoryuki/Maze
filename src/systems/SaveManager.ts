import type {
  GameSettings,
  LeaderboardEntry,
  SaveStateV2,
} from '../types/game';

const SAVE_KEY = 'escape1942_save_v4';
const SETTINGS_KEY = 'escape1942_settings_v2';
const LEADERBOARD_KEY = 'escape1942_leaderboard_v2';
const PERSONAL_BEST_KEY = 'escape1942_pb_v2';
const PLAYER_NAME_KEY = 'escape1942_player_name';

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.3,
  sfxVolume: 0.65,
  muted: false,
  mouseSensitivity: 1.0,
  joyDeadzone: 18,
  difficulty: 'normal',
  quality: 'medium',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.musicVolume))
          : DEFAULT_SETTINGS.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : DEFAULT_SETTINGS.sfxVolume,
      muted: Boolean(parsed.muted),
      mouseSensitivity:
        typeof parsed.mouseSensitivity === 'number'
          ? Math.max(0.3, Math.min(2.5, parsed.mouseSensitivity))
          : DEFAULT_SETTINGS.mouseSensitivity,
      joyDeadzone:
        typeof parsed.joyDeadzone === 'number'
          ? Math.max(10, Math.min(45, parsed.joyDeadzone))
          : DEFAULT_SETTINGS.joyDeadzone,
      difficulty:
        parsed.difficulty === 'easy' ||
        parsed.difficulty === 'normal' ||
        parsed.difficulty === 'sulit'
          ? parsed.difficulty
          : DEFAULT_SETTINGS.difficulty,
      quality:
        parsed.quality === 'low' ||
        parsed.quality === 'medium' ||
        parsed.quality === 'high'
          ? parsed.quality
          : DEFAULT_SETTINGS.quality,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export function saveGameState(state: SaveStateV2): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadGameState(): SaveStateV2 | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SaveStateV2>;
    if (!s || s.version !== 2) return null;
    if (
      typeof s.seed !== 'number' ||
      typeof s.elapsedTime !== 'number' ||
      typeof s.lives !== 'number' ||
      s.lives <= 0 ||
      !s.player ||
      typeof s.player.x !== 'number' ||
      typeof s.player.y !== 'number' ||
      !Array.isArray(s.collectedKeys) ||
      !Array.isArray(s.exploredCells)
    ) {
      return null;
    }
    return s as SaveStateV2;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function getPersonalBest(): number | null {
  try {
    const raw = localStorage.getItem(PERSONAL_BEST_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setPersonalBest(seconds: number): void {
  try {
    localStorage.setItem(PERSONAL_BEST_KEY, String(seconds));
  } catch {
    // ignore
  }
}

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.slice(0, 18));
  } catch {
    // ignore
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.name === 'string' &&
        Number.isFinite(r.score) &&
        Number.isFinite(r.elapsedTime)
    );
  } catch {
    return [];
  }
}

export function addLeaderboardEntry(entry: LeaderboardEntry): number {
  const list = loadLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.elapsedTime - b.elapsedTime);
  if (list.length > 50) list.length = 50;
  const idx = list.indexOf(entry);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return idx;
}

export function clearLeaderboard(): void {
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch {
    // ignore
  }
}
