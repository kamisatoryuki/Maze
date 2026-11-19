import * as THREE from 'three';
import { CELL_SIZE, FLOOR_HEIGHT, WALL_HEIGHT } from '../maze/MazeConfig';
import type { EscapeRouteId, PropNode, QuizDoorNode, StairNode } from '../types/game';
import type { TextureBundle } from './ProceduralTextures';

// Soft radial contact shadow texture shared across actors/pickups
let contactShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTex) return contactShadowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  contactShadowTex = new THREE.CanvasTexture(c);
  return contactShadowTex;
}

function createContactShadow(radius: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  return mesh;
}

/**
 * 5-part collectible 1942 Brass Key + Archival Dossier Tag
 */
export function createKeyGroup(): THREE.Group {
  const root = new THREE.Group();
  root.add(createContactShadow(0.65));

  const spinner = new THREE.Group();
  spinner.name = 'spinner';
  spinner.position.y = 1.05;

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe6b655,
    metalness: 0.85,
    roughness: 0.22,
    emissive: 0x3f2b06,
    emissiveIntensity: 0.55,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xe9dec3,
    roughness: 0.85,
    metalness: 0.02,
  });
  const cordMat = new THREE.MeshStandardMaterial({
    color: 0x8b3a2b,
    roughness: 0.7,
    metalness: 0.05,
  });

  // Bow (ring)
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), brassMat);
  bow.position.y = 0.28;
  spinner.add(bow);

  // Collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), brassMat);
  collar.position.y = 0.1;
  spinner.add(collar);

  // Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), brassMat);
  shaft.position.y = -0.12;
  spinner.add(shaft);

  // Key teeth (2 bits)
  const bit1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), brassMat);
  bit1.position.set(0.08, -0.26, 0);
  spinner.add(bit1);

  const bit2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), brassMat);
  bit2.position.set(0.06, -0.16, 0);
  spinner.add(bit2);

  // Attached archival dossier tag
  const tagCord = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), cordMat);
  tagCord.position.set(-0.14, 0.16, 0);
  tagCord.rotation.z = 0.35;
  spinner.add(tagCord);

  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.02), paperMat);
  tag.position.set(-0.22, 0.02, 0);
  tag.rotation.z = 0.22;
  spinner.add(tag);

  root.add(spinner);

  // Subtle floor beacon ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.022;
  root.add(ring);

  return root;
}

/**
 * 10-part stylized 1942 Patrol Sentry with articulated limbs & flashlight
 */
export interface GuardVisualHandles {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  armLantern: THREE.Group;
  lanternBulb: THREE.Mesh;
  statusHalo: THREE.Mesh;
}

