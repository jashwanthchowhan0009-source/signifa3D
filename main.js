import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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
    g.font = '800 108px Montserrat, Arial, sans-serif'; g.fillText(text, w / 2, 150);
    if (sub) { g.font = '600 38px Montserrat, Arial, sans-serif'; g.fillStyle = '#F5EEDC'; g.fillText(sub, w / 2, 215); }
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
const carSlots = [], roadCars = [], anims = [], interiorLights = [], playRefs = {};
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
  carSlots.push(g);
  return g;
}
function sign(text, sub, w, h, x, y, z) {
  box(ext, M.charcoal, w + 0.4, h - 0.2, 0.08, x, y, z - 0.03, { cast: false });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, sub), transparent: true }));
  s.position.set(x, y, z + 0.02); ext.add(s);
}
windowTex.repeat.set(1, 1);
/* =====================================================================
   SITE, after the brochure master plan. x runs north (-) to south (+),
   z runs west (-) to east (+). The 60 ft road runs along the east side
   and curves round the south end; Entry & exit is at the south-east
   corner. Amenities at the north end, pool at the south end, 23 flats
   per floor in three columns of wings joined by 6'6" corridors.
   ===================================================================== */
Object.assign(M, {
  deck: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, map: woodTex, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xC3C7CB, metalness: 0.85, roughness: 0.28 }),
  solar: new THREE.MeshStandardMaterial({ color: 0x1B2A4A, metalness: 0.5, roughness: 0.22 }),
  ylw: new THREE.MeshStandardMaterial({ color: 0xF2C230, roughness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x3E8E7E, roughness: 1 }),
  white2: new THREE.MeshStandardMaterial({ color: 0xF4F4F2, roughness: 0.4 }),
  flower: new THREE.MeshStandardMaterial({ color: 0xE45C8A, roughness: 0.8 }),
  flower2: new THREE.MeshStandardMaterial({ color: 0xF2B632, roughness: 0.8 }),
  poolFloor: new THREE.MeshStandardMaterial({ color: 0x7FCAD8, roughness: 0.4, side: THREE.DoubleSide }),
});
const grp = (x, y, z, ry = 0) => { const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = ry; ext.add(q); return q; };
const bench = (x, z, ry) => { const q = grp(x, 0, z, ry);
  box(q, M.wood, 1.6, 0.06, 0.45, 0, 0.45, 0.22); box(q, M.wood, 1.6, 0.4, 0.05, 0, 0.72, 0.02);
  for (const s of [-1, 1]) box(q, M.charcoal, 0.06, 0.45, 0.42, s * 0.7, 0.22, 0.22); return q; };
