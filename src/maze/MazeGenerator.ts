import {
  CELL_SIZE,
  DEFAULT_SEED,
  MAP_CATALOG,
  TOTAL_KEYS,
  TRAP_CYCLE,
  regionIndexToId,
} from './MazeConfig';
import { DIRS, bfsDistances, createRng } from './Pathfinding';
import type {
  ExitGateNode,
  KeyNode,
  MapId,
  MazeLayout,
  PropNode,
  QuizDoorNode,
  RegionId,
  StairNode,
} from '../types/game';

const STRIDE = 4;

const KEY_METADATA: Array<{ label: string; code: string }> = [
  { label: 'Kunci Gudang Utara', code: 'A-01' },
  { label: 'Kunci Pos Barat', code: 'A-06' },
  { label: 'Kunci Arsip Seksi II', code: 'B-04' },
  { label: 'Kunci Ruang Dokumen', code: 'B-09' },
  { label: 'Kunci Panel Servis', code: 'C-03' },
  { label: 'Kunci Ruang Ketel', code: 'C-08' },
  { label: 'Kunci Gerbang Induk', code: 'D-07' },
];

const DOOR_LABELS: Record<MapId, string[]> = {
  pelabuhan: [
    'Palang Dermaga Barat',
    'Pintu Pos Bea Cukai',
    'Gerbang Mercusuar Timur',
    'Pintu Gudang Tali',
  ],
  gudang: [
    'Pos Pemeriksaan Gudang',
    'Pintu Arsip Administrasi',
    'Gerbang Seksi Utama',
    'Pintu Koridor Servis',
  ],
  hutan: [
    'Palang Pos Rimba',
    'Gerbang Rawa Bambu',
    'Pos Patroli Timur',
    'Pintu Lembah Kabut',
  ],
  pedesaan: [
    'Gapura Kampung Barat',
    'Pos Jaga Pasar',
    'Gerbang Alun-Alun',
    'Pintu Gang Selatan',
  ],
  gedung: [
    'Pintu Lobi Penahanan',
    'Gerbang Arsip Lantai 2',
    'Pos Pemeriksaan Utama',
    'Pintu Sayap Komando Lt. 3',
  ],
};

function idxW(x: number, y: number, W: number): number {
  return y * W + x;
}

function carveRect(
  grid: Uint8Array,
  W: number,
  x0: number,
  y0: number,
  w: number,
  h: number
): void {
  const xEnd = Math.min(W - 2, x0 + w - 1);
  const yEnd = Math.min(W - 2, y0 + h - 1);
  for (let y = Math.max(1, y0); y <= yEnd; y++) {
    for (let x = Math.max(1, x0); x <= xEnd; x++) {
      grid[idxW(x, y, W)] = 0;
    }
  }
}

function fillRect(
  grid: Uint8Array,
  W: number,
  x0: number,
  y0: number,
  w: number,
  h: number
): void {
  const xEnd = Math.min(W - 1, x0 + w - 1);
  const yEnd = Math.min(W - 1, y0 + h - 1);
  for (let y = Math.max(0, y0); y <= yEnd; y++) {
    for (let x = Math.max(0, x0); x <= xEnd; x++) {
      grid[idxW(x, y, W)] = 1;
    }
  }
}

function assignRegions(regionGrid: Uint8Array, W: number): void {
  const half = Math.floor(W / 2);
  const belt = W < 80 ? W - 11 : W - 18;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      if (x >= half && y < half) r = 1; // admin
      else if (x < half && y >= half) r = 2; // service
      else if (x >= half && y >= half) r = 3; // outer
      if (x >= belt || y >= belt) r = 3; // outer perimeter belt
      regionGrid[idxW(x, y, W)] = r;
    }
  }
}

