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
   SIGNIFA SIGNATURE: site, tower and amenities, after the brochure.
   The 60 ft road runs along +z. The tower is one long C+S+8 bar with four
   wings facing the road. Amenities sit by the gate and at the north end.
   ===================================================================== */
const FH = 3.15, FLOORS = 8, TOP = (FLOORS + 1) * FH;
Object.assign(M, {
  rail: new THREE.MeshPhysicalMaterial({ color: 0x9FD3E6, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }),
  skin: new THREE.MeshStandardMaterial({ color: 0xC68B63, roughness: 0.7 }),
  track: new THREE.MeshStandardMaterial({ color: 0xB4553A, roughness: 0.95 }),
  court: new THREE.MeshStandardMaterial({ color: 0x2F7D5B, roughness: 0.8 }),
  courtOr: new THREE.MeshStandardMaterial({ color: 0xC8673A, roughness: 0.8 }),
  line: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 }),
  play: new THREE.MeshStandardMaterial({ color: 0xE9A23B, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0xD8402F, roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3557B7, roughness: 0.5 }),
  ev: new THREE.MeshStandardMaterial({ color: 0x2BAA6B, roughness: 0.6, emissive: 0x2BAA6B, emissiveIntensity: 0.3 }),
  net: new THREE.MeshStandardMaterial({ color: 0x1E2226, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
});
function rr(s, w, h, r) {
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
function tiledBox(w, h, d) {             // window texture tiles at 4 bays x 4 floors
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, U = 16.8, V = 4 * FH;
  const sc = [[d / U, h / V], [d / U, h / V], [w / U, d / U], [w / U, d / U], [w / U, h / V], [w / U, h / V]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * sc[f][0], uv.getY(k) * sc[f][1]); }
  return g;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1);
function inst(geo, mat, list, cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  list.forEach((t, i) => { m4.compose(new THREE.Vector3(t[0], t[1], t[2]), q, new THREE.Vector3(t[3], t[4], t[5])); m.setMatrixAt(i, m4); });
  m.castShadow = cast; m.receiveShadow = true; ext.add(m); return m;
}
function car(parent, x, z, ry, mat) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  box(g, mat, 1.85, 0.7, 4.4, 0, 0.6, 0, { round: 0.28 });
  box(g, M.black, 1.65, 0.55, 2.3, 0, 1.15, -0.2, { round: 0.22 });
  for (const [p, q] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) cyl(g, M.black, 0.34, 0.34, 0.25, p, 0.34, q, 14).rotation.z = Math.PI / 2;
  return g;
}
function sign(text, sub, w, h, x, y, z) {
  box(ext, M.charcoal, w + 0.4, h - 0.2, 0.08, x, y, z - 0.03, { cast: false });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, sub), transparent: true }));
  s.position.set(x, y, z + 0.02); ext.add(s);
}
windowTex.repeat.set(1, 1);