const umbrella = (x, y, z, r = 1.5) => { cyl(ext, M.charcoal, 0.03, 0.03, 2.4, x, y + 1.2, z, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(r, 0.45, 12), M.linen); u.position.set(x, y + 2.45, z); u.castShadow = true; ext.add(u); };
const segBox = (mat, x1, z1, x2, z2, h, t, y = h / 2) => { const l = Math.hypot(x2 - x1, z2 - z1), m = box(ext, mat, l, h, t, (x1 + x2) / 2, y, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); return m; };
function ribbon(curve, w, y, mat, off = 0, n = 160) {
  const pos = [], idx = [], p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { curve.getPointAt(i / n, p); curve.getTangentAt(i / n, t); const nx = -t.z, nz = t.x;
    pos.push(p.x + nx * (off - w / 2), y, p.z + nz * (off - w / 2), p.x + nx * (off + w / 2), y, p.z + nz * (off + w / 2));
    if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; ext.add(m); return m;
}
const roadCurve = new THREE.CatmullRomCurve3([[-180, 50], [20, 50], [62, 48], [92, 36], [108, 12], [112, -20], [110, -70], [104, -130]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
const PH = 1.0, FL = new THREE.Vector3();
{
  // ground, the 60 ft road with footpaths, compound wall and the entry gate
  const land = new THREE.Mesh(new THREE.CircleGeometry(430, 64), new THREE.MeshStandardMaterial({ color: 0x8FA772, roughness: 1 }));
  land.rotation.x = -Math.PI / 2; land.position.y = -0.06; land.receiveShadow = true; ext.add(land);
  const plot = new THREE.Shape([[-104, -40], [-104, 40], [66, 40], [92, 18], [92, -40]].map(([x, z]) => new THREE.Vector2(x, -z)));
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(plot), M.lawn); lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.02; lawn.receiveShadow = true; ext.add(lawn);
  box(ext, M.paving, 116, 0.1, 55, 0, 0.03, 0.5, { cast: false });
  box(ext, M.paving, 134, 0.1, 4.4, 5, 0.035, 35, { cast: false }); box(ext, M.paving, 16, 0.1, 12, 68, 0.035, 29, { cast: false });
  box(ext, M.paving, 22, 0.1, 13, -70, 0.035, -31, { cast: false }); box(ext, M.paving, 8, 0.1, 70, -64, 0.034, 0, { cast: false });
  ribbon(roadCurve, 18, 0.01, M.asphalt); ribbon(roadCurve, 2.4, 0.1, M.paving, 10.2); ribbon(roadCurve, 2.4, 0.1, M.paving, -10.2);
  const dash = [], P = new THREE.Vector3();
  for (let i = 0; i < 70; i++) { roadCurve.getPointAt(i / 70, P); dash.push([P.x, 0.03, P.z]); }
  const dashM = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 0.02, 0.22), M.line, dash.length), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), T = new THREE.Vector3();
  dash.forEach((d, i) => { roadCurve.getTangentAt(i / 70, T); q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(T.z, T.x)); m4.compose(new THREE.Vector3(...d), q4, new THREE.Vector3(1, 1, 1)); dashM.setMatrixAt(i, m4); });
  ext.add(dashM);
  for (let i = 0; i < 26; i++) { roadCurve.getPointAt(i / 26, P); tree(ext, P.x + 13, P.z + (P.z > 0 && P.x < 60 ? 8 : 0) * 0 + (P.x < 60 ? 13 : 0), 1.3 + rand() * 0.4); }
  const wall = [[-104, -40], [-104, 40], [66, 40], [92, 18], [92, -40], [-104, -40]];
  for (let i = 0; i < wall.length - 1; i++) {
    const [a, b] = [wall[i], wall[i + 1]];
    if (i === 2) { const g0 = 0.5 - 9 / Math.hypot(b[0] - a[0], b[1] - a[1]), g1 = 1 - g0, lp = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      for (const [s, e] of [[0, g0], [g1, 1]]) { const [x1, z1] = lp(s), [x2, z2] = lp(e); segBox(M.stone, x1, z1, x2, z2, 1.9, 0.45); segBox(M.wood, x1, z1, x2, z2, 0.14, 0.5, 1.95); } continue; }
    segBox(M.stone, a[0], a[1], b[0], b[1], 1.9, 0.45); segBox(M.wood, a[0], a[1], b[0], b[1], 0.14, 0.5, 1.95);
  }
  const gate = grp(79, 0, 29, Math.atan2(22, 26));                   // white portal, timber block, sign: as in the brochure
  for (const x of [-6.8, 6.8]) box(gate, M.white, 1.6, 6.2, 2.4, x, 3.1, 0);
  box(gate, M.white, 15.2, 2.6, 2.8, 0, 7.5, 0, { round: 0.1 }); box(gate, M.wood, 3.4, 6.2, 2.4, 9.4, 3.1, 0);
  box(gate, M.charcoal, 10.9, 2.4, 0.08, 0, 7.5, 1.42, { cast: false });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.6), new THREE.MeshBasicMaterial({ map: signTex('SIGNIFA', 'SIGNATURE'), transparent: true })); sg.position.set(0, 7.5, 1.47); gate.add(sg);
  box(gate, M.red, 5.2, 0.12, 0.12, -3.4, 1.05, 2.0); box(gate, M.white, 3, 2.8, 3, -11, 1.4, -5); box(gate, M.facadeGlass, 3.05, 1.2, 3.05, -11, 1.7, -5, { cast: false });
  cyl(ext, M.stone, 3.2, 3.4, 0.6, 70, 0.3, 24, 32); cyl(ext, M.water, 2.9, 2.9, 0.1, 70, 0.64, 24, 32); cyl(ext, M.rail, 0.15, 0.3, 2.4, 70, 1.8, 24, 10);  // 02 water body
  roadCars.push([car(ext, 0, 0, 0, M.carRed), 11, 0.1, -4.5], [car(ext, 0, 0, 0, M.carGrey), -9, 0.45, 4.5], [car(ext, 0, 0, 0, M.carWhite), 12, 0.7, -4.5], [car(ext, 0, 0, 0, M.carBlue), -10, 0.85, 4.5]);

  // the tower: 23 flats per floor in three columns of wings, joined by corridors
  const bodyH = FLOORS * FH, cy = FH + bodyH / 2;
  const B = { bands: [], cols: [], slabs: [], rails: [], clad: [], greens: [], tops: [], coves: [], acs: [], sol: [], corr: [], par: [] };
  const balc = (cx, cz, alongX, w, nx, nz, f) => {
    const st = f % 2 ? 0.6 : -0.6, y = f * FH + 0.13, ox = cx + (alongX ? st : nx * 0.95), oz = cz + (alongX ? nz * 0.95 : st);
    const W = alongX ? w : 1.9, D = alongX ? 1.9 : w, ex = (k) => [cx + (alongX ? st : nx * k), cz + (alongX ? nz * k : st)];
    B.slabs.push([ox, y, oz, W, 0.26, D]);
    const [rx, rz] = ex(1.86); B.rails.push([rx, y + 0.62, rz, alongX ? w - 0.1 : 0.05, 1.0, alongX ? 0.05 : w - 0.1]); B.tops.push([rx, y + 1.14, rz, alongX ? w - 0.1 : 0.07, 0.05, alongX ? 0.07 : w - 0.1]);
    B.coves.push([rx, y - 0.15, rz, alongX ? w : 0.05, 0.03, alongX ? 0.05 : w]);
    if ((f + Math.round(cx / 3 + cz / 3)) % 3 === 0) { const [qx, qz] = ex(0.08); B.clad.push([qx, y + 1.45, qz, alongX ? w * 0.92 : 0.14, 2.6, alongX ? 0.14 : w * 0.92]); }
    if ((f + Math.round(cx / 5 + cz / 5)) % 2 === 0) { const [gx, gz] = ex(1.55); B.greens.push([gx + (alongX ? -w * 0.32 : 0), y + 0.42, gz + (alongX ? 0 : -w * 0.32), 0.6, 0.5, 0.45]); }
    if ((f * 7 + Math.round(cx * 3 + cz)) % 5 === 0) { const [ax, az] = ex(0.45); B.acs.push([ax + (alongX ? w * 0.36 : 0), y + 0.42, az + (alongX ? 0 : w * 0.36), alongX ? 0.8 : 0.32, 0.55, alongX ? 0.32 : 0.8]); }
  };
  const BLOCKS = [];
  const block = (no, x0, x1, z0, z1, faces) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; BLOCKS.push({ no, x0, x1, z0, z1, cx, cz });
    const bm = new THREE.Mesh(tiledBox(w - 0.6, bodyH, d - 0.6), [M.windows, M.windows, M.plaster, M.plaster, M.windows, M.windows]);
    bm.position.set(cx, cy, cz); bm.castShadow = bm.receiveShadow = true; ext.add(bm);
    for (let f = 1; f <= FLOORS + 1; f++) B.bands.push([cx, f * FH, cz, w + 0.5, 0.36, d + 0.5]);
    for (const px of [x0 + 1.5, x1 - 1.5]) for (const pz of [z0 + 1.5, z1 - 1.5]) B.cols.push([px, FH / 2, pz, 0.7, FH, 0.7]);
    for (const fc of faces) {
      const alongX = fc === 'w' || fc === 'e', len = alongX ? w : d, n = Math.max(1, Math.round(len / 5.4)), bw = len / n;
      const nx = fc === 'n' ? -1 : fc === 's' ? 1 : 0, nz = fc === 'w' ? -1 : fc === 'e' ? 1 : 0;
      const fx = fc === 'n' ? x0 : fc === 's' ? x1 : 0, fz = fc === 'w' ? z0 : fc === 'e' ? z1 : 0;
      for (let f = 1; f <= FLOORS; f++) for (let i = 0; i < n; i++) balc(alongX ? x0 + bw * (i + 0.5) : fx, alongX ? fz : z0 + bw * (i + 0.5), alongX, bw - 0.5, nx, nz, f);
      const H = TOP + 3, ends = alongX ? [[x0 + 0.4, fz + nz * 2.3], [x1 - 0.4, fz + nz * 2.3]] : [[fx + nx * 2.3, z0 + 0.4], [fx + nx * 2.3, z1 - 0.4]];
      for (const [ex2, ez] of ends) box(ext, M.wood, 0.8, H, 0.8, ex2, H / 2, ez);
      box(ext, M.wood, alongX ? w : 0.8, 0.9, alongX ? 0.8 : d, alongX ? cx : fx + nx * 2.3, H, alongX ? fz + nz * 2.3 : cz);
    }
    for (let x = x0 + 1.6; x < x1 - 1; x += 2.1) for (const z of [cz - 2, cz + 0.2]) B.sol.push([x, TOP + 0.6, z, 1.9, 0.05, 1.7]);
    car(ext, cx - 2.5, cz, 0, M.carWhite); car(ext, cx + 2.5, cz, 0, M.carGrey);
  };
  [['07', -53, -41], ['08', -38, -26], ['09', -23, -12], ['10', -10, 3], ['11', 6, 17], ['12', 20, 32], ['13', 35, 47]].forEach(([n, a, b]) => block(n, a, b, -22, -10, ['w']));
  [['22', -53, -38], ['21', -32, -20], ['17', -4, 8]].forEach(([n, a, b]) => block(n, a, b, -7, 7, ['n', 's']));
  [['23', -53, -37], ['20', -33, -21], ['19', -17, -6], ['18', -3, 8], ['16', 12, 24], ['15', 27, 37], ['14', 40, 53]].forEach(([n, a, b]) => block(n, a, b, 10, 24, ['e']));
  // 6'6" corridors on every floor: two spines and two cross links, glass parapets on the open sides
  const corridor = (x0, x1, z0, z1) => { const alongX = x1 - x0 > z1 - z0;
    for (let f = 1; f <= FLOORS + 1; f++) { B.corr.push([(x0 + x1) / 2, f * FH, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0]);
      if (f <= FLOORS) for (const s of [0, 1]) B.par.push(alongX ? [(x0 + x1) / 2, f * FH + 0.6, s ? z1 : z0, x1 - x0, 0.9, 0.05] : [s ? x1 : x0, f * FH + 0.6, (z0 + z1) / 2, 0.05, 0.9, z1 - z0]); } };
  corridor(-53, 47, -10, -7); corridor(-53, 53, 7, 10); corridor(-36, -32, -7, 7); corridor(8, 12, -7, 7);
  for (const [x, z] of [[-35, -8.5], [10, 8.5]]) { box(ext, M.charcoal, 4.2, TOP + 3.2, 4.2, x, (TOP + 3.2) / 2, z); box(ext, M.facadeGlass, 0.06, TOP - 1, 2.4, x + 2.12, (TOP + 2) / 2, z, { cast: false }); }
  inst(unitBox, M.white, B.bands); inst(unitBox, M.white, B.cols); inst(unitBox, M.white, B.slabs); inst(unitBox, M.white, B.corr);
  inst(unitBox, M.rail, B.rails, false); inst(unitBox, M.rail, B.par, false); inst(unitBox, M.chrome, B.tops, false); inst(unitBox, M.cove, B.coves, false);
  inst(unitBox, M.ceramic, B.acs); inst(unitBox, M.wood, B.clad); inst(blobGeo, M.leaf, B.greens); inst(unitBox, M.solar, B.sol);
  for (const z of [-16, 17]) { box(ext, M.leaf2, 0.2, bodyH - 1, 10, -53.2, FH + bodyH / 2, z, { cast: false });
    const gw = []; for (let i = 0; i < 36; i++) gw.push([-53.35, FH + 0.5 + rand() * (bodyH - 2), z - 4.6 + rand() * 9.2, 0.25, 0.4, 0.4]); inst(blobGeo, M.leaf, gw); }
  // residents lobby on the south face of flat 14, under a deep canopy
  box(ext, M.facadeGlass, 0.1, FH - 0.3, 11, 53.1, FH / 2, 17, { cast: false }); box(ext, M.wood, 1.4, FH - 0.3, 3.4, 52.4, FH / 2, 13.4);
  box(ext, M.white, 8.2, 0.42, 13, 57.4, FH + 0.18, 17, { round: 0.12 }); box(ext, M.cove, 0.2, 0.04, 11.4, 61.3, FH - 0.04, 17, { cast: false });
  for (const s of [-1, 1]) cyl(ext, M.charcoal, 0.2, 0.2, FH, 60.8, FH / 2, 17 + s * 5.6, 12);
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: signTex("SIGNATURE", "RESIDENTS LOBBY"), transparent: true })); s.position.set(61.55, FH + 0.95, 17); s.rotation.y = Math.PI / 2; ext.add(s); }
  car(ext, 59, 21.5, 0, M.carWhite);
  FL.set(57, 0, 17);

  // 03 swimming pool: angled pool sunk into a raised teak deck, glass balustrade, cabana, palms
  const poolPts = [[68, -21.5], [84, -23.5], [86.5, -8], [70.5, -5.5]];
  const deckShape = new THREE.Shape([[63, -29], [91, -29], [91, -1], [63, -1]].map(([x, z]) => new THREE.Vector2(x, z)));
  deckShape.holes.push(new THREE.Path(poolPts.map(([x, z]) => new THREE.Vector2(x, z))));
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: PH, bevelEnabled: false }); deckGeo.rotateX(Math.PI / 2); deckGeo.translate(0, PH, 0);
  const deck = new THREE.Mesh(deckGeo, [M.deck, M.stone]); deck.castShadow = deck.receiveShadow = true; ext.add(deck);
  const poolShape = new THREE.Shape(poolPts.map(([x, z]) => new THREE.Vector2(x, z)));
  const pf = new THREE.Mesh(new THREE.ShapeGeometry(poolShape).rotateX(Math.PI / 2), M.poolFloor); pf.position.y = 0.12; ext.add(pf);
  const cau = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,255,255,.6)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; g.quadraticCurveTo(x + 20, y - 20, x, y); } g.stroke(); } }, true);
  cau.repeat.set(0.18, 0.18);
  M.poolWater = new THREE.MeshPhysicalMaterial({ color: 0x1EA9C4, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.8, emissive: 0xBFF6FF, emissiveMap: cau, emissiveIntensity: 0.3, side: THREE.DoubleSide });
  const pw = new THREE.Mesh(new THREE.ShapeGeometry(poolShape).rotateX(Math.PI / 2), M.poolWater); pw.position.y = PH - 0.14; pw.renderOrder = 2; ext.add(pw);
  anims.push((t) => cau.offset.set(Math.sin(t * 0.3) * 0.05 + t * 0.01, Math.cos(t * 0.27) * 0.05));
  for (let i = 0; i < poolPts.length; i++) { const [a, b] = [poolPts[i], poolPts[(i + 1) % 4]]; segBox(M.white2, a[0], a[1], b[0], b[1], 0.06, 0.5, PH + 0.03); }
  for (let i = 0; i < 4; i++) box(ext, M.stone, 0.42, (i + 1) * PH / 4, 7, 61.5 + i * 0.42, (i + 1) * PH / 8, -15);
  for (const [w, d, x, z] of [[28, 0.04, 77, -28.98], [28, 0.04, 77, -1.02], [0.04, 28, 90.98, -15], [0.04, 10, 63.02, -24], [0.04, 10, 63.02, -6]]) {
    box(ext, M.rail, w, 1.0, d, x, PH + 0.5, z, { cast: false }); box(ext, M.steel, Math.max(w, 0.06), 0.05, Math.max(d, 0.06), x, PH + 1.02, z); }
  for (let i = 0; i < 5; i++) {
    const q = grp(89, PH, -20 + i * 2.8, -Math.PI / 2);
    box(q, M.white2, 0.7, 0.28, 1.4, 0, 0.2, 0.25, { round: 0.05 }); box(q, M.linen, 0.62, 0.08, 1.3, 0, 0.37, 0.27, { round: 0.04 });
    box(q, M.linen, 0.62, 0.08, 0.8, 0, 0.62, -0.6, { round: 0.04 }).rotation.x = -0.8;
    if (i % 2 === 0) umbrella(90.2, PH, -18.6 + i * 2.8);
  }
  { const q = grp(77, PH, -26.5);
    for (const [p, r] of [[-2.4, -1.8], [2.4, -1.8], [-2.4, 1.8], [2.4, 1.8]]) box(q, M.wood, 0.2, 2.8, 0.2, p, 1.4, r);
    for (let i = 0; i < 8; i++) box(q, M.wood, 5.2, 0.1, 0.2, 0, 2.85, -1.75 + i * 0.5);
    box(q, M.white2, 2.4, 0.45, 2.2, 0, 0.23, 0, { round: 0.08 }); box(q, M.linen, 2.3, 0.15, 2.1, 0, 0.52, 0, { round: 0.06 });
    for (let i = 0; i < 4; i++) box(q, [M.fabricRust, M.fabricSage, M.linen, M.fabricRust][i], 0.5, 0.4, 0.14, -0.8 + i * 0.53, 0.75, -0.95, { round: 0.06 }); }
  for (const [x, z] of [[64.2, -27.8], [89.8, -27.8], [64.2, -2.2], [89.8, -2.2]]) { box(ext, M.charcoal, 1.3, 0.8, 1.3, x, PH + 0.4, z); palm(ext, x, z, 6 + rand() * 2, 0.5).position.y = PH + 0.6; }
  box(ext, M.white, 12, 3.2, 4.2, 77, 1.6, -34); box(ext, M.wood, 12.4, 0.5, 4.6, 77, 3.4, -34);          // 04 dress changing rooms
  for (let i = 0; i < 4; i++) box(ext, M.teak, 0.9, 2.1, 0.06, 72.5 + i * 3, 1.05, -31.87);
  for (const [x, z] of [[88, -36], [66, -36], [88, 8], [84, 14]]) palm(ext, x, z, 9 + rand() * 2, 0.7);       // 05 park
  for (const [x, z] of [[72, 8], [78, 4], [64, 10]]) tree(ext, x, z, 1.4);
  bench(74, 2.5, Math.PI); bench(80, 2.5, Math.PI);

  // 07 EV charging point, north-west: solar canopy, superchargers, Cybertrucks
  const poly = (pts, depth) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2); };
  const ctBody = poly([[2.85, 0.42], [2.85, 0.98], [2.72, 1.1], [0.25, 1.9], [-2.85, 1.3], [-2.85, 0.42]], 2.0);
  const ctGlass = poly([[1.95, 1.33], [0.25, 1.915], [-1.6, 1.545], [-1.6, 1.33]], 2.04);
  const cyberTruck = (x, z, ry) => { const q = grp(x, 0, z, ry);
    const b = new THREE.Mesh(ctBody, M.steel); b.castShadow = b.receiveShadow = true; q.add(b); q.add(new THREE.Mesh(ctGlass, M.black));
    box(q, M.black, 5.72, 0.3, 2.06, 0, 0.55, 0, { cast: false });
    box(q, M.lampGlow, 0.03, 0.05, 1.9, 2.86, 1.0, 0, { cast: false }); box(q, M.red, 0.03, 0.05, 1.9, -2.86, 1.24, 0, { cast: false });
    for (const [wx, wz] of [[1.85, 0.93], [1.85, -0.93], [-1.9, 0.93], [-1.9, -0.93]]) {
      cyl(q, M.black, 0.43, 0.43, 0.32, wx, 0.43, wz, 20).rotation.x = Math.PI / 2; cyl(q, M.steel, 0.3, 0.3, 0.34, wx, 0.43, wz, 6).rotation.x = Math.PI / 2; }
    return q; };
  const EZ = -31;
  for (let i = 0; i < 4; i++) {
    const x = -76 + i * 3.6;
    box(ext, M.ev, 3.1, 0.03, 5.8, x, 0.09, EZ, { cast: false }); box(ext, M.line, 0.08, 0.035, 5.8, x - 1.6, 0.1, EZ, { cast: false });
    if (i % 2 === 0) cyberTruck(x, EZ + 0.1, Math.PI / 2); else car(ext, x, EZ + 0.2, Math.PI, M.carWhite);
    box(ext, M.white2, 0.42, 1.75, 0.28, x + 1.05, 0.88, EZ - 3.3, { round: 0.1 });
    box(ext, M.ev, 0.05, 1.3, 0.3, x + 0.84, 0.95, EZ - 3.3, { cast: false }); box(ext, M.black, 0.3, 0.36, 0.02, x + 1.05, 1.35, EZ - 3.15, { cast: false });
    ext.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x + 1.05, 1.0, EZ - 3.15), new THREE.Vector3(x + 0.9, 0.35, EZ - 2.65), new THREE.Vector3(x + 0.4, 0.8, EZ - 2.3)]), 12, 0.035, 6), M.black));
  }
  for (const x of [-78, -63.2]) for (const z of [EZ - 3.8, EZ + 3.4]) box(ext, M.steel, 0.2, 3.6, 0.2, x, 1.8, z);
  for (const z of [EZ - 3.8, EZ + 3.4]) box(ext, M.steel, 15.6, 0.18, 0.18, -70.6, 3.62, z);
  const panels = []; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) panels.push([-77.4 + i * 1.95, 3.78 + j * 0.14, EZ - 3.0 + j * 1.9, 1.85, 0.05, 1.8]);
  inst(unitBox, M.solar, panels); box(ext, M.cove, 15, 0.03, 0.1, -70.6, 3.52, EZ - 0.2, { cast: false });
  sign('EV CHARGING', 'SOLAR POWERED', 4.8, 1.2, -70.6, 2.75, EZ + 3.45);
  box(ext, M.white, 6, 3.4, 10, -64, 1.7, -16); box(ext, M.wood, 6.4, 0.4, 10.4, -64, 3.6, -16);                  // 08 guest rooms
  for (let i = 0; i < 3; i++) { box(ext, M.teak, 0.06, 2.1, 0.9, -60.97, 1.05, -19.5 + i * 3.5); box(ext, M.facadeGlass, 0.06, 1.2, 1.4, -60.97, 1.9, -18 + i * 3.5, { cast: false }); }
  box(ext, M.charcoal, 6, 2.2, 5, -98, 1.1, 34); sign('STP', '', 2, 0.8, -98, 1.4, 31.45);                      // 19 STP

  // 18 kids play area, east of the club house
  const KX = -79, KZ = 8.5;
  box(ext, M.rubber, 15, 0.06, 9.5, KX, 0.09, KZ, { cast: false }); box(ext, M.play, 6, 0.065, 4, KX - 3.5, 0.095, KZ + 1, { cast: false });
  for (const [w, d, x, z] of [[15.3, 0.25, KX, KZ - 4.85], [15.3, 0.25, KX, KZ + 4.85], [0.25, 9.5, KX - 7.6, KZ], [0.25, 9.5, KX + 7.6, KZ]]) box(ext, M.wood, w, 0.3, d, x, 0.15, z);
  const T0 = KX - 4.5, T1 = KZ;
  for (const [p, q] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(ext, M.blue, 0.14, 3.2, 0.14, T0 + p, 1.6, T1 + q);
  box(ext, M.wood, 2, 0.12, 2, T0, 1.5, T1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), M.red); roof.position.set(T0, 3.65, T1); roof.rotation.y = Math.PI / 4; roof.castShadow = true; ext.add(roof);
  for (const s of [-1, 1]) box(ext, M.ylw, 1.8, 0.7, 0.06, T0, 1.95, T1 + s * 0.93);
  for (let i = 0; i < 5; i++) box(ext, M.ylw, 0.06, 0.06, 1.6, T0 + 0.93, 0.3 + i * 0.3, T1);
  box(ext, M.red, 0.6, 0.06, 3.0, T0, 0.78, T1 + 2.3).rotation.x = 0.52;
  for (const s of [-1, 1]) box(ext, M.red, 0.05, 0.22, 3.0, T0 + s * 0.3, 0.88, T1 + 2.3).rotation.x = 0.52;
  const hel = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 1.6 + Math.PI; hel.push(new THREE.Vector3(T0 - 1.9 + Math.cos(a) * 1.1, 1.55 - (i / 24) * 1.25, T1 + Math.sin(a) * 1.1)); }
  ext.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel), 48, 0.36, 12), M.ylw), { castShadow: true }));
  const SW0 = KX + 1.5, SW1 = KZ - 2.4, swings = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(ext, M.blue, 0.1, 2.8, 0.1, SW0 + s * 1.6, 1.35, SW1 + t * 0.55).rotation.x = -t * 0.2;
  box(ext, M.blue, 3.4, 0.12, 0.12, SW0, 2.65, SW1);
  for (const dx of [-0.7, 0.7]) { const pv = grp(SW0 + dx, 2.6, SW1); for (const s of [-1, 1]) box(pv, M.charcoal, 0.02, 2.05, 0.02, s * 0.22, -1.02, 0, { cast: false }); box(pv, M.red, 0.5, 0.05, 0.26, 0, -2.05, 0); swings.push(pv); }
  anims.push((t) => swings.forEach((p, i) => (p.rotation.x = Math.sin(t * 1.9 + i * 1.7) * 0.55)));
  cyl(ext, M.ylw, 0.12, 0.2, 0.5, KX + 5, 0.3, KZ + 2.5, 10);
  const ss = grp(KX + 5, 0.55, KZ + 2.5); box(ss, M.blue, 3.4, 0.08, 0.3, 0, 0, 0);
  for (const s of [-1, 1]) { box(ss, M.red, 0.32, 0.06, 0.32, s * 1.5, 0.05, 0); box(ss, M.ylw, 0.04, 0.3, 0.3, s * 1.22, 0.2, 0); }
  anims.push((t) => (ss.rotation.z = Math.sin(t * 1.4) * 0.22));
  const mg = grp(KX + 5.4, 0, KZ - 2.2); cyl(mg, M.ylw, 1.1, 1.1, 0.12, 0, 0.32, 0, 24); cyl(mg, M.blue, 0.06, 0.06, 1.0, 0, 0.8, 0, 8);
  for (let i = 0; i < 4; i++) box(mg, M.red, 0.05, 0.6, 0.05, Math.cos(i * Math.PI / 2) * 0.8, 0.65, Math.sin(i * Math.PI / 2) * 0.8);
  anims.push((t, s) => (mg.rotation.y += s * 0.8));
  const riders = [];
  for (const [x, z, m] of [[KX - 0.6, KZ + 3, M.ylw], [KX + 1.6, KZ + 3.3, M.red]]) {
    const r = grp(x, 0.1, z); cyl(ext, M.charcoal, 0.1, 0.1, 0.45, x, 0.32, z, 10);
    const b = new THREE.Mesh(blobGeo, m); b.scale.set(0.3, 0.26, 0.55); b.position.y = 0.72; b.castShadow = true; r.add(b);
    const hd = new THREE.Mesh(blobGeo, m); hd.scale.setScalar(0.2); hd.position.set(0, 1.0, 0.45); r.add(hd);
    anims.push((t) => (r.rotation.x = Math.sin(t * 3 + x) * 0.12)); riders.push(r);
  }
  bench(KX - 3, KZ + 4.4, Math.PI); bench(KX + 3, KZ + 4.4, Math.PI);
  tree(ext, KX - 8.5, KZ + 6, 1.5); tree(ext, KX + 9, KZ - 6, 1.4);
  Object.assign(playRefs, { swings, ss, mg, riders, T0, T1, KX, KZ });

  // 16 shuttle court, 15 cricket practice net (north end), 20 half basketball court (courtyard)
  box(ext, M.court, 7, 0.04, 14, -99, 0.1, -6, { cast: false });
  inst(unitBox, M.line, [[-102.4, 0.13, -6, 0.08, 0.01, 13.6], [-95.6, 0.13, -6, 0.08, 0.01, 13.6], [-99, 0.13, -12.8, 6.9, 0.01, 0.08], [-99, 0.13, 0.8, 6.9, 0.01, 0.08], [-99, 0.13, -6, 6.9, 0.01, 0.06]], false);
  for (const z of [-6]) for (const x of [-102.6, -95.4]) cyl(ext, M.charcoal, 0.04, 0.04, 1.55, x, 0.78, z, 6);
  box(ext, M.net, 7.2, 0.76, 0.02, -99, 1.17, -6, { cast: false });
  box(ext, M.trunk, 3, 0.04, 18, -99, 0.1, -27, { cast: false }); box(ext, M.net, 3.8, 3.4, 18, -99, 1.72, -27, { cast: false });
  box(ext, M.courtOr, 13, 0.04, 13, -12, 0.12, 0, { cast: false }); box(ext, M.court, 4.9, 0.01, 5.8, -12, 0.15, -3.5, { cast: false });
  cyl(ext, M.charcoal, 0.1, 0.1, 3.4, -12, 1.7, -6.8, 8); box(ext, M.line, 1.8, 1.05, 0.06, -12, 3.3, -6.35);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 20), M.red); ring.rotation.x = Math.PI / 2; ring.position.set(-12, 3.05, -6.05); ext.add(ring);

  // club house: indoor games, gym, yoga / meditation, multipurpose hall, working pods; café deck facing the play area
  const CX = -82, CZ = -15;
  box(ext, M.stone, 25.6, 0.12, 15.6, CX, 0.06, CZ, { cast: false }); box(ext, M.deck, 24.6, 0.04, 14.6, CX, 0.14, CZ, { cast: false });
  for (const [w, d, x, z] of [[25, 0.05, CX, CZ + 7.5], [0.05, 15, CX - 12.5, CZ], [0.05, 15, CX + 12.5, CZ]]) box(ext, M.glass, w, 3.7, d, x, 1.95, z, { cast: false });
  for (let i = 0; i <= 8; i++) box(ext, M.frame, 0.08, 3.7, 0.1, CX - 12.5 + i * 3.125, 1.95, CZ + 7.5);
  box(ext, M.wood, 25, 3.8, 0.3, CX, 1.9, CZ - 7.4); box(ext, M.mirror, 12, 2.2, 0.03, CX - 4, 1.5, CZ - 7.22, { cast: false });
  box(ext, M.cove, 23, 0.04, 13, CX, 3.75, CZ, { cast: false });
  const cu = new THREE.Mesh(tiledBox(26, 3.8, 16), [M.windows, M.windows, M.plaster, M.plaster, M.windows, M.windows]);
  cu.position.set(CX, 5.9, CZ); cu.castShadow = cu.receiveShadow = true; ext.add(cu);
  box(ext, M.white, 27, 0.45, 17, CX, 3.95, CZ); box(ext, M.white, 27.4, 0.5, 17.4, CX, 8.05, CZ);
  for (let i = 0; i < 9; i++) box(ext, M.wood, 0.3, 3.8, 0.5, CX - 12 + i * 3, 5.9, CZ + 8.7);
  const tms = [CX - 11, CX - 8.5, CX - 6, CX - 3.5, CX - 1];
  for (const x of tms) {
    box(ext, M.charcoal, 0.8, 0.22, 1.9, x, 0.25, CZ + 4.4); box(ext, M.black, 0.6, 0.03, 1.6, x, 0.37, CZ + 4.35, { cast: false });
    for (const s of [-1, 1]) box(ext, M.charcoal, 0.06, 1.1, 0.06, x + s * 0.36, 0.85, CZ + 5.25);
    box(ext, M.charcoal, 0.8, 0.3, 0.12, x, 1.4, CZ + 5.28); box(ext, M.ev, 0.4, 0.2, 0.02, x, 1.42, CZ + 5.21, { cast: false });
  }
  box(ext, M.charcoal, 2.4, 0.9, 0.5, CX - 8, 0.6, CZ - 6.6);
  for (let i = 0; i < 8; i++) cyl(ext, M.black, 0.07, 0.07, 0.3, CX - 9.1 + i * 0.32, 1.1, CZ - 6.6, 10).rotation.z = Math.PI / 2;
  const mats = [[CX + 3, M.ev], [CX + 4.6, M.fabricRust], [CX + 6.2, M.blue]];
  for (const [x, m] of mats) box(ext, m, 0.65, 0.02, 1.8, x, 0.17, CZ + 1, { cast: false });
  box(ext, M.court, 2.7, 0.76, 1.5, CX + 8.5, 0.5, CZ - 3); box(ext, M.white, 2.75, 0.02, 0.02, CX + 8.5, 0.89, CZ - 3);   // table tennis
  box(ext, M.teak, 3, 1.05, 0.7, CX + 9, 0.6, CZ - 6.4); plant(ext, CX + 11.5, CZ + 6.5, 1.6); plant(ext, CX - 11.6, CZ + 6.5, 1.6);
  const clubLight = new THREE.PointLight(0xFFD9A8, 0, 26, 1.4); clubLight.position.set(CX, 3.3, CZ); ext.add(clubLight); interiorLights.push(clubLight);
  box(ext, M.deck, 25, 0.1, 4, CX, 0.12, CZ + 9.6, { cast: false });
  const cafe = [CX - 9, CX - 3, CX + 3, CX + 9];
  for (const x of cafe) { cyl(ext, M.white2, 0.45, 0.45, 0.04, x, 0.76, CZ + 9.6, 20); cyl(ext, M.charcoal, 0.04, 0.04, 0.72, x, 0.4, CZ + 9.6, 6); umbrella(x, 0.12, CZ + 9.6, 1.4);
    for (const s of [-1, 1]) { box(ext, M.wood, 0.45, 0.06, 0.45, x + s * 0.75, 0.47, CZ + 9.6); box(ext, M.wood, 0.06, 0.45, 0.45, x + s * 0.98, 0.72, CZ + 9.6); } }
  sign('CLUB HOUSE', 'GAMES  ·  GYM  ·  YOGA', 8, 2, CX, 9.4, CZ + 8.4);
  Object.assign(playRefs, { tms, mats, cafe, CZ });

  // 14 gazebos, 21 senior citizen lounge, 13 landscape garden
  for (const [x, z] of [[-97, -35], [-97, 27], [40, -34.5], [-40, -34.5]]) {
    for (const [p, q] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) box(ext, M.wood, 0.2, 2.7, 0.2, x + p, 1.35, z + q);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.4, 8), M.wood); rf.position.set(x, 3.4, z); rf.castShadow = true; ext.add(rf);
    for (const s of [-1, 1]) bench(x + s * 1.1, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  for (let i = 0; i < 9; i++) box(ext, M.wood, 0.18, 0.2, 5, 12 + i, 2.9, 0);
  for (const [p, q] of [[11.5, -2.3], [20.5, -2.3], [11.5, 2.3], [20.5, 2.3]]) box(ext, M.white, 0.3, 2.8, 0.3, p, 1.4, q);
  bench(14, -1.2, 0); bench(18, -1.2, 0); for (const x of [30, 42]) { cyl(ext, M.stone, 1.7, 1.8, 0.6, x, 0.3, 0, 24); tree(ext, x, 0, 1.5); bench(x - 2.6, 3, Math.PI); bench(x + 2.6, 3, Math.PI); }
  for (let x = -100; x <= 62; x += 10) palm(ext, x + rand() * 2, 39, 7.5 + rand() * 2, 0.5);
  for (let x = -100; x <= 88; x += 9) tree(ext, x + rand() * 3, -38.4, 1.2 + rand() * 0.5);
  for (let z = -30; z <= 30; z += 9) tree(ext, -102, z, 1.3);
  const fl1 = [], fl2 = [];
  for (let x = -100; x <= 62; x += 0.9) (rand() < 0.5 ? fl1 : fl2).push([x, 0.28, 37.6 + rand() * 0.5, 0.32, 0.26, 0.32]);
  inst(blobGeo, M.flower, fl1); inst(blobGeo, M.flower2, fl2);
  for (let x = 12; x <= 56; x += 3) { for (const z of [27.4, 29.4]) box(ext, M.wood, 0.16, 2.7, 0.16, x, 1.35, z); box(ext, M.wood, 0.14, 0.2, 2.4, x, 2.75, 28.4); }
  for (const z of [27.4, 29.4]) box(ext, M.wood, 44.4, 0.18, 0.14, 34, 2.62, z);
  const creep = []; for (let x = 12; x <= 56; x += 1.2) creep.push([x, 2.95, 28.4 + (rand() - 0.5) * 1.4, 0.7, 0.3, 0.7]);
  inst(blobGeo, M.leaf, creep);
  for (let x = -54; x <= 52; x += 6) { cyl(ext, M.pot, 0.35, 0.28, 0.6, x, 0.3, 26.4, 12); bush(ext, x, 0.9, 26.4, 0.42, M.leaf); cyl(ext, M.pot, 0.35, 0.28, 0.6, x, 0.3, -25.2, 12); bush(ext, x, 0.9, -25.2, 0.42, M.leaf2); }
}