function carveSpanningLattice(
  grid: Uint8Array,
  W: number,
  logicalN: number,
  rng: () => number,
  mode: 'dfs' | 'growing' | 'blocks',
  loopChance: number
): Uint8Array {
  const visited = new Uint8Array(logicalN * logicalN);
  const degree = new Uint8Array(logicalN * logicalN);
  const active: Array<[number, number]> = [[0, 0]];
  visited[0] = 1;
  carveRect(grid, W, 1, 1, 2, 2);

  while (active.length > 0) {
    // 'dfs' picks newest cell; 'growing' mixes newest (65%) and random active frontier (35%) for organic forks
    const pickIdx =
      mode === 'growing' && rng() < 0.35
        ? Math.floor(rng() * active.length)
        : active.length - 1;
    const [lx, ly] = active[pickIdx];
    const neighbors = DIRS.map(([dx, dy]) => [lx + dx, ly + dy] as const).filter(
      ([nx, ny]) =>
        nx >= 0 &&
        ny >= 0 &&
        nx < logicalN &&
        ny < logicalN &&
        visited[ny * logicalN + nx] === 0
    );

    if (neighbors.length === 0) {
      active.splice(pickIdx, 1);
      continue;
    }

    const [nx, ny] = neighbors[Math.floor(rng() * neighbors.length)];
    visited[ny * logicalN + nx] = 1;
    degree[ly * logicalN + lx]++;
    degree[ny * logicalN + nx]++;

    const px = 1 + lx * STRIDE;
    const py = 1 + ly * STRIDE;
    const qx = 1 + nx * STRIDE;
    const qy = 1 + ny * STRIDE;

    carveRect(grid, W, qx, qy, 2, 2);
    carveRect(
      grid,
      W,
      Math.min(px, qx),
      Math.min(py, qy),
      Math.abs(qx - px) + 2,
      Math.abs(qy - py) + 2
    );
    active.push([nx, ny]);
  }

  // Loop connections
  for (let ly = 0; ly < logicalN; ly++) {
    for (let lx = 0; lx < logicalN; lx++) {
      if (rng() < loopChance) {
        const choices = DIRS.map(([dx, dy]) => [lx + dx, ly + dy] as const).filter(
          ([nx, ny]) => nx >= 0 && ny >= 0 && nx < logicalN && ny < logicalN
        );
        const [nx, ny] = choices[Math.floor(rng() * choices.length)];
        const px = 1 + lx * STRIDE;
        const py = 1 + ly * STRIDE;
        const qx = 1 + nx * STRIDE;
        const qy = 1 + ny * STRIDE;
        carveRect(
          grid,
          W,
          Math.min(px, qx),
          Math.min(py, qy),
          Math.abs(qx - px) + 2,
          Math.abs(qy - py) + 2
        );
        degree[ly * logicalN + lx]++;
        degree[ny * logicalN + nx]++;
      }
    }
  }

  // Village block pattern adds structured cross-streets every 5 logical cells
  if (mode === 'blocks') {
    for (let ly = 0; ly < logicalN; ly++) {
      for (let lx = 0; lx < logicalN; lx++) {
        const px = 1 + lx * STRIDE;
        const py = 1 + ly * STRIDE;
        if (ly % 5 === 2 && lx < logicalN - 1) {
          carveRect(grid, W, px, py, STRIDE + 2, 3);
        }
        if (lx % 5 === 2 && ly < logicalN - 1) {
          carveRect(grid, W, px, py, 3, STRIDE + 2);
        }
      }
    }
  }

  return degree;
}

function findFramedDoorways(
  grid: Uint8Array,
  regionGrid: Uint8Array,
  W: number,
  targetRegion: number,
  excludeSet: Set<number>
): Array<{ cells: Array<[number, number]>; orientation: 'H' | 'V' }> {
  const candidates: Array<{
    cells: Array<[number, number]>;
    orientation: 'H' | 'V';
  }> = [];

  for (let y = 4; y < W - 5; y++) {
    for (let x = 4; x < W - 5; x++) {
      if (regionGrid[idxW(x, y, W)] !== targetRegion) continue;
      if (excludeSet.has(idxW(x, y, W))) continue;

      if (
        grid[idxW(x, y, W)] === 0 &&
        grid[idxW(x + 1, y, W)] === 0 &&
        !excludeSet.has(idxW(x + 1, y, W)) &&
        grid[idxW(x - 1, y, W)] === 1 &&
        grid[idxW(x + 2, y, W)] === 1 &&
        grid[idxW(x, y - 1, W)] === 0 &&
        grid[idxW(x + 1, y - 1, W)] === 0 &&
        grid[idxW(x, y + 1, W)] === 0 &&
        grid[idxW(x + 1, y + 1, W)] === 0
      ) {
        candidates.push({
          cells: [
            [x, y],
            [x + 1, y],
          ],
          orientation: 'H',
        });
      }

      if (
        grid[idxW(x, y, W)] === 0 &&
        grid[idxW(x, y + 1, W)] === 0 &&
        !excludeSet.has(idxW(x, y + 1, W)) &&
        grid[idxW(x, y - 1, W)] === 1 &&
        grid[idxW(x, y + 2, W)] === 1 &&
        grid[idxW(x - 1, y, W)] === 0 &&
        grid[idxW(x - 1, y + 1, W)] === 0 &&
        grid[idxW(x + 1, y, W)] === 0 &&
        grid[idxW(x + 1, y + 1, W)] === 0
      ) {
        candidates.push({
          cells: [
            [x, y],
            [x, y + 1],
          ],
          orientation: 'V',
        });
      }
    }
  }

  return candidates;
}

