import { useCallback, useEffect, useRef, useState } from 'react';
import { DIFFICULTY_PROFILES } from './guards/GuardAI';
import { applyQuizOutcome, calculateScore, getRankForScore } from './gameplay/ScoreManager';
import { DEFAULT_SEED, MAP_CATALOG, MAX_STAMINA, TOTAL_KEYS } from './maze/MazeConfig';
import { QuestionManager } from './questions/QuestionManager';
import { validateQuestionBank } from './questions/QuestionValidator';
import { AudioManager } from './systems/AudioManager';
import {
  addLeaderboardEntry,
  clearGameState,
  clearLeaderboard,
  getPersonalBest,
  getSavedPlayerName,
  loadGameState,
  loadLeaderboard,
  loadSettings,
  saveGameState,
  savePlayerName,
  saveSettings,
  setPersonalBest,
} from './systems/SaveManager';
import { MazeSceneController } from './three/MazeScene';
import type {
  ActiveQuiz,
  EscapeRouteId,
  GamePhase,
  GameSettings,
  HudSnapshot,
  LeaderboardEntry,
  MapId,
  RunSummary,
  SaveStateV2,
} from './types/game';
import { HistoricalJournalModal } from './ui/HandDrawnArtwork';
import { HUD } from './ui/HUD';
import {
  EndGameModal,
  HowToPlayModal,
  LeaderboardModal,
  PauseModal,
  SettingsModal,
  TitleScreen,
  WebGLErrorScreen,
} from './ui/MenuScreens';
import { QuizModal } from './ui/QuizModal';
import { IntroCutsceneOverlay, StoryBookModal } from './ui/StoryOverlays';

type SubModal = 'none' | 'howto' | 'archive' | 'leaderboard' | 'settings';

