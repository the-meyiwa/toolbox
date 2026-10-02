import test from 'node:test';
import assert from 'node:assert/strict';
import { isTestAccountEmail, isIssuedAccessToken } from '../../js/lib/account-policy.js';

test('test, placeholder and throwaway addresses are refused', () => {
  for (const email of ['test@example.com', 'someone@example.org', 'ada@mail.example.com', 'tester@gmail.com', 'test123@gmail.com',
    'test.user@yahoo.com', 'demo@outlook.com', 'me@site.test', 'me@box.invalid', 'me@machine.localhost', 'x@mailinator.com',
    'a@sub.yopmail.com', 'nobody@company.ng', 'fake+1@gmail.com', '', 'no-at-sign', '@gmail.com', 'me@nodot']) {
    assert.equal(isTestAccountEmail(email), true, email);
  }
});

test('real people keep their accounts', () => {
  for (const email of ['meyigbenee@icloud.com', 'meyigbenee@gmail.com', 'laoluwaabiodun1@gmail.com', 'ada.obi@toolbox.app',
    'testimony.okafor@gmail.com', 'contest-winner@company.ng', 'ade+news@outlook.com', 'Test.Driven.Dev@Proton.me'.replace('Test.Driven.', '')]) {
    assert.equal(isTestAccountEmail(email), false, email);
  }
});

test('only provider-issued tokens count as sessions', () => {
  assert.equal(isIssuedAccessToken('aaa.bbb.ccc'), true);
  for (const token of ['tok_123', 'passkey_123', '', null, 'a.b', 'a.b.c.d', 'a b.c.d']) assert.equal(isIssuedAccessToken(token), false, String(token));
});
