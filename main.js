import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =====================================================================
   Signifa walk-through
   - A modern apartment tower (stilt + 8 floors) on a landscaped plot
   - A representative 3 BHK on the 5th floor, built room by room
   - Scroll drives the camera: gate -> lobby -> lift -> door -> rooms
   Units are metres. Building front faces +z. The flat lives in its own
   space far from the tower so the camera never has to fly through walls.
   ===================================================================== */

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('#scene');
const sunInput = $('#sun');
const sunOut = $('#sunOut');
const nav = $('#nav');
const sheet = $('.sheet');
const wordBox = $('#word');
const wordText = $('#wordText');
const pager = $('#pager');
const fadeEl = $('#fade');
const roomTag = $('#roomTag');
const planEl = $('#plan');
const slides = [...document.querySelectorAll('.slide')];
const root = document.documentElement.style;
const D2R = THREE.MathUtils.degToRad;

document.body.classList.add('load-in');

/* ================= renderer ================= */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  $('#loader').classList.add('done');
  document.body.classList.remove('load-in');
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog(0xF2DDBF, 160, 520);

const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 1200);

/* ================= helpers ================= */
const ext = new THREE.Group();   // tower + site
const flat = new THREE.Group();  // the 3 BHK
scene.add(ext, flat);

const FLAT_ORIGIN = new THREE.Vector3(600, 15.75, -6);  // flat local (0,0,0) in world
flat.position.copy(FLAT_ORIGIN);

function box(parent, mat, w, h, d, x, y, z, o = {}) {
  const m = new THREE.Mesh(o.round ? new RoundedBoxGeometry(w, h, d, 2, Math.min(o.round, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  parent.add(m);
  return m;
}
function cyl(parent, mat, rt, rb, h, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ================= textures ================= */
const tileTex = canvasTex(512, 512, (g, w, h) => {      // large vitrified tiles, soft marble veins
  g.fillStyle = '#EFE8DC'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(160,140,115,${0.05 + rand() * 0.08})`; g.lineWidth = 1 + rand() * 2;
    g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rand() - 0.3) * 120; y += (rand() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(120,100,80,.35)'; g.lineWidth = 3;
  g.strokeRect(0, 0, w / 2, h / 2); g.strokeRect(w / 2, 0, w / 2, h / 2); g.strokeRect(0, h / 2, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
}, true);
const bathTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#B9BDBF'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8E9396'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
}, true);
const woodTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8A5A34'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(${50 + rand() * 40},${28 + rand() * 20},12,${0.15 + rand() * 0.25})`;
    g.lineWidth = 1 + rand() * 2; const y = rand() * h;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rand() * 10 - 5, w * 0.6, y + rand() * 10 - 5, w, y); g.stroke();
  }
}, true);
const windowTex = canvasTex(256, 256, (g, w, h) => {     // building side windows (also used as emissive map)
  g.fillStyle = '#ECE8E0'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    g.fillStyle = '#3E4C57'; g.fillRect(c * 64 + 10, r * 64 + 14, 44, 38);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(c * 64 + 10, r * 64 + 14, 44, 6);
  }
}, true);
const windowGlow = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (rand() < 0.62) { g.fillStyle = rand() < 0.5 ? '#FFC27A' : '#FFD9A0'; g.fillRect(c * 64 + 10, r * 64 + 14, 44, 38); }
  }
}, true);
windowGlow.colorSpace = THREE.SRGBColorSpace;

function artTex(a, b, c) {
  return canvasTex(256, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = c; g.beginPath(); g.arc(w * 0.62, h * 0.4, w * 0.26, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(w * 0.12, h * 0.68, w * 0.76, 6);
  });
}
function signTex(text, sub) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#E9CE8E'; g.textAlign = 'center';
    g.font = '400 120px Marcellus, Georgia, serif'; g.fillText(text, w / 2, 150);
    if (sub) { g.font = '600 40px Manrope, sans-serif'; g.fillStyle = '#F5EEDC'; g.fillText(sub, w / 2, 215); }
  });
}

/* ================= materials ================= */
const M = {
  white:   new THREE.MeshPhysicalMaterial({ color: 0xF8F6F1, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xECE6DC, roughness: 0.85 }),
  charcoal:new THREE.MeshStandardMaterial({ color: 0x4D5157, roughness: 0.75 }),
  stone:   new THREE.MeshStandardMaterial({ color: 0xD9CDB6, roughness: 0.6 }),
  paving:  new THREE.MeshStandardMaterial({ color: 0xCFC6B5, roughness: 0.8 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x55575A, roughness: 0.95 }),
  lawn:    new THREE.MeshStandardMaterial({ color: 0x6E9A48, roughness: 1 }),
  leaf:    new THREE.MeshStandardMaterial({ color: 0x3F7A31, roughness: 0.8, flatShading: true }),
  leaf2:   new THREE.MeshStandardMaterial({ color: 0x5C8F3A, roughness: 0.8, flatShading: true }),
  trunk:   new THREE.MeshStandardMaterial({ color: 0x8C6A48, roughness: 0.9, flatShading: true }),
  wood:    new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: woodTex, roughness: 0.5 }),
  woodDark:new THREE.MeshStandardMaterial({ color: 0x9A7A62, map: woodTex, roughness: 0.45 }),
  bronze:  new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.35, metalness: 0.7 }),
  chrome:  new THREE.MeshStandardMaterial({ color: 0xDADDE0, roughness: 0.15, metalness: 1 }),
  glass:   new THREE.MeshPhysicalMaterial({ color: 0x9FB8C4, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.28, envMapIntensity: 2, depthWrite: false }),
  facadeGlass: new THREE.MeshPhysicalMaterial({ color: 0x55707E, roughness: 0.05, metalness: 0.4, envMapIntensity: 2, emissive: 0xFFB563, emissiveIntensity: 0.1 }),
  windows: new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.6, emissive: 0xFFFFFF, emissiveMap: windowGlow, emissiveIntensity: 0 }),
  water:   new THREE.MeshPhysicalMaterial({ color: 0x1EAFC0, roughness: 0.03, clearcoat: 1, emissive: 0x16C4D6, emissiveIntensity: 0.08 }),
  // interior
  wall:    new THREE.MeshStandardMaterial({ color: 0xF3EFE8, roughness: 0.9 }),
  wallSage:new THREE.MeshStandardMaterial({ color: 0xA9B79C, roughness: 0.9 }),
  wallClay:new THREE.MeshStandardMaterial({ color: 0xC99A78, roughness: 0.9 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xFBFAF7, roughness: 1 }),
  floor:   new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: tileTex, roughness: 0.25, envMapIntensity: 0.8 }),
  bathFloor: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: bathTex, roughness: 0.6 }),
  fabric:  new THREE.MeshStandardMaterial({ color: 0xD9CBB5, roughness: 1 }),
  fabricDk:new THREE.MeshStandardMaterial({ color: 0x5D6B78, roughness: 1 }),
  fabricRust: new THREE.MeshStandardMaterial({ color: 0xB86A45, roughness: 1 }),
  fabricSage: new THREE.MeshStandardMaterial({ color: 0x8FA388, roughness: 1 }),
  linen:   new THREE.MeshStandardMaterial({ color: 0xF7F3EA, roughness: 1 }),
  rug:     new THREE.MeshStandardMaterial({ color: 0xC2AE8F, roughness: 1 }),
  granite: new THREE.MeshStandardMaterial({ color: 0x24272B, roughness: 0.2, metalness: 0.2 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0xE9E3D7, roughness: 0.5 }),
  black:   new THREE.MeshStandardMaterial({ color: 0x15171A, roughness: 0.3 }),
  screen:  new THREE.MeshStandardMaterial({ color: 0x0B0D10, roughness: 0.1, metalness: 0.4 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.15 }),
  mirror:  new THREE.MeshStandardMaterial({ color: 0xDDE6EA, roughness: 0.02, metalness: 1 }),
  lampGlow:new THREE.MeshStandardMaterial({ color: 0xFFF3DC, emissive: 0xFFD9A0, emissiveIntensity: 1.2 }),
  cove:    new THREE.MeshStandardMaterial({ color: 0xFFF0D8, emissive: 0xFFC98A, emissiveIntensity: 0.6 }),
  pot:     new THREE.MeshStandardMaterial({ color: 0xC9B79C, roughness: 0.8 }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xB0603C, roughness: 0.9 }),
  door:    new THREE.MeshStandardMaterial({ color: 0xB7895F, map: woodTex, roughness: 0.5 }),
  teak:    new THREE.MeshStandardMaterial({ color: 0xA36E43, map: woodTex, roughness: 0.4 }),
  frame:   new THREE.MeshStandardMaterial({ color: 0x3A3F45, roughness: 0.4, metalness: 0.5 }),
  carRed:  new THREE.MeshPhysicalMaterial({ color: 0x8E2A2A, roughness: 0.25, clearcoat: 1 }),
  carWhite:new THREE.MeshPhysicalMaterial({ color: 0xEDEDED, roughness: 0.25, clearcoat: 1 }),
  carGrey: new THREE.MeshPhysicalMaterial({ color: 0x5A6068, roughness: 0.25, clearcoat: 1 }),
  carBlue: new THREE.MeshPhysicalMaterial({ color: 0x2F4E73, roughness: 0.25, clearcoat: 1 }),
  city:    new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.8, emissive: 0xFFFFFF, emissiveMap: windowGlow, emissiveIntensity: 0 }),
};

