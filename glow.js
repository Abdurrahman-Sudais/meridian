// Interactive glow: a warm light follows the pointer across cards, category tiles and buttons,
// plus a soft ambient spotlight on the page. Remove this script tag to turn it off.
(() => {
  if (matchMedia('(hover:none), (prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('glow-on');
  const amb = document.createElement('div'); amb.className = 'glow-ambient'; document.body.appendChild(amb);
  const SEL = '.card-media, .cat-card, .btn, .stat-glow';
  let x = innerWidth / 2, y = innerHeight / 2, ax = x, ay = y, raf;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    const el = e.target.closest?.(SEL);
    if (el) { const r = el.getBoundingClientRect(); el.style.setProperty('--gx', `${x - r.left}px`); el.style.setProperty('--gy', `${y - r.top}px`); }
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
  function tick() {
    ax += (x - ax) * .12; ay += (y - ay) * .12;
    amb.style.transform = `translate(${ax}px, ${ay}px)`;
    raf = Math.abs(x - ax) + Math.abs(y - ay) > .5 ? requestAnimationFrame(tick) : 0;
  }
})();
