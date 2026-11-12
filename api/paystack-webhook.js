// POST /api/paystack-webhook
// Paystack calls this when a payment succeeds — even if the customer closed the tab.
// Set the URL in Paystack Dashboard → Settings → API Keys & Webhooks.
import { route, send, readRaw, validPaystackSignature, completeOrder } from './_lib.js';

export const config = { api: { bodyParser: false } };   // we need the raw body to check the signature

export default route(['POST'], async (req, res) => {
  const raw = await readRaw(req);
  if (!validPaystackSignature(raw, req.headers['x-paystack-signature'])) return send(res, 401, { error: 'Bad signature' });

  let event; try { event = JSON.parse(raw); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  if (event.event === 'charge.success' && /^MER-/.test(event.data?.reference || '')) {
    await completeOrder(event.data.reference);   // re-verifies with Paystack before marking paid
  }
  send(res, 200, { received: true });
});
