/* Store data comes from config.js (STORE / PRESETS / STORE_KEY) */
const PROMOS = { HERITAGE5: .05, COLLECTOR10: .10 };
const FREE_SHIP = 1000;
const PRODUCTS = STORE.products.map(p => ({ ...p, imgs: p.imgs.map(id => U(id)) }));
const SIZES = STORE.sizes;
const MAX_PRICE = Math.ceil(Math.max(...PRODUCTS.map(p => p.price)) / 10) * 10;

/* ===== Helpers & state ===== */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const money = n => '$' + n.toLocaleString(undefined,{maximumFractionDigits:2});
const store = { get:(k,d)=>JSON.parse(localStorage.getItem(k)||'null')??d, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
const K = k => `obs_${STORE_KEY}_${k}`; // cart & wishlist are kept per store type
let cart = store.get(K('cart'), []).filter(l => PRODUCTS.some(p => p.id === l.id));
let wish = store.get(K('wish'), []).filter(id => PRODUCTS.some(p => p.id === id));
let promo = store.get('obs_promo', null);
const state = { filter:'all', sort:'featured', max:MAX_PRICE };
const byId = id => PRODUCTS.find(p => p.id === id);

/* ===== Fill the page from the chosen store preset ===== */
(() => {
  $$('[data-t]').forEach(el => el.innerHTML = STORE[el.dataset.t] ?? '');
  document.title = `MERIDIAN — ${STORE.label}`;
  $('#heroBg').style.backgroundImage = `url('${STORE.heroImg}')`;
  $('#dropMedia').style.backgroundImage = `url('${STORE.dropImg}')`;
  $('#marquee').innerHTML = STORE.marquee.map(w => `<span>${w}</span><em>✦</em>`).join('');
  const cats = STORE.categories, count = k => PRODUCTS.filter(p => p.cat === k).length;
  $('#navLinks').innerHTML = `<a href="#shop" data-filter="all">Shop</a>` + cats.slice(0,2).map(c => `<a href="#shop" data-filter="${c.key}">${c.label}</a>`).join('') + `<a href="#lookbook">Lookbook</a>`;
  $('#mobileMenu').innerHTML = `<a href="#shop" data-filter="all">Shop all</a>` + cats.map(c => `<a href="#shop" data-filter="${c.key}">${c.label}</a>`).join('') + `<a href="#lookbook">Lookbook</a>`;
  $('#chips').innerHTML = `<button class="chip active" data-filter="all">All</button>` + cats.map(c => `<button class="chip" data-filter="${c.key}">${c.label}</button>`).join('');
  $('#catGrid').innerHTML = cats.map(c => `<a class="cat-card reveal tilt" href="#shop" data-filter="${c.key}" style="--img:url('${U(c.img, 900)}')"><span>${c.label}</span><small>${count(c.key)} ${STORE.unit} →</small></a>`).join('');
  $('#hTrack').innerHTML = STORE.lookbook.map((id, i) => `<figure style="--img:url('${U(id, 900)}')"><figcaption>0${i+1}</figcaption></figure>`).join('');
  const r = $('#priceRange'); r.max = r.value = MAX_PRICE; r.min = 0; $('#priceOut').textContent = MAX_PRICE;
})();

/* ===== Preloader ===== */
(() => {
  let p = 0; const bar = $('#loaderBar');
  const t = setInterval(() => {
    p = Math.min(100, p + Math.random()*18); bar.style.width = p + '%';
    if (p >= 100) { clearInterval(t); setTimeout(() => { $('#loader').classList.add('done'); if (!splashOn) heroIn(); }, 250); }
  }, 90);
})();
function heroIn() { document.body.classList.add('ready'); $$('.hero .split, .hero .reveal').forEach(el=>el.classList.add('in')); }

/* ===== Mobile splash ===== */
var splashOn = false;
(() => {
  const sp = $('#splash');
  if (!matchMedia('(max-width:760px)').matches || sessionStorage.getItem('mer_splash')) { sp.remove(); return; }
  splashOn = true; document.body.classList.add('lock');
  $('#dialTicks').innerHTML = Array.from({length:60}, (_, i) => {
    const big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 70 : 76, r2 = 80;
    return `<line class="${big?'big':''}" style="--d:${i*18}ms" x1="${100+r1*Math.sin(a)}" y1="${100-r1*Math.cos(a)}" x2="${100+r2*Math.sin(a)}" y2="${100-r2*Math.cos(a)}"/>`;
  }).join('');
  $('#splashWord').innerHTML = [...'MERIDIAN'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
  requestAnimationFrame(() => sp.classList.add('on'));
  // Sweep the hands to the classic 10:10, then let the seconds hand tick
  const now = new Date(); let sec = now.getSeconds();
  setTimeout(() => { $('#handH').style.transform = 'rotate(-60deg)'; $('#handM').style.transform = 'rotate(60deg)'; }, 500);
  const tick = setInterval(() => { sec++; $('#handS').style.transform = `rotate(${sec*6}deg)`; }, 1000);
  $('#handS').style.transform = `rotate(${sec*6}deg)`;

  const enter = () => {
    if (!splashOn) return; splashOn = false;
    sessionStorage.setItem('mer_splash', '1'); clearInterval(tick);
    navigator.vibrate?.(12);
    sp.classList.add('leave'); document.body.classList.remove('lock');
    setTimeout(heroIn, 350); setTimeout(() => sp.remove(), 1300);
  };
  $('#splashEnter').addEventListener('click', enter);
  let y0 = null;
  sp.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, {passive:true});
  sp.addEventListener('touchmove', e => { if (y0 === null) return; const d = Math.min(0, e.touches[0].clientY - y0);
    sp.style.transform = `translateY(${d*.6}px)`; sp.style.transition = 'none'; }, {passive:true});
  sp.addEventListener('touchend', e => { const d = e.changedTouches[0].clientY - y0; y0 = null; sp.style.transition = ''; sp.style.transform = '';
    if (d < -60) enter(); }, {passive:true});
})();

/* ===== Split text into words ===== */
$$('.split').forEach(el => {
  let i = 0;
  el.innerHTML = el.innerHTML.split(/(<br>|<em>.*?<\/em>|\s+)/).map(part => {
    if (!part || /^\s+$/.test(part)) return part ? ' ' : '';
    if (part === '<br>') return part;
    return `<span class="w"><span style="--i:${i++}">${part}</span></span>`;
  }).join('');
});

/* ===== Reveal on scroll ===== */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  if (e.target.classList.contains('value')) countUp($('.counter', e.target));
}), { threshold:.15 });
$$('.reveal, .split').forEach(el => { if (!el.closest('.hero')) io.observe(el); });

