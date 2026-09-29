import { randomUUID } from 'node:crypto';
import { createFlutterwaveClient, FlutterwaveError } from './server-flutterwave.js';

export const SUPPORTER_THRESHOLD_NGN = 5000;
export const PROFILE_STYLES = ['classic', 'etched', 'halo', 'orbit'];
const CURRENCIES = ['NGN', 'USD', 'CAD', 'GBP'];

// Settings pasted with quotes or spaces around them ("FLWPUBK-…") are read without them.
const setting = (value) => String(value ?? '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();

export function resolveFlutterwaveCredentials(env = {}) {
  const publicKey = setting(env.FLUTTERWAVE_PUBLIC_KEY || env.FLW_PUBLIC_KEY);
  const secretKey = setting(env.FLUTTERWAVE_SECRET_KEY || env.FLW_SECRET_KEY);
  const clientId = setting(env.FLW_CLIENT_ID || env.FLUTTERWAVE_CLIENT_ID);
  const clientSecret = setting(env.FLW_CLIENT_SECRET || env.FLUTTERWAVE_CLIENT_SECRET);
  const mode = setting(env.FLW_ENVIRONMENT || 'production').toLowerCase();
  // A test secret key means test mode even when FLW_ENVIRONMENT was left at its default.
  const testMode = mode === 'sandbox' || mode === 'test' || /^FLWSECK_TEST-/i.test(secretKey);

  // The inline checkout (checkout.flutterwave.com/v3.js) accepts only the account's public key
  // (dashboard → Settings → API keys: FLWPUBK-…-X, or FLWPUBK_TEST-…-X in test mode). A v4 Client
  // ID is not one: Flutterwave answers "Invalid parameter (PBFPubKey)", so it is never sent.
  let checkoutKey = publicKey;
  if (checkoutKey && !/^FLWPUBK(_TEST)?-/i.test(checkoutKey) && /^[a-fA-F0-9]{32}-X$/i.test(checkoutKey)) {
    checkoutKey = (testMode ? 'FLWPUBK_TEST-' : 'FLWPUBK-') + checkoutKey;
  }

  const hasOAuth = Boolean(clientId && clientSecret);
  const hasApiKeys = Boolean(publicKey && secretKey);
  const keyProblem = !publicKey ? (hasOAuth ? 'oauth-only' : 'missing')
    : /^FLWSECK/i.test(publicKey) || publicKey === secretKey ? 'secret-in-public'
      : (/^FLWPUBK_TEST-/i.test(checkoutKey) && /^FLWSECK-/i.test(secretKey)) || (/^FLWPUBK-/i.test(checkoutKey) && /^FLWSECK_TEST-/i.test(secretKey)) ? 'mode-mismatch'
        : !secretKey && !hasOAuth ? 'missing-secret' : '';

  return {
    publicKey: checkoutKey,
    rawPublicKey: publicKey,
    secretKey,
    clientId,
    clientSecret,
    mode,
    hasOAuth,
    hasApiKeys,
    configured: hasOAuth || hasApiKeys,
    checkoutReady: !keyProblem,
    keyProblem,
  };
}

/* What to change on the server when the checkout cannot open, in the owner's words. */
export const KEY_PROBLEMS = {
  missing: 'Flutterwave checkout needs FLUTTERWAVE_PUBLIC_KEY on the server: the key labelled Public key in the Flutterwave dashboard under Settings, API keys (it starts FLWPUBK- and ends -X).',
  'missing-secret': 'Flutterwave checkout needs FLUTTERWAVE_SECRET_KEY on the server: the Secret key (FLWSECK-…) from the same Flutterwave dashboard page as the public key.',
  'oauth-only': 'Flutterwave checkout needs the account\'s public and secret API keys (Flutterwave dashboard, Settings, API keys: FLWPUBK-… and FLWSECK-…) in FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY. The Client ID and Client Secret cannot open the checkout.',
  'secret-in-public': 'FLUTTERWAVE_PUBLIC_KEY on the server holds a secret key. Put the Public key (FLWPUBK-…) there, and keep the secret key only in FLUTTERWAVE_SECRET_KEY.',
  'mode-mismatch': 'The Flutterwave public and secret keys on the server come from different modes (one test, one live). Use both test keys or both live keys.',
};

/** Names of the database settings checkout still needs (names only, never values). */
export function missingSettings(env) {
  return [
    ['SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, value]) => !setting(value)).map(([name]) => name);
}

/** What went wrong upstream, in words the site owner can act on. Details go to the server log. */
export function upstreamMessage(service, status, detail = '') {
  if (service === 'flutterwave') {
    if (status === 401 || status === 403) return "Flutterwave rejected this server's secret key. FLUTTERWAVE_SECRET_KEY must be the Secret key from the same Flutterwave account and mode (test or live) as FLUTTERWAVE_PUBLIC_KEY.";
    return 'Flutterwave is not answering right now. Please try again shortly.';
  }
  if (status === 401 || status === 403) return "The Toolbox database rejected this server's key. SUPABASE_SERVICE_ROLE_KEY must be the project's service_role key (not the anon key).";
  if (status === 404 || /PGRST20[25]|42P01|42883|does not exist|Could not find the (table|function)/i.test(detail)) return 'Contributions are not set up in the database yet: run supabase/supporters.sql in the Supabase SQL editor.';
  return 'The Toolbox database is not answering right now. Please try again shortly.';
}

export function validateContribution(payment, intent) {
  const isStatusValid = payment?.status === 'successful'
    || payment?.status === 'success'
    || payment?.charge_status === 'succeeded'
    || payment?.charge_status === 'successful';
  const idStr = payment?.id != null ? String(payment.id) : (payment?.transaction_id != null ? String(payment.transaction_id) : '');
  const isIdValid = /^[a-zA-Z0-9_-]{1,64}$/.test(idStr);
  const paymentRef = payment?.tx_ref || payment?.reference;
  const isRefValid = Boolean(paymentRef && paymentRef === intent?.tx_ref);
  const isCurrencyValid = payment?.currency === intent?.currency;
  const amount = Number(payment?.amount);
  const isAmountValid = Number.isFinite(amount) && amount >= Number(intent?.amount);

  return Boolean(isStatusValid && isIdValid && isRefValid && isCurrencyValid && isAmountValid);
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

export function createSupporterHandler({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const creds = resolveFlutterwaveCredentials(env);
  const v4Client = createFlutterwaveClient({ env, fetcher, now });
  const base = () => (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = () => setting(env.SUPABASE_SERVICE_ROLE_KEY);
  const configured = () => !!(base() && serviceKey() && creds.configured);
  // Upstream failures are logged with their status and a short excerpt (never keys),
  // so the cause shows in the server log, and answered with a message that names it.
  const log = (...parts) => console.error('[supporter]', ...parts);
  async function jsonFetch(url, options = {}, service = 'supabase') {
    let response;
    try {
      response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15000) });
    } catch (error) {
      log(service, 'unreachable', url.split('?')[0], error?.message);
      throw new RequestError(503, service === 'flutterwave' ? 'The server could not reach Flutterwave. Please try again shortly.' : 'The server could not reach the Toolbox database. Please try again shortly.');
    }
    if (!response.ok) {
      const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      log(service, response.status, url.split('?')[0], String(detail).slice(0, 300));
      throw new RequestError(503, upstreamMessage(service, response.status, detail));
    }
    return response.status === 204 ? null : response.json();
  }
  const db = (path, options = {}) => jsonFetch(`${base()}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`,
      'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers },
  });
  const flw = async path => {
    if (!creds.secretKey) throw new RequestError(503, KEY_PROBLEMS['missing-secret']);
    const result = await jsonFetch(`https://api.flutterwave.com/v3/${path}`, {
      headers: { Authorization: `Bearer ${creds.secretKey}` },
    }, 'flutterwave');
    if (result.status !== 'success') throw new RequestError(503, 'Payment confirmation is not available yet. Try checking again shortly.');
    return result.data;
  };
  async function authenticate(request) {
    const authorization = request.headers.authorization || '';
    if (!/^Bearer [\w.-]+$/.test(authorization)) throw new RequestError(401, 'Sign in to your Toolbox account to continue.');
    const response = await fetcher(`${base()}/auth/v1/user`, {
      headers: { apikey: serviceKey(), Authorization: authorization },
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
  const quote = async currency => {
    if (currency === 'NGN') return supporterThreshold(null, currency);
    try {
      return await convertedThreshold(currency);
    } catch (error) {
      if (error instanceof RequestError && /rejected|needs/.test(error.message)) throw error;
      if (error instanceof FlutterwaveError && error.code === 'authentication') throw error;
      log('flutterwave', 'rate', currency, error?.message);
      throw new RequestError(503, `The ${currency} to NGN rate is not available right now. Contribute in NGN, or try again shortly.`);
    }
  };
  const convertedThreshold = async currency => {
    if (v4Client.configured()) {
      try {
        const v4Rate = await v4Client.getTransferRate({ sourceCurrency: currency, destinationCurrency: 'NGN', amount: 5000 });
        if (v4Rate) return supporterThreshold(v4Rate, currency);
      } catch (err) {
        if (!creds.secretKey) throw err;
      }
    }
    if (creds.secretKey) {
      return supporterThreshold(await flw(
        `transfers/rates?amount=5000&destination_currency=NGN&source_currency=${currency}`), currency);
    }
    throw new RequestError(503, 'Currency quote unavailable');
  };
  async function verify(intent, transactionId) {
    let payment = null;
    const txIdStr = transactionId != null ? String(transactionId) : '';
    if (v4Client.configured() && txIdStr && (txIdStr.startsWith('chg_') || !creds.secretKey)) {
      try {
        payment = await v4Client.getCharge(txIdStr);
      } catch (err) {
        if (!creds.secretKey) throw err;
      }
    }
    if (!payment && creds.secretKey) {
      payment = await flw(txIdStr
        ? `transactions/${encodeURIComponent(txIdStr)}/verify`
        : `transactions/verify_by_reference?tx_ref=${encodeURIComponent(intent.tx_ref)}`);
    } else if (!payment && v4Client.configured() && txIdStr) {
      payment = await v4Client.getCharge(txIdStr);
    }
    if (!payment || !validateContribution(payment, intent)) throw new RequestError(409, 'This contribution has not been confirmed. No perks have been unlocked.');
    const resolvedId = String(payment.id || payment.transaction_id || txIdStr);
    const paidAmount = Number(payment.amount);
    // The unique transaction ID and row lock make retries safe across workers.
    await db('rpc/confirm_toolbox_contribution', { method: 'POST', body: JSON.stringify({
      p_reference: intent.tx_ref, p_transaction_id: resolvedId, p_paid_amount: paidAmount,
    }) });
    return { verified: true, supporter: paidAmount >= Number(intent.supporter_threshold) };
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
        const missing = missingSettings(env);
        const problem = creds.keyProblem ? KEY_PROBLEMS[creds.keyProblem] : '';
        send(200, !missing.length && configured() && !problem ? { ready: true } : { ready: false, ...(missing.length ? { missing } : {}), ...(problem ? { problem } : {}) });
        return true;
      }
      if (!configured()) {
        const missing = missingSettings(env);
        throw new RequestError(503, missing.length ? `Contributions are not switched on yet: the server is missing ${missing.join(', ')}.` : KEY_PROBLEMS[creds.keyProblem || 'missing']);
      }
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
        // Never open the checkout with a key Flutterwave will refuse.
        if (!creds.checkoutReady) throw new RequestError(503, KEY_PROBLEMS[creds.keyProblem]);
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
          public_key: creds.publicKey, customer: { email } });
      } else if (route === 'verify' && request.method === 'POST') {
        const body = await readBody(request);
        if (!/^TBX-[a-f0-9-]{36}$/.test(body.reference || '')
          || (body.transactionId != null && !/^[a-zA-Z0-9_-]{1,64}$/.test(String(body.transactionId)))) throw new RequestError(400, 'Invalid contribution reference.');
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
      // Flutterwave adapter errors carry fixed, safe messages; anything else is logged and summarised.
      const known = error instanceof RequestError || error instanceof FlutterwaveError;
      if (!known) log('unexpected', url.pathname, error?.stack || error);
      else if (error instanceof FlutterwaveError) log('flutterwave', error.code, url.pathname);
      send(error.status || 503, { error: known ? error.message : 'Something went wrong on the server while preparing the contribution. Please try again.' });
    }
    return true;
  };
}

export const handleSupporterRequest = createSupporterHandler();
