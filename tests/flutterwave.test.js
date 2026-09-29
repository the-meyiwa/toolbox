import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv } from 'node:crypto';
import { createFlutterwaveClient, encryptCard, encryptPin, FlutterwaveError } from '../server-flutterwave.js';

const key = Buffer.alloc(32, 7).toString('base64');
const env = { FLW_CLIENT_ID: 'client-test', FLW_CLIENT_SECRET: 'secret-test', FLW_ENCRYPTION_KEY: key };
const json = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const oauth = (token = 'access-test', expires = 600) => json({ access_token: token, expires_in: expires });
const data = payload => json({ status: 'success', data: payload });
const isToken = url => url === 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('v4 uses Render variable names and fixed production/sandbox hosts', async () => {
  for (const [setting, host] of [[undefined, 'f4bexperience.flutterwave.com'], ['sandbox', 'developersandbox-api.flutterwave.com']]) {
    const client = createFlutterwaveClient({ env: { ...env, FLW_ENVIRONMENT: setting }, fetcher: async (url, options) => {
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      if (isToken(url)) {
        assert.equal(options.method, 'POST');
        const form = new URLSearchParams(options.body);
        assert.equal(form.get('client_id'), env.FLW_CLIENT_ID);
        assert.equal(form.get('client_secret'), env.FLW_CLIENT_SECRET);
        assert.equal(form.get('grant_type'), 'client_credentials');
        return oauth();
      }
      assert.equal(url, `https://${host}/charges/chg_test`);
      assert.equal(options.headers.Authorization, 'Bearer access-test');
      return data({ id: 'chg_test' });
    } });
    assert.equal(client.configured(), true);
    assert.equal(client.cardReady(), true);
    assert.equal(client.environment(), setting || 'production');
    assert.deepEqual(await client.request('/charges/chg_test'), { id: 'chg_test' });
  }
});

test('configuration fails closed for missing OAuth credentials and invalid environment', async () => {
  for (const config of [{}, { FLW_CLIENT_ID: 'a' }, { ...env, FLW_ENVIRONMENT: 'https://example.invalid' }, { ...env, FLW_ENVIRONMENT: 'constructor' }]) {
    const client = createFlutterwaveClient({ env: config, fetcher: () => assert.fail('must not call provider') });
    assert.equal(client.configured(), false);
    assert.equal(client.cardReady(), false);
    await assert.rejects(client.authenticate(), { code: 'configuration', status: 503 });
  }
  const client = createFlutterwaveClient({ env: { ...env, FLW_ENCRYPTION_KEY: '' } });
  assert.equal(client.configured(), true);
  assert.equal(client.cardReady(), false);
});

test('OAuth token refresh is cached, expires early, and joins concurrent callers', async () => {
  let clock = 1000, tokenCalls = 0;
  const gate = deferred();
  const client = createFlutterwaveClient({ env, now: () => clock, fetcher: async url => {
    if (isToken(url)) { tokenCalls++; await gate.promise; return oauth(`token-${tokenCalls}`); }
    return data({ id: 'chg_test' });
  } });
  const first = client.authenticate();
  const second = client.request('/charges/chg_test');
  const third = client.authenticate();
  assert.equal(tokenCalls, 1);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [true, { id: 'chg_test' }, true]);
  clock += 539_999;
  await client.authenticate();
  assert.equal(tokenCalls, 1);
  clock++;
  await Promise.all([client.authenticate(), client.authenticate(), client.request('/charges/chg_test')]);
  assert.equal(tokenCalls, 2);
});

test('failed OAuth requests do not poison the cache and never expose credentials', async () => {
  let tokenCalls = 0;
  const client = createFlutterwaveClient({ env, fetcher: async () => {
    tokenCalls++;
    if (tokenCalls === 1) return json({ error: 'invalid_client', error_description: env.FLW_CLIENT_SECRET }, 401);
    return oauth();
  } });
  await assert.rejects(client.authenticate(), error => {
    assert.ok(error instanceof FlutterwaveError);
    assert.equal(error.code, 'authentication');
    assert.equal(error.status, 503);
    assert.ok(!JSON.stringify(error).includes(env.FLW_CLIENT_SECRET));
    return true;
  });
  assert.equal(await client.authenticate(), true);
  assert.equal(tokenCalls, 2);
});

