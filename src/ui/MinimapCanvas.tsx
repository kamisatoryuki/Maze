import React, { useEffect, useRef } from 'react';
import type { GuardNode, MazeLayout, QuizDoorNode } from '../types/game';

interface MinimapCanvasProps {
  layout: MazeLayout | null;
  explored: Uint8Array | null;
  playerX: number;
  playerY: number;
  yaw: number;
  collectedKeys: Set<number>;
  doors: QuizDoorNode[];
  guards: GuardNode[];
  exitsUnlocked: boolean;
  size?: number;
  floor?: number;
  showPlayer?: boolean;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  layout,
  explored,
  playerX,
  playerY,
  yaw,
  collectedKeys,
  doors,
  guards,
  exitsUnlocked,
  size = 156,
  floor = 0,
  showPlayer = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !explored) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = layout.width;
    const scale = size / W;
    const grid = layout.floorGrids?.[floor] ?? layout.grid;
    const regionGrid = layout.floorRegionGrids?.[floor] ?? layout.regionGrid;

    // Archival parchment background for unexplored fog
    ctx.fillStyle = '#1b1915';
    ctx.fillRect(0, 0, size, size);

    // Subtle ink grid lines across fog
    ctx.strokeStyle = 'rgba(212, 162, 76, 0.08)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= size; g += 16) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(size, g);
      ctx.stroke();
    }

    // Draw explored floor & walls in hand-drawn parchment-and-ink style
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!explored[idx]) continue;

        const px = x * scale;
        const py = y * scale;
        const cellSize = Math.ceil(scale);

        if (grid[idx] === 1) {
          ctx.fillStyle = '#262118';
          ctx.fillRect(px, py, cellSize, cellSize);
        } else {
          const reg = regionGrid[idx];
          ctx.fillStyle =
            reg === 1
              ? '#cfc19f'
              : reg === 2
              ? '#c5bcac'
              : reg === 3
              ? '#d4c8a6'
              : '#dfd3b6';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }
    }

    // Staircases on this floor (visible once explored or within enlarged overview)
    if (layout.stairs && layout.stairs.length > 0) {
      ctx.font = `bold ${Math.max(8, Math.round(scale * 2.2))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const s of layout.stairs) {
        if (s.fromFloor !== floor && s.toFloor !== floor) continue;
        const isUp = s.fromFloor === floor;
        const sx = s.x * scale;
        const sy = s.y * scale;
        const sw = Math.max(4, s.w * scale);
        const sh = Math.max(4, s.h * scale);

        ctx.fillStyle = isUp ? 'rgba(56, 189, 248, 0.88)' : 'rgba(92, 214, 146, 0.88)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#0d1118';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, sw, sh);

        ctx.fillStyle = '#0b0e13';
        ctx.fillText(isUp ? '▲' : '▼', sx + sw / 2, sy + sh / 2 + 0.5);
      }
    }

    // Quiz doors on this floor
    for (const d of doors) {
      if ((d.floor ?? 0) !== floor) continue;
      const isVisible = d.cells.some(([cx, cy]) => explored[cy * W + cx] === 1);
      if (!isVisible) continue;
      ctx.fillStyle = d.openLeft > 0 ? '#34a86b' : '#d4822a';
      for (const [cx, cy] of d.cells) {
        ctx.fillRect(cx * scale, cy * scale, Math.max(2, scale), Math.max(2, scale));
      }
    }

    // Uncollected keys on this floor in explored cells
    for (const k of layout.keys) {
      if ((k.floor ?? 0) !== floor) continue;
      if (collectedKeys.has(k.index)) continue;
      if (!explored[k.y * W + k.x]) continue;
      const kx = (k.x + 0.5) * scale;
      const ky = (k.y + 0.5) * scale;
      ctx.fillStyle = '#d98c00';
      ctx.beginPath();
      ctx.moveTo(kx, ky - 3);
      ctx.lineTo(kx + 3, ky);
      ctx.lineTo(kx, ky + 3);
      ctx.lineTo(kx - 3, ky);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1d160b';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Escape Route gates A/B/C (on floor 0)
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ex of layout.exits) {
      if ((ex.floor ?? 0) !== floor) continue;
      const avgX =
        ex.cells.reduce((acc, [cx]) => acc + cx + 0.5, 0) / ex.cells.length;
      const avgY =
        ex.cells.reduce((acc, [, cy]) => acc + cy + 0.5, 0) / ex.cells.length;
      const gx = Math.max(6, Math.min(size - 6, avgX * scale));
      const gy = Math.max(6, Math.min(size - 6, avgY * scale));
      const exploredHere = ex.cells.some(([cx, cy]) => explored[cy * W + cx] === 1);

      ctx.fillStyle = exitsUnlocked
        ? '#279158'
        : exploredHere
        ? '#a93832'
        : 'rgba(169, 56, 50, 0.45)';
      ctx.fillRect(gx - 5, gy - 5, 10, 10);
      ctx.strokeStyle = exitsUnlocked ? '#9ee6bd' : 'rgba(235, 227, 208, 0.35)';
      ctx.lineWidth = 0.9;
      ctx.strokeRect(gx - 5, gy - 5, 10, 10);
      ctx.fillStyle = exitsUnlocked ? '#f8f5ec' : 'rgba(248, 245, 236, 0.72)';
      ctx.fillText(ex.routeId, gx, gy + 0.5);
    }

    // Nearby guards on this floor
    for (const g of guards) {
      if ((g.floor ?? 0) !== floor) continue;
      const gxCell = Math.floor(g.x);
      const gyCell = Math.floor(g.y);
      const dist = Math.hypot(g.x - playerX, g.y - playerY);
      if (!explored[gyCell * W + gxCell] && (!showPlayer || dist > 8)) continue;
      ctx.fillStyle = g.state === 'chase' || g.state === 'alert' ? '#dc2626' : '#8f2d28';
      ctx.beginPath();
      ctx.arc(g.x * scale, g.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player chevron arrow when viewing player's active floor
    if (showPlayer) {
      const px = playerX * scale;
      const py = playerY * scale;
      const fx = -Math.sin(yaw);
      const fy = -Math.cos(yaw);
      const rx = -fy;
      const ry = fx;

      ctx.fillStyle = '#1b4372';
      ctx.strokeStyle = '#faf5e8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + fx * 5.2, py + fy * 5.2);
      ctx.lineTo(px - fx * 3.5 + rx * 3.6, py - fy * 3.5 + ry * 3.6);
      ctx.lineTo(px - fx * 1.8, py - fy * 1.8);
      ctx.lineTo(px - fx * 3.5 - rx * 3.6, py - fy * 3.5 - ry * 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Crisp outer drafting border
    ctx.strokeStyle = '#d4a24c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, size - 1.5, size - 1.5);
  }, [
    layout,
    explored,
    playerX,
    playerY,
    yaw,
    collectedKeys,
    doors,
    guards,
    exitsUnlocked,
    size,
    floor,
    showPlayer,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block shadow-lg"
      aria-label="Peta mini labirin 1942"
    />
  );
};