{
  // land, lawn, paving and the 60 ft road
  const land = new THREE.Mesh(new THREE.CircleGeometry(430, 64), new THREE.MeshStandardMaterial({ color: 0x8FA772, roughness: 1 }));
  land.rotation.x = -Math.PI / 2; land.position.y = -0.06; land.receiveShadow = true; ext.add(land);
  box(ext, M.lawn, 214, 0.1, 74, -6, -0.02, -4, { cast: false });
  box(ext, M.paving, 196, 0.1, 12, -6, 0.02, 19, { cast: false });
  box(ext, M.paving, 14, 0.1, 10, 70, 0.025, 28, { cast: false });
  box(ext, M.paving, 122, 0.1, 18, 0, 0.02, -5, { cast: false });
  box(ext, M.asphalt, 360, 0.1, 18, 0, -0.01, 43, { cast: false });
  box(ext, M.paving, 360, 0.25, 1.6, 0, 0.08, 33.6, { cast: false });
  box(ext, M.paving, 360, 0.25, 2.4, 0, 0.08, 53.2, { cast: false });
  const dashes = []; for (let x = -176; x <= 176; x += 9) dashes.push([x, 0.05, 43, 4, 0.02, 0.22]);
  inst(unitBox, M.line, dashes, false);
  for (let x = -170; x <= 170; x += 15) tree(ext, x + rand() * 4, 57 + rand() * 3, 1.3 + rand() * 0.4);
  car(ext, 26, 39, Math.PI / 2, M.carRed); car(ext, -48, 47, -Math.PI / 2, M.carGrey); car(ext, 160, 47.5, -Math.PI / 2, M.carWhite);

  // compound wall and the entrance gate (white portal, timber block, as in the brochure)
  box(ext, M.stone, 177, 1.9, 0.45, -24.5, 0.95, 32.5); box(ext, M.stone, 25, 1.9, 0.45, 88.5, 0.95, 32.5);
  box(ext, M.wood, 177, 0.14, 0.5, -24.5, 1.95, 32.5); box(ext, M.wood, 25, 0.14, 0.5, 88.5, 1.95, 32.5);
  for (const x of [63.2, 76.8]) box(ext, M.white, 1.6, 6.2, 2.4, x, 3.1, 32.5);
  box(ext, M.white, 15.2, 2.6, 2.8, 70, 7.5, 32.5, { round: 0.1 });
  box(ext, M.wood, 3.4, 6.2, 2.4, 79.4, 3.1, 32.5);
  sign('SIGNIFA', 'SIGNATURE', 10.5, 2.6, 70, 7.5, 33.94);
  box(ext, M.red, 5.2, 0.12, 0.12, 66.6, 1.05, 34.2);
  box(ext, M.white, 3, 2.8, 3, 82.5, 1.4, 24); box(ext, M.facadeGlass, 3.05, 1.2, 3.05, 82.5, 1.7, 24, { cast: false });
  cyl(ext, M.stone, 3.2, 3.4, 0.6, 90, 0.3, 19, 32); cyl(ext, M.water, 2.9, 2.9, 0.1, 90, 0.64, 19, 32); cyl(ext, M.rail, 0.15, 0.3, 2.4, 90, 1.8, 19, 10);

  // the tower: bar + four wings, stilt + 8 floors
  const bodyH = FLOORS * FH, cy = FH + bodyH / 2, wings = [-45, -15, 15, 45];
  const blocks = [[0, -6, 120, 16], ...wings.map((x) => [x, 6, 14, 8])];
  const bands = [], cols = [], slabs = [], rails = [], clad = [], greens = [];
  for (const [x, z, w, d] of blocks) {
    const bm = new THREE.Mesh(tiledBox(w - 0.6, bodyH, d - 0.6), [M.windows, M.windows, M.plaster, M.plaster, M.windows, M.windows]);
    bm.position.set(x, cy, z); bm.castShadow = bm.receiveShadow = true; ext.add(bm);
    for (let f = 1; f <= FLOORS + 1; f++) bands.push([x, f * FH, z, w + 0.5, 0.36, d + 0.5]);
    for (let cx = x - w / 2 + 2; cx <= x + w / 2 - 2; cx += 8) for (let cz = z - d / 2 + 1.5; cz <= z + d / 2 - 1.5; cz += 6) cols.push([cx, FH / 2, cz, 0.7, FH, 0.7]);
  }
  const balc = (x, fz, f, w) => {          // stepped white balcony slab, blue glass rail, timber cladding, planter
    const st = f % 2 ? 0.6 : -0.6, y = f * FH + 0.13;
    slabs.push([x + st, y, fz + 0.95, w, 0.26, 1.9]);
    rails.push([x + st, y + 0.62, fz + 1.86, w - 0.1, 1.0, 0.05]);
    if ((f + Math.round(x / 3)) % 3 === 0) clad.push([x + st, y + 1.45, fz + 0.08, w * 0.92, 2.6, 0.14]);
    if ((f + Math.round(x / 5)) % 2 === 0) greens.push([x + st - w * 0.32, y + 0.42, fz + 1.55, 0.6, 0.5, 0.45]);
  };
  for (let f = 1; f <= FLOORS; f++) {
    for (const x of wings) { balc(x - 3.4, 10, f, 6.2); balc(x + 3.4, 10, f, 6.2); }
    for (const [p, q] of [[-60, -52], [-38, -22], [-8, 8], [22, 38], [52, 60]]) {
      const n = Math.max(1, Math.round((q - p) / 5.4)), bw = (q - p) / n;
      for (let i = 0; i < n; i++) balc(p + bw * (i + 0.5), 2, f, bw - 0.5);
    }
  }
  inst(unitBox, M.white, bands); inst(unitBox, M.white, cols); inst(unitBox, M.white, slabs);
  inst(unitBox, M.rail, rails, false); inst(unitBox, M.wood, clad); inst(blobGeo, M.leaf, greens);
  for (const x of wings) {                 // the tall timber frames on each wing
    for (const s of [-1, 1]) box(ext, M.wood, 0.8, TOP + 3, 2.6, x + s * 7.4, (TOP + 3) / 2, 11.2);
    box(ext, M.wood, 15.6, 0.9, 2.6, x, TOP + 3, 11.2);
  }
  for (const x of [-60.6, 60.6]) { for (const z of [-13.8, 1.8]) box(ext, M.wood, 1, TOP + 2, 1, x, (TOP + 2) / 2, z); box(ext, M.wood, 1, 0.9, 16.6, x, TOP + 2, -6); }
  for (const x of [-30, 0, 30]) box(ext, M.plaster, 7, 3.2, 6, x, TOP + 1.6, -8);
  [-52, -44, -34, -26, 26, 34, 44, 52].forEach((x, i) => car(ext, x, -4, 0, [M.carWhite, M.carGrey, M.carBlue, M.carRed][i % 4]));

  // residents lobby under a deep canopy
  box(ext, M.facadeGlass, 15.6, FH - 0.3, 0.1, 0, FH / 2, 1.9, { cast: false });
  box(ext, M.wood, 4.2, FH - 0.3, 1.4, -5.4, FH / 2, 3.2);
  box(ext, M.white, 15.6, 0.42, 8.2, 0, FH + 0.18, 6.1, { round: 0.12 });
  box(ext, M.cove, 14, 0.04, 0.2, 0, FH - 0.04, 10.1, { cast: false });
  for (const sx of [-1, 1]) cyl(ext, M.charcoal, 0.2, 0.2, FH, sx * 6.8, FH / 2, 9.6, 12);
  sign('SIGNATURE', 'RESIDENTS LOBBY', 6, 1.5, 0, FH + 0.95, 10.3);
  car(ext, 3.5, 13.4, Math.PI / 2, M.carWhite);
  for (let x = -58; x <= 58; x += 3) if (Math.abs(x) > 9) bush(ext, x, 0.4, 12.3, 0.55);

  // swimming pool, kids pool, loungers, dress changing rooms
  box(ext, M.stone, 30, 0.3, 16, 80, 0.15, 6);
  box(ext, M.water, 22, 0.08, 9, 80, 0.33, 4.5, { cast: false });
  box(ext, M.water, 5, 0.08, 3.2, 70, 0.33, 11.4, { cast: false });
  for (let i = 0; i < 6; i++) {
    box(ext, M.linen, 0.75, 0.25, 1.9, 76 + i * 2.6, 0.45, 11.8, { round: 0.1 });
    if (i % 2) { cyl(ext, M.charcoal, 0.03, 0.03, 2.3, 77.3 + i * 2.6, 1.45, 11.8, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 8), M.linen); u.position.set(77.3 + i * 2.6, 2.6, 11.8); u.castShadow = true; ext.add(u); }
  }
  box(ext, M.white, 10, 3.2, 4.6, 86, 1.6, -5.5); box(ext, M.wood, 10.4, 0.5, 5, 86, 3.4, -5.5);
  [[93.5, 13], [66, -3], [93, -11], [73, -11]].forEach(([x, z]) => palm(ext, x, z, 9 + rand() * 2, 0.7));

  // EV charging point: four covered bays on the drive way
  for (let i = 0; i < 4; i++) {
    const x = -35 + i * 3.6;
    box(ext, M.ev, 3.1, 0.03, 5.8, x, 0.09, 15.6, { cast: false });
    car(ext, x, 15.8, Math.PI, [M.carWhite, M.carBlue, M.carGrey, M.carRed][i]);
    box(ext, M.white, 0.55, 1.7, 0.4, x + 1.05, 0.85, 12.3, { round: 0.08 });
    box(ext, M.ev, 0.36, 0.45, 0.04, x + 1.05, 1.3, 12.52, { cast: false });
    ext.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x + 1.05, 1.0, 12.55), new THREE.Vector3(x + 0.9, 0.35, 12.95), new THREE.Vector3(x + 0.5, 0.75, 13.6)]), 12, 0.035, 6), M.black));
  }
  box(ext, M.white, 15.6, 0.3, 8, -29.6, 3.5, 15.4, { round: 0.1 }); box(ext, M.frame, 15, 0.08, 7.4, -29.6, 3.69, 15.4);
  for (const x of [-37, -22.2]) for (const z of [11.8, 19]) box(ext, M.charcoal, 0.24, 3.4, 0.24, x, 1.7, z);
  sign('EV CHARGING', '', 4.8, 1.2, -29.6, 2.75, 19.45);

  // kids play area, shuttle court, half basketball court, cricket practice net
  box(ext, M.play, 10, 0.06, 7.5, -62, 0.08, 20, { cast: false });
  box(ext, M.blue, 1.8, 2.2, 1.8, -65.5, 1.1, 18.5); box(ext, M.red, 2.3, 0.25, 2.3, -65.5, 2.35, 18.5);
  box(ext, M.red, 0.9, 0.12, 3.8, -65.5, 1.15, 21.0).rotation.x = 0.55;
  for (const z of [17.6, 22.4]) box(ext, M.blue, 0.14, 2.6, 0.14, -58.5, 1.3, z);
  box(ext, M.blue, 0.14, 0.14, 4.9, -58.5, 2.6, 20);
  for (const z of [19.1, 20.9]) { box(ext, M.red, 0.55, 0.06, 0.32, -58.5, 0.62, z); box(ext, M.charcoal, 0.03, 2.0, 0.03, -58.5, 1.62, z); }
  box(ext, M.court, 7, 0.04, 14, -92, 0.1, 16, { cast: false });
  inst(unitBox, M.line, [[-95.4, 0.13, 16, 0.08, 0.01, 13.6], [-88.6, 0.13, 16, 0.08, 0.01, 13.6], [-92, 0.13, 9.2, 6.9, 0.01, 0.08], [-92, 0.13, 22.8, 6.9, 0.01, 0.08], [-92, 0.13, 16, 0.06, 0.01, 13.6]], false);
  for (const x of [-95.6, -88.4]) cyl(ext, M.charcoal, 0.04, 0.04, 1.55, x, 0.78, 16, 6);
  box(ext, M.net, 7.2, 0.76, 0.02, -92, 1.17, 16, { cast: false });
  box(ext, M.courtOr, 14, 0.04, 14, -77, 0.1, 16, { cast: false }); box(ext, M.court, 4.9, 0.01, 5.8, -77, 0.13, 11.9, { cast: false });
  cyl(ext, M.charcoal, 0.1, 0.1, 3.4, -77, 1.7, 8.5, 8); box(ext, M.line, 1.8, 1.05, 0.06, -77, 3.3, 8.95);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 20), M.red); ring.rotation.x = Math.PI / 2; ring.position.set(-77, 3.05, 9.25); ext.add(ring);
  box(ext, M.trunk, 3, 0.04, 20, -104, 0.1, -4, { cast: false }); box(ext, M.net, 3.8, 3.4, 20, -104, 1.72, -4, { cast: false });

  // club house: glass gym below, rooms above, timber fins
  box(ext, M.stone, 25, 0.1, 15, -84, 0.06, -16, { cast: false });
  box(ext, M.glass, 25, 3.8, 15, -84, 1.9, -16, { cast: false });
  box(ext, M.wood, 25, 3.8, 0.3, -84, 1.9, -23.4);
  const cu = new THREE.Mesh(tiledBox(26, 3.8, 16), [M.windows, M.windows, M.plaster, M.plaster, M.windows, M.windows]);
  cu.position.set(-84, 5.9, -16); cu.castShadow = cu.receiveShadow = true; ext.add(cu);
  box(ext, M.white, 27, 0.45, 17, -84, 3.95, -16); box(ext, M.white, 27.4, 0.5, 17.4, -84, 8.05, -16);
  for (let i = 0; i < 9; i++) box(ext, M.wood, 0.3, 7.8, 0.5, -96 + i * 3, 3.9, -7.3);
  for (let i = 0; i < 5; i++) box(ext, M.black, 0.8, 1.2, 1.8, -92 + i * 2.4, 0.6, -10.6);
  sign('CLUB HOUSE', 'GYM  ·  GAMES  ·  YOGA', 8, 2, -84, 9.4, -7.6);

  // gazebos and the senior citizen lounge
  for (const [x, z] of [[-100, -29], [-40, -29], [40, -29]]) {
    for (const [p, q] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) box(ext, M.wood, 0.2, 2.7, 0.2, x + p, 1.35, z + q);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.4, 8), M.wood); roof.position.set(x, 3.4, z); roof.castShadow = true; ext.add(roof);
    cyl(ext, M.stone, 1.5, 1.5, 0.45, x, 0.23, z, 16);
  }
  for (let i = 0; i < 9; i++) box(ext, M.wood, 0.18, 0.2, 5, -74 + i, 2.9, -29);
  for (const [p, q] of [[-74.5, -31.3], [-65.5, -31.3], [-74.5, -26.7], [-65.5, -26.7]]) box(ext, M.white, 0.3, 2.8, 0.3, p, 1.4, q);
  for (const x of [-72, -68]) box(ext, M.woodDark, 1.8, 0.45, 0.6, x, 0.4, -29, { round: 0.05 });

  // landscape: palms inside the wall, trees at the back
  for (let x = -104; x <= 96; x += 10) if (x < 60 || x > 80) palm(ext, x + rand() * 2, 30.9, 7.5 + rand() * 2, 0.5);
  for (let x = -106; x <= 96; x += 9) tree(ext, x + rand() * 3, -39.5, 1.2 + rand() * 0.5);
}

