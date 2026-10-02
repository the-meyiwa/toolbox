/* ============================================================
   TOOLBOX — Account policy

   Toolbox accounts belong to real people. Test, placeholder and
   throwaway addresses are refused when signing up and signing in
   (in the browser), on every server route that checks a session,
   and by supabase/block-test-users.sql in the database itself.

   Pure functions only: this file is shared by the browser and the
   Node server.
   ============================================================ */

// Domains reserved for documentation and testing (RFC 2606 / 6761) and common placeholders.
const RESERVED_DOMAINS = new Set([
  'example.com', 'example.net', 'example.org', 'example.edu',
  'test.com', 'test.net', 'test.org', 'testing.com', 'testmail.com', 'testuser.com',
  'fake.com', 'fakemail.com', 'fakeinbox.com', 'noemail.com', 'nomail.com', 'none.com',
  'email.com.test', 'domain.com', 'mailinator.com', 'mailinator.net', 'guerrillamail.com',
  'guerrillamail.net', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la', '10minutemail.com',
  '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmailo.com',
  'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'mintemail.com', 'mohmal.com', 'emailondeck.com',
  'spamgourmet.com', 'mailnesia.com', 'tempinbox.com', 'burnermail.io', 'moakt.com',
]);
// Top-level names that can never receive mail on the public internet.
const RESERVED_TLDS = new Set(['test', 'example', 'invalid', 'localhost', 'local', 'internal', 'lan', 'home', 'corp', 'localdomain']);
// Mailbox names that only ever mean "a test account".
const TEST_LOCAL = /^(?:test|tests|tester|testing|testuser|test[._-]?user|user[._-]?test|test[._-]?account|demo|demo[._-]?user|dummy|fake|sample|placeholder|foo|bar|foobar|asdf|qwerty|noreply|no-reply|null|nobody|anonymous|guest)(?:[._+-]?\d*)?$/i;

/** True when an address is a test, placeholder or throwaway account rather than a person's. */
export function isTestAccountEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return true;
  const local = value.slice(0, at).split('+')[0];
  const domain = value.slice(at + 1).replace(/\.$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return true;
  const tld = domain.split('.').pop();
  if (RESERVED_TLDS.has(tld)) return true;
  // Reserved domains and any of their subdomains.
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (RESERVED_DOMAINS.has(parts.slice(i).join('.'))) return true;
  return TEST_LOCAL.test(local);
}

export const TEST_ACCOUNT_MESSAGE = 'Toolbox accounts are for real people. Use an email address you own; test and throwaway addresses are not allowed.';

/** True for an access token the auth provider could have issued (a three-part JWT). */
export function isIssuedAccessToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}
