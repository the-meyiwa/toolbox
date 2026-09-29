import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';

const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
const BASE_URLS = Object.freeze({
  production: 'https://f4bexperience.flutterwave.com',
  sandbox: 'https://developersandbox-api.flutterwave.com',
});
const ERRORS = Object.freeze({
  configuration: [503, 'Payments are not configured. Please contact support.'],
  encryption_configuration: [503, 'Card payments are not configured. Please contact support.'],
  authentication: [503, 'The payment provider could not authenticate checkout. Please contact support.'],
  validation: [400, 'The payment details could not be accepted. Please check them and try again.'],
  declined: [402, 'This payment was declined. Please use another payment method.'],
  not_found: [404, 'The payment could not be found.'],
  conflict: [409, 'This payment is already being processed. Please check its status.'],
  unavailable: [503, 'The payment provider is busy. Please try again shortly.'],
  timeout: [504, 'The payment provider took too long to respond. Please check the payment status before trying again.'],
  provider: [502, 'The payment provider could not complete the request. Please check the payment status before trying again.'],
});

// Only fixed messages leave this adapter; provider responses can contain card data.
export class FlutterwaveError extends Error {
  constructor(category = 'provider') {
    const safeCategory = Object.hasOwn(ERRORS, category) ? category : 'provider';
    super(ERRORS[safeCategory][1]);
    this.name = 'FlutterwaveError';
    this.status = ERRORS[safeCategory][0];
    this.code = safeCategory;
  }
}

function value(env, primary, alias) {
  const raw = env[primary] || (alias && env[alias]);
  return typeof raw === 'string' ? raw.trim() : '';
}

function decodeEncryptionKey(encryptionKey) {
  const encoded = typeof encryptionKey === 'string' ? encryptionKey.trim() : '';
  // Buffer's base64 decoder silently ignores invalid characters, so validate first.
  if (!/^[A-Za-z0-9+/]{43}=?$/.test(encoded)) throw new FlutterwaveError('encryption_configuration');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=$/, '') !== encoded.replace(/=$/, '')) throw new FlutterwaveError('encryption_configuration');
  return key;
}

function encryptFields(fields, encryptionKey) {
  const key = decodeEncryptionKey(encryptionKey);
  const nonce = randomBytes(9).toString('base64'); // Exactly twelve UTF-8 bytes, as required by Flutterwave.
  const result = { nonce };
  try {
    for (const [name, plain] of Object.entries(fields)) {
      // Flutterwave's wire format uses this nonce for each field in the request.
      const cipher = createCipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
      result[name] = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
    }
    return result;
  } finally {
    key.fill(0);
  }
}

export function encryptCard(card, encryptionKey) {
  if (!card || typeof card !== 'object') throw new FlutterwaveError('validation');
  // Require strings so JavaScript number rounding cannot corrupt long card numbers.
  if (typeof card.number !== 'string' || !/^[\d -]{12,30}$/.test(card.number)) throw new FlutterwaveError('validation');
  const number = card.number.replace(/[ -]/g, '');
  const month = String(card.expiryMonth ?? '');
  const year = String(card.expiryYear ?? '');
  const cvv = typeof card.cvv === 'string' ? card.cvv : '';
  if (!/^\d{12,19}$/.test(number) || !/^(0?[1-9]|1[0-2])$/.test(month)
      || !/^(\d{2}|20\d{2})$/.test(year) || !/^\d{3,4}$/.test(cvv)) {
    throw new FlutterwaveError('validation');
  }
  return encryptFields({
    encrypted_card_number: number,
    encrypted_expiry_month: month.padStart(2, '0'),
    encrypted_expiry_year: year.slice(-2),
    encrypted_cvv: cvv,
  }, encryptionKey);
}

export function encryptPin(pin, encryptionKey) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) throw new FlutterwaveError('validation');
  return encryptFields({ encrypted_pin: pin }, encryptionKey);
}

function providerError(status, payload, authentication = false) {
  if (authentication || status === 401 || status === 403) return new FlutterwaveError('authentication');
  if (status === 429) return new FlutterwaveError('unavailable');
  if (status === 404) return new FlutterwaveError('not_found');
  if (status === 409) return new FlutterwaveError('conflict');
  const kind = payload?.error?.type;
  if (kind === 'CLIENT_ENCRYPTION_ERROR') return new FlutterwaveError('encryption_configuration');
  if (status === 402 || kind === 'PAYMENT_DECLINED' || kind === 'CARD_DECLINED') return new FlutterwaveError('declined');
  if (status === 400 || status === 422) return new FlutterwaveError('validation');
  return new FlutterwaveError('provider');
}