/* walking / jogging track with people on it */
let trackCurve;
{
  const outer = rr(new THREE.Shape(), 207.4, 65.4, 9.2), hole = rr(new THREE.Path(), 202.6, 60.6, 6.8);
  outer.holes.push(hole);
  const tr = new THREE.Mesh(new THREE.ShapeGeometry(outer, 24), M.track);
  tr.rotation.x = -Math.PI / 2; tr.position.set(-6, 0.11, -4); tr.receiveShadow = true; ext.add(tr);
  const mid = rr(new THREE.Shape(), 205, 63, 8);
  trackCurve = new THREE.CatmullRomCurve3(mid.getSpacedPoints(600).slice(0, -1).map((p) => new THREE.Vector3(p.x - 6, 0.12, -p.y - 4)), true);
}
const trackLen = trackCurve.getLength();
function person(topMat, legMat) {
  const g = new THREE.Group(); ext.add(g);
  box(g, topMat, 0.44, 0.62, 0.26, 0, 1.28, 0, { round: 0.08 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), M.skin); head.position.y = 1.78; head.castShadow = true; g.add(head);
  const limb = (x, y, len, w, mat) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); box(p, mat, w, len, w, 0, -len / 2, 0); return p; };
  return { g, legs: [limb(-0.11, 0.98, 0.95, 0.15, legMat), limb(0.11, 0.98, 0.95, 0.15, legMat)], arms: [limb(-0.29, 1.55, 0.62, 0.1, M.skin), limb(0.29, 1.55, 0.62, 0.1, M.skin)], ph: 0 };
}
const runners = [[M.red, 3.2], [M.blue, 2.8], [M.linen, -1.3], [M.ev, 3.0], [M.fabricRust, -1.1], [M.charcoal, 2.6]]
  .map(([m, v], i) => Object.assign(person(m, i % 2 ? M.black : M.charcoal), { v, t: i / 6 }));