/* supplied models: cars, scooter, pool (assets/models, meshopt + webp) */
{
  const gl = new GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
  const load = (n) => new Promise((res) => gl.load(`assets/models/${n}.glb`, (g) => res(g.scene), undefined, () => res(null)));
  const fit = (obj, len, ry = 0) => {        // scale to a real length, centre on x/z, stand on the ground
    const w = new THREE.Group(); w.add(obj); obj.rotation.y = ry;
    let bb = new THREE.Box3().setFromObject(obj); const sz = bb.getSize(new THREE.Vector3());
    if (len) obj.scale.multiplyScalar(len / Math.max(sz.x, sz.z));
    bb = new THREE.Box3().setFromObject(obj); const c = bb.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= bb.min.y;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return w;
  };
  Promise.all(['camaro', 'K578', 'm05h', 'raptor', 'vino', 'pool'].map(load)).then(([camaro, k578, m05h, raptor, vino, pool]) => {
    const cars = [[camaro, 4.8], [k578, 4.6], [m05h, 4.7], [raptor, 5.9]].filter((c) => c[0]).map(([s, l]) => fit(s, l));
    if (cars.length) carSlots.forEach((g, i) => { g.clear(); g.add(cars[i % cars.length].clone()); });
    if (vino) {
      const v = fit(vino, 0);
      for (const x0 of [-23, 6]) for (let i = 0; i < 12; i++) { const s = v.clone(); s.position.set(x0 + i * 0.9, 0, -16); ext.add(s); }
    }
    if (false && pool) {                             // the FBX shipped without its texture files, so map its named materials to ours
      const poolTile = new THREE.MeshStandardMaterial({ color: 0x7FC6D6, roughness: 0.35 });
      const poolWater = new THREE.MeshPhysicalMaterial({ color: 0x1EA9C4, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.82, emissive: 0x16C4D6, emissiveIntensity: 0.08 });
      const map = { SwimmingPoolTiles: poolTile, StoneTiles: M.stone, SwimmingPoolEdgeTiles: M.white, Water: poolWater };
      pool.traverse((o) => { if (o.isMesh) o.material = map[o.material.name] || o.material; });
      M.poolWater = poolWater;
      const cau = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,255,255,.6)'; g.lineWidth = 2;
        for (let i = 0; i < 40; i++) { g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; g.quadraticCurveTo(x + 20, y - 20, x, y); } g.stroke(); } }, true);
      cau.repeat.set(3, 3); poolWater.emissiveMap = cau; poolWater.emissive.set(0xBFF6FF);
      anims.push((t) => cau.offset.set(Math.sin(t * 0.3) * 0.05 + t * 0.01, Math.cos(t * 0.27) * 0.05));
      const p = fit(pool, 0, Math.PI / 2); p.position.set(80, 0.01, 6); ext.add(p);
    }
    dirty = true;
  });
}

