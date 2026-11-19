import type { MapId, RegionId } from '../types/game';

export const MAZE_SIZE = 96;
export const TOTAL_KEYS = 7;
export const CELL_SIZE = 3.0; // meters per grid cell -> wide 6m-9m corridors
export const WALL_HEIGHT = 3.6;
export const FLOOR_HEIGHT = 4.2; // vertical spacing per floor in 3-story Gedung
export const DEFAULT_SEED = 1942;

export const TRAP_CYCLE = 5.4;
export const TRAP_SAFE = 3.0;
export const TRAP_WARN = 1.2;
export const TRAP_ACTIVE = 1.2;

export const DODGE_DURATION = 0.25;
export const DODGE_COOLDOWN = 2.0;
export const DODGE_DISTANCE = 2.0 * CELL_SIZE * 0.45;
export const DODGE_PROTECTION_WINDOW = 0.3;

export const PLAYER_RADIUS = 0.32;
export const PLAYER_SPEED = 2.85; // Slower & tenser than 4.6, yet slightly faster than normal guard chase (2.55)
export const SPRINT_SPEED_MULT = 1.48; // ~4.22 cells/s while holding Shift
export const MAX_STAMINA = 100;
export const STAMINA_DRAIN_PER_SEC = 28;
export const STAMINA_REGEN_PER_SEC = 18;
export const STAMINA_REGEN_DELAY = 0.65;
export const STAMINA_EXHAUST_THRESHOLD = 20;
export const GUARD_COUNT = 11;

export interface MapDefinition {
  id: MapId;
  name: string;
  shortName: string;
  subtitle: string;
  patternLabel: string;
  difficultyLabel: string;
  durationLabel?: string;
  gridSize: number;
  floors: number;
  guardCount: number;
  trapCount: number;
  guardSpeedMult: number;
  guardSightMult: number;
  encounterTimeDelta: number;
  openSky: boolean;
  accentHex: string;
  regionNames: Record<RegionId, string>;
}

export const MAP_CATALOG: Record<MapId, MapDefinition> = {
  pelabuhan: {
    id: 'pelabuhan',
    name: 'Pos Pelabuhan 1942',
    shortName: 'Pelabuhan',
    subtitle:
      'Pos jaga dermaga ringkas berpola terbuka (estimasi 3–5 menit) dengan 6 penjaga longgar dan waktu kuis ekstra.',
    patternLabel: 'Dermaga Terbuka',
    difficultyLabel: 'Mudah',
    durationLabel: '3–5 Mnt',
    gridSize: 56,
    floors: 1,
    guardCount: 6,
    trapCount: 8,
    guardSpeedMult: 0.78,
    guardSightMult: 0.78,
    encounterTimeDelta: 3,
    openSky: true,
    accentHex: '#66b3ff',
    regionNames: {
      depot: 'Dermaga Barat',
      admin: 'Pos Bea Cukai',
      service: 'Gudang Tali',
      outer: 'Mercusuar Timur',
    },
  },
  gudang: {
    id: 'gudang',
    name: 'Gudang Logistik',
    shortName: 'Gudang',
    subtitle: 'Kompleks gudang logistik 1942 dengan lorong koridor, ruang arsip, dan jalur servis.',
    patternLabel: 'Koridor Bercabang',
    difficultyLabel: 'Standar',
    gridSize: 96,
    floors: 1,
    guardCount: 11,
    trapCount: 20,
    guardSpeedMult: 1.0,
    guardSightMult: 1.0,
    encounterTimeDelta: 0,
    openSky: false,
    accentHex: '#d4a24c',
    regionNames: {
      depot: 'Gudang Logistik',
      admin: 'Seksi Administrasi',
      service: 'Lorong Servis',
      outer: 'Kompleks Luar',
    },
  },
  hutan: {
    id: 'hutan',
    name: 'Hutan Rimba',
    shortName: 'Hutan',
    subtitle: 'Rimbalan kabut malam dengan jalur setapak berliku, rawa terbuka, dan patroli rimba.',
    patternLabel: 'Setapak Organik & Rawa',
    difficultyLabel: 'Menengah',
    gridSize: 112,
    floors: 1,
    guardCount: 14,
    trapCount: 26,
    guardSpeedMult: 1.06,
    guardSightMult: 1.12,
    encounterTimeDelta: -1,
    openSky: true,
    accentHex: '#5cd692',
    regionNames: {
      depot: 'Bumi Perkemahan',
      admin: 'Rawa Bambu',
      service: 'Lembah Kabut',
      outer: 'Tepi Rimba',
    },
  },
  pedesaan: {
    id: 'pedesaan',
    name: 'Pedesaan 1942',
    shortName: 'Pedesaan',
    subtitle: 'Blok rumah kampung, gang pekarangan sempit, dan alun-alun dengan penjagaan ketat.',
    patternLabel: 'Blok Kampung & Alun-Alun',
    difficultyLabel: 'Sulit',
    gridSize: 124,
    floors: 1,
    guardCount: 17,
    trapCount: 32,
    guardSpeedMult: 1.11,
    guardSightMult: 1.18,
    encounterTimeDelta: -1,
    openSky: true,
    accentHex: '#e08b4f',
    regionNames: {
      depot: 'Pos Pendopo Barat',
      admin: 'Kampung Tengah',
      service: 'Lorong Pasar',
      outer: 'Alun-Alun Timur',
    },
  },
  gedung: {
    id: 'gedung',
    name: 'Gedung Markas 3 Lantai',
    shortName: 'Gedung (3 Lt.)',
    subtitle: 'Markas komando 3 lantai terhubung anak tangga. Kunci tersebar dari lobi hingga lantai 3.',
    patternLabel: 'Sayap Gedung 3 Lantai',
    difficultyLabel: 'Sangat Sulit',
    gridSize: 104,
    floors: 3,
    guardCount: 18,
    trapCount: 24,
    guardSpeedMult: 1.16,
    guardSightMult: 1.24,
    encounterTimeDelta: -2,
    openSky: false,
    accentHex: '#e05b53',
    regionNames: {
      depot: 'Sayap Penahanan',
      admin: 'Ruang Arsip & Sandi',
      service: 'Lorong Utilitas',
      outer: 'Sayap Komando',
    },
  },
};

export const MAP_ORDER: MapId[] = ['pelabuhan', 'gudang', 'hutan', 'pedesaan', 'gedung'];

export const REGION_NAMES: Record<RegionId, string> = MAP_CATALOG.gudang.regionNames;

export function regionIndexToId(idx: number): RegionId {
  if (idx === 1) return 'admin';
  if (idx === 2) return 'service';
  if (idx === 3) return 'outer';
  return 'depot';
}
