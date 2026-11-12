/* =====================================================================
   Checkout — talks to the serverless API (/api/*) and Paystack.
   Uses globals from app.js: cart, promo, PRODUCTS, byId, saveCart,
   renderGrid, toast, openPanel, $, $$.
   ===================================================================== */
(() => {
  const API = window.MERIDIAN_API || '/api';
  const form = $('#checkoutForm'), done = $('#checkoutDone'), errBox = $('#checkoutError'), payBtn = $('#payBtn');
  const saved = JSON.parse(localStorage.getItem('mer_customer') || '{}');
  Object.entries(saved).forEach(([k, v]) => { if (form.elements[k] && v) form.elements[k].value = v; });

  const fmt = (minor, cur) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(minor / 100);
  const showError = msg => { errBox.textContent = msg; errBox.hidden = !msg; };
  const busy = (on, label) => { payBtn.disabled = on; payBtn.classList.toggle('loading', on); $('span', payBtn).textContent = label || (on ? 'Please wait…' : 'Pay securely'); };

  async function api(path, opts = {}) {
    let r;
    try { r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); }
    catch { throw new Error('Network error — check your connection and try again.'); }
    const data = await r.json().catch(() => null);
    if (!data) throw new Error(r.status === 404 || r.status === 405 ? 'Online checkout isn’t connected yet.' : 'Unexpected response from the store.');
    if (!r.ok) throw new Error(data.error || 'Checkout failed.');
    return data;
  }

  /* ---------- Live stock: mark sold pieces ---------- */
  api('/products').then(rows => {
    let changed = false;
    rows.forEach(r => { const p = byId(r.id); if (!p) return;
      const sold = !r.active || r.stock <= 0;
      if (p.sold !== sold || p.stock !== r.stock) { p.sold = sold; p.stock = Math.max(1, r.stock); changed = true; } });
    if (changed) { renderGrid(); cart = cart.filter(l => !byId(l.id)?.sold); saveCart(); }
  }).catch(() => { /* static hosting without the API — keep catalogue as is */ });

  /* ---------- Steps ---------- */
  const show = step => { form.classList.toggle('open', step === 'form'); done.classList.toggle('open', step === 'done'); };
  $('#checkoutBtn').addEventListener('click', () => {
    if (!cart.length) return toast('Your bag is empty');
    showError(''); $('#payTotal').textContent = 'Calculated securely'; show('form');
    setTimeout(() => form.elements.name.focus({ preventScroll:true }), 500);
  });
  $('#checkoutBack').addEventListener('click', () => show(null));
  document.addEventListener('click', e => { if (e.target.closest('[data-close],#overlay')) setTimeout(() => show(null), 700); });

  /* ---------- Paystack popup (loaded only when needed) ---------- */
  let psLoad;
  const loadPaystack = () => psLoad ||= new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = 'https://js.paystack.co/v2/inline.js';
    s.onload = ok; s.onerror = () => { psLoad = null; fail(new Error('Could not load Paystack.')); }; document.head.appendChild(s);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault(); showError('');
    const f = Object.fromEntries(new FormData(form));
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || !f.address.trim() || !f.city.trim())
      return showError('Please fill in your name, a valid email and your delivery address.');
    localStorage.setItem('mer_customer', JSON.stringify(f));

    busy(true, 'Preparing secure payment…');
    try {
      const order = await api('/checkout', { method: 'POST', body: JSON.stringify({
        items: cart.map(l => ({ id: l.id, option: l.size, color: l.color, qty: l.qty })), customer: f, promo }) });
      $('#payTotal').textContent = fmt(order.total, order.currency);
      sessionStorage.setItem('mer_pending', order.reference);

      try { await loadPaystack(); }
      catch { location.href = order.authorization_url; return; }        // fall back to Paystack's hosted page

      busy(true, `Paying ${fmt(order.total, order.currency)}…`);
      new PaystackPop().resumeTransaction(order.access_code, {
        onSuccess: () => confirmOrder(order.reference),
        onCancel: () => { busy(false); showError('Payment cancelled — your bag is still saved.'); },
        onError: err => { busy(false); showError(err?.message || 'Payment could not start.'); },
      });
    } catch (err) { busy(false); showError(err.message); }
  });

  async function confirmOrder(reference) {
    busy(true, 'Confirming payment…');
    try {
      const { status } = await api(`/verify?reference=${encodeURIComponent(reference)}`);
      if (status !== 'paid') throw new Error(status === 'pending' ? 'Payment not completed yet.' : 'Payment failed — you have not been charged.');
      sessionStorage.removeItem('mer_pending');
      cart.forEach(l => { const p = byId(l.id); if (p && p.stock <= l.qty) p.sold = true; });
      cart = []; saveCart(); renderGrid();
      $('#doneMsg').innerHTML = `Order <b>${reference}</b> is confirmed.<br>A receipt is on its way to your inbox.`;
      openPanel($('#cartDrawer')); show('done'); navigator.vibrate?.([10, 60, 10]);
    } catch (err) { showError(err.message); }
    finally { busy(false); }
  }

  /* ---------- Returning from Paystack's hosted page (?order=REF / ?reference=REF) ---------- */
  const qs = new URLSearchParams(location.search), ref = qs.get('order') || qs.get('reference');
  if (ref && /^MER-/.test(ref)) {
    history.replaceState(null, '', location.pathname);
    openPanel($('#cartDrawer')); show('form'); confirmOrder(ref);
  }
})();