/* walking / jogging track with people on it */
let trackCurve;
{
  const outer = rr(new THREE.Shape(), 120.4, 63.4, 9.2), hole = rr(new THREE.Path(), 115.6, 58.6, 6.8);
  outer.holes.push(hole);
  const tr = new THREE.Mesh(new THREE.ShapeGeometry(outer, 24), M.track);
  tr.rotation.x = -Math.PI / 2; tr.position.set(0, 0.11, 0.5); tr.receiveShadow = true; ext.add(tr);
  const mid = rr(new THREE.Shape(), 118, 61, 8);
  trackCurve = new THREE.CatmullRomCurve3(mid.getSpacedPoints(600).slice(0, -1).map((p) => new THREE.Vector3(p.x, 0.12, -p.y + 0.5)), true);
}
const trackLen = trackCurve.getLength(), roadLen = roadCurve.getLength(), _rp = new THREE.Vector3(), _rt = new THREE.Vector3();
/* ---------- people: proportioned bodies (hips, knees, shoulders, elbows) with a real walk cycle ---------- */
const HG = {
  torso: new THREE.CapsuleGeometry(0.15, 0.36, 4, 12), hips: new THREE.CapsuleGeometry(0.135, 0.06, 4, 12),
  thigh: new THREE.CapsuleGeometry(0.07, 0.36, 4, 10), shin: new THREE.CapsuleGeometry(0.056, 0.36, 4, 10),
  upper: new THREE.CapsuleGeometry(0.048, 0.24, 4, 8), fore: new THREE.CapsuleGeometry(0.04, 0.22, 4, 8),
  head: new THREE.SphereGeometry(0.11, 18, 14), hair: new THREE.SphereGeometry(0.118, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  neck: new THREE.CylinderGeometry(0.045, 0.052, 0.12, 10), shoe: new THREE.BoxGeometry(0.1, 0.07, 0.25),
  hand: new THREE.SphereGeometry(0.045, 8, 6), skirt: new THREE.CylinderGeometry(0.17, 0.32, 0.56, 16, 1, true),
};
const sm = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const SKIN = [0x8D5B3E, 0xA86F4C, 0xC48A62, 0x6E4630].map((c) => sm(c, 0.6));
const CLOTH = [0xF2EEE6, 0x2F4E73, 0xB86A45, 0x8FA388, 0xD8402F, 0x3B3F46, 0xE9CE8E, 0x6D3E5E, 0x1F8F8A, 0xFFFFFF, 0xC2185B, 0xF3A712].map((c) => sm(c));
const HAIR = sm(0x17110D, 0.55), GREY = sm(0x9A9894, 0.6), SHOE = sm(0x222222, 0.5);
const PANTS = [sm(0x34465F, 0.9), CLOTH[5], CLOTH[0], sm(0x8B7355, 0.9), sm(0x1E1E1E, 0.9)];
const UNIFORM = sm(0x23324A);
const pick = (a) => a[(rand() * a.length) | 0];
const dsm = (m) => m.userData.ds || (m.userData.ds = Object.assign(m.clone(), { side: THREE.DoubleSide }));
function mesh(geo, mat, p, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; }
function human(parent, o = {}) {
  const skin = o.skin || pick(SKIN), top = o.top || pick(CLOTH), leg = o.leg || pick(PANTS), hairM = o.hair || HAIR;
  const g = new THREE.Group(); g.scale.setScalar(o.scale || 0.9 + rand() * 0.1); parent.add(g);
  const body = new THREE.Group(); body.position.y = 0.92; g.add(body);
  mesh(HG.hips, o.dress ? top : leg, body, 0, 0.02, 0).rotation.z = Math.PI / 2;
  const chest = new THREE.Group(); chest.position.y = 0.06; body.add(chest);
  mesh(HG.torso, top, chest, 0, 0.3, 0).scale.set(o.female ? 1.02 : 1.14, 1, 0.7);
  mesh(HG.neck, skin, chest, 0, 0.64, 0);
  const head = new THREE.Group(); head.position.y = 0.77; chest.add(head);
  mesh(HG.head, skin, head).scale.set(0.9, 1.08, 1);
  mesh(HG.hair, hairM, head, 0, 0.016, -0.01).scale.set(0.96, 1.04, 1.06);
  if (o.female) mesh(HG.torso, hairM, head, 0, -0.13, -0.075).scale.set(0.6, 0.34, 0.32);
  if (o.dress) mesh(HG.skirt, dsm(top), body, 0, -0.26, 0);
  const limb = (px, py, g1, g2, m1, m2, l1, l2, par) => { const a = new THREE.Group(); a.position.set(px, py, 0); par.add(a); mesh(g1, m1, a, 0, -l1 / 2, 0); const b = new THREE.Group(); b.position.y = -l1; a.add(b); mesh(g2, m2, b, 0, -l2 / 2, 0); return [a, b]; };
  const lowLeg = o.shorts || o.dress ? skin : leg;
  const [hipL, kneeL] = limb(-0.09, -0.02, HG.thigh, HG.shin, o.shorts ? leg : (o.dress ? skin : leg), lowLeg, 0.43, 0.42, body);
  const [hipR, kneeR] = limb(0.09, -0.02, HG.thigh, HG.shin, o.shorts ? leg : (o.dress ? skin : leg), lowLeg, 0.43, 0.42, body);
  for (const k of [kneeL, kneeR]) mesh(HG.shoe, o.shoe || SHOE, k, 0, -0.44, 0.05);
  const arm = o.sleeveless ? skin : top;
  const [shL, elL] = limb(-0.215, 0.56, HG.upper, HG.fore, arm, skin, 0.3, 0.27, chest);
  const [shR, elR] = limb(0.215, 0.56, HG.upper, HG.fore, arm, skin, 0.3, 0.27, chest);
  for (const e of [elL, elR]) mesh(HG.hand, skin, e, 0, -0.29, 0);
  shL.rotation.z = -0.07; shR.rotation.z = 0.07; elL.rotation.x = elR.rotation.x = -0.15;
  return { g, body, chest, head, hipL, hipR, kneeL, kneeR, shL, shR, elL, elR, ph: rand() * 6 };
}
function walkPose(h, ph, run) {
  const s = Math.sin(ph), c = Math.cos(ph), A = run ? 0.75 : 0.42, K = run ? 2.3 : 1.5;
  h.hipL.rotation.x = -s * A; h.hipR.rotation.x = s * A;
  h.kneeL.rotation.x = Math.max(0, c) * A * K + 0.05; h.kneeR.rotation.x = Math.max(0, -c) * A * K + 0.05;
  h.shL.rotation.x = s * A * 0.85; h.shR.rotation.x = -s * A * 0.85;
  h.elL.rotation.x = h.elR.rotation.x = run ? -1.45 : -0.18 - Math.abs(s) * 0.15;
  h.body.position.y = 0.92 - Math.abs(s) * (run ? 0.05 : 0.025) + (run ? 0.03 : 0);
  h.chest.rotation.x = run ? 0.18 : 0.04; h.body.rotation.y = s * 0.07; h.chest.rotation.y = -s * 0.1; h.head.rotation.y = s * 0.05;
}
function sitPose(h, lean = 0) {
  h.body.position.y = 0.47; h.hipL.rotation.x = h.hipR.rotation.x = -1.5; h.kneeL.rotation.x = h.kneeR.rotation.x = 1.5;
  h.hipL.rotation.z = -0.06; h.hipR.rotation.z = 0.06; h.shL.rotation.x = h.shR.rotation.x = -0.4; h.elL.rotation.x = h.elR.rotation.x = -0.75; h.chest.rotation.x = lean;
}
function lounge(h) { sitPose(h, -0.95); h.body.position.y = 0.36; h.kneeL.rotation.x = 0.1; h.kneeR.rotation.x = 0.35; h.hipR.rotation.x = -1.3; h.shL.rotation.x = h.shR.rotation.x = 0.3; }
function treePose(h) { h.shL.rotation.z = -2.95; h.shR.rotation.z = 2.95; h.elL.rotation.x = h.elR.rotation.x = 0; h.hipR.rotation.set(-0.6, 0, 0.9); h.kneeR.rotation.x = 2.3; }
const sitAt = (par, x, y, z, ry, o, lean) => { const h = human(par, o); h.g.position.set(x + Math.sin(ry) * 0.25, y, z + Math.cos(ry) * 0.25); h.g.rotation.y = ry; sitPose(h, lean); return h; };
const standAt = (par, x, y, z, ry, o) => { const h = human(par, o); h.g.position.set(x, y, z); h.g.rotation.y = ry; return h; };

// joggers and walkers on the track
const runners = [3.2, 2.8, -1.3, 3.0, -1.1, 2.6, 1.2].map((v, i) => {
  const f = i % 3 === 1;
  const h = human(ext, Math.abs(v) > 2 ? { shorts: true, sleeveless: i % 2 === 0, female: f, top: CLOTH[[4, 1, 8, 10, 11][i % 5]], leg: PANTS[4] } : { female: f, dress: f });
  return Object.assign(h, { v, t: i / 7, run: Math.abs(v) > 2 });
});
let followSeg = -1, followR = runners[0];
const _n = new THREE.Vector3();
function moveRunners(sec) {
  for (const r of runners) {
    r.t = (r.t + (r.v * sec) / trackLen + 1) % 1;
    const p = trackCurve.getPointAt(r.t), tg = trackCurve.getTangentAt(r.t).multiplyScalar(Math.sign(r.v));
    r.ph += sec * Math.abs(r.v) * (r.run ? 2.9 : 4.4);
    r.g.position.set(p.x, 0.11, p.z); r.g.rotation.y = Math.atan2(tg.x, tg.z); walkPose(r, r.ph, r.run); r.tg = tg;
  }
}
// people walking on the paths
const walkers = [];
const walker = (a, b, o, t = rand()) => walkers.push({ h: human(ext, o), a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), t, dir: 1, v: 1.2 + rand() * 0.3, ph: rand() * 6 });
walker([-60, 0.12, 34.4], [70, 0.12, 34.4], { female: true, dress: true }, 0.2); walker([-59, 0.12, 35], [70, 0.12, 35], {}, 0.2);
walker([66, 0.12, 35.6], [-40, 0.12, 35.6], {}, 0.6); walker([12, 0.12, 28.1], [56, 0.12, 28.1], { female: true }, 0.4);
walker([13, 0.12, 28.7], [56, 0.12, 28.7], { scale: 0.62 }, 0.42); walker([-50, 0.12, -26.4], [50, 0.12, -26.4], {}, 0.3);
walker([50, 0.12, -27], [-30, 0.12, -27], { female: true, dress: true }, 0.7); walker([57, 0.12, 23.5], [57, 0.12, 34], {}, 0.5);
walker([-59, 0.12, -24], [-59, 0.12, 30], { female: true }, 0.1);
anims.push((t, sec) => {
  for (const w of walkers) {
    const L = w.a.distanceTo(w.b); w.t += (w.dir * w.v * sec) / L;
    if (w.t > 1) { w.t = 1; w.dir = -1; } else if (w.t < 0) { w.t = 0; w.dir = 1; }
    w.h.g.position.lerpVectors(w.a, w.b, w.t);
    w.h.g.rotation.y = Math.atan2((w.b.x - w.a.x) * w.dir, (w.b.z - w.a.z) * w.dir);
    w.ph += sec * w.v * 4.4; walkPose(w.h, w.ph, false);
  }
});
{
  const P = playRefs;
  // pool: loungers, a swimmer, a friend at the edge
  for (const i of [1, 3]) { const h = standAt(ext, 88.75, PH + 0.08, -20 + i * 2.8, -Math.PI / 2, { sleeveless: true, shorts: true, female: i === 3 }); lounge(h); }
  const sw = standAt(ext, 78, PH - 0.2, -15, Math.PI / 2, { sleeveless: true, shorts: true }); sw.g.rotation.order = 'YXZ'; sw.g.rotation.x = Math.PI / 2 - 0.1;
  anims.push((t, sec) => { const x = 78 + Math.sin(t * 0.18) * 5.5, d = Math.cos(t * 0.18); sw.g.position.x = x; sw.g.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2;
    sw.shL.rotation.x = -t * 4; sw.shR.rotation.x = -t * 4 + Math.PI; sw.hipL.rotation.x = Math.sin(t * 9) * 0.3; sw.hipR.rotation.x = -Math.sin(t * 9) * 0.3; });
  const ps = standAt(ext, 65.2, PH + 0.05, -9.5, Math.PI / 2, { female: true, dress: true, top: CLOTH[10] }); ps.shR.rotation.x = -0.4;
  sitAt(ext, 76, PH + 0.05, -6.0, Math.PI, { female: true, top: CLOTH[6] }, -0.3);
  // EV bay, lobby, gate
  const ev = standAt(ext, -74.2, 0.1, -33.1, -2.5, {}); ev.shR.rotation.x = -0.8; ev.elR.rotation.x = -0.6;
  standAt(ext, 60, 0.1, 12, Math.PI / 2, { top: UNIFORM, leg: UNIFORM });
  standAt(ext, 73, 0.1, 25.5, 0.9, { top: UNIFORM, leg: UNIFORM });
  standAt(ext, 58.4, 0.1, 21, Math.PI, { female: true, dress: true, top: CLOTH[7] }).shL.rotation.x = -0.3;
  // kids at play
  const kid = (o = {}) => Object.assign({ scale: 0.6 + rand() * 0.06, top: pick([CLOTH[4], CLOTH[11], CLOTH[1], CLOTH[8], CLOTH[10]]), shorts: true }, o);
  P.swings.forEach((pv) => { const k = human(pv, kid()); k.g.position.set(0, -2.32, 0.02); sitPose(k); k.shL.rotation.x = k.shR.rotation.x = -2.7; k.elL.rotation.x = k.elR.rotation.x = 0; });
  for (const s of [-1, 1]) { const k = human(P.ss, kid({ female: s > 0 })); k.g.position.set(s * 1.5, -0.24, 0); k.g.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; sitPose(k); k.shL.rotation.x = k.shR.rotation.x = -1.1; }
  const kr = human(P.riders[0], kid()); kr.g.position.set(0, 0.62, -0.05); sitPose(kr); kr.shL.rotation.x = kr.shR.rotation.x = -1.2;
  const km = human(P.mg, kid({ female: true })); km.g.position.set(0.75, 0.38, 0); km.g.rotation.y = -Math.PI / 2; km.shR.rotation.x = -1.4;
  const kt = standAt(ext, P.T0, 1.56, P.T1 + 0.6, 0, kid()); kt.shL.rotation.z = -2.6; kt.shR.rotation.z = 2.6;
  const chase = [standAt(ext, 0, 0.1, 0, 0, kid()), standAt(ext, 0, 0.1, 0, 0, kid({ female: true }))];
  anims.push((t, sec) => chase.forEach((k, i) => { const a = t * 0.9 + i * 0.6; k.g.position.set(P.KX + Math.cos(a) * 2.2, 0.1, P.KZ + 1 + Math.sin(a) * 1.4); k.g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * 0.64); walkPose(k, t * 9 + i, true); }));
  sitAt(ext, P.KX - 3, 0.1, P.KZ + 4.4, Math.PI, { female: true, dress: true, top: CLOTH[2] });
  sitAt(ext, P.KX + 3, 0.1, P.KZ + 4.4, Math.PI, {});
  standAt(ext, P.KX + 1.5, 0.1, P.KZ - 0.9, Math.PI, { female: true, top: CLOTH[8] }).shR.rotation.x = -0.9;
  // club house: treadmills, yoga, café
  P.tms.forEach((x, i) => { const h = standAt(ext, x, 0.38, P.CZ + 4.3, 0, { female: i % 2 === 1, shorts: true, sleeveless: i % 2 === 0, leg: PANTS[4] }); anims.push((t) => walkPose(h, t * (5 + i * 0.4) + i, i % 3 === 0)); });
  P.mats.forEach(([x], i) => { const h = standAt(ext, x, 0.18, P.CZ + 1, 0, { female: i !== 1, top: CLOTH[[0, 8, 9][i]], leg: PANTS[4] }); treePose(h); });
  P.cafe.forEach((x, i) => { if (i % 2) return; sitAt(ext, x - 0.75, 0.12, P.CZ + 9.6, Math.PI / 2, { female: true }); sitAt(ext, x + 0.75, 0.12, P.CZ + 9.6, -Math.PI / 2, {}); });
  // badminton, basketball, seniors, gazebo, courtyards
  for (const [z, ry] of [[-10.5, 0], [-1.5, Math.PI]]) { const h = standAt(ext, -99, 0.12, z, ry, { shorts: true }); anims.push((t) => { h.shR.rotation.x = -2.4 + Math.sin(t * 3 + z) * 0.7; h.body.position.y = 0.92 + Math.abs(Math.sin(t * 3 + z)) * 0.04; }); }
  const bb = standAt(ext, -12, 0.14, 1.5, Math.PI, { shorts: true, sleeveless: true }); anims.push((t) => { bb.shR.rotation.x = -0.9 + Math.sin(t * 6) * 0.25; bb.kneeL.rotation.x = bb.kneeR.rotation.x = 0.25 + Math.sin(t * 6) * 0.1; });
  sitAt(ext, 14, 0.1, -1.2, 0, { hair: GREY, top: CLOTH[0] }); sitAt(ext, 18, 0.1, -1.2, 0, { hair: GREY, female: true, dress: true, top: CLOTH[7] });
  sitAt(ext, 38.9, 0.1, -34.5, Math.PI / 2, { female: true, dress: true }); sitAt(ext, 41.1, 0.1, -34.5, -Math.PI / 2, {});
  sitAt(ext, -98.1, 0.1, 27, Math.PI / 2, { hair: GREY }); sitAt(ext, -95.9, 0.1, 27, -Math.PI / 2, { hair: GREY, female: true, dress: true });
  sitAt(ext, 27.4, 0.1, 3, Math.PI, { female: true }); sitAt(ext, 44.6, 0.1, 3, Math.PI, { hair: GREY }); sitAt(ext, 39.4, 0.1, 3, Math.PI, {});
}

