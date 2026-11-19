import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CELL_SIZE,
  DEFAULT_SEED,
  DODGE_COOLDOWN,
  DODGE_DISTANCE,
  DODGE_DURATION,
  DODGE_PROTECTION_WINDOW,
  FLOOR_HEIGHT,
  MAP_CATALOG,
  MAX_STAMINA,
  MAZE_SIZE,
  PLAYER_SPEED,
  SPRINT_SPEED_MULT,
  STAMINA_DRAIN_PER_SEC,
  STAMINA_EXHAUST_THRESHOLD,
  STAMINA_REGEN_DELAY,
  STAMINA_REGEN_PER_SEC,
  TOTAL_KEYS,
  TRAP_ACTIVE,
  TRAP_CYCLE,
  TRAP_SAFE,
  TRAP_WARN,
  WALL_HEIGHT,
  regionIndexToId,
} from '../maze/MazeConfig';
import { generateMaze } from '../maze/MazeGenerator';
import { createRng } from '../maze/Pathfinding';
import { moveWithCollision } from '../player/Collision';
import {
  DIFFICULTY_PROFILES,
  buildGuardBlockedMask,
  stepGuard,
} from '../guards/GuardAI';
import { AudioManager } from '../systems/AudioManager';
import {
  createExitGateGroup,
  createGuardGroup,
  createKeyGroup,
  createPropGroup,
  createQuizDoorGroup,
  createStaircaseGroup,
  createSteamTrapGroup,
  createStoryTableGroup,
  type DoorVisualHandles,
  type ExitVisualHandles,
  type GuardVisualHandles,
  type TrapVisualHandles,
} from './ProceduralModels';
import { createProceduralTextures, type TextureBundle } from './ProceduralTextures';
import type {
  EscapeRouteId,
  GamePhase,
  GameSettings,
  GameStats,
  GuardNode,
  HudSnapshot,
  KeyNode,
  MapId,
  MazeLayout,
  QuizDoorNode,
  RegionId,
  SaveStateV2,
  StairNode,
  TrapNode,
} from '../types/game';

export interface MazeSceneCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onDoorInteract: (doorIndex: number) => void;
  onBookInteract: () => void;
  onGuardEncounter: (guardIndex: number) => void;
  onVictory: (routeId: EscapeRouteId, routeName: string) => void;
  onKeyCollected: (count: number, label: string) => void;
  onToast: (message: string) => void;
  onFlash: (color: 'amber' | 'red' | 'green') => void;
  onTogglePause: () => void;
  onToggleMinimap: () => void;
  onToggleMute: () => void;
  onIntroUpdate: (progress: number, beatIndex: number) => void;
  onIntroComplete: () => void;
  onAutosave: (save: SaveStateV2) => void;
  onWebGLError: (reason: string) => void;
}

// Pre-allocated scratch vectors/colors for zero-GC animation loop
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);

export class MazeSceneController {
  private container: HTMLElement;
  private callbacks: MazeSceneCallbacks;
  private settings: GameSettings;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: TextureBundle;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private playerLantern!: THREE.PointLight;

  private isSoftwareGl = false;
  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;

  // Game world state
  public activeMapId: MapId = 'gudang';
  public layout!: MazeLayout;
  public phase: GamePhase = 'title';
  public elapsedTime = 0;
  public lives = 5;
  public collectedKeys = new Set<number>();
  public exploredFloors: Uint8Array[] = [new Uint8Array(MAZE_SIZE * MAZE_SIZE)];
  public explored = this.exploredFloors[0];
  public doors: QuizDoorNode[] = [];
  public traps: TrapNode[] = [];
  public guards: GuardNode[] = [];
  public streak = 0;
  public bestStreak = 0;
  public stats: GameStats = {
    correct: 0,
    wrong: 0,
    guardCatches: 0,
    trapHits: 0,
    doorsOpened: 0,
    dodgesUsed: 0,
  };

  // Player kinematics (grid coordinates: 1 unit = 1 cell)
  public playerFloor = 0;
  public playerX = 2.5;
  public playerY = 2.5;
  public yaw = -Math.PI / 2;
  public pitch = 0;
  public stamina = MAX_STAMINA;
  public isSprinting = false;
  public isExhausted = false;
  public bookRead = false;
  private playerElevation = 0;
  private staminaRegenDelay = 0;
  private bobPhase = 0;
  private invulnTimer = 0;
  private slowTimer = 0;
  private dodgeCooldown = 0;
  private dodgeActiveTimer = 0;
  private dodgeProtectTimer = 0;
  private dodgeDirX = 0;
  private dodgeDirY = 0;
  private stepSoundAccum = 0;
  private lastAmbientRegion: RegionId = 'depot';

  // Intro Capture Cutscene state
  private introTimer = 0;
  private introDuration = 7.6;
  private introBeatLast = -1;
  private introGroup = new THREE.Group();
  private introActors: GuardVisualHandles[] = [];

  // Visual handles
  private worldGroup = new THREE.Group();
  private keyMeshes: Array<THREE.Group | null> = [];
  private doorVisuals: DoorVisualHandles[] = [];
  private exitVisuals: ExitVisualHandles[] = [];
  private guardVisuals: GuardVisualHandles[] = [];
  private trapVisuals: TrapVisualHandles[] = [];
  private sharedDisposables: Array<{ dispose: () => void }> = [];

  // Input state
  private keysHeld = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private touchSprint = false;
  private isDraggingLook = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerLocked = false;
  private rng = createRng(DEFAULT_SEED + 77);
  private hudSyncAccum = 0;
  private autosaveAccum = 0;
  private lastPrompt: string | null = null;
  private guardSfxCooldown = 0;
  private trapSfxCooldown = 0;

