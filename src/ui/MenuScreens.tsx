import React, { useEffect, useState } from 'react';
import {
  Play,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Trophy,
  Sliders,
  X,
  Volume2,
  AlertTriangle,
  Check,
  Trash2,
} from 'lucide-react';
import { ArchivalCrestSVG, BriefingSketchSVG, VictoryArtworkSVG } from './HandDrawnArtwork';
import { formatClock } from './HUD';
import { TOPIC_OPTIONS, getTopicLabel } from '../data/ww2Questions';
import { MAP_CATALOG, MAP_ORDER, TOTAL_KEYS } from '../maze/MazeConfig';
import { getTopicCounts } from '../questions/QuestionValidator';
import { DEFAULT_SETTINGS } from '../systems/SaveManager';
import type {
  DifficultyLevel,
  GameSettings,
  GraphicsQuality,
  LeaderboardEntry,
  MapId,
  QuizTopicId,
  RunSummary,
  SaveStateV2,
} from '../types/game';

const TOPIC_COUNTS = getTopicCounts();

function getTopicShortLabel(topicId: QuizTopicId = 'ALL'): string {
  return TOPIC_OPTIONS.find((t) => t.id === topicId)?.shortLabel ?? 'Semua Materi';
}

interface TitleScreenProps {
  selectedMap: MapId;
  onSelectMap: (mapId: MapId) => void;
  selectedTopic: QuizTopicId;
  onSelectTopic: (topicId: QuizTopicId) => void;
  savedGame: SaveStateV2 | null;
  personalBest: number | null;
  bankError: string | null;
  onStartNew: (mapId: MapId, topicId: QuizTopicId) => void;
  onContinueSave: () => void;
  onOpenHowTo: () => void;
  onOpenArchive: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  isSubModalOpen: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMap,
  onSelectMap,
  selectedTopic,
  onSelectTopic,
  savedGame,
  personalBest,
  bankError,
  onStartNew,
  onContinueSave,
  onOpenHowTo,
  onOpenArchive,
  onOpenLeaderboard,
  onOpenSettings,
  isSubModalOpen,
}) => {
  const activeDef = MAP_CATALOG[selectedMap];
  const activeTopicMeta = TOPIC_OPTIONS.find((t) => t.id === selectedTopic) ?? TOPIC_OPTIONS[0];
  const activeTopicCount = TOPIC_COUNTS[selectedTopic] ?? TOPIC_COUNTS.ALL;
  const savedMapName =
    savedGame?.mapId && MAP_CATALOG[savedGame.mapId]
      ? MAP_CATALOG[savedGame.mapId].shortName
      : 'Gudang';
  const savedTopicName = getTopicShortLabel(savedGame?.topicId ?? 'ALL');

  // Press Enter or Space on title screen to start when no modal is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isSubModalOpen) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartNew(selectedMap, selectedTopic);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSubModalOpen, onStartNew, selectedMap, selectedTopic]);

  return (
    <div className="fixed inset-0 z-30 flex items-center bg-gradient-to-r from-[#090c11]/94 via-[#090c11]/74 to-transparent p-4 sm:p-8 lg:p-10 overflow-y-auto">
      <div className="max-w-2xl w-full flex flex-col gap-3 text-[#ebe3d0]">
        <div className="flex items-center gap-3.5">
          <ArchivalCrestSVG className="w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
          <div>
            <p className="font-mono-num text-[11px] tracking-[0.22em] uppercase text-[#d4a24c]">
              Arsip Operasi Pelarian · 1942
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider uppercase leading-none text-[#f7f2e6]">
              ESCAPE 1942
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#ebe3d0]/85 leading-relaxed max-w-2xl">
          Pilih <strong>5 arena labirin</strong> &amp; <strong>materi kuis sejarah</strong>. Kumpulkan {TOTAL_KEYS} kunci dengan tombol E, hindari patroli penjaga, dan jawab kuis Perang Dunia II untuk bebas.
        </p>

        {/* 5-Map Arena Selector */}
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center justify-between text-[11px] font-mono-num uppercase tracking-wider text-[#d4a24c]">
            <span>Pilih Arena Labirin (5 Peta)</span>
            <span className="text-[#ebe3d0]/70">{activeDef.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" role="radiogroup" aria-label="Pilih arena labirin">
            {MAP_ORDER.map((mId) => {
              const m = MAP_CATALOG[mId];
              const isSelected = selectedMap === mId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`map-card-${m.id}`}
                  onClick={() => onSelectMap(m.id)}
                  className={`relative text-left p-2 sm:p-2.5 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#182130]/95 border-[#d4a24c] shadow-md'
                      : 'bg-[#10151e]/90 border-[#ebe3d0]/18 hover:border-[#d4a24c]/55 hover:bg-[#151c27]/95'
                  }`}
                >
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: isSelected ? m.accentHex : 'transparent' }}
                  />
                  <div className="flex items-center justify-between gap-1.5 pl-1">
                    <span className="font-display text-sm uppercase tracking-wide text-[#f7f2e6] leading-tight">
                      {m.shortName}
                    </span>
                    <span
                      className="font-mono-num text-[10px] px-1.5 py-0.5 border font-semibold shrink-0"
                      style={{
                        borderColor: `${m.accentHex}88`,
                        color: m.accentHex,
                        backgroundColor: '#0b0e13',
                      }}
                    >
                      {m.difficultyLabel}
                    </span>
                  </div>
                  <div className="pl-1 mt-0.5 font-mono-num text-[11px] text-[#ebe3d0]/75">
                    {m.gridSize}×{m.gridSize}
                    {m.floors > 1 ? ` · ${m.floors} Lt.` : ''} · {m.guardCount} Penjaga
                  </div>
                  <div className="pl-1 text-[11px] text-[#ebe3d0]/60 truncate">
                    {m.durationLabel ? `${m.durationLabel} · ` : ''}
                    {m.patternLabel}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#ebe3d0]/75 bg-[#10151e]/80 border border-[#ebe3d0]/12 px-2.5 py-1.5">
            <strong className="text-[#f0c76e]">{activeDef.name}:</strong> {activeDef.subtitle}
          </p>
        </div>

        {/* 5-Topic Quiz Material Selector */}
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center justify-between text-[11px] font-mono-num uppercase tracking-wider text-[#d4a24c]">
            <span>Pilih Materi Kuis (5 Topik)</span>
            <span className="text-[#ebe3d0]/70">
              {activeTopicMeta.label} · {activeTopicCount.total} Soal
            </span>
          </div>
          <div
            className="grid grid-cols-2 sm:grid-cols-5 gap-1.5"
            role="radiogroup"
            aria-label="Pilih materi kuis"
          >
            {TOPIC_OPTIONS.map((topic) => {
              const isSelected = selectedTopic === topic.id;
              const counts = TOPIC_COUNTS[topic.id];
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`topic-card-${topic.id}`}
                  onClick={() => onSelectTopic(topic.id)}
                  className={`text-left px-2.5 py-2 border transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-[#211b10]/95 border-[#d4a24c] text-[#f7f2e6]'
                      : 'bg-[#10151e]/90 border-[#ebe3d0]/18 text-[#ebe3d0]/80 hover:border-[#d4a24c]/55 hover:bg-[#151c27]/95'
                  }`}
                >
                  <span className="font-display text-xs uppercase tracking-wide leading-tight">
                    {topic.shortLabel}
                  </span>
                  <span className="font-mono-num text-[10px] text-[#d4a24c]">
                    {counts.total} Soal
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#ebe3d0]/75 bg-[#10151e]/80 border border-[#ebe3d0]/12 px-2.5 py-1.5">
            <strong className="text-[#f0c76e]">{activeTopicMeta.label}:</strong> {activeTopicMeta.description}{' '}
            <span className="font-mono-num text-[#d4a24c]">
              ({activeTopicCount.multipleChoice} PG · {activeTopicCount.trueFalse} Benar/Salah)
            </span>
          </p>
        </div>

        {bankError && (
          <div className="p-2.5 bg-[#361618] border border-[#c2413b] text-xs text-[#fad4d2] flex items-start gap-2 max-w-2xl">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#f28b82]" />
            <span>Validasi bank soal bermasalah: {bankError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 max-w-2xl">
          <button
            type="button"
            data-start="true"
            onClick={() => onStartNew(selectedMap, selectedTopic)}
            className="px-6 py-2.5 bg-[#d4a24c] hover:bg-[#e2b361] text-[#0b0e13] font-display text-base sm:text-lg font-semibold tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Mulai · {activeDef.shortName}</span>
          </button>

          {savedGame && (
            <button
              type="button"
              onClick={onContinueSave}
              className="px-4 py-2 bg-[#151c26]/95 hover:bg-[#1e2736] text-[#ebe3d0] border border-[#d4a24c]/55 font-display text-sm sm:text-base tracking-wider uppercase flex flex-col items-start justify-center transition-colors cursor-pointer"
            >
              <span className="leading-none">Lanjutkan · {savedMapName}</span>
              <span className="font-mono-num text-[11px] text-[#d4a24c] mt-1">
                {savedTopicName} · Kunci {savedGame.collectedKeys.length}/{TOTAL_KEYS} ·{' '}
                {formatClock(savedGame.elapsedTime)}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
          <button
            type="button"
            onClick={onOpenHowTo}
            className="px-3 py-2 bg-[#121720]/90 hover:bg-[#1b2330] border border-[#ebe3d0]/18 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#d4a24c]" />
            <span>Panduan</span>
          </button>
          <button
            type="button"
            onClick={onOpenArchive}
            className="px-3 py-2 bg-[#121720]/90 hover:bg-[#1b2330] border border-[#ebe3d0]/18 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#d4a24c]" />
            <span>Arsip Sejarah</span>
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="px-3 py-2 bg-[#121720]/90 hover:bg-[#1b2330] border border-[#ebe3d0]/18 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-[#d4a24c]" />
            <span>Papan Skor</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3 py-2 bg-[#121720]/90 hover:bg-[#1b2330] border border-[#ebe3d0]/18 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#d4a24c]" />
            <span>Pengaturan</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#ebe3d0]/65 pt-2 border-t border-[#ebe3d0]/12 max-w-2xl">
          <span>WASD · Gerak</span>
          <span>Shift · Sprint</span>
          <span>E · Kunci / Buku / Pintu</span>
          <span>M · Perbesar Peta</span>
          {personalBest !== null && (
            <span className="font-mono-num text-[#d4a24c]">
              Rekor Tercepat: {formatClock(personalBest)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const PauseModal: React.FC<{
  activeTopic?: QuizTopicId;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenHowTo: () => void;
  onMainMenu: () => void;
}> = ({ activeTopic = 'ALL', onResume, onRestart, onOpenSettings, onOpenHowTo, onMainMenu }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center bg-[#080b0f]/86 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pause-title"
  >
    <div className="w-full max-w-sm bg-[#121720] border border-[#d4a24c]/50 p-6 text-[#ebe3d0] shadow-2xl space-y-4">
      <div className="border-b border-[#ebe3d0]/15 pb-3">
        <p className="font-mono-num text-xs uppercase tracking-widest text-[#d4a24c]">
          Misi Dijeda · {getTopicShortLabel(activeTopic)}
        </p>
        <h2 id="pause-title" className="font-display text-2xl uppercase tracking-wider">
          Menu Jeda
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-3 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase font-semibold cursor-pointer"
        >
          Lanjutkan Misi
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full py-2.5 bg-[#19202b] hover:bg-[#222b39] border border-[#ebe3d0]/20 text-sm font-medium cursor-pointer"
        >
          Pengaturan
        </button>
        <button
          type="button"
          onClick={onOpenHowTo}
          className="w-full py-2.5 bg-[#19202b] hover:bg-[#222b39] border border-[#ebe3d0]/20 text-sm font-medium cursor-pointer"
        >
          Panduan Misi & Kontrol
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 bg-[#19202b] hover:bg-[#222b39] border border-[#ebe3d0]/20 text-sm font-medium cursor-pointer"
        >
          Ulangi dari Awal
        </button>
        <button
          type="button"
          onClick={onMainMenu}
          className="w-full py-2.5 bg-[#241618] hover:bg-[#311c1f] border border-[#c2413b]/45 text-sm font-medium text-[#f5c7c4] cursor-pointer"
        >
          Keluar ke Menu Utama
        </button>
      </div>
    </div>
  </div>
);

export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b0f]/90 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="howto-title"
  >
    <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-[#121720] border border-[#d4a24c]/45 text-[#ebe3d0] shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4a24c]/25 bg-[#0f141c]">
        <h2 id="howto-title" className="font-display text-xl tracking-wide uppercase">
          Panduan Misi · ESCAPE 1942
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-[#ebe3d0]/75 hover:text-[#ebe3d0] border border-[#d4a24c]/25 cursor-pointer"
          aria-label="Tutup panduan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
        <BriefingSketchSVG />

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-[#171e29] border border-[#ebe3d0]/12 space-y-2">
            <h3 className="font-display text-base uppercase text-[#d4a24c]">
              5 Pilihan Peta & 3 Jalur Keluar
            </h3>
            <p className="text-[#ebe3d0]/85 leading-relaxed">
              Pilih arena <strong>Pelabuhan (56×56 · Mudah · 3–5 Mnt)</strong>, <strong>Gudang (96×96)</strong>, <strong>Hutan (112×112)</strong>, <strong>Pedesaan (124×124)</strong>, atau <strong>Gedung 3 Lantai (104×104 × 3 Lt.)</strong> yang memakai <strong>anak tangga</strong>. Kumpulkan <strong>{TOTAL_KEYS} kunci</strong> (tekan <strong>E</strong>) untuk membuka ketiga jalur keluar (A, B, C).
            </p>
          </div>

          <div className="p-4 bg-[#171e29] border border-[#ebe3d0]/12 space-y-2">
            <h3 className="font-display text-base uppercase text-[#d4a24c]">
              Patroli Penjaga, Sprint & Stamina
            </h3>
            <p className="text-[#ebe3d0]/85 leading-relaxed">
              Setiap arena memiliki jumlah penjaga dan tingkat ketajaman patroli berbeda (6–18 penjaga). Tahan <strong>Shift</strong> untuk sprint selama stamina tersedia. Jika tertangkap, jawab kuis Benar/Salah sebelum waktu habis.
            </p>
          </div>

          <div className="p-4 bg-[#171e29] border border-[#ebe3d0]/12 space-y-2">
            <h3 className="font-display text-base uppercase text-[#d4a24c]">
              Pilihan Materi, Buku & Pemulihan
            </h3>
            <p className="text-[#ebe3d0]/85 leading-relaxed">
              Pilih topik <strong>Semua Materi</strong> atau fokus pada 1 periode (Palagan Eropa, Perang Pasifik, Pendudukan Jepang, atau Akhir Perang &amp; RI). Baca <strong>Buku Catatan</strong>, ambil kunci, atau buka pintu dengan <strong>E</strong>. Menjawab salah pada pintu tidak mengurangi nyawa; <strong>3 benar berturut-turut</strong> memulihkan +1 nyawa.
            </p>
          </div>

          <div className="p-4 bg-[#171e29] border border-[#ebe3d0]/12 space-y-2">
            <h3 className="font-display text-base uppercase text-[#d4a24c]">
              Kontrol Desktop & Layar Sentuh
            </h3>
            <ul className="text-[#ebe3d0]/85 space-y-1 text-xs font-mono-num">
              <li>WASD / Panah Atas-Bawah : Berjalan & naik tangga</li>
              <li>Tahan Shift : Sprint (Stamina) | Space : Menghindar</li>
              <li>Mouse / Panah Kiri-Kanan: Arah pandang</li>
              <li>E : Ambil Kunci / Buku / Pintu | M / Klik Peta : Perbesar</li>
              <li>Layar Sentuh : Joystick kiri + tombol Sprint</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-[#d4a24c]/25 bg-[#0f141c] flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
        >
          Mengerti
        </button>
      </div>
    </div>
  </div>
);

export const SettingsModal: React.FC<{
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}> = ({ settings, onChange, onClose }) => {
  const update = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    onChange({ ...settings, [key]: val });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b0f]/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-md bg-[#121720] border border-[#d4a24c]/45 text-[#ebe3d0] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4a24c]/25 bg-[#0f141c]">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#d4a24c]" />
            <h2 id="settings-title" className="font-display text-xl tracking-wide uppercase">
              Pengaturan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#ebe3d0]/75 hover:text-[#ebe3d0] border border-[#d4a24c]/25 cursor-pointer"
            aria-label="Tutup pengaturan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {/* Audio */}
          <label className="flex items-center justify-between">
            <span>Bisukan Semua Audio</span>
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={(e) => update('muted', e.target.checked)}
              className="w-4 h-4 accent-[#d4a24c] cursor-pointer"
            />
          </label>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#ebe3d0]/75">
              <span>Volume Musik Latar</span>
              <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => update('musicVolume', Number(e.target.value))}
              className="w-full accent-[#d4a24c]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#ebe3d0]/75">
              <span>Volume Efek Suara</span>
              <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => update('sfxVolume', Number(e.target.value))}
              className="w-full accent-[#d4a24c]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#ebe3d0]/75">
              <span>Sensitivitas Kamera</span>
              <span className="font-mono-num">{settings.mouseSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.4}
              step={0.1}
              value={settings.mouseSensitivity}
              onChange={(e) => update('mouseSensitivity', Number(e.target.value))}
              className="w-full accent-[#d4a24c]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#ebe3d0]/75">
              <span>Deadzone Joystick Sentuh</span>
              <span className="font-mono-num">{settings.joyDeadzone}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={2}
              value={settings.joyDeadzone}
              onChange={(e) => update('joyDeadzone', Number(e.target.value))}
              className="w-full accent-[#d4a24c]"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <span className="text-xs text-[#ebe3d0]/75 block">Tingkat Kesulitan Patroli</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['easy', 'Mudah'],
                  ['normal', 'Normal'],
                  ['sulit', 'Sulit'],
                ] as Array<[DifficultyLevel, string]>
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => update('difficulty', val)}
                  className={`py-2 text-xs font-medium border cursor-pointer ${
                    settings.difficulty === val
                      ? 'bg-[#d4a24c] text-[#0b0e13] border-[#d4a24c] font-semibold'
                      : 'bg-[#18202c] text-[#ebe3d0]/80 border-[#ebe3d0]/18'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Graphics Quality */}
          <div className="space-y-1.5">
            <span className="text-xs text-[#ebe3d0]/75 block">Kualitas Grafis 3D</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['low', 'Ringan'],
                  ['medium', 'Seimbang'],
                  ['high', 'Tinggi'],
                ] as Array<[GraphicsQuality, string]>
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => update('quality', val)}
                  className={`py-2 text-xs font-medium border cursor-pointer ${
                    settings.quality === val
                      ? 'bg-[#d4a24c] text-[#0b0e13] border-[#d4a24c] font-semibold'
                      : 'bg-[#18202c] text-[#ebe3d0]/80 border-[#ebe3d0]/18'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#d4a24c]/25 bg-[#0f141c] flex items-center justify-between">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="text-xs text-[#ebe3d0]/65 hover:text-[#ebe3d0] underline cursor-pointer"
          >
            Kembalikan Bawaan
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export const LeaderboardModal: React.FC<{
  entries: LeaderboardEntry[];
  onClear: () => void;
  onClose: () => void;
}> = ({ entries, onClear, onClose }) => {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b0f]/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#121720] border border-[#d4a24c]/45 text-[#ebe3d0] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4a24c]/25 bg-[#0f141c]">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#d4a24c]" />
            <h2 id="leaderboard-title" className="font-display text-xl tracking-wide uppercase">
              Papan Skor Lokal
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#ebe3d0]/75 hover:text-[#ebe3d0] border border-[#d4a24c]/25 cursor-pointer"
            aria-label="Tutup papan skor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {entries.length === 0 ? (
            <p className="text-sm text-[#ebe3d0]/70 py-8 text-center">
              Belum ada catatan misi tersimpan di perangkat ini. Selesaikan misi dan simpan skor Anda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#d4a24c]/30 text-[#d4a24c] font-display uppercase tracking-wider">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Peta</th>
                    <th className="py-2 pr-3">Materi</th>
                    <th className="py-2 pr-3">Skor</th>
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Rute</th>
                    <th className="py-2 pr-3">Waktu</th>
                    <th className="py-2 pr-3">Kunci</th>
                    <th className="py-2">B/S</th>
                  </tr>
                </thead>
                <tbody className="font-mono-num">
                  {entries.slice(0, 12).map((row, idx) => (
                    <tr key={`${row.name}-${row.date}-${idx}`} className="border-b border-[#ebe3d0]/10">
                      <td className="py-2.5 pr-3 text-[#ebe3d0]/60">{idx + 1}</td>
                      <td className="py-2.5 pr-3 font-sans font-medium text-[#ebe3d0]">{row.name}</td>
                      <td className="py-2.5 pr-3 font-sans text-xs text-[#ebe3d0]/80">
                        {(row.mapId && MAP_CATALOG[row.mapId]?.shortName) || 'Gudang'}
                      </td>
                      <td className="py-2.5 pr-3 font-sans text-xs text-[#d4a24c]/90">
                        {getTopicShortLabel(row.topicId ?? 'ALL')}
                      </td>
                      <td className="py-2.5 pr-3 text-[#f0c76e] font-semibold">{row.score}</td>
                      <td className="py-2.5 pr-3">{row.rank}</td>
                      <td className="py-2.5 pr-3">{row.exitRoute}</td>
                      <td className="py-2.5 pr-3">{formatClock(row.elapsedTime)}</td>
                      <td className="py-2.5 pr-3">{row.keys}/{TOTAL_KEYS}</td>
                      <td className="py-2.5">
                        {row.correct}/{row.wrong}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#d4a24c]/25 bg-[#0f141c] flex items-center justify-between gap-2">
          {entries.length > 0 ? (
            confirmClear ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#f28b82]">Hapus semua riwayat lokal?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setConfirmClear(false);
                  }}
                  className="px-2.5 py-1 bg-[#c2413b] text-white font-medium cursor-pointer"
                >
                  Ya, Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1 bg-[#1e2633] text-[#ebe3d0] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[#f28b82] hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Riwayat
              </button>
            )
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export const EndGameModal: React.FC<{
  summary: RunSummary;
  defaultPlayerName: string;
  onSaveScore: (name: string) => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}> = ({ summary, defaultPlayerName, onSaveScore, onPlayAgain, onMainMenu }) => {
  const [name, setName] = useState(defaultPlayerName || 'Arsiparis');
  const [saved, setSaved] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#080b0f]/92 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endgame-title"
    >
      <div
        className={`w-full max-w-lg bg-[#121720] border p-6 text-[#ebe3d0] shadow-2xl space-y-4 ${
          summary.won ? 'border-[#34a86b]/65' : 'border-[#c2413b]/65'
        }`}
      >
        {summary.won && <VictoryArtworkSVG routeId={summary.selectedExit} />}

        <div className="flex items-start justify-between gap-4 border-b border-[#ebe3d0]/12 pb-3">
          <div>
            <p
              className={`font-mono-num text-xs uppercase tracking-widest ${
                summary.won ? 'text-[#5cd692]' : 'text-[#f28b82]'
              }`}
            >
              {summary.won ? 'Misi Berhasil' : 'Misi Gagal'}
            </p>
            <h2 id="endgame-title" className="font-display text-3xl uppercase tracking-wider">
              {summary.won ? 'Berhasil Lolos!' : 'Tertangkap Patroli'}
            </h2>
            <p className="text-xs text-[#d4a24c] mt-0.5">
              Arena: {summary.mapName}
              {summary.won && summary.selectedExitName ? ` · Keluar lewat ${summary.selectedExitName}` : ''}
            </p>
            <p className="text-[11px] text-[#ebe3d0]/70 mt-0.5">
              Materi Kuis: {getTopicLabel(summary.topicId ?? 'ALL')}
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="font-display text-3xl text-[#d4a24c] leading-none">
              RANK {summary.rank}
            </div>
            <div className="font-mono-num text-sm text-[#ebe3d0]/85 mt-1">
              {summary.score} pts
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Waktu</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {formatClock(summary.elapsedTime)}
            </div>
          </div>
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Kunci</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {summary.keysCollected}/{TOTAL_KEYS}
            </div>
          </div>
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Nyawa Sisa</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {summary.lives}/5
            </div>
          </div>
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Benar / Salah</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {summary.stats.correct} / {summary.stats.wrong}
            </div>
          </div>
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Rentetan Terbaik</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {summary.bestStreak}x
            </div>
          </div>
          <div className="p-2.5 bg-[#171e29] border border-[#ebe3d0]/10">
            <div className="text-[11px] text-[#ebe3d0]/60">Menghindar</div>
            <div className="font-mono-num text-sm font-semibold mt-0.5">
              {summary.stats.dodgesUsed}x
            </div>
          </div>
        </div>

        {/* Save local leaderboard record */}
        {!saved ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onSaveScore(name.trim());
              setSaved(true);
            }}
            className="flex gap-2 pt-1"
          >
            <input
              type="text"
              maxLength={18}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Anda"
              aria-label="Nama untuk papan skor lokal"
              className="flex-1 px-3 py-2 bg-[#0d1118] border border-[#ebe3d0]/25 text-sm text-[#ebe3d0] focus:outline-none focus:border-[#d4a24c]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#1c2635] hover:bg-[#263347] border border-[#d4a24c]/55 text-xs font-display tracking-wider uppercase text-[#f0c76e] cursor-pointer"
            >
              Simpan Skor
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[#5cd692] py-1">
            <Check className="w-4 h-4" />
            <span>Catatan misi tersimpan di Papan Skor Lokal.</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Main Lagi</span>
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="px-5 py-3 bg-[#19202b] hover:bg-[#222b39] border border-[#ebe3d0]/20 font-display tracking-wider uppercase text-sm cursor-pointer"
          >
            Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
};

export const WebGLErrorScreen: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e13] p-6 text-[#ebe3d0]">
    <div className="max-w-md bg-[#131820] border border-[#c2413b]/60 p-6 space-y-4">
      <div className="flex items-center gap-3 text-[#f28b82]">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <h1 className="font-display text-2xl uppercase tracking-wide">
          Grafis 3D WebGL2 Tidak Tersedia
        </h1>
      </div>
      <p className="text-sm text-[#ebe3d0]/85 leading-relaxed">{reason}</p>
      <p className="text-xs text-[#ebe3d0]/60">
        Pastikan akselerasi perangkat keras aktif di pengaturan browser atau gunakan Chrome/Edge/Firefox versi terbaru.
      </p>
    </div>
  </div>
);
