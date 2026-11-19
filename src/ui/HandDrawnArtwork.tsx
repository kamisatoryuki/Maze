import React, { useState } from 'react';
import { ExternalLink, BookOpen, X } from 'lucide-react';
import { CATEGORY_LABELS, HISTORICAL_SOURCES } from '../data/ww2Questions';
import type { EscapeRouteId } from '../types/game';

export const ArchivalCrestSVG: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="40" cy="40" r="36" stroke="#d4a24c" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
    <circle cx="40" cy="40" r="30" stroke="#ebe3d0" strokeWidth="1.2" opacity="0.45" />
    <path d="M40 8V18M40 62V72M8 40H18M62 40H72" stroke="#d4a24c" strokeWidth="1.6" strokeLinecap="square" />
    <path
      d="M40 16L45 35L64 40L45 45L40 64L35 45L16 40L35 35L40 16Z"
      stroke="#d4a24c"
      strokeWidth="1.5"
      fill="#161b24"
    />
    <circle cx="40" cy="40" r="7" fill="#d4a24c" fillOpacity="0.22" stroke="#ebe3d0" strokeWidth="1.2" />
    <path d="M36 44L44 36M36 36L44 44" stroke="#ebe3d0" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
    <text
      x="40"
      y="74"
      textAnchor="middle"
      fill="#d4a24c"
      fontSize="7"
      fontFamily="JetBrains Mono, monospace"
      letterSpacing="1.5"
    >
      1942
    </text>
  </svg>
);

export const BriefingSketchSVG: React.FC = () => (
  <svg
    viewBox="0 0 520 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-auto border border-[#d4a24c]/30 bg-[#181d25]"
    role="img"
    aria-label="Sketsa denah gudang 1942 dengan jalur kunci, pintu kuis, patroli penjaga, dan 3 gerbang keluar"
  >
    {/* Subtle blueprint drafting grid */}
    <path
      d="M0 30H520M0 60H520M0 90H520M0 120H520M0 150H520M65 0V180M130 0V180M195 0V180M260 0V180M325 0V180M390 0V180M455 0V180"
      stroke="#d4a24c"
      strokeOpacity="0.08"
      strokeWidth="1"
    />
    {/* Warehouse outer walls */}
    <rect x="26" y="22" width="468" height="136" stroke="#ebe3d0" strokeWidth="2" strokeOpacity="0.65" />
    {/* Internal corridors */}
    <path
      d="M110 22V106M190 74V158M295 22V120M390 54V158M110 74H295M295 104H460"
      stroke="#ebe3d0"
      strokeWidth="2"
      strokeOpacity="0.45"
      strokeLinecap="square"
    />
    {/* Start cell */}
    <rect x="44" y="114" width="24" height="24" fill="#5d82b0" fillOpacity="0.25" stroke="#5d82b0" strokeWidth="1.5" />
    <text x="56" y="130" textAnchor="middle" fill="#ebe3d0" fontSize="9" fontFamily="JetBrains Mono, monospace">
      AWAL
    </text>
    {/* Quiz door */}
    <line x1="190" y1="42" x2="190" y2="70" stroke="#d4a24c" strokeWidth="4" />
    <text x="190" y="36" textAnchor="middle" fill="#d4a24c" fontSize="8" fontFamily="JetBrains Mono, monospace">
      PINTU KUIS [E]
    </text>
    {/* Key icon */}
    <circle cx="242" cy="52" r="7" stroke="#f0c76e" strokeWidth="1.8" />
    <path d="M249 52H262M257 52V57" stroke="#f0c76e" strokeWidth="1.8" />
    <text x="250" y="70" textAnchor="middle" fill="#f0c76e" fontSize="8" fontFamily="JetBrains Mono, monospace">
      7 KUNCI [E]
    </text>
    {/* Guard patrol */}
    <circle cx="342" cy="70" r="8" fill="#c2413b" fillOpacity="0.3" stroke="#c2413b" strokeWidth="1.6" />
    <path d="M322 70H310M358 70H372" stroke="#c2413b" strokeWidth="1.2" strokeDasharray="3 2" />
    <text x="342" y="92" textAnchor="middle" fill="#f28b82" fontSize="8" fontFamily="JetBrains Mono, monospace">
      PENJAGA
    </text>
    {/* Steam trap */}
    <rect x="135" y="118" width="22" height="16" stroke="#d97706" strokeWidth="1.4" />
    <path d="M140 129L144 122L148 129L152 122" stroke="#f59e0b" strokeWidth="1.2" />
    <text x="146" y="147" textAnchor="middle" fill="#f59e0b" fontSize="8" fontFamily="JetBrains Mono, monospace">
      JEBAKAN UAP
    </text>
    {/* Three exits A, B, C */}
    <rect x="474" y="28" width="22" height="22" fill="#34a86b" fillOpacity="0.28" stroke="#34a86b" strokeWidth="1.6" />
    <text x="485" y="42" textAnchor="middle" fill="#9ee6bd" fontSize="9" fontFamily="JetBrains Mono, monospace">
      A
    </text>
    <rect x="474" y="80" width="22" height="22" fill="#34a86b" fillOpacity="0.28" stroke="#34a86b" strokeWidth="1.6" />
    <text x="485" y="94" textAnchor="middle" fill="#9ee6bd" fontSize="9" fontFamily="JetBrains Mono, monospace">
      B
    </text>
    <rect x="474" y="130" width="22" height="22" fill="#34a86b" fillOpacity="0.28" stroke="#34a86b" strokeWidth="1.6" />
    <text x="485" y="144" textAnchor="middle" fill="#9ee6bd" fontSize="9" fontFamily="JetBrains Mono, monospace">
      C
    </text>
    <text x="444" y="172" textAnchor="end" fill="#9ee6bd" fontSize="8" fontFamily="JetBrains Mono, monospace">
      3 JALUR KELUAR BEBAS DIPILIH
    </text>
  </svg>
);