  // Bound event listeners
  private onResizeBound = () => this.handleResize();
  private onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);
  private onKeyUpBound = (e: KeyboardEvent) => this.handleKeyUp(e);
  private onBlurBound = () => this.clearInputs();
  private onPointerLockChangeBound = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer?.domElement;
    this.emitHud();
  };
  private onMouseMoveBound = (e: MouseEvent) => this.handleMouseMove(e);
  private onMouseDownBound = (e: MouseEvent) => this.handleMouseDown(e);
  private onMouseUpBound = () => {
    this.isDraggingLook = false;
  };
  private onContextLostBound = (e: Event) => {
    e.preventDefault();
    this.callbacks.onToast('Konteks WebGL terganggu, memulihkan...');
  };

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    callbacks: MazeSceneCallbacks
  ) {
    this.container = container;
    this.settings = settings;
    this.callbacks = callbacks;
    this.initRendererAndScene();
  }

  private detectSoftwareGl(): { webgl2Supported: boolean; isSoftware: boolean } {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) {
      return { webgl2Supported: false, isSoftware: true };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { webgl2Supported: true, isSoftware };
  }

  private initRendererAndScene(): void {
    const { webgl2Supported, isSoftware } = this.detectSoftwareGl();
    if (!webgl2Supported) {
      this.callbacks.onWebGLError(
        'Perangkat atau browser Anda tidak mendukung WebGL2. Silakan aktifkan akselerasi perangkat keras atau gunakan browser modern.'
      );
      return;
    }
    this.isSoftwareGl = isSoftware;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftware && this.settings.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.applyQualitySettings();
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-testid', 'maze-3d-canvas');
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.FogExp2(0x0c1017, 0.036);

    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 140);
    this.camera.rotation.order = 'YXZ';

    // Studio RoomEnvironment reflection map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose();

    // Warm/cool 3-point + player lantern lighting
    const hemi = new THREE.HemisphereLight(0x7aa2d4, 0x3b2c1d, 0.72);
    this.scene.add(hemi);

    const keyDir = new THREE.DirectionalLight(0xffdfb0, 1.05);
    keyDir.position.set(60, 90, 45);
    this.scene.add(keyDir);

    const rimDir = new THREE.DirectionalLight(0x5d82b0, 0.38);
    rimDir.position.set(-40, 40, -60);
    this.scene.add(rimDir);

    this.playerLantern = new THREE.PointLight(0xffcf87, 2.2, 22, 1.4);
    this.scene.add(this.playerLantern);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.worldGroup);
    this.scene.add(this.introGroup);

    this.buildMazeWorld(DEFAULT_SEED);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.startLoop();
  }

  private applyQualitySettings(): void {
    if (!this.renderer) return;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    const maxDpr =
      this.settings.quality === 'high'
        ? Math.min(window.devicePixelRatio, 2)
        : this.settings.quality === 'medium'
        ? Math.min(window.devicePixelRatio, 1.5)
        : 1;
    this.renderer.setPixelRatio(maxDpr);
    this.renderer.shadowMap.enabled = false; // keep 60fps across 64x64 maze with zero shadow stalls
  }

  public updateSettings(next: GameSettings): void {
    this.settings = next;
    this.applyQualitySettings();
  }

  private clearWorldMeshes(): void {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.sharedDisposables.forEach((d) => d.dispose());
    this.sharedDisposables = [];
    this.keyMeshes = [];
    this.doorVisuals = [];
    this.exitVisuals = [];
    this.guardVisuals = [];
    this.trapVisuals = [];
  }

  public buildMazeWorld(seed: number, mapId: MapId = this.activeMapId): void {
    this.clearWorldMeshes();
    this.activeMapId = mapId;
    const def = MAP_CATALOG[mapId];
    this.layout = generateMaze(seed, mapId);
    const W = this.layout.width;
    const F = this.layout.floors;
    const wallH = F > 1 ? FLOOR_HEIGHT : WALL_HEIGHT;

    this.exploredFloors = Array.from({ length: F }, () => new Uint8Array(W * W));
    this.explored = this.exploredFloors[0];

    // Map-specific sky & fog atmosphere
    const bgHex =
      mapId === 'hutan'
        ? 0x07130e
        : mapId === 'pedesaan'
        ? 0x15131d
        : mapId === 'gedung'
        ? 0x0e1118
        : 0x0c1017;
    const fogDensity =
      mapId === 'hutan' ? 0.032 : mapId === 'pedesaan' ? 0.026 : mapId === 'gedung' ? 0.038 : 0.036;
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, fogDensity);

    const worldSpan = W * CELL_SIZE;
    const baseFloorTex =
      mapId === 'hutan'
        ? this.textures.floorForest
        : mapId === 'pedesaan'
        ? this.textures.floorVillage
        : mapId === 'gedung'
        ? this.textures.floorBuilding
        : this.textures.floorConcrete;

    // 1. Floor 0 continuous base slab
    const floorTex = baseFloorTex.clone();
    floorTex.repeat.set(W, W);
    floorTex.needsUpdate = true;
    const floorGeo = new THREE.PlaneGeometry(worldSpan, worldSpan);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      bumpMap: this.textures.floorBump,
      bumpScale: 0.03,
      roughness: 0.85,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(worldSpan / 2, 0, worldSpan / 2);
    this.worldGroup.add(floorMesh);
    this.sharedDisposables.push(floorGeo, floorMat, floorTex);

    // Upper floor slabs (with stairwell cutouts!) on multi-floor Gedung
    if (F > 1) {
      const slabGeo = new THREE.BoxGeometry(CELL_SIZE, 0.2, CELL_SIZE);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: baseFloorTex,
        bumpMap: this.textures.floorBump,
        bumpScale: 0.025,
        roughness: 0.82,
        metalness: 0.12,
      });
      this.sharedDisposables.push(slabGeo, slabMat);

      for (let f = 1; f < F; f++) {
        const stairVoids = this.layout.stairs.filter((s) => s.toFloor === f);
        const cells: Array<[number, number]> = [];
        for (let y = 0; y < W; y++) {
          for (let x = 0; x < W; x++) {
            const inStairVoid = stairVoids.some(
              (s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h
            );
            if (!inStairVoid) cells.push([x, y]);
          }
        }
        const inst = new THREE.InstancedMesh(slabGeo, slabMat, cells.length);
        const slabY = f * FLOOR_HEIGHT - 0.1;
        cells.forEach(([cx, cy], idx) => {
          _pos.set((cx + 0.5) * CELL_SIZE, slabY, (cy + 0.5) * CELL_SIZE);
          _quat.identity();
          _scale.set(1, 1, 1);
          _mat4.compose(_pos, _quat, _scale);
          inst.setMatrixAt(idx, _mat4);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        this.worldGroup.add(inst);
      }
    }

    // Ceiling slab on indoor maps (Gudang & top of Gedung)
    if (!def.openSky) {
      const ceilTex = this.textures.ceilingRafters.clone();
      ceilTex.repeat.set(W, W);
      ceilTex.needsUpdate = true;
      const ceilGeo = new THREE.PlaneGeometry(worldSpan, worldSpan);
      const ceilMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: ceilTex,
        roughness: 0.9,
        metalness: 0.1,
      });
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
      ceilMesh.rotation.x = Math.PI / 2;
      ceilMesh.position.set(worldSpan / 2, (F - 1) * FLOOR_HEIGHT + wallH, worldSpan / 2);
      this.worldGroup.add(ceilMesh);
      this.sharedDisposables.push(ceilGeo, ceilMat, ceilTex);
    }

    // 2. Instanced Walls grouped by 4 regions across all floors
    const wallBuckets: Array<Array<[number, number, number]>> = [[], [], [], []];
    for (let f = 0; f < F; f++) {
      const g = this.layout.floorGrids[f];
      const regG = this.layout.floorRegionGrids[f];
      for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (g[i] === 1) {
            wallBuckets[regG[i]].push([f, x, y]);
          }
        }
      }
    }

    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, wallH, CELL_SIZE);
    this.sharedDisposables.push(wallGeo);

    const regionWallMaps =
      mapId === 'hutan'
        ? [
            this.textures.wallForest,
            this.textures.wallForest,
            this.textures.wallForest,
            this.textures.wallForest,
          ]
        : mapId === 'pedesaan'
        ? [
            this.textures.wallVillage,
            this.textures.wallVillage,
            this.textures.wallVillage,
            this.textures.wallVillage,
          ]
        : mapId === 'gedung'
        ? [
            this.textures.wallBuilding,
            this.textures.wallAdmin,
            this.textures.wallService,
            this.textures.wallOuter,
          ]
        : [
            this.textures.wallDepot,
            this.textures.wallAdmin,
            this.textures.wallService,
            this.textures.wallOuter,
          ];

    const allWallCoords: Array<[number, number]> = [];
    wallBuckets.forEach((cells, regIdx) => {
      if (cells.length === 0) return;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: regionWallMaps[regIdx],
        bumpMap: this.textures.wallBump,
        bumpScale: 0.04,
        roughness: regIdx === 2 && mapId !== 'hutan' ? 0.55 : 0.85,
        metalness: regIdx === 2 && (mapId === 'gudang' || mapId === 'gedung') ? 0.35 : 0.05,
      });
      const inst = new THREE.InstancedMesh(wallGeo, mat, cells.length);
      cells.forEach(([wf, cx, cy], idx) => {
        _pos.set((cx + 0.5) * CELL_SIZE, wf * FLOOR_HEIGHT + wallH / 2, (cy + 0.5) * CELL_SIZE);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        inst.setMatrixAt(idx, _mat4);
        if (wf === 0) allWallCoords.push([cx, cy]);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.worldGroup.add(inst);
      this.sharedDisposables.push(mat);
    });

    // Open-sky tree canopies (Hutan) & terracotta roofs (Pedesaan) atop wall tops
    if (def.openSky && allWallCoords.length > 0) {
      const capGeo =
        mapId === 'hutan'
          ? new THREE.BoxGeometry(CELL_SIZE * 1.16, 1.35, CELL_SIZE * 1.16)
          : new THREE.BoxGeometry(CELL_SIZE * 1.06, 0.72, CELL_SIZE * 1.06);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: mapId === 'hutan' ? this.textures.foliageLeaf : this.textures.roofTerracotta,
        roughness: 0.9,
        metalness: 0.03,
      });
      const capInst = new THREE.InstancedMesh(capGeo, capMat, allWallCoords.length);
      const capY = wallH + (mapId === 'hutan' ? 0.62 : 0.34);
      allWallCoords.forEach(([cx, cy], idx) => {
        _pos.set((cx + 0.5) * CELL_SIZE, capY, (cy + 0.5) * CELL_SIZE);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        capInst.setMatrixAt(idx, _mat4);
      });
      capInst.instanceMatrix.needsUpdate = true;
      capInst.computeBoundingSphere();
      this.worldGroup.add(capInst);
      this.sharedDisposables.push(capGeo, capMat);
    }

    // 3. Overhead / Street lamp fixtures across floors (InstancedMesh)
    const lampCoords: Array<[number, number, number]> = [];
    const lampStride = def.openSky ? 8 : 6;
    for (let f = 0; f < F; f++) {
      const g = this.layout.floorGrids[f];
      for (let y = 2; y < W - 2; y += lampStride) {
        for (let x = 2; x < W - 2; x += lampStride) {
          if (g[y * W + x] === 0) {
            lampCoords.push([f, x, y]);
          }
        }
      }
    }
    if (lampCoords.length > 0) {
      const lampGeo = def.openSky
        ? new THREE.SphereGeometry(0.24, 8, 8)
        : new THREE.CylinderGeometry(0.28, 0.36, 0.16, 8);
      const lampMat = new THREE.MeshStandardMaterial({
        color: def.openSky ? 0xffd27d : 0xffe4a0,
        emissive: 0xffb74d,
        emissiveIntensity: 1.8,
        roughness: 0.3,
      });
      const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, lampCoords.length);
      lampCoords.forEach(([lf, lx, ly], idx) => {
        const yPos = def.openSky
          ? WALL_HEIGHT - 0.55
          : lf * FLOOR_HEIGHT + wallH - 0.15;
        _pos.set((lx + 0.5) * CELL_SIZE, yPos, (ly + 0.5) * CELL_SIZE);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        lampInst.setMatrixAt(idx, _mat4);
      });
      lampInst.instanceMatrix.needsUpdate = true;
      lampInst.computeBoundingSphere();
      this.worldGroup.add(lampInst);
      this.sharedDisposables.push(lampGeo, lampMat);
    }

    // 3b. Physical 3D Staircases (Gedung 3 Lantai)
    for (const stair of this.layout.stairs) {
      const stairGroup = createStaircaseGroup(stair, this.textures);
      this.worldGroup.add(stairGroup);
    }

    // 4. Environmental Props & Starting Room Story Table/Book
    for (const prop of this.layout.props) {
      if (
        (prop.floor ?? 0) === this.layout.storyBook.floor &&
        prop.x === this.layout.storyBook.x &&
        prop.y === this.layout.storyBook.y
      ) {
        const tableGroup = createStoryTableGroup(
          prop.x,
          prop.y,
          prop.yaw,
          prop.floor ?? 0
        );
        this.worldGroup.add(tableGroup);
      } else {
        const group = createPropGroup(prop, this.textures);
        this.worldGroup.add(group);
      }
    }

    // 5. Collectible Keys
    this.keyMeshes = this.layout.keys.map((k) => {
      const group = createKeyGroup();
      group.position.set(
        (k.x + 0.5) * CELL_SIZE,
        (k.floor ?? 0) * FLOOR_HEIGHT,
        (k.y + 0.5) * CELL_SIZE
      );
      this.worldGroup.add(group);
      return group;
    });

    // 6. Quiz Doors
    this.doors = this.layout.doors.map((d) => ({ ...d, openLeft: 0 }));
    this.doorVisuals = this.doors.map((d) => {
      const handle = createQuizDoorGroup(d, this.textures);
      this.worldGroup.add(handle.root);
      return handle;
    });

    // 7. 3 Escape Route Exit Gates
    this.exitVisuals = this.layout.exits.map((ex) => {
      const handle = createExitGateGroup(ex.routeId, ex.cells, ex.floor ?? 0);
      this.worldGroup.add(handle.root);
      return handle;
    });

    // 8. Environmental Steam-Grate Traps
    this.traps = this.layout.traps.map((t, index) => ({
      index,
      floor: t.floor ?? 0,
      x: t.x,
      y: t.y,
      offset: t.offset,
      state: 0,
      remain: TRAP_SAFE,
      dur: TRAP_SAFE,
      lastHitCycle: -1,
    }));
    this.trapVisuals = this.traps.map((t) => {
      const handle = createSteamTrapGroup(t.x, t.y, t.floor);
      this.worldGroup.add(handle.root);
      return handle;
    });

    // 9. Patrol Guards across floors
    this.guards = this.layout.guards.map((g, index) => ({
      index,
      floor: g.floor ?? 0,
      x: g.x + 0.5,
      y: g.y + 0.5,
      homeX: g.x,
      homeY: g.y,
      region: g.region,
      state: 'patrol',
      path: [],
      speed: 0,
      repathCd: 0.2,
      idleTimer: 0.3 + this.rng() * 1.2,
      returnDelay: 0,
      stunTimer: 0,
      facingYaw: 0,
    }));
    this.guardVisuals = this.guards.map((g) => {
      const handle = createGuardGroup();
      handle.root.position.set(g.x * CELL_SIZE, g.floor * FLOOR_HEIGHT, g.y * CELL_SIZE);
      this.worldGroup.add(handle.root);
      return handle;
    });

    this.resetPlayerToSpawn();
  }

  private resetPlayerToSpawn(): void {
    this.playerFloor = this.layout.spawn.floor ?? 0;
    this.playerElevation = this.playerFloor * FLOOR_HEIGHT;
    this.playerX = this.layout.spawn.x;
    this.playerY = this.layout.spawn.y;
    this.yaw = this.layout.spawn.yaw;
    this.pitch = 0;
    this.explored = this.exploredFloors[this.playerFloor];
    this.updateCameraTransform(0);
  }

  public startNewGame(mapId: MapId = this.activeMapId): void {
    this.clearIntroActors();
    this.elapsedTime = 0;
    this.lives = 5;
    this.collectedKeys.clear();
    this.streak = 0;
    this.bestStreak = 0;
    this.stamina = MAX_STAMINA;
    this.isSprinting = false;
    this.isExhausted = false;
    this.staminaRegenDelay = 0;
    this.bookRead = false;
    this.invulnTimer = 0;
    this.slowTimer = 0;
    this.dodgeCooldown = 0;
    this.dodgeActiveTimer = 0;
    this.dodgeProtectTimer = 0;
    this.lastAmbientRegion = 'depot';
    this.stats = {
      correct: 0,
      wrong: 0,
      guardCatches: 0,
      trapHits: 0,
      doorsOpened: 0,
      dodgesUsed: 0,
    };

    this.buildMazeWorld(DEFAULT_SEED, mapId);
    this.revealExploredAroundPlayer();
    AudioManager.setMapTheme(mapId);
    AudioManager.setAmbientRegion('depot');
    this.setPhase('playing');
    this.emitHud();
  }

  public startIntroCutscene(mapId: MapId = this.activeMapId): void {
    this.clearIntroActors();
    this.elapsedTime = 0;
    this.lives = 5;
    this.collectedKeys.clear();
    this.streak = 0;
    this.bestStreak = 0;
    this.stamina = MAX_STAMINA;
    this.isSprinting = false;
    this.isExhausted = false;
    this.staminaRegenDelay = 0;
    this.bookRead = false;
    this.invulnTimer = 0;
    this.slowTimer = 0;
    this.dodgeCooldown = 0;
    this.dodgeActiveTimer = 0;
    this.dodgeProtectTimer = 0;
    this.lastAmbientRegion = 'outer';
    this.stats = {
      correct: 0,
      wrong: 0,
      guardCatches: 0,
      trapHits: 0,
      doorsOpened: 0,
      dodgesUsed: 0,
    };

    this.buildMazeWorld(DEFAULT_SEED, mapId);

    // Spawn 4 capture-squad patrol guards closing in along the main corridor
    for (let i = 0; i < 4; i++) {
      const actor = createGuardGroup();
      (actor.statusHalo.material as THREE.MeshBasicMaterial).color.setHex(0xdc2626);
      (actor.lanternBulb.material as THREE.MeshStandardMaterial).emissive.setHex(0xef4444);
      this.introGroup.add(actor.root);
      this.introActors.push(actor);
    }

    this.introTimer = 0;
    this.introBeatLast = -1;
    AudioManager.setMapTheme(mapId);
    AudioManager.setAmbientRegion('outer');
    this.setPhase('intro');
    this.updateIntroCutscene(0);
  }

  public skipIntro(): void {
    if (this.phase !== 'intro') return;
    this.finishIntroCutscene();
  }

  private clearIntroActors(): void {
    while (this.introGroup.children.length > 0) {
      this.introGroup.remove(this.introGroup.children[0]);
    }
    this.introActors = [];
  }

  private finishIntroCutscene(): void {
    this.clearIntroActors();
    this.resetPlayerToSpawn();
    this.revealExploredAroundPlayer();
    this.lastAmbientRegion = 'depot';
    AudioManager.setAmbientRegion('depot');
    this.setPhase('playing');
    this.emitHud();
    this.callbacks.onIntroComplete();
  }

  public restoreFromSave(save: SaveStateV2): void {
    this.clearIntroActors();
    const mapId: MapId = save.mapId && MAP_CATALOG[save.mapId] ? save.mapId : 'gudang';
    this.buildMazeWorld(save.seed || DEFAULT_SEED, mapId);
    this.elapsedTime = save.elapsedTime;
    this.lives = Math.max(1, Math.min(5, save.lives));
    this.collectedKeys = new Set(save.collectedKeys);
    this.collectedKeys.forEach((kIdx) => {
      const mesh = this.keyMeshes[kIdx];
      if (mesh) mesh.visible = false;
    });

    this.exploredFloors.forEach((arr) => arr.fill(0));
    if (Array.isArray(save.exploredFloorCells)) {
      save.exploredFloorCells.forEach((cells, f) => {
        const target = this.exploredFloors[f];
        if (!target) return;
        for (const c of cells) {
          if (c >= 0 && c < target.length) target[c] = 1;
        }
      });
    } else {
      for (const c of save.exploredCells) {
        if (c >= 0 && c < this.exploredFloors[0].length) {
          this.exploredFloors[0][c] = 1;
        }
      }
    }

    if (Array.isArray(save.openedDoors)) {
      for (const od of save.openedDoors) {
        const door = this.doors[od.index];
        if (door) door.openLeft = od.openLeft;
      }
    }

    this.playerFloor = Math.max(0, Math.min(this.layout.floors - 1, save.player.floor ?? 0));
    this.playerElevation = this.playerFloor * FLOOR_HEIGHT;
    this.explored = this.exploredFloors[this.playerFloor];
    this.playerX = save.player.x;
    this.playerY = save.player.y;
    this.yaw = save.player.yaw;
    this.pitch = save.player.pitch || 0;
    this.streak = save.streak || 0;
    this.bestStreak = save.bestStreak || 0;
    this.invulnTimer = save.invuln || 0;
    this.slowTimer = save.slow || 0;
    this.dodgeCooldown = save.dodgeCooldown || 0;
    this.stamina = typeof save.stamina === 'number' ? save.stamina : MAX_STAMINA;
    this.isExhausted = this.stamina < STAMINA_EXHAUST_THRESHOLD;
    this.bookRead = Boolean(save.bookRead);
    if (save.stats) this.stats = { ...save.stats };

    if (Array.isArray(save.guards)) {
      save.guards.forEach((sg, i) => {
        if (this.guards[i]) {
          this.guards[i].floor = sg.floor ?? this.guards[i].floor;
          this.guards[i].x = sg.x;
          this.guards[i].y = sg.y;
          this.guards[i].state = sg.state || 'patrol';
        }
      });
    }

    AudioManager.setMapTheme(mapId);
    this.updateExitGateVisuals();
    this.revealExploredAroundPlayer();
    this.setPhase('playing');
    this.emitHud();
  }

  public exportSaveState(): SaveStateV2 {
    const exploredFloorCells = this.exploredFloors.map((arr) => {
      const list: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 1) list.push(i);
      }
      return list;
    });
    return {
      version: 2,
      mapId: this.activeMapId,
      seed: this.layout.seed,
      elapsedTime: Number(this.elapsedTime.toFixed(2)),
      lives: this.lives,
      collectedKeys: [...this.collectedKeys],
      openedDoors: this.doors
        .filter((d) => d.openLeft > 0)
        .map((d) => ({ index: d.index, openLeft: Number(d.openLeft.toFixed(2)) })),
      exploredCells: exploredFloorCells[0] ?? [],
      exploredFloorCells,
      player: {
        floor: this.playerFloor,
        x: Number(this.playerX.toFixed(3)),
        y: Number(this.playerY.toFixed(3)),
        yaw: Number(this.yaw.toFixed(4)),
        pitch: Number(this.pitch.toFixed(4)),
      },
      streak: this.streak,
      bestStreak: this.bestStreak,
      invuln: Number(this.invulnTimer.toFixed(2)),
      slow: Number(this.slowTimer.toFixed(2)),
      dodgeCooldown: Number(this.dodgeCooldown.toFixed(2)),
      stamina: Number(this.stamina.toFixed(1)),
      bookRead: this.bookRead,
      stats: { ...this.stats },
      guards: this.guards.map((g) => ({
        floor: g.floor,
        x: Number(g.x.toFixed(3)),
        y: Number(g.y.toFixed(3)),
        state: g.state,
      })),
      selectedExit: null,
    };
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    document.body.dataset.state = next;
    this.clearInputs();
    if (next !== 'playing' && document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    if (next === 'playing') {
      this.updateCameraTransform(0);
      this.emitHud();
    }
  }

  public requestPointerLock(): void {
    if (this.phase !== 'playing' || !this.renderer?.domElement || this.isSoftwareGl) return;
    try {
      const maybePromise = this.renderer.domElement.requestPointerLock?.() as unknown as
        | Promise<void>
        | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore pointer-lock denial outside direct browser user gesture
    }
  }

  public openDoor(doorIndex: number): void {
    const door = this.doors[doorIndex];
    if (!door) return;
    door.openLeft = 12;
    this.stats.doorsOpened += 1;
    AudioManager.play('doorOpen');
    this.emitHud();
  }

  public resolveGuardEncounter(correct: boolean): void {
    const profile = DIFFICULTY_PROFILES[this.settings.difficulty];
    this.invulnTimer = profile.recoveryInvuln;
    for (const g of this.guards) {
      if (
        (g.floor ?? 0) === this.playerFloor &&
        Math.hypot(g.x - this.playerX, g.y - this.playerY) < 4.5
      ) {
        g.stunTimer = correct ? 4.0 : 2.8;
        g.path = [];
      }
    }
    this.emitHud();
  }

  public triggerDodge(): void {
    if (this.phase !== 'playing') return;
    if (this.dodgeCooldown > 0 || this.dodgeActiveTimer > 0) return;

    const { forward, right } = this.getMoveInputs();
    // Forward direction in grid (x, z) from camera yaw
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    // In Three.js camera looking -Z when yaw=0: forward = (-sinY, -cosY), right = (cosY, -sinY)
    let dx = -sinY * forward + cosY * right;
    let dy = -cosY * forward - sinY * right;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) {
      // Backward dodge if no direction held (PRD §6.4)
      dx = sinY;
      dy = cosY;
    } else {
      dx /= len;
      dy /= len;
    }

    this.dodgeDirX = dx;
    this.dodgeDirY = dy;
    this.dodgeActiveTimer = DODGE_DURATION;
    this.dodgeProtectTimer = DODGE_PROTECTION_WINDOW;
    this.dodgeCooldown = DODGE_COOLDOWN;
    this.stats.dodgesUsed += 1;
    AudioManager.play('dodge');
    this.emitHud();
  }

  private collectKey(k: KeyNode): void {
    if (this.collectedKeys.has(k.index)) return;
    this.collectedKeys.add(k.index);
    const mesh = this.keyMeshes[k.index];
    if (mesh) mesh.visible = false;
    AudioManager.play('key');
    this.callbacks.onFlash('amber');
    this.callbacks.onKeyCollected(this.collectedKeys.size, k.label);
    this.updateExitGateVisuals();
    if (this.collectedKeys.size >= TOTAL_KEYS) {
      AudioManager.play('doorOpen');
      this.callbacks.onFlash('green');
    }
    this.callbacks.onAutosave(this.exportSaveState());
    this.emitHud();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    const nearKey = this.findNearbyKey();
    if (nearKey) {
      this.collectKey(nearKey);
      return;
    }
    const nearDoor = this.findNearbyClosedDoor();
    if (nearDoor) {
      this.callbacks.onDoorInteract(nearDoor.index);
      return;
    }
    if (this.isNearStoryBook()) {
      this.bookRead = true;
      this.callbacks.onBookInteract();
    }
  }

  public setTouchMove(x: number, y: number): void {
    this.touchMove.x = Math.max(-1, Math.min(1, x));
    this.touchMove.y = Math.max(-1, Math.min(1, y));
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprint = active;
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    const sens = 0.0024 * this.settings.mouseSensitivity;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch - dy * sens));
  }

  private getMoveInputs(): { forward: number; right: number; turn: number; sprintHeld: boolean } {
    const fwd =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0) -
      this.touchMove.y;
    const str =
      (this.keysHeld.has('KeyD') ? 1 : 0) -
      (this.keysHeld.has('KeyA') ? 1 : 0) +
      this.touchMove.x;
    const turn =
      (this.keysHeld.has('ArrowLeft') ? 1 : 0) -
      (this.keysHeld.has('ArrowRight') ? 1 : 0);
    const sprintHeld =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      this.touchSprint;
    return { forward: fwd, right: str, turn, sprintHeld };
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchSprint = false;
    this.isSprinting = false;
    this.isDraggingLook = false;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostBound);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    this.renderer?.domElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    this.renderer?.domElement.removeEventListener('webglcontextlost', this.onContextLostBound);
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    this.isDraggingLook = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    // Try pointer lock for desktop FPS feel
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    if (this.pointerLocked) {
      this.addLookDelta(e.movementX, e.movementY);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.addLookDelta(dx * 1.35, dy * 1.35);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    AudioManager.ensure();
    if (this.phase === 'intro') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        this.skipIntro();
      }
      return;
    }
    if (e.code === 'KeyM' && this.phase === 'playing') {
      e.preventDefault();
      this.callbacks.onToggleMinimap();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        e.preventDefault();
        this.callbacks.onTogglePause();
      }
      return;
    }
    if (this.phase !== 'playing') return;

    if (e.code === 'KeyE') {
      e.preventDefault();
      this.triggerInteract();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.triggerDodge();
      return;
    }
    if (e.code.startsWith('Arrow')) {
      e.preventDefault();
    }
    this.keysHeld.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.code);
  }

  private findNearbyKey(): KeyNode | null {
    if (!this.layout) return null;
    let closest: KeyNode | null = null;
    let bestDist = 1.85;
    for (const k of this.layout.keys) {
      if ((k.floor ?? 0) !== this.playerFloor) continue;
      if (this.collectedKeys.has(k.index)) continue;
      const dist = Math.hypot(this.playerX - (k.x + 0.5), this.playerY - (k.y + 0.5));
      if (dist < bestDist) {
        bestDist = dist;
        closest = k;
      }
    }
    return closest;
  }

  private isNearStoryBook(): boolean {
    if (!this.layout) return false;
    if ((this.layout.storyBook.floor ?? 0) !== this.playerFloor) return false;
    const bx = this.layout.storyBook.x + 0.5;
    const by = this.layout.storyBook.y + 0.5;
    return Math.hypot(bx - this.playerX, by - this.playerY) < 2.45;
  }

  private findNearbyClosedDoor(): QuizDoorNode | null {
    for (const door of this.doors) {
      if ((door.floor ?? 0) !== this.playerFloor) continue;
      if (door.openLeft > 0) continue;
      for (const [dx, dy] of door.cells) {
        if (Math.hypot(dx + 0.5 - this.playerX, dy + 0.5 - this.playerY) < 1.95) {
          return door;
        }
      }
    }
    return null;
  }

  private findNearbyStair(): StairNode | null {
    if (!this.layout || this.layout.stairs.length === 0) return null;
    for (const s of this.layout.stairs) {
      if (s.fromFloor !== this.playerFloor && s.toFloor !== this.playerFloor) continue;
      const cx = s.x + s.w * 0.5;
      const cy = s.y + s.h * 0.5;
      if (
        this.playerX >= s.x - 1.2 &&
        this.playerX <= s.x + s.w + 1.2 &&
        this.playerY >= s.y - 1.2 &&
        this.playerY <= s.y + s.h + 1.2
      ) {
        return s;
      }
      void cx;
      void cy;
    }
    return null;
  }

  private updateTraps(dt: number): void {
    this.trapSfxCooldown = Math.max(0, this.trapSfxCooldown - dt);
    for (let i = 0; i < this.traps.length; i++) {
      const trap = this.traps[i];
      const t = (this.elapsedTime + trap.offset) % TRAP_CYCLE;
      const prevState = trap.state;

      if (t < TRAP_SAFE) {
        trap.state = 0;
        trap.remain = TRAP_SAFE - t;
        trap.dur = TRAP_SAFE;
      } else if (t < TRAP_SAFE + TRAP_WARN) {
        trap.state = 1;
        trap.remain = TRAP_SAFE + TRAP_WARN - t;
        trap.dur = TRAP_WARN;
      } else {
        trap.state = 2;
        trap.remain = TRAP_CYCLE - t;
        trap.dur = TRAP_ACTIVE;
      }

      if (
        prevState !== trap.state &&
        this.trapSfxCooldown <= 0 &&
        (trap.floor ?? 0) === this.playerFloor
      ) {
        const dist = Math.hypot(trap.x + 0.5 - this.playerX, trap.y + 0.5 - this.playerY);
        if (dist < 6.5) {
          this.trapSfxCooldown = 0.25;
          if (trap.state === 1) AudioManager.play('trapWarn');
          else if (trap.state === 2) AudioManager.play('trapActive');
        }
      }

      // Check player hit on active trap on the same floor
      if (
        (trap.floor ?? 0) === this.playerFloor &&
        trap.state === 2 &&
        Math.abs(this.playerX - (trap.x + 0.5)) < 0.55 &&
        Math.abs(this.playerY - (trap.y + 0.5)) < 0.55
      ) {
        const cycleIdx = Math.floor((this.elapsedTime + trap.offset) / TRAP_CYCLE);
        if (trap.lastHitCycle !== cycleIdx) {
          trap.lastHitCycle = cycleIdx;
          this.slowTimer = Math.max(this.slowTimer, 1.2);
          this.elapsedTime += 3.0;
          this.stats.trapHits += 1;
          AudioManager.play('trapHit');
          this.callbacks.onFlash('red');
          this.callbacks.onToast('Terkena jebakan uap! Gerak melambat & waktu +3 detik');
        }
      }

      // Update 3D trap visual
      const vis = this.trapVisuals[i];
      if (vis) {
        if (trap.state === 0) {
          vis.spikesGroup.scale.y = 0.08;
          vis.rimMat.emissive.setHex(0x0b3a4a);
        } else if (trap.state === 1) {
          vis.spikesGroup.scale.y = 0.35 + 0.25 * (1 - trap.remain / trap.dur);
          vis.rimMat.emissive.setHex(0xd97706);
        } else {
          vis.spikesGroup.scale.y = 1.0;
          vis.rimMat.emissive.setHex(0xdc2626);
        }
      }
    }
  }

  private updateDoorsVisuals(dt: number): void {
    const doorWallH = this.layout?.floors > 1 ? FLOOR_HEIGHT : WALL_HEIGHT;
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      if (d.openLeft > 0) {
        d.openLeft = Math.max(0, d.openLeft - dt);
        if (
          d.openLeft <= 0 &&
          (d.floor ?? 0) === this.playerFloor &&
          d.cells.some(([cx, cy]) => Math.floor(this.playerX) === cx && Math.floor(this.playerY) === cy)
        ) {
          d.openLeft = 0.4;
        }
      }
      const vis = this.doorVisuals[i];
      if (vis) {
        const targetY = d.openLeft > 0 ? doorWallH - 0.65 : 0;
        vis.gatePanel.position.y += (targetY - vis.gatePanel.position.y) * Math.min(1, 10 * dt);
        const lampMat = vis.lockLamp.material as THREE.MeshStandardMaterial;
        if (d.openLeft > 0) {
          lampMat.color.setHex(0x34a86b);
          lampMat.emissive.setHex(0x34a86b);
        } else {
          lampMat.color.setHex(0xe59f3c);
          lampMat.emissive.setHex(0xe59f3c);
        }
      }
    }
  }

  private updateExitGateVisuals(): void {
    const unlocked = this.collectedKeys.size >= TOTAL_KEYS;
    for (const vis of this.exitVisuals) {
      vis.shutter.position.y = unlocked
        ? WALL_HEIGHT - 0.5
        : (WALL_HEIGHT - 0.65) / 2;
      const color = unlocked ? 0x34a86b : 0xc2413b;
      (vis.beaconLeft.material as THREE.MeshStandardMaterial).color.setHex(color);
      (vis.beaconLeft.material as THREE.MeshStandardMaterial).emissive.setHex(color);
      (vis.beaconRight.material as THREE.MeshStandardMaterial).color.setHex(color);
      (vis.beaconRight.material as THREE.MeshStandardMaterial).emissive.setHex(color);
      (vis.threshold.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  private revealExploredAroundPlayer(): void {
    const W = this.layout.width;
    const activeExp = this.exploredFloors[this.playerFloor];
    if (!activeExp) return;
    const px = Math.floor(this.playerX);
    const py = Math.floor(this.playerY);
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && ty >= 0 && tx < W && ty < W && Math.hypot(dx, dy) <= 5.2) {
          activeExp[ty * W + tx] = 1;
        }
      }
    }
    this.explored = activeExp;
  }

  private updateIntroCutscene(dt: number): void {
    this.introTimer += dt;
    const progress = Math.min(1, this.introTimer / this.introDuration);
    const beatIndex = progress < 0.36 ? 0 : progress < 0.72 ? 1 : 2;

    if (beatIndex !== this.introBeatLast) {
      this.introBeatLast = beatIndex;
      if (beatIndex === 0) {
        AudioManager.play('guardAlert');
      } else if (beatIndex === 1) {
        AudioManager.play('encounter');
        this.callbacks.onFlash('red');
      } else {
        AudioManager.play('doorOpen');
        this.callbacks.onFlash('amber');
      }
      this.callbacks.onIntroUpdate(progress, beatIndex);
    }

    // Camera choreography along corridor (Beat 0-1 in corridor looking East -> Beat 2 cuts into starting room facing story table)
    if (beatIndex < 2) {
      const tNorm = Math.min(1, progress / 0.72);
      const camX = (6.2 - tNorm * 0.4) * CELL_SIZE;
      const camZ = (2.5 + Math.cos(tNorm * 4.5) * 0.08) * CELL_SIZE;
      this.camera.position.set(camX, 1.55 + Math.sin(this.introTimer * 5) * 0.03, camZ);
      this.camera.lookAt(12.5 * CELL_SIZE, 1.38, 2.5 * CELL_SIZE);
      this.playerLantern.position.copy(this.camera.position);

      const offsets = [
        [0, -0.55],
        [0.35, 0.55],
        [1.0, -0.18],
        [1.4, 0.35],
      ];
      this.introActors.forEach((actor, idx) => {
        const [ox, oz] = offsets[idx];
        const gx = 12.2 - tNorm * 4.2 + ox;
        const gz = 2.5 + oz;
        actor.root.position.set(gx * CELL_SIZE, 0, gz * CELL_SIZE);
        actor.root.rotation.y = -Math.PI / 2;
        const swing = Math.sin(this.introTimer * 8 + idx) * 0.45;
        actor.leftLeg.rotation.x = swing;
        actor.rightLeg.rotation.x = -swing;
      });
    } else {
      // Beat 2: guards fade back behind locked corridor & camera settles in starting room facing story table
      const tFinal = Math.min(1, (progress - 0.72) / 0.28);
      this.introActors.forEach((actor) => {
        actor.root.position.y = -5; // hide guards behind closed cell
      });
      const camX = (2.2 + 0.3 * tFinal) * CELL_SIZE;
      const camZ = 2.5 * CELL_SIZE;
      this.camera.position.set(camX, 1.65, camZ);
      this.camera.lookAt(
        (this.layout.storyBook.x + 0.5) * CELL_SIZE,
        1.15,
        (this.layout.storyBook.y + 0.5) * CELL_SIZE
      );
      this.playerLantern.position.copy(this.camera.position);
    }

    if (this.introTimer >= this.introDuration) {
      this.finishIntroCutscene();
    }
  }

  private updateCameraTransform(dt: number): void {
    if (this.phase === 'title') {
      const t = performance.now() * 0.00035;
      const camX = (2.8 + Math.sin(t) * 0.6) * CELL_SIZE;
      const camZ = (2.8 + Math.cos(t * 0.8) * 0.6) * CELL_SIZE;
      this.camera.position.set(camX, 1.85, camZ);
      this.camera.lookAt(5.5 * CELL_SIZE, 1.35, 3.2 * CELL_SIZE);
      this.playerLantern.position.copy(this.camera.position);
      return;
    }

    const bobAmp =
      this.dodgeActiveTimer > 0 ? 0.02 : this.isSprinting ? 0.075 : 0.05;
    const eyeHeight =
      this.playerElevation +
      (this.dodgeActiveTimer > 0 ? 1.35 : 1.65) +
      Math.sin(this.bobPhase) * bobAmp;
    this.camera.position.set(this.playerX * CELL_SIZE, eyeHeight, this.playerY * CELL_SIZE);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const targetFov =
      this.dodgeActiveTimer > 0 ? 80 : this.isSprinting ? 77 : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 14 * dt);
      this.camera.updateProjectionMatrix();
    }

    this.playerLantern.position.set(
      this.camera.position.x,
      eyeHeight + 0.15,
      this.camera.position.z
    );
  }

  private stepSimulation(dt: number): void {
    if (this.phase === 'title') {
      this.animatePickups(dt);
      this.updateCameraTransform(dt);
      return;
    }

    if (this.phase === 'intro') {
      this.updateIntroCutscene(dt);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    this.elapsedTime += dt;
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.dodgeProtectTimer = Math.max(0, this.dodgeProtectTimer - dt);
    this.guardSfxCooldown = Math.max(0, this.guardSfxCooldown - dt);

    const worldCollision = {
      grid: this.layout.floorGrids[this.playerFloor],
      width: this.layout.width,
      floor: this.playerFloor,
      doors: this.doors,
      traps: this.traps,
      props: this.layout.props,
    };

    // Keyboard turn fallback (ArrowLeft / ArrowRight)
    const { forward, right, turn, sprintHeld } = this.getMoveInputs();
    if (turn !== 0) {
      this.yaw += turn * 2.1 * dt;
    }

    const wantsMove = Math.hypot(forward, right) > 0.05;
    const canSprint =
      sprintHeld &&
      wantsMove &&
      !this.isExhausted &&
      this.stamina > 0 &&
      this.dodgeActiveTimer <= 0;

    if (canSprint) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_PER_SEC * dt);
      this.staminaRegenDelay = STAMINA_REGEN_DELAY;
      if (this.stamina <= 0) {
        this.isExhausted = true;
        this.isSprinting = false;
      }
    } else {
      this.isSprinting = false;
      if (this.staminaRegenDelay > 0) {
        this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - dt);
      } else if (this.stamina < MAX_STAMINA) {
        this.stamina = Math.min(MAX_STAMINA, this.stamina + STAMINA_REGEN_PER_SEC * dt);
        if (this.isExhausted && this.stamina >= STAMINA_EXHAUST_THRESHOLD) {
          this.isExhausted = false;
        }
      }
    }

    // Movement / Dodge / Sprint
    if (this.dodgeActiveTimer > 0) {
      this.dodgeActiveTimer = Math.max(0, this.dodgeActiveTimer - dt);
      const dodgeCellSpeed = (DODGE_DISTANCE / CELL_SIZE) / DODGE_DURATION;
      const res = moveWithCollision(
        worldCollision,
        { x: this.playerX, y: this.playerY },
        this.dodgeDirX * dodgeCellSpeed * dt,
        this.dodgeDirY * dodgeCellSpeed * dt
      );
      this.playerX = res.x;
      this.playerY = res.y;
    } else {
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      let mx = -sinY * forward + cosY * right;
      let my = -cosY * forward - sinY * right;
      const mLen = Math.hypot(mx, my);
      if (mLen > 0.001) {
        if (mLen > 1) {
          mx /= mLen;
          my /= mLen;
        }
        const sprintMult = this.isSprinting ? SPRINT_SPEED_MULT : 1.0;
        const speed = PLAYER_SPEED * sprintMult * (this.slowTimer > 0 ? 0.5 : 1);
        const res = moveWithCollision(
          worldCollision,
          { x: this.playerX, y: this.playerY },
          mx * speed * dt,
          my * speed * dt
        );
        const distMoved = Math.hypot(res.x - this.playerX, res.y - this.playerY);
        this.playerX = res.x;
        this.playerY = res.y;
        this.bobPhase += distMoved * (this.isSprinting ? 7.2 : 6.0);
        this.stepSoundAccum += distMoved;
        if (this.stepSoundAccum > (this.isSprinting ? 1.1 : 1.35)) {
          this.stepSoundAccum = 0;
          AudioManager.play('step');
        }
      }
    }

    // 3-Floor Staircase elevation & floor transition (Gedung)
    let targetElevation = this.playerFloor * FLOOR_HEIGHT;
    const prevFloor = this.playerFloor;
    for (const s of this.layout.stairs) {
      if (s.fromFloor !== this.playerFloor && s.toFloor !== this.playerFloor) continue;
      if (
        this.playerX >= s.x &&
        this.playerX <= s.x + s.w &&
        this.playerY >= s.y &&
        this.playerY <= s.y + s.h
      ) {
        let t = 0;
        if (s.dir === 'E') t = (this.playerX - s.x) / s.w;
        else if (s.dir === 'W') t = 1 - (this.playerX - s.x) / s.w;
        else if (s.dir === 'S') t = (this.playerY - s.y) / s.h;
        else t = 1 - (this.playerY - s.y) / s.h;
        t = Math.max(0, Math.min(1, t));
        targetElevation = (s.fromFloor + t * (s.toFloor - s.fromFloor)) * FLOOR_HEIGHT;
        this.playerFloor = t >= 0.5 ? s.toFloor : s.fromFloor;
        break;
      }
    }
    if (this.playerFloor !== prevFloor) {
      this.explored = this.exploredFloors[this.playerFloor];
      this.callbacks.onToast(`Berpindah ke Lantai ${this.playerFloor + 1}/${this.layout.floors}`);
    }
    this.playerElevation += (targetElevation - this.playerElevation) * Math.min(1, 20 * dt);

    // Sync region ambient sound dynamically
    const pxCell = Math.floor(this.playerX);
    const pyCell = Math.floor(this.playerY);
    const activeRegGrid = this.layout.floorRegionGrids[this.playerFloor];
    if (
      activeRegGrid &&
      pxCell >= 0 &&
      pyCell >= 0 &&
      pxCell < this.layout.width &&
      pyCell < this.layout.width
    ) {
      const reg = regionIndexToId(activeRegGrid[pyCell * this.layout.width + pxCell]);
      if (reg !== this.lastAmbientRegion) {
        this.lastAmbientRegion = reg;
        AudioManager.setAmbientRegion(reg);
      }
    }

    this.revealExploredAroundPlayer();
    this.updateDoorsVisuals(dt);
    this.updateTraps(dt);
    this.animatePickups(dt);

    // Check 3 Escape Routes on Floor 0
    const px = Math.floor(this.playerX);
    const py = Math.floor(this.playerY);
    for (const exit of this.layout.exits) {
      if ((exit.floor ?? 0) !== this.playerFloor) continue;
      const atExit =
        exit.cells.some(([ex, ey]) => Math.hypot(ex + 0.5 - this.playerX, ey + 0.5 - this.playerY) < 1.15) ||
        (px === exit.approachCell[0] && py === exit.approachCell[1] && this.collectedKeys.size >= TOTAL_KEYS);

      if (atExit) {
        if (this.collectedKeys.size >= TOTAL_KEYS) {
          this.callbacks.onVictory(exit.routeId, exit.name);
          return;
        } else {
          this.lastPrompt = `${exit.name} terkunci — kumpulkan ${TOTAL_KEYS} kunci (${this.collectedKeys.size}/${TOTAL_KEYS})`;
        }
      }
    }

    // Update Patrol Guards scaled by map difficulty across floors
    const def = MAP_CATALOG[this.activeMapId];
    const floorWorlds = this.layout.floorGrids.map((grid, f) => ({
      grid,
      width: this.layout.width,
      floor: f,
      doors: this.doors,
      traps: this.traps,
      props: this.layout.props,
    }));
    const blockedMasks = floorWorlds.map((fw) => buildGuardBlockedMask(fw));
    const mapScale = {
      speedMult: def.guardSpeedMult,
      sightMult: def.guardSightMult,
    };

    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      const gf = g.floor ?? 0;
      const targetPlayerPos =
        gf === this.playerFloor
          ? { x: this.playerX, y: this.playerY }
          : { x: -9999, y: -9999 };

      stepGuard(
        g,
        targetPlayerPos,
        floorWorlds[gf],
        this.layout.floorWalkableCells[gf],
        blockedMasks[gf],
        this.settings.difficulty,
        dt,
        this.rng,
        () => {
          if (gf === this.playerFloor && this.guardSfxCooldown <= 0) {
            this.guardSfxCooldown = 1.5;
            AudioManager.play('guardAlert');
          }
        },
        mapScale
      );

      // Update 3D guard mesh & gait
      const vis = this.guardVisuals[i];
      if (vis) {
        vis.root.position.set(g.x * CELL_SIZE, gf * FLOOR_HEIGHT, g.y * CELL_SIZE);
        vis.root.rotation.y = g.facingYaw;
        const swing = g.speed > 0.1 ? Math.sin(this.elapsedTime * 8 + i) * 0.45 : 0;
        vis.leftLeg.rotation.x = swing;
        vis.rightLeg.rotation.x = -swing;

        const haloMat = vis.statusHalo.material as THREE.MeshBasicMaterial;
        const bulbMat = vis.lanternBulb.material as THREE.MeshStandardMaterial;
        if (g.state === 'chase' || g.state === 'alert') {
          haloMat.color.setHex(0xdc2626);
          bulbMat.emissive.setHex(0xef4444);
        } else if (g.state === 'stunned') {
          haloMat.color.setHex(0x64748b);
          bulbMat.emissive.setHex(0x475569);
        } else {
          haloMat.color.setHex(0xd4a24c);
          bulbMat.emissive.setHex(0xffa726);
        }
      }

      // Guard contact check on same floor
      if (
        gf === this.playerFloor &&
        this.invulnTimer <= 0 &&
        this.dodgeProtectTimer <= 0 &&
        g.stunTimer <= 0 &&
        Math.hypot(this.playerX - g.x, this.playerY - g.y) < 0.72
      ) {
        this.stats.guardCatches += 1;
        AudioManager.play('encounter');
        this.callbacks.onFlash('red');
        this.callbacks.onGuardEncounter(i);
        break;
      }
    }

    this.updateCameraTransform(dt);

    // Autosave every 5s
    this.autosaveAccum += dt;
    if (this.autosaveAccum >= 5.0) {
      this.autosaveAccum = 0;
      this.callbacks.onAutosave(this.exportSaveState());
    }

    // Throttled HUD update (~10Hz)
    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.1) {
      this.hudSyncAccum = 0;
      this.emitHud();
    }
  }

  private animatePickups(dt: number): void {
    const t = performance.now() * 0.002;
    this.keyMeshes.forEach((group, idx) => {
      if (!group || !group.visible) return;
      const spinner = group.getObjectByName('spinner');
      if (spinner) {
        spinner.rotation.y += dt * 1.8;
        spinner.position.y = 1.05 + Math.sin(t + idx) * 0.12;
      }
    });
  }

  public emitHud(): void {
    const def = MAP_CATALOG[this.activeMapId];
    const nearKeyNode = this.findNearbyKey();
    const nearDoor = !nearKeyNode ? this.findNearbyClosedDoor() : null;
    const nearBook = !nearKeyNode && !nearDoor && this.isNearStoryBook();
    const nearStair = !nearKeyNode && !nearDoor && !nearBook ? this.findNearbyStair() : null;
    const px = Math.floor(this.playerX);
    const py = Math.floor(this.playerY);
    const activeRegGrid = this.layout?.floorRegionGrids[this.playerFloor];
    const regIdx =
      this.layout &&
      activeRegGrid &&
      px >= 0 &&
      py >= 0 &&
      px < this.layout.width &&
      py < this.layout.width
        ? activeRegGrid[py * this.layout.width + px]
        : 0;
    const regionId = regionIndexToId(regIdx);
    const regionName = def.regionNames[regionId];

    let prompt: string | null = null;
    if (nearKeyNode) {
      prompt = `Tekan E · Ambil ${nearKeyNode.label} (${nearKeyNode.code})`;
    } else if (nearDoor) {
      prompt = `Tekan E · Buka ${nearDoor.label}`;
    } else if (nearBook) {
      prompt = 'Tekan E · Baca Buku Catatan 1942 di Meja';
    } else if (nearStair) {
      const targetLt =
        nearStair.fromFloor === this.playerFloor
          ? nearStair.toFloor + 1
          : nearStair.fromFloor + 1;
      const dirWord = nearStair.fromFloor === this.playerFloor ? 'Naik' : 'Turun';
      prompt = `${nearStair.label} · Berjalan untuk ${dirWord} ke Lt. ${targetLt}`;
    } else if (this.lastPrompt) {
      prompt = this.lastPrompt;
      this.lastPrompt = null;
    }

    this.callbacks.onHudUpdate({
      mapId: this.activeMapId,
      mapName: def.name,
      currentFloor: this.playerFloor,
      totalFloors: this.layout?.floors ?? def.floors,
      elapsedTime: this.elapsedTime,
      lives: this.lives,
      maxLives: 5,
      keysCollected: this.collectedKeys.size,
      totalKeys: TOTAL_KEYS,
      streak: this.streak,
      bestStreak: this.bestStreak,
      stamina: this.stamina,
      maxStamina: MAX_STAMINA,
      isSprinting: this.isSprinting,
      isExhausted: this.isExhausted,
      dodgeCooldown: this.dodgeCooldown,
      dodgeMaxCooldown: DODGE_COOLDOWN,
      isDodging: this.dodgeActiveTimer > 0,
      isSlowed: this.slowTimer > 0,
      isInvuln: this.invulnTimer > 0 || this.dodgeProtectTimer > 0,
      nearPrompt: prompt,
      nearKey: Boolean(nearKeyNode),
      nearBook,
      regionId,
      regionName,
      pointerLocked: this.pointerLocked,
      exitsUnlocked: this.collectedKeys.size >= TOTAL_KEYS,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.stepSimulation(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }
    this.clearWorldMeshes();
    this.textures?.dispose();
    this.envTarget?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}
