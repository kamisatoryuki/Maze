import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMaze } from '../maze/MazeGenerator';
import { validateMaze } from '../maze/MazeValidator';
import {
  MAZE_SIZE,
  MAP_CATALOG,
  MAP_ORDER,
  TOTAL_KEYS,
  DEFAULT_SEED,
  PLAYER_SPEED,
  SPRINT_SPEED_MULT,
} from '../maze/MazeConfig';
import { CATEGORY_LABELS } from '../data/ww2Questions';
import { getTopicCounts, validateQuestionBank } from '../questions/QuestionValidator';
import { QuestionManager } from '../questions/QuestionManager';
import { moveWithCollision } from '../player/Collision';
import { applyQuizOutcome, calculateScore, getRankForScore } from '../gameplay/ScoreManager';
import { buildGuardBlockedMask, stepGuard } from '../guards/GuardAI';
import { createRng } from '../maze/Pathfinding';
import type { GuardNode, QuizTopicId } from '../types/game';

test('96x96 expanded maze (>2x area) generates deterministically and passes all MazeValidator checks', () => {
  const m1 = generateMaze(DEFAULT_SEED);
  const m2 = generateMaze(DEFAULT_SEED);

  assert.equal(m1.width, MAZE_SIZE);
  assert.equal(m1.width, 96);
  assert.ok(m1.grid.length >= 64 * 64 * 2, 'Expanded maze area should be at least 2x 64x64');
  assert.equal(m1.grid.length, 96 * 96);
  assert.deepEqual(m1.grid, m2.grid);
  assert.equal(m1.keys.length, TOTAL_KEYS);
  assert.equal(m1.keys.length, 7);
  assert.equal(m1.doors.length, 4);
  assert.equal(m1.exits.length, 3);
  assert.equal(m1.guards.length, 11);
  assert.equal(m1.traps.length, 20);
  assert.deepEqual(m1.storyBook, { floor: 0, x: 4, y: 2 });

  const result = validateMaze(m1);
  assert.equal(result.ok, true, `Maze validation failed: ${result.errors.join('; ')}`);
  assert.equal(result.stats.keysReachable, 7);
  assert.equal(result.stats.exitsReachable, 3);
  assert.equal(result.stats.independentExitRoutes, 3);
  assert.equal(result.stats.narrowCorridorViolations, 0);
});

test('All 5 maps (pelabuhan, gudang, hutan, pedesaan, gedung 3 floors) generate deterministically and pass MazeValidator', () => {
  assert.equal(MAP_ORDER.length, 5);
  for (const mapId of MAP_ORDER) {
    const def = MAP_CATALOG[mapId];
    const layout = generateMaze(DEFAULT_SEED, mapId);
    assert.equal(layout.mapId, mapId);
    assert.equal(layout.width, def.gridSize);
    assert.equal(layout.floors, def.floors);
    assert.equal(layout.floorGrids.length, def.floors);
    assert.equal(layout.keys.length, TOTAL_KEYS);
    assert.equal(layout.guards.length, def.guardCount);
    assert.equal(layout.traps.length, def.trapCount);
    assert.equal(layout.exits.length, 3);

    const res = validateMaze(layout);
    assert.equal(res.ok, true, `${mapId} validation failed: ${res.errors.join('; ')}`);
    assert.equal(res.stats.keysReachable, 7, `${mapId} should have all 7 keys reachable`);
    assert.equal(res.stats.exitsReachable, 3, `${mapId} should have all 3 exits reachable`);
    assert.equal(res.stats.independentExitRoutes, 3, `${mapId} should have 3 independent escape routes`);
    assert.equal(res.stats.narrowCorridorViolations, 0, `${mapId} must have wide >=2-cell corridors`);
  }
});

test('Pelabuhan map is compact (56x56), Mudah difficulty, and tuned for 3-5 minute playtime', () => {
  const def = MAP_CATALOG.pelabuhan;
  const pelabuhan = generateMaze(DEFAULT_SEED, 'pelabuhan');
  assert.equal(def.difficultyLabel, 'Mudah');
  assert.equal(def.durationLabel, '3–5 Mnt');
  assert.equal(pelabuhan.width, 56);
  assert.equal(pelabuhan.floors, 1);
  assert.equal(pelabuhan.guards.length, 6);
  assert.equal(pelabuhan.traps.length, 8);
  assert.ok(def.guardSpeedMult < 0.85, 'Easy map guards should move significantly slower');
  assert.ok(def.encounterTimeDelta > 0, 'Easy map should grant extra quiz answer time');
  assert.ok(pelabuhan.walkableCells.length < 2200, 'Compact walkable area for 3-5 min playtime');
});