export function createGuardGroup(): GuardVisualHandles {
  const root = new THREE.Group();
  root.add(createContactShadow(0.75));

  const tunicMat = new THREE.MeshStandardMaterial({
    color: 0x625a41,
    roughness: 0.8,
    metalness: 0.05,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x241d17,
    roughness: 0.55,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd6b492,
    roughness: 0.72,
    metalness: 0.02,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x452d1a,
    roughness: 0.45,
    metalness: 0.2,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc99c3e,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Legs (grounded pivots at hip y=0.78)
  const makeLeg = (xOff: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.78, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.56, 0.22), tunicMat);
    leg.position.y = -0.28;
    pivot.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.28), bootMat);
    boot.position.set(0, -0.67, 0.03);
    pivot.add(boot);
    return pivot;
  };
  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  root.add(leftLeg, rightLeg);

  // Torso + Belt + Satchel
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.3), tunicMat);
  torso.position.y = 1.12;
  root.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.32), leatherMat);
  belt.position.y = 0.86;
  root.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.04), brassMat);
  buckle.position.set(0, 0.86, 0.16);
  root.add(buckle);

  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.24), leatherMat);
  satchel.position.set(-0.31, 0.86, -0.02);
  root.add(satchel);

  // Left arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.18), tunicMat);
  leftArm.position.set(-0.36, 1.12, 0);
  root.add(leftArm);

  // Right arm holding patrol lantern
  const armLantern = new THREE.Group();
  armLantern.position.set(0.36, 1.35, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.18), tunicMat);
  rightArm.position.set(0, -0.18, 0.12);
  rightArm.rotation.x = -Math.PI / 4;
  armLantern.add(rightArm);

  const lanternCase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 8), bootMat);
  lanternCase.position.set(0, -0.34, 0.32);
  armLantern.add(lanternCase);

  const lanternBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffd27d,
      emissive: 0xffa726,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    })
  );
  lanternBulb.position.set(0, -0.34, 0.36);
  armLantern.add(lanternBulb);
  root.add(armLantern);

  // Head + Peaked Field Cap
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.y = 1.66;
  root.add(head);

  const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.15, 10), tunicMat);
  capCrown.position.y = 1.88;
  root.add(capCrown);

  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.18), bootMat);
  capVisor.position.set(0, 1.81, 0.18);
  root.add(capVisor);

  // Floor alert halo
  const statusHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.56, 24),
    new THREE.MeshBasicMaterial({
      color: 0xd4a24c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  statusHalo.rotation.x = -Math.PI / 2;
  statusHalo.position.y = 0.025;
  root.add(statusHalo);

  return { root, leftLeg, rightLeg, armLantern, lanternBulb, statusHalo };
}

/**
 * 7-part Quiz Door Assembly spanning a 2-cell framed doorway
 */
export interface DoorVisualHandles {
  root: THREE.Group;
  gatePanel: THREE.Group;
  lockLamp: THREE.Mesh;
}

export function createQuizDoorGroup(
  door: QuizDoorNode,
  textures: TextureBundle
): DoorVisualHandles {
  const root = new THREE.Group();
  const c0 = door.cells[0];
  const c1 = door.cells[1];
  const centerX = ((c0[0] + c1[0]) * 0.5 + 0.5) * CELL_SIZE;
  const centerZ = ((c0[1] + c1[1]) * 0.5 + 0.5) * CELL_SIZE;
  root.position.set(centerX, (door.floor ?? 0) * FLOOR_HEIGHT, centerZ);
  if (door.orientation === 'V') {
    root.rotation.y = Math.PI / 2;
  }

  const span = CELL_SIZE * 2;
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x3b424c,
    roughness: 0.42,
    metalness: 0.72,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.doorIron,
    roughness: 0.65,
    metalness: 0.35,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a24c,
    roughness: 0.28,
    metalness: 0.85,
  });

  // Left & Right Jamb Pillars + Overhead Lintel
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.32, WALL_HEIGHT, 0.46), steelMat);
  jambL.position.set(-span / 2 + 0.16, WALL_HEIGHT / 2, 0);
  root.add(jambL);

  const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.32, WALL_HEIGHT, 0.46), steelMat);
  jambR.position.set(span / 2 - 0.16, WALL_HEIGHT / 2, 0);
  root.add(jambR);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(span, 0.45, 0.5), steelMat);
  lintel.position.set(0, WALL_HEIGHT - 0.225, 0);
  root.add(lintel);

  // Moving gate panel
  const gatePanel = new THREE.Group();
  const gateSlab = new THREE.Mesh(
    new THREE.BoxGeometry(span - 0.4, WALL_HEIGHT - 0.45, 0.22),
    doorMat
  );
  gateSlab.position.set(0, (WALL_HEIGHT - 0.45) / 2, 0);
  gatePanel.add(gateSlab);

  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.28), brassMat);
  plaque.position.set(0, 1.55, 0);
  gatePanel.add(plaque);
  root.add(gatePanel);

  // Status indicator lamp on top lintel (both sides visible)
  const lockLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe59f3c,
      emissive: 0xe59f3c,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    })
  );
  lockLamp.position.set(0, WALL_HEIGHT - 0.55, 0);
  root.add(lockLamp);

  return { root, gatePanel, lockLamp };
}

/**
 * 8-part Exit Gate Portal (Route A, B, C)
 */
export interface ExitVisualHandles {
  root: THREE.Group;
  shutter: THREE.Mesh;
  beaconLeft: THREE.Mesh;
  beaconRight: THREE.Mesh;
  threshold: THREE.Mesh;
}

