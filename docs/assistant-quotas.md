# Shared Assistant quotas

The Assistant and Code Playground use the same PostgreSQL quota ledger in the
Supabase project used for sign-in. Atomic transactions lock one account row at a
time, so concurrent gateway instances share counters and different users proceed
independently. Server restarts do not reset usage. No extra service key is required.

## Rollout

1. Run `supabase/assistant-quotas.sql` in that project's SQL editor **before**
   deploying the updated Node API. The migration is rerunnable and does not modify
   profiles, files, notes, Mind data or Assistant conversations.
2. Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the API host, or its existing
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` equivalents.
3. Deploy the Node API and frontend from `main`. A signed-in request to
   `/api/assistant/v2/quota` should return `storage: "shared"`.

If the functions are missing or the database is unavailable, Assistant requests
return 503 before calling an AI provider. They never silently switch to independent
in-memory quotas. A local server with no Supabase configuration has a development
store; that exception is unavailable in production.

The former browser-managed `public.user_quotas` table is not trusted or copied into
this ledger. Existing instance-local counters cannot be transferred reliably; each
account begins the new ledger on its first request. No old user content is deleted.

## Accounting and recovery

- 50 user messages per UTC day; 10 new messages per rolling minute.
- 400 gateway work attempts per UTC day; 40 per rolling minute.
- One logical task costs one message, with at most 32 model steps. A turn id is bound
  to the latest user message's fingerprint, independent of older tool history.
- A failed or interrupted model reply refunds the message if no successful or
  pending steps remain in that task. Repeating a refund is harmless. Work attempts
  remain counted to prevent repeated provider failures from bypassing rate limits.
- Pending reservations expire after 15 minutes and are reclaimed on the next
  summary/reserve. The gateway bounds a reply to 10 minutes. Successful reservations
  do not expire into a refund. Receipts older than two full UTC days are cleaned up
  when that user next accesses their quota.
- Rolling burst windows span midnight. Refunds use the original usage day, so late
  failures cannot subtract from the following day's balance.

The database derives identity from `auth.uid()` and chooses its own time and limits.
Quota tables are in a private schema with no browser read/write grants. A random
server-held reservation id acts as a settlement capability, allowing exact refunds
and completion after a session expires. This id must never be included in browser
responses, logs, telemetry or public tables. The settlement RPC returns only a
boolean, cannot list reservations, and is idempotent.

Verified owner emails retain unlimited access; the per-task step ceiling still
applies. Additional exemptions can be added by an administrator:

```sql
insert into toolbox_private.assistant_quota_exemptions(user_id)
values ('<verified account uuid>') on conflict do nothing;
```

`ASSISTANT_UNLIMITED_EMAILS` is superseded by this private database list, so exemptions
are consistent across servers. Unconfirmed email addresses cannot grant owner access.

## Verification

`npm test` runs the migration in embedded PostgreSQL and checks concurrent clients,
restart persistence, idempotent retries, private table permissions, burst/daily/work
limits, expiry, concurrent refunds, and day boundaries. Provider and stream tests
use scripted responses and spend no AI credits.

The ledger relies on PostgreSQL row locking and tightly scoped database functions:
[PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[Supabase database functions](https://supabase.com/docs/guides/database/functions).
