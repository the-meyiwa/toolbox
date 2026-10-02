import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createSupporterHandler, validateContribution, supporterThreshold, KEY_PROBLEMS, resolveFlutterwaveCredentials } from '../server-supporters.js';

const reference = 'TBX-11111111-1111-4111-8111-111111111111';
const intent = { tx_ref:reference, user_id:'account-a', amount:5000, currency:'NGN', supporter_threshold:5000 };
const payment = { id:123, tx_ref:reference, amount:5000, currency:'NGN', status:'successful' };
const env = { SUPABASE_URL:'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'test-service', FLUTTERWAVE_SECRET_KEY:'FLWSECK_TEST-example-X', FLUTTERWAVE_PUBLIC_KEY:'FLWPUBK_TEST-example-X' };
const json = data => ({ ok:true, status:200, json:async () => data });

test('only successful payments with matching reference, currency, amount and ID verify', () => {
  assert.equal(validateContribution(payment, intent), true);
  for (const change of [{ status:'pending' }, { status:'failed' }, { tx_ref:'other' }, { currency:'USD' }, { amount:4999.99 }, { amount:'NaN' }, { id:null }]) {
    assert.equal(validateContribution({ ...payment, ...change }, intent), false);
  }
  assert.equal(validateContribution({ ...payment, amount:6000 }, intent), true);
});

test('currency quote uses the source amount and rounds up, never grants below equivalent', () => {
  assert.equal(supporterThreshold(null,'NGN'),5000);
  const quote = { source:{ currency:'USD', amount:3.123 }, destination:{ currency:'NGN', amount:5000 } };
  assert.equal(supporterThreshold(quote,'USD'),3.13);
  assert.throws(() => supporterThreshold(quote,'GBP'));
  assert.throws(() => supporterThreshold({ ...quote, source:{ currency:'USD', amount:0 } },'USD'));
});

async function request(handler, path, body, token = 'valid-token') {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = body ? 'POST' : 'GET';
  req.headers = token ? { authorization:`Bearer ${token}` } : {};
  let status, data;
  const res = { writeHead(code) { status=code; }, end(text) { data=JSON.parse(text); } };
  await handler(req,res,new URL(`https://toolbox.test/api/supporter/${path}`));
  return { status,data };
}

test('missing configuration fails closed without contacting providers', async () => {
  const handler=createSupporterHandler({ env:{}, fetcher:()=>assert.fail('must not call network') });
  assert.equal((await request(handler,'intent',{})).status,503);
});

test('missing Flutterwave keys keep checkout unavailable', async () => {
  for (const keys of [
    { FLUTTERWAVE_PUBLIC_KEY:'' },
    { FLUTTERWAVE_SECRET_KEY:'' },
  ]) {
    const handler=createSupporterHandler({ env:{ ...env,...keys }, fetcher:()=>assert.fail('must not call network') });
    const { data }=await request(handler,'configuration');
    assert.equal(data.ready,false);
    assert.match(data.problem,new RegExp(Object.keys(keys)[0]));
    assert.equal((await request(handler,'intent',{ amount:5000,currency:'NGN',email:'test@example.invalid' },null)).status,503);
  }
});

test('credential formats are left to Flutterwave to validate', async () => {
  const handler=createSupporterHandler({ env:{ ...env, FLUTTERWAVE_PUBLIC_KEY:'new-public-format', FLUTTERWAVE_SECRET_KEY:'new-secret-format' }, fetcher:()=>assert.fail('must not call network') });
  assert.deepEqual((await request(handler,'configuration')).data,{ ready:true });
});

test('guest contributions require a valid receipt email', async () => {
  const handler=createSupporterHandler({ env, fetcher:()=>assert.fail('must not call network') });
  assert.equal((await request(handler,'intent',{ amount:5000,currency:'NGN',email:'bad' },null)).status,400);
});

test('expired token cannot read or change supporter state', async () => {
  const handler=createSupporterHandler({ env, fetcher:async () => ({ ok:false, status:401 }) });
  assert.equal((await request(handler,'status')).status,401);
});

test('signed-in contribution creation binds account and amount server-side', async () => {
  let inserted;
  const handler=createSupporterHandler({ env, fetcher:async (url,options) => {
    if (url.endsWith('/auth/v1/user')) return json({ id:'account-a', email:'ada.obi@toolbox.app' });
    assert.ok(url.endsWith('/rest/v1/toolbox_contributions'));
    inserted=JSON.parse(options.body); return json([inserted]);
  } });
  const result=await request(handler,'intent',{ amount:5000,currency:'NGN',email:'ignored@example.invalid',user_id:'account-b' });
  assert.equal(result.status,200);
  assert.equal(inserted.user_id,'account-a');
  assert.equal(inserted.supporter_threshold,5000);
  assert.match(inserted.tx_ref,/^TBX-/);
  assert.equal(result.data.customer.email,'ada.obi@toolbox.app');
});

test('invalid amounts cannot create checkout intents', async () => {
  const handler=createSupporterHandler({ env, fetcher:async url => {
    assert.ok(url.endsWith('/auth/v1/user')); return json({ id:'account-a',email:'ada.obi@toolbox.app' });
  } });
  for (const amount of [-1,0,0.001,100.123]) {
    assert.equal((await request(handler,'intent',{ amount,currency:'NGN',email:'test@example.invalid' })).status,400);
  }
});

test('verification accepts a high-entropy guest reference without requiring an account', async () => {
  const handler=createSupporterHandler({ env, fetcher:async url => {
    assert.ok(url.includes(`tx_ref=eq.${encodeURIComponent(reference)}`)); return json([]);
  } });
  assert.equal((await request(handler,'verify',{ reference,transactionId:123 },null)).status,404);
});

test('verified payment calls the atomic grant function, failed payments never do', async () => {
  for (const amount of [4999,5000]) {
    let granted=0;
    const handler=createSupporterHandler({ env, fetcher:async (url,options) => {
      if (url.includes('toolbox_contributions?')) return json([intent]);
      if (url.endsWith('/transactions/123/verify')) return json({ status:'success',data:{ ...payment,amount } });
      assert.ok(url.endsWith('/rpc/confirm_toolbox_contribution'));
      assert.equal(JSON.parse(options.body).p_transaction_id,'123'); granted++;return json(null);
    } });
    const result=await request(handler,'verify',{ reference,transactionId:123 },null);
    assert.equal(result.status,amount===5000?200:409);
    assert.equal(granted,amount===5000?1:0);
  }
});

test('a verified guest contribution can be claimed only by an authenticated account', async () => {
  let claimBody;
  const handler=createSupporterHandler({ env, fetcher:async (url,options) => {
    if (url.endsWith('/auth/v1/user')) return json({ id:'account-a',email:'ada.obi@toolbox.app' });
    assert.ok(url.endsWith('/rpc/claim_toolbox_contribution'));
    claimBody=JSON.parse(options.body); return json(null);
  } });
  assert.equal((await request(handler,'claim',{ reference },null)).status,401);
  assert.equal((await request(handler,'claim',{ reference })).status,200);
  assert.deepEqual(claimBody,{ p_reference:reference,p_user_id:'account-a' });
});

test('non-supporters cannot save styles or enroll in previews', async () => {
  const handler=createSupporterHandler({ env, fetcher:async url => {
    if (url.endsWith('/auth/v1/user')) return json({ id:'account-a',email:'ada.obi@toolbox.app' });
    assert.ok(url.includes('toolbox_supporters?user_id=eq.account-a')); return json([]);
  } });
  assert.equal((await request(handler,'preferences',{ profileStyle:'halo',earlyAccess:true })).status,403);
});

test('resolveFlutterwaveCredentials supports v4 OAuth, v4 API keys, and normalizes public keys', () => {
  // Live mode public key normalization
  const creds1 = resolveFlutterwaveCredentials({ FLUTTERWAVE_PUBLIC_KEY: 'cb3d7945751843f1c06e13b27c4089e7-X', FLUTTERWAVE_SECRET_KEY: 'FLWSECK-xxx' });
  assert.equal(creds1.publicKey, 'FLWPUBK-cb3d7945751843f1c06e13b27c4089e7-X');
  assert.equal(creds1.configured, true);

  // Sandbox mode public key normalization
  const creds2 = resolveFlutterwaveCredentials({ FLW_PUBLIC_KEY: 'cb3d7945751843f1c06e13b27c4089e7-X', FLW_SECRET_KEY: 'FLWSECK-xxx', FLW_ENVIRONMENT: 'sandbox' });
  assert.equal(creds2.publicKey, 'FLWPUBK_TEST-cb3d7945751843f1c06e13b27c4089e7-X');
  assert.equal(creds2.configured, true);

  // Already prefixed public keys remain unchanged
  const creds3 = resolveFlutterwaveCredentials({ FLUTTERWAVE_PUBLIC_KEY: 'FLWPUBK-custom-key', FLUTTERWAVE_SECRET_KEY: 'FLWSECK-xxx' });
  assert.equal(creds3.publicKey, 'FLWPUBK-custom-key');

  // v4 OAuth variables (FLW_CLIENT_ID / FLW_CLIENT_SECRET)
  const creds4 = resolveFlutterwaveCredentials({ FLW_CLIENT_ID: 'client-123', FLW_CLIENT_SECRET: 'secret-123' });
  assert.equal(creds4.configured, true);
  assert.equal(creds4.hasOAuth, true);
  // a Client ID is not a checkout public key: Flutterwave answers "Invalid parameter (PBFPubKey)"
  assert.equal(creds4.publicKey, '');
  assert.equal(creds4.checkoutReady, false);
  assert.equal(creds4.keyProblem, 'oauth-only');
});

test('validateContribution verifies v4 charge schemas with string IDs and succeeded status', () => {
  // v4 charge_status: succeeded
  assert.equal(validateContribution({ id: 'chg_EFAHCzELJb', reference, amount: 5000, currency: 'NGN', charge_status: 'succeeded' }, intent), true);
  // v4 status: success with reference
  assert.equal(validateContribution({ id: 'chg_998877', reference, amount: 6000, currency: 'NGN', status: 'success' }, intent), true);
  // v4 charge_status failed
  assert.equal(validateContribution({ id: 'chg_bad', reference, amount: 5000, currency: 'NGN', charge_status: 'failed' }, intent), false);
  // reference mismatch
  assert.equal(validateContribution({ id: 'chg_bad_ref', reference: 'other-ref', amount: 5000, currency: 'NGN', charge_status: 'succeeded' }, intent), false);
});

test('v4 OAuth charge verification confirms contribution using GET /charges/:id', async () => {
  const v4Env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service',
    FLW_CLIENT_ID: 'client-v4',
    FLW_CLIENT_SECRET: 'secret-v4',
  };
  let confirmedId;
  const handler = createSupporterHandler({
    env: v4Env,
    fetcher: async (url, options) => {
      if (url.includes('protocol/openid-connect/token')) {
        return json({ access_token: 'v4-token', expires_in: 600 });
      }
      if (url.includes('/charges/chg_live_abc123')) {
        assert.equal(options.headers.Authorization, 'Bearer v4-token');
        return json({
          status: 'success',
          data: {
            id: 'chg_live_abc123',
            reference,
            amount: 5000,
            currency: 'NGN',
            charge_status: 'succeeded',
          },
        });
      }
      if (url.includes('toolbox_contributions?')) return json([intent]);
      if (url.endsWith('/rpc/confirm_toolbox_contribution')) {
        confirmedId = JSON.parse(options.body).p_transaction_id;
        return json(null);
      }
      throw new Error(`Unexpected request to ${url}`);
    },
  });

  const res = await request(handler, 'verify', { reference, transactionId: 'chg_live_abc123' }, null);
  assert.equal(res.status, 200);
  assert.equal(res.data.verified, true);
  assert.equal(confirmedId, 'chg_live_abc123');
});