/* ================= foliage ================= */
const frondGeo = (() => {
  const seg = 12, len = 5.2, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = Math.sin(Math.PI * Math.min(t * 1.15, 1)) * 0.95 * (i % 2 ? 0.7 : 1);
    const x = t * len, y = Math.sin(t * Math.PI * 0.9) * 1.1 - t * t * 2.4;
    pos.push(x, y, -w, x, y + 0.2, 0, x, y, w);
    if (i < seg) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
})();
const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x3E7A2E, roughness: 0.75, side: THREE.DoubleSide, flatShading: true });
function palm(parent, x, z, h = 9, lean = 0.8) {
  const g = new THREE.Group();
  const top = new THREE.Vector3(lean, h, lean * 0.3);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.1, h * 0.45, 0), new THREE.Vector3(lean * 0.6, h * 0.8, lean * 0.2), top]);
  const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.22, 6), M.trunk); t.castShadow = true; g.add(t);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(frondGeo, palmLeafMat);
    f.position.copy(top); f.rotation.order = 'YXZ';
    f.rotation.y = (i / 9) * Math.PI * 2 + rand() * 0.4; f.rotation.x = -0.3 - rand() * 0.5;
    f.castShadow = true; g.add(f);
  }
  g.position.set(x, 0, z); g.rotation.y = rand() * 6;
  parent.add(g); return g;
}
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
function tree(parent, x, z, s = 1) {
  cyl(parent, M.trunk, 0.15 * s, 0.22 * s, 2.6 * s, x, 1.3 * s, z, 7);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(blobGeo, i % 2 ? M.leaf : M.leaf2);
    b.position.set(x + (rand() - 0.5) * 1.6 * s, (2.8 + rand() * 1.4) * s, z + (rand() - 0.5) * 1.6 * s);
    b.scale.setScalar((1.1 + rand() * 0.6) * s); b.castShadow = true; parent.add(b);
  }
}
function bush(parent, x, y, z, s = 0.5, mat = M.leaf2) {
  const b = new THREE.Mesh(blobGeo, mat); b.position.set(x, y, z); b.scale.set(s * 1.2, s, s * 1.2);
  b.castShadow = true; parent.add(b); return b;
}
function plant(parent, x, z, h = 1.2) {           // indoor potted plant
  cyl(parent, M.pot, 0.22, 0.17, 0.45, x, 0.225, z, 14);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(frondGeo, palmLeafMat);
    f.scale.setScalar(0.16 * h); f.position.set(x, 0.45, z);
    f.rotation.order = 'YXZ'; f.rotation.y = i * 0.9; f.rotation.x = 0.5 + rand() * 0.4; f.rotation.z = 0.9;
    parent.add(f);
  }
  bush(parent, x, 0.5 + h * 0.35, z, 0.28 * h, M.leaf);
}

/* =====================================================================
   THE TOWER
   ===================================================================== */
const FH = 3.15, FLOORS = 8, W = 42, D = 16;
{
  // site
  box(ext, M.paving, 110, 0.3, 90, 0, -0.15, 14, { cast: false });
  box(ext, M.lawn, 26, 0.06, 26, -29, 0.03, 24, { cast: false });
  box(ext, M.lawn, 26, 0.06, 26, 29, 0.03, 24, { cast: false });
  box(ext, M.lawn, 110, 0.06, 14, 0, 0.03, -20, { cast: false });
  box(ext, M.asphalt, 8, 0.05, 40, 0, 0.04, 30, { cast: false });
  box(ext, M.asphalt, 30, 0.05, 7, 0, 0.045, 13.5, { cast: false });
  const big = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshStandardMaterial({ color: 0x8FA772, roughness: 1 }));
  big.rotation.x = -Math.PI / 2; big.position.y = -0.32; big.receiveShadow = true; ext.add(big);

  // gate + compound wall
  for (const sx of [-1, 1]) {
    box(ext, M.stone, 1.4, 3.4, 1.4, sx * 5, 1.7, 50);
    box(ext, M.lampGlow, 0.6, 0.35, 0.6, sx * 5, 3.6, 50, { cast: false });
    box(ext, M.plaster, 48, 1.6, 0.4, sx * 29, 0.8, 50);
    box(ext, M.bronze, 48, 0.12, 0.45, sx * 29, 1.66, 50);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: signTex('SIGNIFA', 'BUILDERS & DEVELOPERS'), transparent: true }));
  sign.position.set(-14, 1.2, 50.22); ext.add(sign);
  box(ext, M.charcoal, 11, 2.2, 0.3, -14, 1.2, 50.05);

  // stilt columns, cars
  for (let ix = -2; ix <= 2; ix++) for (const z of [-6, 0, 6]) cyl(ext, M.white, 0.38, 0.38, FH, ix * 8.4, FH / 2, z, 14);
  const carMats = [M.carRed, M.carWhite, M.carGrey, M.carBlue, M.carWhite, M.carGrey];
  [-17, -12.5, -8, 8, 12.5, 17].forEach((x, i) => {
    box(ext, carMats[i], 1.9, 0.75, 4.3, x, 0.55, -2.5, { round: 0.3 });
    box(ext, M.black, 1.7, 0.55, 2.3, x, 1.1, -2.7, { round: 0.25 });
  });
  // lobby: double-height glass box + timber wall + canopy
  box(ext, M.wood, 9, FH - 0.2, 0.3, 0, FH / 2, 4.2);
  box(ext, M.facadeGlass, 9, FH - 0.3, 0.08, 0, FH / 2, 8.2, { cast: false });
  box(ext, M.frame, 0.12, FH, 0.12, -4.5, FH / 2, 8.2); box(ext, M.frame, 0.12, FH, 0.12, 4.5, FH / 2, 8.2);
  box(ext, M.white, 13, 0.35, 8, 0, FH + 0.1, 11.5, { round: 0.12 });
  box(ext, M.cove, 11, 0.04, 0.2, 0, FH - 0.09, 15.2, { cast: false });
  for (const sx of [-1, 1]) cyl(ext, M.charcoal, 0.22, 0.22, FH, sx * 5.5, FH / 2, 14.8, 12);
  const lobbySign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTex('SIGNATURE', 'TOWER A'), transparent: true }));
  lobbySign.position.set(0, FH + 0.62, 15.52); ext.add(lobbySign);
  box(ext, M.charcoal, 7, 0.9, 0.12, 0, FH + 0.62, 15.45);

  // tower body (floors 1..8) with windowed sides
  const bodyH = FLOORS * FH;
  windowTex.repeat.set(W / 4.2, FLOORS);
  const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, bodyH, D - 0.8), [M.windows, M.windows, M.plaster, M.plaster, M.facadeGlass, M.windows]);
  body.position.set(0, FH + bodyH / 2, 0); body.castShadow = body.receiveShadow = true; ext.add(body);
  // slab bands
  for (let i = 1; i <= FLOORS + 1; i++) box(ext, M.white, W + 0.6, 0.38, D + 0.6, 0, i * FH, 0, { round: 0.15 });
  // roof: parapet, pergola, garden, crown sign
  const roofY = (FLOORS + 1) * FH;
  box(ext, M.white, W + 0.6, 1.1, 0.3, 0, roofY + 0.55, D / 2 + 0.15);
  box(ext, M.white, W + 0.6, 1.1, 0.3, 0, roofY + 0.55, -D / 2 - 0.15);
  for (let i = 0; i < 14; i++) box(ext, M.wood, 0.25, 0.3, 9, -13 + i * 2, roofY + 3.2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(ext, M.charcoal, 0.35, 3.2, 0.35, sx * 13, roofY + 1.6, sz * 4.2);
  box(ext, M.charcoal, 6, 2.6, 4, 15, roofY + 1.3, -3);
  for (let i = 0; i < 10; i++) bush(ext, -19 + i * 4.2, roofY + 0.5, -6, 0.9);
  const crown = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTex('SIGNIFA'), transparent: true }));
  crown.position.set(0, roofY + 0.4, D / 2 + 0.32); ext.add(crown);

  // front balcony pods: rounded frames (like the reference), glass rails, planters
  const podW = 7.8, podH = FH, rad = 1.0, th = 0.28, depth = 2.1;
  const outer = new THREE.Shape();
  const rr = (s, w, h, r) => {
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  };
  rr(outer, podW, podH, rad);
  const hole = new THREE.Path(); rr(hole, podW - th * 2, podH - th * 2, rad - th);
  outer.holes.push(hole);
  const podGeo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  const count = 5 * FLOORS;
  const pods = new THREE.InstancedMesh(podGeo, M.white, count);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(podW - 0.7, 1.05, 0.04), M.glass, count);
  const planters = new THREE.InstancedMesh(new THREE.BoxGeometry(podW - 0.8, 0.5, 0.55), M.charcoal, count);
  const shrubs = new THREE.InstancedMesh(blobGeo, M.leaf, count * 6);
  const vines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.6, 0.25), M.leaf2, count);
  pods.castShadow = planters.castShadow = shrubs.castShadow = true; pods.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let n = 0, sn = 0;
  for (let f = 1; f <= FLOORS; f++) for (let b = 0; b < 5; b++) {
    const x = (b - 2) * 8.4 + (f % 2 ? 0.0 : 0.0), y = f * FH + FH / 2 + 0.19, z = D / 2 - 0.45;
    mtx.compose(p.set(x, y, z), q.identity(), sc.set(1, 1, 1)); pods.setMatrixAt(n, mtx);
    mtx.compose(p.set(x, f * FH + 0.75, z + depth - 0.05), q, sc); rails.setMatrixAt(n, mtx);
    mtx.compose(p.set(x, f * FH + 0.45, z + depth - 0.4), q, sc); planters.setMatrixAt(n, mtx);
    mtx.compose(p.set(x + (b % 2 ? 3.2 : -3.2), f * FH + 0.2, z + depth + 0.05), q, sc); vines.setMatrixAt(n, mtx);
    for (let k = 0; k < 6; k++) {
      mtx.compose(p.set(x - 3.2 + k * 1.28 + (rand() - 0.5) * 0.4, f * FH + 0.85, z + depth - 0.4), q, sc.setScalar(0.38 + rand() * 0.2));
      shrubs.setMatrixAt(sn++, mtx); sc.set(1, 1, 1);
    }
    n++;
  }
  ext.add(pods, rails, planters, shrubs, vines);
  // timber fins between pods
  for (let i = -3; i <= 3; i += 2) box(ext, M.wood, 0.35, bodyH, 0.7, i * 4.2, FH + bodyH / 2, D / 2 - 0.1);

  // driveway palms, trees, street lamps
  for (let z = 18; z <= 46; z += 7) { palm(ext, -6.5, z, 8 + rand() * 2, -0.7); palm(ext, 6.5, z + 3, 8 + rand() * 2, 0.7); }
  [[-30, 20], [-22, 32], [-36, 34], [26, 32], [36, 20], [-40, -18], [40, -18], [-12, -20], [12, -20], [0, -22]].forEach(([x, z]) => tree(ext, x, z, 1.2 + rand() * 0.5));
  for (let i = 0; i < 18; i++) bush(ext, -21 + i * 2.5, 0.45, 9.6, 0.6);

  // swimming pool + deck (amenities side)
  box(ext, M.stone, 20, 0.3, 12, 33, 0.15, 3);
  box(ext, M.water, 16, 0.08, 7, 33, 0.32, 3, { cast: false });
  for (let i = 0; i < 4; i++) box(ext, M.linen, 0.8, 0.3, 1.9, 26.5 + i * 2.2, 0.5, 8.1, { round: 0.1 });
  palm(ext, 43, 6, 9, 0.6); palm(ext, 43, -1, 10, 0.9);
}

