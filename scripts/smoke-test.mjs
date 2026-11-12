// End-to-end smoke test with fake Supabase + Paystack servers (no real keys needed).
// Usage:  npm test
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

/* ---------- Fake upstream (Supabase REST + Paystack) ---------- */
const products = [
  { id: 1, name: 'Dress Watch', price_usd: 4850, stock: 1, active: true, data: { colors: ['#d4af37'] } },
  { id: 3, name: 'Aviators', price_usd: 420, stock: 2, active: true, data: { colors: ['#d4af37', '#333'], options: ['Original lenses', 'Prescription'] } },
];
const promos = [{ code: 'COLLECTOR10', percent: 10, active: true }];
const orders = [], items = [];
let paystackAmountOverride = null;

const upstream = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); let body = '';
  for await (const c of req) body += c;
  const json = (s, d) => { res.statusCode = s; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d)); };
  const p = url.pathname, q = url.searchParams;

  if (p === '/rest/v1/products') {
    const ids = q.get('id')?.match(/\((.*)\)/)?.[1].split(',').map(Number);
    return json(200, products.filter(x => !ids || ids.includes(x.id)));
  }
  if (p === '/rest/v1/promo_codes') return json(200, promos.filter(x => x.code === q.get('code').slice(3)));
  if (p === '/rest/v1/orders' && req.method === 'POST') { const o = { id: crypto.randomUUID(), status: 'pending', ...JSON.parse(body) }; orders.push(o); return json(201, [o]); }
  if (p === '/rest/v1/order_items') { items.push(...JSON.parse(body)); return json(201, null); }
  if (p === '/rest/v1/rpc/mark_order_paid') {
    const { p_reference, p_amount } = JSON.parse(body), o = orders.find(x => x.reference === p_reference);
    if (!o) return json(200, 'not_found');
    if (o.status !== 'pending') return json(200, o.status);
    if (p_amount !== o.total) { o.status = 'paid_needs_review'; return json(200, 'amount_mismatch'); }
    let short = false;
    for (const it of items.filter(i => i.order_id === o.id)) { const pr = products.find(x => x.id === it.product_id); if (pr.stock >= it.qty) pr.stock -= it.qty; else short = true; }
    o.status = short ? 'paid_needs_review' : 'paid'; return json(200, short ? 'oversold' : 'paid');
  }
  if (p === '/transaction/initialize') { const b = JSON.parse(body); return json(200, { status: true, data: { access_code: 'AC_' + b.reference, authorization_url: 'https://checkout.paystack.com/x', reference: b.reference } }); }
  if (p.startsWith('/transaction/verify/')) {
    const ref = decodeURIComponent(p.split('/').pop()), o = orders.find(x => x.reference === ref);
    return json(200, { status: true, data: { status: o ? 'success' : 'failed', amount: paystackAmountOverride ?? o?.total, reference: ref, channel: 'card', currency: 'NGN', customer: { email: o?.email } } });
  }
  json(404, { message: 'not mocked: ' + p });
});
await new Promise(r => upstream.listen(0, r));
const up = `http://127.0.0.1:${upstream.address().port}`;

/* ---------- App server pointed at the fakes ---------- */
Object.assign(process.env, {
  SUPABASE_URL: up, SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', PAYSTACK_SECRET_KEY: 'sk_test_fake', PAYSTACK_BASE_URL: up,
  STORE_CURRENCY: 'NGN', USD_TO_CURRENCY: '1500', FREE_SHIPPING_OVER_USD: '1000', SHIPPING_FLAT_USD: '35', SITE_URL: 'http://localhost',
});
const { createServer } = await import('./dev-server.mjs');
const app = createServer(); await new Promise(r => app.listen(0, r));
const base = `http://127.0.0.1:${app.address().port}`;
const call = async (path, opts = {}) => { const r = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const customer = { name: 'Ada Obi', email: 'ada@example.com', phone: '0800', address: '1 Marina', city: 'Lagos', country: 'Nigeria' };
const checkout = (items, extra = {}) => call('/api/checkout', { method: 'POST', body: JSON.stringify({ items, customer, ...extra }) });

let passed = 0; const t = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };
console.log('MERIDIAN API smoke test');

