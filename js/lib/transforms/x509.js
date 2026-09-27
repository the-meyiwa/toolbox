/* ============================================================
   X.509 certificate and CSR decoder: a small DER reader, no library.

   Reads PEM or DER, and reports what an engineer checks: subject,
   issuer, validity, SANs, key type and size, usages, fingerprints.
   It decodes; it does not verify signatures or chains.
   ============================================================ */

const OIDS = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber',
  '2.5.4.9': 'street', '2.5.4.17': 'postalCode', '2.5.4.4': 'SN', '2.5.4.42': 'GN', '1.2.840.113549.1.9.1': 'emailAddress',
  '0.9.2342.19200300.100.1.25': 'DC', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC', '2.5.4.15': 'businessCategory',
  '1.2.840.113549.1.1.1': 'RSA', '1.2.840.10045.2.1': 'EC', '1.3.101.112': 'Ed25519', '1.3.101.113': 'Ed448', '1.2.840.10040.4.1': 'DSA',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption', '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption', '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption', '1.2.840.113549.1.1.10': 'RSASSA-PSS', '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384', '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512', '1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
  '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521', '1.3.132.0.10': 'secp256k1',
  '2.5.29.17': 'subjectAltName', '2.5.29.19': 'basicConstraints', '2.5.29.15': 'keyUsage', '2.5.29.37': 'extKeyUsage',
  '2.5.29.14': 'subjectKeyIdentifier', '2.5.29.35': 'authorityKeyIdentifier', '2.5.29.31': 'cRLDistributionPoints',
  '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess', '2.5.29.32': 'certificatePolicies', '1.3.6.1.4.1.11129.2.4.2': 'SCT list',
  '1.3.6.1.5.5.7.3.1': 'TLS server', '1.3.6.1.5.5.7.3.2': 'TLS client', '1.3.6.1.5.5.7.3.3': 'Code signing', '1.3.6.1.5.5.7.3.4': 'Email protection',
  '1.3.6.1.5.5.7.3.8': 'Time stamping', '1.3.6.1.5.5.7.3.9': 'OCSP signing', '1.3.6.1.5.5.7.48.1': 'OCSP', '1.3.6.1.5.5.7.48.2': 'CA issuers',
  '1.2.840.113549.1.9.14': 'extensionRequest',
};
const KEY_USAGE = ['Digital signature', 'Non-repudiation', 'Key encipherment', 'Data encipherment', 'Key agreement', 'Certificate signing', 'CRL signing', 'Encipher only', 'Decipher only'];

/* ---------------- DER ---------------- */

export function readTlv(b, off = 0) {
  const tag = b[off]; let len = b[off + 1]; let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('Unsupported DER length');
    len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[off + 2 + i];
    hdr += n;
  }
  if (off + hdr + len > b.length) throw new Error('Truncated DER: this is not a complete certificate');
  return { tag, cls: tag >> 6, constructed: !!(tag & 0x20), num: tag & 0x1f, start: off, hdr, len, body: b.subarray(off + hdr, off + hdr + len), end: off + hdr + len };
}

export function children(node) {
  const out = []; let o = 0;
  while (o < node.body.length) { const c = readTlv(node.body, o); out.push(c); o = c.end; }
  return out;
}

export function oid(body) {
  const parts = [Math.floor(body[0] / 40), body[0] % 40]; let v = 0;
  for (let i = 1; i < body.length; i++) { v = v * 128 + (body[i] & 0x7f); if (!(body[i] & 0x80)) { parts.push(v); v = 0; } }
  return parts.join('.');
}

const hex = (b, sep = ':') => Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(sep);
const text = (n) => (n.tag === 0x1e ? String.fromCharCode(...Array.from({ length: n.body.length / 2 }, (_, i) => (n.body[2 * i] << 8) | n.body[2 * i + 1])) : new TextDecoder().decode(n.body));

function time(n) {
  const s = new TextDecoder().decode(n.body);
  const m = n.tag === 0x17 ? s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/) : s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/);
  if (!m) return null;
  let y = Number(m[1]); if (n.tag === 0x17) y += y < 50 ? 2000 : 1900;
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)));
}

function name(seq) {
  return children(seq).map((set) => {
    const atv = children(children(set)[0]);
    const k = oid(atv[0].body);
    return [OIDS[k] || k, text(atv[1])];
  });
}
export const nameString = (parts) => parts.map(([k, v]) => `${k}=${v}`).join(', ');

function algorithm(seq) {
  const c = children(seq);
  const id = oid(c[0].body);
  return { id, name: OIDS[id] || id, param: c[1]?.tag === 0x06 ? OIDS[oid(c[1].body)] || oid(c[1].body) : null };
}

function publicKey(spki) {
  const [alg, bits] = children(spki);
  const a = algorithm(alg);
  const key = bits.body.subarray(1);
  const info = { algorithm: a.name, curve: a.param };
  if (a.name === 'RSA') {
    const [mod, exp] = children(readTlv(key));
    let m = mod.body; while (m[0] === 0 && m.length > 1) m = m.subarray(1);
    info.bits = m.length * 8 - Math.clz32(m[0]) + 24;
    info.exponent = Number(BigInt(`0x${hex(exp.body, '') || '0'}`));
  } else if (a.name === 'EC') info.bits = { 'P-256': 256, 'P-384': 384, 'P-521': 521, secp256k1: 256 }[a.param] || null;
  else if (a.name === 'Ed25519') info.bits = 256;
  return info;
}

function generalNames(seq) {
  return children(seq).map((g) => {
    const t = g.num;
    if (t === 2) return `DNS:${text(g)}`;
    if (t === 1) return `email:${text(g)}`;
    if (t === 6) return `URI:${text(g)}`;
    if (t === 7) return `IP:${g.body.length === 4 ? Array.from(g.body).join('.') : hex(g.body, '').match(/.{4}/g).join(':').toLowerCase()}`;
    return `other(${t})`;
  });
}

