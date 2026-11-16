// Admin API: orders, stock and promo codes. Protected by ADMIN_PASSWORD.
// POST /api/admin { action, ...args }  with  Authorization: Bearer <token from login>
import crypto from 'node:crypto';
import { route, send, readJson, db, env, HttpError } from './_lib.js';

const SESSION_HOURS = 12;
const STATUSES = ['pending', 'paid', 'paid_needs_review', 'failed', 'cancelled', 'shipped', 'refunded'];

const secret = () => `${env('ADMIN_PASSWORD')}:${env('SUPABASE_SERVICE_ROLE_KEY')}`;
const sign = exp => crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function checkToken(req) {
  const [exp, sig] = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').split('.');
  if (!exp || !sig || Number(exp) < Date.now() || !same(sig, sign(exp))) throw new HttpError(401, 'Please sign in again.');
}

const int = (v, name, min = 0) => { const n = Number(v); if (!Number.isInteger(n) || n < min) throw new HttpError(400, `Invalid ${name}`); return n; };

const actions = {
  async summary() {
    const orders = await db('orders?select=status,total,currency,created_at&order=created_at.desc&limit=1000');
    const products = await db('products?select=id,stock,active');
    const paid = orders.filter(o => ['paid', 'shipped'].includes(o.status));
    return {
      revenue: paid.reduce((s, o) => s + Number(o.total), 0),
      currency: orders[0]?.currency || env('STORE_CURRENCY') || 'NGN',
      paidCount: paid.length,
      toShip: orders.filter(o => o.status === 'paid').length,
      review: orders.filter(o => o.status === 'paid_needs_review').length,
      pending: orders.filter(o => o.status === 'pending').length,
      lowStock: products.filter(p => p.active && p.stock === 0).length,
    };
  },
  async orders({ status }) {
    const filter = STATUSES.includes(status) ? `&status=eq.${status}` : '';
    return db(`orders?select=*,order_items(*)&order=created_at.desc&limit=200${filter}`);
  },
  async setOrderStatus({ id, status }) {
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new HttpError(400, 'Invalid order');
    const [o] = await db(`orders?id=eq.${id}`, { method: 'PATCH', body: { status }, prefer: 'return=representation' });
    if (!o) throw new HttpError(404, 'Order not found');
    return o;
  },
  async products() {
    return db('products?select=id,name,cat,price_usd,stock,active,data&order=id');
  },
  async updateProduct({ id, stock, active, price_usd }) {
    const patch = { updated_at: new Date().toISOString() };
    if (stock !== undefined) patch.stock = int(stock, 'stock');
    if (active !== undefined) patch.active = !!active;
    if (price_usd !== undefined) { const p = Number(price_usd); if (!(p >= 0)) throw new HttpError(400, 'Invalid price'); patch.price_usd = p; }
    const [p] = await db(`products?id=eq.${int(id, 'product', 1)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    if (!p) throw new HttpError(404, 'Product not found');
    return p;
  },
  async promos() {
    return db('promo_codes?select=*&order=code');
  },
  async savePromo({ code, percent, active = true }) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(400, 'Code must be 3–30 letters or numbers');
    const [p] = await db('promo_codes?on_conflict=code', { method: 'POST', body: { code, percent: int(percent, 'percent', 1), active: !!active }, prefer: 'resolution=merge-duplicates,return=representation' });
    return p;
  },
};

export default route(['POST'], async (req, res) => {
  if (!env('ADMIN_PASSWORD') || !env('SUPABASE_URL')) {
    const e = new HttpError(503, 'Admin is not configured (set ADMIN_PASSWORD).');
    e.publicMessage = 'Admin isn't set up yet: add ADMIN_PASSWORD in your hosting environment variables, then redeploy.';
    throw e;
  }
  const body = await readJson(req);

  if (body.action === 'login') {
    await new Promise(r => setTimeout(r, 400)); // slows down password guessing
    if (!same(body.password || '', env('ADMIN_PASSWORD'))) throw new HttpError(401, 'Wrong password');
    const exp = Date.now() + SESSION_HOURS * 3600e3;
    return send(res, 200, { token: `${exp}.${sign(exp)}`, expires: exp });
  }

  checkToken(req);
  const fn = actions[body.action];
  if (!fn) throw new HttpError(400, 'Unknown action');
  send(res, 200, await fn(body));
});