function carveEscapeRoutesForFloor0(
  grid: Uint8Array,
  W: number,
  logicalN: number
): { exits: ExitGateNode[]; routeADoorX: number; routeADoorY: number } {
  const eastX = W - 2; // 94 for 96, 110 for 112, 122 for 124, 102 for 104
  const southY = W - 2;
  const routeAY = 1 + Math.floor(logicalN * 0.32) * STRIDE; // lattice row (~29/33/37)
  const routeBX = 1 + Math.floor(logicalN * 0.44) * STRIDE; // lattice col (~41/49/53)
  const routeCY = 1 + (logicalN - 1) * STRIDE; // bottom lattice row (~89/105/117/97)
  const lastCol = 1 + (logicalN - 2) * STRIDE; // second-to-last col (~85/101/113/93)

  // Route A — Main Gate (East perimeter)
  const doorAX = eastX - 6;
  fillRect(grid, W, doorAX - 1, routeAY - 2, 8, 6);
  carveRect(grid, W, doorAX - 5, routeAY, 5, 2);
  carveRect(grid, W, doorAX, routeAY, 7, 2);
  carveRect(grid, W, eastX - 3, routeAY - 1, 4, 4);
  // Connect approach straight back to nearest lattice column
  carveRect(grid, W, 1 + (logicalN - 3) * STRIDE, routeAY, eastX - 1 - (1 + (logicalN - 3) * STRIDE), 2);

  // Route B — South-Central perimeter
  fillRect(grid, W, routeBX - 2, southY - 6, 6, 7);
  carveRect(grid, W, routeBX, southY - 9, 2, 10);
  carveRect(grid, W, routeBX - 1, southY - 3, 4, 4);

  // Route C — South-East corner
  fillRect(grid, W, lastCol - 4, routeCY - 2, eastX - lastCol + 5, 6);
  carveRect(grid, W, lastCol - 4, routeCY, eastX - lastCol + 5, 2);
  carveRect(grid, W, eastX - 3, routeCY - 1, 4, 4);
  carveRect(grid, W, lastCol - 4, routeCY - 4, 2, 5);

  const exits: ExitGateNode[] = [
    {
      routeId: 'A',
      floor: 0,
      name: 'Jalur A · Gerbang Utama',
      subtitle: 'Rute langsung melewati pos pemeriksaan utama',
      cells: [
        [eastX, routeAY],
        [eastX, routeAY + 1],
      ],
      approachCell: [eastX - 1, routeAY],
    },
    {
      routeId: 'B',
      floor: 0,
      name: 'Jalur B · Lorong Selatan',
      subtitle: 'Rute selatan melintasi sayap bawah kompleks',
      cells: [
        [routeBX, southY],
        [routeBX + 1, southY],
      ],
      approachCell: [routeBX, southY - 1],
    },
    {
      routeId: 'C',
      floor: 0,
      name: 'Jalur C · Pintu Servis',
      subtitle: 'Rute memutar melalui koridor teknis tenggara',
      cells: [
        [eastX, routeCY],
        [eastX, routeCY + 1],
      ],
      approachCell: [eastX - 1, routeCY],
    },
  ];

  return { exits, routeADoorX: doorAX, routeADoorY: routeAY };
}

function carveStairwell(
  floorGrids: Uint8Array[],
  W: number,
  stair: StairNode,
  reservedByFloor: Set<number>[]
): void {
  const gFrom = floorGrids[stair.fromFloor];
  const gTo = floorGrids[stair.toFloor];
  const resFrom = reservedByFloor[stair.fromFloor];
  const resTo = reservedByFloor[stair.toFloor];

  if (stair.dir === 'E') {
    // 4x2 shaft (x..x+3, y..y+1) rising East
    // Carve 2-cell-wide lattice-aligned bypass loop around shaft on both floors
    for (const f of [stair.fromFloor, stair.toFloor]) {
      const g = floorGrids[f];
      carveRect(g, W, stair.x - 4, stair.y - 4, 14, 2);
      carveRect(g, W, stair.x - 4, stair.y + 4, 14, 2);
      carveRect(g, W, stair.x - 4, stair.y - 4, 2, 10);
      carveRect(g, W, stair.x + 8, stair.y - 4, 2, 10);
      // Clean solid core island inside bypass loop so no 1-cell slivers remain
      fillRect(g, W, stair.x - 2, stair.y - 2, 10, 6);
    }
    // Bottom entry open from West (x-2..x+3), solid end East
    carveRect(gFrom, W, stair.x - 2, stair.y, 6, 2);

    // Top landing open to East (x..x+7), solid guardrail West
    carveRect(gTo, W, stair.x, stair.y, 8, 2);
  } else {
    // dir === 'S': 2x4 shaft (x..x+1, y..y+3) rising South
    for (const f of [stair.fromFloor, stair.toFloor]) {
      const g = floorGrids[f];
      carveRect(g, W, stair.x - 4, stair.y - 4, 2, 14);
      carveRect(g, W, stair.x + 4, stair.y - 4, 2, 14);
      carveRect(g, W, stair.x - 4, stair.y - 4, 10, 2);
      carveRect(g, W, stair.x - 4, stair.y + 8, 10, 2);
      // Clean solid core island inside bypass loop
      fillRect(g, W, stair.x - 2, stair.y - 2, 6, 10);
    }
    // Bottom entry open from North (y-2..y+3), solid end South
    carveRect(gFrom, W, stair.x, stair.y - 2, 2, 6);

    // Top landing open to South (y..y+7), solid guardrail North
    carveRect(gTo, W, stair.x, stair.y, 2, 8);
  }

  for (let dy = -2; dy <= stair.h + 1; dy++) {
    for (let dx = -2; dx <= stair.w + 1; dx++) {
      const cx = stair.x + dx;
      const cy = stair.y + dy;
      if (cx >= 0 && cy >= 0 && cx < W && cy < W) {
        resFrom.add(idxW(cx, cy, W));
        resTo.add(idxW(cx, cy, W));
      }
    }
  }
}