/* street + garden lamps (only bright at night) */
const extLamps = [];
for (const [x, z] of [[-4, 22], [4, 30], [-4, 38], [4, 46], [0, 15]]) {
  cyl(ext, M.charcoal, 0.06, 0.08, 3.4, x, 1.7, z, 8);
  box(ext, M.lampGlow, 0.4, 0.25, 0.4, x, 3.45, z, { cast: false });
  const l = new THREE.PointLight(0xFFB868, 0, 18, 1.8); l.position.set(x, 3.2, z); ext.add(l); extLamps.push(l);
}

/* the city around both sites */
function city(parent, cx, cz, rMin, rMax, nB, baseY = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(g, M.city, nB);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
  for (let i = 0; i < nB; i++) {
    const a = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin);
    const w = 12 + rand() * 18, d = 12 + rand() * 18, h = 10 + rand() * 34;
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(new THREE.Vector3(cx + Math.cos(a) * r, baseY + h / 2, cz + Math.sin(a) * r), qq, new THREE.Vector3(w, h, d));
    inst.setMatrixAt(i, m4);
  }
  inst.receiveShadow = true; parent.add(inst);
}
M.city.map = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#E4DED4'; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = '#A9B3B9'; g.fillRect(c * 64 + 12, r * 64 + 16, 40, 34); } }, true); M.city.map.repeat.set(3, 6); M.city.map.needsUpdate = true;
M.city.emissiveMap = windowGlow.clone(); M.city.emissiveMap.repeat.set(3, 6); M.city.emissiveMap.needsUpdate = true;
city(ext, 0, 0, 190, 380, 55);

/* =====================================================================
   THE 3 BHK  (local coordinates: x 0..15, z 0..12; z=0 is the view side,
   z=12 is the corridor with the front door; floor at y=0, ceiling 3.0)
   ===================================================================== */
const WH = 3.0;
const ROOMS = {
  balcony: { x: [4.5, 10.5], z: [-0.1, 1.6], name: 'Balcony', floor: 'outdoor' },
  living:  { x: [4.5, 10.5], z: [1.6, 7], name: 'Living room' },
  dining:  { x: [4.5, 10.5], z: [7, 10], name: 'Dining' },
  foyer:   { x: [4.5, 7], z: [10, 12], name: 'Foyer' },
  kitchen: { x: [10.5, 15], z: [7, 12], name: 'Kitchen' },
  master:  { x: [0, 4.5], z: [0, 5], name: 'Master bedroom' },
  mbath:   { x: [0, 2.4], z: [5, 7.6], name: 'Bath', floor: 'bath' },
  ward:    { x: [2.4, 4.5], z: [5, 7.6], name: 'Wardrobe' },
  bed2:    { x: [10.5, 15], z: [0, 4.5], name: 'Bedroom 2' },
  pass:    { x: [10.5, 12.5], z: [4.5, 7], name: '' },
  bath2:   { x: [12.5, 15], z: [4.5, 7], name: 'Bath', floor: 'bath' },
  bed3:    { x: [0, 4.5], z: [7.6, 12], name: 'Bedroom 3' },
  cbath:   { x: [7, 9.5], z: [10, 12], name: 'Bath', floor: 'bath' },
  store:   { x: [9.5, 10.5], z: [10, 12], name: '' },
};
const ftIn = (m) => { const t = Math.round(m * 39.37); return `${Math.floor(t / 12)}'${t % 12}"`; };
for (const r of Object.values(ROOMS)) { r.w = r.x[1] - r.x[0]; r.d = r.z[1] - r.z[0]; r.size = `${ftIn(r.w)} × ${ftIn(r.d)}`; }

