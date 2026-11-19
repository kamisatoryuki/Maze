import React, { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, FastForward, X } from 'lucide-react';
import { MAP_CATALOG } from '../maze/MazeConfig';
import type { MapId } from '../types/game';

interface IntroCutsceneOverlayProps {
  mapId?: MapId;
  beatIndex: number;
  progress: number;
  onSkip: () => void;
}

function getCutsceneBeats(mapId: MapId) {
  const def = MAP_CATALOG[mapId];
  const locText =
    mapId === 'pelabuhan'
      ? 'pos jaga dermaga pelabuhan'
      : mapId === 'hutan'
      ? 'rimba malam penuh kabut'
      : mapId === 'pedesaan'
      ? 'kampung pedesaan yang dijaga ketat'
      : mapId === 'gedung'
      ? 'gedung markas komando tiga lantai'
      : 'lorong gudang logistik';
  return [
    {
      stamp: `23:40 WIB · ${def.name.toUpperCase()}, 1942`,
      text: `Langkah sepatu bot bergema di ${locText}. Patroli garnisun memergokimu menyelundupkan catatan jalur suplai...`,
    },
    {
      stamp: 'PENYERGAPAN PATROLI',
      text: 'Empat penjaga mengepung dari ujung koridor dengan lentera merah. Jalan keluar tertutup rapat di belakangmu!',
    },
    {
      stamp: `${def.regionNames.depot.toUpperCase()} · TITIK AWAL`,
      text: 'Mereka menguncimu di ruang penahanan darurat. Di atas meja kayu di hadapanmu, tertinggal sebuah buku catatan kulit...',
    },
  ];
}

