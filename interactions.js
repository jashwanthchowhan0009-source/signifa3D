// Text and element interactions that don't need the 3D scene.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

/* ---------- split text: hero letters, card headings by word ---------- */
function splitLetters(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    s.textContent = ch === ' ' ? ' ' : ch;
    el.append(s);
  });
}
let n = 0;
document.querySelectorAll('.hero h1 .line').forEach((line) => {
  const start = n;
  splitLetters(line);
  line.querySelectorAll('.ch').forEach((c, i) => c.style.setProperty('--i', start + i));
  n += line.textContent.length;
});

document.querySelectorAll('.card h2, .sheet h2').forEach((h) => {
  const words = h.textContent.trim().split(/\s+/);
  h.setAttribute('aria-label', h.textContent.trim());
  h.textContent = '';
  words.forEach((w, i) => {
    const outer = document.createElement('span');
    outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = w; inner.style.setProperty('--i', i);
    outer.append(inner);
    h.append(outer, document.createTextNode(' '));
  });
});

/* sheet headings reveal on enter */
const rev = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); rev.unobserve(e.target); }
}), { threshold: 0.3 });
document.querySelectorAll('.sheet h2, .why-grid article, .values-grid > div').forEach((el) => rev.observe(el));

/* ---------- count-up numbers ---------- */
const countIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  countIO.unobserve(e.target);
  const el = e.target, end = +el.dataset.count;
  if (reduceMotion) { el.textContent = end; return; }
  const t0 = performance.now(), dur = 1400;
  const tick = (now) => {
    const k = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
    if (k < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}), { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

/* ---------- 3D tilt cards ---------- */
if (fine && !reduceMotion) {
  document.querySelectorAll('.card, .why-grid article, .visit, .emi-calc').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------- magnetic buttons ---------- */
  document.querySelectorAll('.btn, .rail a').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
      b.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
}

/* ---------- area statement (brochure) ---------- */
const FLATS = '01 2BHK 1485 East|02 2BHK 1335 East|03 3BHK 1780 North|04 3BHK 2165 North|05 2BHK 1275 North|06 2.5BHK 1565 East|07 2.5BHK 1530 East|08 2.5BHK 1530 West|09 2.5BHK 1525 East|10 3BHK 1695 West|11 2BHK 1245 North|12 2BHK 1060 East|13 2BHK 1425 West|14 3BHK 2175 West|15 3BHK 1615 East|16 3BHK 1695 West|17 2BHK 1145 West|18 2BHK 1245 East|19 2BHK 1260 West|20 2BHK 1300 East|21 2BHK 1255 East|22 2BHK 1160 West|23 3BHK 1695 West'.split('|').map((r) => r.split(' '));
const grid = document.getElementById('areaGrid');
if (grid) {
  const render = (f) => {
    grid.innerHTML = FLATS.filter((r) => f === 'all' || r[1] === f).map((r) => `<div class="flat"><b>${r[0]}</b><span>${r[1].replace('BHK', ' BHK')}</span><strong>${(+r[2]).toLocaleString('en-IN')}</strong><em>${r[3]} facing</em></div>`).join('');
  };
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render(b.dataset.filter);
  }));
  render('all');
}
