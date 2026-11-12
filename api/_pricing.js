// Pure pricing logic — the server's source of truth for what a customer pays.
// Kept separate (no I/O) so it can be unit-tested.
import { HttpError } from './_lib.js';

/**
 * @param items     [{ id, option, color, qty }] from the browser (untrusted)
 * @param products  rows from the products table, keyed by id
 * @param promo     { code, percent } | null
 * @param o         { toMinor, freeShipUsd, shippingUsd }
 */
export function priceCart(items, products, promo, { toMinor, freeShipUsd, shippingUsd }) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Your bag is empty.');
  if (items.length > 50) throw new HttpError(400, 'Too many items.');

  // Merge duplicate lines and validate quantities against stock.
  const qtyById = new Map();
  const lines = items.map(raw => {
    const id = Number(raw?.id), qty = Math.floor(Number(raw?.qty));
    const p = products.get(id);
    if (!p || !p.active) throw new HttpError(400, 'One of the pieces in your bag is no longer available.');
    if (!(qty >= 1 && qty <= 10)) throw new HttpError(400, 'Invalid quantity.');
    const opts = p.data?.options;
    const option = opts ? String(raw.option ?? '') : 'One of one';
    if (opts && !opts.includes(option)) throw new HttpError(400, `Please choose an option for ${p.name}.`);
    const colors = p.data?.colors || [];
    const color = colors.includes(raw.color) ? raw.color : colors[0] ?? null;
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
    return { product_id: id, name: p.name, option, color, qty, unit_price: toMinor(Number(p.price_usd)) };
  });
  for (const [id, q] of qtyById) {
    const p = products.get(id);
    if (p.stock < q) throw new HttpError(409, p.stock ? `Only ${p.stock} of ${p.name} available.` : `${p.name} has just been sold.`);
  }

  const subtotalUsd = lines.reduce((s, l) => s + Number(products.get(l.product_id).price_usd) * l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const discount = promo ? Math.round(subtotal * promo.percent / 100) : 0;
  const shipping = subtotalUsd >= freeShipUsd ? 0 : toMinor(shippingUsd);
  const total = subtotal - discount + shipping;
  if (total <= 0) throw new HttpError(400, 'Invalid total.');
  return { lines, subtotal, discount, shipping, total };
}