function decorateFloorGeometry(
  mapId: MapId,
  floor: number,
  grid: Uint8Array,
  W: number,
  logicalN: number,
  degree: Uint8Array,
  rng: () => number
): void {
  if (mapId === 'pelabuhan') {
    // Open coastal harbor courtyards & wide junction plazas for relaxed 3-5 min navigation
    const mid = Math.floor(W / 2) - 4;
    carveRect(grid, W, mid, mid, 8, 8);
    carveRect(grid, W, 13, 13, 6, 6);
    carveRect(grid, W, W - 23, 13, 6, 6);
    carveRect(grid, W, 13, W - 23, 6, 6);
    for (let lx = 0; lx < logicalN; lx++) {
      for (let ly = 0; ly < logicalN; ly++) {
        if (degree[ly * logicalN + lx] >= 3) {
          carveRect(grid, W, 1 + lx * STRIDE, 1 + ly * STRIDE, 3, 3);
        }
      }
    }
  } else if (mapId === 'gudang') {
    for (let lx = 0; lx < logicalN; lx++) {
      for (let ly = 0; ly < logicalN; ly++) {
        const px = 1 + lx * STRIDE;
        const py = 1 + ly * STRIDE;
        if (degree[ly * logicalN + lx] >= 3) carveRect(grid, W, px, py, 3, 3);
        if (ly === 5 || ly === 11 || ly === 17) carveRect(grid, W, px, py, 4, 3);
        if (lx === 5 || lx === 11 || lx === 17) carveRect(grid, W, px, py, 3, 4);
      }
    }
    // Storage & Admin rooms
    carveRect(grid, W, 13, 5, 6, 6);
    carveRect(grid, W, 5, 21, 6, 6);
    carveRect(grid, W, 29, 25, 6, 6);
    carveRect(grid, W, 53, 9, 6, 6);
    carveRect(grid, W, 65, 25, 6, 6);
    carveRect(grid, W, 17, 57, 6, 6);
    carveRect(grid, W, 33, 65, 6, 6);
    carveRect(grid, W, 61, 61, 6, 6);
    carveRect(grid, W, 81, 49, 6, 6);
  } else if (mapId === 'hutan') {
    // Organic forest clearings & wide mossy glades
    for (let c = 0; c < 14; c++) {
      const lx = 2 + Math.floor(rng() * (logicalN - 4));
      const ly = 2 + Math.floor(rng() * (logicalN - 4));
      const px = 1 + lx * STRIDE;
      const py = 1 + ly * STRIDE;
      const rw = 4 + Math.floor(rng() * 4);
      const rh = 4 + Math.floor(rng() * 4);
      carveRect(grid, W, px, py, rw, rh);
    }
  } else if (mapId === 'pedesaan') {
    // Open central Alun-Alun plaza + neighborhood compounds & crossroads
    const mid = Math.floor(W / 2) - 5;
    carveRect(grid, W, mid, mid, 10, 10);
    carveRect(grid, W, 21, 21, 7, 7);
    carveRect(grid, W, W - 34, 21, 7, 7);
    carveRect(grid, W, 21, W - 34, 7, 7);
    carveRect(grid, W, W - 34, W - 34, 7, 7);
    for (let lx = 0; lx < logicalN; lx++) {
      for (let ly = 0; ly < logicalN; ly++) {
        if (degree[ly * logicalN + lx] >= 3) {
          carveRect(grid, W, 1 + lx * STRIDE, 1 + ly * STRIDE, 3, 3);
        }
      }
    }
  } else {
    // gedung (floor 0, 1, 2)
    for (let lx = 0; lx < logicalN; lx++) {
      for (let ly = 0; ly < logicalN; ly++) {
        const px = 1 + lx * STRIDE;
        const py = 1 + ly * STRIDE;
        if (degree[ly * logicalN + lx] >= 3) carveRect(grid, W, px, py, 3, 3);
        if (floor === 0 && (ly === 6 || lx === 6 || ly === 18 || lx === 18)) {
          carveRect(grid, W, px, py, 3, 3);
        }
        if (floor === 2 && (lx === 1 || lx === logicalN - 2 || ly === 1 || ly === logicalN - 2)) {
          // Top floor perimeter gallery loop
          carveRect(grid, W, px, py, 3, 3);
        }
      }
    }
    if (floor === 0) {
      carveRect(grid, W, 45, 45, 9, 9); // Grand Lobby
      carveRect(grid, W, 17, 17, 6, 6);
    } else if (floor === 1) {
      carveRect(grid, W, 21, 33, 8, 8);
      carveRect(grid, W, 65, 45, 8, 8);
    } else {
      carveRect(grid, W, 45, 45, 10, 10); // War Command Hall
    }
  }
}