let followSeg = -1, followR = runners[0];
const _n = new THREE.Vector3();
function moveRunners(sec) {
  for (const r of runners) {
    r.t = (r.t + (r.v * sec) / trackLen + 1) % 1;
    const p = trackCurve.getPointAt(r.t), tg = trackCurve.getTangentAt(r.t).multiplyScalar(Math.sign(r.v));
    r.ph += sec * Math.abs(r.v) * 2.6;
    const amp = Math.min(0.24 * Math.abs(r.v), 0.8), s = Math.sin(r.ph) * amp;
    r.g.position.set(p.x, Math.abs(Math.sin(r.ph)) * 0.02 * Math.abs(r.v), p.z);
    r.g.rotation.y = Math.atan2(tg.x, tg.z);
    r.legs[0].rotation.x = s; r.legs[1].rotation.x = -s; r.arms[0].rotation.x = -s; r.arms[1].rotation.x = s;
    r.tg = tg;
  }
}

const extLamps = [];
for (const x of [-80, -50, -20, 20, 50, 62]) {
  cyl(ext, M.charcoal, 0.06, 0.08, 3.6, x, 1.8, 25.6, 8);
  box(ext, M.lampGlow, 0.4, 0.25, 0.4, x, 3.65, 25.6, { cast: false });
  const l = new THREE.PointLight(0xFFB868, 0, 20, 1.8); l.position.set(x, 3.3, 25.6); ext.add(l); extLamps.push(l);
}