test('Gedung 3-floor map has 4 staircases connecting floors 1-2-3 and keys on every floor', () => {
  const gedung = generateMaze(DEFAULT_SEED, 'gedung');
  assert.equal(gedung.width, 104);
  assert.equal(gedung.floors, 3);
  assert.equal(gedung.stairs.length, 4);

  const stairs01 = gedung.stairs.filter((s) => s.fromFloor === 0 && s.toFloor === 1);
  const stairs12 = gedung.stairs.filter((s) => s.fromFloor === 1 && s.toFloor === 2);
  assert.equal(stairs01.length, 2, 'Expected 2 staircases between floor 1 and floor 2');
  assert.equal(stairs12.length, 2, 'Expected 2 staircases between floor 2 and floor 3');

  const keyFloors = new Set(gedung.keys.map((k) => k.floor));
  assert.equal(keyFloors.has(0), true, 'Expected keys on floor 1');
  assert.equal(keyFloors.has(1), true, 'Expected keys on floor 2');
  assert.equal(keyFloors.has(2), true, 'Expected keys on floor 3');

  const guardFloors = new Set(gedung.guards.map((g) => g.floor));
  assert.deepEqual([...guardFloors].sort(), [0, 1, 2]);
});

test('Player base speed is slightly faster than normal guard chase and Sprint outpaces sulit guards', () => {
  const normalGuardChase = 2.55;
  const sulitGuardChase = 2.55 * 1.24;
  assert.ok(PLAYER_SPEED > normalGuardChase, 'Player base speed should be slightly faster than normal chasing guard');
  assert.ok(PLAYER_SPEED < 3.2, 'Player base speed should be reduced below 3.2 for tense pacing');
  assert.ok(PLAYER_SPEED * SPRINT_SPEED_MULT > sulitGuardChase, 'Sprinting player should outpace sulit guard');
});

test('7 keys are distributed across all 4 distinct regions', () => {
  const maze = generateMaze(DEFAULT_SEED);
  const regions = new Set(maze.keys.map((k) => k.region));
  assert.ok(regions.size >= 4, `Expected keys in all 4 regions, got ${[...regions].join(', ')}`);
});

test('WWII question bank passes strict validation (MCQ >= 48, TF >= 40, >= 12/10 per topic, valid sources)', () => {
  const res = validateQuestionBank();
  assert.equal(res.ok, true, `Question bank errors: ${res.errors.join('; ')}`);
  assert.ok(res.counts.multipleChoice >= 48);
  assert.ok(res.counts.trueFalse >= 40);
  assert.ok(res.counts.total >= 88);

  const topicCounts = getTopicCounts();
  assert.equal(topicCounts.ALL.total, res.counts.total);
  const topics: QuizTopicId[] = [
    'WWII-Europe',
    'Pacific-War',
    'Indonesia-Occupation',
    'End-of-War',
  ];
  for (const t of topics) {
    assert.ok(topicCounts[t].multipleChoice >= 12, `${t} should have at least 12 MCQ`);
    assert.ok(topicCounts[t].trueFalse >= 10, `${t} should have at least 10 True/False`);
  }
});

test('QuestionManager shuffles MCQ options without losing correct answer and prefers TF for guards', () => {
  const qm = new QuestionManager(1942);
  const seenIds = new Set<string>();
  const positions = new Set<number>();

  for (let i = 0; i < 20; i++) {
    const q = qm.pickForDoor(0, false);
    assert.equal(q.questionType, 'multiple_choice');
    assert.equal(q.options.length, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
    assert.ok(q.explanation.length >= 10);
    assert.ok(q.sourceIds.length >= 1);
    assert.ok(!seenIds.has(q.questionId), `Repeated question before pool exhausted: ${q.questionId}`);
    seenIds.add(q.questionId);
    positions.add(q.correctIndex);
  }

  assert.ok(positions.size >= 3, 'Shuffled answer positions should vary across slots');

  const guardQ = qm.pickForGuard(0, 10);
  assert.equal(guardQ.questionType, 'true_false');
  assert.deepEqual(guardQ.options, ['Benar', 'Salah']);
  assert.equal(guardQ.timeLimit, 10);
});

test('QuestionManager filters both door MCQ and guard TF questions strictly by selected topic', () => {
  const specificTopics: Array<Exclude<QuizTopicId, 'ALL'>> = [
    'WWII-Europe',
    'Pacific-War',
    'Indonesia-Occupation',
    'End-of-War',
  ];
  for (const topic of specificTopics) {
    const qm = new QuestionManager(1942);
    qm.reset(2026, topic);
    assert.equal(qm.getTopic(), topic);
    const expectedLabel = CATEGORY_LABELS[topic];
    const seenMc = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const q = qm.pickForDoor(i % 4, false);
      assert.equal(q.category, expectedLabel, `Door quiz leaked wrong topic for ${topic}`);
      assert.ok(!seenMc.has(q.questionId), `Duplicate MCQ in ${topic} before exhausting 12-question pool`);
      seenMc.add(q.questionId);
    }
    const seenTf = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const q = qm.pickForGuard(i % 5, 10);
      assert.equal(q.category, expectedLabel, `Guard quiz leaked wrong topic for ${topic}`);
      assert.ok(!seenTf.has(q.questionId), `Duplicate TF in ${topic} before exhausting 10-question pool`);
      seenTf.add(q.questionId);
    }
  }
});