function extension(id, value) {
  const v = readTlv(value);
  switch (OIDS[id]) {
    case 'subjectAltName': return generalNames(v);
    case 'basicConstraints': {
      const c = children(v);
      const ca = c.find((x) => x.tag === 0x01);
      const len = c.find((x) => x.tag === 0x02);
      return { ca: !!(ca && ca.body[0]), pathLength: len ? len.body[0] : null };
    }
    case 'keyUsage': {
      const unused = v.body[0]; const bytes = v.body.subarray(1); const out = [];
      for (let i = 0; i < bytes.length * 8 - unused; i++) if (bytes[i >> 3] & (0x80 >> (i & 7))) out.push(KEY_USAGE[i]);
      return out;
    }
    case 'extKeyUsage': return children(v).map((o) => OIDS[oid(o.body)] || oid(o.body));
    case 'subjectKeyIdentifier': return hex(v.body);
    case 'authorityKeyIdentifier': { const k = children(v).find((x) => x.num === 0 && x.cls === 2); return k ? hex(k.body) : ''; }
    case 'authorityInfoAccess': return children(v).map((ad) => { const [m, loc] = children(ad); return `${OIDS[oid(m.body)] || oid(m.body)}: ${text(loc)}`; });
    case 'cRLDistributionPoints': return children(v).flatMap((dp) => { const out = []; const scan = (n) => { if (n.cls === 2 && n.num === 6 && !n.constructed) out.push(text(n)); else if (n.constructed) children(n).forEach(scan); }; scan(dp); return out; });
    default: return `${value.length} bytes`;
  }
}

function extensions(node) {
  const out = [];
  for (const e of children(node)) {
    const c = children(e);
    const id = oid(c[0].body);
    const critical = c.length === 3 && c[1].tag === 0x01 && !!c[1].body[0];
    const val = c[c.length - 1].body;
    let decoded;
    try { decoded = extension(id, val); } catch { decoded = `${val.length} bytes`; }
    out.push({ id, name: OIDS[id] || id, critical, value: decoded });
  }
  return out;
}

/* ---------------- entry points ---------------- */

/** Every PEM block in the text, or the input as DER if there are none. */
export function readPem(input) {
  if (input instanceof Uint8Array) return [{ label: 'CERTIFICATE', der: input }];
  const blocks = [...String(input).matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)];
  if (!blocks.length) {
    const b64 = String(input).replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]{100,}$/.test(b64)) return [{ label: 'CERTIFICATE', der: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }];
    throw new Error('Paste a PEM certificate (-----BEGIN CERTIFICATE-----) or its Base64');
  }
  return blocks.map((m) => ({ label: m[1], der: Uint8Array.from(atob(m[2].replace(/[^A-Za-z0-9+/=]/g, '')), (c) => c.charCodeAt(0)) }));
}

async function digest(alg, der) {
  const d = await crypto.subtle.digest(alg, der);
  return hex(new Uint8Array(d));
}

export async function decodeCertificate(der, { now = new Date() } = {}) {
  const cert = readTlv(der);
  const [tbs, sigAlg] = children(cert);
  const t = children(tbs);
  let i = 0;
  let version = 1;
  if (t[0].cls === 2 && t[0].num === 0) { version = children(t[0])[0].body[0] + 1; i = 1; }
  const serial = t[i]; const sig = t[i + 1]; const issuer = t[i + 2]; const validity = t[i + 3]; const subject = t[i + 4]; const spki = t[i + 5];
  const exts = t.slice(i + 6).find((x) => x.cls === 2 && x.num === 3);
  const [nb, na] = children(validity).map(time);
  const ext = exts ? extensions(children(exts)[0]) : [];
  const subj = name(subject); const iss = name(issuer);
  const days = na ? Math.floor((na - now) / 86400000) : null;
  return {
    type: 'certificate', version, serial: hex(serial.body),
    subject: subj, issuer: iss, selfSigned: nameString(subj) === nameString(iss),
    notBefore: nb, notAfter: na, daysLeft: days,
    status: nb && now < nb ? 'not yet valid' : days != null && days < 0 ? 'expired' : days != null && days < 30 ? 'expiring soon' : 'valid',
    signature: algorithm(sig).name || algorithm(sigAlg).name,
    key: publicKey(spki),
    extensions: ext,
    san: ext.find((e) => e.name === 'subjectAltName')?.value || [],
    sha256: await digest('SHA-256', der), sha1: await digest('SHA-1', der),
  };
}

export async function decodeCsr(der) {
  const req = readTlv(der);
  const [info, sigAlg] = children(req);
  const c = children(info);
  const attrs = c.find((x) => x.cls === 2 && x.num === 0);
  let ext = [];
  if (attrs) for (const a of children(attrs)) {
    const [id, set] = children(a);
    if (OIDS[oid(id.body)] === 'extensionRequest') ext = extensions(children(set)[0]);
  }
  return {
    type: 'csr', subject: name(c[1]), key: publicKey(c[2]), signature: algorithm(sigAlg).name,
    extensions: ext, san: ext.find((e) => e.name === 'subjectAltName')?.value || [], sha256: await digest('SHA-256', der),
  };
}

export async function decodePem(input, opts) {
  const blocks = readPem(input);
  const out = [];
  for (const b of blocks) {
    if (/REQUEST/.test(b.label)) out.push(await decodeCsr(b.der));
    else if (/CERTIFICATE/.test(b.label)) out.push(await decodeCertificate(b.der, opts));
    else out.push({ type: 'other', label: b.label, bytes: b.der.length });
  }
  return out;
}