const extLamps = [];
for (const x of [-80, -50, -20, 10, 40, 64]) {
  cyl(ext, M.charcoal, 0.06, 0.08, 3.6, x, 1.8, 32.4, 8);
  box(ext, M.lampGlow, 0.4, 0.25, 0.4, x, 3.65, 32.4, { cast: false });
  const l = new THREE.PointLight(0xFFB868, 0, 20, 1.8); l.position.set(x, 3.3, 32.4); ext.add(l); extLamps.push(l);
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
   THE HOMES, after the brochure's typical floor plan:
   3 BHK (flats 10, 16, 23; 1,695 sft) and 2 BHK (flat 12; 1,060 sft).
   Walls are found from the room rectangles. z = 0 is the balcony side.
   ===================================================================== */
const WH = 3.0, fans = [];
Object.assign(M, {
  dado: new THREE.MeshStandardMaterial({ color: 0xF7F4EE, map: bathTex, roughness: 0.3 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xC9A040, metalness: 0.9, roughness: 0.3 }),
  marigold: new THREE.MeshStandardMaterial({ color: 0xF29B1D, roughness: 0.8 }),
  rattan: new THREE.MeshStandardMaterial({ color: 0xB08A5A, roughness: 0.9, side: THREE.DoubleSide }),
  white3: new THREE.MeshStandardMaterial({ color: 0xFAFAF8, roughness: 0.35 }),
});
const at = (g, x, z, ry = 0, y = 0) => { const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = ry; g.add(q); return q; };
const ART = [['#E8C9A0', '#B86A45', '#F5EEDC'], ['#8FA388', '#2F4E73', '#E9CE8E'], ['#F3D9B8', '#8B5A2B', '#3F7A31'], ['#D9CBB5', '#6D3E5E', '#F2B632']];
/* furniture: each piece faces local +z with its back at local z = 0 */
const F = {
  sofa(g, x, z, ry, w = 2.4, mat = M.fabric) { const q = at(g, x, z, ry);
    box(q, mat, w, 0.42, 0.9, 0, 0.21, 0.45, { round: 0.06 }); box(q, mat, w, 0.5, 0.22, 0, 0.62, 0.11, { round: 0.08 });
    for (const s of [-1, 1]) box(q, mat, 0.18, 0.62, 0.9, s * (w / 2 - 0.09), 0.31, 0.45, { round: 0.06 });
    const n = Math.max(2, Math.round(w / 0.8)), cw = (w - 0.36) / n;
    for (let i = 0; i < n; i++) box(q, mat, cw - 0.03, 0.12, 0.64, -w / 2 + 0.18 + cw * (i + 0.5), 0.47, 0.5, { round: 0.05 });
    box(q, M.fabricRust, 0.42, 0.38, 0.13, -w / 2 + 0.45, 0.68, 0.3, { round: 0.06 }); box(q, M.fabricSage, 0.42, 0.38, 0.13, w / 2 - 0.45, 0.68, 0.3, { round: 0.06 }); return q; },
  armchair(g, x, z, ry, mat = M.fabricRust) { const q = at(g, x, z, ry);
    box(q, mat, 0.8, 0.42, 0.78, 0, 0.21, 0.4, { round: 0.12 }); box(q, mat, 0.8, 0.5, 0.16, 0, 0.62, 0.08, { round: 0.06 });
    for (const s of [-1, 1]) box(q, mat, 0.12, 0.25, 0.7, s * 0.36, 0.52, 0.42, { round: 0.05 }); },
  coffee(g, x, z) { const q = at(g, x, z);
    cyl(q, M.woodDark, 0.55, 0.55, 0.05, 0, 0.42, 0, 32); cyl(q, M.brass, 0.03, 0.03, 0.4, 0, 0.2, 0, 8); cyl(q, M.brass, 0.3, 0.3, 0.02, 0, 0.02, 0, 20);
    box(q, M.linen, 0.3, 0.04, 0.22, -0.15, 0.47, 0.05); box(q, M.fabricRust, 0.28, 0.03, 0.2, -0.15, 0.505, 0.05);
    cyl(q, M.ceramic, 0.06, 0.08, 0.22, 0.18, 0.55, -0.1, 12); bush(q, 0.18, 0.72, -0.1, 0.1, M.flower); },
  rug(g, x, z, w, d, mat = M.rug) { box(g, mat, w, 0.015, d, x, 0.008, z, { cast: false }); box(g, M.linen, w - 0.2, 0.017, d - 0.2, x, 0.009, z, { cast: false }).material = mat === M.rug ? M.fabric : M.linen; },
  tv(g, x, z, ry, w = 2.6) { const q = at(g, x, z, ry);
    box(q, M.wood, w, 2.6, 0.05, 0, 1.3, 0.025); box(q, M.cove, w, 0.02, 0.02, 0, 2.6, 0.06, { cast: false });
    box(q, M.cabinet, w * 0.9, 0.38, 0.42, 0, 0.3, 0.26, { round: 0.02 }); box(q, M.black, w * 0.9, 0.01, 0.01, 0, 0.3, 0.475, { cast: false });
    box(q, M.screen, 1.65, 0.95, 0.04, 0, 1.42, 0.08); box(q, M.black, 0.9, 0.07, 0.08, 0, 0.55, 0.3);
    cyl(q, M.ceramic, 0.08, 0.06, 0.32, -w * 0.32, 0.65, 0.3, 12); cyl(q, M.ceramic, 0.08, 0.06, 0.16, w * 0.36, 0.57, 0.3, 12); bush(q, w * 0.36, 0.75, 0.3, 0.14, M.leaf); },
  bed(g, x, z, ry, w, cover) { const q = at(g, x, z, ry);
    box(q, M.wood, w + 1.6, 2.5, 0.04, 0, 1.25, 0.02);
    box(q, M.fabric, w + 0.3, 1.15, 0.12, 0, 0.82, 0.1, { round: 0.05 });
    box(q, M.woodDark, w + 0.1, 0.3, 2.1, 0, 0.15, 1.15); box(q, M.linen, w, 0.22, 2.0, 0, 0.41, 1.12, { round: 0.08 });
    box(q, cover, w + 0.04, 0.08, 1.2, 0, 0.53, 1.55, { round: 0.04 }); box(q, M.fabricRust, w + 0.06, 0.09, 0.32, 0, 0.56, 1.95, { round: 0.04 });
    for (const s of [-1, 1]) { box(q, M.linen, w * 0.4, 0.14, 0.4, s * w * 0.24, 0.6, 0.38, { round: 0.07 }); box(q, M.woodDark, 0.5, 0.48, 0.42, s * (w / 2 + 0.42), 0.24, 0.3);
      cyl(q, M.brass, 0.02, 0.02, 0.25, s * (w / 2 + 0.42), 0.6, 0.3, 6); cyl(q, M.lampGlow, 0.1, 0.14, 0.2, s * (w / 2 + 0.42), 0.8, 0.3, 16); }
    box(q, M.fabricSage, w * 0.32, 0.26, 0.12, 0, 0.66, 0.55, { round: 0.06 }); box(q, M.fabric, w * 0.8, 0.42, 0.42, 0, 0.21, 2.5, { round: 0.06 }); },
  ward(g, x, z, ry, w, h = 2.4) { const q = at(g, x, z, ry), n = Math.max(2, Math.round(w / 0.55));
    box(q, M.wood, w, h, 0.6, 0, h / 2, 0.3);
    for (let i = 1; i < n; i++) box(q, M.black, 0.01, h - 0.06, 0.01, -w / 2 + (i * w) / n, h / 2, 0.605, { cast: false });
    for (let i = 0; i < n; i++) box(q, M.chrome, 0.02, 0.4, 0.03, -w / 2 + (w / n) * (i + (i % 2 ? 0.12 : 0.88)), 1.1, 0.62, { cast: false }); },
  dresser(g, x, z, ry) { const q = at(g, x, z, ry);
    box(q, M.woodDark, 1.2, 0.75, 0.45, 0, 0.4, 0.23); box(q, M.mirror, 0.7, 1.0, 0.02, 0, 1.4, 0.02, { cast: false }); box(q, M.brass, 0.78, 1.08, 0.01, 0, 1.4, 0.01, { cast: false });
    cyl(q, M.ceramic, 0.05, 0.05, 0.15, 0.4, 0.85, 0.25, 10); box(q, M.fabric, 0.45, 0.42, 0.4, 0, 0.21, 0.8, { round: 0.1 }); },
  desk(g, x, z, ry) { const q = at(g, x, z, ry);
    box(q, M.woodDark, 1.2, 0.04, 0.55, 0, 0.75, 0.28); for (const s of [-1, 1]) box(q, M.black, 0.04, 0.73, 0.5, s * 0.56, 0.37, 0.28);
    box(q, M.screen, 0.36, 0.24, 0.02, 0, 0.9, 0.18).rotation.x = -0.25; box(q, M.chrome, 0.36, 0.015, 0.25, 0, 0.775, 0.32);
    cyl(q, M.lampGlow, 0.08, 0.1, 0.12, -0.45, 1.05, 0.15, 12); cyl(q, M.black, 0.01, 0.01, 0.3, -0.45, 0.9, 0.15, 6);
    box(q, M.black, 0.5, 0.06, 0.5, 0, 0.46, 0.85, { round: 0.04 }); box(q, M.black, 0.5, 0.55, 0.06, 0, 0.78, 1.08, { round: 0.03 }); cyl(q, M.chrome, 0.03, 0.03, 0.42, 0, 0.21, 0.85, 6); },
  chair(g, x, z, ry) { const q = at(g, x, z, ry);
    box(q, M.fabric, 0.46, 0.08, 0.46, 0, 0.46, 0, { round: 0.03 }); box(q, M.fabric, 0.46, 0.48, 0.06, 0, 0.74, -0.21, { round: 0.03 });
    for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(q, M.woodDark, 0.035, 0.44, 0.035, a, 0.22, b); },
  dining(g, x, z, ry, len = 1.8) { const q = at(g, x, z, ry);
    box(q, M.woodDark, len, 0.05, 1.0, 0, 0.76, 0); for (const s of [-1, 1]) box(q, M.black, 0.08, 0.73, 0.8, s * (len / 2 - 0.25), 0.37, 0);
    box(q, M.linen, len - 0.4, 0.005, 0.32, 0, 0.79, 0, { cast: false });
    cyl(q, M.brass, 0.2, 0.12, 0.08, 0, 0.83, 0, 18); bush(q, 0, 0.9, 0, 0.13, M.marigold); bush(q, 0.1, 0.9, 0.05, 0.09, M.flower);
    const n = Math.round(len / 0.65);
    for (let i = 0; i < n; i++) { const cx = -len / 2 + (len / n) * (i + 0.5); F.chair(q, cx, -0.72, 0); F.chair(q, cx, 0.72, Math.PI); }
    F.chair(q, -len / 2 - 0.4, 0, Math.PI / 2); F.chair(q, len / 2 + 0.4, 0, -Math.PI / 2);
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const cx = -len / 2 + (len / n) * (i + 0.5); cyl(q, M.ceramic, 0.12, 0.12, 0.015, cx, 0.79, s * 0.32, 16); } },
  sideboard(g, x, z, ry, w = 1.4) { const q = at(g, x, z, ry);
    box(q, M.teak, w, 0.8, 0.42, 0, 0.45, 0.21); for (let i = 1; i < 3; i++) box(q, M.black, 0.01, 0.7, 0.01, -w / 2 + (i * w) / 3, 0.45, 0.425, { cast: false });
    cyl(q, M.brass, 0.1, 0.07, 0.3, -w * 0.3, 1.0, 0.2, 12); cyl(q, M.ceramic, 0.07, 0.05, 0.42, w * 0.3, 1.06, 0.2, 12); },
  fan(g, x, z) { cyl(g, M.white3, 0.015, 0.015, 0.35, x, WH - 0.18, z, 6); cyl(g, M.white3, 0.11, 0.11, 0.1, x, WH - 0.38, z, 16);
    const r = at(g, x, z, 0, WH - 0.38); for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.rotation.y = (i * Math.PI * 2) / 3; r.add(b); box(b, M.white3, 0.62, 0.012, 0.13, 0.4, 0, 0, { cast: false }); }
    fans.push(r); },
  ac(g, x, z, ry, y = 2.45) { const q = at(g, x, z, ry); box(q, M.white3, 0.95, 0.3, 0.22, 0, y, 0.11, { round: 0.06 }); box(q, M.black, 0.8, 0.015, 0.01, 0, y - 0.1, 0.225, { cast: false }); box(q, M.ev, 0.04, 0.015, 0.01, 0.38, y + 0.05, 0.225, { cast: false }); },
  puja(g, x, z, ry) { const q = at(g, x, z, ry);
    box(q, M.teak, 0.9, 0.8, 0.45, 0, 0.4, 0.23); box(q, M.teak, 0.9, 1.15, 0.05, 0, 1.38, 0.03); box(q, M.teak, 0.08, 1.15, 0.4, -0.41, 1.38, 0.2); box(q, M.teak, 0.08, 1.15, 0.4, 0.41, 1.38, 0.2);
    box(q, M.teak, 1.0, 0.1, 0.48, 0, 1.97, 0.23); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass); dome.position.set(0, 2.02, 0.23); q.add(dome);
    box(q, M.brass, 0.74, 0.02, 0.36, 0, 0.82, 0.22); bush(q, 0, 1.02, 0.15, 0.13, M.brass); bush(q, -0.22, 0.95, 0.15, 0.08, M.brass);
    cyl(q, M.lampGlow, 0.04, 0.05, 0.04, 0.22, 0.86, 0.3, 10); cyl(q, M.marigold, 0.012, 0.012, 0.03, 0.22, 0.9, 0.3, 6);
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) bush(q, s * 0.37, 1.85 - i * 0.12, 0.42, 0.035, i % 2 ? M.marigold : M.flower2);
    const l = new THREE.PointLight(0xFFB050, 1.2, 2.5, 2); l.position.set(0.22, 1.05, 0.45); q.add(l); },
  wc(g, x, z, ry) { const q = at(g, x, z, ry); box(q, M.ceramic, 0.38, 0.4, 0.55, 0, 0.2, 0.34, { round: 0.12 }); box(q, M.ceramic, 0.42, 0.06, 0.5, 0, 0.42, 0.36, { round: 0.03 }); box(q, M.ceramic, 0.42, 0.36, 0.17, 0, 0.6, 0.09, { round: 0.04 }); },
  basin(g, x, z, ry) { const q = at(g, x, z, ry); box(q, M.teak, 0.62, 0.42, 0.45, 0, 0.6, 0.23); box(q, M.ceramic, 0.58, 0.1, 0.44, 0, 0.86, 0.23, { round: 0.04 });
    cyl(q, M.chrome, 0.015, 0.015, 0.2, 0, 1.0, 0.06, 8); box(q, M.mirror, 0.6, 0.75, 0.02, 0, 1.5, 0.02, { cast: false }); box(q, M.cove, 0.6, 0.02, 0.02, 0, 1.9, 0.04, { cast: false }); },
  washer(g, x, z, ry) { const q = at(g, x, z, ry); box(q, M.white3, 0.6, 0.85, 0.6, 0, 0.43, 0.3, { round: 0.04 }); cyl(q, M.screen, 0.18, 0.18, 0.02, 0, 0.45, 0.6, 20).rotation.x = Math.PI / 2; },
  fridge(g, x, z, ry) { const q = at(g, x, z, ry); box(q, M.chrome, 0.76, 1.85, 0.7, 0, 0.93, 0.35, { round: 0.03 }); box(q, M.black, 0.01, 1.8, 0.01, 0, 0.93, 0.705, { cast: false });
    for (const s of [-1, 1]) box(q, M.black, 0.02, 0.5, 0.03, s * 0.05, 1.2, 0.72, { cast: false }); },
  shoe(g, x, z, ry, w = 1.2) { const q = at(g, x, z, ry); box(q, M.teak, w, 0.9, 0.35, 0, 0.5, 0.18); box(q, M.mirror, w * 0.7, 0.9, 0.02, 0, 1.65, 0.02, { cast: false }); box(q, M.brass, w * 0.74, 0.94, 0.01, 0, 1.65, 0.01, { cast: false });
    cyl(q, M.brass, 0.12, 0.08, 0.06, -w * 0.3, 0.98, 0.18, 14); bush(q, w * 0.32, 1.1, 0.18, 0.13, M.leaf); },
  curtain(g, x, z, ry, h = 2.75) { const q = at(g, x, z, ry); for (let i = 0; i < 4; i++) box(q, M.linen, 0.13, h, 0.09, -0.2 + i * 0.13, h / 2 + 0.05, (i % 2) * 0.04, { round: 0.04 }); box(q, M.brass, 0.7, 0.025, 0.025, 0, h + 0.1, 0.03, { cast: false }); },
  art(g, x, y, z, ry, w, h, i = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTex(...ART[i % ART.length]) })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
    const fr = at(g, x, z, ry, y); box(fr, M.woodDark, w + 0.06, h + 0.06, 0.02, 0, 0, -0.012, { cast: false }); },
  lamp(g, x, z) { cyl(g, M.brass, 0.15, 0.15, 0.02, x, 0.01, z, 16); cyl(g, M.black, 0.015, 0.015, 1.55, x, 0.8, z, 6); cyl(g, M.lampGlow, 0.18, 0.24, 0.3, x, 1.65, z, 18); },
  pendant(g, x, z, y = 1.75) { cyl(g, M.black, 0.005, 0.005, WH - y, x, (WH + y) / 2, z, 4); cyl(g, M.brass, 0.06, 0.22, 0.24, x, y, z, 20); cyl(g, M.lampGlow, 0.18, 0.18, 0.01, x, y - 0.12, z, 20); },
  jhula(g, x, z) { const q = at(g, x, z, 0);
    for (const s of [-1, 1]) cyl(q, M.chrome, 0.01, 0.01, 1.1, s * 0.25, WH - 0.55, 0, 4);
    const sw = at(q, 0, 0, 0, WH - 1.1); const sh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), M.rattan); sh.position.y = -0.6; sh.castShadow = true; sw.add(sh);
    box(sw, M.fabricSage, 0.7, 0.14, 0.7, 0, -1.05, 0.05, { round: 0.06 }); box(sw, M.fabricRust, 0.4, 0.35, 0.12, 0, -0.85, -0.25, { round: 0.06 });
    anims.push((t) => (sw.rotation.x = Math.sin(t * 1.1) * 0.06)); },
  kitchen(g, x, z, ry, w, o = {}) { const q = at(g, x, z, ry), n = Math.round(w / 0.6);
    box(q, M.cabinet, w, 0.86, 0.6, 0, 0.43, 0.3); box(q, M.granite, w + 0.02, 0.04, 0.64, 0, 0.88, 0.32);
    for (let i = 1; i < n; i++) box(q, M.black, 0.008, 0.78, 0.008, -w / 2 + (i * w) / n, 0.43, 0.605, { cast: false });
    for (let i = 0; i < n; i++) box(q, M.chrome, 0.2, 0.02, 0.03, -w / 2 + (w / n) * (i + 0.5), 0.78, 0.62, { cast: false });
    box(q, M.dado, w, 0.61, 0.01, 0, 1.21, 0.006, { cast: false });
    if (o.uppers) { box(q, M.wood, w, 0.7, 0.35, 0, 2.2, 0.175); box(q, M.cove, w - 0.1, 0.02, 0.03, 0, 1.84, 0.3, { cast: false }); }
    if (o.hob != null) { box(q, M.black, 0.62, 0.02, 0.5, o.hob, 0.91, 0.32); for (const [a, b] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, 0.44], [0.14, 0.44]]) cyl(q, M.charcoal, 0.07, 0.07, 0.02, o.hob + a, 0.93, b, 14);
      box(q, M.chrome, 0.62, 0.45, 0.42, o.hob, o.uppers ? 2.0 : 1.85, 0.22); cyl(q, M.chrome, 0.12, 0.15, 0.12, o.hob + 0.14, 1.0, 0.44, 14); }
    if (o.sink != null) { box(q, M.chrome, 0.55, 0.03, 0.42, o.sink, 0.905, 0.32); cyl(q, M.chrome, 0.015, 0.015, 0.3, o.sink, 1.05, 0.1, 8); box(q, M.chrome, 0.02, 0.02, 0.15, o.sink, 1.2, 0.17); }
    for (let i = 0; i < 3; i++) cyl(q, M.ceramic, 0.06, 0.06, 0.16 + i * 0.03, w / 2 - 0.2 - i * 0.15, 0.98 + i * 0.015, 0.12, 12); },
};