const interiorLights = [];
{
  // floors
  for (const [key, r] of Object.entries(ROOMS)) {
    const mat = r.floor === 'bath' ? M.bathFloor.clone() : r.floor === 'outdoor' ? M.woodDark.clone() : M.floor.clone();
    if (mat.map) { mat.map = mat.map.clone(); mat.map.needsUpdate = true; mat.map.repeat.set(r.w / (r.floor === 'bath' ? 1.2 : 1.6), r.d / (r.floor === 'bath' ? 1.2 : 1.6)); }
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), mat);
    f.rotation.x = -Math.PI / 2; f.position.set((r.x[0] + r.x[1]) / 2, 0.001, (r.z[0] + r.z[1]) / 2);
    f.receiveShadow = true; flat.add(f);
  }
  box(flat, M.white, 15.8, 0.35, 12.8, 7.5, -0.18, 6);                       // slab
  box(flat, M.white, 6.4, 0.3, 1.9, 7.5, -0.2, 0.7);                          // balcony slab lip
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 12.4), M.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(7.5, WH, 6.1); flat.add(ceil);
  box(flat, M.white, 15.8, 0.3, 12.8, 7.5, WH + 0.15, 6, { cast: true });
  // balcony ceiling overhang
  box(flat, M.white, 6.4, 0.3, 1.9, 7.5, WH + 0.15, 0.7);

  // walls -------------------------------------------------------------
  const T_EXT = 0.23, T_INT = 0.12;
  function wall(x1, z1, x2, z2, t, ops = [], mat = M.wall) {
    const horiz = z1 === z2, start = horiz ? x1 : z1, len = (horiz ? x2 : z2) - start;
    const seg = (a, b, y0, y1, m = mat) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      const mid = start + (a + b) / 2, l = b - a, h = y1 - y0;
      if (horiz) box(flat, m, l, h, t, mid, y0 + h / 2, z1); else box(flat, m, t, h, l, x1, y0 + h / 2, mid);
    };
    let cur = 0;
    for (const o of ops.sort((a, b) => a.c - b.c)) {
      const a = o.c - start - o.w / 2, b = o.c - start + o.w / 2;
      const top = o.top ?? (o.type === 'win' ? 2.4 : 2.2), sill = o.sill ?? (o.type === 'win' ? 0.75 : 0);
      seg(cur, a, 0, WH); seg(a, b, top, WH); if (sill > 0) seg(a, b, 0, sill);
      const mid = o.c, l = o.w, h = top - sill, yc = sill + h / 2;
      if (o.type === 'win' || o.type === 'slider') {
        const panes = o.type === 'slider' ? 3 : 2;
        for (let i = 0; i < panes; i++) {
          const pw = l / panes, pc = mid - l / 2 + pw * (i + 0.5);
          if (o.type === 'slider' && i === 1) continue;                  // middle panel slid open
          if (horiz) { box(flat, M.glass, pw - 0.04, h - 0.06, 0.02, pc, yc, z1, { cast: false }); box(flat, M.frame, 0.05, h, t * 0.6, pc - pw / 2, yc, z1); }
          else { box(flat, M.glass, 0.02, h - 0.06, pw - 0.04, x1, yc, pc, { cast: false }); box(flat, M.frame, t * 0.6, h, 0.05, x1, yc, pc - pw / 2); }
        }
        if (horiz) { box(flat, M.frame, l, 0.06, t * 0.7, mid, sill + 0.03, z1); box(flat, M.frame, l, 0.06, t * 0.7, mid, top - 0.03, z1); }
        else { box(flat, M.frame, t * 0.7, 0.06, l, x1, sill + 0.03, mid); box(flat, M.frame, t * 0.7, 0.06, l, x1, top - 0.03, mid); }
      } else if (o.type === 'door' && o.leaf !== false) {
        // interior door, left ajar so rooms read as open
        const piv = new THREE.Group();
        const hinge = horiz ? new THREE.Vector3(mid - l / 2, 0, z1) : new THREE.Vector3(x1, 0, mid - l / 2);
        piv.position.copy(hinge); flat.add(piv);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(horiz ? l - 0.04 : 0.04, top - 0.02, horiz ? 0.04 : l - 0.04), M.door);
        leaf.position.set(horiz ? l / 2 : 0, (top - 0.02) / 2, horiz ? 0 : l / 2); leaf.castShadow = true;
        piv.add(leaf); piv.rotation.y = (o.swing ?? 1) * D2R(80);
      }
      cur = b;
    }
    seg(cur, len, 0, WH);
  }
  // exterior
  wall(0, 0, 4.5, 0, T_EXT, [{ c: 2.25, w: 2.6, type: 'win', sill: 0.45 }]);
  wall(10.5, 0, 15, 0, T_EXT, [{ c: 12.75, w: 2.6, type: 'win', sill: 0.45 }]);
  wall(0, 0, 0, 12, T_EXT, [{ c: 6.3, w: 0.8, type: 'win', sill: 1.6, top: 2.2 }, { c: 10.2, w: 1.6, type: 'win' }]);
  wall(15, 0, 15, 12, T_EXT, [{ c: 2.2, w: 1.5, type: 'win' }, { c: 5.75, w: 0.8, type: 'win', sill: 1.6, top: 2.2 }, { c: 9.6, w: 1.6, type: 'win', sill: 1.1 }]);
  wall(0, 12, 15, 12, T_EXT, [{ c: 5.75, w: 1.1, type: 'door', leaf: false, top: 2.25 }, { c: 13.5, w: 0.9, type: 'win', sill: 1.5, top: 2.2 }]);
  wall(4.5, 1.6, 10.5, 1.6, 0.1, [{ c: 7.5, w: 5.8, type: 'slider', sill: 0, top: 2.5 }]);
  // interior
  wall(4.5, 0, 4.5, 12, T_INT, [{ c: 4.35, w: 0.9, type: 'door', swing: -1 }, { c: 8.65, w: 0.9, type: 'door', swing: -1 }]);
  wall(0, 5, 4.5, 5, T_INT, [{ c: 1.2, w: 0.75, type: 'door' }, { c: 3.45, w: 1.0, type: 'door', leaf: false }]);
  wall(2.4, 5, 2.4, 7.6, T_INT);
  wall(0, 7.6, 4.5, 7.6, T_INT);
  wall(10.5, 0, 10.5, 4.5, T_INT, [], M.wallSage);
  wall(10.5, 4.5, 15, 4.5, T_INT, [{ c: 11.5, w: 0.9, type: 'door', swing: -1 }]);
  wall(12.5, 4.5, 12.5, 7, T_INT, [{ c: 5.75, w: 0.75, type: 'door' }]);
  wall(10.5, 7, 15, 7, T_INT, [{ c: 11.5, w: 1.6, type: 'door', leaf: false }]);
  wall(10.5, 7, 10.5, 12, T_INT, [{ c: 8.6, w: 1.4, type: 'door', leaf: false }]);
  wall(7, 10, 7, 12, T_INT);
  wall(7, 10, 10.5, 10, T_INT, [{ c: 8.25, w: 0.75, type: 'door' }, { c: 10, w: 0.7, type: 'door' }]);
  wall(9.5, 10, 9.5, 12, T_INT);

  // main teak door (animated) -------------------------------------------
  const mainPivot = new THREE.Group();
  mainPivot.position.set(5.75 - 0.55, 0, 12); flat.add(mainPivot);
  const md = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.22, 0.06), M.teak); md.position.set(0.54, 1.11, 0); md.castShadow = true; mainPivot.add(md);
  box(mainPivot, M.chrome, 0.04, 0.5, 0.06, 0.95, 1.05, 0.06);
  for (let i = 0; i < 4; i++) box(mainPivot, M.woodDark, 0.9, 0.03, 0.02, 0.54, 0.5 + i * 0.45, 0.04, { cast: false });
  box(flat, M.frame, 1.3, 0.1, 0.3, 5.75, 2.3, 12);
  // corridor outside the door
  box(flat, M.stone, 6, 0.02, 3, 5.75, 0.01, 13.6, { cast: false });
  box(flat, M.wall, 6, WH, 0.15, 5.75, WH / 2, 15.1);
  box(flat, M.wall, 0.15, WH, 3, 2.75, WH / 2, 13.6);
  box(flat, M.wall, 0.15, WH, 3, 8.75, WH / 2, 13.6);
  box(flat, M.ceiling, 6, 0.05, 3, 5.75, WH, 13.6, { cast: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: signTex('504', ''), transparent: true }));
  plate.position.set(6.55, 1.75, 12.13); flat.add(plate);
  plant(flat, 4.0, 13.2, 1.1);
  flat.userData.mainDoor = mainPivot;

  /* ---------- furniture ---------- */
  // LIVING
  box(flat, M.rug, 3.4, 0.02, 2.6, 7.4, 0.01, 4.3, { cast: false });
  const sofa = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; flat.add(g);
    box(g, M.fabric, 2.6, 0.42, 0.95, 0, 0.21, 0, { round: 0.06 });
    box(g, M.fabric, 2.6, 0.5, 0.22, 0, 0.62, -0.38, { round: 0.08 });
    box(g, M.fabric, 0.2, 0.3, 0.95, -1.2, 0.55, 0, { round: 0.06 }); box(g, M.fabric, 0.2, 0.3, 0.95, 1.2, 0.55, 0, { round: 0.06 });
    box(g, M.fabricRust, 0.45, 0.4, 0.14, -0.7, 0.62, -0.22, { round: 0.06 }); box(g, M.fabricSage, 0.45, 0.4, 0.14, 0.75, 0.62, -0.22, { round: 0.06 });
    return g;
  };
  sofa(5.3, 4.3, Math.PI / 2);                                   // faces +x towards the TV
  const ls = sofa(7.0, 6.35, Math.PI); ls.scale.set(0.7, 1, 1);  // second sofa, back to the dining
  cyl(flat, M.woodDark, 0.6, 0.6, 0.06, 7.3, 0.4, 4.3, 32); cyl(flat, M.black, 0.05, 0.05, 0.38, 7.3, 0.19, 4.3, 8);
  box(flat, M.ceramic, 0.25, 0.18, 0.25, 7.2, 0.52, 4.2, { round: 0.06 });
  // TV wall with timber panelling
  box(flat, M.wood, 0.05, 2.6, 3.0, 10.42, 1.3, 4.3);
  box(flat, M.cabinet, 0.45, 0.4, 2.4, 10.15, 0.25, 4.3, { round: 0.03 });
  box(flat, M.screen, 0.05, 0.95, 1.65, 10.36, 1.45, 4.3);
  plant(flat, 10.0, 2.3, 1.3); plant(flat, 4.95, 2.05, 1.6);
  // floor lamp
  cyl(flat, M.black, 0.02, 0.02, 1.6, 5.1, 0.8, 6.1, 6); cyl(flat, M.lampGlow, 0.18, 0.25, 0.3, 5.1, 1.65, 6.1, 18);
  // art
  const art1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshStandardMaterial({ map: artTex('#E8C9A0', '#B86A45', '#F5EEDC') }));
  art1.position.set(4.58, 1.6, 2.6); art1.rotation.y = Math.PI / 2; flat.add(art1);
  // curtains
  for (const x of [4.75, 10.25]) box(flat, M.linen, 0.35, 2.6, 0.12, x, 1.35, 1.75, { round: 0.05 });
  // cove light over living
  box(flat, M.cove, 5.6, 0.03, 0.08, 7.5, WH - 0.05, 1.9, { cast: false });

  // BALCONY
  box(flat, M.glass, 6.0, 1.05, 0.03, 7.5, 0.55, -0.05, { cast: false });
  box(flat, M.chrome, 6.0, 0.05, 0.06, 7.5, 1.08, -0.05);
  box(flat, M.charcoal, 1.4, 0.45, 0.45, 5.3, 0.22, 0.3); bush(flat, 5.3, 0.6, 0.3, 0.35);
  box(flat, M.charcoal, 1.4, 0.45, 0.45, 9.7, 0.22, 0.3); bush(flat, 9.7, 0.6, 0.3, 0.35, M.leaf);
  for (const x of [6.7, 8.3]) { box(flat, M.wood, 0.6, 0.06, 0.6, x, 0.42, 0.8); box(flat, M.fabricSage, 0.55, 0.12, 0.55, x, 0.5, 0.8, { round: 0.04 }); box(flat, M.wood, 0.6, 0.45, 0.06, x, 0.75, 1.07); }
  cyl(flat, M.ceramic, 0.25, 0.25, 0.04, 7.5, 0.5, 0.75, 20); cyl(flat, M.black, 0.03, 0.03, 0.48, 7.5, 0.24, 0.75, 6);

  // DINING
  box(flat, M.woodDark, 2.0, 0.06, 1.0, 7.6, 0.76, 8.5);
  for (const [x, z] of [[6.85, 8.5], [8.35, 8.5]]) box(flat, M.black, 0.08, 0.73, 0.8, x, 0.37, z);
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; flat.add(g);
    box(g, M.fabric, 0.46, 0.08, 0.46, 0, 0.46, 0, { round: 0.03 }); box(g, M.fabric, 0.46, 0.45, 0.06, 0, 0.72, -0.21, { round: 0.03 });
    for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(g, M.black, 0.03, 0.44, 0.03, a, 0.22, b);
  };
  [6.9, 7.6, 8.3].forEach((x) => { chair(x, 7.8, 0); chair(x, 9.2, Math.PI); });
  chair(6.4, 8.5, Math.PI / 2); chair(8.8, 8.5, -Math.PI / 2);
  for (const x of [7.1, 8.1]) { cyl(flat, M.black, 0.005, 0.005, 1.1, x, WH - 0.55, 8.5, 4); cyl(flat, M.lampGlow, 0.05, 0.22, 0.22, x, WH - 1.2, 8.5, 20); }
  const art2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshStandardMaterial({ map: artTex('#8FA388', '#2F4E73', '#E9CE8E') }));
  art2.position.set(4.58, 1.6, 9.55); art2.rotation.y = Math.PI / 2; flat.add(art2);

  // KITCHEN: L counter, upper cabinets, fridge, hob, chimney
  box(flat, M.cabinet, 0.6, 0.86, 4.6, 14.6, 0.43, 9.5);
  box(flat, M.granite, 0.64, 0.04, 4.6, 14.58, 0.88, 9.5);
  box(flat, M.cabinet, 3.2, 0.86, 0.6, 12.9, 0.43, 11.6);
  box(flat, M.granite, 3.2, 0.04, 0.64, 12.9, 0.88, 11.58);
  box(flat, M.wood, 0.36, 0.7, 4.6, 14.78, 2.1, 9.5);
  box(flat, M.wood, 3.2, 0.7, 0.36, 12.9, 2.1, 11.78);
  box(flat, M.black, 0.5, 0.02, 0.7, 14.58, 0.91, 8.6);
  for (const [dx, dz] of [[-0.1, -0.15], [0.1, 0.15], [-0.1, 0.15], [0.1, -0.15]]) cyl(flat, M.black, 0.08, 0.08, 0.02, 14.58 + dx, 0.93, 8.6 + dz, 14);
  box(flat, M.chrome, 0.5, 0.5, 0.8, 14.65, 1.75, 8.6);
  box(flat, M.chrome, 0.42, 0.06, 0.6, 14.58, 0.9, 10.6);
  box(flat, M.chrome, 0.72, 1.85, 0.7, 11.0, 0.93, 11.6, { round: 0.03 });
  box(flat, M.cove, 0.04, 0.03, 4.4, 14.4, 1.73, 9.5, { cast: false });
  plant(flat, 10.9, 7.4, 0.9);

  // MASTER BEDROOM
  const bed = (x, z, ry, w, cover) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; flat.add(g);
    box(g, M.woodDark, w + 0.1, 0.3, 2.15, 0, 0.15, 1.08);
    box(g, M.linen, w, 0.22, 2.0, 0, 0.41, 1.05, { round: 0.08 });
    box(g, cover, w + 0.04, 0.08, 1.3, 0, 0.53, 1.45, { round: 0.04 });
    box(g, M.linen, w * 0.4, 0.14, 0.4, -w * 0.25, 0.6, 0.3, { round: 0.07 }); box(g, M.linen, w * 0.4, 0.14, 0.4, w * 0.25, 0.6, 0.3, { round: 0.07 });
    box(g, M.fabric, w + 0.5, 1.15, 0.12, 0, 0.75, 0.03, { round: 0.05 });
    for (const s of [-1, 1]) {
      box(g, M.woodDark, 0.5, 0.5, 0.42, s * (w / 2 + 0.4), 0.25, 0.25);
      cyl(g, M.lampGlow, 0.11, 0.14, 0.22, s * (w / 2 + 0.4), 0.72, 0.25, 16);
    }
    return g;
  };
  bed(0.12, 2.6, Math.PI / 2, 1.9, M.fabricDk);               // headboard on the left wall
  box(flat, M.wallSage, 0.03, 2.6, 3.4, 0.13, 1.3, 2.6);
  box(flat, M.rug, 2.4, 0.02, 2.8, 2.2, 0.01, 2.6, { cast: false });
  box(flat, M.woodDark, 0.45, 0.8, 1.4, 4.2, 0.4, 1.6);
  const mirrorM = box(flat, M.mirror, 0.03, 1.0, 0.7, 4.38, 1.45, 1.6); mirrorM.castShadow = false;
  box(flat, M.fabricRust, 0.75, 0.42, 0.75, 3.2, 0.21, 0.75, { round: 0.12 }); box(flat, M.fabricRust, 0.75, 0.45, 0.15, 3.2, 0.62, 0.42, { round: 0.06 });
  plant(flat, 0.45, 0.45, 1.2);
  // walk-in wardrobe shelving + master bath
  box(flat, M.wood, 2.0, 2.4, 0.55, 3.45, 1.2, 7.28);
  box(flat, M.ceramic, 0.5, 0.4, 0.65, 0.35, 0.2, 7.2, { round: 0.12 });
  box(flat, M.cabinet, 1.0, 0.5, 0.5, 1.3, 0.55, 7.32); box(flat, M.mirror, 0.9, 0.8, 0.02, 1.3, 1.5, 7.55, { cast: false });
  box(flat, M.glass, 0.02, 2.0, 1.1, 1.6, 1.0, 5.65, { cast: false });

  // BEDROOM 2 (headboard on the wall it shares with the passage)
  bed(13.6, 4.44, Math.PI, 1.6, M.fabricSage);
  box(flat, M.wood, 0.62, 2.4, 2.2, 10.85, 1.2, 2.2);
  box(flat, M.woodDark, 1.1, 0.05, 0.55, 14.6 - 0.2, 0.75, 0.45);
  chair(13.8, 0.95, 0);
  const art3 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ map: artTex('#F3D9B8', '#8B5A2B', '#3F7A31') }));
  art3.position.set(14.88, 1.6, 3.2); art3.rotation.y = -Math.PI / 2; flat.add(art3);
  box(flat, M.rug, 1.8, 0.02, 1.4, 13.5, 0.01, 1.7, { cast: false });
  // bath 2
  box(flat, M.ceramic, 0.5, 0.4, 0.65, 14.6, 0.2, 6.6, { round: 0.12 });
  box(flat, M.cabinet, 0.5, 0.5, 0.9, 14.7, 0.55, 5.2); box(flat, M.mirror, 0.02, 0.8, 0.8, 14.88, 1.5, 5.2, { cast: false });

  // BEDROOM 3 / study
  bed(2.1, 11.88, Math.PI, 1.5, M.fabricRust);
  box(flat, M.wallClay, 3.0, 2.6, 0.03, 2.1, 1.3, 11.86);
  box(flat, M.woodDark, 0.6, 0.05, 1.4, 0.4, 0.75, 8.7); box(flat, M.woodDark, 0.6, 0.72, 0.04, 0.4, 0.37, 8.05); box(flat, M.woodDark, 0.6, 0.72, 0.04, 0.4, 0.37, 9.35);
  box(flat, M.screen, 0.04, 0.35, 0.55, 0.2, 1.0, 8.7);
  chair(1.0, 8.7, -Math.PI / 2);
  box(flat, M.wood, 2.0, 2.3, 0.6, 2.2, 1.15, 7.95);
  plant(flat, 4.05, 11.5, 1.0);
  // common bath + foyer console
  box(flat, M.ceramic, 0.5, 0.4, 0.65, 9.1, 0.2, 11.6, { round: 0.12 });
  box(flat, M.cabinet, 0.9, 0.5, 0.5, 7.7, 0.55, 11.7); box(flat, M.mirror, 0.8, 0.8, 0.02, 7.7, 1.5, 11.92, { cast: false });
  box(flat, M.woodDark, 0.4, 0.8, 1.4, 4.78, 0.4, 11.0);
  box(flat, M.mirror, 0.02, 1.0, 0.9, 4.58, 1.55, 11.0, { cast: false });

  // downlights + room lights (warm). Intensity set by time of day.
  const roomsLit = [['living', 7.5, 4.3], ['dining', 7.6, 8.5], ['kitchen', 12.8, 9.4], ['master', 2.3, 2.6], ['bed2', 12.8, 2.2], ['bed3', 2.2, 9.8], ['foyer', 5.75, 13.4]];
  for (const [, x, z] of roomsLit) {
    const l = new THREE.PointLight(0xFFD2A0, 0, 9, 1.6); l.position.set(x, WH - 0.35, z); flat.add(l); interiorLights.push(l);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(flat, M.lampGlow, 0.06, 0.06, 0.02, x + dx * 1.1, WH - 0.01, z + dz * 1.0, 12);
  }

  // what you see from the balcony: a garden and the city
  const park = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ color: 0x8FA772, roughness: 1 }));
  park.rotation.x = -Math.PI / 2; park.position.set(7.5, -15.75, -20); flat.add(park);
  for (let i = 0; i < 26; i++) tree(flat, -30 + rand() * 75, -10 - rand() * 60, 1.6 + rand());
  box(flat, M.water, 26, 0.1, 10, 9, -15.6, -24, { cast: false });
  // the tower's own facade around this flat
  box(flat, M.white, 34, 0.38, 2.4, 7.5, -0.2, -0.6);
  box(flat, M.white, 34, 0.38, 2.4, 7.5, WH + 0.2, -0.6);
}
city(flat, 7.5, -20, 90, 260, 60, -15.75);
flat.traverse((o) => { if (o.isMesh && o.material === M.glass) o.renderOrder = 2; });

