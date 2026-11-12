// POST /api/checkout
// Body: { items:[{id,option,color,qty}], customer:{name,email,phone,address,city,country}, promo }
// Re-prices the bag from the database, saves a pending order and starts a Paystack transaction.
import crypto from 'node:crypto';
import { route, send, readJson, requireConfig, db, paystack, HttpError, CURRENCY, toMinor, FREE_SHIP_USD, SHIPPING_USD, env } from './_lib.js';
import { priceCart } from './_pricing.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export default route(['POST'], async (req, res) => {
  requireConfig('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYSTACK_SECRET_KEY');
  const body = await readJson(req);

  const c = body.customer || {};
  const customer = { name: clean(c.name, 120), email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 40) };
  const address = { line1: clean(c.address), city: clean(c.city, 80), country: clean(c.country, 80) };
  if (!customer.name) throw new HttpError(400, 'Please enter your name.');
  if (!EMAIL.test(customer.email)) throw new HttpError(400, 'Please enter a valid email.');
  if (!address.line1 || !address.city) throw new HttpError(400, 'Please enter your delivery address.');

  // Load only the products in the bag.
  const ids = [...new Set((body.items || []).map(i => Number(i?.id)).filter(Number.isInteger))];
  if (!ids.length) throw new HttpError(400, 'Your bag is empty.');
  const rows = await db(`products?id=in.(${ids.join(',')})&select=id,name,price_usd,stock,active,data`);
  const products = new Map(rows.map(r => [r.id, r]));

  let promo = null;
  const code = clean(body.promo, 40).toUpperCase();
  if (code) {
    const [p] = await db(`promo_codes?code=eq.${encodeURIComponent(code)}&active=is.true&select=code,percent`);
    promo = p || null;   // an invalid code is ignored rather than blocking checkout
  }

  const priced = priceCart(body.items, products, promo, { toMinor, freeShipUsd: FREE_SHIP_USD, shippingUsd: SHIPPING_USD });
  const reference = `MER-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const [order] = await db('orders', {
    method: 'POST', prefer: 'return=representation',
    body: { reference, ...customer, address, currency: CURRENCY, subtotal: priced.subtotal, discount: priced.discount, shipping: priced.shipping, total: priced.total, promo: promo?.code ?? null },
  });
  await db('order_items', { method: 'POST', body: priced.lines.map(l => ({ ...l, order_id: order.id })) });

  const site = env('SITE_URL') || `https://${req.headers.host}`;
  const tx = await paystack('/transaction/initialize', {
    method: 'POST',
    body: {
      email: customer.email, amount: priced.total, currency: CURRENCY, reference,
      callback_url: `${site}/?order=${reference}`,
      metadata: { order_id: order.id, custom_fields: [{ display_name: 'Customer', variable_name: 'customer', value: customer.name }] },
    },
  });

  send(res, 200, {
    reference, access_code: tx.access_code, authorization_url: tx.authorization_url,
    currency: CURRENCY, subtotal: priced.subtotal, discount: priced.discount, shipping: priced.shipping, total: priced.total,
  });
});
