import { MAP_CATALOG, TOTAL_KEYS } from './MazeConfig';
import { computeMultiFloorDistances } from './MazeGenerator';
import { DIRS, bfsDistances } from './Pathfinding';
import type { MazeLayout } from '../types/game';

export interface MazeValidationResult {
  ok: boolean;
  errors: string[];
  stats: {
    walkableCount: number;
    keysReachable: number;
    exitsReachable: number;
    independentExitRoutes: number;
    narrowCorridorViolations: number;
  };
}

export function validateMaze(layout: MazeLayout): MazeValidationResult {
  const errors: string[] = [];
  const def = MAP_CATALOG[layout.mapId] ?? MAP_CATALOG.gudang;
  const W = layout.width;
  const F = layout.floors ?? 1;

  if (W !== def.gridSize) {
    errors.push(`Lebar maze ${W}, harus ${def.gridSize}`);
  }
  if (F !== def.floors) {
    errors.push(`Jumlah lantai ${F}, harus ${def.floors}`);
  }
  if (layout.floorGrids.length !== F) {
    errors.push(`Jumlah floorGrids ${layout.floorGrids.length}, harus ${F}`);
  }
  for (let f = 0; f < layout.floorGrids.length; f++) {
    if (layout.floorGrids[f].length !== W * W) {
      errors.push(`Ukuran grid lantai ${f + 1} tidak sesuai ${W}x${W}`);
    }
  }

  // 1. Outer boundary must be solid wall on all floors
  for (let f = 0; f < layout.floorGrids.length; f++) {
    const grid = layout.floorGrids[f];
    for (let i = 0; i < W; i++) {
      if (
        grid[i] !== 1 ||
        grid[(W - 1) * W + i] !== 1 ||
        grid[i * W] !== 1 ||
        grid[i * W + (W - 1)] !== 1
      ) {
        errors.push(`Batas luar lantai ${f + 1} tidak sepenuhnya tertutup dinding`);
        break;
      }
    }
  }

  // 2. Spawn must be open on spawn floor
  const sf = layout.spawn.floor ?? 0;
  const sx = Math.floor(layout.spawn.x);
  const sy = Math.floor(layout.spawn.y);
  if (layout.floorGrids[sf]?.[sy * W + sx] !== 0) {
    errors.push('Titik spawn berada di dalam dinding');
  }

  // 3. Check corridor width across all floors
  let narrowViolations = 0;
  for (let f = 0; f < layout.floorGrids.length; f++) {
    const grid = layout.floorGrids[f];
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (grid[y * W + x] !== 0) continue;
        const openH =
          grid[y * W + (x - 1)] === 0 || grid[y * W + (x + 1)] === 0;
        const openV =
          grid[(y - 1) * W + x] === 0 || grid[(y + 1) * W + x] === 0;
        if (!openH || !openV) {
          narrowViolations++;
        }
      }
    }
  }
  if (narrowViolations > 0) {
    errors.push(`Ditemukan ${narrowViolations} sel koridor sempit (<2 sel)`);
  }

  // 4. Multi-floor BFS with all doors open
  const distAllOpen =
    F > 1
      ? computeMultiFloorDistances(layout.floorGrids, W, layout.stairs, sf, sx, sy)
      : [bfsDistances(layout.grid, sx, sy, undefined, W)];

  if (F > 1) {
    if (layout.stairs.length < 2) {
      errors.push(`Gedung bertingkat harus memiliki minimal 2 tangga, ditemukan ${layout.stairs.length}`);
    }
    for (let f = 0; f < F; f++) {
      const anyReachable = distAllOpen[f].some((d) => d >= 0);
      if (!anyReachable) {
        errors.push(`Lantai ${f + 1} tidak terjangkau melalui tangga`);
      }
    }
  }

  let keysReachable = 0;
  if (layout.keys.length !== TOTAL_KEYS) {
    errors.push(`Jumlah kunci ${layout.keys.length}, harus ${TOTAL_KEYS}`);
  }
  for (const key of layout.keys) {
    const kf = key.floor ?? 0;
    const d = distAllOpen[kf]?.[key.y * W + key.x] ?? -1;
    if (d < 0) {
      errors.push(`Kunci ${key.code} Lt.${kf + 1} (${key.x}, ${key.y}) tidak terjangkau dari spawn`);
    } else {
      keysReachable++;
    }
    if (
      kf === sf &&
      Math.hypot(key.x + 0.5 - layout.spawn.x, key.y + 0.5 - layout.spawn.y) < 5
    ) {
      errors.push(`Kunci ${key.code} terlalu dekat dengan spawn`);
    }
  }

  // 5. Quiz doors check
  if (layout.doors.length !== 4) {
    errors.push(`Jumlah pintu kuis ${layout.doors.length}, harus 4`);
  }

  const closedDoorsMasks = Array.from({ length: F }, () => new Uint8Array(W * W));
  for (const door of layout.doors) {
    const df = door.floor ?? 0;
    for (const [dx, dy] of door.cells) {
      closedDoorsMasks[df][dy * W + dx] = 1;
    }
  }
  const distDoorsClosed =
    F > 1
      ? computeMultiFloorDistances(
          layout.floorGrids,
          W,
          layout.stairs,
          sf,
          sx,
          sy,
          closedDoorsMasks
        )
      : [bfsDistances(layout.grid, sx, sy, closedDoorsMasks[0], W)];

  let exitsReachable = 0;
  let exitsReachableWithoutDoors = 0;
  if (layout.exits.length < 3) {
    errors.push(`Jumlah rute keluar ${layout.exits.length}, minimal 3`);
  }

  for (const exit of layout.exits) {
    const ef = exit.floor ?? 0;
    const [ax, ay] = exit.approachCell;
    if ((distAllOpen[ef]?.[ay * W + ax] ?? -1) < 0) {
      errors.push(`Rute keluar ${exit.routeId} tidak terjangkau`);
    } else {
      exitsReachable++;
    }
    if ((distDoorsClosed[ef]?.[ay * W + ax] ?? -1) >= 0) {
      exitsReachableWithoutDoors++;
    }
  }

  if (exitsReachableWithoutDoors < 2) {
    errors.push('Pintu kuis memblokir terlalu banyak rute keluar sekaligus');
  }

  // 6. Verify 3 exit gates are independently reachable
  let independentExitRoutes = 0;
  for (let i = 0; i < layout.exits.length; i++) {
    const blockOthers = new Uint8Array(W * W);
    for (let j = 0; j < layout.exits.length; j++) {
      if (i === j) continue;
      for (const [cx, cy] of layout.exits[j].cells) {
        blockOthers[cy * W + cx] = 1;
      }
      const [ax, ay] = layout.exits[j].approachCell;
      blockOthers[ay * W + ax] = 1;
    }
    const distWithoutOthers = bfsDistances(layout.grid, sx, sy, blockOthers, W);
    const [tx, ty] = layout.exits[i].approachCell;
    if (distWithoutOthers[ty * W + tx] >= 0) {
      independentExitRoutes++;
    }
  }

  if (independentExitRoutes < 3) {
    errors.push(`Hanya ${independentExitRoutes}/3 rute keluar yang independen`);
  }

  // 7. Guards check
  if (layout.guards.length !== def.guardCount) {
    errors.push(`Jumlah penjaga ${layout.guards.length}, harus ${def.guardCount}`);
  }
  for (let g = 0; g < layout.guards.length; g++) {
    const guard = layout.guards[g];
    const gf = guard.floor ?? 0;
    if (
      gf === sf &&
      Math.hypot(guard.x + 0.5 - layout.spawn.x, guard.y + 0.5 - layout.spawn.y) < 10
    ) {
      errors.push(`Penjaga #${g + 1} terlalu dekat dengan spawn`);
    }
    if (layout.floorGrids[gf]?.[guard.y * W + guard.x] !== 0) {
      errors.push(`Penjaga #${g + 1} berada di dinding (Lt. ${gf + 1})`);
    }
  }

  const totalWalkable = layout.floorWalkableCells.reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  void DIRS;

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      walkableCount: totalWalkable,
      keysReachable,
      exitsReachable,
      independentExitRoutes,
      narrowCorridorViolations: narrowViolations,
    },
  };
}