/* =====================================================================
   SKY AND SUN (same rules as before: the CSS sky and the 3D light move together)
   ===================================================================== */
const hemi = new THREE.HemisphereLight(0xDDE7F2, 0xB9AE98, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xFFF1D6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const DAY = [
  [6.0,  '#7E9CC6', '#F8C79A', 'rgba(255,186,120,.75)', 0xF2B266, 2.4, 0.34, 0.3],
  [9.0,  '#5E9BE0', '#E6EEF2', 'rgba(255,236,200,.40)', 0xFFEACB, 3.8, 0.48, 0],
  [12.0, '#4E92E0', '#DCEBF6', 'rgba(255,250,235,.30)', 0xFFF6E8, 4.3, 0.55, 0],
  [15.5, '#5E9BDC', '#F2DDBF', 'rgba(255,214,160,.50)', 0xFFE2B8, 4.0, 0.50, 0],
  [16.9, '#6FA3D8', '#F7C08C', 'rgba(255,168,96,.75)',  0xFFB566, 3.6, 0.44, 0],
  [17.8, '#58739F', '#F39A62', 'rgba(255,128,70,.70)',  0xF59450, 2.4, 0.34, 0.25],
  [18.6, '#28325C', '#B9675A', 'rgba(220,110,80,.45)',  0xC0704A, 0.8, 0.22, 0.75],
  [19.6, '#0E1736', '#2C2E5C', 'rgba(120,110,200,.25)', 0x8090C0, 0.18, 0.16, 1],
  [21.0, '#09112C', '#1B2249', 'rgba(90,90,180,.20)',   0x8090C0, 0.12, 0.13, 1],
];
const NOTES = [
  [7, 'Sunrise. Soft east light reaches the bedrooms first.'],
  [10, 'Morning. Bright light across the living room floor.'],
  [14, 'Midday. Deep balconies keep the rooms cool.'],
  [16.4, 'Afternoon. The garden falls into shade.'],
  [17.7, 'Golden hour. Warm light pours through the balcony doors.'],
  [18.6, 'Sunset. The sky turns coral over the city.'],
  [21.1, 'Evening. Lights on, the whole home glows.'],
];
const cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
const lerpHex = (a, b, k) => '#' + cA.set(a).lerp(cB.set(b), k).getHexString();
const lerpRgba = (a, b, k) => {
  const pa = a.match(/[\d.]+/g).map(Number), pb = b.match(/[\d.]+/g).map(Number);
  const pp = pa.map((x, i) => x + (pb[i] - x) * k);
  return `rgba(${pp[0] | 0},${pp[1] | 0},${pp[2] | 0},${pp[3].toFixed(3)})`;
};
const fmtTime = (h) => { let H = Math.floor(h), Mi = Math.round(((h - H) * 60) / 5) * 5; if (Mi === 60) { H++; Mi = 0; } return `${((H + 11) % 12) + 1}:${String(Mi).padStart(2, '0')} ${H >= 12 ? 'pm' : 'am'}`; };
const sunNote = $('#sunNote');
let night = 0, hour = 16.9, lastNote = '', sunAz = 0, sunEl = 0;

function setSun(h) {
  hour = h;
  const t = THREE.MathUtils.clamp((h - 6) / 12, 0, 1);
  sunAz = t * Math.PI;
  sunEl = Math.max(Math.sin(t * Math.PI) * D2R(66), D2R(7));
  let i = 0; while (i < DAY.length - 2 && h > DAY[i + 1][0]) i++;
  const a = DAY[i], b = DAY[i + 1], k = THREE.MathUtils.clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const top = lerpHex(a[1], b[1], k), bot = lerpHex(a[2], b[2], k);
  root.setProperty('--sky-top', top); root.setProperty('--sky-bot', bot);
  root.setProperty('--sun-glow', lerpRgba(a[3], b[3], k));
  root.setProperty('--sun-x', `${92 - t * 84}%`);
  sun.color.copy(cA.set(a[4]).lerp(cB.set(b[4]), k));
  sun.intensity = THREE.MathUtils.lerp(a[5], b[5], k);
  hemi.intensity = THREE.MathUtils.lerp(a[6], b[6], k);
  night = THREE.MathUtils.lerp(a[7], b[7], k);
  const golden = THREE.MathUtils.clamp(1 - Math.abs(h - 17.1) / 1.6, 0, 1);
  root.setProperty('--cloud', (0.9 - night * 0.75).toFixed(2));
  root.setProperty('--cloud-warm', golden.toFixed(2));
  hemi.color.set(0xDDE7F2).lerp(tmp.set(0x5E6AA8), night);
  scene.environmentIntensity = 0.6 - night * 0.45;
  scene.fog.color.set(bot);

  M.windows.emissiveIntensity = night * 1.4;
  M.city.emissiveIntensity = night * 1.2;
  M.facadeGlass.emissiveIntensity = 0.1 + night * 0.9;
  M.water.emissiveIntensity = 0.08 + night * 0.8;
  M.lampGlow.emissiveIntensity = 0.6 + night * 1.6;
  M.cove.emissiveIntensity = 0.3 + night * 1.6;
  extLamps.forEach((l) => (l.intensity = night * 120));
  interiorLights.forEach((l) => (l.intensity = 4 + night * 22 + golden * 3));

  document.body.dataset.light = h >= 19 ? 'night' : h >= 17.9 ? 'dusk' : 'day';
  const note = NOTES.find(([tt]) => h < tt)?.[1] || NOTES[NOTES.length - 1][1];
  if (note !== lastNote && sunNote) { lastNote = note; sunNote.classList.remove('swap'); void sunNote.offsetWidth; sunNote.textContent = note; sunNote.classList.add('swap'); }
  const label = fmtTime(h); sunOut.textContent = label; sunInput.setAttribute('aria-valuetext', label);
  placeSun(); dirty = true;
}

let space = 'ext';
function placeSun() {
  if (space === 'ext') {
    sun.target.position.set(0, 10, 4);
    sun.position.set(Math.cos(sunAz) * Math.cos(sunEl) * 140, Math.sin(sunEl) * 140 + 10, 0.55 * Math.cos(sunEl) * 140 + 60);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  } else {
    // inside: light comes in through the balcony side (-z)
    const c = FLAT_ORIGIN.clone().add(new THREE.Vector3(7.5, 0, 6));
    sun.target.position.copy(c);
    sun.position.set(c.x + Math.cos(sunAz) * 40, c.y + Math.sin(sunEl) * 45 + 6, c.z - 45);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 160 });
  }
  sun.shadow.camera.updateProjectionMatrix();
}