function countUp(el) {
  const to = +el.dataset.to, dec = +(el.dataset.dec||0), start = performance.now();
  const tick = now => { const k = Math.min(1,(now-start)/1600), e = 1-Math.pow(1-k,4);
    el.textContent = (to*e).toFixed(dec); if (k<1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ===== Cursor ===== */
const cur = $('#cursor'), dot = $('#cursorDot'); let mx=0,my=0,cx=0,cy=0;
addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`; });
(function loop(){ cx+=(mx-cx)*.15; cy+=(my-cy)*.15; cur.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
document.addEventListener('mouseover', e => cur.classList.toggle('hover', !!e.target.closest('a,button,.card-media,.cat-card,select,input')));

/* ===== Magnetic buttons & tilt ===== */
$$('.magnetic').forEach(b => {
  b.addEventListener('mousemove', e => { const r=b.getBoundingClientRect(); b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.3}px,${(e.clientY-r.top-r.height/2)*.4}px)`; });
  b.addEventListener('mouseleave', () => b.style.transform='');
});
$$('.tilt').forEach(c => {
  c.addEventListener('mousemove', e => { const r=c.getBoundingClientRect(), x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
    c.style.transform=`perspective(900px) rotateY(${x*8}deg) rotateX(${-y*8}deg)`; });
  c.addEventListener('mouseleave', () => c.style.transform='');
});