export function createExitGateGroup(
  routeId: EscapeRouteId,
  cells: Array<[number, number]>,
  floor = 0
): ExitVisualHandles {
  const root = new THREE.Group();
  const c0 = cells[0];
  const c1 = cells[1];
  const cx = ((c0[0] + c1[0]) * 0.5 + 0.5) * CELL_SIZE;
  const cz = ((c0[1] + c1[1]) * 0.5 + 0.5) * CELL_SIZE;
  root.position.set(cx, floor * FLOOR_HEIGHT, cz);
  if (routeId !== 'B') {
    root.rotation.y = Math.PI / 2;
  }

  const span = CELL_SIZE * 2;
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x262d36,
    roughness: 0.45,
    metalness: 0.65,
  });
  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0x4b535e,
    roughness: 0.55,
    metalness: 0.5,
  });

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.45, WALL_HEIGHT, 0.55), frameMat);
  postL.position.set(-span / 2 + 0.22, WALL_HEIGHT / 2, 0);
  root.add(postL);

  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.45, WALL_HEIGHT, 0.55), frameMat);
  postR.position.set(span / 2 - 0.22, WALL_HEIGHT / 2, 0);
  root.add(postR);

  const header = new THREE.Mesh(new THREE.BoxGeometry(span, 0.65, 0.65), frameMat);
  header.position.set(0, WALL_HEIGHT - 0.32, 0);
  root.add(header);

  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(span - 0.6, WALL_HEIGHT - 0.65, 0.25),
    shutterMat
  );
  shutter.position.set(0, (WALL_HEIGHT - 0.65) / 2, 0);
  root.add(shutter);

  const makeBeacon = (x: number) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xc2413b,
        emissive: 0xc2413b,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    m.position.set(x, WALL_HEIGHT - 0.7, 0);
    return m;
  };
  const beaconLeft = makeBeacon(-span / 2 + 0.75);
  const beaconRight = makeBeacon(span / 2 - 0.75);
  root.add(beaconLeft, beaconRight);

  const threshold = new THREE.Mesh(
    new THREE.PlaneGeometry(span - 0.5, CELL_SIZE * 0.9),
    new THREE.MeshBasicMaterial({
      color: 0xc2413b,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  threshold.rotation.x = -Math.PI / 2;
  threshold.position.y = 0.025;
  root.add(threshold);

  return { root, shutter, beaconLeft, beaconRight, threshold };
}

/**
 * Grounded 3-5 part warehouse environmental props (crates, shelves, desks, barrels)
 */
export function createPropGroup(prop: PropNode, textures: TextureBundle): THREE.Group {
  const root = new THREE.Group();
  root.position.set(
    (prop.x + 0.5) * CELL_SIZE,
    (prop.floor ?? 0) * FLOOR_HEIGHT,
    (prop.y + 0.5) * CELL_SIZE
  );
  root.rotation.y = prop.yaw;

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.crateWood,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3b4249,
    roughness: 0.45,
    metalness: 0.7,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x4b3321,
    roughness: 0.72,
    metalness: 0.08,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xe6dbc2,
    roughness: 0.9,
    metalness: 0.0,
  });

  if (prop.kind === 'crate') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.15), crateMat);
    base.position.y = 0.475;
    root.add(base);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.75), crateMat);
    top.position.set(0.1, 1.275, -0.05);
    top.rotation.y = 0.35;
    root.add(top);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 1.18), ironMat);
    strap.position.y = 0.5;
    root.add(strap);
  } else if (prop.kind === 'barrel') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.12, 12), ironMat);
    body.position.y = 0.56;
    root.add(body);

    const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 12), ironMat);
    rimTop.rotation.x = Math.PI / 2;
    rimTop.position.y = 1.1;
    root.add(rimTop);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 12), crateMat);
    band.position.y = 0.56;
    root.add(band);
  } else if (prop.kind === 'desk') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.85), darkWoodMat);
    top.position.y = 0.85;
    root.add(top);

    for (const lx of [-0.65, 0.65]) {
      for (const lz of [-0.34, 0.34]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.82, 0.1), darkWoodMat);
        leg.position.set(lx, 0.41, lz);
        root.add(leg);
      }
    }
    const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.32), paperMat);
    ledger.position.set(-0.2, 0.925, 0.05);
    ledger.rotation.y = 0.25;
    root.add(ledger);
  } else {
    // shelf
    for (const sx of [-0.65, 0.65]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.65), ironMat);
      post.position.set(sx, 1.05, 0);
      root.add(post);
    }
    for (const sy of [0.3, 1.05, 1.8]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.7), crateMat);
      plank.position.y = sy;
      root.add(plank);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.48), crateMat);
    box.position.set(-0.25, 1.3, 0);
    root.add(box);
  }

  return root;
}

/**
 * 5-part Floor Steam-Valve Trap (replaces legacy 2D spikes in 1942 warehouse)
 */