/* =====================================================================
   THE TOUR: camera stops keyed by slide id
   ext stops in world space, int stops in flat-local space
   ===================================================================== */
const STOPS = {
  's-hero':    { space: 'ext', p: [52, 26, 82], l: [-17, 11, 4] },
  's-arrive':  { space: 'ext', p: [7, 1.75, 58], l: [0, 6, 10] },
  's-lobby':   { space: 'ext', p: [-3.5, 1.7, 21], l: [0, 2.2, 8], via: [[2, 1.7, 36]] },
  's-door':    { space: 'int', p: [5.75, 1.62, 14.6], l: [5.75, 1.4, 10.5] },
  's-living':  { space: 'int', p: [9.4, 1.6, 6.6], l: [5.6, 1.0, 2.6], via: [[5.75, 1.62, 11.0]] },
  's-balcony': { space: 'int', p: [7.5, 1.55, 1.15], l: [7.5, 0.4, -14] },
  's-dining':  { space: 'int', p: [6.0, 1.6, 9.6], l: [13.5, 1.0, 9.6], via: [[7.5, 1.6, 5.0]] },
  's-master':  { space: 'int', p: [3.9, 1.6, 4.6], l: [0.8, 0.7, 2.0], via: [[5.4, 1.6, 4.35]] },
  's-bed2':    { space: 'int', p: [11.2, 1.6, 0.8], l: [14.0, 0.7, 3.6], via: [[5.4, 1.6, 4.35], [11.5, 1.6, 5.6], [11.5, 1.6, 4.0]] },
  's-bed3':    { space: 'int', p: [3.7, 1.6, 8.3], l: [1.2, 0.7, 10.8], via: [[11.5, 1.6, 4.0], [11.5, 1.6, 5.8], [5.4, 1.6, 8.65]] },
};
const toWorld = (s, v) => (s === 'int' ? new THREE.Vector3(...v).add(FLAT_ORIGIN) : new THREE.Vector3(...v));
const stops = slides.map((s) => {
  const d = STOPS[s.id];
  return { id: s.id, space: d.space, P: toWorld(d.space, d.p), L: toWorld(d.space, d.l), via: (d.via || []).map((v) => toWorld(d.space, v)), room: s.dataset.room };
});