test('Collision and dodge movement never tunnel through walls or closed quiz doors', () => {
  const maze = generateMaze(DEFAULT_SEED);
  const world = {
    grid: maze.grid,
    doors: maze.doors,
    traps: [],
    props: [],
  };

  // Try slamming straight west into the outer wall at x=0 from (1.5, 2.5)
  const res = moveWithCollision(world, { x: 1.5, y: 2.5 }, -3.0, 0);
  assert.ok(res.x > 1.0, `Player tunneled into wall! x=${res.x}`);
  assert.equal(res.collided, true);

  // Try moving through a closed quiz door
  const door = maze.doors[0];
  const [dx, dy] = door.cells[0];
  const doorRes = moveWithCollision(world, { x: dx + 0.5, y: dy + 0.5 - 1.0 }, 0, 2.0);
  assert.equal(doorRes.collided, true);
});

test('Scoring, rank calculation, and 3-streak life recovery work as specified', () => {
  const score = calculateScore({
    correct: 8,
    wrong: 1,
    keysCollected: 5,
    lives: 4,
    bestStreak: 6,
    won: true,
  });
  // 800 + 750 + 200 + 120 - 30 + 400 = 2240
  assert.equal(score, 2240);
  assert.equal(getRankForScore(score), 'S');
  assert.equal(getRankForScore(300), 'E');

  let state = {
    lives: 3,
    streak: 2,
    bestStreak: 2,
    stats: { correct: 2, wrong: 1, guardCatches: 1, trapHits: 0, doorsOpened: 1, dodgesUsed: 2 },
  };
  const next = applyQuizOutcome({
    correct: true,
    isGuardEncounter: false,
    ...state,
  });
  assert.equal(next.streak, 3);
  assert.equal(next.healed, true);
  assert.equal(next.lives, 4);

  const wrongDoor = applyQuizOutcome({
    correct: false,
    isGuardEncounter: false,
    lives: 4,
    streak: 3,
    bestStreak: 3,
    stats: next.stats,
  });
  assert.equal(wrongDoor.lostLife, false);
  assert.equal(wrongDoor.lives, 4);
  assert.equal(wrongDoor.streak, 0);

  const wrongGuard = applyQuizOutcome({
    correct: false,
    isGuardEncounter: true,
    lives: 4,
    streak: 0,
    bestStreak: 3,
    stats: wrongDoor.stats,
  });
  assert.equal(wrongGuard.lostLife, true);
  assert.equal(wrongGuard.lives, 3);
});

test('Guard AI transitions from patrol to alert/chase when player is within sight range and respects walls', () => {
  const maze = generateMaze(DEFAULT_SEED);
  const world = {
    grid: maze.grid,
    doors: maze.doors,
    traps: [],
    props: maze.props,
  };
  const mask = buildGuardBlockedMask(world);
  const g0 = maze.guards[0];
  const guard: GuardNode = {
    index: 0,
    floor: g0.floor,
    x: g0.x + 0.5,
    y: g0.y + 0.5,
    homeX: g0.x,
    homeY: g0.y,
    region: g0.region,
    state: 'patrol',
    path: [],
    speed: 0,
    repathCd: 0,
    idleTimer: 0,
    returnDelay: 0,
    stunTimer: 0,
    facingYaw: 0,
  };

  let alerted = false;
  const rng = createRng(99);
  stepGuard(
    guard,
    { x: g0.x + 1.5, y: g0.y + 0.5 },
    world,
    maze.walkableCells,
    mask,
    'normal',
    0.05,
    rng,
    () => {
      alerted = true;
    }
  );
  assert.equal(alerted, true);
  assert.equal(guard.state, 'alert');
});