export function computeMultiFloorDistances(
  floorGrids: Uint8Array[],
  W: number,
  stairs: StairNode[],
  startFloor: number,
  startX: number,
  startY: number,
  blockedMasks?: Uint8Array[]
): Int32Array[] {
  const F = floorGrids.length;
  const dists = Array.from({ length: F }, () => new Int32Array(W * W).fill(-1));
  if (
    startFloor < 0 ||
    startFloor >= F ||
    floorGrids[startFloor][idxW(startX, startY, W)] === 1
  ) {
    return dists;
  }

  const queue: Array<[number, number, number]> = [[startFloor, startX, startY]];
  dists[startFloor][idxW(startX, startY, W)] = 0;

  // Build quick stair lookup at midpoint/ends
  const stairLinks = new Map<number, Array<[number, number, number]>>();
  const addLink = (f1: number, x1: number, y1: number, f2: number, x2: number, y2: number) => {
    const k1 = (f1 * W * W) + idxW(x1, y1, W);
    const list1 = stairLinks.get(k1) || [];
    list1.push([f2, x2, y2]);
    stairLinks.set(k1, list1);
  };

  for (const s of stairs) {
    if (s.dir === 'E') {
      // Transition across center of stair cells
      for (let dy = 0; dy < 2; dy++) {
        addLink(s.fromFloor, s.x + 1, s.y + dy, s.toFloor, s.x + 2, s.y + dy);
        addLink(s.toFloor, s.x + 2, s.y + dy, s.fromFloor, s.x + 1, s.y + dy);
      }
    } else {
      for (let dx = 0; dx < 2; dx++) {
        addLink(s.fromFloor, s.x + dx, s.y + 1, s.toFloor, s.x + dx, s.y + 2);
        addLink(s.toFloor, s.x + dx, s.y + 2, s.fromFloor, s.x + dx, s.y + 1);
      }
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const [f, x, y] = queue[head];
    const dNext = dists[f][idxW(x, y, W)] + 1;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const ni = idxW(nx, ny, W);
      if (floorGrids[f][ni] !== 0 || dists[f][ni] >= 0) continue;
      if (blockedMasks && blockedMasks[f]?.[ni]) continue;
      dists[f][ni] = dNext;
      queue.push([f, nx, ny]);
    }

    const links = stairLinks.get(f * W * W + idxW(x, y, W));
    if (links) {
      for (const [tf, tx, ty] of links) {
        const ti = idxW(tx, ty, W);
        if (floorGrids[tf][ti] === 0 && dists[tf][ti] < 0) {
          dists[tf][ti] = dNext;
          queue.push([tf, tx, ty]);
        }
      }
    }
  }

  return dists;
}

