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

/* ---------- EMI calculator ---------- */
const inr = (v) => '₹' + Math.round(v).toLocaleString('en-IN');
const amt = document.getElementById('emiAmt');
const rate = document.getElementById('emiRate');
const yrs = document.getElementById('emiYrs');
function emi() {
  const P = +amt.value, r = +rate.value / 1200, nM = +yrs.value * 12;
  const E = r ? (P * r * Math.pow(1 + r, nM)) / (Math.pow(1 + r, nM) - 1) : P / nM;
  const total = E * nM, interest = total - P;
  document.getElementById('emiAmtOut').textContent = inr(P);
  document.getElementById('emiRateOut').textContent = `${(+rate.value).toFixed(2).replace(/\.?0+$/, '')}%`;
  document.getElementById('emiYrsOut').textContent = `${yrs.value} years`;
  document.getElementById('emiOut').textContent = inr(E);
  document.getElementById('emiP').textContent = inr(P);
  document.getElementById('emiI').textContent = inr(interest);
  document.getElementById('emiBarP').style.width = `${((P / total) * 100).toFixed(1)}%`;
  [amt, rate, yrs].forEach((i) => i.style.setProperty('--fill', `${((i.value - i.min) / (i.max - i.min)) * 100}%`));
}
[amt, rate, yrs].forEach((i) => i.addEventListener('input', emi));
emi();
