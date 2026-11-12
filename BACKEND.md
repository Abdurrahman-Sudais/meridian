# MERIDIAN backend — setup guide

The storefront stays a static site. A small serverless API (in `api/`) handles stock, orders and Paystack payments, with **Supabase** as the database. There are no npm packages to install.

```
Browser ──► /api/checkout ──► Supabase (prices, stock, order)  ──► Paystack (start payment)
   │                                                                  │
   └── Paystack popup ── pays ──► /api/verify  ◄── /api/paystack-webhook ◄┘
                                     └─► mark_order_paid(): order = paid, stock − 1, receipt email
```

## What's included

| File | Purpose |
|---|---|
| `api/products.js` | `GET` live stock and prices. The site greys out sold pieces automatically. |
| `api/checkout.js` | `POST` re-prices the bag **from the database**, checks stock, saves a pending order and starts the Paystack payment |
| `api/verify.js` | `GET` confirms the payment with Paystack after the popup closes |
| `api/paystack-webhook.js` | Paystack's server-to-server confirmation, with its signature checked. Catches payments even if the customer closes the tab. |
| `api/_lib.js`, `api/_pricing.js` | Shared helpers and the pricing rules. Not public routes. |
| `supabase/schema.sql` | Tables, security rules and the atomic `mark_order_paid` function |
| `supabase/seed.sql` | Your 17 pieces and the promo codes, generated from `config.js` |
| `checkout.js` | Front-end checkout: delivery form, Paystack popup and confirmation screen |
| `scripts/dev-server.mjs` | Runs the site and API locally |
| `scripts/smoke-test.mjs` | 11 end-to-end tests against fake Supabase and Paystack servers |

**Safety built in:**
- Prices are always recalculated on the server, so a tampered cart can't change what the customer pays.
- Payments are double-checked with Paystack before an order counts as paid.
- Webhook signatures are verified.
- A one-of-one piece can't be sold twice. If two people pay at the same instant, the second order is flagged `paid_needs_review` so you can refund it.
- Secret keys never reach the browser.

## Setup (about 20 minutes)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in `supabase/schema.sql`, and click Run.
3. Run `npm run seed`, then paste `supabase/seed.sql` into the SQL Editor and run it.
4. Go to **Project Settings → API** and copy the **Project URL** and the **service_role** key.

### 2. Paystack
1. Create an account at [paystack.com](https://paystack.com). It stays in **Test mode** until your business is verified.
2. Go to **Settings → API Keys & Webhooks** and copy the **Test Secret Key** (`sk_test_…`).
3. Set the **Test Webhook URL** to `https://YOUR-SITE/api/paystack-webhook`.

### 3. Deploy on Vercel
1. Import the `meridian` GitHub repo at [vercel.com/new](https://vercel.com/new). Framework preset: **Other**, with no build command.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Deploy. The site and the `/api/*` functions go live together.

### 4. Test a payment
Use Paystack's test card **4084 0840 8408 4081**, any future expiry, CVV **408**, PIN **0000** and OTP **123456**. Paystack's test-cards page lists more.

After paying:
- the order appears in Supabase as `paid`
- the piece's stock drops to 0
- the site shows it as **Sold**

### 5. Go live
Once Paystack approves your business, swap in the **live** secret key and live webhook URL in Vercel and redeploy. Don't put live keys anywhere else.

## Running locally
```bash
cp .env.example .env
```
Fill in `.env` with your test keys, then start the site and API:
```bash
npm run dev
```
It runs at http://localhost:3000.

To run the 11 tests (no keys needed):
```bash
npm test
```

## Day-to-day
- **Add or edit pieces:** change `config.js`, run `npm run seed` and re-run `seed.sql`. Stock for existing pieces is never overwritten, so sales aren't undone.
- **Restock or mark sold:** edit `stock` in Supabase → Table Editor → products.
- **Orders:** Supabase → Table Editor → orders, filtered by `status = paid`. Set `shipped` when dispatched.
- **Promo codes:** use the `promo_codes` table. Set `active = false` to retire a code.

## Not built yet
- An admin dashboard. Use the Supabase table editor for now.
- Shipping-status emails and customer accounts.
- Exchange rates are set by hand in `USD_TO_CURRENCY`. You could switch to pricing directly in naira.
- Old unpaid `pending` orders aren't cleaned up automatically. They're harmless.
