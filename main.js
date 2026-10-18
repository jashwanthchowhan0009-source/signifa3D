import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
const slides = [...document.querySelectorAll('.slide')];
const root = document.documentElement.style;

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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);

/* ================= ground: soft plinth that melts into the sky ================= */
function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.45, '#fff'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const groundMat = new THREE.MeshStandardMaterial({ color: 0xE6DFD0, roughness: 1, transparent: true, alphaMap: radialTexture(), depthWrite: false });
const ground = new THREE.Mesh(new THREE.CircleGeometry(95, 96), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// manicured lawn ring around the plinth
const lawnRing = new THREE.Mesh(
  new THREE.CircleGeometry(46, 96),
  new THREE.MeshStandardMaterial({ color: 0x7FA45A, roughness: 1, transparent: true, alphaMap: radialTexture(), depthWrite: false })
);
lawnRing.rotation.x = -Math.PI / 2;
lawnRing.position.y = 0.005;
lawnRing.receiveShadow = true;
scene.add(lawnRing);

/* ---------- procedural palms, like the reference ---------- */
function makePalm(height, lean, seed) {
  const g = new THREE.Group();
  const rnd = (i) => { const x = Math.sin(seed * 91.7 + i * 12.9) * 43758.5; return x - Math.floor(x); };
  const top = new THREE.Vector3(lean, height, lean * 0.4);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.15, height * 0.4, 0),
    new THREE.Vector3(lean * 0.55, height * 0.78, lean * 0.2), top,
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.32, 7), palmTrunk);
  trunk.castShadow = true;
  g.add(trunk);
  // trunk rings
  for (let i = 1; i < 12; i++) {
    const p = curve.getPoint(i / 12);
    const ring = new THREE.Mesh(palmRingGeo, palmTrunk);
    ring.position.copy(p); ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const f = new THREE.Mesh(frondGeo, palmLeaf);
    f.position.copy(top);
    f.rotation.order = 'YXZ';
    f.rotation.y = (i / fronds) * Math.PI * 2 + rnd(i) * 0.4;
    f.rotation.x = -0.35 - rnd(i + 20) * 0.5;      // droop
    f.castShadow = true;
    g.add(f);
  }
  const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), palmTrunk);
  coconut.position.copy(top).add(new THREE.Vector3(0, -0.2, 0));
  g.add(coconut);
  return g;
}
const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x8C6A48, roughness: 0.9, flatShading: true });
const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3E7A2E, roughness: 0.75, side: THREE.DoubleSide, flatShading: true });
const palmRingGeo = new THREE.TorusGeometry(0.36, 0.07, 5, 10);
const frondGeo = (() => {
  // a long arched leaf: tapered strip bent downward, with serrated edges
  const seg = 14, len = 7.5, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = Math.sin(Math.PI * Math.min(t * 1.15, 1)) * 1.25 * (i % 2 ? 0.75 : 1);
    const x = t * len, y = Math.sin(t * Math.PI * 0.9) * 1.6 - t * t * 3.2;
    pos.push(x, y, -w, x, y + 0.25, 0, x, y, w);
    if (i < seg) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
})();
[[-23, 17, 14, -1.6], [-13, 26, 13, -1.4], [4, 28, 11, 1.0], [19, 25, 12, 1.3], [26, 8, 11, 1.2]]
  .forEach(([x, z, hgt, lean], i) => {
    const p = makePalm(hgt, lean, i + 1);
    p.position.set(x, 0, z);
    p.rotation.y = Math.atan2(x, z);
    scene.add(p);
  });

