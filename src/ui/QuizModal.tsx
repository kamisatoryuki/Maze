import React, { useEffect } from 'react';
import { ShieldAlert, DoorOpen, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { HISTORICAL_SOURCES } from '../data/ww2Questions';
import type { ActiveQuiz } from '../types/game';

interface QuizModalProps {
  quiz: ActiveQuiz;
  onSelectAnswer: (optionIndex: number) => void;
  onContinue: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const QuizModal: React.FC<QuizModalProps> = ({
  quiz,
  onSelectAnswer,
  onContinue,
}) => {
  const isGuard = quiz.kind === 'guard';
  const timerPct =
    quiz.timeLimit > 0
      ? Math.max(0, Math.min(100, (quiz.timeLeft / quiz.timeLimit) * 100))
      : 100;

  // Block accidental A-D / 1-4 keyboard answers per PRD & legacy behavior; allow Enter/Space to continue & re-lock cursor once answered
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !quiz.answered &&
        ['KeyA', 'KeyB', 'KeyC', 'KeyD', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(
          e.code
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (quiz.answered && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        e.stopPropagation();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [quiz.answered, onContinue]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#080b0f]/88 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-heading"
    >
      <div
        className={`w-full max-w-xl bg-[#121720] border shadow-2xl text-[#ebe3d0] ${
          isGuard ? 'border-[#c2413b]/70' : 'border-[#d4a24c]/65'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isGuard
              ? 'bg-[#211316] border-[#c2413b]/40'
              : 'bg-[#171b22] border-[#d4a24c]/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isGuard ? (
              <ShieldAlert className="w-5 h-5 text-[#f28b82] shrink-0" />
            ) : (
              <DoorOpen className="w-5 h-5 text-[#d4a24c] shrink-0" />
            )}
            <div>
              <h2
                id="quiz-modal-heading"
                className="font-display text-lg tracking-wide uppercase"
              >
                {isGuard ? 'Penjaga Menyergap!' : 'Pos Pemeriksaan Pintu'}
              </h2>
              <p className="text-xs text-[#ebe3d0]/70">
                {quiz.category} ·{' '}
                {isGuard
                  ? 'Jawab cepat! Salah atau habis waktu = -1 nyawa'
                  : 'Jawab benar untuk membuka pintu selama 12 detik (tanpa penalti nyawa)'}
              </p>
            </div>
          </div>

          {quiz.timeLimit > 0 && !quiz.answered && (
            <div className="flex items-center gap-1.5 font-mono-num text-sm font-semibold text-[#f28b82] shrink-0">
              <Clock className="w-4 h-4" />
              <span>{Math.ceil(quiz.timeLeft)}s</span>
            </div>
          )}
        </div>

        {/* Countdown progress strip for timed encounters */}
        {quiz.timeLimit > 0 && (
          <div className="h-1.5 w-full bg-[#1e2531]">
            <div
              className={`h-full transition-all duration-100 ${
                timerPct > 45 ? 'bg-[#d4a24c]' : 'bg-[#c2413b]'
              }`}
              style={{ width: `${quiz.answered ? 0 : timerPct}%` }}
            />
          </div>
        )}

        {/* Question Body */}
        <div className="p-5 space-y-4">
          <p className="text-base sm:text-lg font-medium leading-relaxed text-[#f7f2e6]">
            {quiz.prompt}
          </p>

          {/* Answer Options */}
          <div
            className={`grid gap-2.5 ${
              quiz.questionType === 'true_false' ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {quiz.options.map((opt, idx) => {
              const isSelected = quiz.selectedIndex === idx;
              const isCorrectOption = quiz.correctIndex === idx;

              let btnStyle =
                'bg-[#19202b] border-[#ebe3d0]/20 hover:border-[#d4a24c] hover:bg-[#202938] text-[#ebe3d0] cursor-pointer';

              if (quiz.answered) {
                if (isCorrectOption) {
                  btnStyle =
                    'bg-[#173326] border-[#34a86b] text-[#d6f7e4] cursor-default';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle =
                    'bg-[#38181a] border-[#c2413b] text-[#fad4d2] cursor-default';
                } else {
                  btnStyle =
                    'bg-[#151a22] border-[#ebe3d0]/10 text-[#ebe3d0]/45 cursor-default';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={quiz.answered}
                  onClick={() => onSelectAnswer(idx)}
                  className={`w-full text-left px-4 py-3 border transition-colors flex items-start gap-3 ${btnStyle}`}
                >
                  {quiz.questionType === 'multiple_choice' && (
                    <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 border border-current/35 shrink-0 mt-0.5">
                      {OPTION_LETTERS[idx]}
                    </span>
                  )}
                  <span className="text-sm sm:text-base font-medium leading-snug">
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback & Historical Explanation */}
          {quiz.answered && (
            <div
              className={`p-4 border space-y-2.5 ${
                quiz.wasCorrect
                  ? 'bg-[#12261d] border-[#34a86b]/55'
                  : 'bg-[#291517] border-[#c2413b]/55'
              }`}
            >
              <div className="flex items-center gap-2 font-display tracking-wide uppercase text-sm">
                {quiz.wasCorrect ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#5cd692]" />
                    <span className="text-[#5cd692]">
                      {isGuard
                        ? 'Jawaban Benar! Penjaga tertahan sejenak.'
                        : 'Jawaban Benar! Pintu terbuka 12 detik.'}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-[#f28b82]" />
                    <span className="text-[#f28b82]">
                      {quiz.selectedIndex === null
                        ? 'Waktu Habis! Nyawa berkurang 1.'
                        : isGuard
                        ? 'Jawaban Kurang Tepat! Nyawa berkurang 1.'
                        : 'Belum Tepat — Tidak ada pengurangan nyawa. Coba lagi di pintu ini nanti.'}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm text-[#ebe3d0]/90 leading-relaxed">
                {quiz.explanation}
              </p>

              {quiz.sourceIds.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {quiz.sourceIds.map((id) => {
                    const src = HISTORICAL_SOURCES[id];
                    if (!src) return null;
                    return (
                      <a
                        key={id}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#91b6e3] hover:text-[#d4a24c] underline underline-offset-2"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {src.label}
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onContinue}
                  className="px-5 py-2 bg-[#d4a24c] hover:bg-[#e1b15e] text-[#0b0e13] font-display tracking-wider uppercase text-sm font-semibold cursor-pointer"
                >
                  Lanjut ({Math.max(1, Math.ceil(quiz.autoCloseLeft))}s)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