/* ===== Scroll-driven effects ===== */
let lastY = 0;
const nav = $('#nav'), heroBg = $('#heroBg'), marquee = $('#marquee'), hs = $('#hscroll'), hTrack = $('#hTrack');
marquee.innerHTML += marquee.innerHTML + marquee.innerHTML;
let mqX = 0, mqV = 0;
function onScroll() {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  $('#scrollProgress').style.transform = `scaleX(${y/h})`;
  nav.classList.toggle('scrolled', y > 40);
  nav.classList.toggle('hide', y > lastY && y > 400 && !document.body.classList.contains('lock'));
  mqV += (y - lastY) * .08; lastY = y;
  if (y < innerHeight) heroBg.style.translate = `0 ${y*.25}px`;
  $$('.parallax').forEach(el => { const r = el.parentElement.getBoundingClientRect(); el.style.transform = `translateY(${r.top * -(+el.dataset.speed)}px)`; });
  if (innerWidth <= 760) return;
  const r = hs.getBoundingClientRect(), total = hs.offsetHeight - innerHeight;
  const prog = Math.min(1, Math.max(0, -r.top / total));
  hTrack.style.transform = `translateX(${-prog * (hTrack.scrollWidth - innerWidth)}px)`;
}
addEventListener('scroll', onScroll, { passive:true });
(function mq(){ mqV *= .92; mqX -= 0.6 + mqV; const w = marquee.scrollWidth/3; if (mqX <= -w) mqX += w; if (mqX > 0) mqX -= w;
  marquee.style.transform = `translateX(${mqX}px)`; requestAnimationFrame(mq); })();

/* ===== Product grid ===== */
const heart = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>';
function renderGrid() {
  let list = PRODUCTS.filter(p => (state.filter==='all' || p.cat===state.filter) && p.price <= state.max);
  const s = { low:(a,b)=>a.price-b.price, high:(a,b)=>b.price-a.price, rating:(a,b)=>b.rating-a.rating, new:(a,b)=>(b.isNew|0)-(a.isNew|0) }[state.sort];
  if (s) list = [...list].sort(s);
  $('#resultCount').textContent = list.length;
  $('#empty').hidden = list.length > 0;
  $('#grid').innerHTML = list.map((p,i) => `
    <article class="card" style="--i:${i}" data-id="${p.id}">
      <div class="card-media" data-qv>
        ${p.was ? `<span class="tag sale">−${Math.round((1-p.price/p.was)*100)}%</span>` : p.isNew ? '<span class="tag">New</span>' : ''}
        <button class="wish ${wish.includes(p.id)?'on':''}" data-wish aria-label="Wishlist">${heart}</button>
        <img src="${p.imgs[0]}" alt="${p.name}" loading="lazy"><img class="alt" src="${p.imgs[1]}" alt="" loading="lazy">
        <div class="quick-add">${p.options ? `<button data-qvbtn>Choose options</button>` : `<button data-add="One of one">+ Add to bag</button>`}</div>
      </div>
      <div class="card-info">
        <div><h3>${p.name}</h3><small>${p.year} · ${p.condition}</small><div class="swatches">${p.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</div></div>
        <span class="price">${p.was?`<s>${money(p.was)}</s>`:''}${money(p.price)}</span>
      </div>
    </article>`).join('');
}
$('#grid').addEventListener('click', e => {
  const card = e.target.closest('.card'); if (!card) return; const id = +card.dataset.id;
  const w = e.target.closest('[data-wish]'), a = e.target.closest('[data-add]');
  if (e.target.closest('[data-qvbtn]')) { e.stopPropagation(); openQuickView(id); return; }
  if (e.target.closest('[data-qvbtn]')) { e.stopPropagation(); openQuickView(id); return; }
  if (w) { e.stopPropagation(); toggleWish(id, w); return; }
  if (a) { e.stopPropagation(); addToCart(id, a.dataset.add, byId(id).colors[0], $('img',card)); return; }
  if (e.target.closest('[data-qv]')) openQuickView(id);
});

