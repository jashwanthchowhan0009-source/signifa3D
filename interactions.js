// Page interactions that don't need the 3D scene.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* count-up numbers in the info page */
const countIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  countIO.unobserve(e.target);
  const el = e.target, end = +el.dataset.count;
  if (reduceMotion) { el.textContent = end; return; }
  const t0 = performance.now();
  const tick = (now) => { const k = Math.min((now - t0) / 1400, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

/* magnetic buttons and arrows */
if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.btn, .arrow, .rail a'); if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.2).toFixed(1)}px`);
    b.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px`);
  });
  document.addEventListener('pointerout', (e) => { const b = e.target.closest?.('.btn, .arrow, .rail a'); if (b && !b.contains(e.relatedTarget)) { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); } });
}

/* area statement from the brochure */
const FLATS = '01 2BHK 1485 East|02 2BHK 1335 East|03 3BHK 1780 North|04 3BHK 2165 North|05 2BHK 1275 North|06 2.5BHK 1565 East|07 2.5BHK 1530 East|08 2.5BHK 1530 West|09 2.5BHK 1525 East|10 3BHK 1695 West|11 2BHK 1245 North|12 2BHK 1060 East|13 2BHK 1425 West|14 3BHK 2175 West|15 3BHK 1615 East|16 3BHK 1695 West|17 2BHK 1145 West|18 2BHK 1245 East|19 2BHK 1260 West|20 2BHK 1300 East|21 2BHK 1255 East|22 2BHK 1160 West|23 3BHK 1695 West'.split('|').map((r) => r.split(' '));
const grid = document.getElementById('areaGrid');
if (grid) {
  const render = (f) => { grid.innerHTML = FLATS.filter((r) => f === 'all' || r[1] === f).map((r) => `<div class="flat"><b>${r[0]}</b><span>${r[1].replace('BHK', ' BHK')}</span><strong>${(+r[2]).toLocaleString('en-IN')}</strong><em>${r[3]} facing</em></div>`).join(''); };
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(b.dataset.filter);
  }));
  render('all');
}