export interface TrapVisualHandles {
  root: THREE.Group;
  spikesGroup: THREE.Group;
  rimMat: THREE.MeshStandardMaterial;
}

export function createSteamTrapGroup(gx: number, gy: number, floor = 0): TrapVisualHandles {
  const root = new THREE.Group();
  root.position.set((gx + 0.5) * CELL_SIZE, floor * FLOOR_HEIGHT, (gy + 0.5) * CELL_SIZE);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x262226,
    roughness: 0.75,
    metalness: 0.4,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    emissive: 0x000000,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    metalness: 0.65,
  });
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
  });

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE * 0.86, 0.04, CELL_SIZE * 0.86),
    baseMat
  );
  plate.position.y = 0.02;
  root.add(plate);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(CELL_SIZE * 0.36, CELL_SIZE * 0.42, 4),
    rimMat
  );
  rim.rotation.x = -Math.PI / 2;
  rim.rotation.z = Math.PI / 4;
  rim.position.y = 0.045;
  root.add(rim);

  const spikesGroup = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(0.14, 0.85, 6);
  for (const sx of [-0.55, 0, 0.55]) {
    for (const sz of [-0.55, 0.55]) {
      const cone = new THREE.Mesh(coneGeo, spikeMat);
      cone.position.set(sx, 0.42, sz);
      spikesGroup.add(cone);
    }
  }
  spikesGroup.scale.y = 0.1;
  root.add(spikesGroup);

  return { root, spikesGroup, rimMat };
}

/**
 * 10-part Starting Room Wooden Table + Open 1942 Leather Story Book & Brass Reading Lamp
 */
