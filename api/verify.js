// GET /api/verify?reference=MER-...
// Called by the browser after the Paystack popup closes. Confirms with Paystack
// server-side (never trust the browser) and marks the order paid.
import { route, send, requireConfig, completeOrder, HttpError } from './_lib.js';

export default route(['GET'], async (req, res) => {
  requireConfig('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYSTACK_SECRET_KEY');
  const reference = new URL(req.url, 'http://x').searchParams.get('reference') || '';
  if (!/^MER-[A-Z0-9-]{6,40}$/.test(reference)) throw new HttpError(400, 'Invalid reference.');
  const { status } = await completeOrder(reference);
  send(res, 200, { reference, status });
});