const PLANS = {
  '3': { label: '3 BHK', no: '510', cap: '3 BHK, 1,695 sft · west facing · flats 10, 16 and 23',
    rooms: {
      balcony: [0, 10.3, -1.22, 0, 'Balcony', `33'9" × 4'`, 'out'], master: [0, 3.4, 0, 4.5, 'Bedroom 1', `11'1½" × 14'9"`], drawing: [0, 3.4, 4.5, 10.2, 'Drawing', `11'1½" × 18'9"`],
      toilet1: [3.4, 5.0, 0, 1.6, 'Toilet', `5'3" × 5'3"`, 'bath'], dress: [3.4, 5.0, 1.6, 3.2, 'Dress', `5'3" × 5'3"`], toilet2: [5.0, 7.1, 0, 1.6, 'Toilet', `6'10" × 5'3"`, 'bath'],
      passage: [5.0, 7.1, 1.6, 3.2, 'Passage', ''], dining: [3.4, 7.1, 3.2, 6.6, 'Dining', `12'1½" × 11'1½"`], bed2: [3.4, 7.1, 6.6, 10.2, 'Bedroom 2', `12'1½" × 11'10"`],
      kitchen: [7.1, 10.3, 0, 3.2, 'Kitchen', `10'6" × 10'6"`], landing: [7.1, 10.3, 3.2, 6.3, 'Puja and landing', `10'6" × 10'2"`], bed3: [7.1, 10.3, 6.3, 10.2, 'Bedroom 3', `10'6" × 12'10½"`],
    },
    open: [['drawing', 'dining'], ['dining', 'passage'], ['dining', 'landing']],
    ops: [['h', 0, 1.7, 2.2, 'slider'], ['h', 0, 8.7, 1.4, 'slider'], ['h', 0, 4.2, 0.6, 'vent'], ['h', 0, 6.05, 0.6, 'vent'],
      ['v', 3.4, 3.85, 0.9, 'door', -1], ['v', 3.4, 2.4, 0.8, 'arch'], ['h', 1.6, 4.2, 0.75, 'door'], ['h', 1.6, 6.05, 0.75, 'door', -1],
      ['v', 7.1, 2.4, 0.9, 'arch'], ['h', 3.2, 8.9, 1.2, 'arch'], ['h', 6.6, 6.4, 0.9, 'door'], ['h', 6.3, 8.0, 0.9, 'door'], ['h', 10.2, 1.2, 1.1, 'main'],
      ['v', 0, 7.3, 2.4, 'win'], ['h', 10.2, 5.25, 1.6, 'win'], ['v', 10.3, 7.3, 1.2, 'win'], ['v', 10.3, 4.75, 1.0, 'win'], ['v', 10.3, 1.6, 1.2, 'win']],
    furnish(g) {
      F.rug(g, 1.85, 8.0, 2.2, 2.8); F.tv(g, 3.34, 8.0, -Math.PI / 2, 2.4); F.sofa(g, 0.6, 8.0, Math.PI / 2, 2.4); F.coffee(g, 1.85, 8.0);
      F.armchair(g, 1.7, 5.25, 0); F.lamp(g, 0.4, 5.0); plant(g, 0.4, 9.75, 1.4); F.fan(g, 1.7, 7.4); F.art(g, 1.7, 1.75, 4.53, 0, 1.3, 0.9, 0);
      F.dining(g, 5.25, 4.9, 0, 1.8); F.pendant(g, 4.8, 4.9); F.pendant(g, 5.7, 4.9); F.sideboard(g, 4.4, 6.54, Math.PI, 1.4);
      F.puja(g, 10.24, 4.75, -Math.PI / 2); plant(g, 7.5, 5.9, 1.1); F.shoe(g, 7.16, 4.4, Math.PI / 2, 1.1);
      F.kitchen(g, 10.24, 1.6, -Math.PI / 2, 3.0, { hob: 0.6, uppers: true }); F.fridge(g, 7.5, 0.05, 0);
      F.bed(g, 0.02, 2.3, Math.PI / 2, 1.8, M.fabricDk); F.ward(g, 1.5, 4.44, Math.PI, 1.9); F.ac(g, 0.02, 2.3, Math.PI / 2); F.fan(g, 1.7, 2.2);
      F.curtain(g, 0.65, 0.16, 0); F.curtain(g, 2.75, 0.16, 0); F.rug(g, 1.9, 2.3, 2.6, 2.6, M.fabricSage);
      F.ward(g, 4.94, 2.4, -Math.PI / 2, 1.4); F.wc(g, 4.55, 0.04, 0); F.basin(g, 3.46, 0.8, Math.PI / 2); F.wc(g, 6.6, 0.04, 0); F.basin(g, 7.04, 0.8, -Math.PI / 2);
      F.bed(g, 7.08, 8.4, -Math.PI / 2, 1.6, M.fabricSage); F.ward(g, 3.46, 8.5, Math.PI / 2, 1.9); F.fan(g, 5.25, 8.4); F.ac(g, 7.06, 8.4, -Math.PI / 2); F.art(g, 5.25, 1.75, 10.17, Math.PI, 0.9, 0.6, 2);
      F.bed(g, 8.7, 10.18, Math.PI, 1.5, M.fabricRust); F.ward(g, 7.16, 8.4, Math.PI / 2, 1.6); F.fan(g, 8.7, 8.2); F.desk(g, 10.24, 9.4, -Math.PI / 2); plant(g, 9.95, 6.7, 1.0);
      F.jhula(g, 5.2, -0.62); F.chair(g, 0.9, -0.62, Math.PI / 2); F.chair(g, 2.4, -0.62, -Math.PI / 2); cyl(g, M.woodDark, 0.25, 0.25, 0.04, 1.65, 0.5, -0.62, 16);
      for (const x of [3.6, 7.0, 9.8]) { box(g, M.charcoal, 0.9, 0.45, 0.4, x, 0.22, -1.0); bush(g, x, 0.6, -1.0, 0.32); }
    },
    stops: [
      ['overview', 'The plan', '3 BHK · 1,695 sft', 'The whole home, from above.', 'Three bedrooms, a drawing room, dining, kitchen, puja, two toilets, a dress room and a 4 ft balcony. Walk through it next.', [5.15, 15.5, 14.5], [5.15, 0, 4.4]],
      ['door', 'Your door', 'Flat 510, fifth floor', 'Step out of the lift.', 'A 6′6″ corridor, then a teak main door with a moulded panel.', [1.2, 1.62, 13.1], [1.2, 1.4, 8.5]],
      ['drawing', 'Drawing room', 'Drawing', 'In through the drawing room.', 'Vitrified tile floors, a timber TV wall and a big window to the west.', [2.7, 1.6, 9.7], [0.6, 0.9, 5.6], [[1.2, 1.6, 11.6]]],
      ['dining', 'Dining and puja', 'Dining', 'Dining at the heart of the home.', 'Open to the drawing room on one side and the puja and landing on the other.', [1.0, 1.6, 6.2], [9.6, 1.0, 4.4]],
      ['kitchen', 'Kitchen', 'Kitchen', 'A proper kitchen with a window.', 'Granite platform, steel sink and a 2 ft ceramic dado over the counter. The utility balcony is right outside.', [8.4, 1.6, 4.9], [9.8, 1.0, 1.2]],
      ['master', 'Bedroom 1', 'Bedroom 1', 'The main bedroom.', 'Its own dress room and attached toilet, an AC point and a sliding door to the balcony.', [3.0, 1.6, 3.85], [0.4, 0.7, 1.6], [[4.2, 1.6, 4.4]]],
      ['balcony', 'Balcony', 'Balcony', 'Evenings on a 4 ft balcony.', 'A swing chair, a glass railing and the gardens below.', [1.9, 1.55, -0.55], [6.2, 0.2, -20], [[1.9, 1.6, 1.0]]],
      ['bed2', 'Bedroom 2', 'Bedroom 2', 'Room to grow, room to study.', 'Off the dining room, with a window over the corridor court.', [4.2, 1.6, 7.0], [6.4, 0.6, 9.0], [[1.9, 1.6, 1.0], [3.0, 1.6, 3.85], [5.5, 1.6, 5.4], [6.4, 1.6, 6.0], [6.4, 1.6, 7.0]]],
      ['bed3', 'Bedroom 3', 'Bedroom 3', 'For guests, parents or a home office.', 'Off the puja landing, with a west window. Every room meets the principles of Vaastu.', [9.9, 1.7, 6.6], [8.6, 0.5, 9.6], [[6.4, 1.6, 6.0], [8.0, 1.6, 5.6], [8.0, 1.6, 6.8]], true],
    ] },
  '2': { label: '2 BHK', no: '512', cap: '2 BHK, 1,060 sft · east facing · flat 12',
    rooms: {
      balcony: [0, 7.15, -1.22, 0, 'Balcony', `23'5" × 4'`, 'out'], bed1: [0, 3.05, 0, 4.1, 'Bedroom 1', `10' × 13'4½"`], toilet1: [0, 1.4, 4.1, 6.1, 'Toilet', `4'6" × 6'6"`, 'bath'],
      toilet2: [1.4, 3.05, 4.1, 6.1, 'Toilet', `5'5" × 6'6"`, 'bath'], bed2: [0, 3.05, 6.1, 9.9, 'Bedroom 2', `10' × 12'6"`], kitchen: [3.05, 7.15, 0, 2.05, 'Kitchen', `13'5" × 6'9"`],
      dining: [3.05, 7.15, 2.05, 5.9, 'Dining', `13'5" × 12'7½"`], drawing: [3.05, 6.1, 5.9, 9.9, 'Drawing', `10' × 13'1½"`], foyer: [6.1, 7.15, 5.9, 9.9, 'Foyer and puja', ''],
    },
    open: [['dining', 'drawing'], ['drawing', 'foyer'], ['dining', 'foyer']],
    ops: [['h', 0, 1.5, 1.8, 'slider'], ['h', 0, 4.5, 1.2, 'win'], ['h', 0, 6.4, 0.9, 'slider'], ['h', 2.05, 6.4, 1.1, 'arch'],
      ['v', 3.05, 3.4, 0.9, 'door', -1], ['h', 4.1, 0.7, 0.75, 'door'], ['v', 3.05, 5.0, 0.75, 'door'], ['v', 3.05, 6.8, 0.9, 'door', -1], ['h', 9.9, 6.6, 1.1, 'main'],
      ['v', 0, 5.1, 0.6, 'vent'], ['v', 0, 9.3, 0.9, 'win'], ['v', 7.15, 4.0, 1.8, 'win']],
    furnish(g) {
      F.rug(g, 4.5, 8.2, 2.2, 2.4); F.tv(g, 3.11, 8.3, Math.PI / 2, 2.2); F.sofa(g, 5.65, 8.3, -Math.PI / 2, 2.2); F.coffee(g, 4.5, 8.3); F.fan(g, 4.6, 8.0);
      F.art(g, 4.6, 1.75, 9.87, Math.PI, 0.9, 0.7, 1); F.puja(g, 7.09, 7.6, -Math.PI / 2); F.shoe(g, 7.09, 9.0, -Math.PI / 2, 0.9);
      F.dining(g, 5.1, 3.9, 0, 1.8); F.pendant(g, 4.7, 3.9); F.pendant(g, 5.5, 3.9); plant(g, 6.8, 5.5, 1.1); plant(g, 3.4, 2.4, 1.0);
      F.kitchen(g, 4.6, 0.06, 0, 3.0, { sink: 0, hob: 1.0, uppers: false }); F.fridge(g, 3.5, 2.0, Math.PI);
      F.bed(g, 0.02, 2.4, Math.PI / 2, 1.6, M.fabricDk); F.ward(g, 2.05, 4.04, Math.PI, 1.6); F.ac(g, 0.02, 2.4, Math.PI / 2); F.fan(g, 1.5, 2.2);
      F.curtain(g, 0.7, 0.16, 0); F.curtain(g, 2.3, 0.16, 0);
      F.wc(g, 0.7, 6.04, Math.PI); F.basin(g, 0.06, 4.8, Math.PI / 2); F.wc(g, 2.3, 6.04, Math.PI); F.basin(g, 1.46, 4.8, Math.PI / 2);
      F.bed(g, 0.02, 8.0, Math.PI / 2, 1.5, M.fabricSage); F.ward(g, 1.8, 9.84, Math.PI, 1.6); F.fan(g, 1.5, 8.0); plant(g, 2.8, 9.6, 1.0);
      F.jhula(g, 3.6, -0.62); F.chair(g, 5.6, -0.62, Math.PI / 2); cyl(g, M.woodDark, 0.25, 0.25, 0.04, 6.15, 0.5, -0.62, 16);
      for (const x of [0.6, 2.3]) { box(g, M.charcoal, 0.9, 0.45, 0.4, x, 0.22, -1.0); bush(g, x, 0.6, -1.0, 0.32); }
    },
    stops: [
      ['overview', 'The plan', '2 BHK · 1,060 sft', 'The whole home, from above.', 'Two bedrooms, two toilets, a drawing room, a big dining room, kitchen, puja and a balcony. Walk through it next.', [3.6, 13.5, 13.8], [3.6, 0, 4.3]],
      ['door', 'Your door', 'Flat 512, fifth floor', 'Step out of the lift.', 'A teak main door off the 6′6″ corridor, opening into a foyer with a puja corner.', [6.6, 1.62, 12.9], [6.6, 1.4, 6.0]],
      ['drawing', 'Drawing room', 'Drawing', 'Living and puja, side by side.', 'The drawing room opens straight into the dining area.', [6.75, 1.6, 7.3], [3.2, 1.0, 8.4], [[6.6, 1.6, 11.2], [6.6, 1.6, 8.4]]],
      ['dining', 'Dining', 'Dining', 'A big dining room at the centre.', 'A window to the east and the kitchen right behind it.', [6.4, 1.6, 6.6], [3.6, 0.9, 2.6]],
      ['kitchen', 'Kitchen', 'Kitchen', 'A galley kitchen that works hard.', 'Granite platform, steel sink, 2 ft ceramic dado and a window over the counter.', [6.4, 1.6, 3.0], [4.2, 1.0, 0.3]],
      ['bed1', 'Bedroom 1', 'Bedroom 1', 'A calm main bedroom.', 'Its own attached toilet, a sliding door to the balcony and an AC point.', [2.6, 1.6, 3.45], [0.4, 0.6, 1.8], [[4.0, 1.6, 3.4]]],
      ['balcony', 'Balcony', 'Balcony', 'Tea on the balcony.', 'A 4 ft balcony with a swing chair and planters.', [1.5, 1.55, -0.55], [5, 0.2, -20], [[1.5, 1.6, 1.0]]],
      ['bed2', 'Bedroom 2', 'Bedroom 2', 'A second bedroom off the drawing room.', 'A wardrobe, a window and a toilet next door. Every room meets the principles of Vaastu.', [1.4, 1.6, 6.5], [0.7, 0.6, 8.6], [[1.5, 1.6, 1.0], [2.6, 1.6, 3.4], [4.0, 1.6, 3.4], [4.0, 1.6, 6.8]], true],
    ] },
};

