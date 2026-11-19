import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Map as MapIcon,
  Pause,
  KeyRound,
  Shield,
  Zap,
  Compass,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { MinimapCanvas } from './MinimapCanvas';
import type {
  GameSettings,
  GuardNode,
  HudSnapshot,
  MazeLayout,
  QuizDoorNode,
} from '../types/game';

interface HUDProps {
  hud: HudSnapshot;
  settings: GameSettings;
  mapExpanded: boolean;
  toast: string | null;
  flash: 'amber' | 'red' | 'green' | null;
  layout: MazeLayout | null;
  explored: Uint8Array | null;
  exploredFloors?: Uint8Array[];
  playerFloor?: number;
  playerX: number;
  playerY: number;
  yaw: number;
  collectedKeys: Set<number>;
  doors: QuizDoorNode[];
  guards: GuardNode[];
  onTogglePause: () => void;
  onToggleMapExpanded: () => void;
  onToggleMute: () => void;
  onTouchSprint: (active: boolean) => void;
  onTriggerInteract: () => void;
  onTouchMove: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  settings,
  mapExpanded,
  toast,
  flash,
  layout,
  explored,
  exploredFloors,
  playerFloor = 0,
  playerX,
  playerY,
  yaw,
  collectedKeys,
  doors,
  guards,
  onTogglePause,
  onToggleMapExpanded,
  onToggleMute,
  onTouchSprint,
  onTriggerInteract,
  onTouchMove,
  onLookDelta,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const [enlargedMapSize, setEnlargedMapSize] = useState(440);
  const [mapViewFloor, setMapViewFloor] = useState(playerFloor);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMapViewFloor(playerFloor);
  }, [playerFloor, mapExpanded]);

  useEffect(() => {
    const checkLayout = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const narrow = window.innerWidth < 768;
      setIsTouchDevice(Boolean(coarse || narrow || navigator.maxTouchPoints > 0));
      setEnlargedMapSize(
        Math.max(260, Math.min(520, Math.floor(Math.min(window.innerWidth * 0.8, window.innerHeight * 0.62))))
      );
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  const staminaPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));

  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchId.current !== null) return;
    const t = e.changedTouches[0];
    joyTouchId.current = t.identifier;
    updateJoystick(t.clientX, t.clientY);
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setJoyKnob({ x: 0, y: 0 });
        onTouchMove(0, 0);
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });

    const deadRatio = settings.joyDeadzone / 100;
    const normDist = Math.min(1, dist / maxR);
    if (normDist < deadRatio) {
      onTouchMove(0, 0);
    } else {
      const scaled = (normDist - deadRatio) / (1 - deadRatio);
      const angle = Math.atan2(dy, dx);
      onTouchMove(Math.cos(angle) * scaled, Math.sin(angle) * scaled);
    }
  };

  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches[0];
    lookTouchId.current = t.identifier;
    lastLookPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        onLookDelta(dx * 1.4, dy * 1.4);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  const canInteractPrompt = Boolean(hud.nearPrompt && hud.nearPrompt.startsWith('Tekan E'));

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Screen-edge feedback flash */}
      {flash && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
            flash === 'red'
              ? 'border-[10px] border-[#c2413b]/75 bg-[#c2413b]/14'
              : flash === 'green'
              ? 'border-[8px] border-[#34a86b]/70 bg-[#34a86b]/12'
              : 'border-[8px] border-[#d4a24c]/70 bg-[#d4a24c]/10'
          }`}
        />
      )}

      {/* Subtle center reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-5 h-5 flex items-center justify-center">
          <div
            className={`w-1 h-1 transition-colors ${
              canInteractPrompt ? 'bg-[#d4a24c]' : 'bg-[#ebe3d0]/75'
            }`}
          />
          {hud.pointerLocked && (
            <>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-1.5 bg-[#ebe3d0]/45" />
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-1.5 bg-[#ebe3d0]/45" />
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-1.5 bg-[#ebe3d0]/45" />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-1.5 bg-[#ebe3d0]/45" />
            </>
          )}
        </div>
      </div>

      {/* Top-Left Telemetry Strip */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 max-w-[290px] sm:max-w-[350px]">
        <div className="bg-[#0d1118]/90 border border-[#d4a24c]/35 px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-[#ebe3d0]/12 pb-1.5 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#d4a24c] font-display tracking-wider uppercase">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{hud.regionName}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono-num text-[#ebe3d0]/65 mt-0.5">
                <span className="truncate">{hud.mapName}</span>
                {hud.totalFloors > 1 && (
                  <span
                    className="px-1.5 py-0.2 bg-[#1c2635] border border-[#38bdf8]/45 text-[#7dd3fc] font-semibold"
                    data-testid="hud-floor"
                  >
                    Lantai {hud.currentFloor + 1}/{hud.totalFloors}
                  </span>
                )}
              </div>
            </div>
            <span
              className="font-mono-num text-sm font-semibold text-[#ebe3d0] shrink-0"
              data-testid="hud-timer"
            >
              {formatClock(hud.elapsedTime)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* 5 Segmented Vitality Bars */}
            <div className="flex items-center gap-1" aria-label={`Nyawa ${hud.lives} dari ${hud.maxLives}`}>
              {Array.from({ length: hud.maxLives }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-4 border transition-colors ${
                    i < hud.lives
                      ? 'bg-[#c2413b] border-[#f0938e]/60'
                      : 'bg-[#1a1f28] border-[#ebe3d0]/18'
                  }`}
                />
              ))}
              <span className="font-mono-num text-xs text-[#ebe3d0]/80 ml-1">
                {hud.lives}/{hud.maxLives}
              </span>
            </div>

            {/* Keys Collected */}
            <div
              className={`flex items-center gap-1 font-mono-num text-xs font-semibold ${
                hud.exitsUnlocked ? 'text-[#5cd692]' : 'text-[#f0c76e]'
              }`}
              data-testid="hud-keys"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>
                {hud.keysCollected}/{hud.totalKeys}
              </span>
            </div>
          </div>

          {/* Sprint Stamina Bar */}
          <div className="mt-2 pt-1.5 border-t border-[#ebe3d0]/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <Zap
                className={`w-3.5 h-3.5 shrink-0 ${
                  hud.isExhausted
                    ? 'text-[#f28b82]'
                    : hud.isSprinting
                    ? 'text-[#5cd692]'
                    : 'text-[#d4a24c]'
                }`}
              />
              <div className="flex-1 h-1.5 bg-[#1b222d] border border-[#ebe3d0]/12 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    hud.isExhausted
                      ? 'bg-[#c2413b]'
                      : hud.isSprinting
                      ? 'bg-[#5cd692]'
                      : 'bg-[#d4a24c]'
                  }`}
                  style={{ width: `${staminaPct}%` }}
                />
              </div>
              <span
                className="font-mono-num text-[11px] text-[#ebe3d0]/80 min-w-[54px] text-right"
                data-testid="hud-stamina"
              >
                {hud.isExhausted
                  ? 'LELAH'
                  : hud.isSprinting
                  ? 'SPRINT'
                  : `${Math.round(staminaPct)}%`}
              </span>
            </div>

            {hud.streak > 0 && (
              <span className="font-mono-num text-[11px] text-[#5cd692] pl-2 border-l border-[#ebe3d0]/15">
                {hud.streak}x
              </span>
            )}
          </div>

          {(hud.exitsUnlocked || hud.isSlowed || hud.isInvuln) && (
            <div className="mt-1.5 text-[11px] font-medium flex flex-wrap gap-x-2.5 gap-y-0.5">
              {hud.exitsUnlocked && (
                <span className="text-[#5cd692]">Semua 3 Jalur Keluar (A/B/C) Terbuka</span>
              )}
              {hud.isSlowed && <span className="text-[#f28b82]">Melambat (Uap)</span>}
              {hud.isInvuln && (
                <span className="text-[#91b6e3] inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Kebal Sesaat
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top-Right Controls & Clickable Corner Minimap */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 bg-[#0d1118]/90 hover:bg-[#1a2230] border border-[#d4a24c]/35 text-[#ebe3d0] transition-colors cursor-pointer"
            aria-label={settings.muted ? 'Nyalakan suara' : 'Bisukan suara'}
            title="Bisukan / Nyalakan Suara"
          >
            {settings.muted ? <VolumeX className="w-4 h-4 text-[#f28b82]" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleMapExpanded}
            className={`p-2 bg-[#0d1118]/90 hover:bg-[#1a2230] border transition-colors cursor-pointer ${
              mapExpanded ? 'border-[#d4a24c] text-[#d4a24c]' : 'border-[#d4a24c]/35 text-[#ebe3d0]/85'
            }`}
            aria-label="Perbesar atau perkecil peta (M)"
            title="Perbesar / Perkecil Peta [M]"
            data-testid="hud-map-btn"
          >
            {mapExpanded ? <Minimize2 className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            className="p-2 bg-[#0d1118]/90 hover:bg-[#1a2230] border border-[#d4a24c]/35 text-[#ebe3d0] transition-colors cursor-pointer"
            aria-label="Jeda permainan (ESC)"
            title="Jeda [ESC]"
            data-testid="hud-pause-btn"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>

        {/* Clickable Corner Minimap (click to enlarge) */}
        {!mapExpanded && (
          <button
            type="button"
            onClick={onToggleMapExpanded}
            className="group relative bg-[#0d1118]/92 p-1 border border-[#d4a24c]/35 hover:border-[#d4a24c] shadow-xl pointer-events-auto cursor-pointer text-left"
            aria-label="Klik untuk memperbesar peta"
            title="Klik atau tekan M untuk memperbesar peta"
            data-testid="corner-minimap-btn"
          >
            <div className="hidden sm:block">
              <MinimapCanvas
                layout={layout}
                explored={exploredFloors?.[playerFloor] ?? explored}
                playerX={playerX}
                playerY={playerY}
                yaw={yaw}
                collectedKeys={collectedKeys}
                doors={doors}
                guards={guards}
                exitsUnlocked={hud.exitsUnlocked}
                floor={playerFloor}
                showPlayer={true}
                size={148}
              />
            </div>
            <div className="block sm:hidden">
              <MinimapCanvas
                layout={layout}
                explored={exploredFloors?.[playerFloor] ?? explored}
                playerX={playerX}
                playerY={playerY}
                yaw={yaw}
                collectedKeys={collectedKeys}
                doors={doors}
                guards={guards}
                exitsUnlocked={hud.exitsUnlocked}
                floor={playerFloor}
                showPlayer={true}
                size={104}
              />
            </div>
            <div className="flex items-center justify-between px-1.5 pt-1 font-mono-num text-[10px] text-[#d4a24c]/90">
              <span>{hud.totalFloors > 1 ? `LT.${playerFloor + 1}` : 'DENAH'}</span>
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="w-2.5 h-2.5" />
                M
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Enlarged Map Overlay (toggled via M or clicking minimap) */}
      {mapExpanded && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#070a0f]/88 p-4 pointer-events-auto"
          onClick={onToggleMapExpanded}
          role="dialog"
          aria-modal="true"
          aria-label={`Peta besar ${hud.mapName}`}
          data-testid="expanded-map-modal"
        >
          <div
            className="bg-[#121720] border border-[#d4a24c]/60 p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#ebe3d0]/12 pb-2">
              <div>
                <h2 className="font-display text-lg uppercase tracking-wider text-[#d4a24c]">
                  Denah {hud.mapName} · 1942
                </h2>
                <p className="text-xs text-[#ebe3d0]/70">
                  Wilayah aktif: {hud.regionName} · Kunci {hud.keysCollected}/{hud.totalKeys}
                  {hud.totalFloors > 1 ? ` · Anda di Lantai ${playerFloor + 1}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleMapExpanded}
                className="p-1.5 bg-[#19202b] hover:bg-[#242e3d] border border-[#d4a24c]/35 text-[#ebe3d0] cursor-pointer"
                aria-label="Perkecil peta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hud.totalFloors > 1 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: hud.totalFloors }).map((_, fIdx) => (
                  <button
                    key={fIdx}
                    type="button"
                    onClick={() => setMapViewFloor(fIdx)}
                    data-testid={`map-floor-tab-${fIdx + 1}`}
                    className={`flex-1 py-1.5 text-xs font-display tracking-wider uppercase border cursor-pointer transition-colors ${
                      mapViewFloor === fIdx
                        ? 'bg-[#d4a24c] text-[#0b0e13] border-[#d4a24c] font-semibold'
                        : 'bg-[#18202c] text-[#ebe3d0]/80 border-[#ebe3d0]/18 hover:border-[#d4a24c]/50'
                    }`}
                  >
                    Lantai {fIdx + 1} {fIdx === playerFloor ? '• Anda' : ''}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <MinimapCanvas
                layout={layout}
                explored={exploredFloors?.[mapViewFloor] ?? explored}
                playerX={playerX}
                playerY={playerY}
                yaw={yaw}
                collectedKeys={collectedKeys}
                doors={doors}
                guards={guards}
                exitsUnlocked={hud.exitsUnlocked}
                floor={mapViewFloor}
                showPlayer={mapViewFloor === playerFloor}
                size={enlargedMapSize}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#ebe3d0]/80 pt-1 border-t border-[#ebe3d0]/10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#1b4372] border border-[#faf5e8]" /> Anda
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#d98c00] rotate-45" /> Kunci
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#d4822a]" /> Pintu Kuis
                </span>
                {hud.totalFloors > 1 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#38bdf8]" /> Tangga ▲/▼
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" /> Penjaga
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#279158]" /> Gerbang A/B/C
                </span>
              </div>
              <span className="font-mono-num text-[#d4a24c]">Tekan [M] atau klik luar untuk tutup</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Center Toast & Contextual Interaction Prompt */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-center ${
          isTouchDevice ? 'bottom-38 max-w-[82vw]' : 'bottom-4 max-w-[92vw]'
        }`}
      >
        {toast && (
          <div className="bg-[#121822]/95 border border-[#d4a24c]/55 px-4 py-1.5 text-xs sm:text-sm text-[#f5e7c4] shadow-lg">
            {toast}
          </div>
        )}
        {hud.nearPrompt && (!isTouchDevice || !canInteractPrompt) && (
          <button
            type="button"
            onClick={canInteractPrompt ? onTriggerInteract : undefined}
            className={`bg-[#0e131b]/95 border border-[#d4a24c] px-4 py-2 text-xs sm:text-sm font-display tracking-wider uppercase text-[#ebe3d0] shadow-lg ${
              canInteractPrompt ? 'pointer-events-auto hover:bg-[#1a2230] cursor-pointer' : ''
            }`}
          >
            {hud.nearPrompt}
          </button>
        )}
        {!isTouchDevice && !hud.pointerLocked && !hud.nearPrompt && (
          <div className="bg-[#0b0e13]/75 px-3 py-1 text-[11px] text-[#ebe3d0]/72 border border-[#ebe3d0]/12">
            Klik layar kunci kursor · WASD gerak · Tahan Shift sprint · M perbesar peta · E interaksi
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {isTouchDevice && !mapExpanded && (
        <>
          <div
            className="absolute inset-y-16 right-0 w-1/2 pointer-events-auto touch-none"
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            onTouchCancel={handleLookEnd}
            aria-label="Area geser untuk menoleh"
          />

          <div
            ref={joyBaseRef}
            className="absolute bottom-6 left-5 w-28 h-28 rounded-full border-2 border-[#d4a24c]/45 bg-[#0c1017]/55 pointer-events-auto touch-none flex items-center justify-center"
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            onTouchCancel={handleJoyEnd}
            aria-label="Joystick gerak"
          >
            <div
              className="w-11 h-11 rounded-full bg-[#d4a24c]/80 border border-[#ebe3d0] shadow-md"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          <div className="absolute bottom-7 right-5 flex flex-col gap-2.5 pointer-events-auto">
            {canInteractPrompt && (
              <button
                type="button"
                onClick={onTriggerInteract}
                className="px-4 py-3 bg-[#d4a24c] text-[#0b0e13] font-display text-sm tracking-wider uppercase font-semibold border border-[#ebe3d0]/40 shadow-lg active:scale-95"
              >
                {hud.nearKey ? 'AMBIL KUNCI' : hud.nearBook ? 'BACA BUKU' : 'BUKA PINTU'}
              </button>
            )}
            <button
              type="button"
              onTouchStart={() => onTouchSprint(true)}
              onTouchEnd={() => onTouchSprint(false)}
              onTouchCancel={() => onTouchSprint(false)}
              onMouseDown={() => onTouchSprint(true)}
              onMouseUp={() => onTouchSprint(false)}
              onMouseLeave={() => onTouchSprint(false)}
              disabled={hud.isExhausted}
              className={`px-4 py-3 font-display text-sm tracking-wider uppercase font-semibold border shadow-lg active:scale-95 ${
                hud.isExhausted
                  ? 'bg-[#2a1517]/90 text-[#f28b82] border-[#c2413b]/50'
                  : hud.isSprinting
                  ? 'bg-[#279158] text-[#f8f5ec] border-[#9ee6bd]'
                  : 'bg-[#17202c]/95 text-[#ebe3d0] border-[#d4a24c]/70'
              }`}
            >
              {hud.isExhausted ? 'LELAH' : hud.isSprinting ? 'BERLARI' : 'SPRINT'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
