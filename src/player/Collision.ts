import { MAZE_SIZE, PLAYER_RADIUS } from '../maze/MazeConfig';
import type { PropNode, QuizDoorNode, TrapNode } from '../types/game';

export interface CollisionWorld {
  grid: Uint8Array;
  width?: number;
  floor?: number;
  doors: QuizDoorNode[];
  traps: TrapNode[];
  props: PropNode[];
}

export function isCellSolid(
  world: CollisionWorld,
  tx: number,
  ty: number
): boolean {
  const W = world.width ?? MAZE_SIZE;
  const activeFloor = world.floor ?? 0;
  if (tx < 0 || ty < 0 || tx >= W || ty >= W) return true;
  if (world.grid[ty * W + tx] === 1) return true;

  for (const door of world.doors) {
    if ((door.floor ?? 0) !== activeFloor) continue;
    if (door.openLeft > 0) continue;
    for (const [dx, dy] of door.cells) {
      if (dx === tx && dy === ty) return true;
    }
  }

  return false;
}

export function checkPositionBlocked(
  world: CollisionWorld,
  x: number,
  y: number,
  currentX: number,
  currentY: number,
  radius = PLAYER_RADIUS
): boolean {
  const activeFloor = world.floor ?? 0;
  const curTx = Math.floor(currentX);
  const curTy = Math.floor(currentY);

  // Check 4 corners of circle AABB against solid walls & closed quiz doors
  const corners: Array<[number, number]> = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];

  for (const [cx, cy] of corners) {
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    if (isCellSolid(world, tx, ty)) return true;

    // Active steam-grate trap blocks entry from outside its cell (same behavior as legacy spike)
    if (tx !== curTx || ty !== curTy) {
      for (const trap of world.traps) {
        if ((trap.floor ?? 0) !== activeFloor) continue;
        if (trap.x === tx && trap.y === ty && trap.state === 2) {
          return true;
        }
      }
    }
  }

  // Check solid environmental warehouse props (crates, shelves, desks, barrels)
  // Props occupy a 0.36-cell radius at cell center (prop.x + 0.5, prop.y + 0.5)
  const propMinDist = radius + 0.30;
  for (const prop of world.props) {
    if ((prop.floor ?? 0) !== activeFloor) continue;
    const px = prop.x + 0.5;
    const py = prop.y + 0.5;
    if (
      Math.abs(x - px) < propMinDist &&
      Math.abs(y - py) < propMinDist
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Moves entity by (dx, dy) with axis separation and sub-stepping so fast dodge
 * movements can never tunnel through walls or closed doors.
 */
export function moveWithCollision(
  world: CollisionWorld,
  pos: { x: number; y: number },
  dx: number,
  dy: number,
  radius = PLAYER_RADIUS
): { x: number; y: number; collided: boolean } {
  let nx = pos.x;
  let ny = pos.y;
  let collided = false;

  const totalDist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(totalDist / 0.2));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 0; i < steps; i++) {
    if (stepX !== 0) {
      if (!checkPositionBlocked(world, nx + stepX, ny, nx, ny, radius)) {
        nx += stepX;
      } else {
        collided = true;
      }
    }
    if (stepY !== 0) {
      if (!checkPositionBlocked(world, nx, ny + stepY, nx, ny, radius)) {
        ny += stepY;
      } else {
        collided = true;
      }
    }
  }

  return { x: nx, y: ny, collided };
}