const floorMats = { bath: M.bathFloor, out: M.woodDark, '': M.floor };
function buildFlat(key) {
  const P = PLANS[key], g = new THREE.Group(); g.visible = false; flat.add(g);
  const R = Object.entries(P.rooms).map(([k, r]) => ({ k, x0: r[0], x1: r[1], z0: r[2], z1: r[3], name: r[4], size: r[5], kind: r[6] || '' }));
  const inside = R.filter((r) => r.kind !== 'out');
  const roomAt = (x, z) => inside.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) || null;
  const open = new Set(P.open.flatMap(([a, b]) => [a + '|' + b, b + '|' + a]));
  const X0 = Math.min(...inside.map((r) => r.x0)), X1 = Math.max(...inside.map((r) => r.x1)), Z1 = Math.max(...inside.map((r) => r.z1));
  for (const r of R) {
    const mat = floorMats[r.kind].clone(); mat.map = mat.map.clone(); mat.map.needsUpdate = true;
    mat.map.repeat.set((r.x1 - r.x0) / (r.kind === 'bath' ? 1.2 : 1.6), (r.z1 - r.z0) / (r.kind === 'bath' ? 1.2 : 1.6));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat); f.rotation.x = -Math.PI / 2; f.position.set((r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2); f.receiveShadow = true; g.add(f);
    if (r.kind !== 'out' && r.name && r.kind !== 'bath') { const l = new THREE.PointLight(0xFFD2A0, 0, 8, 1.6); l.position.set((r.x0 + r.x1) / 2, WH - 0.35, (r.z0 + r.z1) / 2); g.add(l); interiorLights.push(l); }
  }
  box(g, M.white, X1 - X0 + 0.8, 0.35, Z1 + 1.7, (X0 + X1) / 2, -0.18, (Z1 - 1.3) / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 0.4, Z1 + 0.2), M.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.set((X0 + X1) / 2, WH, Z1 / 2); g.add(ceil);
  const tops = [ceil, box(g, M.white, X1 - X0 + 0.8, 0.3, Z1 + 1.7, (X0 + X1) / 2, WH + 0.15, (Z1 - 1.3) / 2)];
  // plan-view labels: room name and size written on the floor, shown on the overview stop
  const labels = new THREE.Group(); labels.visible = false; g.add(labels);
  for (const r of R) if (r.name && r.k !== 'passage') { const w = r.x1 - r.x0, d = r.z1 - r.z0, small = w < 2.2 || d < 2.2;
    const tx = canvasTex(512, 256, (c, W, Hh) => { c.textAlign = 'center'; c.fillStyle = 'rgba(255,253,248,.88)'; c.beginPath(); c.roundRect?.(16, 40, W - 32, Hh - 80, 28); c.fill();
      c.fillStyle = '#3A2A1C'; c.font = `800 ${small ? 64 : 58}px Montserrat, sans-serif`; c.fillText(r.name.toUpperCase(), W / 2, r.size ? 128 : 150, W - 60);
      if (r.size) { c.fillStyle = '#9A6A3A'; c.font = '600 52px Montserrat, sans-serif'; c.fillText(r.size, W / 2, 190, W - 60); } });
    const lw = Math.min(w - 0.15, small ? 1.6 : 3.0), lm = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw / 2), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false }));
    lm.rotation.x = -Math.PI / 2; lm.position.set((r.x0 + r.x1) / 2, 0.05, (r.z0 + r.z1) / 2); lm.renderOrder = 20; labels.add(lm); }
  for (const r of R) if (r.kind === 'out') { const w = r.x1 - r.x0, cx = (r.x0 + r.x1) / 2;
    box(g, M.rail, w, 1.05, 0.03, cx, 0.53, r.z0 + 0.05, { cast: false }); box(g, M.steel, w, 0.05, 0.07, cx, 1.07, r.z0 + 0.05); box(g, M.cove, w, 0.02, 0.05, cx, WH - 0.02, r.z0 + 0.3, { cast: false }); }
  // walls: sample every room edge in 5 cm steps; a wall stands where two different rooms meet
  const lines = { h: new Set(), v: new Set() };
  for (const r of inside) { lines.h.add(r.z0); lines.h.add(r.z1); lines.v.add(r.x0); lines.v.add(r.x1); }
  const segs = [];
  for (const o of ['h', 'v']) for (const c of lines[o]) {
    const lo = o === 'h' ? X0 : 0, hi = o === 'h' ? X1 : Z1; let run = null;
    for (let i = Math.round(lo * 20); i < Math.round(hi * 20); i++) {
      const m = i / 20 + 0.025;
      const A = o === 'h' ? roomAt(m, c - 0.03) : roomAt(c - 0.03, m), B = o === 'h' ? roomAt(m, c + 0.03) : roomAt(c + 0.03, m);
      const t = A !== B && (A || B) && !(A && B && open.has(A.k + '|' + B.k)) ? (A && B ? 0.12 : 0.23) : 0;
      if (run && run.t === t) run.b = i / 20 + 0.05; else { if (run && run.t) segs.push(run); run = { o, c, a: i / 20, b: i / 20 + 0.05, t }; }
    }
    if (run && run.t) segs.push(run);
  }
  const ops = P.ops.map(([o, c, m, w, type, swing = 1]) => ({ o, c, m, w, type, swing }));
  let mainDoor = null;
  for (const s of segs) {
    const H = s.o === 'h', mine = ops.filter((p) => p.o === s.o && Math.abs(p.c - s.c) < 1e-3 && p.m > s.a && p.m < s.b).sort((p, q) => p.m - q.m);
    const piece = (a, b, y0, y1) => { if (b - a < 0.01 || y1 - y0 < 0.01) return; const mid = (a + b) / 2, l = b - a + (y0 === 0 && y1 === WH ? s.t : 0), h = y1 - y0;
      if (H) box(g, M.wall, l, h, s.t, mid, y0 + h / 2, s.c); else box(g, M.wall, s.t, h, l, s.c, y0 + h / 2, mid); };
    const along = (m, y, len, hgt, dep, mat, cast = true) => H ? box(g, mat, len, hgt, dep, m, y, s.c, { cast }) : box(g, mat, dep, hgt, len, s.c, y, m, { cast });
    let cur = s.a;
    for (const p of mine) {
      const a = p.m - p.w / 2, b = p.m + p.w / 2;
      const top = { win: 2.3, vent: 2.3, slider: 2.5, main: 2.25 }[p.type] || 2.2, sill = { win: 0.8, vent: 1.7 }[p.type] || 0;
      piece(cur, a, 0, WH); piece(a, b, top, WH); if (sill) piece(a, b, 0, sill); cur = b;
      const h = top - sill, yc = sill + h / 2;
      if (p.type === 'win' || p.type === 'vent' || p.type === 'slider') {
        const n = p.type === 'slider' ? (p.w > 3 ? 4 : 2) : p.type === 'vent' ? 1 : 3;
        for (let i = 0; i < n; i++) { const pw = p.w / n, pc = a + pw * (i + 0.5);
          if (!(p.type === 'slider' && i === 1)) along(pc, yc, pw - 0.04, h - 0.06, 0.02, M.glass, false);
          along(pc - pw / 2, yc, 0.05, h, s.t * 0.6, M.white3); }
        along(p.m, sill + 0.03, p.w, 0.06, s.t * 0.8, M.white3); along(p.m, top - 0.03, p.w, 0.06, s.t * 0.8, M.white3);
        if (p.type === 'win') along(p.m, sill - 0.02, p.w + 0.1, 0.04, s.t + 0.08, M.granite);
      } else if (p.type === 'door' || p.type === 'main') {
        along(a + 0.03, top / 2, 0.06, top, s.t + 0.02, M.teak); along(b - 0.03, top / 2, 0.06, top, s.t + 0.02, M.teak); along(p.m, top + 0.03, p.w, 0.06, s.t + 0.02, M.teak);
        const piv = new THREE.Group(); piv.position.set(H ? a + 0.05 : s.c, 0, H ? s.c : a + 0.05); g.add(piv);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(H ? p.w - 0.1 : 0.045, top - 0.03, H ? 0.045 : p.w - 0.1), p.type === 'main' ? M.teak : M.door);
        leaf.position.set(H ? (p.w - 0.1) / 2 : 0, (top - 0.03) / 2, H ? 0 : (p.w - 0.1) / 2); leaf.castShadow = true; piv.add(leaf);
        const hd = box(piv, M.brass, H ? 0.03 : 0.08, p.type === 'main' ? 0.45 : 0.04, H ? 0.08 : 0.03, H ? p.w - 0.22 : 0, 1.05, H ? 0 : p.w - 0.22, { cast: false });
        if (p.type === 'main') { for (let i = 0; i < 3; i++) box(piv, M.woodDark, H ? p.w * 0.7 : 0.06, 0.5, H ? 0.06 : p.w * 0.7, H ? (p.w - 0.1) / 2 : 0, 0.45 + i * 0.65, 0, { cast: false }); mainDoor = piv; }
        else piv.rotation.y = p.swing * D2R(80) * (H ? 1 : -1);
      }
    }
    piece(cur, s.b, 0, WH);
  }
  for (const r of inside) if (r.kind !== 'bath') box(g, M.cove, r.x1 - r.x0 - 0.5, 0.02, 0.03, (r.x0 + r.x1) / 2, WH - 0.04, r.z0 + 0.12, { cast: false });
  // corridor outside the main door
  const md = ops.find((p) => p.type === 'main'), cx = md.m;
  box(g, M.stone, 6, 0.02, 3.4, cx, 0.01, Z1 + 1.7, { cast: false });
  tops.push(box(g, M.wall, 6, WH, 0.15, cx, WH / 2, Z1 + 3.4), box(g, M.wall, 0.15, WH, 3.4, cx - 3, WH / 2, Z1 + 1.7), box(g, M.wall, 0.15, WH, 3.4, cx + 3, WH / 2, Z1 + 1.7));
  tops.push(box(g, M.ceiling, 6, 0.05, 3.4, cx, WH, Z1 + 1.7, { cast: false })); box(g, M.cove, 5, 0.02, 0.05, cx, WH - 0.03, Z1 + 0.4, { cast: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: signTex(P.no, ''), transparent: true }));
  plate.position.set(cx + 0.8, 1.75, Z1 + 0.13); g.add(plate); plant(g, cx - 1.2, Z1 + 0.6, 1.1); plant(g, cx + 2.4, Z1 + 3.0, 1.3);
  box(g, M.chrome, 1.4, 2.2, 0.04, cx - 1.5, 1.1, Z1 + 3.3, { cast: false }); box(g, M.chrome, 1.4, 2.2, 0.04, cx + 1.4, 1.1, Z1 + 3.3, { cast: false });
  P.furnish(g);
  g.traverse((o) => { if (o.isMesh && o.material === M.glass) o.renderOrder = 2; });
  return { g, P, R, mainDoor, X0, X1, Z1, tops, labels };
}
let balRoof;
const FLATS = { '3': buildFlat('3'), '2': buildFlat('2') };
// small things skip the shadow pass: far fewer draw calls, same look
const _bs = new THREE.Sphere();
for (const root of [ext, flat]) root.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !o.castShadow) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = new THREE.Vector3(); o.getWorldScale(s); if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.28) o.castShadow = false; });
{ // what you see from the balcony: gardens, a lake and the city
  const park = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ color: 0x8FA772, roughness: 1 }));
  park.rotation.x = -Math.PI / 2; park.position.set(5, -15.75, -20); flat.add(park);
  for (let i = 0; i < 26; i++) tree(flat, -30 + rand() * 75, -10 - rand() * 60, 1.6 + rand());
  box(flat, M.water, 26, 0.1, 10, 7, -15.6, -24, { cast: false });
  box(flat, M.white, 40, 0.38, 2.4, 5, -0.2, -1.6); balRoof = box(flat, M.white, 40, 0.38, 2.4, 5, WH + 0.2, -1.6);
}
city(flat, 5, -20, 90, 260, 60, -15.75);

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
  if (M.poolWater) M.poolWater.emissiveIntensity = 0.3 + night * 0.7;
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
   THE TOUR: arrows (and keys) step through camera stops. No page scroll.
   ===================================================================== */
const EXT = [
  { id: 'hero', name: 'Welcome', word: 'SIGNIFA', k: 'Signifa Signature · Machabollaram, Hyderabad', t: ['Walk into', 'your home.'], d: 'Use the arrows to take the tour: in from the 60 ft road, through every amenity, then inside a 2 or 3 BHK.', p: [170, 95, 135], l: [-5, 0, 0] },
  { id: 'road', name: 'The road', word: 'ARRIVE', k: 'Machabollaram, near Kompally', t: 'Turn in off the 60 ft road.', d: 'A gated community of 178 homes in one C+S+8 tower, with a clear title and 20+ amenities.', p: [101, 1.7, 46], l: [79, 5, 29], tag: ['Signifa Signature', 'Entry and exit', [79, 10, 29]] },
  { id: 'gate', name: 'Entrance', word: 'ENTER', k: 'Entry and drive way', t: 'Through the gate, past the water body.', d: '24/7 security and CCTV, and a palm-lined drive way to every corner of the site.', p: [71, 1.75, 21], l: [40, 5, 32], via: [[84, 1.75, 34], [76, 1.75, 27]], tag: ['Water body', 'Entry and exit, drive way', [70, 3.2, 24]] },
  { id: 'pool', name: 'Swimming pool', word: 'SPLASH', k: 'Swimming pool', t: 'An angled pool on a raised deck.', d: 'At the south end of the site: sun loungers, a shaded cabana, palms and the park beside it.', p: [78, 13, 6.5], l: [77, 1.2, -15], via: [[80, 6, 14]], tag: ['Swimming pool', 'Dress changing rooms behind', [77, 4.4, -15]] },
  { id: 'ev', name: 'EV charging', word: 'CHARGE', k: 'EV charging point', t: 'Plug in under a solar roof.', d: 'At the north end, beside the guest rooms: covered EV bays with superchargers and a solar roof.', p: [-60, 4, -26.5], l: [-72, 1.2, -32], via: [[62, 6, 33], [-62, 6, 33], [-60, 5, 0]], tag: ['EV charging point', 'Guest rooms behind', [-70.6, 5.2, -31]] },
  { id: 'jog', name: 'Jogging track', word: 'STRIDE', k: 'Walking and jogging track', t: 'A loop around the whole community.', d: 'Morning runs and evening walks past the tower, the gardens and the play areas.', p: [0, 3, 33], l: [0, 1, 31], follow: true, tag: ['Jogging track', 'A loop round the site', 'runner'] },
  { id: 'play', name: 'Play and courts', word: 'PLAY', k: 'Kids play area and courts', t: 'Room to play, right downstairs.', d: 'Swings, a slide, see-saw and merry-go-round next to the club house, with the shuttle court and cricket net beyond.', p: [-64, 7, 21], l: [-80, 1, 7], tag: ['Kids play area', 'Shuttle court and cricket net beyond', [-79, 4.4, 8.5]] },
  { id: 'club', name: 'Club house', word: 'UNWIND', k: 'Club house', t: 'Gym, yoga and a café deck.', d: 'Indoor gym, games, yoga and meditation hall, working pods and guest rooms.', p: [-66, 4.5, 4], l: [-84, 1.8, -12], tag: ['Club house', 'Gym, games, yoga and café', [-82, 6.2, -7]] },
  { id: 'lobby', name: 'Lobby', word: 'LOBBY', k: 'Residents lobby', t: 'Home is a lift ride away.', d: 'Drop-off under the canopy, KONE lifts, intercom to security and 1 kVA power backup for every flat.', p: [70, 1.7, 23], l: [54, 2.2, 17], via: [[-60, 4, 33], [60, 4, 34]], tag: ['Residents lobby', 'KONE lifts', [56, 5.2, 17]] },
  { id: 'finale', name: 'Choose a home', word: 'HOME', k: 'That was Signifa Signature', t: 'Now step inside a home.', d: '178 homes, 23 on every floor. Pick a plan to walk through it room by room.', p: [-190, 90, -120], l: [0, 6, 0], via: [[40, 40, 90]], actions: [['Walk through the 3 BHK', '3'], ['Walk through the 2 BHK', '2'], ['Project details', '@projects']] },
];
const toV = (space, v) => (space === 'int' ? new THREE.Vector3(...v).add(FLAT_ORIGIN) : new THREE.Vector3(...v));
const prep = (s, space) => Object.assign(s, { space, P: toV(space, s.p), L: toV(space, s.l), via: (s.via || []).map((v) => toV(space, v)) });
const TOURS = { ext: EXT.map((s) => prep(s, 'ext')) };
for (const key of ['3', '2']) {
  const other = key === '3' ? '2' : '3';
  TOURS[key] = PLANS[key].stops.map(([id, name, k, t, d, p, l, via, last]) => prep({ id, name, word: name.split(' ')[0].toUpperCase(), k, t, d, p, l, via, room: id === 'door' || id === 'overview' ? null : id,
    actions: last ? [['Book a site visit', '@contact'], [`See the ${PLANS[other].label}`, other], ['Back to the building', 'ext']] : null }, 'int'));
}
const followStop = TOURS.ext.find((s) => s.follow);