export function createFlutterwaveClient({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const clientId = value(env, 'FLW_CLIENT_ID', 'FLUTTERWAVE_CLIENT_ID');
  const clientSecret = value(env, 'FLW_CLIENT_SECRET', 'FLUTTERWAVE_CLIENT_SECRET');
  const encryptionKey = value(env, 'FLW_ENCRYPTION_KEY', 'FLUTTERWAVE_ENCRYPTION_KEY');
  const mode = value(env, 'FLW_ENVIRONMENT').toLowerCase() || 'production';
  const baseUrl = Object.hasOwn(BASE_URLS, mode) ? BASE_URLS[mode] : null;
  let cachedToken = null;
  let tokenFlight = null;

  const configured = () => Boolean(baseUrl && clientId && clientSecret);
  function cardReady() {
    if (!configured()) return false;
    try { decodeEncryptionKey(encryptionKey).fill(0); return true; } catch { return false; }
  }

  async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    let timer;
    try {
      const operation = (async () => {
        const response = await fetcher(url, { ...options, signal: controller.signal, redirect: 'error' });
        let payload;
        try { payload = await response.json(); } catch { payload = null; }
        return { response, payload };
      })();
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new FlutterwaveError('timeout'));
        }, timeoutMs);
      });
      return await Promise.race([operation, timeout]);
    } catch (error) {
      if (error instanceof FlutterwaveError) throw error;
      throw new FlutterwaveError(controller.signal.aborted ? 'timeout' : 'provider');
    } finally {
      clearTimeout(timer);
    }
  }

  async function accessToken() {
    if (!configured()) throw new FlutterwaveError('configuration');
    if (cachedToken && cachedToken.usableUntil > now()) return cachedToken;
    if (tokenFlight) return tokenFlight;
    tokenFlight = (async () => {
      const { response, payload } = await fetchJson(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString(),
      }, 10_000);
      const expiresIn = Number(payload?.expires_in);
      if (!response.ok || typeof payload?.access_token !== 'string' || !payload.access_token
          || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw providerError(response.status, payload, true);
      }
      const lifetime = Math.min(expiresIn, 86_400) * 1000;
      cachedToken = { value: payload.access_token, usableUntil: now() + lifetime - Math.min(60_000, lifetime / 10) };
      return cachedToken;
    })();
    try { return await tokenFlight; } finally { tokenFlight = null; }
  }

  async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
    if (!configured()) throw new FlutterwaveError('configuration');
    // Relative API paths only: credentials must never follow an arbitrary URL.
    if (typeof path !== 'string' || !/^\/[a-z][a-z0-9_/-]*(?:\?[^#\r\n\\]*)?$/i.test(path)
        || path.includes('..') || path.includes('//')) throw new FlutterwaveError('validation');
    const verb = String(method).toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)) throw new FlutterwaveError('validation');
    const write = verb !== 'GET';
    const requestKey = write ? (idempotencyKey || randomUUID()) : null;
    if (requestKey && (typeof requestKey !== 'string' || !/^[a-zA-Z0-9._:-]{1,200}$/.test(requestKey))) throw new FlutterwaveError('validation');
    let serialized;
    try { serialized = body === undefined ? undefined : JSON.stringify(body); } catch { throw new FlutterwaveError('validation'); }
    const traceId = randomUUID();
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken();
      const { response, payload } = await fetchJson(`${baseUrl}${path}`, {
        method: verb,
        headers: {
          Authorization: `Bearer ${token.value}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Trace-Id': traceId,
          ...(requestKey ? { 'X-Idempotency-Key': requestKey } : {}),
        },
        ...(serialized === undefined ? {} : { body: serialized }),
      }, 20_000);
      if (response.status === 401 && attempt === 0) {
        // Concurrent 401s join one refresh and cannot discard a newer token.
        if (cachedToken === token) cachedToken = null;
        continue;
      }
      if (!response.ok || payload?.status === 'failed' || payload?.status === 'error') throw providerError(response.status, payload);
      if (!payload || !Object.hasOwn(payload, 'data') || payload.data == null) throw new FlutterwaveError('provider');
      return payload.data;
    }
    throw new FlutterwaveError('authentication');
  }

  return {
    configured,
    cardReady,
    environment: () => mode,
    authenticate: async () => { await accessToken(); return true; },
    request,
    getCharge: async id => {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new FlutterwaveError('validation');
      return request(`/charges/${id}`);
    },
    getTransferRate: async ({ sourceCurrency, destinationCurrency = 'NGN', amount = 5000 }) => {
      return request('/transfers/rates', {
        method: 'POST',
        body: {
          source: { currency: sourceCurrency },
          destination: { currency: destinationCurrency, amount: Number(amount) },
        },
      });
    },
    encryptCard: card => encryptCard(card, encryptionKey),
    encryptPin: pin => encryptPin(pin, encryptionKey),
  };
}