test('401 refresh retries exactly once with identical write body and idempotency key', async () => {
  let tokenCalls = 0;
  const writes = [];
  const client = createFlutterwaveClient({ env, fetcher: async (url, options) => {
    if (isToken(url)) return oauth(`token-${++tokenCalls}`);
    writes.push(options);
    return writes.length === 1 ? json({ error: 'expired' }, 401) : data({ id: 'chg_created' });
  } });
  assert.deepEqual(await client.request('/charges', { method: 'POST', body: { amount: 5000 }, idempotencyKey: 'same-attempt' }), { id: 'chg_created' });
  assert.equal(tokenCalls, 2);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].headers['X-Idempotency-Key'], 'same-attempt');
  assert.equal(writes[0].headers['X-Idempotency-Key'], writes[1].headers['X-Idempotency-Key']);
  assert.equal(writes[0].headers['X-Trace-Id'], writes[1].headers['X-Trace-Id']);
  assert.equal(writes[0].body, writes[1].body);
  assert.equal(writes[1].headers.Authorization, 'Bearer token-2');
});

test('concurrent 401 responses refresh only once, including a late expired response', async () => {
  let tokenCalls = 0, oldRequests = 0;
  const first401 = deferred(), late401 = deferred(), newToken = deferred();
  const client = createFlutterwaveClient({ env, fetcher: async (url, options) => {
    if (isToken(url)) { tokenCalls++; if (tokenCalls === 2) newToken.resolve(); return oauth(`token-${tokenCalls}`); }
    if (options.headers.Authorization === 'Bearer token-1') {
      oldRequests++;
      if (oldRequests === 1) await first401.promise; else await late401.promise;
      return json({}, 401);
    }
    return data({ id: 'chg_test' });
  } });
  await client.authenticate();
  const a = client.request('/charges/chg_a'), b = client.request('/charges/chg_b');
  await Promise.resolve();
  assert.equal(oldRequests, 2);
  first401.resolve();
  await newToken.promise;
  await a;
  late401.resolve();
  await b;
  assert.equal(tokenCalls, 2);
});

test('second 401 stops retrying; network failure never repeats a write', async () => {
  for (const networkFailure of [false, true]) {
    let writes = 0, tokenCalls = 0;
    const client = createFlutterwaveClient({ env, fetcher: async url => {
      if (isToken(url)) return oauth(`token-${++tokenCalls}`);
      writes++;
      if (networkFailure) throw new Error(`Unexpected ${env.FLW_CLIENT_SECRET}`);
      return json({}, 401);
    } });
    await assert.rejects(client.request('/charges', { method: 'POST', body: { amount: 5000 } }), error => {
      assert.equal(error.code, networkFailure ? 'provider' : 'authentication');
      assert.ok(!error.stack.includes(env.FLW_CLIENT_SECRET));
      return true;
    });
    assert.equal(writes, networkFailure ? 1 : 2);
    assert.equal(tokenCalls, networkFailure ? 1 : 2);
  }
});

test('provider errors preserve safe categories while discarding raw payloads', async () => {
  for (const [httpStatus, expectedStatus] of [[422, 400], [409, 409], [404, 404], [402, 402], [429, 503], [500, 502]]) {
    const raw = `4242424242424242 ${env.FLW_CLIENT_SECRET}`;
    const client = createFlutterwaveClient({ env, fetcher: async url => isToken(url) ? oauth() : json({ message: raw, error: { type: raw, message: raw } }, httpStatus) });
    await assert.rejects(client.request('/charges'), error => {
      assert.equal(error.status, expectedStatus);
      assert.ok(!JSON.stringify(error).includes(raw));
      assert.ok(!error.stack.includes(raw));
      assert.equal(Object.hasOwn(error, 'cause'), false);
      return true;
    });
  }
});

test('provider cannot return failed or malformed success as accepted data', async () => {
  for (const payload of [null, { status: 'success' }, { status: 'failed', data: { id: 'chg_bad' } }]) {
    const client = createFlutterwaveClient({ env, fetcher: async url => isToken(url) ? oauth() : json(payload) });
    await assert.rejects(client.request('/charges'), FlutterwaveError);
  }
  const client = createFlutterwaveClient({ env, fetcher: async url => isToken(url) ? oauth() : json({ status: 'pending', data: { id: 'chg_pending' } }) });
  assert.deepEqual(await client.request('/charges'), { id: 'chg_pending' });
});