export function createStoryTableGroup(
  gx: number,
  gy: number,
  yaw = -Math.PI / 2,
  floor = 0
): THREE.Group {
  const root = new THREE.Group();
  root.position.set((gx + 0.5) * CELL_SIZE, floor * FLOOR_HEIGHT, (gy + 0.5) * CELL_SIZE);
  root.rotation.y = yaw;
  root.add(createContactShadow(0.95));

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x4b311e,
    roughness: 0.72,
    metalness: 0.08,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x6b2820,
    roughness: 0.65,
    metalness: 0.06,
  });
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xefe5cc,
    roughness: 0.88,
    metalness: 0.0,
    emissive: 0x3b2c12,
    emissiveIntensity: 0.25,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a24c,
    roughness: 0.28,
    metalness: 0.85,
  });

  // Table top & 4 legs
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.92), darkWoodMat);
  top.position.y = 0.88;
  root.add(top);

  for (const lx of [-0.66, 0.66]) {
    for (const lz of [-0.36, 0.36]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.84, 0.11), darkWoodMat);
      leg.position.set(lx, 0.42, lz);
      root.add(leg);
    }
  }

  // Open leather-bound diary centered on table
  const bookGroup = new THREE.Group();
  bookGroup.position.set(-0.08, 0.96, 0.06);
  bookGroup.rotation.y = 0.12;

  const coverLeft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.34), leatherMat);
  coverLeft.position.set(-0.13, 0, 0);
  coverLeft.rotation.z = 0.08;
  bookGroup.add(coverLeft);

  const coverRight = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.34), leatherMat);
  coverRight.position.set(0.13, 0, 0);
  coverRight.rotation.z = -0.08;
  bookGroup.add(coverRight);

  const pagesLeft = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.31), pageMat);
  pagesLeft.position.set(-0.12, 0.022, 0);
  pagesLeft.rotation.z = 0.08;
  bookGroup.add(pagesLeft);

  const pagesRight = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.31), pageMat);
  pagesRight.position.set(0.12, 0.022, 0);
  pagesRight.rotation.z = -0.08;
  bookGroup.add(pagesRight);

  // Red ribbon bookmark
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.01, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xc2413b, roughness: 0.7 })
  );
  ribbon.position.set(0, 0.035, 0.04);
  bookGroup.add(ribbon);
  root.add(bookGroup);

  // Small brass desk lamp illuminating the diary
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 10), brassMat);
  lampBase.position.set(0.45, 0.955, -0.2);
  root.add(lampBase);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), brassMat);
  lampStem.position.set(0.45, 1.12, -0.2);
  root.add(lampStem);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.14, 10),
    new THREE.MeshStandardMaterial({
      color: 0x2d5a43,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0xd4a24c,
      emissiveIntensity: 0.35,
    })
  );
  lampShade.position.set(0.38, 1.28, -0.14);
  lampShade.rotation.z = 0.38;
  root.add(lampShade);

  const lampGlow = new THREE.PointLight(0xffcb78, 1.65, 6.5, 1.8);
  lampGlow.position.set(0.15, 1.38, 0);
  root.add(lampGlow);

  // Subtle floor ring under table to invite inspection
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.86, 24),
    new THREE.MeshBasicMaterial({
      color: 0xd4a24c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.022;
  root.add(ring);

  return root;
}

/**
 * Multi-step architectural staircase connecting two floors in 3-story Gedung
 */
export function createStaircaseGroup(
  stair: StairNode,
  textures: TextureBundle
): THREE.Group {
  const root = new THREE.Group();
  const centerX = (stair.x + stair.w * 0.5) * CELL_SIZE;
  const centerZ = (stair.y + stair.h * 0.5) * CELL_SIZE;
  root.position.set(centerX, stair.fromFloor * FLOOR_HEIGHT, centerZ);

  if (stair.dir === 'S') root.rotation.y = -Math.PI / 2;
  else if (stair.dir === 'W') root.rotation.y = Math.PI;
  else if (stair.dir === 'N') root.rotation.y = Math.PI / 2;

  const isHorizontal = stair.dir === 'E' || stair.dir === 'W';
  const runLength = (isHorizontal ? stair.w : stair.h) * CELL_SIZE;
  const width = (isHorizontal ? stair.h : stair.w) * CELL_SIZE - 0.36;

  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.floorBuilding,
    roughness: 0.7,
    metalness: 0.15,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2c333d,
    roughness: 0.45,
    metalness: 0.72,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe2b15e,
    emissive: 0x996515,
    emissiveIntensity: 0.65,
    roughness: 0.28,
    metalness: 0.85,
  });

  const numSteps = 14;
  const stepRise = FLOOR_HEIGHT / numSteps;
  const stepDepth = runLength / numSteps;

  for (let i = 0; i < numSteps; i++) {
    const xPos = -runLength * 0.5 + (i + 0.5) * stepDepth;
    const topY = (i + 1) * stepRise;
    // Concrete tread + solid riser block down to y=0 (capped for upper steps to look architectural)
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(stepDepth + 0.04, stepRise * 1.1, width),
      stepMat
    );
    tread.position.set(xPos, topY - stepRise * 0.5, 0);
    root.add(tread);

    // Subtle brass anti-slip nosing strip on each step
    const nosing = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.03, width - 0.12),
      brassMat
    );
    nosing.position.set(xPos - stepDepth * 0.42, topY + 0.01, 0);
    root.add(nosing);
  }

  // Inclined side stringers & handrails
  const slopeLen = Math.hypot(runLength, FLOOR_HEIGHT);
  const slopeAngle = Math.atan2(FLOOR_HEIGHT, runLength);
  for (const side of [-1, 1]) {
    const zRail = side * (width * 0.5 - 0.08);
    const stringer = new THREE.Mesh(
      new THREE.BoxGeometry(slopeLen, 0.38, 0.14),
      ironMat
    );
    stringer.position.set(0, FLOOR_HEIGHT * 0.5, zRail);
    stringer.rotation.z = slopeAngle;
    root.add(stringer);

    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(slopeLen, 0.08, 0.1),
      brassMat
    );
    handrail.position.set(0, FLOOR_HEIGHT * 0.5 + 0.92, zRail);
    handrail.rotation.z = slopeAngle;
    root.add(handrail);

    // Vertical balusters at bottom, middle, top
    for (const frac of [0.06, 0.5, 0.94]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.95, 0.09), ironMat);
      post.position.set(
        -runLength * 0.5 + frac * runLength,
        frac * FLOOR_HEIGHT + 0.46,
        zRail
      );
      root.add(post);
    }
  }

  // Warm stairwell ceiling/entry lights at bottom and top landings
  const bottomGlow = new THREE.PointLight(0xffcf87, 1.5, 9, 1.6);
  bottomGlow.position.set(-runLength * 0.45, 2.2, 0);
  root.add(bottomGlow);

  const topGlow = new THREE.PointLight(0x9ee6bd, 1.4, 9, 1.6);
  topGlow.position.set(runLength * 0.45, FLOOR_HEIGHT + 1.8, 0);
  root.add(topGlow);

  return root;
}

