import { MAZE_SIZE } from '../maze/MazeConfig';
import { findShortestPath } from '../maze/Pathfinding';
import { checkPositionBlocked } from '../player/Collision';
import type { CollisionWorld } from '../player/Collision';
import type { DifficultyLevel, GuardNode } from '../types/game';

export interface DifficultyProfile {
  speedMult: number;
  seeRange: number;
  dropRange: number;
  encounterTime: number;
  recoveryInvuln: number;
}

export const DIFFICULTY_PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: {
    speedMult: 0.75,
    seeRange: 4.5,
    dropRange: 7.5,
    encounterTime: 12,
    recoveryInvuln: 3.5,
  },
  normal: {
    speedMult: 1.0,
    seeRange: 6.0,
    dropRange: 9.5,
    encounterTime: 10,
    recoveryInvuln: 2.5,
  },
  sulit: {
    speedMult: 1.24,
    seeRange: 7.5,
    dropRange: 11.5,
    encounterTime: 8,
    recoveryInvuln: 2.0,
  },
};

const BASE_PATROL_SPEED = 1.45;
const BASE_CHASE_SPEED = 2.55;
const BASE_RETURN_SPEED = 1.8;
const REPATH_INTERVAL = 0.4;

export function buildGuardBlockedMask(world: CollisionWorld): Uint8Array {
  const W = world.width ?? MAZE_SIZE;
  const activeFloor = world.floor ?? 0;
  const mask = new Uint8Array(W * W);
  for (const door of world.doors) {
    if ((door.floor ?? 0) !== activeFloor) continue;
    if (door.openLeft <= 0) {
      for (const [dx, dy] of door.cells) {
        mask[dy * W + dx] = 1;
      }
    }
  }
  for (const trap of world.traps) {
    if ((trap.floor ?? 0) !== activeFloor) continue;
    if (trap.state === 2) {
      mask[trap.y * W + trap.x] = 1;
    }
  }
  return mask;
}