export const IntroCutsceneOverlay: React.FC<IntroCutsceneOverlayProps> = ({
  mapId = 'gudang',
  beatIndex,
  progress,
  onSkip,
}) => {
  const beats = getCutsceneBeats(mapId);
  const beat = beats[Math.min(beats.length - 1, Math.max(0, beatIndex))];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between">
      {/* Top cinematic letterbox bar */}
      <div className="bg-[#07090d]/92 border-b border-[#d4a24c]/30 px-6 py-4 flex items-center justify-between pointer-events-auto">
        <div>
          <p className="font-mono-num text-xs tracking-[0.2em] uppercase text-[#d4a24c]">
            {beat.stamp}
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="px-3.5 py-1.5 bg-[#161c26] hover:bg-[#222b38] border border-[#d4a24c]/45 text-xs font-display tracking-wider uppercase text-[#ebe3d0] flex items-center gap-1.5 cursor-pointer"
        >
          <span>Lewati Adegan</span>
          <FastForward className="w-3.5 h-3.5 text-[#d4a24c]" />
        </button>
      </div>

      {/* Bottom cinematic subtitle & progress bar */}
      <div className="bg-[#07090d]/92 border-t border-[#d4a24c]/30 px-6 py-5">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm sm:text-base text-[#f4ede0] leading-relaxed font-medium">
            {beat.text}
          </p>
          <div className="h-1 w-full bg-[#1a202b] overflow-hidden">
            <div
              className="h-full bg-[#d4a24c] transition-all duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="font-mono-num text-[11px] text-[#ebe3d0]/55">
            Tekan Space atau Enter untuk melewati
          </p>
        </div>
      </div>
    </div>
  );
};

interface StoryBookModalProps {
  mapId?: MapId;
  onClose: () => void;
}

function getBookPages(mapId: MapId) {
  const def = MAP_CATALOG[mapId];
  const floorHint =
    def.floors > 1
      ? `Kompleks markas ini memiliki 3 lantai yang terhubung melalui anak tangga kayu-besi. Naik dan turunlah antar lantai untuk mencari ketujuh kunci induk—gerbang keluar (A, B, dan C) tetap berada di Lantai 1.`
      : `Komandan garnisun menyebar tujuh kunci di ${def.regionNames.depot}, ${def.regionNames.admin}, ${def.regionNames.service}, dan ${def.regionNames.outer}. Dekati setiap kunci kuningan dan tekan [E] untuk mengambilnya.`;
  return [
    {
      chapter: 'Bagian I · Malam Penangkapan',
      title: 'Catatan Kurir yang Tertinggal',
      body: [
        `Jika kau membaca lembar ini di bawah lampu kuningan ${def.regionNames.depot}, berarti patroli juga telah menguncimu di ${def.name} (1942).`,
        `Malam tadi, ${def.guardCount} penjaga berpatroli di area ${def.gridSize}×${def.gridSize}${def.floors > 1 ? ` × ${def.floors} lantai` : ''}${def.durationLabel ? ` (estimasi ${def.durationLabel})` : ''}. Pintu baja hanya bisa dibuka dengan tujuh kunci induk.`,
      ],
      footnote: `Arsip ${def.name} · Tingkat ${def.difficultyLabel}${def.durationLabel ? ` (${def.durationLabel})` : ''}`,
    },
    {
      chapter: 'Bagian II · Peta & Rintangan',
      title: def.floors > 1 ? 'Tujuh Kunci & Anak Tangga 3 Lantai' : 'Tujuh Kunci di Empat Wilayah',
      body: [
        floorHint,
        'Waspadai jebakan uap panas di lantai yang akan memperlambat langkahmu jika terinjak, serta dengarkan suara sekitar—derap sepatu, suara hutan, maupun gema gedung menandakan sektor tempatmu berada.',
      ],
      footnote: 'Tekan [M] atau klik peta mini untuk memperbesar denah',
    },
    {
      chapter: 'Bagian III · Bertahan & Lolos',
      title: 'Stamina & Tiga Jalur Kebebasan',
      body: [
        'Langkah dasarmu cukup gesit, namun jika penjaga mulai mengejar di lorong panjang, tahan tombol [Shift] untuk berlari cepat. Jangan sampai staminamu habis total karena tubuhmu butuh waktu sejenak untuk pulih.',
        'Begitu ketujuh kunci berada di tanganmu, tiga jalur keluar (Gerbang A, Lorong B, dan Pintu Servis C) akan terbuka bersamaan. Pilih rute paling aman dan keluarlah sebelum fajar!',
      ],
      footnote: 'Selamat berjuang — Pengirim Anonim 1942',
    },
  ];
}

export const StoryBookModal: React.FC<StoryBookModalProps> = ({ mapId = 'gudang', onClose }) => {
  const [pageIdx, setPageIdx] = useState(0);
  const BOOK_PAGES = getBookPages(mapId);
  const page = BOOK_PAGES[pageIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b0f]/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storybook-title"
    >
      <div className="w-full max-w-xl bg-[#241a13] border-2 border-[#7c5634] p-2 shadow-2xl">
        <div className="bg-[#ece0c6] text-[#241c14] border border-[#b59c72] p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-[#8c7350]/40 pb-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-[#7a3123] shrink-0" />
              <div>
                <p className="font-mono-num text-[11px] uppercase tracking-widest text-[#7a3123] font-semibold">
                  {page.chapter}
                </p>
                <h2 id="storybook-title" className="font-display text-2xl uppercase tracking-wide text-[#1f1710]">
                  {page.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#3c2d1e] hover:bg-[#dfd0b0] border border-[#8c7350]/40 cursor-pointer"
              aria-label="Tutup buku catatan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-sm sm:text-base leading-relaxed text-[#2d2318] min-h-[175px]">
            {page.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="pt-2 border-t border-[#8c7350]/35 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono-num text-xs text-[#695237] italic">
              {page.footnote}
            </span>
            <span className="font-mono-num text-xs font-semibold text-[#3c2d1e]">
              Hal. {pageIdx + 1} / {BOOK_PAGES.length}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageIdx === 0}
                onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                className="px-3 py-2 bg-[#dfd0b0] hover:bg-[#d3c098] disabled:opacity-40 border border-[#8c7350]/50 text-xs font-semibold text-[#241c14] flex items-center gap-1 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={pageIdx === BOOK_PAGES.length - 1}
                onClick={() => setPageIdx((p) => Math.min(BOOK_PAGES.length - 1, p + 1))}
                className="px-3 py-2 bg-[#dfd0b0] hover:bg-[#d3c098] disabled:opacity-40 border border-[#8c7350]/50 text-xs font-semibold text-[#241c14] flex items-center gap-1 cursor-pointer disabled:cursor-default"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#7a3123] hover:bg-[#923c2c] text-[#f7eedc] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
            >
              Tutup & Jelajahi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
