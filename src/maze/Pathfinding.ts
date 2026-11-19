import { MAZE_SIZE } from './MazeConfig';

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bfsDistances(
  grid: Uint8Array,
  startX: number,
  startY: number,
  blocked?: Uint8Array,
  width = MAZE_SIZE
): Int32Array {
  const dist = new Int32Array(width * width).fill(-1);
  if (
    startX < 0 ||
    startY < 0 ||
    startX >= width ||
    startY >= width ||
    grid[startY * width + startX] === 1 ||
    (blocked && blocked[startY * width + startX] === 1)
  ) {
    return dist;
  }

  const queue: number[] = [startY * width + startX];
  dist[queue[0]] = 0;

  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % width;
    const y = (idx / width) | 0;
    const nextDist = dist[idx] + 1;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= width) continue;
      const nIdx = ny * width + nx;
      if (grid[nIdx] !== 0 || dist[nIdx] >= 0) continue;
      if (blocked && blocked[nIdx]) continue;
      dist[nIdx] = nextDist;
      queue.push(nIdx);
    }
  }

  return dist;
}

export function findShortestPath(
  grid: Uint8Array,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  blocked?: Uint8Array,
  width = MAZE_SIZE
): Array<[number, number]> {
  if (startX === targetX && startY === targetY) return [];
  const startIdx = startY * width + startX;
  const targetIdx = targetY * width + targetX;

  if (
    startX < 0 ||
    startY < 0 ||
    startX >= width ||
    startY >= width ||
    targetX < 0 ||
    targetY < 0 ||
    targetX >= width ||
    targetY >= width
  ) {
    return [];
  }
  if (grid[targetIdx] !== 0 || (blocked && blocked[targetIdx])) return [];

  const parent = new Int32Array(width * width).fill(-1);
  const queue: number[] = [startIdx];
  parent[startIdx] = startIdx;

  let found = false;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    if (idx === targetIdx) {
      found = true;
      break;
    }
    const x = idx % width;
    const y = (idx / width) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= width) continue;
      const nIdx = ny * width + nx;
      if (grid[nIdx] !== 0 || parent[nIdx] >= 0) continue;
      if (blocked && blocked[nIdx]) continue;
      parent[nIdx] = idx;
      queue.push(nIdx);
    }
  }

  if (!found) return [];
  const path: Array<[number, number]> = [];
  for (let cur = targetIdx; cur !== startIdx; cur = parent[cur]) {
    path.unshift([cur % width, (cur / width) | 0]);
  }
  return path;
}