export function stepGuard(
  guard: GuardNode,
  playerPos: { x: number; y: number },
  world: CollisionWorld,
  walkableCells: Array<[number, number]>,
  blockedMask: Uint8Array,
  difficulty: DifficultyLevel,
  dt: number,
  rng: () => number,
  onAlert?: () => void,
  mapScale?: { speedMult?: number; sightMult?: number }
): void {
  const baseProfile = DIFFICULTY_PROFILES[difficulty];
  const speedMult = baseProfile.speedMult * (mapScale?.speedMult ?? 1);
  const seeRange = baseProfile.seeRange * (mapScale?.sightMult ?? 1);
  const dropRange = baseProfile.dropRange * (mapScale?.sightMult ?? 1);
  const dist = Math.hypot(playerPos.x - guard.x, playerPos.y - guard.y);

  if (guard.stunTimer > 0) {
    guard.stunTimer = Math.max(0, guard.stunTimer - dt);
    guard.state = guard.stunTimer > 0 ? 'stunned' : 'return';
    guard.speed = 0;
    return;
  }

  // State transitions with hysteresis
  if (guard.state === 'chase') {
    if (dist > dropRange) {
      guard.state = 'return';
      guard.returnDelay = 1.2;
      guard.path = [];
      guard.repathCd = 0;
    }
  } else if (guard.state === 'alert') {
    guard.returnDelay -= dt;
    if (dist > dropRange) {
      guard.state = 'return';
      guard.path = [];
    } else if (guard.returnDelay <= 0) {
      guard.state = 'chase';
      guard.repathCd = 0;
    }
  } else if (dist < seeRange) {
    guard.state = 'alert';
    guard.returnDelay = 0.25;
    onAlert?.();
  } else if (guard.state === 'return') {
    if (guard.returnDelay > 0) {
      guard.returnDelay -= dt;
      guard.speed = 0;
      return;
    }
  }

  guard.repathCd -= dt;

  // Invalidate path if next cell became blocked (e.g. door closed or trap active)
  if (guard.path.length > 0) {
    const [nx, ny] = guard.path[0];
    if (
      world.grid[ny * (world.width ?? MAZE_SIZE) + nx] === 1 ||
      blockedMask[ny * (world.width ?? MAZE_SIZE) + nx] === 1
    ) {
      guard.path = [];
      guard.repathCd = 0;
    }
  }

  let targetSpeed = BASE_PATROL_SPEED * speedMult;
  if (guard.state === 'chase') {
    targetSpeed = BASE_CHASE_SPEED * speedMult;
    if (guard.repathCd <= 0) {
      guard.repathCd = REPATH_INTERVAL;
      const px = Math.floor(playerPos.x);
      const py = Math.floor(playerPos.y);
      const path = findShortestPath(
        world.grid,
        Math.floor(guard.x),
        Math.floor(guard.y),
        px,
        py,
        blockedMask,
        world.width ?? MAZE_SIZE
      );
      guard.path = path;
    }
  } else if (guard.state === 'alert') {
    targetSpeed = BASE_PATROL_SPEED * 0.5;
  } else if (guard.state === 'return') {
    targetSpeed = BASE_RETURN_SPEED * speedMult;
    if (Math.hypot(guard.x - (guard.homeX + 0.5), guard.y - (guard.homeY + 0.5)) < 0.7) {
      guard.state = 'patrol';
      guard.idleTimer = 0.8;
      guard.path = [];
    } else if (guard.path.length === 0 && guard.repathCd <= 0) {
      guard.repathCd = 0.6;
      guard.path = findShortestPath(
        world.grid,
        Math.floor(guard.x),
        Math.floor(guard.y),
        guard.homeX,
        guard.homeY,
        blockedMask,
        world.width ?? MAZE_SIZE
      );
    }
  } else {
    // patrol
    if (guard.idleTimer > 0) {
      guard.idleTimer -= dt;
      targetSpeed = 0;
    } else if (guard.path.length === 0 && guard.repathCd <= 0) {
      guard.repathCd = 0.6;
      // Pick a nearby walkable waypoint within 14 cells of home
      const nearby = walkableCells.filter(
        ([wx, wy]) => Math.hypot(wx - guard.homeX, wy - guard.homeY) <= 14
      );
      const pool = nearby.length > 0 ? nearby : walkableCells;
      const [wx, wy] = pool[Math.floor(rng() * pool.length)];
      const path = findShortestPath(
        world.grid,
        Math.floor(guard.x),
        Math.floor(guard.y),
        wx,
        wy,
        blockedMask,
        world.width ?? MAZE_SIZE
      );
      if (path.length > 0) guard.path = path;
      else guard.idleTimer = 0.5;
    }
  }

  // Smooth acceleration
  guard.speed += (targetSpeed - guard.speed) * Math.min(1, 6 * dt);

  if (guard.path.length > 0 && guard.speed > 0.01) {
    const [tx, ty] = guard.path[0];
    const dx = tx + 0.5 - guard.x;
    const dy = ty + 0.5 - guard.y;
    const len = Math.hypot(dx, dy);
    const step = guard.speed * dt;

    let nx = guard.x;
    let ny = guard.y;
    if (len <= step) {
      nx = tx + 0.5;
      ny = ty + 0.5;
      guard.path.shift();
      if (guard.path.length === 0 && guard.state === 'patrol') {
        guard.idleTimer = 0.8 + rng() * 1.4;
      }
    } else if (len > 0.0001) {
      nx += (dx / len) * step;
      ny += (dy / len) * step;
    }

    if (len > 0.01) {
      guard.facingYaw = Math.atan2(dx, dy);
    }

    let moved = false;
    if (!checkPositionBlocked(world, nx, guard.y, guard.x, guard.y, 0.24)) {
      guard.x = nx;
      moved = true;
    }
    if (!checkPositionBlocked(world, guard.x, ny, guard.x, guard.y, 0.24)) {
      guard.y = ny;
      moved = true;
    }

    if (!moved) {
      guard.path = [];
      guard.repathCd = 0.2;
    }
  }
}
