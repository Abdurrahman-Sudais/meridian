/* =====================================================================
   Mobile motion layer — touch-first animations for phones.
   Loaded after app.js. Everything here is skipped on desktop and
   respects "reduce motion".
   ===================================================================== */
(() => {
  const mobile = matchMedia('(max-width:760px)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el=document) => el.querySelector(s), $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const buzz = ms => navigator.vibrate?.(ms);

  /* Countdown digits roll when they change (all screens) */
  new MutationObserver(ms => ms.forEach(m => {
    const b = m.target.nodeType === 3 ? m.target.parentElement : m.target;
    if (!b.matches?.('#countdown b')) return;
    b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
  })).observe($('#countdown'), { subtree:true, childList:true, characterData:true });

  if (!mobile || calm) return;
  document.body.classList.add('m-motion');

  /* 1. Cards rise in as they scroll into view, and come alive when centred */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('seen'); revealIO.unobserve(e.target); }
  }), { rootMargin:'0px 0px -8% 0px' });
  const liveTimers = new WeakMap();
  const liveIO = new IntersectionObserver(es => es.forEach(e => {
    const c = e.target;
    if (e.intersectionRatio > .7) liveTimers.set(c, setTimeout(() => c.classList.add('live'), 900));
    else { clearTimeout(liveTimers.get(c)); c.classList.remove('live'); }
  }), { threshold:[0, .7] });
  const prepCards = () => $$('#grid .card:not(.m-wait)').forEach((c, i) => {
    c.classList.add('m-wait'); c.style.setProperty('--col', i % 2);
    revealIO.observe(c); liveIO.observe(c);
  });
  prepCards();
  new MutationObserver(prepCards).observe($('#grid'), { childList:true });

  /* 2. Ink ripple + haptic tick on every tappable control */
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('.btn,.chip,.icon-btn,.bottom-bar button,.quick-add button,.sizes button,.wish');
    if (!t) return;
    const r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, dot = document.createElement('span');
    dot.className = 'ripple';
    Object.assign(dot.style, { width:s+'px', height:s+'px', left:e.clientX-r.left-s/2+'px', top:e.clientY-r.top-s/2+'px' });
    t.appendChild(dot); setTimeout(() => dot.remove(), 700);
  }, { passive:true });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-add],#qvAdd')) buzz([8, 40, 12]);
    else if (e.target.closest('[data-wish],.chip,.bottom-bar button')) buzz(6);
  });

  /* 3. Categories become a swipe carousel whose centre card grows */
  const cg = $('#catGrid');
  cg.classList.add('m-carousel');
  const scaleCats = () => {
    const mid = cg.scrollLeft + cg.clientWidth / 2;
    $$('.cat-card', cg).forEach(c => {
      const d = Math.min(1, Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth);
      c.style.setProperty('--k', (1 - d).toFixed(3));
    });
  };
  cg.addEventListener('scroll', () => requestAnimationFrame(scaleCats), { passive:true });
  addEventListener('resize', scaleCats); scaleCats();

  /* 4. Hero: copy lifts and fades as you scroll; image drifts with the phone's tilt */
  const hero = $('.hero-content'), heroBg = $('#heroBg');
  addEventListener('scroll', () => {
    const k = Math.min(1, scrollY / (innerHeight * .6));
    hero.style.transform = `translateY(${-k * 60}px)`; hero.style.opacity = 1 - k * .9;
  }, { passive:true });
  if (typeof DeviceOrientationEvent !== 'undefined' && !DeviceOrientationEvent.requestPermission) {
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 30)), y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      heroBg.style.setProperty('--tx', `${x * -14}px`); heroBg.style.setProperty('--ty', `${y * -10}px`);
    });
  }

  /* 5. Bottom bar slides in after the splash and tracks where you are */
  const bar = $('.bottom-bar');
  bar.insertAdjacentHTML('afterbegin', '<i class="bar-pill"></i>');
  const pill = $('.bar-pill', bar), btns = $$('button', bar);
  const movePill = i => { const b = btns[i]; pill.style.width = b.offsetWidth * .5 + 'px'; pill.style.transform = `translateX(${b.offsetLeft + b.offsetWidth * .25}px)`; btns.forEach((x, j) => x.classList.toggle('active', j === i)); };
  const showBar = () => { bar.classList.add('in'); movePill(0); };
  const waitSplash = () => $('#splash') ? setTimeout(waitSplash, 300) : setTimeout(showBar, 600);
  waitSplash();
  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) movePill(0); }), { threshold:.2 }).observe($('#shop'));
  btns.forEach((b, i) => b.addEventListener('click', () => movePill(i)));
  document.addEventListener('click', e => { if (e.target.closest('[data-close],#overlay')) movePill(0); });

  /* 6. Section titles get a gold rule that draws in */
  $$('.section-head').forEach(h => h.classList.add('m-rule'));
  const ruleIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('drawn')), { threshold:.6 });
  $$('.m-rule').forEach(h => ruleIO.observe(h));
})();
