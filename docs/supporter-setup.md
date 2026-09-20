# Contributions and supporter perks

Contributions live in Preferences. The existing `#donate` link opens that section.
Anyone can contribute. After a successful guest payment, Toolbox offers an optional
sign-in so the contribution can be remembered on that profile. The public interface
does not advertise an eligibility threshold; it presents a simple one-time contribution.

## Deployment

1. Run `supabase/supporters.sql` in the same Supabase project used for Toolbox sign-in.
2. On the API server, set `SUPABASE_URL` (or existing `VITE_SUPABASE_URL`),
   `SUPABASE_SERVICE_ROLE_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, and `FLUTTERWAVE_SECRET_KEY`.
   Never expose the service role or secret payment key through a `VITE_` variable.
   Both Flutterwave keys must belong to the same account and mode.
3. Deploy the API server as well as the frontend. The existing Vercel rewrite routes
   `/api/*` to the Render server; Vite handles the same API during development.
4. Use Flutterwave test credentials first. Verify signed-in and guest payments,
   cancelled checkout, underpayment, repeat verification, and post-payment claiming,
   then switch both Flutterwave keys to live mode.

Checkout stays unavailable until the backend is configured. No live payment was made
as part of implementation. Use `node --test tests/supporters.test.js` for isolated
request/verification tests; those do not contact a payment service.

## Currency equivalence and confirmation

NGN always uses 5,000. USD, CAD, and GBP use Flutterwave's server-fetched transfer
quote for a destination amount of NGN 5,000, rounding the source amount **up** to the
nearest cent. This is the disclosed supporter-eligibility conversion, not a promise
about a bank's conversion rate or fees. If a quote cannot be obtained, checkout is
blocked for that currency. A changed quote must be reviewed before checkout opens.
The quote is stored with the contribution intent so later rate changes do not alter
that contribution's eligibility.

The server binds an intent to the current account when one exists, or creates an
unclaimed guest intent using the receipt email sent to Flutterwave.
It verifies Flutterwave's transaction ID, reference, successful status, amount, and
currency before recording payment. The SQL transaction locks the intent and enforces
a unique provider transaction ID. A guest claim uses the high-entropy payment reference,
requires an authenticated account, and cannot move an already claimed contribution.
The legacy `/api/payment/verify` endpoint is not used for supporter entitlements.

No webhook setup is required for the immediate confirmation path. For production,
adding a verified Flutterwave webhook is recommended so successful payments can be
reconciled when a browser closes before its checkout callback runs. Refunds and
chargebacks require administrative review and removal of membership if appropriate.

## Publishing early-access previews

There are no invented previews. Supporters see an honest empty state until a release
exists. Add rows to `toolbox_supporter_previews` with `title`, `description`, a
same-origin `url`, and `published=true` when a real preview is ready. These rows are
only returned to authenticated supporters who enable early access. Preview tools
that require protected backend functionality must also verify membership on their own
API endpoints; a hidden link is not access control. Do not list a preview as exclusive
unless its implementation enforces that access.

References: [Flutterwave verification](https://developer.flutterwave.com/docs/transaction-verification),
[transfer quotes](https://developer.flutterwave.com/docs/transfer-rates),
[verify by reference](https://developer.flutterwave.com/reference/verify-transaction-with-tx_ref).