export function generateMaze(
  seed = DEFAULT_SEED,
  mapId: MapId = 'gudang'
): MazeLayout {
  const def = MAP_CATALOG[mapId];
  const W = def.gridSize;
  const F = def.floors;
  const logicalN = Math.floor((W - 4) / STRIDE);
  const mapSeedOffset =
    mapId === 'pelabuhan'
      ? 173
      : mapId === 'gudang'
      ? 0
      : mapId === 'hutan'
      ? 313
      : mapId === 'pedesaan'
      ? 719
      : 1291;
  const rng = createRng(seed + mapSeedOffset);

  const floorGrids = Array.from({ length: F }, () => new Uint8Array(W * W).fill(1));
  const floorRegionGrids = Array.from({ length: F }, () => new Uint8Array(W * W));
  const reservedByFloor = Array.from({ length: F }, () => new Set<number>());

  const mode =
    mapId === 'hutan' || mapId === 'pelabuhan'
      ? 'growing'
      : mapId === 'pedesaan'
      ? 'blocks'
      : 'dfs';
  const loopChance =
    mapId === 'pelabuhan'
      ? 0.54
      : mapId === 'hutan'
      ? 0.42
      : mapId === 'pedesaan'
      ? 0.48
      : mapId === 'gedung'
      ? 0.28
      : 0.28;

  for (let f = 0; f < F; f++) {
    assignRegions(floorRegionGrids[f], W);
    const floorRng = createRng(seed + mapSeedOffset + f * 997);
    const degree = carveSpanningLattice(floorGrids[f], W, logicalN, floorRng, mode, loopChance);
    decorateFloorGeometry(mapId, f, floorGrids[f], W, logicalN, degree, floorRng);

    // Spawn Loading Bay (6x6) at top-left Floor 0 + clean starter rooms on upper floors
    if (f === 0) {
      carveRect(floorGrids[0], W, 1, 1, 6, 6);
      carveRect(floorGrids[0], W, 5, 1, 6, 3);
      carveRect(floorGrids[0], W, 1, 5, 3, 6);
    }
  }

  // Build Staircases for 3-floor Gedung
  const stairs: StairNode[] = [];
  if (mapId === 'gedung') {
    const rawStairs: StairNode[] = [
      {
        index: 0,
        fromFloor: 0,
        toFloor: 1,
        x: 77,
        y: 25,
        w: 4,
        h: 2,
        dir: 'E',
        label: 'Tangga Sayap Timur (Lt. 1 ↔ Lt. 2)',
      },
      {
        index: 1,
        fromFloor: 0,
        toFloor: 1,
        x: 25,
        y: 77,
        w: 2,
        h: 4,
        dir: 'S',
        label: 'Tangga Sayap Selatan (Lt. 1 ↔ Lt. 2)',
      },
      {
        index: 2,
        fromFloor: 1,
        toFloor: 2,
        x: 49,
        y: 17,
        w: 4,
        h: 2,
        dir: 'E',
        label: 'Tangga Sayap Utara (Lt. 2 ↔ Lt. 3)',
      },
      {
        index: 3,
        fromFloor: 1,
        toFloor: 2,
        x: 73,
        y: 65,
        w: 2,
        h: 4,
        dir: 'S',
        label: 'Tangga Sayap Tenggara (Lt. 2 ↔ Lt. 3)',
      },
    ];
    for (const s of rawStairs) {
      carveStairwell(floorGrids, W, s, reservedByFloor);
      stairs.push(s);
    }
  }

  // Carve 3 Escape Routes on Floor 0
  const { exits, routeADoorX, routeADoorY } = carveEscapeRoutesForFloor0(
    floorGrids[0],
    W,
    logicalN
  );

  // Enforce solid 1-cell outer border on all floors
  for (let f = 0; f < F; f++) {
    const g = floorGrids[f];
    for (let i = 0; i < W; i++) {
      g[idxW(i, 0, W)] = 1;
      g[idxW(i, W - 1, W)] = 1;
      g[idxW(0, i, W)] = 1;
      g[idxW(W - 1, i, W)] = 1;
    }
  }

  // Reserve spawn bay & exits
  for (let y = 1; y <= 7; y++) {
    for (let x = 1; x <= 7; x++) reservedByFloor[0].add(idxW(x, y, W));
  }
  exits.forEach((ex) => {
    ex.cells.forEach(([x, y]) => reservedByFloor[0].add(idxW(x, y, W)));
    reservedByFloor[0].add(idxW(ex.approachCell[0], ex.approachCell[1], W));
  });

  // Place 4 Quiz Doors
  const doorLabels = DOOR_LABELS[mapId];
  const doors: QuizDoorNode[] = [];
  const routeADoor: QuizDoorNode = {
    index: 2,
    floor: 0,
    cells: [
      [routeADoorX, routeADoorY],
      [routeADoorX, routeADoorY + 1],
    ],
    orientation: 'V',
    region: 'outer',
    label: doorLabels[2],
    openLeft: 0,
  };
  routeADoor.cells.forEach(([x, y]) => reservedByFloor[0].add(idxW(x, y, W)));

  const regionTargets: Array<{ floor: number; regionNum: number; doorIdx: number; label: string }> =
    mapId === 'gedung'
      ? [
          { floor: 0, regionNum: 0, doorIdx: 0, label: doorLabels[0] },
          { floor: 1, regionNum: 1, doorIdx: 1, label: doorLabels[1] },
          { floor: 2, regionNum: 2, doorIdx: 3, label: doorLabels[3] },
        ]
      : [
          { floor: 0, regionNum: 0, doorIdx: 0, label: doorLabels[0] },
          { floor: 0, regionNum: 1, doorIdx: 1, label: doorLabels[1] },
          { floor: 0, regionNum: 2, doorIdx: 3, label: doorLabels[3] },
        ];

  const tempDoors: QuizDoorNode[] = [];
  for (const rt of regionTargets) {
    const cands = findFramedDoorways(
      floorGrids[rt.floor],
      floorRegionGrids[rt.floor],
      W,
      rt.regionNum,
      reservedByFloor[rt.floor]
    );
    if (cands.length > 0) {
      const pick = cands[Math.floor(rng() * cands.length)];
      pick.cells.forEach(([x, y]) => reservedByFloor[rt.floor].add(idxW(x, y, W)));
      tempDoors.push({
        index: rt.doorIdx,
        floor: rt.floor,
        cells: pick.cells,
        orientation: pick.orientation,
        region: regionIndexToId(rt.regionNum),
        label: rt.label,
        openLeft: 0,
      });
    }
  }

  doors.push(...tempDoors, routeADoor);
  doors.sort((a, b) => a.index - b.index);
  doors.forEach((d, i) => {
    d.index = i;
  });

  // Collect walkable cells per floor & compute multi-floor BFS from spawn
  const floorWalkableCells: Array<Array<[number, number]>> = Array.from(
    { length: F },
    () => []
  );
  for (let f = 0; f < F; f++) {
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (floorGrids[f][idxW(x, y, W)] === 0) {
          floorWalkableCells[f].push([x, y]);
        }
      }
    }
  }

  const distsFromSpawn =
    F > 1
      ? computeMultiFloorDistances(floorGrids, W, stairs, 0, 2, 2)
      : [bfsDistances(floorGrids[0], 2, 2, undefined, W)];

  // Distribute 7 Keys across regions (and across all 3 floors on gedung!)
  const desiredKeyTargets: Array<{ floor: number; region: RegionId }> =
    mapId === 'gedung'
      ? [
          { floor: 0, region: 'depot' },
          { floor: 0, region: 'service' },
          { floor: 1, region: 'admin' },
          { floor: 1, region: 'service' },
          { floor: 1, region: 'outer' },
          { floor: 2, region: 'admin' },
          { floor: 2, region: 'outer' },
        ]
      : [
          { floor: 0, region: 'depot' },
          { floor: 0, region: 'depot' },
          { floor: 0, region: 'admin' },
          { floor: 0, region: 'admin' },
          { floor: 0, region: 'service' },
          { floor: 0, region: 'service' },
          { floor: 0, region: 'outer' },
        ];

  const keys: KeyNode[] = [];
  const placedKeys: Array<{ floor: number; x: number; y: number }> = [];

  const minKeySpawnDist = W < 72 ? 12 : 18;
  const minKeyGap = W < 72 ? 9 : 14;
  for (let k = 0; k < TOTAL_KEYS; k++) {
    const { floor: tf, region: targetReg } = desiredKeyTargets[k];
    const distArr = distsFromSpawn[tf];
    const resSet = reservedByFloor[tf];
    const regGrid = floorRegionGrids[tf];

    const pool = floorWalkableCells[tf].filter(([x, y]) => {
      const i = idxW(x, y, W);
      if (resSet.has(i) || distArr[i] < minKeySpawnDist) return false;
      if (regionIndexToId(regGrid[i]) !== targetReg) return false;
      return placedKeys.every(
        (pk) => pk.floor !== tf || Math.hypot(x - pk.x, y - pk.y) >= minKeyGap
      );
    });

    const fallbackPool =
      pool.length > 0
        ? pool
        : floorWalkableCells[tf].filter(([x, y]) => {
            const i = idxW(x, y, W);
            return (
              !resSet.has(i) &&
              distArr[i] >= Math.max(10, minKeySpawnDist - 4) &&
              placedKeys.every(
                (pk) => pk.floor !== tf || Math.hypot(x - pk.x, y - pk.y) >= 7
              )
            );
          });

    fallbackPool.sort((a, b) => distArr[idxW(b[0], b[1], W)] - distArr[idxW(a[0], a[1], W)]);
    const topSlice = fallbackPool.slice(0, Math.max(1, Math.floor(fallbackPool.length * 0.45)));
    const [kx, ky] = topSlice[Math.floor(rng() * topSlice.length)];

    resSet.add(idxW(kx, ky, W));
    placedKeys.push({ floor: tf, x: kx, y: ky });
    keys.push({
      index: k,
      floor: tf,
      x: kx,
      y: ky,
      region: regionIndexToId(regGrid[idxW(kx, ky, W)]),
      label: KEY_METADATA[k].label,
      code: KEY_METADATA[k].code,
    });
  }

  // Place Guard NPCs scaled per map difficulty
  const regionCycle: RegionId[] = ['depot', 'admin', 'service', 'outer'];
  const guards: Array<{ floor: number; x: number; y: number; region: RegionId }> = [];
  const minGuardSpawnDist = W < 72 ? 12 : 16;
  const minGuardGap = W < 72 ? 6 : 8;
  for (let g = 0; g < def.guardCount; g++) {
    const gf = F > 1 ? g % F : 0;
    const targetReg = regionCycle[g % regionCycle.length];
    const distArr = distsFromSpawn[gf];
    const resSet = reservedByFloor[gf];
    const regGrid = floorRegionGrids[gf];

    const pool = floorWalkableCells[gf].filter(([x, y]) => {
      const i = idxW(x, y, W);
      if (resSet.has(i) || distArr[i] < minGuardSpawnDist) return false;
      if (regionIndexToId(regGrid[i]) !== targetReg) return false;
      return guards.every(
        (og) => og.floor !== gf || Math.hypot(x - og.x, y - og.y) >= minGuardGap
      );
    });
    const finalPool =
      pool.length > 0
        ? pool
        : floorWalkableCells[gf].filter(
            ([x, y]) => !resSet.has(idxW(x, y, W)) && distArr[idxW(x, y, W)] >= 12
          );
    const [gx, gy] = finalPool[Math.floor(rng() * finalPool.length)];
    resSet.add(idxW(gx, gy, W));
    guards.push({
      floor: gf,
      x: gx,
      y: gy,
      region: regionIndexToId(regGrid[idxW(gx, gy, W)]),
    });
  }

  // Place Environmental Traps scaled per map
  const traps: Array<{ floor: number; x: number; y: number; offset: number }> = [];
  let trapTries = 0;
  while (traps.length < def.trapCount && trapTries++ < 8000) {
    const tf = F > 1 ? traps.length % F : 0;
    const cells = floorWalkableCells[tf];
    const [tx, ty] = cells[Math.floor(rng() * cells.length)];
    const i = idxW(tx, ty, W);
    if (reservedByFloor[tf].has(i) || distsFromSpawn[tf][i] < 10) continue;
    if (traps.some((t) => t.floor === tf && Math.abs(t.x - tx) + Math.abs(t.y - ty) < 5)) {
      continue;
    }
    if (
      doors.some(
        (d) =>
          d.floor === tf &&
          d.cells.some(([dx, dy]) => Math.abs(dx - tx) + Math.abs(dy - ty) <= 2)
      )
    ) {
      continue;
    }
    reservedByFloor[tf].add(i);
    traps.push({
      floor: tf,
      x: tx,
      y: ty,
      offset: rng() * TRAP_CYCLE,
    });
  }

  // Place Grounded Environmental Props against walls across floors
  const storyBook = { floor: 0, x: 4, y: 2 };
  reservedByFloor[0].add(idxW(storyBook.x, storyBook.y, W));

  const props: PropNode[] = [];
  for (let f = 0; f < F; f++) {
    const g = floorGrids[f];
    const regG = floorRegionGrids[f];
    const resSet = reservedByFloor[f];
    for (let y = 2; y < W - 2; y += 2) {
      for (let x = 2; x < W - 2; x += 2) {
        const i = idxW(x, y, W);
        if (g[i] !== 0 || resSet.has(i)) continue;
        if (f === 0 && x <= 5 && y <= 5 && !(x === 5 && y === 1)) continue;

        const wallNeighbors = DIRS.filter(([dx, dy]) => g[idxW(x + dx, y + dy, W)] === 1);
        const openNeighbors = DIRS.filter(([dx, dy]) => g[idxW(x + dx, y + dy, W)] === 0);
        if (wallNeighbors.length >= 1 && openNeighbors.length >= 2 && rng() < 0.075) {
          const reg = regionIndexToId(regG[i]);
          let kind: PropNode['kind'] = 'crate';
          if (reg === 'admin') kind = rng() < 0.55 ? 'desk' : 'shelf';
          else if (reg === 'service') kind = rng() < 0.6 ? 'barrel' : 'crate';
          else if (reg === 'depot') kind = rng() < 0.35 ? 'shelf' : 'crate';

          const [wx, wy] = wallNeighbors[0];
          const yaw = Math.atan2(-wx, -wy);
          props.push({ floor: f, x, y, kind, yaw, region: reg });
        }
      }
    }
  }

  // Starting bay story table + decorative props
  props.push({ floor: 0, x: storyBook.x, y: storyBook.y, kind: 'desk', yaw: -Math.PI / 2, region: 'depot' });
  props.push({ floor: 0, x: 5, y: 1, kind: 'crate', yaw: 0.2, region: 'depot' });
  props.push({ floor: 0, x: 1, y: 5, kind: 'barrel', yaw: 0.4, region: 'depot' });

  return {
    mapId,
    width: W,
    floors: F,
    seed,
    grid: floorGrids[0],
    floorGrids,
    regionGrid: floorRegionGrids[0],
    floorRegionGrids,
    spawn: { floor: 0, x: 2.5, y: 2.5, yaw: -Math.PI / 2 },
    storyBook,
    keys,
    doors,
    exits,
    stairs,
    guards,
    traps,
    props,
    walkableCells: floorWalkableCells[0],
    floorWalkableCells,
    regionNames: def.regionNames,
  };
}

export function gridToWorld(gx: number, gy: number): { x: number; z: number } {
  return {
    x: gx * CELL_SIZE,
    z: gy * CELL_SIZE,
  };
}
