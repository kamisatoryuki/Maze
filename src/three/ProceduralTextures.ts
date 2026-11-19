import * as THREE from 'three';

function makePixelCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(4, maxAniso);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface TextureBundle {
  wallDepot: THREE.CanvasTexture;
  wallAdmin: THREE.CanvasTexture;
  wallService: THREE.CanvasTexture;
  wallOuter: THREE.CanvasTexture;
  wallForest: THREE.CanvasTexture;
  wallVillage: THREE.CanvasTexture;
  wallBuilding: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  floorConcrete: THREE.CanvasTexture;
  floorForest: THREE.CanvasTexture;
  floorVillage: THREE.CanvasTexture;
  floorBuilding: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  ceilingRafters: THREE.CanvasTexture;
  roofTerracotta: THREE.CanvasTexture;
  foliageLeaf: THREE.CanvasTexture;
  crateWood: THREE.CanvasTexture;
  doorIron: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAniso: number): TextureBundle {
  const all: THREE.Texture[] = [];

  // 1. Storage Depot Wall: weathered timber planks + dark brick base (32x32 retro pixel)
  const [wdC, wd] = makePixelCanvas(32);
  wd.fillStyle = '#4c3828';
  wd.fillRect(0, 0, 32, 32);
  for (let x = 0; x < 32; x += 8) {
    wd.fillStyle = x % 16 === 0 ? '#5b4330' : '#443223';
    wd.fillRect(x, 0, 7, 22);
    wd.fillStyle = '#2d1f15';
    wd.fillRect(x + 7, 0, 1, 22);
    wd.fillStyle = '#241911';
    wd.fillRect(x + 3, 4, 1, 1);
    wd.fillRect(x + 3, 18, 1, 1);
  }
  wd.fillStyle = '#3b3938';
  wd.fillRect(0, 22, 32, 10);
  for (let y = 23; y < 32; y += 3) {
    const off = (y % 2) * 4;
    for (let x = 0; x < 32; x += 8) {
      wd.fillStyle = (x + y) % 5 === 0 ? '#4e4844' : '#323030';
      wd.fillRect((x + off) % 32, y, 7, 2);
    }
  }
  const wallDepot = finalizeTexture(wdC, true, maxAniso);
  all.push(wallDepot);

  // 2. Administrative Section Wall: colonial cream-ochre plaster + dark teak wainscot
  const [waC, wa] = makePixelCanvas(32);
  wa.fillStyle = '#7b725e';
  wa.fillRect(0, 0, 32, 20);
  for (let i = 0; i < 40; i++) {
    wa.fillStyle = i % 2 === 0 ? '#6e6552' : '#887f6a';
    wa.fillRect((i * 7) % 32, (i * 5) % 20, 2, 1);
  }
  wa.fillStyle = '#3c2a1e';
  wa.fillRect(0, 20, 32, 2);
  wa.fillStyle = '#4f3726';
  wa.fillRect(0, 22, 32, 10);
  for (let x = 0; x < 32; x += 8) {
    wa.fillStyle = '#362417';
    wa.fillRect(x + 2, 24, 4, 6);
  }
  const wallAdmin = finalizeTexture(waC, true, maxAniso);
  all.push(wallAdmin);

  // 3. Service Corridors Wall: riveted steel panels + ochre warning stripe
  const [wsC, ws] = makePixelCanvas(32);
  ws.fillStyle = '#3b434b';
  ws.fillRect(0, 0, 32, 32);
  ws.fillStyle = '#48525c';
  ws.fillRect(1, 1, 14, 24);
  ws.fillRect(17, 1, 14, 24);
  ws.fillStyle = '#252b31';
  ws.fillRect(15, 0, 2, 32);
  for (let y = 3; y <= 21; y += 6) {
    ws.fillStyle = '#626f7c';
    ws.fillRect(2, y, 1, 1);
    ws.fillRect(13, y, 1, 1);
    ws.fillRect(18, y, 1, 1);
    ws.fillRect(29, y, 1, 1);
  }
  ws.fillStyle = '#99752e';
  ws.fillRect(0, 26, 32, 3);
  for (let x = 0; x < 32; x += 6) {
    ws.fillStyle = '#1f2328';
    ws.fillRect(x, 26, 3, 3);
  }
  const wallService = finalizeTexture(wsC, true, maxAniso);
  all.push(wallService);

  // 4. Outer Complex Wall: heavy reinforced concrete blocks
  const [woC, wo] = makePixelCanvas(32);
  wo.fillStyle = '#45484c';
  wo.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const shift = (row % 2) * 8;
    wo.fillStyle = '#2c2f33';
    wo.fillRect(0, y, 32, 1);
    for (let col = 0; col < 2; col++) {
      const x = (col * 16 + shift) % 32;
      wo.fillStyle = (row + col) % 2 === 0 ? '#505459' : '#404448';
      wo.fillRect(x + 1, y + 1, 14, 6);
      wo.fillStyle = '#2c2f33';
      wo.fillRect(x, y, 1, 8);
    }
  }
  const wallOuter = finalizeTexture(woC, true, maxAniso);
  all.push(wallOuter);

  // 4b. Forest Wall: dense dark bark & moss undergrowth
  const [wfC, wf] = makePixelCanvas(32);
  wf.fillStyle = '#223322';
  wf.fillRect(0, 0, 32, 32);
  for (let x = 0; x < 32; x += 4) {
    wf.fillStyle = x % 8 === 0 ? '#3a2d20' : '#2d2318';
    wf.fillRect(x, 0, 3, 32);
    wf.fillStyle = '#1b140e';
    wf.fillRect(x + 3, 0, 1, 32);
  }
  for (let i = 0; i < 65; i++) {
    wf.fillStyle = i % 3 === 0 ? '#2f5e34' : i % 3 === 1 ? '#1e4424' : '#407342';
    wf.fillRect((i * 11) % 30, (i * 7) % 30, 3, 2);
  }
  const wallForest = finalizeTexture(wfC, true, maxAniso);
  all.push(wallForest);

  // 4c. Village Wall: colonial whitewash plaster + red brick dado & timber beams
  const [wvC, wv] = makePixelCanvas(32);
  wv.fillStyle = '#9c8f78';
  wv.fillRect(0, 0, 32, 22);
  wv.fillStyle = '#4f3320';
  wv.fillRect(0, 0, 3, 32);
  wv.fillRect(29, 0, 3, 32);
  wv.fillRect(0, 10, 32, 2);
  wv.fillStyle = '#6c382a';
  wv.fillRect(0, 22, 32, 10);
  for (let y = 23; y < 32; y += 3) {
    const off = (y % 2) * 4;
    for (let x = 0; x < 32; x += 8) {
      wv.fillStyle = (x + y) % 4 === 0 ? '#7d4435' : '#5b2e22';
      wv.fillRect((x + off) % 32, y, 7, 2);
    }
  }
  const wallVillage = finalizeTexture(wvC, true, maxAniso);
  all.push(wallVillage);

  // 4d. Building Wall: command HQ stone masonry + crimson/gold dado line
  const [wbdC, wbd] = makePixelCanvas(32);
  wbd.fillStyle = '#4e545e';
  wbd.fillRect(0, 0, 32, 24);
  for (let y = 0; y < 24; y += 6) {
    wbd.fillStyle = '#383d45';
    wbd.fillRect(0, y, 32, 1);
  }
  wbd.fillStyle = '#6e2b25';
  wbd.fillRect(0, 22, 32, 2);
  wbd.fillStyle = '#2d323a';
  wbd.fillRect(0, 24, 32, 8);
  const wallBuilding = finalizeTexture(wbdC, true, maxAniso);
  all.push(wallBuilding);

  // 5. Wall bump map (grayscale)
  const [wbC, wb] = makePixelCanvas(32);
  wb.fillStyle = '#909090';
  wb.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 8) {
    wb.fillStyle = '#404040';
    wb.fillRect(0, y, 32, 1);
  }
  for (let x = 0; x < 32; x += 8) {
    wb.fillStyle = '#555555';
    wb.fillRect(x, 0, 1, 32);
  }
  const wallBump = finalizeTexture(wbC, false, maxAniso);
  all.push(wallBump);

  // 6. Floor Concrete Slab
  const [flC, fl] = makePixelCanvas(32);
  fl.fillStyle = '#333840';
  fl.fillRect(0, 0, 32, 32);
  fl.fillStyle = '#3d434c';
  fl.fillRect(1, 1, 14, 14);
  fl.fillRect(17, 17, 14, 14);
  fl.fillStyle = '#373d46';
  fl.fillRect(17, 1, 14, 14);
  fl.fillRect(1, 17, 14, 14);
  fl.fillStyle = '#252930';
  fl.fillRect(15, 0, 2, 32);
  fl.fillRect(0, 15, 32, 2);
  const floorConcrete = finalizeTexture(flC, true, maxAniso);
  all.push(floorConcrete);

  // 6b. Forest Ground: packed forest earth & moss grass
  const [ffC, ff] = makePixelCanvas(32);
  ff.fillStyle = '#243020';
  ff.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    ff.fillStyle = i % 4 === 0 ? '#324228' : i % 4 === 1 ? '#2c251c' : '#1b2618';
    ff.fillRect((i * 13) % 30, (i * 9) % 30, 3, 2);
  }
  const floorForest = finalizeTexture(ffC, true, maxAniso);
  all.push(floorForest);

  // 6c. Village Ground: cobblestone & compacted earth road
  const [fvC, fv] = makePixelCanvas(32);
  fv.fillStyle = '#473e33';
  fv.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 8) {
    const off = (y % 16) === 0 ? 0 : 4;
    for (let x = 0; x < 32; x += 8) {
      fv.fillStyle = (x + y) % 16 === 0 ? '#5b5043' : '#504639';
      fv.fillRect((x + off) % 32, y + 1, 6, 6);
    }
  }
  const floorVillage = finalizeTexture(fvC, true, maxAniso);
  all.push(floorVillage);

  // 6d. Building Floor: polished headquarters tile
  const [fbldC, fbld] = makePixelCanvas(32);
  fbld.fillStyle = '#393e47';
  fbld.fillRect(0, 0, 32, 32);
  fbld.fillStyle = '#464d57';
  fbld.fillRect(1, 1, 14, 14);
  fbld.fillRect(17, 17, 14, 14);
  fbld.fillStyle = '#3e444e';
  fbld.fillRect(17, 1, 14, 14);
  fbld.fillRect(1, 17, 14, 14);
  fbld.fillStyle = '#23272e';
  fbld.fillRect(15, 0, 2, 32);
  fbld.fillRect(0, 15, 32, 2);
  const floorBuilding = finalizeTexture(fbldC, true, maxAniso);
  all.push(floorBuilding);

  const [fbC, fb] = makePixelCanvas(32);
  fb.fillStyle = '#9a9a9a';
  fb.fillRect(0, 0, 32, 32);
  fb.fillStyle = '#444444';
  fb.fillRect(15, 0, 2, 32);
  fb.fillRect(0, 15, 32, 2);
  const floorBump = finalizeTexture(fbC, false, maxAniso);
  all.push(floorBump);

  // 7. Ceiling Timber & Corrugated Iron
  const [clC, cl] = makePixelCanvas(32);
  cl.fillStyle = '#1e2229';
  cl.fillRect(0, 0, 32, 32);
  for (let x = 0; x < 32; x += 4) {
    cl.fillStyle = x % 8 === 0 ? '#272c35' : '#181c22';
    cl.fillRect(x, 0, 2, 32);
  }
  cl.fillStyle = '#34271c';
  cl.fillRect(0, 0, 32, 4);
  cl.fillRect(0, 16, 32, 4);
  const ceilingRafters = finalizeTexture(clC, true, maxAniso);
  all.push(ceilingRafters);

  // 7b. Terracotta Roof Tiles (for Pedesaan open-sky houses)
  const [rtC, rt] = makePixelCanvas(32);
  rt.fillStyle = '#6e3425';
  rt.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 6) {
    rt.fillStyle = '#4f2217';
    rt.fillRect(0, y, 32, 1);
    for (let x = 0; x < 32; x += 8) {
      rt.fillStyle = (x + y) % 12 === 0 ? '#854230' : '#652f21';
      rt.fillRect(x + 1, y + 1, 6, 4);
    }
  }
  const roofTerracotta = finalizeTexture(rtC, true, maxAniso);
  all.push(roofTerracotta);

  // 7c. Dense Canopy Foliage (for Hutan tree tops)
  const [flfC, flf] = makePixelCanvas(32);
  flf.fillStyle = '#1b331d';
  flf.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 80; i++) {
    flf.fillStyle = i % 3 === 0 ? '#2b522e' : i % 3 === 1 ? '#204023' : '#3a663b';
    flf.fillRect((i * 9) % 29, (i * 11) % 29, 4, 3);
  }
  const foliageLeaf = finalizeTexture(flfC, true, maxAniso);
  all.push(foliageLeaf);

  // 8. Supply Crate Wood
  const [crC, cr] = makePixelCanvas(32);
  cr.fillStyle = '#7c5937';
  cr.fillRect(0, 0, 32, 32);
  cr.fillStyle = '#5a3e23';
  cr.fillRect(0, 0, 32, 4);
  cr.fillRect(0, 28, 32, 4);
  cr.fillRect(0, 0, 4, 32);
  cr.fillRect(28, 0, 4, 32);
  for (let i = 4; i < 28; i++) {
    cr.fillStyle = '#684829';
    cr.fillRect(i, i, 3, 2);
  }
  const crateWood = finalizeTexture(crC, true, maxAniso);
  all.push(crateWood);

  // 9. Iron Security Door Texture
  const [drC, dr] = makePixelCanvas(32);
  dr.fillStyle = '#3a2b1e';
  dr.fillRect(0, 0, 32, 32);
  for (let x = 3; x < 30; x += 6) {
    dr.fillStyle = '#606873';
    dr.fillRect(x, 2, 2, 28);
  }
  dr.fillStyle = '#251a12';
  dr.fillRect(0, 14, 32, 4);
  const doorIron = finalizeTexture(drC, true, maxAniso);
  all.push(doorIron);

  return {
    wallDepot,
    wallAdmin,
    wallService,
    wallOuter,
    wallForest,
    wallVillage,
    wallBuilding,
    wallBump,
    floorConcrete,
    floorForest,
    floorVillage,
    floorBuilding,
    floorBump,
    ceilingRafters,
    roofTerracotta,
    foliageLeaf,
    crateWood,
    doorIron,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