function setFilter(f) {
  state.filter = f;
  $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  renderGrid();
}
$$('[data-filter]').forEach(el => el.addEventListener('click', () => { setFilter(el.dataset.filter); closeMenu(); }));
$('#sortSel').addEventListener('change', e => { state.sort = e.target.value; renderGrid(); });
$('#priceRange').addEventListener('input', e => { state.max = +e.target.value; $('#priceOut').textContent = e.target.value; renderGrid(); });

/* ===== Overlays ===== */
const overlay = $('#overlay');
function openPanel(el) { closeAll(); el.classList.add('open'); overlay.classList.add('on'); document.body.classList.add('lock'); }
function closeAll() { $$('.drawer.open,.modal.open,.search.open').forEach(x=>x.classList.remove('open')); overlay.classList.remove('on'); document.body.classList.remove('lock'); }
overlay.addEventListener('click', closeAll);
$('#quickView').addEventListener('click', e => { if (e.target.id === 'quickView') closeAll(); });
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeAll(); });
addEventListener('keydown', e => { if (e.key==='Escape') closeAll(); if (e.key==='/' && document.activeElement.tagName!=='INPUT') { e.preventDefault(); openSearch(); } });

const menuBtn = $('#menuBtn');
function closeMenu(){ menuBtn.classList.remove('open'); $('#mobileMenu').classList.remove('open'); }
menuBtn.addEventListener('click', () => { menuBtn.classList.toggle('open'); $('#mobileMenu').classList.toggle('open'); });
$$('#mobileMenu a').forEach(a => a.addEventListener('click', closeMenu));

/* ===== Theme ===== */
const root = document.documentElement;
root.dataset.theme = store.get('obs_theme', 'dark');
$('#themeBtn').addEventListener('click', () => { root.dataset.theme = root.dataset.theme==='dark'?'light':'dark'; store.set('obs_theme', root.dataset.theme); });

/* ===== Cart ===== */
function addToCart(id, size, color, imgEl) {
  const key = `${id}-${size}-${color}`, line = cart.find(l => l.key === key);
  const p0 = byId(id), inCart = cart.filter(l=>l.id===id).reduce((s,l)=>s+l.qty,0);
  if (p0.stock && inCart >= p0.stock) { toast(p0.stock===1 ? 'This is a single piece — already in your bag' : 'No more available'); return; }
  line ? line.qty++ : cart.push({ key, id, size, color, qty:1 });
  saveCart(); toast(`Added ${byId(id).name} · ${size}`, 'View bag', () => openPanel($('#cartDrawer')));
  if (imgEl) flyToCart(imgEl);
}
function flyToCart(img) {
  const r = img.getBoundingClientRect(), t = $('#cartBtn').getBoundingClientRect(), f = document.createElement('img');
  f.src = img.src; f.className = 'fly'; Object.assign(f.style,{left:r.left+r.width/2-30+'px',top:r.top+r.height/2-37+'px'});
  document.body.appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(f.style,{left:t.left+'px',top:t.top+'px',width:'20px',height:'20px',opacity:.3,borderRadius:'50%'})));
  setTimeout(() => f.remove(), 850);
}
function saveCart() { store.set(K('cart'), cart); renderCart(); }
function renderCart() {
  const count = cart.reduce((s,l)=>s+l.qty,0), sub = cart.reduce((s,l)=>s+byId(l.id).price*l.qty,0);
  const disc = promo ? sub * PROMOS[promo] : 0;
  badge($('#cartCount'), count);
  $('#cartItems').innerHTML = cart.length ? cart.map(l => { const p = byId(l.id); return `
    <div class="line" data-key="${l.key}"><img src="${p.imgs[0]}" alt="">
      <div><h4>${p.name}</h4><small>${l.size} · <i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${l.color}"></i></small><br>
        <div class="qty"><button data-q="-1">−</button><span>${l.qty}</span><button data-q="1">+</button></div></div>
      <div class="line-right"><span>${money(p.price*l.qty)}</span><button class="rm" data-rm>Remove</button></div></div>`; }).join('')
    : '<p class="drawer-empty">Your bag is empty.</p>';
  const left = Math.max(0, FREE_SHIP - sub);
  $('#shipMsg').innerHTML = left ? `You're <b>${money(left)}</b> away from free shipping` : '✦ You’ve unlocked free shipping';
  $('#shipFill').style.width = Math.min(100, sub/FREE_SHIP*100) + '%';
  $('#subtotal').textContent = money(sub);
  $('#discountRow').hidden = !disc; $('#discount').textContent = '−' + money(disc);
  $('#total').textContent = money(sub - disc);
}
$('#cartItems').addEventListener('click', e => {
  const row = e.target.closest('.line'); if (!row) return; const l = cart.find(x=>x.key===row.dataset.key);
  if (e.target.dataset.q) { const st = byId(l.id).stock; if (+e.target.dataset.q > 0 && st && cart.filter(x=>x.id===l.id).reduce((s,x)=>s+x.qty,0) >= st) { toast('No more available'); return; } l.qty += +e.target.dataset.q; if (l.qty < 1) cart = cart.filter(x=>x!==l); }
  if ('rm' in e.target.dataset) cart = cart.filter(x=>x!==l);
  saveCart();
});
$('#promoForm').addEventListener('submit', e => { e.preventDefault(); const c = $('#promoInput').value.trim().toUpperCase();
  if (PROMOS[c]) { promo = c; store.set('obs_promo', c); toast(`Code ${c} applied`); } else toast('Invalid code');
  renderCart(); });