let centers = [];
const measure = () => { centers = slides.map((s) => s.offsetTop + s.offsetHeight / 2 - innerHeight / 2); };
const smooth = (x) => x * x * (3 - 2 * x);
let seg = 0, segK = 0, activeIdx = 0, canvasVisible = true, dirty = true;
const progressBar = $('#progressBar');

function readScroll() {
  const y = scrollY;
  let i = 0; while (i < centers.length - 2 && y > centers[i + 1]) i++;
  const f = THREE.MathUtils.clamp((y - centers[i]) / (centers[i + 1] - centers[i] || 1), 0, 1);
  seg = i; segK = smooth(THREE.MathUtils.clamp((f - 0.15) / 0.7, 0, 1));
  const nearest = f < 0.5 ? i : i + 1;
  if (nearest !== activeIdx) setActive(nearest);
  progressBar.style.transform = `scaleX(${THREE.MathUtils.clamp(y / (centers[centers.length - 1] || 1), 0, 1)})`;
  const st = sheet.getBoundingClientRect().top;
  nav.classList.toggle('solid', st < 70);
  pager.classList.toggle('hide', st < innerHeight * 0.5);
  canvasVisible = st > 0;
  dirty = true;
}

// position along a stop-to-stop path, through any doorways (via points)
const _a = new THREE.Vector3();
function along(pts, k) {
  let total = 0; const lens = [];
  for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); lens.push(l); total += l; }
  let d = k * total;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) return _a.copy(pts[i]).lerp(pts[i + 1], lens[i] ? Math.min(d / lens[i], 1) : 1); d -= lens[i]; }
  return _a.copy(pts[pts.length - 1]);
}
const camP = new THREE.Vector3(), camL = new THREE.Vector3(), goalP = new THREE.Vector3(), goalL = new THREE.Vector3();
let fade = 0, doorOpen = 0;
function goal() {
  const a = stops[seg], b = stops[seg + 1] || a;
  if (a.space !== b.space) {
    // lift ride: fade to black and cut
    const s = segK < 0.5 ? a : b;
    goalP.copy(s.P); goalL.copy(s.L);
    fade = 1 - Math.min(Math.abs(segK - 0.5) * 2.6, 1);
    return segK < 0.5 ? a.space : b.space;
  }
  fade = 0;
  goalP.copy(along([a.P, ...b.via, b.P], segK));
  goalL.copy(a.L).lerp(b.L, segK);
  return a.space;
}

