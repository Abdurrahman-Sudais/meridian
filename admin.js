// MERIDIAN admin dashboard (talks to /api/admin).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'mer_admin';
let token = sessionStorage.getItem(KEY);

const money = (minor, cur = 'NGN') => new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(minor / 100);
const when = d => new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const LABEL = { pending: 'Pending', paid: 'Paid', paid_needs_review: 'Review', failed: 'Failed', cancelled: 'Cancelled', shipped: 'Shipped', refunded: 'Refunded' };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

async function api(action, args = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...args }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== 'login') { signOut(); throw new Error(body.error); }
  if (!r.ok) throw new Error(body.error || 'Request failed');
  return body;
}

/* ---------- Auth ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; $('#loginErr').textContent = '';
  try { token = (await api('login', { password: $('#pw').value })).token; sessionStorage.setItem(KEY, token); start(); }
  catch (err) { $('#loginErr').textContent = err.message; }
  btn.disabled = false;
});
function signOut() { token = null; sessionStorage.removeItem(KEY); $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); $('#pw').value = ''; }
$('#logout').addEventListener('click', signOut);

/* ---------- Tabs ---------- */
const loaders = { overview: loadOverview, orders: loadOrders, products: loadProducts, promos: loadPromos };
$('#tabs').addEventListener('click', e => {
  const v = e.target.dataset.v; if (!v) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === e.target));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.id !== `v-${v}`));
  loaders[v]().catch(err => toast(err.message));
});

function start() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  loadOverview().catch(err => toast(err.message));
}