await t('products endpoint lists live stock', async () => {
  const r = await call('/api/products'); assert.equal(r.status, 200); assert.equal(r.body.length, 2); assert.equal(r.body[0].stock, 1);
});

await t('checkout prices from the DB, not the browser (USD→NGN, free shipping, promo)', async () => {
  const r = await checkout([{ id: 1, qty: 1, price: 1 }], { promo: 'collector10' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.subtotal, 4850 * 1500 * 100);
  assert.equal(r.body.discount, Math.round(4850 * 1500 * 100 * 0.10));
  assert.equal(r.body.shipping, 0);
  assert.equal(r.body.total, r.body.subtotal - r.body.discount);
  assert.match(r.body.reference, /^MER-/); assert.ok(r.body.access_code);
});

await t('shipping is charged under the free-shipping threshold', async () => {
  const r = await checkout([{ id: 3, qty: 1, option: 'Prescription' }]);
  assert.equal(r.body.shipping, 35 * 1500 * 100); assert.equal(r.body.total, (420 + 35) * 1500 * 100);
});

await t('rejects missing option, bad quantity, unknown product, bad email', async () => {
  assert.equal((await checkout([{ id: 3, qty: 1 }])).status, 400);
  assert.equal((await checkout([{ id: 1, qty: 0 }])).status, 400);
  assert.equal((await checkout([{ id: 999, qty: 1 }])).status, 400);
  const r = await call('/api/checkout', { method: 'POST', body: JSON.stringify({ items: [{ id: 1, qty: 1 }], customer: { ...customer, email: 'nope' } }) });
  assert.equal(r.status, 400);
});

await t('cannot buy more than stock', async () => {
  const r = await checkout([{ id: 1, qty: 2 }]); assert.equal(r.status, 409);
});

await t('verify marks the order paid and decrements stock (idempotent)', async () => {
  const ref = orders[0].reference;
  const a = await call(`/api/verify?reference=${ref}`); assert.equal(a.body.status, 'paid');
  assert.equal(products[0].stock, 0); assert.equal(orders[0].status, 'paid');
  const b = await call(`/api/verify?reference=${ref}`); assert.equal(b.body.status, 'paid');
  assert.equal(products[0].stock, 0, 'stock not decremented twice');
});

await t('a sold one-of-one piece can no longer be checked out', async () => {
  const r = await checkout([{ id: 1, qty: 1 }]); assert.equal(r.status, 409); assert.match(r.body.error, /sold/);
});

await t('amount mismatch is flagged for review, not silently accepted', async () => {
  paystackAmountOverride = 100;
  const ref = orders[1].reference; await call(`/api/verify?reference=${ref}`);
  assert.equal(orders[1].status, 'paid_needs_review'); paystackAmountOverride = null;
});

await t('webhook rejects a forged signature and accepts a real one', async () => {
  const created = await checkout([{ id: 3, qty: 1, option: 'Original lenses' }]);
  const ref = created.body.reference; assert.equal(orders[2].reference, ref);
  const payload = JSON.stringify({ event: 'charge.success', data: { reference: ref } });
  const bad = await fetch(base + '/api/paystack-webhook', { method: 'POST', body: payload, headers: { 'x-paystack-signature': 'forged' } });
  assert.equal(bad.status, 401); assert.equal(orders[2].status, 'pending');
  const sig = crypto.createHmac('sha512', 'sk_test_fake').update(payload).digest('hex');
  const ok = await fetch(base + '/api/paystack-webhook', { method: 'POST', body: payload, headers: { 'x-paystack-signature': sig } });
  assert.equal(ok.status, 200); assert.equal(orders[2].status, 'paid');
});

await t('rejects malformed references and wrong methods', async () => {
  assert.equal((await call('/api/verify?reference=../../x')).status, 400);
  assert.equal((await call('/api/checkout')).status, 405);
});

await t('server-only files are not served to the browser', async () => {
  for (const p of ['/api/_lib.js', '/supabase/schema.sql', '/scripts/dev-server.mjs', '/.env']) {
    const r = await fetch(base + p); assert.equal(r.status, 404, p);
  }
});

console.log(`\n${passed} passed`);
app.close(); upstream.close();