let tourKey = 'ext', tour = TOURS.ext, idx = 0, pos = 0, canvasVisible = true, dirty = true, snap = true, sheetOpen = false;
const camP = new THREE.Vector3(), camL = new THREE.Vector3(), goalP = new THREE.Vector3(), goalL = new THREE.Vector3();
const smooth = (x) => x * x * (3 - 2 * x);
const _a = new THREE.Vector3();
function along(pts, k) {
  let total = 0; const lens = [];
  for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); lens.push(l); total += l; }
  let d = k * total;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) return _a.copy(pts[i]).lerp(pts[i + 1], lens[i] ? Math.min(d / lens[i], 1) : 1); d -= lens[i]; }
  return _a.copy(pts[pts.length - 1]);
}
function goal() {
  const n = tour.length, seg = Math.max(0, Math.min(Math.floor(pos), n - 2)), k = smooth(THREE.MathUtils.clamp(pos - seg, 0, 1));
  const a = tour[seg], b = tour[seg + 1] || a;
  goalP.copy(along([a.P, ...b.via, b.P], k)); goalL.copy(a.L).lerp(b.L, k);
}

/* ---------- interface ---------- */
const capK = $('#capK'), capT = $('#capT'), capD = $('#capD'), capA = $('#capA'), caption = $('#caption');
const counterNum = $('#counterNum'), counterName = $('#counterName'), counterTotal = $('#counterTotal');
const prevBtn = $('#prev'), nextBtn = $('#next'), progressBar = $('#progressBar'), sheetEl = $('#sheet');
let wordTimer, capTimer;
function showFlat(key) { for (const k in FLATS) FLATS[k].g.visible = k === key; if (FLATS[key]) buildPlan(key); }
function buildPager() {
  pager.innerHTML = '';
  tour.forEach((s, i) => { const li = document.createElement('li'), a = document.createElement('button'); a.type = 'button'; a.setAttribute('aria-label', s.name); a.addEventListener('click', () => go(i)); li.append(a); pager.append(li); });
  counterTotal.textContent = String(tour.length).padStart(2, '0');
}
function updateUI() {
  const s = tour[idx];
  counterNum.textContent = String(idx + 1).padStart(2, '0'); counterName.textContent = s.name;
  [...pager.querySelectorAll('button')].forEach((b, j) => b.setAttribute('aria-current', String(j === idx)));
  document.querySelectorAll('.nav [data-tour]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.tour === tourKey)));
  document.body.dataset.tour = tourKey; document.body.dataset.stop = s.id;
  progressBar.style.transform = `scaleX(${tour.length > 1 ? idx / (tour.length - 1) : 1})`;
  prevBtn.disabled = idx === 0 && tourKey === 'ext';
  nextBtn.setAttribute('aria-label', idx === tour.length - 1 ? 'Project details' : 'Next stop');
  caption.classList.add('swap'); clearTimeout(capTimer);
  capTimer = setTimeout(() => {
    capK.textContent = s.k; caption.classList.toggle('hero', Array.isArray(s.t));
    capT.innerHTML = Array.isArray(s.t) ? s.t.map((l) => `<span>${l}</span>`).join('') : s.t; capD.textContent = s.d;
    capA.innerHTML = ''; (s.actions || []).forEach(([label, to], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = i ? 'btn btn-line' : 'btn'; b.textContent = label;
      b.addEventListener('click', () => (to[0] === '@' ? openSheet(to.slice(1)) : switchTour(to, to === 'ext' ? TOURS.ext.findIndex((x) => x.id === 'lobby') : 0))); capA.append(b); });
    caption.classList.remove('swap');
  }, reduceMotion ? 0 : 260);
  highlightPlan(s.room);
  if (wordText.textContent !== s.word) { wordBox.classList.add('swap'); clearTimeout(wordTimer); wordTimer = setTimeout(() => { wordText.textContent = s.word; wordBox.classList.remove('swap'); }, reduceMotion ? 0 : 320); }
  dirty = true;
}
function go(i) { idx = THREE.MathUtils.clamp(i, 0, tour.length - 1); if (Math.abs(idx - pos) > 2.5) snap = true; updateUI(); }
function next() { if (sheetOpen) return; if (idx < tour.length - 1) go(idx + 1); else openSheet(tourKey === 'ext' ? 'projects' : 'contact'); }
function prev() { if (sheetOpen) return closeSheet(); if (idx > 0) go(idx - 1); else if (tourKey !== 'ext') switchTour('ext', TOURS.ext.findIndex((x) => x.id === 'lobby')); }
function switchTour(key, start = 0) {
  closeSheet();
  if (key === tourKey) return go(start);
  fadeEl.querySelector('p').textContent = key === 'ext' ? 'Back down to the gardens' : `Taking the lift to flat ${PLANS[key].no}`;
  fadeEl.classList.add('on');
  setTimeout(() => {
    tourKey = key; tour = TOURS[key]; idx = start; pos = start; snap = true; doorOpen = 0;
    space = tour[0].space; showFlat(key); placeSun(); buildPager(); updateUI();
    setTimeout(() => fadeEl.classList.remove('on'), reduceMotion ? 0 : 450);
  }, reduceMotion ? 0 : 650);
}
function openSheet(id) {
  sheetOpen = true; canvasVisible = false; sheetEl.classList.add('open'); sheetEl.setAttribute('aria-hidden', 'false'); document.body.classList.add('sheet-open');
  const t = id && document.getElementById(id); sheetEl.scrollTop = t ? t.offsetTop - 70 : 0; $('#sheetClose').focus({ preventScroll: true });
}
function closeSheet() { if (!sheetOpen) return; sheetOpen = false; canvasVisible = true; dirty = true; sheetEl.classList.remove('open'); sheetEl.setAttribute('aria-hidden', 'true'); document.body.classList.remove('sheet-open'); }
nextBtn.addEventListener('click', next); prevBtn.addEventListener('click', prev);
$('#sheetClose').addEventListener('click', closeSheet);
document.querySelectorAll('button[data-tour], a[data-tour]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); switchTour(b.dataset.tour, 0); }));
document.querySelectorAll('button[data-sheet], a[data-sheet]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openSheet(b.dataset.sheet); }));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === 'Escape') closeSheet();
  if (sheetOpen) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
});

/* ---------- floor plan of the current home ---------- */
const planSvg = $('#planSvg'), NS = 'http://www.w3.org/2000/svg';
let roomEls = {};
function buildPlan(key) {
  const F0 = FLATS[key]; planSvg.innerHTML = ''; roomEls = {};
  planSvg.setAttribute('viewBox', `${F0.X0 - 0.4} -1.7 ${F0.X1 - F0.X0 + 0.8} ${F0.Z1 + 2.1}`);
  for (const r of F0.R) {
    const g = document.createElementNS(NS, 'g'), rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', r.x0); rect.setAttribute('y', r.z0); rect.setAttribute('width', r.x1 - r.x0); rect.setAttribute('height', r.z1 - r.z0); g.append(rect);
    if (r.name && r.x1 - r.x0 > 1.7) { const t = document.createElementNS(NS, 'text'); t.setAttribute('x', (r.x0 + r.x1) / 2); t.setAttribute('y', (r.z0 + r.z1) / 2 + 0.22); t.textContent = r.name.replace(' and puja', ''); g.append(t); }
    const ti = TOURS[key].findIndex((s) => s.room === r.k);
    if (ti >= 0) { g.classList.add('go'); g.addEventListener('click', () => go(ti)); }
    planSvg.append(g); roomEls[r.k] = g;
  }
  const you = document.createElementNS(NS, 'g'); you.classList.add('you'); you.id = 'you';
  you.innerHTML = '<path d="M0 0 L-1.4 -2.6 A3 3 0 0 1 1.4 -2.6 Z" class="cone"/><circle r="0.42"/>'; planSvg.append(you);
  $('#planCap').textContent = PLANS[key].cap;
}
function highlightPlan(room) { Object.entries(roomEls).forEach(([k, g]) => g.classList.toggle('here', k === room || (room === 'dining' && k === 'landing'))); }

/* ---------- look around: drag (mouse) or swipe (touch) ---------- */
let yaw = 0, yawVel = 0, dragging = false, lastX = 0, downX = 0, touch = false;
canvas.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch'; downX = lastX = e.clientX; dragging = !touch; yawVel = 0; canvas.classList.toggle('dragging', dragging); });
addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; yawVel = -dx * 0.25; yaw += yawVel; dirty = true; });
addEventListener('pointerup', (e) => { if (touch && Math.abs(e.clientX - downX) > 50) (e.clientX < downX ? next : prev)(); dragging = touch = false; canvas.classList.remove('dragging'); });
let px = 0, py = 0, cpx = 0, cpy = 0;
if (!reduceMotion && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1; });

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); dirty = true; }
addEventListener('resize', resize);

let sunAnim = null;
sunInput.addEventListener('input', () => { sunAnim = null; setSun(+sunInput.value); });
function sunrise() {
  const from = 12.5, to = 16.9, dur = 4200, t0 = performance.now();
  sunAnim = (now) => { const k = Math.min((now - t0) / dur, 1); const h = from + (to - from) * (1 - Math.pow(1 - k, 3)); sunInput.value = h.toFixed(2); setSun(h); if (k >= 1) sunAnim = null; };
}

/* ---------- loop ---------- */
const _dir = new THREE.Vector3(), _v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
let lastT = performance.now(), doorOpen = 0;
setSun(+sunInput.value); resize(); buildPager(); updateUI();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 16.67, 3), sec = dt / 60, t = now / 1000; lastT = now;
  if (sunAnim) sunAnim(now);
  if (!canvasVisible) return;
  moveRunners(sec); anims.forEach((f) => f(t, sec)); fans.forEach((f) => (f.rotation.y += sec * 9));
  for (const rc of roadCars) { const [g, v, , off] = rc; rc[2] = (rc[2] + v * sec / roadLen + 1) % 1; roadCurve.getPointAt(rc[2], _rp); roadCurve.getTangentAt(rc[2], _rt);
    g.position.set(_rp.x - _rt.z * off, 0, _rp.z + _rt.x * off); g.rotation.y = Math.atan2(_rt.x, _rt.z) + (v < 0 ? Math.PI : 0); }
  if (tourKey === 'ext') {
    if (idx !== followSeg) { followSeg = idx; let best = 1e12; for (const r of runners) { const d = r.g.position.distanceToSquared(camP); if (d < best && r.run) { best = d; followR = r; } } }
    const r = followR; if (r.tg) { const n = _n.set(r.tg.z, 0, -r.tg.x); if (n.x * (-6 - r.g.position.x) + n.z * (-4 - r.g.position.z) < 0) n.negate();
      followStop.P.copy(r.g.position).addScaledVector(r.tg, -8).addScaledVector(n, 3.5).setY(3.2); followStop.L.copy(r.g.position).addScaledVector(r.tg, 5).setY(1.1); }
  }
  const dpos = idx - pos;
  if (Math.abs(dpos) > 1e-4) pos += Math.sign(dpos) * Math.min(Math.abs(dpos), sec * (reduceMotion || snap ? 99 : 0.5));
  goal();
  if (snap) { camP.copy(goalP); camL.copy(goalL); snap = false; }
  const e = reduceMotion ? 1 : 1 - Math.pow(1 - 0.09, dt);
  camP.lerp(goalP, e); camL.lerp(goalL, e);
  cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
  if (!dragging && Math.abs(yawVel) > 0.01) { yaw += yawVel; yawVel *= 0.93; }
  else if (!dragging && tourKey === 'ext' && idx === 0 && !reduceMotion) yaw += 0.03 * dt;
  else if (!dragging && Math.abs(yaw) > 0.05) { yaw = ((yaw + 180) % 360 + 360) % 360 - 180; yaw *= Math.max(0, 1 - 0.09 * dt); }
  if (tourKey !== 'ext') { const F0 = FLATS[tourKey], want = THREE.MathUtils.clamp((pos - 1) * 2.5, 0, 1); doorOpen += (want - doorOpen) * (reduceMotion ? 1 : 0.12); F0.mainDoor.rotation.y = doorOpen * D2R(100);
    const ov = pos < 0.6; F0.labels.visible = ov; F0.tops.forEach((m) => (m.visible = !ov)); balRoof.visible = !ov; }
  ext.visible = space === 'ext'; flat.visible = space === 'int';

  const yawR = D2R(yaw + cpx * (space === 'int' ? 6 : 4));
  if (space === 'ext') { _v.copy(camP).sub(camL).applyAxisAngle(Y, yawR); camera.position.copy(camL).add(_v); camera.position.y += cpy * -1.2; camera.lookAt(camL); }
  else { camera.position.copy(camP); _dir.copy(camL).sub(camP).applyAxisAngle(Y, yawR); _dir.y -= cpy * 0.05 * _dir.length(); camera.lookAt(_v.copy(camP).add(_dir)); }
  const fov = space === 'int' ? (camera.aspect < 0.8 ? 76 : 64) : THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(camP.distanceTo(camL), 15, 220, 56, 38), 38, 56) + (camera.aspect < 0.8 ? 14 : 0);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (space === 'ext') placeSun();
  renderer.render(scene, camera);

  // label in the scene + you-are-here on the plan
  const st = tour[idx]; let tg = null;
  const arrived = Math.abs(idx - pos) < 0.08;
  if (arrived && space === 'int' && st.room) { const r = FLATS[tourKey].R.find((x) => x.k === st.room); if (r) { tg = [r.name, r.size]; _v.set((r.x0 + r.x1) / 2, 2.4, (r.z0 + r.z1) / 2).add(FLAT_ORIGIN); } }
  else if (arrived && space === 'ext' && st.tag) { tg = st.tag; if (tg[2] === 'runner') _v.copy(followR.g.position).setY(2.6); else _v.set(...tg[2]); }
  if (tg) { _v.project(camera); const vis = _v.z < 1 && Math.abs(_v.x) < 0.9 && Math.abs(_v.y) < 0.9; roomTag.classList.toggle('show', vis);
    if (vis) { roomTag.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`; roomTag.querySelector('b').textContent = tg[0]; roomTag.querySelector('span').textContent = tg[1]; } }
  else roomTag.classList.remove('show');
  planEl.classList.toggle('show', space === 'int');
  if (space === 'int') { const lp = camera.position.clone().sub(FLAT_ORIGIN); camera.getWorldDirection(_dir); $('#you')?.setAttribute('transform', `translate(${lp.x.toFixed(2)} ${lp.z.toFixed(2)}) rotate(${(Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI).toFixed(1)})`); }
  wordBox.style.transform = `translate3d(${(-cpx * 22).toFixed(1)}px, ${(-cpy * 10).toFixed(1)}px, 0)`;
}
requestAnimationFrame(() => { $('#loaderNum').textContent = '100'; $('#loader').classList.add('done'); document.body.classList.remove('load-in'); if (!reduceMotion) sunrise(); });
requestAnimationFrame(frame);
window.signifaTour = { info: () => ({ ...renderer.info.render, geo: renderer.info.memory.geometries }), go, switchTour, openSheet, closeSheet, jump(key, i) { if (key !== tourKey) { tourKey = key; tour = TOURS[key]; space = tour[0].space; showFlat(key); placeSun(); buildPager(); } idx = pos = i; snap = true; doorOpen = i > 1 ? 1 : 0; updateUI(); } };

/* ---------- site visit -> WhatsApp ---------- */
$('#visitForm')?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const lines = ["Hello Signifa, I'd like to book a site visit.", `Name: ${f.get('name')}`, `Phone: ${f.get('phone')}`, `Project: ${f.get('project')}`];
  if (f.get('date')) lines.push(`Preferred date: ${f.get('date')}`);
  window.open(`https://api.whatsapp.com/send?phone=918019452299&text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