export const VictoryArtworkSVG: React.FC<{ routeId: EscapeRouteId | null }> = ({ routeId }) => (
  <svg
    viewBox="0 0 420 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-auto border border-[#34a86b]/35 bg-[#11181e]"
    role="img"
    aria-label="Ilustrasi gerbang keluar kompleks gudang menuju fajar kebebasan"
  >
    <defs>
      <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1b2a38" />
        <stop offset="100%" stopColor="#3c4c42" />
      </linearGradient>
    </defs>
    <rect width="420" height="130" fill="url(#dawnSky)" />
    {/* Dawn sun */}
    <circle cx="210" cy="82" r="32" fill="#d4a24c" fillOpacity="0.26" />
    <circle cx="210" cy="82" r="18" fill="#f0c76e" fillOpacity="0.45" />
    {/* Horizon & Warehouse Gate silhouette */}
    <path d="M0 98H420V130H0V98Z" fill="#0d1218" />
    <path d="M0 20H142V98H0V20Z" fill="#12171f" stroke="#ebe3d0" strokeOpacity="0.35" />
    <path d="M278 20H420V98H278V20Z" fill="#12171f" stroke="#ebe3d0" strokeOpacity="0.35" />
    {/* Raised gate barrier */}
    <path d="M142 36L278 22" stroke="#34a86b" strokeWidth="4" strokeLinecap="round" />
    <path d="M142 98L165 65M278 98L255 65" stroke="#d4a24c" strokeWidth="1.5" strokeOpacity="0.7" />
    {/* Pathway perspective */}
    <path d="M168 130L196 98H224L252 130Z" fill="#2b3744" stroke="#34a86b" strokeOpacity="0.5" />
    <text
      x="210"
      y="20"
      textAnchor="middle"
      fill="#9ee6bd"
      fontSize="10"
      fontFamily="JetBrains Mono, monospace"
      letterSpacing="2"
    >
      JALUR {routeId || 'A'} · BERHASIL LOLOS
    </text>
  </svg>
);

