/* ============================================================
   Certificate Decoder — read a PEM or Base64 X.509 certificate
   (or CSR, or a whole chain) and see who it is for, who issued it,
   when it expires, its names, key and fingerprints. Decoding only:
   it does not check signatures or trust.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { decodePem, nameString } from '../lib/transforms/x509.js';
import { kv, heading, badge, code } from '../lib/kit/render.js';

const TONE = { valid: 'ok', expired: 'bad', 'not yet valid': 'bad', 'expiring soon': 'warn' };
const date = (d) => (d ? d.toUTCString().replace('GMT', 'UTC') : '');
const keyText = (k) => [k.algorithm, k.bits && `${k.bits}-bit`, k.curve, k.exponent && `e=${k.exponent}`].filter(Boolean).join(' · ');

function certHtml(c, i, total) {
  const title = total > 1 ? `${i === 0 ? 'Leaf' : i === total - 1 && c.selfSigned ? 'Root' : 'Intermediate'} certificate ${i + 1}` : 'Certificate';
  const ext = (name) => c.extensions.find((e) => e.name === name)?.value;
  const bc = ext('basicConstraints');
  return heading(title) + kv([
    ['Status', badge(c.status === 'valid' ? `Valid · ${c.daysLeft} days left` : c.status === 'expiring soon' ? `Expires in ${c.daysLeft} days` : c.status === 'expired' ? `Expired ${-c.daysLeft} days ago` : c.status, TONE[c.status])],
    ['Subject', nameString(c.subject)], ['Issuer', c.selfSigned ? `${nameString(c.issuer)} (self-signed)` : nameString(c.issuer)],
    ['Valid from', date(c.notBefore)], ['Valid until', date(c.notAfter)],
    ['Names (SAN)', c.san.join(', ')], ['Public key', keyText(c.key)], ['Signature', c.signature],
    ['Is a CA', bc ? (bc.ca ? `Yes${bc.pathLength != null ? `, path length ${bc.pathLength}` : ''}` : 'No') : ''],
    ['Key usage', (ext('keyUsage') || []).join(', ')], ['Extended usage', (ext('extKeyUsage') || []).join(', ')],
    ['OCSP / issuer', (ext('authorityInfoAccess') || []).join('\n')], ['CRL', (ext('cRLDistributionPoints') || []).join(', ')],
    ['Serial', code(c.serial)], ['SHA-256', code(c.sha256)], ['SHA-1', code(c.sha1)], ['Version', `v${c.version}`],
  ]);
}

export default makeTextTool({
  id: 'cert-decoder',
  inputLabel: 'PEM certificate, chain or CSR',
  outputLabel: 'Decoded',
  produces: ['text'],
  accept: '.pem,.crt,.cer,.csr,.txt',
  placeholder: '-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----',
  async run(input) {
    const items = await decodePem(input);
    const certs = items.filter((x) => x.type === 'certificate');
    const html = items.map((x, i) => (x.type === 'certificate' ? certHtml(x, certs.indexOf(x), certs.length)
      : x.type === 'csr' ? heading('Certificate signing request') + kv([['Subject', nameString(x.subject)], ['Names (SAN)', x.san.join(', ')], ['Public key', keyText(x.key)], ['Signature', x.signature], ['SHA-256', code(x.sha256)]])
        : heading(x.label) + kv([['Size', `${x.bytes} bytes`], ['Note', 'Not a certificate or CSR, so it was not decoded']]))).join('');
    const text = items.map((x) => (x.type === 'other' ? x.label : `${x.type === 'csr' ? 'CSR' : 'Certificate'}: ${nameString(x.subject)}${x.notAfter ? `\nExpires: ${date(x.notAfter)}` : ''}${x.san?.length ? `\nSAN: ${x.san.join(', ')}` : ''}\nSHA-256: ${x.sha256 || ''}`)).join('\n\n');
    return { html, text, stats: [['blocks', items.length]] };
  },
});
