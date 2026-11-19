import {
  HISTORICAL_SOURCES,
  MULTIPLE_CHOICE_QUESTIONS,
  TRUE_FALSE_QUESTIONS,
} from '../data/ww2Questions';
import type { MCQQuestion, QuizTopicId, TrueFalseQuestion } from '../types/game';

export interface QuestionBankValidationResult {
  ok: boolean;
  errors: string[];
  counts: {
    multipleChoice: number;
    trueFalse: number;
    total: number;
    categories: Record<string, number>;
    categoryBreakdown: Record<string, { multipleChoice: number; trueFalse: number; total: number }>;
  };
}

export function getTopicCounts(
  mcList: MCQQuestion[] = MULTIPLE_CHOICE_QUESTIONS,
  tfList: TrueFalseQuestion[] = TRUE_FALSE_QUESTIONS
): Record<QuizTopicId, { multipleChoice: number; trueFalse: number; total: number }> {
  const counts: Record<QuizTopicId, { multipleChoice: number; trueFalse: number; total: number }> = {
    ALL: { multipleChoice: mcList.length, trueFalse: tfList.length, total: mcList.length + tfList.length },
    'WWII-Europe': { multipleChoice: 0, trueFalse: 0, total: 0 },
    'Pacific-War': { multipleChoice: 0, trueFalse: 0, total: 0 },
    'Indonesia-Occupation': { multipleChoice: 0, trueFalse: 0, total: 0 },
    'End-of-War': { multipleChoice: 0, trueFalse: 0, total: 0 },
  };
  for (const q of mcList) {
    const key = q.category as QuizTopicId;
    if (counts[key]) {
      counts[key].multipleChoice += 1;
      counts[key].total += 1;
    }
  }
  for (const q of tfList) {
    const key = q.category as QuizTopicId;
    if (counts[key]) {
      counts[key].trueFalse += 1;
      counts[key].total += 1;
    }
  }
  return counts;
}

export function validateQuestionBank(
  mcList: MCQQuestion[] = MULTIPLE_CHOICE_QUESTIONS,
  tfList: TrueFalseQuestion[] = TRUE_FALSE_QUESTIONS
): QuestionBankValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const categories: Record<string, number> = {};
  const categoryBreakdown: Record<string, { multipleChoice: number; trueFalse: number; total: number }> = {};

  if (mcList.length < 24) {
    errors.push(`Multiple choice minimal 24 soal, tersedia ${mcList.length}`);
  }
  if (tfList.length < 16) {
    errors.push(`True/False minimal 16 soal, tersedia ${tfList.length}`);
  }

  for (const q of mcList) {
    if (!q.id || seenIds.has(q.id)) {
      errors.push(`ID MCQ duplikat atau kosong: ${q.id}`);
    }
    seenIds.add(q.id);

    const text = q.question.trim();
    if (!text) errors.push(`Pertanyaan kosong pada ${q.id}`);
    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    if (seenText.has(norm)) errors.push(`Teks pertanyaan duplikat: ${q.id}`);
    seenText.add(norm);

    if (!q.category.trim()) errors.push(`Kategori kosong pada ${q.id}`);
    categories[q.category] = (categories[q.category] || 0) + 1;
    categoryBreakdown[q.category] ??= { multipleChoice: 0, trueFalse: 0, total: 0 };
    categoryBreakdown[q.category].multipleChoice += 1;
    categoryBreakdown[q.category].total += 1;

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push(`Jumlah opsi bukan 4 pada ${q.id}`);
    } else {
      const cleaned = q.options.map((o) => o.trim());
      if (cleaned.some((o) => !o) || new Set(cleaned).size !== 4) {
        errors.push(`Opsi tidak valid atau duplikat pada ${q.id}`);
      }
    }

    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
      errors.push(`answerIndex tidak valid pada ${q.id}`);
    }
    if (!q.explanation || q.explanation.trim().length < 10) {
      errors.push(`Penjelasan terlalu pendek pada ${q.id}`);
    }
    if (!q.sourceIds.length || q.sourceIds.some((id) => !HISTORICAL_SOURCES[id])) {
      errors.push(`Referensi sumber tidak valid pada ${q.id}`);
    }
  }

  for (const q of tfList) {
    if (!q.id || seenIds.has(q.id)) {
      errors.push(`ID TF duplikat atau kosong: ${q.id}`);
    }
    seenIds.add(q.id);

    const text = q.statement.trim();
    if (!text) errors.push(`Pernyataan kosong pada ${q.id}`);
    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    if (seenText.has(norm)) errors.push(`Teks pernyataan duplikat: ${q.id}`);
    seenText.add(norm);

    if (!q.category.trim()) errors.push(`Kategori kosong pada ${q.id}`);
    categories[q.category] = (categories[q.category] || 0) + 1;
    categoryBreakdown[q.category] ??= { multipleChoice: 0, trueFalse: 0, total: 0 };
    categoryBreakdown[q.category].trueFalse += 1;
    categoryBreakdown[q.category].total += 1;

    if (typeof q.answerBoolean !== 'boolean') {
      errors.push(`answerBoolean tidak valid pada ${q.id}`);
    }
    if (!q.explanation || q.explanation.trim().length < 10) {
      errors.push(`Penjelasan terlalu pendek pada ${q.id}`);
    }
    if (!q.sourceIds.length || q.sourceIds.some((id) => !HISTORICAL_SOURCES[id])) {
      errors.push(`Referensi sumber tidak valid pada ${q.id}`);
    }
  }

  const requiredCategories = [
    'WWII-Europe',
    'Pacific-War',
    'Indonesia-Occupation',
    'End-of-War',
  ];
  for (const cat of requiredCategories) {
    const info = categoryBreakdown[cat];
    if (!info || info.multipleChoice < 10 || info.trueFalse < 8) {
      errors.push(
        `Materi ${cat} kurang soal (MCQ ${info?.multipleChoice || 0}/10, Benar-Salah ${info?.trueFalse || 0}/8)`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      multipleChoice: mcList.length,
      trueFalse: tfList.length,
      total: mcList.length + tfList.length,
      categories,
      categoryBreakdown,
    },
  };
}