$('#checkoutBtn').addEventListener('click', () => toast(cart.length ? 'Connect your checkout (Stripe / Shopify) here' : 'Your bag is empty'));
$('#cartBtn').addEventListener('click', () => openPanel($('#cartDrawer')));

/* ===== Wishlist ===== */
function toggleWish(id, btn) {
  wish = wish.includes(id) ? wish.filter(x=>x!==id) : [...wish, id];
  store.set(K('wish'), wish); renderWish();
  if (btn) { btn.classList.toggle('on', wish.includes(id)); btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
  $$(`.card[data-id="${id}"] .wish`).forEach(b => b.classList.toggle('on', wish.includes(id)));
  toast(wish.includes(id) ? 'Saved to wishlist' : 'Removed from wishlist');
}
function renderWish() {
  badge($('#wishCount'), wish.length);
  $('#wishItems').innerHTML = wish.length ? wish.map(id => { const p = byId(id); return `
    <div class="line" data-id="${id}"><img src="${p.imgs[0]}" alt=""><div><h4>${p.name}</h4><small>${money(p.price)}</small></div>
    <div class="line-right"><button class="btn btn-ghost" style="padding:8px 14px" data-view>View</button><button class="rm" data-unwish>Remove</button></div></div>`; }).join('')
    : '<p class="drawer-empty">Nothing saved yet.</p>';
}
$('#wishItems').addEventListener('click', e => { const row = e.target.closest('.line'); if (!row) return; const id = +row.dataset.id;
  if ('view' in e.target.dataset) openQuickView(id); if ('unwish' in e.target.dataset) toggleWish(id); });
$('#wishBtn').addEventListener('click', () => openPanel($('#wishDrawer')));

function badge(el, n) {
  const mirror = $(`.bottom-bar [data-badge="${el.id==='cartCount'?'cart':'wish'}"]`);
  if (mirror) { mirror.textContent = n; mirror.classList.toggle('on', n>0); } const prev = el.textContent; el.textContent = n; el.classList.toggle('on', n>0);
  if (prev != n && n>0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }

/* ===== Quick view (with size + fit finder + recently viewed) ===== */
function openQuickView(id) {
  const p = byId(id), OPTS = p.options || null; let size = OPTS ? null : 'One of one', color = p.colors[0];
  const soldOut = [];
  const fit = STORE_KEY === 'fashion';
  const stars = '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5-Math.round(p.rating));
  $('#qvCard').innerHTML = `
    <div class="qv-gallery"><img id="qvMain" src="${p.imgs[0]}" alt="${p.name}">
      <div class="qv-thumbs">${p.imgs.map((s,i)=>`<img src="${s}" class="${i?'':'on'}" alt="">`).join('')}</div></div>
    <div class="qv-body">
      <button class="icon-btn close" data-close>✕</button>
      <p class="eyebrow">${p.year} · ${p.ref}</p><h2>${p.name}</h2>
      <div class="badges"><span>✓ Authenticated</span><span>${['dress','chrono','desk'].includes(p.cat) ? 'Serviced 2026' : p.condition==='New' ? 'Made to order' : 'Restored'}</span><span>${p.stock===1 ? 'One of one' : 'Rare'}</span></div>
      <div class="stars">${stars}<span>${p.rating} · ${p.reviews} reviews</span></div>
      <span class="price" style="font-size:20px">${p.was?`<s>${money(p.was)}</s>`:''}${money(p.price)}</span>
      <p>${p.desc || 'Responsibly sourced materials, finished by hand in small workshops, and built to be used every day for years.'}</p>
      <div><div class="opt-label">Colour</div><div class="colors">${p.colors.map((c,i)=>`<button style="background:${c}" data-c="${c}" class="${i?'':'on'}"></button>`).join('')}</div></div>
      <dl class="specs">${[['Year',p.year],['Reference',p.ref],['Condition',p.condition],['Movement',p.movement],['Case',p.case],['Measurements',p.measurements]].filter(r=>r[1]).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${OPTS ? `<div><div class="opt-label">${({sun:'Lenses',optical:'Lenses',pens:'Nib',leather:'Lug width'})[p.cat]||'Option'}</div>
        <div class="sizes">${OPTS.map(s=>`<button data-s="${s}" ${soldOut.includes(s)?'disabled':''}>${s}</button>`).join('')}</div></div>` : ''}
      ${fit ? `<div class="fit-finder" id="fitFinder">
        <div class="row"><input id="fH" type="number" placeholder="Height (cm)"><input id="fW" type="number" placeholder="Weight (kg)"></div>
        <button class="btn btn-ghost" id="fitGo" style="padding:10px">Recommend size</button><span id="fitOut"></span></div>` : ''}
      <span class="stock">● ${p.stock===1 ? 'Single piece — once sold, it’s gone' : `Only ${p.stock} available`}</span>
      <button class="btn btn-primary full" id="qvAdd"><span>${OPTS ? 'Choose an option' : `Add to bag — ${money(p.price)}`}</span></button>
    </div>`;
  const card = $('#qvCard');
  $$('.qv-thumbs img', card).forEach(t => t.onclick = () => { $$('.qv-thumbs img',card).forEach(x=>x.classList.remove('on')); t.classList.add('on'); $('#qvMain').src = t.src; });
  const pick = s => { size = s; $$('.sizes button',card).forEach(b=>b.classList.toggle('on', b.dataset.s===s)); $('#qvAdd span').textContent = `Add to bag — ${money(p.price)}`; };
  $$('.sizes button', card).forEach(b => b.onclick = () => pick(b.dataset.s));
  $$('.colors button', card).forEach(b => b.onclick = () => { color = b.dataset.c; $$('.colors button',card).forEach(x=>x.classList.toggle('on', x===b)); });
  if (fit) $('#fitToggle').onclick = () => $('#fitFinder').classList.toggle('open');
  if (fit) $('#fitGo').onclick = () => { const h=+$('#fH').value, w=+$('#fW').value; if(!h||!w) return;
    const bmi = w/((h/100)**2), idx = Math.max(0, Math.min(4, Math.round((bmi-18)/2.5) + (h>185?1:h<160?-1:0)));
    let s = SIZES[idx]; if (soldOut.includes(s)) s = SIZES.find(x=>!soldOut.includes(x));
    $('#fitOut').textContent = `We recommend ${s}.`; pick(s); };
  $('#qvAdd').onclick = () => { if (!size) { $('.sizes',card).animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:300}); return; }
    addToCart(id, size, color, $('#qvMain')); closeAll(); };
  openPanel($('#quickView'));
}

