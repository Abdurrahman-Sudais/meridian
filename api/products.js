// GET /api/products → live price & stock for every piece, so the site can
// mark sold pieces without a redeploy. Cached briefly at the edge.
import { route, send, requireConfig, db } from './_lib.js';

export default route(['GET'], async (req, res) => {
  requireConfig('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  const rows = await db('products?select=id,price_usd,stock,active');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(rows.map(r => ({ id: r.id, price: Number(r.price_usd), stock: r.stock, active: r.active }))));
});
