export type GamePhase = 'title' | 'intro' | 'playing' | 'quiz' | 'paused' | 'gameover';

export type DifficultyLevel = 'easy' | 'normal' | 'sulit';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type MapId = 'gudang' | 'hutan' | 'pedesaan' | 'gedung';

export type RegionId = 'depot' | 'admin' | 'service' | 'outer';

export type EscapeRouteId = 'A' | 'B' | 'C';

export interface SourceMap {
  [id: string]: {
    label: string;
    url: string;
  };
}

export interface MCQQuestion {
  id: string;
  type: 'multiple_choice';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  sourceIds: string[];
}

export interface TrueFalseQuestion {
  id: string;
  type: 'true_false';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  statement: string;
  answerBoolean: boolean;
  explanation: string;
  sourceIds: string[];
}

export type HistoricalQuestion = MCQQuestion | TrueFalseQuestion;

export interface ActiveQuiz {
  kind: 'door' | 'guard';
  doorIndex?: number;
  guardIndex?: number;
  questionType: 'multiple_choice' | 'true_false';
  questionId: string;
  category: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceIds: string[];
  timeLimit: number;
  timeLeft: number;
  answered: boolean;
  selectedIndex: number | null;
  wasCorrect: boolean | null;
  autoCloseLeft: number;
}

export interface KeyNode {
  index: number;
  floor: number;
  x: number;
  y: number;
  region: RegionId;
  label: string;
  code: string;
}

export interface QuizDoorNode {
  index: number;
  floor: number;
  cells: Array<[number, number]>;
  orientation: 'H' | 'V';
  region: RegionId;
  label: string;
  openLeft: number;
}

export interface ExitGateNode {
  routeId: EscapeRouteId;
  floor: number;
  name: string;
  subtitle: string;
  cells: Array<[number, number]>;
  approachCell: [number, number];
}

export interface TrapNode {
  index: number;
  floor: number;
  x: number;
  y: number;
  offset: number;
  state: 0 | 1 | 2;
  remain: number;
  dur: number;
  lastHitCycle: number;
}

export interface GuardNode {
  index: number;
  floor: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  region: RegionId;
  state: 'patrol' | 'alert' | 'chase' | 'return' | 'stunned';
  path: Array<[number, number]>;
  speed: number;
  repathCd: number;
  idleTimer: number;
  returnDelay: number;
  stunTimer: number;
  facingYaw: number;
}

export interface PropNode {
  floor: number;
  x: number;
  y: number;
  kind: 'crate' | 'shelf' | 'desk' | 'barrel';
  yaw: number;
  region: RegionId;
}

export interface StairNode {
  index: number;
  fromFloor: number;
  toFloor: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 'E' | 'W' | 'N' | 'S';
  label: string;
}

export interface MazeLayout {
  mapId: MapId;
  width: number;
  floors: number;
  seed: number;
  grid: Uint8Array; // floor 0 grid
  floorGrids: Uint8Array[];
  regionGrid: Uint8Array; // floor 0 region grid
  floorRegionGrids: Uint8Array[];
  spawn: { floor: number; x: number; y: number; yaw: number };
  storyBook: { floor: number; x: number; y: number };
  keys: KeyNode[];
  doors: QuizDoorNode[];
  exits: ExitGateNode[];
  stairs: StairNode[];
  guards: Array<{ floor: number; x: number; y: number; region: RegionId }>;
  traps: Array<{ floor: number; x: number; y: number; offset: number }>;
  props: PropNode[];
  walkableCells: Array<[number, number]>;
  floorWalkableCells: Array<Array<[number, number]>>;
  regionNames: Record<RegionId, string>;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  mouseSensitivity: number;
  joyDeadzone: number;
  difficulty: DifficultyLevel;
  quality: GraphicsQuality;
}

export interface GameStats {
  correct: number;
  wrong: number;
  guardCatches: number;
  trapHits: number;
  doorsOpened: number;
  dodgesUsed: number;
}

export interface RunSummary {
  won: boolean;
  mapId: MapId;
  mapName: string;
  score: number;
  rank: string;
  elapsedTime: number;
  lives: number;
  keysCollected: number;
  stats: GameStats;
  bestStreak: number;
  selectedExit: EscapeRouteId | null;
  selectedExitName: string | null;
  isNewBest: boolean;
}

export interface SaveStateV2 {
  version: 2;
  mapId?: MapId;
  seed: number;
  elapsedTime: number;
  lives: number;
  collectedKeys: number[];
  openedDoors: Array<{ index: number; openLeft: number }>;
  exploredCells: number[];
  exploredFloorCells?: number[][];
  player: {
    floor?: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  };
  streak: number;
  bestStreak: number;
  invuln: number;
  slow: number;
  dodgeCooldown: number;
  stamina?: number;
  bookRead?: boolean;
  stats: GameStats;
  guards: Array<{ floor?: number; x: number; y: number; state: GuardNode['state'] }>;
  selectedExit: EscapeRouteId | null;
}

export interface LeaderboardEntry {
  name: string;
  mapId?: MapId;
  score: number;
  rank: string;
  elapsedTime: number;
  correct: number;
  wrong: number;
  lives: number;
  keys: number;
  bestStreak: number;
  dodgesUsed: number;
  exitRoute: EscapeRouteId;
  date: string;
}

export interface HudSnapshot {
  mapId: MapId;
  mapName: string;
  currentFloor: number;
  totalFloors: number;
  elapsedTime: number;
  lives: number;
  maxLives: number;
  keysCollected: number;
  totalKeys: number;
  streak: number;
  bestStreak: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  isExhausted: boolean;
  dodgeCooldown: number;
  dodgeMaxCooldown: number;
  isDodging: boolean;
  isSlowed: boolean;
  isInvuln: boolean;
  nearPrompt: string | null;
  nearKey: boolean;
  nearBook: boolean;
  regionId: RegionId;
  regionName: string;
  pointerLocked: boolean;
  exitsUnlocked: boolean;
}
