import {
  CATEGORY_LABELS,
  MULTIPLE_CHOICE_QUESTIONS,
  TRUE_FALSE_QUESTIONS,
} from '../data/ww2Questions';
import { createRng } from '../maze/Pathfinding';
import type { ActiveQuiz, MCQQuestion, QuizTopicId, TrueFalseQuestion } from '../types/game';

export class QuestionManager {
  private rng: () => number;
  private seenMc = new Set<string>();
  private seenTf = new Set<string>();
  private posBag: number[] = [];
  private mcPool: MCQQuestion[];
  private tfPool: TrueFalseQuestion[];
  private topic: QuizTopicId;

  constructor(
    seed = 1942,
    mcPool: MCQQuestion[] = MULTIPLE_CHOICE_QUESTIONS,
    tfPool: TrueFalseQuestion[] = TRUE_FALSE_QUESTIONS,
    topic: QuizTopicId = 'ALL'
  ) {
    this.rng = createRng(seed + 701);
    this.mcPool = mcPool;
    this.tfPool = tfPool;
    this.topic = topic;
  }

  setTopic(topic: QuizTopicId): void {
    if (this.topic !== topic) {
      this.topic = topic;
      this.seenMc.clear();
      this.seenTf.clear();
    }
  }

  getTopic(): QuizTopicId {
    return this.topic;
  }

  reset(seed = Date.now(), topic?: QuizTopicId): void {
    this.rng = createRng(seed);
    this.seenMc.clear();
    this.seenTf.clear();
    this.posBag = [];
    if (topic !== undefined) {
      this.topic = topic;
    }
  }

  private getActiveMcPool(): MCQQuestion[] {
    if (this.topic === 'ALL') return this.mcPool;
    const filtered = this.mcPool.filter((q) => q.category === this.topic);
    return filtered.length > 0 ? filtered : this.mcPool;
  }

  private getActiveTfPool(): TrueFalseQuestion[] {
    if (this.topic === 'ALL') return this.tfPool;
    const filtered = this.tfPool.filter((q) => q.category === this.topic);
    return filtered.length > 0 ? filtered : this.tfPool;
  }

  private nextTargetPosition(): number {
    if (!this.posBag.length) {
      this.posBag = [0, 1, 2, 3];
      for (let i = this.posBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.posBag[i], this.posBag[j]] = [this.posBag[j], this.posBag[i]];
      }
    }
    return this.posBag.pop()!;
  }

  pickForDoor(doorIndex: number, preferTrueFalse?: boolean): ActiveQuiz {
    const useTf =
      preferTrueFalse !== undefined ? preferTrueFalse : this.rng() < 0.25;
    if (useTf) {
      return this.buildTrueFalseQuiz('door', doorIndex, undefined, 0);
    }
    return this.buildMcqQuiz('door', doorIndex);
  }

  pickForGuard(guardIndex: number, timeLimit: number): ActiveQuiz {
    // Quick guard encounters prefer True/False per PRD §7.3 & §10.4
    return this.buildTrueFalseQuiz('guard', undefined, guardIndex, timeLimit);
  }

  private buildMcqQuiz(kind: 'door' | 'guard', doorIndex?: number): ActiveQuiz {
    const pool = this.getActiveMcPool();
    let available = pool.filter((q) => !this.seenMc.has(q.id));
    if (available.length === 0) {
      this.seenMc.clear();
      available = pool;
    }
    const q = available[Math.floor(this.rng() * available.length)];
    this.seenMc.add(q.id);

    const correctText = q.options[q.answerIndex];
    const distractors = q.options.filter((_, i) => i !== q.answerIndex);
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
    }

    const targetPos = this.nextTargetPosition();
    const shuffledOptions: string[] = [];
    let dIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (i === targetPos) {
        shuffledOptions.push(correctText);
      } else {
        shuffledOptions.push(distractors[dIdx++]);
      }
    }

    return {
      kind,
      doorIndex,
      questionType: 'multiple_choice',
      questionId: q.id,
      category: CATEGORY_LABELS[q.category] || q.category,
      prompt: q.question,
      options: shuffledOptions,
      correctIndex: targetPos,
      explanation: q.explanation,
      sourceIds: q.sourceIds,
      timeLimit: 0,
      timeLeft: 0,
      answered: false,
      selectedIndex: null,
      wasCorrect: null,
      autoCloseLeft: 10,
    };
  }

  private buildTrueFalseQuiz(
    kind: 'door' | 'guard',
    doorIndex?: number,
    guardIndex?: number,
    timeLimit = 10
  ): ActiveQuiz {
    const pool = this.getActiveTfPool();
    let available = pool.filter((q) => !this.seenTf.has(q.id));
    if (available.length === 0) {
      this.seenTf.clear();
      available = pool;
    }
    const q = available[Math.floor(this.rng() * available.length)];
    this.seenTf.add(q.id);

    // Button 0 = Benar, Button 1 = Salah
    const correctIndex = q.answerBoolean ? 0 : 1;

    return {
      kind,
      doorIndex,
      guardIndex,
      questionType: 'true_false',
      questionId: q.id,
      category: CATEGORY_LABELS[q.category] || q.category,
      prompt: q.statement,
      options: ['Benar', 'Salah'],
      correctIndex,
      explanation: q.explanation,
      sourceIds: q.sourceIds,
      timeLimit,
      timeLeft: timeLimit,
      answered: false,
      selectedIndex: null,
      wasCorrect: null,
      autoCloseLeft: 10,
    };
  }
}