/* the city around both sites */
function city(parent, cx, cz, rMin, rMax, nB, baseY = 0) {
  const ins = new THREE.InstancedMesh(unitBox, M.city, nB), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
  for (let i = 0; i < nB; i++) {
    const an = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin), w = 12 + rand() * 18, d = 12 + rand() * 18, h = 10 + rand() * 34;
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(new THREE.Vector3(cx + Math.cos(an) * r, baseY + h / 2, cz + Math.sin(an) * r), qq, new THREE.Vector3(w, h, d));
    ins.setMatrixAt(i, m4);
  }
  ins.receiveShadow = true; parent.add(ins);
}
M.city.map = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#E4DED4'; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = '#A9B3B9'; g.fillRect(c * 64 + 12, r * 64 + 16, 40, 34); } }, true);
M.city.map.repeat.set(3, 6);
M.city.emissiveMap = windowGlow.clone(); M.city.emissiveMap.repeat.set(3, 6); M.city.emissiveMap.needsUpdate = true;
city(ext, 0, 0, 250, 430, 50);

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
let bed3Bed, studyKit;
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
  bed3Bed = bed(2.1, 11.88, Math.PI, 1.5, M.fabricRust);
  studyKit = new THREE.Group(); studyKit.visible = false; flat.add(studyKit);      // 2 BHK + Study: the third room becomes a study
  box(studyKit, M.wood, 2.4, 2.1, 0.42, 2.1, 1.05, 11.7);
  box(studyKit, M.fabricSage, 0.85, 0.45, 0.85, 2.7, 0.22, 10.4, { round: 0.12 }); box(studyKit, M.fabricSage, 0.85, 0.5, 0.18, 2.7, 0.65, 10.82, { round: 0.06 });
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