test('requests cannot send OAuth tokens to arbitrary hosts or inject headers', async () => {
  const client = createFlutterwaveClient({ env, fetcher: () => assert.fail('must not call provider') });
  for (const path of ['https://example.invalid/charges', '//example.invalid/charges', '/charges/../other', '/charges\\other', '/charges#fragment']) {
    await assert.rejects(client.request(path), { code: 'validation' });
  }
  await assert.rejects(client.request('/charges', { method: 'POST', idempotencyKey: 'bad\r\nHeader:secret' }), { code: 'validation' });
});

test('OAuth and response-body waits time out without replaying the request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const oauthClient = createFlutterwaveClient({ env, fetcher: () => { calls++; return new Promise(() => {}); } });
  const authentication = assert.rejects(oauthClient.authenticate(), { code: 'timeout', status: 504 });
  t.mock.timers.tick(10_000);
  await authentication;
  assert.equal(calls, 1);

  let writes = 0, requestSignal;
  const client = createFlutterwaveClient({ env, fetcher: async (url, options) => {
    if (isToken(url)) return oauth();
    writes++;
    requestSignal = options.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  } });
  await client.authenticate();
  const request = assert.rejects(client.request('/charges', { method: 'POST', body: {} }), { code: 'timeout', status: 504 });
  await Promise.resolve();
  t.mock.timers.tick(20_000);
  await request;
  assert.equal(writes, 1);
  assert.equal(requestSignal.aborted, true);
});

function decrypt(encrypted, nonce) {
  const bytes = Buffer.from(encrypted, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(nonce));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()]).toString('utf8');
}

test('card encryption follows Flutterwave AES-GCM fields and ciphertext/tag format', () => {
  const card = { number: '4242 4242-4242 4242', expiryMonth: '9', expiryYear: '2032', cvv: '123' };
  const encrypted = encryptCard(card, key);
  assert.equal(encrypted.nonce.length, 12);
  assert.equal(Buffer.byteLength(encrypted.nonce), 12);
  assert.equal(decrypt(encrypted.encrypted_card_number, encrypted.nonce), '4242424242424242');
  assert.equal(decrypt(encrypted.encrypted_expiry_month, encrypted.nonce), '09');
  assert.equal(decrypt(encrypted.encrypted_expiry_year, encrypted.nonce), '32');
  assert.equal(decrypt(encrypted.encrypted_cvv, encrypted.nonce), '123');
  assert.equal(card.expiryYear, '2032');
  assert.notEqual(encryptCard(card, key).nonce, encrypted.nonce);
  assert.ok(!JSON.stringify(encrypted).includes('4242424242424242'));
  const unpaddedKeyResult = encryptCard(card, key.replace(/=$/, ''));
  assert.equal(decrypt(unpaddedKeyResult.encrypted_cvv, unpaddedKeyResult.nonce), '123');
});

test('client card and PIN helpers keep encryption keys server-side', () => {
  const client = createFlutterwaveClient({ env });
  const encrypted = client.encryptCard({ number: '4242424242424242', expiryMonth: '12', expiryYear: '32', cvv: '1234' });
  assert.equal(decrypt(encrypted.encrypted_expiry_year, encrypted.nonce), '32');
  const pin = client.encryptPin('12345');
  assert.deepEqual(Object.keys(pin), ['nonce', 'encrypted_pin']);
  assert.equal(decrypt(pin.encrypted_pin, pin.nonce), '12345');
  assert.ok(!JSON.stringify(client).includes(key));
  assert.ok(!JSON.stringify(pin).includes(key));
});

test('malformed card, PIN, and encryption keys fail without exposing input', () => {
  const card = { number: '4242424242424242', expiryMonth: '12', expiryYear: '32', cvv: '123' };
  for (const change of [{ number: 4242424242424242 }, { number: 'raw-sensitive-invalid-card' }, { expiryMonth: '13' }, { expiryYear: '3032' }, { cvv: '12' }, { cvv: 123 }]) {
    assert.throws(() => encryptCard({ ...card, ...change }, key), { code: 'validation', status: 400 });
  }
  for (const badKey of ['', 'invalid', Buffer.alloc(16).toString('base64'), `${key}??`]) {
    assert.throws(() => encryptCard(card, badKey), { code: 'encryption_configuration', status: 503 });
  }
  for (const pin of ['abc', '123', '1234567', 1234]) assert.throws(() => encryptPin(pin, key), { code: 'validation' });
});
