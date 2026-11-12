// Shared helpers for the serverless API (Vercel Node functions).
// Zero dependencies: Supabase is called through its REST API, Paystack through fetch.
import crypto from 'node:crypto';

export const env = k => process.env[k] ?? '';

/* ---------- Store settings (set in your hosting env vars) ---------- */
export const CURRENCY  = (env('STORE_CURRENCY') || 'NGN').toUpperCase(); // what Paystack charges in
export const FX_RATE   = Number(env('USD_TO_CURRENCY') || (CURRENCY === 'USD' ? 1 : 0)); // site prices are USD
export const FREE_SHIP_USD = Number(env('FREE_SHIPPING_OVER_USD') || 1000);
export const SHIPPING_USD  = Number(env('SHIPPING_FLAT_USD') || 35);

/** USD (display) → minor units of the checkout currency, e.g. kobo. */
export const toMinor = usd => Math.round(usd * FX_RATE * 100);

/* ---------- HTTP helpers ---------- */
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readRaw(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = []; for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}
export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRaw(req);
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

/** Wrap a handler with method check + uniform error responses. */
export const route = (methods, fn) => async (req, res) => {
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return send(res, 405, { error: 'Method not allowed' }); }
  try { await fn(req, res); }
  catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(status === 503 ? `[config] ${e.message}` : e);
    send(res, status, { error: status === 503 ? 'Online checkout is temporarily unavailable — please try again shortly.'
                              : status >= 500 ? 'Something went wrong — please try again.' : e.message });
  }
};

export function requireConfig(...keys) {
  const missing = keys.filter(k => !env(k));
  if (missing.length) throw new HttpError(503, `Store backend not configured (missing ${missing.join(', ')}).`);
  if (!FX_RATE) throw new HttpError(503, 'Store backend not configured (set USD_TO_CURRENCY).');
}

/* ---------- Supabase (REST, service role — server only!) ---------- */
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ---------- Paystack ---------- */
export async function paystack(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${env('PAYSTACK_BASE_URL') || 'https://api.paystack.co'}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.status === false) throw new Error(`Paystack ${path} → ${r.status}: ${json.message || 'error'}`);
  return json.data;
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using your secret key. */
export function validPaystackSignature(raw, signature, secret = env('PAYSTACK_SECRET_KEY')) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Order completion (shared by verify + webhook) ---------- */
export async function completeOrder(reference) {
  const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== 'success') return { status: tx.status === 'abandoned' ? 'pending' : 'failed' };

  const result = await db('rpc/mark_order_paid', {
    method: 'POST',
    body: { p_reference: reference, p_amount: tx.amount, p_payload: { id: tx.id, channel: tx.channel, paid_at: tx.paid_at, currency: tx.currency, customer: tx.customer?.email } },
  });
  if (result === 'paid') await sendReceipt(reference).catch(e => console.error('receipt email failed', e));
  return { status: result === 'not_found' ? 'failed' : (['paid', 'oversold', 'amount_mismatch', 'paid_needs_review', 'shipped'].includes(result) ? 'paid' : result) };
}

/* ---------- Email (optional, via Resend) ---------- */
export async function sendReceipt(reference) {
  if (!env('RESEND_API_KEY') || !env('EMAIL_FROM')) return;
  const [o] = await db(`orders?reference=eq.${encodeURIComponent(reference)}&select=*,order_items(*)`);
  if (!o) return;
  const fmt = m => new Intl.NumberFormat('en', { style: 'currency', currency: o.currency }).format(m / 100);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const lines = o.order_items.map(i => `<tr><td>${esc(i.name)}${i.option && i.option !== 'One of one' ? ` · ${esc(i.option)}` : ''} × ${i.qty}</td><td align="right">${fmt(i.unit_price * i.qty)}</td></tr>`).join('');
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#231c13">
    <h1 style="font-weight:300;letter-spacing:.3em">MERIDIAN</h1>
    <p>Thank you, ${esc(o.name)}. Your order <b>${esc(o.reference)}</b> is confirmed.</p>
    <table width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${lines}
      ${o.discount ? `<tr><td>Discount</td><td align="right">−${fmt(o.discount)}</td></tr>` : ''}
      <tr><td>Shipping</td><td align="right">${o.shipping ? fmt(o.shipping) : 'Free'}</td></tr>
      <tr><td><b>Total</b></td><td align="right"><b>${fmt(o.total)}</b></td></tr></table>
    <p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6c55">Every piece is inspected and insured before dispatch. We'll email tracking details when it ships.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM'), to: [o.email], bcc: env('ORDER_NOTIFY_EMAIL') ? [env('ORDER_NOTIFY_EMAIL')] : undefined, subject: `Your MERIDIAN order ${o.reference}`, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}