const _sc = new THREE.Vector3();
let space = 'ext';
function placeSun() {
  if (space === 'ext') {
    const c = _sc.copy(camL).setY(0), s = THREE.MathUtils.clamp(camP.distanceTo(camL) * 0.65, 40, 130);
    sun.target.position.copy(c);
    sun.position.set(c.x + Math.cos(sunAz) * Math.cos(sunEl) * 160, Math.sin(sunEl) * 160 + 10, c.z + 0.55 * Math.cos(sunEl) * 160 + 60);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 450 });
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
  's-hero':  { space: 'ext', p: [125, 78, 150], l: [-12, 6, -4] },
  's-road':  { space: 'ext', p: [122, 1.7, 44], l: [70, 5, 33], tag: ['Signifa Signature', 'Entry from the 60 ft road', [70, 10, 32.5]] },
  's-gate':  { space: 'ext', p: [70, 1.75, 26.5], l: [30, 5, 8], via: [[70, 1.75, 40]], tag: ['Drive way', 'Palm-lined, with a water body at the gate', [55, 3.2, 19]] },
  's-pool':  { space: 'ext', p: [60, 4.5, 22], l: [82, 0.5, 4], tag: ['Swimming pool', 'Kids pool and dress changing rooms', [80, 2.2, 4.5]] },
  's-ev':    { space: 'ext', p: [-30, 2.4, 26], l: [-30, 1.2, 13], via: [[20, 3, 24]], tag: ['EV charging point', 'Four covered bays', [-29.6, 4.8, 15.4]] },
  's-jog':   { space: 'ext', p: [0, 3, 30], l: [0, 1, 28], follow: true, tag: ['Walking and jogging track', 'A loop around the whole community', 'runner'] },
  's-play':  { space: 'ext', p: [-56, 8, 31], l: [-78, 0.5, 15], tag: ['Kids play area', 'Shuttle court and half basketball court', [-70, 3.6, 18]] },
  's-club':  { space: 'ext', p: [-64, 4.5, 4], l: [-86, 3, -14], tag: ['Club house', 'Indoor gym, games and yoga hall', [-84, 11, -12]] },
  's-lobby': { space: 'ext', p: [-3.5, 1.7, 21], l: [0, 2.2, 6], via: [[-40, 3, 24]], tag: ['Residents lobby', 'KONE lifts and intercom', [0, 5.2, 9]] },
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
  return { id: s.id, space: d.space, P: toWorld(d.space, d.p), L: toWorld(d.space, d.l), via: (d.via || []).map((v) => toWorld(d.space, v)), room: s.dataset.room, tag: d.tag, follow: d.follow };
});