test('v4 transfer rate quote calculates threshold using POST /transfers/rates', async () => {
  const v4Env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service',
    FLW_CLIENT_ID: 'client-v4',
    FLW_CLIENT_SECRET: 'secret-v4',
  };
  const handler = createSupporterHandler({
    env: v4Env,
    fetcher: async (url, options) => {
      if (url.includes('protocol/openid-connect/token')) {
        return json({ access_token: 'v4-token', expires_in: 600 });
      }
      if (url.endsWith('/transfers/rates')) {
        assert.equal(options.method, 'POST');
        const reqBody = JSON.parse(options.body);
        assert.equal(reqBody.source.currency, 'USD');
        assert.equal(reqBody.destination.currency, 'NGN');
        return json({
          status: 'success',
          data: {
            source: { currency: 'USD', amount: 3.123 },
            destination: { currency: 'NGN', amount: 5000 },
          },
        });
      }
      throw new Error(`Unexpected request to ${url}`);
    },
  });

  const res = await request(handler, 'quote?currency=USD');
  assert.equal(res.status, 200);
  assert.equal(res.data.currency, 'USD');
  assert.equal(res.data.threshold, 3.13);
});


test('checkout never opens with a key Flutterwave refuses (PBFPubKey)', async () => {
  const guest={ amount:5000, currency:'NGN', email:'guest@example.invalid' };
  // v4 OAuth credentials only: no public key for the inline checkout
  const oauth=createSupporterHandler({ env:{ SUPABASE_URL:'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'k', FLW_CLIENT_ID:'client-123', FLW_CLIENT_SECRET:'s' }, fetcher:()=>assert.fail('must not call network') });
  const cfg=(await request(oauth,'configuration')).data;
  assert.equal(cfg.ready,false);
  assert.equal(cfg.problem,KEY_PROBLEMS['oauth-only']);
  const res=await request(oauth,'intent',guest,null);
  assert.equal(res.status,503);
  assert.ok(!JSON.stringify(res.data).includes('client-123'));
  // the secret key pasted into the public slot, and keys from different modes
  for (const [keys, problem] of [
    [{ FLUTTERWAVE_PUBLIC_KEY:'FLWSECK-abc-X', FLUTTERWAVE_SECRET_KEY:'FLWSECK-abc-X' }, 'secret-in-public'],
    [{ FLUTTERWAVE_PUBLIC_KEY:'FLWPUBK_TEST-abc-X', FLUTTERWAVE_SECRET_KEY:'FLWSECK-abc-X' }, 'mode-mismatch'],
  ]) {
    const h=createSupporterHandler({ env:{ ...env, ...keys }, fetcher:()=>assert.fail('must not call network') });
    assert.equal((await request(h,'configuration')).data.problem,KEY_PROBLEMS[problem]);
    assert.equal((await request(h,'intent',guest,null)).data.error,KEY_PROBLEMS[problem]);
  }
});

test('keys are read without quotes, and a test secret key means a test public key', async () => {
  const creds=resolveFlutterwaveCredentials({ FLUTTERWAVE_PUBLIC_KEY:' "cb3d7945751843f1c06e13b27c4089e7-X" ', FLUTTERWAVE_SECRET_KEY:"'FLWSECK_TEST-abc-X'" });
  assert.equal(creds.publicKey,'FLWPUBK_TEST-cb3d7945751843f1c06e13b27c4089e7-X');
  assert.equal(creds.secretKey,'FLWSECK_TEST-abc-X');
  assert.equal(creds.checkoutReady,true);
  let inserted;
  const h=createSupporterHandler({ env:{ ...env, FLUTTERWAVE_PUBLIC_KEY:'"FLWPUBK-live-X"', FLUTTERWAVE_SECRET_KEY:'FLWSECK-live-X' }, fetcher:async (url,options) => { inserted=JSON.parse(options.body); return json([inserted]); } });
  const res=await request(h,'intent',{ amount:5000,currency:'NGN',email:'guest@example.invalid' },null);
  assert.equal(res.status,200);
  assert.equal(res.data.public_key,'FLWPUBK-live-X');
});

test('configuration names missing database settings, never a value', async () => {
  const h=createSupporterHandler({ env:{ VITE_SUPABASE_URL:'https://x.supabase.co', FLUTTERWAVE_PUBLIC_KEY:'FLWPUBK-abc-X', FLUTTERWAVE_SECRET_KEY:'FLWSECK-abc-X' }, fetcher:()=>assert.fail('must not call network') });
  const { data }=await request(h,'configuration');
  assert.deepEqual(data,{ ready:false, missing:['SUPABASE_SERVICE_ROLE_KEY'] });
});

test('upstream failures say which setting or step to fix', async () => {
  const quiet=console.error; console.error=()=>{};
  try {
    const intentFor=async (fetcher, currency='NGN') => (await request(createSupporterHandler({ env, fetcher }),'intent',{ amount:5000,currency,email:'guest@example.invalid' },null)).data.error;
    const fail=(status, body='') => ({ ok:false, status, text:async () => body });
    assert.match(await intentFor(async () => fail(404,'{"code":"PGRST205","message":"Could not find the table public.toolbox_contributions"}')),/supporters\.sql/);
    assert.match(await intentFor(async () => fail(401,'{"message":"Invalid API key"}')),/SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(await intentFor(async () => { throw new Error('getaddrinfo ENOTFOUND'); }),/could not reach the Toolbox database/);
    assert.match(await intentFor(async () => fail(401,'{"status":"error","message":"Invalid authorization key"}'),'USD'),/FLUTTERWAVE_SECRET_KEY/);
    assert.match(await intentFor(async () => json({ status:'error', message:'Transfers not enabled' }),'USD'),/USD to NGN rate is not available/);
  } finally { console.error=quiet; }
});

test('test and placeholder accounts cannot contribute while signed in', async () => {
  const handler=createSupporterHandler({ env, fetcher:async url => {
    assert.ok(url.endsWith('/auth/v1/user')); return json({ id:'account-t', email:'test@example.com' });
  } });
  assert.equal((await request(handler,'intent',{ amount:5000,currency:'NGN' })).status,403);
});
