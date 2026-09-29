# Contributions and supporter perks

Contributions live in Preferences. The existing `#donate` link opens that section.
Anyone can contribute. After a successful guest payment, Toolbox offers an optional
sign-in so the contribution can be remembered on that profile. The public interface
does not advertise an eligibility threshold; it presents a simple one-time contribution.

## Deployment

1. Run `supabase/supporters.sql` in the same Supabase project used for Toolbox sign-in.
2. On the API server (e.g. Render), set `SUPABASE_URL` (or existing `VITE_SUPABASE_URL`)
   and `SUPABASE_SERVICE_ROLE_KEY`.
   For Flutterwave, the checkout needs the account's API keys from the dashboard's
   **Settings → API keys** page: `FLUTTERWAVE_PUBLIC_KEY` (or `FLW_PUBLIC_KEY`), the
   **Public key** (`FLWPUBK-…-X`, or `FLWPUBK_TEST-…-X` in test mode), and
   `FLUTTERWAVE_SECRET_KEY` (or `FLW_SECRET_KEY`), the **Secret key** (`FLWSECK-…`) from
   the same page and mode. v4 OAuth credentials (`FLW_CLIENT_ID`, `FLW_CLIENT_SECRET`)
   can also verify charges and fetch rates, but they cannot open the checkout: a Client
   ID sent as the public key makes Flutterwave answer "Invalid parameter (PBFPubKey)".
   Never expose the service role or secret payment key through a `VITE_` variable.
   The server reads keys without surrounding quotes, and adds a missing `FLWPUBK-`
   prefix (`FLWPUBK_TEST-` when the secret key or `FLW_ENVIRONMENT` says test mode).
3. Deploy the API server as well as the frontend. The Cloudflare Worker
   (`worker/index.js`) forwards `/api/*` to the Node server on Render, so the
   settings in step 2 belong on Render, and Render must be redeployed (or restarted)
   after they change. Vite handles the same API during development.
4. Use Flutterwave test credentials first. Verify signed-in and guest payments,
   cancelled checkout, underpayment, repeat verification, and post-payment claiming,
   then switch both Flutterwave keys to live mode.

Checkout stays unavailable until the backend is configured. No live payment was made
as part of implementation. Use `node --test tests/supporters.test.js tests/flutterwave.test.js` for isolated
request/verification tests; those do not contact a payment service.

## When contributions do not work

Preferences shows what the server found; the Render log has the details (lines start with `[supporter]`).

| Message | Fix |
| --- | --- |
| Flutterwave: "Invalid parameter (PBFPubKey)" | The checkout got something other than the account's Public key. Set `FLUTTERWAVE_PUBLIC_KEY` to the Public key from Settings → API keys (not the Client ID or Encryption key), then redeploy. The server now refuses to open the checkout without one and says why. |
| "…needs FLUTTERWAVE_PUBLIC_KEY / FLUTTERWAVE_SECRET_KEY" | Add the missing key on Render, then redeploy. |
| "The Client ID and Client Secret cannot open the checkout" | Only v4 OAuth credentials are set; add the Public and Secret keys too. |
| "…holds a secret key" | The secret key was pasted into `FLUTTERWAVE_PUBLIC_KEY`. |
| "…from different modes" | One key is a test key and the other live; use a matching pair. |
| "the server is missing SUPABASE_…" | Add those settings on Render, then redeploy. |
| "not set up in the database yet" | Run `supabase/supporters.sql` in the Supabase SQL editor. |
| "The Toolbox database rejected this server's key" | `SUPABASE_SERVICE_ROLE_KEY` is wrong or is the anon key; use the service_role key. |
| "Flutterwave rejected this server's secret key" | `FLUTTERWAVE_SECRET_KEY` is wrong, or from another account or mode. |
| "The USD/CAD/GBP to NGN rate is not available" | Flutterwave's transfer-rate API is not enabled for the account; NGN still works. |
| "The Toolbox server isn't answering" | Render is asleep or down; wait a minute and retry. |
| "does not have contributions yet" | The Render server runs older code; redeploy it from `main`. |

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