const followStop = stops.find((s) => s.follow);
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
const planTexts = {};
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
    g.append(t); planTexts[key] = t;
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

// sizes from the Signifa Signature brochure (typical floor plan)
const UNITS = {
  3: { cap: '3 BHK, 1,695 sft. Flats 10, 16 and 23, west facing', names: {
    living: ['Drawing', `18'9" × 11'1½"`, 'Drawing'], dining: ['Dining', `10' × 12'1½"`, 'Dining'], kitchen: ['Kitchen', `10' × 10'4½"`, 'Kitchen'],
    master: ['Bedroom 1', `10' × 14'9"`, 'Bed 1'], bed2: ['Bedroom 2', `10' × 11'1½"`, 'Bed 2'], bed3: ['Bedroom 3', `10' × 12'10½"`, 'Bed 3'],
    balcony: ['Balcony', `4 ft wide`, 'Balcony'], ward: ['Dress', '', 'Dress'] } },
  2: { cap: '2 BHK + Study, 1,530 sft. Flats 07 and 08', names: {
    living: ['Drawing', `9'7½" × 13'`, 'Drawing'], dining: ['Living / dining', `9'7½" × 19'9"`, 'Liv/Din'], kitchen: ['Kitchen', `9'7½" × 13'`, 'Kitchen'],
    master: ['Bedroom 1', `11' × 13'`, 'Bed 1'], bed2: ['Bedroom 2', `11' × 13'`, 'Bed 2'], bed3: ['Study room', `11' × 8'`, 'Study'],
    balcony: ['Balcony', `4 ft wide`, 'Balcony'], ward: ['Dress', '', 'Dress'] } },
};
let unit = '3';
function setUnit(u) {
  unit = u; bed3Bed.visible = u === '3'; studyKit.visible = u !== '3';
  document.querySelectorAll('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === u)));
  $('#planCap').textContent = UNITS[u].cap;
  for (const [k, t] of Object.entries(planTexts)) { const n = UNITS[u].names[k]; if (n) t.textContent = n[2]; }
  dirty = true;
}
document.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => setUnit(b.dataset.unit)));
setUnit('3');

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
  moveRunners(dt / 60);
  if (seg !== followSeg) { followSeg = seg; let best = 1e12; for (const r of runners) { const d = r.g.position.distanceToSquared(camP); if (d < best && Math.abs(r.v) > 2) { best = d; followR = r; } } }
  if (followStop && followR.tg) {
    const r = followR, n = _n.set(r.tg.z, 0, -r.tg.x);
    if (n.x * (-6 - r.g.position.x) + n.z * (-4 - r.g.position.z) < 0) n.negate();   // stay on the inside of the loop, clear of the palms
    followStop.P.copy(r.g.position).addScaledVector(r.tg, -8).addScaledVector(n, 3.5).setY(3.2);
    followStop.L.copy(r.g.position).addScaledVector(r.tg, 5).setY(1.1);
  }

  const sp = goal();
  if (sp !== space) { space = sp; placeSun(); first = true; }
  ext.visible = space === 'ext'; flat.visible = space === 'int';

  if (!dragging) {
    if (Math.abs(yawVel) > 0.01) { yaw += yawVel; yawVel *= 0.93; dirty = true; }
    else if (!reduceMotion && activeIdx === 0 && canvasVisible && document.visibilityState === 'visible') { yaw += 0.03 * dt; dirty = true; }
    else if (activeIdx !== 0 && Math.abs(yaw) > 0.05) { yaw = ((yaw + 180) % 360 + 360) % 360 - 180; yaw *= Math.max(0, 1 - 0.09 * dt); dirty = true; }
  }

  const e = reduceMotion || first ? 1 : 1 - Math.pow(1 - 0.085, dt);
  first = false;
  if (camP.distanceToSquared(goalP) > 1e-6 || camL.distanceToSquared(goalL) > 1e-6) { camP.lerp(goalP, e); camL.lerp(goalL, e); dirty = true; }
  cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
  if (Math.abs(px - cpx) > 1e-3 || Math.abs(py - cpy) > 1e-3) dirty = true;
  if (space === 'ext' && canvasVisible) dirty = true;

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
  const fov = space === 'int' ? (camera.aspect < 0.8 ? 74 : 62) : THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(camP.distanceTo(camL), 15, 220, 56, 38), 38, 56) + (camera.aspect < 0.8 ? 14 : 0);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (space === 'ext') placeSun();
  renderer.render(scene, camera);

  // room label + plan marker
  const st = stops[activeIdx];
  let tg = null;
  if (space === 'int' && st.room) { const r = ROOMS[st.room]; tg = UNITS[unit].names[st.room] || [r.name, r.size]; _v.set((r.x[0] + r.x[1]) / 2, 2.35, (r.z[0] + r.z[1]) / 2).add(FLAT_ORIGIN); }
  else if (space === 'ext' && st.tag) { tg = st.tag; if (tg[2] === 'runner') _v.copy(followR.g.position).setY(2.8); else _v.set(...tg[2]); }
  if (tg) {
    _v.project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.95;
    roomTag.classList.toggle('show', vis);
    if (vis) {
      roomTag.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`;
      roomTag.querySelector('b').textContent = tg[0];
      roomTag.querySelector('span').textContent = tg[1];
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