/* ================= lights ================= */
const hemi = new THREE.HemisphereLight(0xDDE7F2, 0xB9AE98, 0.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xFFF1D6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
sun.target.position.set(0, 8, 0);
scene.add(sun, sun.target);

// warm garden up-lights that switch on after sunset
const lamps = [[14, 1.5, 10], [-14, 1.5, 12], [4, 10, 3], [-12, 14, 8], [10, 1.5, -12]].map(([x, y, z]) => {
  const l = new THREE.PointLight(0xFFB868, 0, 26, 1.6);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
});

/* ================= luxury materials ================= */
const MAT = {
  // palette lifted from the reference render
  plaster:    new THREE.MeshPhysicalMaterial({ color: 0xF7F6F2, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 }),     // white slab bands + frames
  charcoal:   new THREE.MeshStandardMaterial({ color: 0x55585D, roughness: 0.8 }),                                                // recessed grey walls
  base:       new THREE.MeshStandardMaterial({ color: 0x4D5055, roughness: 0.8 }),
  travertine: new THREE.MeshStandardMaterial({ color: 0xEFEDE8, roughness: 0.45 }),                                               // slab tops / paving
  glass:      new THREE.MeshPhysicalMaterial({ color: 0xC79A62, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.88, envMapIntensity: 1.8, emissive: 0xFFB462, emissiveIntensity: 0.5 }), // warm lit interiors, timber frames
  fins:       new THREE.MeshPhysicalMaterial({ color: 0xFFFFFF, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
  water:      new THREE.MeshPhysicalMaterial({ color: 0x1BB3C2, roughness: 0.02, metalness: 0.1, clearcoat: 1, emissive: 0x16C4D6, emissiveIntensity: 0.1 }),
  foliage:    new THREE.MeshStandardMaterial({ color: 0x3C6B2A, roughness: 0.8 }),
  wood:       new THREE.MeshStandardMaterial({ color: 0x8A4A2C, roughness: 0.55 }),                                               // pergola timber
  bronze:     new THREE.MeshStandardMaterial({ color: 0xD9DDE0, roughness: 0.15, metalness: 1 }),                                 // glass-rail fittings
  lawn:       new THREE.MeshStandardMaterial({ color: 0x5F8F3A, roughness: 1 }),
  tile:       new THREE.MeshStandardMaterial({ color: 0xCDE9EB, roughness: 0.3 }),
};
for (const m of Object.values(MAT)) m.flatShading = true;

/* ================= sun & sky over the day ================= */
// hour, sky top, sky bottom, glow, sun colour, sun intensity, hemi, word colour, night 0..1
const DAY = [
  [6.0,  '#7E9CC6', '#F8C79A', 'rgba(255,186,120,.75)', 0xF2B266, 2.4, 0.34, 'rgba(255,255,255,.50)', 0.3],
  [9.0,  '#5E9BE0', '#E6EEF2', 'rgba(255,236,200,.40)', 0xFFEACB, 3.8, 0.48, 'rgba(255,255,255,.62)', 0],
  [12.0, '#4E92E0', '#DCEBF6', 'rgba(255,250,235,.30)', 0xFFF6E8, 4.3, 0.55, 'rgba(255,255,255,.66)', 0],
  [15.5, '#5E9BDC', '#F2DDBF', 'rgba(255,214,160,.50)', 0xFFE2B8, 4.0, 0.50, 'rgba(255,255,255,.62)', 0],
  [16.9, '#6FA3D8', '#F7C08C', 'rgba(255,168,96,.75)',  0xFFB566, 3.6, 0.44, 'rgba(255,246,232,.58)', 0],
  [17.8, '#58739F', '#F39A62', 'rgba(255,128,70,.70)',  0xF59450, 2.4, 0.34, 'rgba(255,232,210,.40)', 0.25],
  [18.6, '#28325C', '#B9675A', 'rgba(220,110,80,.45)',  0xC0704A, 0.8, 0.22, 'rgba(255,214,190,.24)', 0.75],
  [19.6, '#0E1736', '#2C2E5C', 'rgba(120,110,200,.25)', 0x8090C0, 0.18, 0.16, 'rgba(233,214,174,.16)', 1],
  [21.0, '#09112C', '#1B2249', 'rgba(90,90,180,.20)',   0x8090C0, 0.12, 0.13, 'rgba(233,214,174,.13)', 1],
];

const cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
const lerpHex = (a, b, k) => '#' + cA.set(a).lerp(cB.set(b), k).getHexString();
const lerpRgba = (a, b, k) => {
  const pa = a.match(/[\d.]+/g).map(Number), pb = b.match(/[\d.]+/g).map(Number);
  const p = pa.map((x, i) => x + (pb[i] - x) * k);
  return `rgba(${p[0] | 0},${p[1] | 0},${p[2] | 0},${p[3].toFixed(3)})`;
};

const NOTES = [
  [7, 'Sunrise. Soft east light reaches the bedrooms first.'],
  [10, 'Morning. The ribbons start shading the pool deck.'],
  [14, 'Midday. Deep overhangs keep the rooms cool.'],
  [16.4, 'Afternoon. The garden terraces fall into shade.'],
  [17.7, 'Golden hour. Warm light on the west terraces.'],
  [18.6, 'Sunset. The sky turns to coral over the city.'],
  [21.1, 'Evening. Lights on, pool glowing, garden lit.'],
];
const sunNote = document.getElementById('sunNote');
let lastNote = '';
function fmtTime(h) {
  let H = Math.floor(h), M = Math.round(((h - H) * 60) / 5) * 5;
  if (M === 60) { H += 1; M = 0; }
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H >= 12 ? 'pm' : 'am'}`;
}

let night = 0, golden = 0;
function setSun(h) {
  const t = THREE.MathUtils.clamp((h - 6) / 12, 0, 1);
  const az = t * Math.PI;
  const el = Math.max(Math.sin(t * Math.PI) * THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(6));
  sun.position.set(Math.cos(az) * Math.cos(el) * 130, Math.sin(el) * 130 + 8, 0.38 * Math.cos(el) * 130);

  let i = 0;
  while (i < DAY.length - 2 && h > DAY[i + 1][0]) i++;
  const a = DAY[i], b = DAY[i + 1];
  const k = THREE.MathUtils.clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const top = lerpHex(a[1], b[1], k), bot = lerpHex(a[2], b[2], k);
  root.setProperty('--sky-top', top);
  root.setProperty('--sky-bot', bot);
  root.setProperty('--sun-glow', lerpRgba(a[3], b[3], k));
  root.setProperty('--word', lerpRgba(a[7], b[7], k));
  root.setProperty('--sun-x', `${92 - t * 84}%`);

  sun.color.copy(cA.set(a[4]).lerp(cB.set(b[4]), k));
  sun.intensity = THREE.MathUtils.lerp(a[5], b[5], k);
  hemi.intensity = THREE.MathUtils.lerp(a[6], b[6], k);
  night = THREE.MathUtils.lerp(a[8], b[8], k);
  golden = THREE.MathUtils.clamp(1 - Math.abs(h - 17.1) / 1.6, 0, 1);
  root.setProperty('--cloud', (0.9 - night * 0.75).toFixed(2));
  root.setProperty('--cloud-warm', golden.toFixed(2));
  hemi.color.set(0xDDE7F2).lerp(tmp.set(0x5E6AA8), night);
  scene.environmentIntensity = 0.55 - night * 0.42;

  groundMat.color.set(0xEFE6D6).lerp(tmp.set(bot), 0.4).multiplyScalar(1 - night * 0.55);
  MAT.glass.emissiveIntensity = 0.5 + Math.pow(night, 1.4) * 1.2 + golden * 0.3;
  MAT.glass.opacity = 0.88 + night * 0.1;
  MAT.water.emissiveIntensity = 0.05 + night * 0.9;
  lamps.forEach((l) => (l.intensity = night * 260));
  lawnRing.material.color.set(0x7FA45A).multiplyScalar(1 - night * 0.6);

  const light = h >= 19 ? 'night' : h >= 17.9 ? 'dusk' : 'day';
  document.body.dataset.light = light;
  document.querySelector('meta[name=theme-color]').content = top;
  const note = NOTES.find(([t]) => h < t)?.[1] || NOTES[NOTES.length - 1][1];
  if (note !== lastNote && sunNote) {
    lastNote = note;
    sunNote.classList.remove('swap'); void sunNote.offsetWidth;
    sunNote.textContent = note; sunNote.classList.add('swap');
  }
  const label = fmtTime(h);
  sunOut.textContent = label;
  sunInput.setAttribute('aria-valuetext', label);
  dirty = true;
}

/* ================= model ================= */
const house = new THREE.Group();
scene.add(house);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load(
  'assets/house.glb',
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material?.name;
      o.material = MAT[name] || MAT.plaster;
      o.castShadow = name !== 'glass' && name !== 'water';
      o.receiveShadow = true;
      if (name === 'glass') o.renderOrder = 2;
    });
    house.add(gltf.scene);
    $('#loader').classList.add('done');
    requestAnimationFrame(() => document.body.classList.remove('load-in'));
    dirty = true;
    if (!reduceMotion) sunrise();
  },
  (ev) => { if (ev.total) $('#loaderNum').textContent = Math.round((ev.loaded / ev.total) * 100); },
  () => { $('#loaderText').textContent = 'The 3D villa could not load. Refresh to try again.'; }
);

/* ================= slides → camera ================= */
// data-cam = azimuth, elevation, distance, target x, y, z
const cams = slides.map((s) => s.dataset.cam.split(',').map(Number));
for (let i = 1; i < cams.length; i++) {           // unwrap azimuth so we always turn the short way
  let d = cams[i][0] - cams[i - 1][0];
  while (d > 180) { cams[i][0] -= 360; d -= 360; }
  while (d < -180) { cams[i][0] += 360; d += 360; }
}
let centers = [];
function measure() {
  centers = slides.map((s) => s.offsetTop + s.offsetHeight / 2 - innerHeight / 2);
}

const smooth = (x) => x * x * (3 - 2 * x);
const cur = { az: cams[0][0], el: cams[0][1], dist: cams[0][2], tx: cams[0][3], ty: cams[0][4], tz: cams[0][5] };
const goal = { ...cur };
let activeIdx = 0;

function readScroll() {
  const y = scrollY;
  let i = 0;
  while (i < centers.length - 2 && y > centers[i + 1]) i++;
  let f = (y - centers[i]) / (centers[i + 1] - centers[i] || 1);
  f = THREE.MathUtils.clamp(f, 0, 1);
  // hold on each slide, then travel: gives distinct near/far "shots"
  const k = smooth(THREE.MathUtils.clamp((f - 0.18) / 0.64, 0, 1));
  const a = cams[i], b = cams[i + 1];
  goal.az = a[0] + (b[0] - a[0]) * k;
  goal.el = a[1] + (b[1] - a[1]) * k;
  goal.dist = Math.exp(Math.log(a[2]) + (Math.log(b[2]) - Math.log(a[2])) * k);
  goal.tx = a[3] + (b[3] - a[3]) * k;
  goal.ty = a[4] + (b[4] - a[4]) * k;
  goal.tz = a[5] + (b[5] - a[5]) * k;

  const nearest = f < 0.5 ? i : i + 1;
  if (nearest !== activeIdx) setActive(nearest);

  const prog = THREE.MathUtils.clamp(y / (centers[centers.length - 1] || 1), 0, 1);
  progressBar.style.transform = `scaleX(${prog})`;
  const st = sheet.getBoundingClientRect().top;
  nav.classList.toggle('solid', st < 70);
  pager.classList.toggle('hide', st < innerHeight * 0.5);
  canvasVisible = st > 0;
  dirty = true;
}
let canvasVisible = true;
const progressBar = document.getElementById('progressBar');

/* giant word behind the house */
let wordTimer;
const counterNum = document.getElementById('counterNum');
const counterName = document.getElementById('counterName');
document.getElementById('counterTotal').textContent = String(slides.length).padStart(2, '0');
function setActive(i) {
  activeIdx = i;
  counterNum.textContent = String(i + 1).padStart(2, '0');
  counterName.textContent = slides[i].dataset.name || '';
  document.body.dataset.slide = slides[i].id;
  [...pager.querySelectorAll('a')].forEach((a, j) => a.setAttribute('aria-current', j === i ? 'true' : 'false'));
  const w = slides[i].dataset.word;
  if (wordText.textContent === w) return;
  wordBox.classList.add('swap');
  clearTimeout(wordTimer);
  wordTimer = setTimeout(() => { wordText.textContent = w; wordBox.classList.remove('swap'); }, reduceMotion ? 0 : 320);
}

slides.forEach((s, i) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#' + s.id;
  a.setAttribute('aria-label', s.querySelector('h1, h2')?.textContent.trim() || `Slide ${i + 1}`);
  li.append(a); pager.append(li);
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => e.target.classList.toggle('on', e.isIntersecting));
}, { threshold: 0.35 });
slides.forEach((s) => io.observe(s));

/* ================= 3D hotspots ================= */
const HOTSPOTS = [
  { label: 'Ribbon roof', p: [-6, 23.5, 1], slide: 's-ribbon' },
  { label: 'First-floor pool', p: [3, 10, 1.5], slide: 's-pool' },
  { label: 'Sky garden', p: [4, 13.6, -9.5], slide: 's-garden' },
  { label: 'Stone tower', p: [-8, 26.3, -10], slide: 's-tower' },
];
const hsLayer = document.getElementById('hotspots');
const hsEls = HOTSPOTS.map((h) => {
  const b = document.createElement('a');
  b.className = 'hs'; b.href = '#' + h.slide;
  b.innerHTML = `<span class="hs-dot"></span><span class="hs-label">${h.label}</span>`;
  hsLayer.append(b);
  h.v = new THREE.Vector3(...h.p);
  return b;
});
const _v = new THREE.Vector3();
function placeHotspots() {
  const show = activeIdx === 0 && canvasVisible && house.children.length > 0;
  hsLayer.classList.toggle('show', show);
  if (!show) return;
  HOTSPOTS.forEach((h, i) => {
    _v.copy(h.v).project(camera);
    const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
    hsEls[i].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
}

/* ================= drag to turn ================= */
let yaw = 0, yawVel = 0, dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; yawVel = 0;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  yawVel = -dx * 0.28;
  yaw += yawVel;
  dirty = true;
});
const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

let px = 0, py = 0, cpx = 0, cpy = 0;
if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
  addEventListener('pointermove', (e) => {
    px = (e.clientX / innerWidth) * 2 - 1;
    py = (e.clientY / innerHeight) * 2 - 1;
    dirty = true;
  });
}

/* ================= layout ================= */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.clearViewOffset();
  if (w > 900) camera.setViewOffset(w, h, -w * 0.12, 0, w, h);
  else camera.setViewOffset(w, h, 0, -h * 0.12, w, h);
  camera.updateProjectionMatrix();
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
  sunAnim = (now) => {
    const k = Math.min((now - t0) / dur, 1);
    const h = from + (to - from) * (1 - Math.pow(1 - k, 3));
    sunInput.value = h.toFixed(2);
    setSun(h);
    if (k >= 1) sunAnim = null;
  };
}

/* ================= loop ================= */
const target = new THREE.Vector3();
let dirty = true;
setSun(+sunInput.value);
resize();

const D2R = THREE.MathUtils.degToRad;
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 16.67, 3); lastT = now;
  if (sunAnim) sunAnim(now);
  if (canvasVisible && !reduceMotion) { MAT.water.emissiveIntensity = 0.1 + night * 0.9 + Math.sin(now * 0.002) * 0.06; }

  // gentle idle drift on the hero; inertia after a drag
  if (!dragging) {
    if (Math.abs(yawVel) > 0.01) { yaw += yawVel; yawVel *= 0.93; dirty = true; }
    else if (!reduceMotion && activeIdx === 0 && canvasVisible && document.visibilityState === 'visible') { yaw += 0.03 * dt; dirty = true; }
    else if (activeIdx !== 0 && Math.abs(yaw) > 0.05) {
      yaw = ((yaw + 180) % 360 + 360) % 360 - 180;   // take the short way home
      yaw *= 1 - 0.06 * dt; dirty = true;
    }
  }

  const e = reduceMotion ? 1 : 1 - Math.pow(1 - 0.09, dt);
  let moving = false;
  for (const k in goal) {
    const d = goal[k] - cur[k];
    if (Math.abs(d) > 1e-3) { cur[k] += d * e; moving = true; }
  }
  cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
  if (moving || Math.abs(px - cpx) > 1e-3 || Math.abs(py - cpy) > 1e-3) dirty = true;
  if (!dirty || !canvasVisible) return;
  dirty = false;

  const narrow = camera.aspect < 0.8;
  const dist = cur.dist * (narrow ? 1.45 : 1);
  const az = D2R(cur.az + yaw + cpx * 5);
  const el = D2R(cur.el + cpy * 2.5);
  target.set(cur.tx, cur.ty, cur.tz);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * dist,
    Math.max(target.y + Math.sin(el) * dist, 1.2),
    target.z + Math.cos(az) * Math.cos(el) * dist
  );
  // close shots open the lens a little, far shots compress it: a soft dolly-zoom
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(cur.dist, 36, 118, 44, 28), 28, 46);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.lookAt(target);
  renderer.render(scene, camera);
  placeHotspots();
  // giant word drifts against the cursor: background feels farther than the house
  wordBox.style.transform = `translate3d(${(-cpx * 22).toFixed(1)}px, ${(-cpy * 10).toFixed(1)}px, 0)`;
}
requestAnimationFrame(frame);

/* ================= walkthrough video ================= */
const video = $('.walk-video');
if (video && !reduceMotion) {
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { video.preload = 'auto'; video.play().catch(() => {}); } else video.pause();
  }, { threshold: 0.4 }).observe(video);
}

/* ================= site visit → WhatsApp ================= */
$('#visitForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const lines = [
    "Hello Signifa, I'd like to book a site visit.",
    `Name: ${f.get('name')}`,
    `Phone: ${f.get('phone')}`,
    `Project: ${f.get('project')}`,
  ];
  if (f.get('date')) lines.push(`Preferred date: ${f.get('date')}`);
  window.open(`https://api.whatsapp.com/send?phone=918019452299&text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