/* ===== Search ===== */
function openSearch() { openPanel($('#searchPanel')); setTimeout(()=>$('#searchInput').focus(), 300); runSearch(''); }
function runSearch(q) {
  q = q.toLowerCase().trim();
  const res = PRODUCTS.filter(p => !q || (p.name+' '+p.cat).toLowerCase().includes(q)).slice(0, 8);
  $('#searchResults').innerHTML = res.length ? res.map((p,i)=>`<div class="s-item" data-id="${p.id}" style="animation-delay:${i*40}ms"><img src="${p.imgs[0]}" alt=""><p>${p.name} — ${money(p.price)}</p></div>`).join('') : '<p style="color:var(--mute)">No results.</p>';
}
$('#searchBtn').addEventListener('click', openSearch);
$('#searchInput').addEventListener('input', e => runSearch(e.target.value));
$('#searchResults').addEventListener('click', e => { const it = e.target.closest('.s-item'); if (it) openQuickView(+it.dataset.id); });

/* ===== Countdown (next drop = 9 days from first visit) ===== */
const dropAt = store.get('obs_drop', Date.now() + 9*864e5); store.set('obs_drop', dropAt);
setInterval(function cd() {
  let s = Math.max(0, (dropAt - Date.now())/1000)|0;
  const v = { d:s/86400|0, h:s%86400/3600|0, m:s%3600/60|0, s:s%60 };
  $$('#countdown b').forEach(b => b.textContent = String(v[b.dataset.u]).padStart(2,'0'));
  return cd;
}(), 1000);