interface JournalEntry {
  era: string;
  category: string;
  title: string;
  summary: string;
  sourceIds: string[];
}

const ARCHIVE_ENTRIES: JournalEntry[] = [
  {
    era: '1–3 Sep 1939',
    category: 'WWII-Europe',
    title: 'Invasi Polandia & Awal Perang Dunia II di Eropa',
    summary:
      'Jerman menginvasi Polandia pada 1 September 1939 setelah menandatangani Pakta Molotov–Ribbentrop. Dua hari kemudian, 3 September 1939, Inggris dan Prancis menyatakan perang terhadap Jerman.',
    sourceIds: ['USHMM_WWII_DATES', 'USHMM_WWII_EUROPE'],
  },
  {
    era: '1941–1943',
    category: 'WWII-Europe',
    title: 'Operasi Barbarossa & Titik Balik Stalingrad',
    summary:
      'Jerman melancarkan invasi besar ke Uni Soviet pada 22 Juni 1941 (Operasi Barbarossa). Pertempuran Stalingrad (1942–Februari 1943) berakhir dengan kekalahan besar pasukan Jerman dan membalik arus perang di Front Timur.',
    sourceIds: ['USHMM_WWII_DATES', 'USHMM_STALINGRAD'],
  },
  {
    era: '6 Jun 1944',
    category: 'WWII-Europe',
    title: 'D-Day & Operasi Overlord di Normandia',
    summary:
      'Pasukan Sekutu mendarat di pantai Normandia, Prancis pada 6 Juni 1944 dalam operasi amfibi terbesar sejarah (Operation Overlord), membuka front barat menuju pembebasan Eropa.',
    sourceIds: ['USHMM_DDAY', 'NATIONAL_WWII_MUSEUM_DDAY'],
  },
  {
    era: '7–8 Des 1941',
    category: 'Pacific-War',
    title: 'Serangan Pearl Harbor & Eskalasi Perang Pasifik',
    summary:
      'Angkatan Laut Kekaisaran Jepang menyerang pangkalan AS di Pearl Harbor, Hawaii pada 7 Desember 1941. Keesokan harinya, 8 Desember 1941, Amerika Serikat resmi menyatakan perang terhadap Jepang.',
    sourceIds: ['FDR_WWII_FACTS', 'USHMM_WWII_PACIFIC'],
  },
  {
    era: 'Feb–Jun 1942',
    category: 'Pacific-War',
    title: 'Pertempuran Laut Jawa, Coral Sea & Midway',
    summary:
      'Pada Februari 1942 armada Sekutu ABDA bertempur di Laut Jawa sebelum Jepang menduduki Jawa. Pada Mei 1942 Pertempuran Coral Sea menahan laju ke Port Moresby, lalu kemenangan AS di Midway (Juni 1942) menjadi titik balik di Pasifik.',
    sourceIds: ['US_NAVY_JAVA_SEA', 'US_NAVY_CORAL_SEA', 'NATIONAL_WWII_MUSEUM_MIDWAY'],
  },
  {
    era: 'Jan–Mar 1942',
    category: 'Indonesia-Occupation',
    title: 'Serangan Tarakan & Penyerahan Kalijati',
    summary:
      'Untuk mengamankan pasokan minyak, karet, dan bauksit, Jepang mendarat di Tarakan pada Januari 1942 dan memaksa pasukan Hindia Belanda menandatangani kapitulasi tanpa syarat di Kalijati pada 8 Maret 1942.',
    sourceIds: ['ANNE_FRANK_DUTCH_EAST_INDIES', 'ANRI_JAPANESE_OCCUPATION'],
  },
  {
    era: '1942–1945',
    category: 'Indonesia-Occupation',
    title: 'Propaganda 3A, PUTERA, Romusha, PETA & Heiho',
    summary:
      'Pemerintah pendudukan Jepang menggerakkan propaganda Gerakan 3A dan PUTERA (Pusat Tenaga Rakyat), mengerahkan tenaga kerja paksa Romusha, serta membentuk satuan militer Heiho dan PETA (Pembela Tanah Air, 3 Oktober 1943).',
    sourceIds: ['KEMDIKBUD_MODULE_HISTORY', 'KEMDIKBUD_ROMUSHA_SITE', 'KEMBUD_PUTERA', 'KOMPAS_3A'],
  },
  {
    era: 'Mei–Sep 1945',
    category: 'End-of-War',
    title: 'V-E Day, Bom Atom, Proklamasi RI & Penyerahan Jepang',
    summary:
      'Jerman menyerah pada 8 Mei 1945 (V-E Day). Setelah bom atom di Hiroshima (6 Agustus) dan Nagasaki (9 Agustus), Jepang mengumumkan penyerahan pada 15 Agustus 1945. Indonesia memproklamasikan kemerdekaan pada 17 Agustus 1945, dan Jepang menandatangani kapitulasi resmi pada 2 September 1945.',
    sourceIds: ['USHMM_WWII_DATES', 'US_DOD_WWII', 'ANRI_JAPANESE_OCCUPATION'],
  },
];