/* ---------- Overview ---------- */
async function loadOverview() {
  const [s, ship] = await Promise.all([api('summary'), api('orders', { status: 'paid' })]);
  $('#stats').innerHTML = [
    ['Revenue', money(s.revenue, s.currency), 'hl'],
    ['Paid orders', s.paidCount],
    ['To ship', s.toShip],
    ['Needs review', s.review],
    ['Sold out pieces', s.lowStock],
  ].map(([k, v, c = '']) => `<div class="stat ${c}"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#toShip').innerHTML = ship.length ? ship.map(orderHtml).join('') : '<p class="empty">Nothing waiting to ship.</p>';
}

/* ---------- Orders ---------- */
async function loadOrders() {
  const list = await api('orders', { status: $('#statusFilter').value });
  $('#orders').innerHTML = list.length ? list.map(orderHtml).join('') : '<p class="empty">No orders here yet.</p>';
}
$('#statusFilter').addEventListener('change', () => loadOrders().catch(err => toast(err.message)));
$('#refresh').addEventListener('click', () => loadOrders().then(() => toast('Updated')).catch(err => toast(err.message)));

function orderHtml(o) {
  const a = o.address || {}, cur = o.currency;
  const items = (o.order_items || []).map(i => `<tr><td>${esc(i.name)}${i.option && i.option !== 'One of one' ? ` <small>· ${esc(i.option)}</small>` : ''} × ${i.qty}</td><td>${money(i.unit_price * i.qty, cur)}</td></tr>`).join('');
  const next = {
    paid: [['shipped', 'Mark shipped', ''], ['refunded', 'Mark refunded', 'ghost']],
    paid_needs_review: [['paid', 'Approve', ''], ['refunded', 'Mark refunded', 'ghost']],
    shipped: [['paid', 'Undo shipped', 'ghost']],
    pending: [['cancelled', 'Cancel', 'ghost']],
  }[o.status] || [];
  return `<details class="order" data-id="${o.id}">
    <summary>
      <span class="ref">${esc(o.reference)}<br>${when(o.created_at)}</span>
      <span class="who"><b>${esc(o.name)}</b><span>${esc(o.email)}</span></span>
      <span class="amt">${money(o.total, cur)}</span>
      <span class="pill ${o.status}">${LABEL[o.status] || o.status}</span>
    </summary>
    <div class="order-body">
      <div>
        ${o.status === 'paid_needs_review' ? '<div class="note">Paid, but the amount didn\'t match or the piece had already sold. Check Paystack, then approve or refund.</div>' : ''}
        <table>${items}
          ${o.discount ? `<tr><td>Discount${o.promo ? ` (${esc(o.promo)})` : ''}</td><td>−${money(o.discount, cur)}</td></tr>` : ''}
          <tr><td>Shipping</td><td>${o.shipping ? money(o.shipping, cur) : 'Free'}</td></tr>
          <tr class="tot"><td>Total</td><td>${money(o.total, cur)}</td></tr>
        </table>
      </div>
      <div>
        <h4>Deliver to</h4>
        <p>${esc(o.name)}</p><p>${esc(a.address)}</p><p>${esc([a.city, a.country].filter(Boolean).join(', '))}</p>
        <p>${esc(o.phone)}</p>
        ${o.paystack?.channel ? `<h4 style="margin-top:14px">Payment</h4><p>${esc(o.paystack.channel)} · ${o.paystack.paid_at ? when(o.paystack.paid_at) : ''}</p>` : ''}
        <div class="acts">${next.map(([s, l, c]) => `<button class="btn ${c}" data-status="${s}">${l}</button>`).join('')}</div>
      </div>
    </div>
  </details>`;
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-status]'); if (!b) return;
  const id = b.closest('.order').dataset.id, status = b.dataset.status;
  if (status === 'refunded' && !confirm('Mark as refunded? Do the actual refund in your Paystack dashboard.')) return;
  b.disabled = true;
  try {
    await api('setOrderStatus', { id, status });
    toast(`Order marked ${LABEL[status].toLowerCase()}`);
    const v = document.querySelector('#tabs .on').dataset.v; await loaders[v]();
  } catch (err) { toast(err.message); b.disabled = false; }
});

/* ---------- Products ---------- */
async function loadProducts() {
  const list = await api('products');
  $('#products').innerHTML = list.map(p => `
    <div class="prod ${p.active ? '' : 'off'}" data-id="${p.id}">
      <img src="${esc(p.data?.imgs?.[0] || '')}" alt="" loading="lazy" />
      <div><b>${esc(p.name)}</b><small>${esc(p.cat)}${p.stock === 0 ? ' · <span class="sold">Sold out</span>' : ''}</small></div>
      <div class="ctl">
        <label>Stock<input type="number" min="0" name="stock" value="${p.stock}" /></label>
        <label>Price (USD)<input type="number" min="0" step="1" name="price_usd" value="${Number(p.price_usd)}" /></label>
        <label class="toggle"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} /> Live</label>
      </div>
    </div>`).join('');
}
$('#products').addEventListener('change', async e => {
  const card = e.target.closest('.prod'), f = e.target;
  const val = f.type === 'checkbox' ? f.checked : f.value;
  try {
    const p = await api('updateProduct', { id: Number(card.dataset.id), [f.name]: val });
    card.classList.toggle('off', !p.active);
    toast('Saved');
  } catch (err) { toast(err.message); }
});

/* ---------- Promos ---------- */
async function loadPromos() {
  const list = await api('promos');
  $('#promos').innerHTML = list.length ? list.map(p => `
    <div class="promo"><code>${esc(p.code)}</code><span>${p.percent}% off</span>
      <label class="toggle" style="padding:0"><input type="checkbox" data-code="${esc(p.code)}" data-pct="${p.percent}" ${p.active ? 'checked' : ''} /> Active</label></div>`).join('')
    : '<p class="empty">No promo codes.</p>';
}
$('#promoForm').addEventListener('submit', async e => {
  e.preventDefault();
  try { await api('savePromo', { code: $('#promoCode').value, percent: Number($('#promoPct').value) }); e.target.reset(); toast('Promo saved'); loadPromos(); }
  catch (err) { toast(err.message); }
});
$('#promos').addEventListener('change', async e => {
  const c = e.target.dataset.code; if (!c) return;
  try { await api('savePromo', { code: c, percent: Number(e.target.dataset.pct), active: e.target.checked }); toast(e.target.checked ? 'Activated' : 'Deactivated'); }
  catch (err) { toast(err.message); }
});

if (token && Number(token.split('.')[0]) > Date.now()) start(); else signOut();