/* giant word, counter, pager */
const counterNum = $('#counterNum'), counterName = $('#counterName');
$('#counterTotal').textContent = String(slides.length).padStart(2, '0');
let wordTimer;
function setActive(i) {
  activeIdx = i;
  counterNum.textContent = String(i + 1).padStart(2, '0');
  counterName.textContent = slides[i].dataset.name || '';
  document.body.dataset.slide = slides[i].id;
  [...pager.querySelectorAll('a')].forEach((a, j) => a.setAttribute('aria-current', j === i ? 'true' : 'false'));
  highlightPlan(stops[i].room);
  const w = slides[i].dataset.word;
  if (wordText.textContent === w) return;
  wordBox.classList.add('swap'); clearTimeout(wordTimer);
  wordTimer = setTimeout(() => { wordText.textContent = w; wordBox.classList.remove('swap'); }, reduceMotion ? 0 : 320);
}
slides.forEach((s, i) => {
  const li = document.createElement('li'), a = document.createElement('a');
  a.href = '#' + s.id; a.setAttribute('aria-label', s.dataset.name || `Stop ${i + 1}`);
  li.append(a); pager.append(li);
});
const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('on', e.isIntersecting)), { threshold: 0.35 });
slides.forEach((s) => io.observe(s));

/* ================= mini floor plan ================= */
const planSvg = $('#planSvg');
const NS = 'http://www.w3.org/2000/svg';
const roomEls = {};
for (const [key, r] of Object.entries(ROOMS)) {
  if (!r.name) continue;
  const g = document.createElementNS(NS, 'g'); g.dataset.room = key;
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', r.x[0]); rect.setAttribute('y', r.z[0]); rect.setAttribute('width', r.w); rect.setAttribute('height', r.d);
  g.append(rect);
  if (r.w > 1.8) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', r.x[0] + r.w / 2); t.setAttribute('y', r.z[0] + r.d / 2 + 0.25);
    t.textContent = r.name.replace(' bedroom', '').replace('Living room', 'Living');
    g.append(t);
  }
  const target = slides.find((s) => s.dataset.room === key || (key === 'dining' && s.dataset.room === 'kitchen'));
  if (target) { g.classList.add('go'); g.addEventListener('click', () => target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })); }
  planSvg.append(g); roomEls[key] = g;
}
const you = document.createElementNS(NS, 'g'); you.classList.add('you');
you.innerHTML = '<path d="M0 0 L-1.4 -2.6 A3 3 0 0 1 1.4 -2.6 Z" class="cone"/><circle r="0.42"/>';
planSvg.append(you);
function highlightPlan(room) {
  Object.entries(roomEls).forEach(([k, g]) => g.classList.toggle('here', k === room || (room === 'kitchen' && k === 'dining')));
}

/* ================= drag to look ================= */
let yaw = 0, yawVel = 0, dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; yawVel = 0; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; yawVel = -dx * 0.25; yaw += yawVel; dirty = true; });
const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
let px = 0, py = 0, cpx = 0, cpy = 0;
if (!reduceMotion && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1; dirty = true; });

/* ================= layout ================= */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  measure(); readScroll();
}
addEventListener('resize', resize);
addEventListener('scroll', readScroll, { passive: true });
addEventListener('load', () => { measure(); readScroll(); });

/* ================= sun control ================= */
let sunAnim = null;
sunInput.addEventListener('input', () => { sunAnim = null; setSun(+sunInput.value); });
function sunrise() {
  const from = 12.5, to = 16.9, dur = 4200, t0 = performance.now();
  sunAnim = (now) => { const k = Math.min((now - t0) / dur, 1); const h = from + (to - from) * (1 - Math.pow(1 - k, 3)); sunInput.value = h.toFixed(2); setSun(h); if (k >= 1) sunAnim = null; };
}

/* ================= loop ================= */
const _dir = new THREE.Vector3(), _v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
let lastT = performance.now(), first = true;
setSun(+sunInput.value);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 16.67, 3); lastT = now;
  if (sunAnim) sunAnim(now);

  const sp = goal();
  if (sp !== space) { space = sp; placeSun(); first = true; }
  ext.visible = space === 'ext'; flat.visible = space === 'int';

  if (!dragging) {
    if (Math.abs(yawVel) > 0.01) { yaw += yawVel; yawVel *= 0.93; dirty = true; }
    else if (!reduceMotion && activeIdx === 0 && canvasVisible && document.visibilityState === 'visible') { yaw += 0.03 * dt; dirty = true; }
    else if (activeIdx !== 0 && Math.abs(yaw) > 0.05) { yaw = ((yaw + 180) % 360 + 360) % 360 - 180; yaw *= 1 - 0.05 * dt; dirty = true; }
  }

  const e = reduceMotion || first ? 1 : 1 - Math.pow(1 - 0.085, dt);
  first = false;
  if (camP.distanceToSquared(goalP) > 1e-6 || camL.distanceToSquared(goalL) > 1e-6) { camP.lerp(goalP, e); camL.lerp(goalL, e); dirty = true; }
  cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
  if (Math.abs(px - cpx) > 1e-3 || Math.abs(py - cpy) > 1e-3) dirty = true;

  // the front door swings open as you arrive at it and step in
  const dIdx = slides.findIndex((s) => s.id === 's-door');
  const want = seg === dIdx ? THREE.MathUtils.clamp(segK * 2.2, 0, 1) : seg > dIdx ? 1 : 0;
  if (Math.abs(want - doorOpen) > 1e-3) { doorOpen += (want - doorOpen) * (reduceMotion ? 1 : 0.12); flat.userData.mainDoor.rotation.y = doorOpen * D2R(98); dirty = true; }

  fadeEl.style.opacity = fade.toFixed(3);
  fadeEl.classList.toggle('on', fade > 0.05);
  if (!dirty || !canvasVisible) return;
  dirty = false;

  // look: outside we orbit the target, inside we turn the head
  const yawR = D2R(yaw + cpx * (space === 'int' ? 6 : 4));
  if (space === 'ext') {
    _v.copy(camP).sub(camL).applyAxisAngle(Y, yawR);
    camera.position.copy(camL).add(_v);
    camera.position.y += cpy * -1.2;
    camera.lookAt(camL);
  } else {
    camera.position.copy(camP);
    _dir.copy(camL).sub(camP).applyAxisAngle(Y, yawR);
    _dir.y += -cpy * 0.25 * _dir.length() * 0.2;
    camera.lookAt(_v.copy(camP).add(_dir));
  }
  const fov = space === 'int' ? (camera.aspect < 0.8 ? 74 : 62) : (camera.aspect < 0.8 ? 58 : 42);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);

  // room label + plan marker
  const st = stops[activeIdx];
  const room = space === 'int' && st.room ? ROOMS[st.room] : null;
  if (room) {
    _v.set((room.x[0] + room.x[1]) / 2, 2.35, (room.z[0] + room.z[1]) / 2).add(FLAT_ORIGIN).project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.95;
    roomTag.classList.toggle('show', vis);
    if (vis) {
      roomTag.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`;
      roomTag.querySelector('b').textContent = room.name;
      roomTag.querySelector('span').textContent = room.size;
    }
  } else roomTag.classList.remove('show');
  planEl.classList.toggle('show', space === 'int' && canvasVisible);
  if (space === 'int') {
    const lp = camera.position.clone().sub(FLAT_ORIGIN);
    camera.getWorldDirection(_dir);
    const ang = Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI;
    you.setAttribute('transform', `translate(${lp.x.toFixed(2)} ${lp.z.toFixed(2)}) rotate(${ang.toFixed(1)})`);
  }
  wordBox.style.transform = `translate3d(${(-cpx * 22).toFixed(1)}px, ${(-cpy * 10).toFixed(1)}px, 0)`;
}

/* first frame */
camP.copy(stops[0].P); camL.copy(stops[0].L);
requestAnimationFrame(() => {
  $('#loaderNum').textContent = '100';
  $('#loader').classList.add('done');
  requestAnimationFrame(() => document.body.classList.remove('load-in'));
  if (!reduceMotion) sunrise();
});
requestAnimationFrame(frame);

/* ================= site visit -> WhatsApp ================= */
$('#visitForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const lines = ["Hello Signifa, I'd like to book a site visit.", `Name: ${f.get('name')}`, `Phone: ${f.get('phone')}`, `Project: ${f.get('project')}`];
  if (f.get('date')) lines.push(`Preferred date: ${f.get('date')}`);
  window.open(`https://api.whatsapp.com/send?phone=918019452299&text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