/* ===== Reviews slider ===== */
const quotes = $$('#reviewSlider blockquote'); let qi = 0;
$('#reviewDots').innerHTML = quotes.map((_,i)=>`<button class="${i?'':'on'}" aria-label="Review ${i+1}"></button>`).join('');
const showQ = i => { qi = i; quotes.forEach((q,j)=>q.classList.toggle('active', j===i)); $$('#reviewDots button').forEach((d,j)=>d.classList.toggle('on', j===i)); };
$$('#reviewDots button').forEach((d,i) => d.onclick = () => showQ(i));
setInterval(() => showQ((qi+1) % quotes.length), 6000);

/* ===== Forms & toast ===== */
['#notifyForm','#newsForm'].forEach(s => $(s).addEventListener('submit', e => { e.preventDefault(); e.target.reset(); toast("You're on the list ✦"); }));
let tt;
function toast(msg, action, fn) {
  const t = $('#toast'); t.innerHTML = msg + (action ? ` <button class="btn btn-primary" style="padding:6px 14px">${action}</button>` : '');
  if (fn) $('button', t).onclick = fn;
  t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ===== Mobile: bottom bar + swipe to close sheets/drawers ===== */
$$('.bottom-bar button').forEach(b => b.addEventListener('click', () => {
  const g = b.dataset.go;
  if (g==='shop') { closeAll(); $('#shop').scrollIntoView(); }
  if (g==='search') openSearch();
  if (g==='wish') openPanel($('#wishDrawer'));
  if (g==='cart') openPanel($('#cartDrawer'));
}));
[['#qvCard','y'],['#cartDrawer','x'],['#wishDrawer','x']].forEach(([sel,axis]) => {
  const el = $(sel); let start = null, d = 0;
  el.addEventListener('touchstart', e => { const t = e.touches[0];
    if (axis==='y' && el.scrollTop > 0) return; start = axis==='y' ? t.clientY : t.clientX; d = 0; el.style.transition = 'none'; }, {passive:true});
  el.addEventListener('touchmove', e => { if (start===null) return; const t = e.touches[0];
    d = Math.max(0, (axis==='y' ? t.clientY : t.clientX) - start);
    el.style.transform = axis==='y' ? `translateY(${d}px)` : `translateX(${d}px)`; }, {passive:true});
  el.addEventListener('touchend', () => { if (start===null) return; el.style.transition = ''; el.style.transform = '';
    if (d > 110) closeAll(); start = null; });
});

renderGrid(); renderCart(); renderWish(); onScroll();
