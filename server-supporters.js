import { randomUUID } from 'node:crypto';

export const SUPPORTER_THRESHOLD_NGN = 5000;
export const PROFILE_STYLES = ['classic', 'etched', 'halo', 'orbit'];
const CURRENCIES = ['NGN', 'USD', 'CAD', 'GBP'];

export function validateContribution(payment, intent) {
  return payment?.status === 'successful'
    && /^\d{1,24}$/.test(String(payment.id))
    && payment.tx_ref === intent.tx_ref
    && payment.currency === intent.currency
    && Number.isFinite(Number(payment.amount))
    && Number(payment.amount) >= Number(intent.amount);
}

export function supporterThreshold(quote, currency) {
  if (currency === 'NGN') return SUPPORTER_THRESHOLD_NGN;
  const amount = Number(quote?.source?.amount);
  if (quote?.source?.currency !== currency || quote?.destination?.currency !== 'NGN'
    || Number(quote.destination.amount) !== SUPPORTER_THRESHOLD_NGN || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Currency quote unavailable');
  }
  return Math.ceil(amount * 100) / 100;
}

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createSupporterHandler({ env = process.env, fetcher = fetch } = {}) {
  const base = () => (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const configured = () => base() && env.SUPABASE_SERVICE_ROLE_KEY && env.FLUTTERWAVE_SECRET_KEY && env.FLUTTERWAVE_PUBLIC_KEY;
  async function jsonFetch(url, options = {}) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new RequestError(503, 'Contributions are temporarily unavailable. Please try again later.');
    return response.status === 204 ? null : response.json();
  }
  const db = (path, options = {}) => jsonFetch(`${base()}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers },
  });
  const flw = async path => {
    const result = await jsonFetch(`https://api.flutterwave.com/v3/${path}`, {
      headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
    });
    if (result.status !== 'success') throw new RequestError(503, 'Payment confirmation is not available yet. Try checking again shortly.');
    return result.data;
  };
  async function authenticate(request) {
    const authorization = request.headers.authorization || '';
    if (!/^Bearer [\w.-]+$/.test(authorization)) throw new RequestError(401, 'Sign in to your Toolbox account to continue.');
    const response = await fetcher(`${base()}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: authorization },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new RequestError(401, 'Your session has expired. Please sign in again.');
    const user = await response.json();
    if (!user.id || !user.email) throw new RequestError(401, 'A verified Toolbox account is required.');
    return user;
  }
  async function optionalUser(request) {
    return request.headers.authorization ? authenticate(request) : null;
  }
  async function readBody(request) {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
      if (Buffer.byteLength(text) > 4096) throw new RequestError(413, 'Request is too large.');
    }
    try { return JSON.parse(text || '{}'); } catch { throw new RequestError(400, 'Invalid request.'); }
  }
  const quote = async currency => supporterThreshold(currency === 'NGN' ? null : await flw(
    `transfers/rates?amount=5000&destination_currency=NGN&source_currency=${currency}`), currency);
  async function verify(intent, transactionId) {
    const payment = await flw(transactionId
      ? `transactions/${transactionId}/verify`
      : `transactions/verify_by_reference?tx_ref=${encodeURIComponent(intent.tx_ref)}`);
    if (!validateContribution(payment, intent)) throw new RequestError(409, 'This contribution has not been confirmed. No perks have been unlocked.');
    // The unique transaction ID and row lock make retries safe across workers.
    await db('rpc/confirm_toolbox_contribution', { method: 'POST', body: JSON.stringify({
      p_reference: intent.tx_ref, p_transaction_id: String(payment.id), p_paid_amount: Number(payment.amount),
    }) });
    return { verified: true, supporter: Number(payment.amount) >= Number(intent.supporter_threshold) };
  }
  return async function handleSupporterRequest(request, response, url) {
    if (!url.pathname.startsWith('/api/supporter/')) return false;
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
    };
    try {
      const route = url.pathname.slice('/api/supporter/'.length);
      if (route === 'configuration' && request.method === 'GET') {
        send(200, { ready: !!configured() });
        return true;
      }
      if (!configured()) throw new RequestError(503, 'Supporter checkout is not configured on this deployment yet.');
      if (route === 'quote' && request.method === 'GET') {
        const currency = url.searchParams.get('currency') || 'NGN';
        if (!CURRENCIES.includes(currency)) throw new RequestError(400, 'Unsupported currency.');
        send(200, { currency, threshold: await quote(currency), baseAmount: 5000, quotedAt: new Date().toISOString() });
        return true;
      }
      if (route === 'status' && request.method === 'GET') {
        const user = await authenticate(request);
        const userFilter = `user_id=eq.${encodeURIComponent(user.id)}`;
        const [rows, pending] = await Promise.all([
          db(`toolbox_supporters?${userFilter}&select=profile_style,early_access,created_at`),
          db(`toolbox_contributions?${userFilter}&verified_at=is.null&select=tx_ref,currency,amount&order=created_at.desc&limit=5`),
        ]);
        const member = rows[0] || null;
        const previews = member?.early_access ? await db('toolbox_supporter_previews?published=eq.true&select=title,description,url&order=created_at.desc') : [];
        send(200, { supporter: !!member, profileStyle: member?.profile_style || 'classic', earlyAccess: !!member?.early_access, previews, pending });
      } else if (route === 'intent' && request.method === 'POST') {
        const body = await readBody(request);
        const user = await optionalUser(request);
        const amount = Number(body.amount);
        if (!CURRENCIES.includes(body.currency) || !Number.isFinite(amount) || amount < (body.currency === 'NGN' ? 100 : 1)
          || amount > 100000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
          throw new RequestError(400, 'Enter a valid contribution amount with no more than two decimal places.');
        }
        const email = String(user?.email || body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new RequestError(400, 'Enter a valid email for your payment receipt.');
        const threshold = await quote(body.currency);
        const intent = { tx_ref: `TBX-${randomUUID()}`, user_id: user?.id || null, currency: body.currency, amount, supporter_threshold: threshold };
        await db('toolbox_contributions', { method: 'POST', body: JSON.stringify(intent) });
        send(200, { tx_ref: intent.tx_ref, amount, currency: intent.currency, threshold,
          public_key: env.FLUTTERWAVE_PUBLIC_KEY, customer: { email } });
      } else if (route === 'verify' && request.method === 'POST') {
        const body = await readBody(request);
        if (!/^TBX-[a-f0-9-]{36}$/.test(body.reference || '')
          || (body.transactionId != null && !/^\d{1,24}$/.test(String(body.transactionId)))) throw new RequestError(400, 'Invalid contribution reference.');
        const rows = await db(`toolbox_contributions?tx_ref=eq.${encodeURIComponent(body.reference)}&select=*`);
        if (!rows[0]) throw new RequestError(404, 'Contribution not found.');
        send(200, await verify(rows[0], body.transactionId));
      } else if (route === 'claim' && request.method === 'POST') {
        const user = await authenticate(request);
        const body = await readBody(request);
        if (!/^TBX-[a-f0-9-]{36}$/.test(body.reference || '')) throw new RequestError(400, 'Invalid contribution reference.');
        await db('rpc/claim_toolbox_contribution', { method:'POST', body:JSON.stringify({ p_reference:body.reference, p_user_id:user.id }) });
        send(200, { claimed:true });
      } else if (route === 'preferences' && request.method === 'POST') {
        const user = await authenticate(request);
        const userFilter = `user_id=eq.${encodeURIComponent(user.id)}`;
        const body = await readBody(request);
        if (!PROFILE_STYLES.includes(body.profileStyle) || typeof body.earlyAccess !== 'boolean') throw new RequestError(400, 'Invalid supporter preferences.');
        const rows = await db(`toolbox_supporters?${userFilter}`, { method: 'PATCH', body: JSON.stringify({ profile_style: body.profileStyle, early_access: body.earlyAccess }) });
        if (!rows.length) throw new RequestError(403, 'Supporter perks require a verified qualifying contribution.');
        send(200, { saved: true });
      } else throw new RequestError(404, 'Not found.');
    } catch (error) {
      send(error.status || 503, { error: error instanceof RequestError ? error.message : 'Contributions are temporarily unavailable. Please try again later.' });
    }
    return true;
  };
}

export const handleSupporterRequest = createSupporterHandler();