const INITIAL_HUD: HudSnapshot = {
  mapId: 'gudang',
  mapName: MAP_CATALOG.gudang.name,
  currentFloor: 0,
  totalFloors: 1,
  elapsedTime: 0,
  lives: 5,
  maxLives: 5,
  keysCollected: 0,
  totalKeys: TOTAL_KEYS,
  streak: 0,
  bestStreak: 0,
  stamina: MAX_STAMINA,
  maxStamina: MAX_STAMINA,
  isSprinting: false,
  isExhausted: false,
  dodgeCooldown: 0,
  dodgeMaxCooldown: 2.0,
  isDodging: false,
  isSlowed: false,
  isInvuln: false,
  nearPrompt: null,
  nearKey: false,
  nearBook: false,
  regionId: 'depot',
  regionName: 'Gudang Logistik',
  pointerLocked: false,
  exitsUnlocked: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MazeSceneController | null>(null);
  const questionMgrRef = useRef<QuestionManager>(new QuestionManager(1942));

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [selectedMap, setSelectedMap] = useState<MapId>('gudang');
  const [phase, setPhase] = useState<GamePhase>('title');
  const [subModal, setSubModal] = useState<SubModal>('none');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [storyBookOpen, setStoryBookOpen] = useState(false);
  const [introState, setIntroState] = useState({ progress: 0, beatIndex: 0 });
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [savedGame, setSavedGame] = useState<SaveStateV2 | null>(() => loadGameState());
  const [personalBest, setPersonalBestState] = useState<number | null>(() => getPersonalBest());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<'amber' | 'red' | 'green' | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<GamePhase>('title');
  const settingsRef = useRef<GameSettings>(settings);
  const selectedMapRef = useRef<MapId>(selectedMap);
  const activeQuizRef = useRef<ActiveQuiz | null>(null);
  const mapExpandedRef = useRef(false);
  const storyBookOpenRef = useRef(false);

  phaseRef.current = phase;
  settingsRef.current = settings;
  selectedMapRef.current = selectedMap;
  activeQuizRef.current = activeQuiz;
  mapExpandedRef.current = mapExpanded;
  storyBookOpenRef.current = storyBookOpen;

  // Validate WWII question bank on mount
  useEffect(() => {
    const res = validateQuestionBank();
    if (!res.ok) {
      setBankError(res.errors[0] || 'Bank soal tidak lengkap');
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const triggerFlash = useCallback((color: 'amber' | 'red' | 'green') => {
    setFlash(color);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 320);
  }, []);

  const syncPhase = useCallback((next: GamePhase) => {
    setPhase(next);
    document.body.dataset.state = next;
    controllerRef.current?.setPhase(next);
  }, []);

  const finishRun = useCallback(
    (won: boolean, routeId: EscapeRouteId | null, routeName: string | null) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      ctrl.setPhase('gameover');
      setPhase('gameover');
      document.body.dataset.state = 'gameover';
      setActiveQuiz(null);
      setMapExpanded(false);
      setStoryBookOpen(false);
      clearGameState();
      setSavedGame(null);
      AudioManager.stopBGM();
      AudioManager.play(won ? 'victory' : 'gameOver');

      const score = calculateScore({
        correct: ctrl.stats.correct,
        wrong: ctrl.stats.wrong,
        keysCollected: ctrl.collectedKeys.size,
        lives: ctrl.lives,
        bestStreak: ctrl.bestStreak,
        won,
      });

      let isNewBest = false;
      if (won) {
        const prev = getPersonalBest();
        if (prev === null || ctrl.elapsedTime < prev) {
          setPersonalBest(Number(ctrl.elapsedTime.toFixed(2)));
          setPersonalBestState(Number(ctrl.elapsedTime.toFixed(2)));
          isNewBest = true;
        }
      }

      const activeMap = ctrl.activeMapId;
      setRunSummary({
        won,
        mapId: activeMap,
        mapName: MAP_CATALOG[activeMap].name,
        score,
        rank: getRankForScore(score),
        elapsedTime: ctrl.elapsedTime,
        lives: ctrl.lives,
        keysCollected: ctrl.collectedKeys.size,
        stats: { ...ctrl.stats },
        bestStreak: ctrl.bestStreak,
        selectedExit: routeId,
        selectedExitName: routeName,
        isNewBest,
      });
    },
    []
  );

  const handleCloseQuiz = useCallback(
    (quizSnapshot: ActiveQuiz | null) => {
      const ctrl = controllerRef.current;
      const q = quizSnapshot || activeQuizRef.current;
      if (!ctrl || !q) return;

      setActiveQuiz(null);
      if (ctrl.lives <= 0) {
        finishRun(false, null, null);
        return;
      }

      if (q.kind === 'guard') {
        ctrl.resolveGuardEncounter(Boolean(q.wasCorrect));
      } else if (q.kind === 'door' && q.wasCorrect && q.doorIndex !== undefined) {
        ctrl.openDoor(q.doorIndex);
      }

      syncPhase('playing');
      ctrl.requestPointerLock();
      saveGameState(ctrl.exportSaveState());
      setSavedGame(ctrl.exportSaveState());
    },
    [finishRun, syncPhase]
  );

  const handleAnswerQuiz = useCallback(
    (selectedIndex: number | null) => {
      const ctrl = controllerRef.current;
      const current = activeQuizRef.current;
      if (!ctrl || !current || current.answered) return;

      const isCorrect = selectedIndex !== null && selectedIndex === current.correctIndex;
      const outcome = applyQuizOutcome({
        correct: isCorrect,
        isGuardEncounter: current.kind === 'guard',
        lives: ctrl.lives,
        streak: ctrl.streak,
        bestStreak: ctrl.bestStreak,
        stats: ctrl.stats,
      });

      ctrl.lives = outcome.lives;
      ctrl.streak = outcome.streak;
      ctrl.bestStreak = outcome.bestStreak;
      ctrl.stats = outcome.stats;
      ctrl.emitHud();

      if (isCorrect) {
        AudioManager.play('correct');
        triggerFlash(outcome.healed ? 'green' : 'amber');
        if (outcome.healed) {
          showToast('3 Jawaban benar beruntun! Nyawa pulih +1');
        }
      } else {
        AudioManager.play('wrong');
        triggerFlash('red');
      }

      setActiveQuiz({
        ...current,
        answered: true,
        selectedIndex,
        wasCorrect: isCorrect,
        autoCloseLeft: 9,
      });
    },
    [showToast, triggerFlash]
  );

  const handleOpenStoryBook = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    setMapExpanded(false);
    setStoryBookOpen(true);
    syncPhase('paused');
  }, [syncPhase]);

  const handleCloseStoryBook = useCallback(() => {
    setStoryBookOpen(false);
    syncPhase('playing');
    controllerRef.current?.requestPointerLock();
  }, [syncPhase]);

  // Quiz countdown & auto-close timer
  useEffect(() => {
    if (phase !== 'quiz' || !activeQuiz) return;
    const id = window.setInterval(() => {
      setActiveQuiz((prev) => {
        if (!prev) return null;
        if (!prev.answered) {
          if (prev.timeLimit <= 0) return prev;
          const nextTime = prev.timeLeft - 0.1;
          if (nextTime <= 0) {
            queueMicrotask(() => handleAnswerQuiz(null));
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: nextTime };
        } else {
          const nextAuto = prev.autoCloseLeft - 0.1;
          if (nextAuto <= 0) {
            queueMicrotask(() => handleCloseQuiz(prev));
            return { ...prev, autoCloseLeft: 0 };
          }
          return { ...prev, autoCloseLeft: nextAuto };
        }
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase, activeQuiz !== null, handleAnswerQuiz, handleCloseQuiz]);

  // Smooth cutscene progress bar polling during intro
  useEffect(() => {
    if (phase !== 'intro') return;
    const id = window.setInterval(() => {
      setIntroState((prev) => ({
        ...prev,
        progress: Math.min(1, prev.progress + 0.015),
      }));
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Keep AudioManager synced with settings
  useEffect(() => {
    AudioManager.setVolumes(settings.musicVolume, settings.sfxVolume, settings.muted);
    saveSettings(settings);
    controllerRef.current?.updateSettings(settings);
  }, [settings]);

  // Stable callbacks ref for WebGL2 MazeSceneController
  const callbacksRef = useRef({
    onHudUpdate: (snap: HudSnapshot) => setHud(snap),
    onDoorInteract: (doorIndex: number) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      setMapExpanded(false);
      const quiz = questionMgrRef.current.pickForDoor(doorIndex);
      setActiveQuiz(quiz);
      setPhase('quiz');
      document.body.dataset.state = 'quiz';
      ctrl.setPhase('quiz');
    },
    onBookInteract: () => {
      handleOpenStoryBook();
    },
    onGuardEncounter: (guardIndex: number) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      setMapExpanded(false);
      setStoryBookOpen(false);
      const profile = DIFFICULTY_PROFILES[settingsRef.current.difficulty];
      const mapDef = MAP_CATALOG[ctrl.activeMapId];
      const encounterTime = Math.max(6, profile.encounterTime + mapDef.encounterTimeDelta);
      const quiz = questionMgrRef.current.pickForGuard(
        guardIndex,
        encounterTime
      );
      setActiveQuiz(quiz);
      setPhase('quiz');
      document.body.dataset.state = 'quiz';
      ctrl.setPhase('quiz');
    },
    onVictory: (routeId: EscapeRouteId, routeName: string) => {
      finishRun(true, routeId, routeName);
    },
    onKeyCollected: (count: number, label: string) => {
      showToast(
        count >= TOTAL_KEYS
          ? `${label} ditemukan (${TOTAL_KEYS}/${TOTAL_KEYS})! Semua 3 jalur keluar terbuka!`
          : `${label} ditemukan (${count}/${TOTAL_KEYS})`
      );
    },
    onToast: (message: string) => showToast(message),
    onFlash: (color: 'amber' | 'red' | 'green') => triggerFlash(color),
    onTogglePause: () => {
      if (storyBookOpenRef.current) {
        handleCloseStoryBook();
        return;
      }
      if (mapExpandedRef.current) {
        setMapExpanded(false);
        return;
      }
      if (phaseRef.current === 'playing') {
        syncPhase('paused');
        const ctrl = controllerRef.current;
        if (ctrl) {
          const s = ctrl.exportSaveState();
          saveGameState(s);
          setSavedGame(s);
        }
      } else if (phaseRef.current === 'paused') {
        setSubModal('none');
        syncPhase('playing');
      }
    },
    onToggleMinimap: () => {
      if (phaseRef.current === 'playing') {
        setMapExpanded((v) => !v);
      }
    },
    onToggleMute: () =>
      setSettings((prev) => ({ ...prev, muted: !prev.muted })),
    onIntroUpdate: (progress: number, beatIndex: number) => {
      setIntroState({ progress, beatIndex });
    },
    onIntroComplete: () => {
      setPhase('playing');
      document.body.dataset.state = 'playing';
      showToast('Baca Buku Catatan di meja [E] sebelum menelusuri labirin!');
    },
    onAutosave: (save: SaveStateV2) => {
      saveGameState(save);
      setSavedGame(save);
    },
    onWebGLError: (reason: string) => setWebglError(reason),
  });

  // Mount WebGL2 scene once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    document.body.dataset.state = 'title';
    const controller = new MazeSceneController(el, settingsRef.current, {
      onHudUpdate: (s) => callbacksRef.current.onHudUpdate(s),
      onDoorInteract: (d) => callbacksRef.current.onDoorInteract(d),
      onBookInteract: () => callbacksRef.current.onBookInteract(),
      onGuardEncounter: (g) => callbacksRef.current.onGuardEncounter(g),
      onVictory: (id, name) => callbacksRef.current.onVictory(id, name),
      onKeyCollected: (c, l) => callbacksRef.current.onKeyCollected(c, l),
      onToast: (m) => callbacksRef.current.onToast(m),
      onFlash: (c) => callbacksRef.current.onFlash(c),
      onTogglePause: () => callbacksRef.current.onTogglePause(),
      onToggleMinimap: () => callbacksRef.current.onToggleMinimap(),
      onToggleMute: () => callbacksRef.current.onToggleMute(),
      onIntroUpdate: (p, b) => callbacksRef.current.onIntroUpdate(p, b),
      onIntroComplete: () => callbacksRef.current.onIntroComplete(),
      onAutosave: (s) => callbacksRef.current.onAutosave(s),
      onWebGLError: (r) => callbacksRef.current.onWebGLError(r),
    });
    controllerRef.current = controller;

    // Support ?autostart=1&map=gudang|hutan|pedesaan|gedung testability parameters
    const params = new URLSearchParams(window.location.search);
    const paramMapRaw = params.get('map') as MapId | null;
    const validParamMap: MapId | null =
      paramMapRaw && Object.prototype.hasOwnProperty.call(MAP_CATALOG, paramMapRaw)
        ? paramMapRaw
        : null;
    if (validParamMap) {
      setSelectedMap(validParamMap);
      selectedMapRef.current = validParamMap;
    }
    if (params.get('autostart') === '1') {
      const startMap = validParamMap ?? 'gudang';
      questionMgrRef.current.reset(1942);
      controller.startNewGame(startMap);
      setPhase('playing');
      document.body.dataset.state = 'playing';
    } else if (validParamMap && validParamMap !== 'gudang') {
      controller.buildMazeWorld(DEFAULT_SEED, validParamMap);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && phaseRef.current === 'playing') {
        const s = controller.exportSaveState();
        saveGameState(s);
        setSavedGame(s);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleSelectMap = useCallback((mapId: MapId) => {
    setSelectedMap(mapId);
    selectedMapRef.current = mapId;
    if (phaseRef.current === 'title') {
      controllerRef.current?.buildMazeWorld(DEFAULT_SEED, mapId);
    }
  }, []);

  const handleStartNewGame = useCallback(
    (mapId?: MapId) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const targetMap = mapId ?? selectedMapRef.current;
      setSelectedMap(targetMap);
      selectedMapRef.current = targetMap;
      AudioManager.ensure();
      AudioManager.setVolumes(settings.musicVolume, settings.sfxVolume, settings.muted);
      AudioManager.startBGM();
      questionMgrRef.current.reset(Date.now());
      clearGameState();
      setSavedGame(null);
      setRunSummary(null);
      setActiveQuiz(null);
      setMapExpanded(false);
      setStoryBookOpen(false);
      setSubModal('none');
      setIntroState({ progress: 0, beatIndex: 0 });
      ctrl.startIntroCutscene(targetMap);
      setPhase('intro');
      document.body.dataset.state = 'intro';
    },
    [settings]
  );

  const handleRestartDirect = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const targetMap = ctrl.activeMapId || selectedMapRef.current;
    AudioManager.ensure();
    AudioManager.setVolumes(settings.musicVolume, settings.sfxVolume, settings.muted);
    AudioManager.startBGM();
    questionMgrRef.current.reset(Date.now());
    clearGameState();
    setSavedGame(null);
    setRunSummary(null);
    setActiveQuiz(null);
    setMapExpanded(false);
    setStoryBookOpen(false);
    setSubModal('none');
    ctrl.startNewGame(targetMap);
    setPhase('playing');
    document.body.dataset.state = 'playing';
    showToast(
      `${MAP_CATALOG[targetMap].name} dimulai ulang! Kumpulkan ${TOTAL_KEYS} kunci untuk membuka 3 jalur keluar.`
    );
  }, [settings, showToast]);

  const handleContinueSave = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl || !savedGame) return;
    const savedMap: MapId =
      savedGame.mapId && MAP_CATALOG[savedGame.mapId] ? savedGame.mapId : 'gudang';
    setSelectedMap(savedMap);
    selectedMapRef.current = savedMap;
    AudioManager.ensure();
    AudioManager.setVolumes(settings.musicVolume, settings.sfxVolume, settings.muted);
    AudioManager.startBGM();
    questionMgrRef.current.reset(Date.now());
    setRunSummary(null);
    setActiveQuiz(null);
    setMapExpanded(false);
    setStoryBookOpen(false);
    setSubModal('none');
    ctrl.restoreFromSave(savedGame);
    setPhase('playing');
    document.body.dataset.state = 'playing';
    showToast(`Melanjutkan progres misi (${MAP_CATALOG[savedMap].shortName}).`);
  }, [savedGame, settings, showToast]);

  const handleReturnToTitle = useCallback(() => {
    AudioManager.stopBGM();
    setActiveQuiz(null);
    setRunSummary(null);
    setMapExpanded(false);
    setStoryBookOpen(false);
    setSubModal('none');
    syncPhase('title');
    setSavedGame(loadGameState());
  }, [syncPhase]);

  const handleSaveScore = useCallback(
    (playerName: string) => {
      if (!runSummary) return;
      savePlayerName(playerName);
      const entry: LeaderboardEntry = {
        name: playerName,
        mapId: runSummary.mapId,
        score: runSummary.score,
        rank: runSummary.rank,
        elapsedTime: runSummary.elapsedTime,
        correct: runSummary.stats.correct,
        wrong: runSummary.stats.wrong,
        lives: runSummary.lives,
        keys: runSummary.keysCollected,
        bestStreak: runSummary.bestStreak,
        dodgesUsed: runSummary.stats.dodgesUsed,
        exitRoute: runSummary.selectedExit || 'A',
        date: new Date().toISOString(),
      };
      addLeaderboardEntry(entry);
      setLeaderboard(loadLeaderboard());
    },
    [runSummary]
  );

  if (webglError) {
    return <WebGLErrorScreen reason={webglError} />;
  }

  const ctrl = controllerRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0e13]">
      {/* Dedicated WebGL2 3D Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen */}
      {phase === 'title' && (
        <TitleScreen
          selectedMap={selectedMap}
          onSelectMap={handleSelectMap}
          savedGame={savedGame}
          personalBest={personalBest}
          bankError={bankError}
          onStartNew={handleStartNewGame}
          onContinueSave={handleContinueSave}
          onOpenHowTo={() => setSubModal('howto')}
          onOpenArchive={() => setSubModal('archive')}
          onOpenLeaderboard={() => setSubModal('leaderboard')}
          onOpenSettings={() => setSubModal('settings')}
          isSubModalOpen={subModal !== 'none'}
        />
      )}

      {/* Capture Cutscene Overlay */}
      {phase === 'intro' && (
        <IntroCutsceneOverlay
          mapId={ctrl?.activeMapId ?? selectedMap}
          beatIndex={introState.beatIndex}
          progress={introState.progress}
          onSkip={() => ctrl?.skipIntro()}
        />
      )}

      {/* Active Gameplay Perimeter HUD & Enlarged Map */}
      {(phase === 'playing' || phase === 'quiz' || phase === 'paused') && (
        <HUD
          hud={hud}
          settings={settings}
          mapExpanded={mapExpanded}
          toast={toast}
          flash={flash}
          layout={ctrl?.layout ?? null}
          explored={ctrl?.explored ?? null}
          exploredFloors={ctrl?.exploredFloors}
          playerFloor={ctrl?.playerFloor ?? hud.currentFloor}
          playerX={ctrl?.playerX ?? 2.5}
          playerY={ctrl?.playerY ?? 2.5}
          yaw={ctrl?.yaw ?? 0}
          collectedKeys={ctrl?.collectedKeys ?? new Set()}
          doors={ctrl?.doors ?? []}
          guards={ctrl?.guards ?? []}
          onTogglePause={() => callbacksRef.current.onTogglePause()}
          onToggleMapExpanded={() => setMapExpanded((v) => !v)}
          onToggleMute={() => setSettings((p) => ({ ...p, muted: !p.muted }))}
          onTouchSprint={(active) => ctrl?.setTouchSprint(active)}
          onTriggerInteract={() => ctrl?.triggerInteract()}
          onTouchMove={(x, y) => ctrl?.setTouchMove(x, y)}
          onLookDelta={(dx, dy) => ctrl?.addLookDelta(dx, dy)}
        />
      )}

      {/* Story Book Modal (Desk Diary at Starting Room) */}
      {storyBookOpen && (
        <StoryBookModal
          mapId={ctrl?.activeMapId ?? selectedMap}
          onClose={handleCloseStoryBook}
        />
      )}

      {/* Quiz Modal (Door Checkpoints & Guard Encounters) */}
      {phase === 'quiz' && activeQuiz && (
        <QuizModal
          quiz={activeQuiz}
          onSelectAnswer={(idx) => handleAnswerQuiz(idx)}
          onContinue={() => handleCloseQuiz(activeQuiz)}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && subModal === 'none' && !storyBookOpen && (
        <PauseModal
          onResume={() => syncPhase('playing')}
          onRestart={handleRestartDirect}
          onOpenSettings={() => setSubModal('settings')}
          onOpenHowTo={() => setSubModal('howto')}
          onMainMenu={handleReturnToTitle}
        />
      )}

      {/* End Game Summary Modal (Victory or Defeat) */}
      {phase === 'gameover' && runSummary && (
        <EndGameModal
          summary={runSummary}
          defaultPlayerName={getSavedPlayerName()}
          onSaveScore={handleSaveScore}
          onPlayAgain={handleRestartDirect}
          onMainMenu={handleReturnToTitle}
        />
      )}

      {/* Secondary Modals */}
      {subModal === 'howto' && <HowToPlayModal onClose={() => setSubModal('none')} />}
      {subModal === 'archive' && (
        <HistoricalJournalModal onClose={() => setSubModal('none')} />
      )}
      {subModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSubModal('none')}
        />
      )}
      {subModal === 'leaderboard' && (
        <LeaderboardModal
          entries={leaderboard}
          onClear={() => {
            clearLeaderboard();
            setLeaderboard([]);
          }}
          onClose={() => setSubModal('none')}
        />
      )}
    </div>
  );
}