export const HistoricalJournalModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const visibleEntries =
    filter === 'ALL'
      ? ARCHIVE_ENTRIES
      : ARCHIVE_ENTRIES.filter((entry) => entry.category === filter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b0f]/92 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#121720] border border-[#d4a24c]/45 text-[#ebe3d0] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4a24c]/25 bg-[#0f141c]">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#d4a24c]" />
            <div>
              <h2 id="archive-modal-title" className="font-display text-xl tracking-wide uppercase text-[#ebe3d0]">
                Arsip Sejarah · Perang Dunia II & Pendudukan 1942
              </h2>
              <p className="text-xs text-[#ebe3d0]/65">
                Ringkasan fakta terverifikasi dan daftar rujukan resmi soal dalam game
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#ebe3d0]/75 hover:text-[#ebe3d0] hover:bg-[#1e2633] border border-[#d4a24c]/25 transition-colors cursor-pointer"
            aria-label="Tutup arsip"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-[#ebe3d0]/10 bg-[#0e131a]">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              filter === 'ALL'
                ? 'bg-[#d4a24c] text-[#0c1016] border-[#d4a24c]'
                : 'bg-[#161d27] text-[#ebe3d0]/80 border-[#ebe3d0]/15 hover:border-[#d4a24c]/40'
            }`}
          >
            Semua Periode
          </button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                filter === key
                  ? 'bg-[#d4a24c] text-[#0c1016] border-[#d4a24c]'
                  : 'bg-[#161d27] text-[#ebe3d0]/80 border-[#ebe3d0]/15 hover:border-[#d4a24c]/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {visibleEntries.map((item) => (
            <article
              key={item.title}
              className="p-4 bg-[#171e29] border border-[#ebe3d0]/12"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                <h3 className="font-display text-base tracking-wide text-[#f0c76e]">
                  {item.title}
                </h3>
                <span className="font-mono-num text-xs text-[#ebe3d0]/60">
                  {item.era}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#ebe3d0]/88 mb-3">
                {item.summary}
              </p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#ebe3d0]/10">
                {item.sourceIds.map((srcId) => {
                  const src = HISTORICAL_SOURCES[srcId];
                  if (!src) return null;
                  return (
                    <a
                      key={srcId}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#91b6e3] hover:text-[#d4a24c] underline underline-offset-2"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {src.label}
                    </a>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#d4a24c]/25 bg-[#0f141c] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
          >
            Tutup Arsip
          </button>
        </div>
      </div>
    </div>
  );
};
