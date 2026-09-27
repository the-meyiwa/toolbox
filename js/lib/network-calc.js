/* ============================================================
   TOOLBOX — Networking tools, without the UI

   The Assistant's network_tool runs the Networking tools through
   here: subnet maths and URL parsing are local; IP, DNS, WHOIS,
   domain, certificate, robots.txt and MAC lookups call the same
   public services the tools use (RDAP first for WHOIS/domains,
   because it is the registries' own JSON and allows CORS).
   ============================================================ */

import { queryDns, ipToArpa } from './dns-resolver.js';

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ip2long = ip => ip.split('.').reduce((a, o) => (a << 8) + parseInt(o, 10), 0) >>> 0;
const long2ip = l => [(l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255].join('.');
export const cleanDomain = (s) => String(s || '').trim().replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/:\d+$/, '').toLowerCase();

/** IPv4 subnet from "192.168.1.10/24", or an address plus a prefix or dotted mask. */
export function subnet(input, prefix) {
  let [ip, cidr] = String(input || '').trim().split('/');
  cidr = cidr ?? prefix;
  if (typeof cidr === 'string' && IPV4.test(cidr)) {
    const m = ip2long(cidr);
    cidr = 32 - Math.log2((~m >>> 0) + 1);
    if (!Number.isInteger(cidr)) return { error: `${prefix || cidr} is not a valid subnet mask.` };
  }
  cidr = Number(cidr ?? 24);
  if (!IPV4.test(ip || '')) return { error: `"${ip}" is not an IPv4 address.` };
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) return { error: 'The prefix must be 0–32.' };
  const mask = cidr === 0 ? 0 : (~((2 ** (32 - cidr)) - 1)) >>> 0;
  const net = (ip2long(ip) & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
  const usable = cidr >= 31 ? (cidr === 31 ? 2 : 1) : bc - net - 1;
  const first = ip2long(ip) >>> 24;
  const cls = first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D (multicast)' : 'E (reserved)';
  const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 'private (RFC 1918)' : /^127\./.test(ip) ? 'loopback' : /^169\.254\./.test(ip) ? 'link-local' : /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) ? 'carrier-grade NAT' : 'public';
  const hex = ip.split('.').map(p => (+p).toString(16).padStart(2, '0'));
  return {
    address: ip, prefix: cidr, cidr: `${long2ip(net)}/${cidr}`,
    mask: long2ip(mask), wildcard: long2ip(~mask >>> 0),
    network: long2ip(net), broadcast: long2ip(bc),
    firstHost: cidr >= 31 ? long2ip(net) : long2ip(net + 1), lastHost: cidr >= 31 ? long2ip(bc) : long2ip(bc - 1),
    usableHosts: usable, totalAddresses: 2 ** (32 - cidr),
    class: cls, scope: priv, ipv4Mapped: `::ffff:${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`,
  };
}

export function parseUrl(url) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`);
    return {
      protocol: u.protocol, host: u.host, hostname: u.hostname, port: u.port || '(default)',
      path: u.pathname, query: Object.fromEntries(u.searchParams.entries()), hash: u.hash, origin: u.origin,
      username: u.username || undefined, secure: u.protocol === 'https:',
    };
  } catch { return { error: 'That is not a URL this can read.' }; }
}

async function getJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

export async function ipLookup(ip = '') {
  const d = await getJson(ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/');
  if (d.error) throw new Error(d.reason || 'Lookup failed');
  return { ip: d.ip, version: d.version, city: d.city, region: d.region, country: d.country_name, countryCode: d.country_code, postal: d.postal, latitude: d.latitude, longitude: d.longitude, timezone: d.timezone, isp: d.org, asn: d.asn, currency: d.currency };
}

export async function dns(domain, type = 'A') {
  const res = await queryDns(cleanDomain(domain), String(type || 'A').toUpperCase());
  return res;
}

export async function reverseDns(ip) {
  const clean = String(ip || '').trim();
  if (!IPV4.test(clean) && !clean.includes(':')) return { error: `"${ip}" is not an IP address.` };
  return { ...(await queryDns(clean, 'PTR')), arpa: ipToArpa(clean) };
}

function rdapSummary(d) {
  const ev = (a) => d.events?.find(e => e.eventAction === a)?.eventDate;
  const ent = (role) => d.entities?.find(e => e.roles?.includes(role));
  const vname = (e) => e?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3];
  return {
    domain: d.ldhName?.toLowerCase(), registrar: vname(ent('registrar')), registrant: vname(ent('registrant')) || '(redacted)',
    registered: ev('registration'), expires: ev('expiration'), updated: ev('last changed'),
    status: d.status, nameservers: d.nameservers?.map(n => n.ldhName?.toLowerCase()), dnssec: d.secureDNS?.delegationSigned ?? null,
  };
}

export async function whois(domain) {
  const dom = cleanDomain(domain);
  try { return { source: 'RDAP', ...rdapSummary(await getJson(`https://rdap.org/domain/${encodeURIComponent(dom)}`)) }; }
  catch (e) {
    if (e.status === 404) return { domain: dom, registered: false, note: 'No registration record: the domain looks unregistered.' };
    const d = await getJson(`https://networkcalc.com/api/dns/whois/${encodeURIComponent(dom)}`);
    return { source: 'WHOIS', domain: dom, ...(d.whois || {}) };
  }
}

export async function domainAvailable(domain) {
  const dom = cleanDomain(domain);
  try {
    const d = rdapSummary(await getJson(`https://rdap.org/domain/${encodeURIComponent(dom)}`));
    return { domain: dom, available: false, registrar: d.registrar, expires: d.expires };
  } catch (e) {
    if (e.status === 404) return { domain: dom, available: true, note: 'No registry record. Confirm with a registrar before relying on it; premium and reserved names can still be blocked.' };
    throw e;
  }
}

export async function sslCertificate(domain) {
  const d = await getJson(`https://networkcalc.com/api/security/certificate/${encodeURIComponent(cleanDomain(domain))}`);
  const c = d.certificate || {};
  const days = c.valid_to ? Math.round((new Date(c.valid_to) - Date.now()) / 864e5) : null;
  return { domain: cleanDomain(domain), issuer: c.issuer?.organization || c.issuer?.common_name || c.issuer, subject: c.subject?.common_name || c.subject, validFrom: c.valid_from, validTo: c.valid_to, daysLeft: days, altNames: c.subject_alt_names || c.san, raw: days == null ? c : undefined };
}

export async function robots(url) {
  const origin = new URL(/^https?:/i.test(url) ? url : `https://${url}`).origin;
  const d = await getJson(`https://api.allorigins.win/get?url=${encodeURIComponent(`${origin}/robots.txt`)}`);
  const text = d.contents || '';
  return { origin, found: !!text.trim(), sitemaps: [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]), robots: text.slice(0, 4000) };
}

export async function macVendor(mac) {
  const clean = String(mac || '').trim();
  if (!/^([0-9a-f]{2}[:-]?){2}[0-9a-f]{2}/i.test(clean)) return { error: 'Give a MAC address (at least the first three bytes), e.g. 00:1A:2B.' };
  const r = await fetch(`https://api.macvendors.com/${encodeURIComponent(clean)}`);
  if (r.status === 404) return { mac: clean, vendor: null, note: 'No vendor is registered to that prefix (it may be randomised/locally administered).' };
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const locallyAdministered = (parseInt(clean.slice(0, 2), 16) & 2) === 2;
  return { mac: clean, vendor: await r.text(), locallyAdministered };
}

export const NETWORK_ACTIONS = {
  subnet: 'net-subnet', url: 'net-url-analyzer', ip: 'ip-lookup', dns: 'net-dns-lookup', reverse_dns: 'net-reverse-dns',
  whois: 'net-whois', domain_available: 'net-domain-availability', ssl: 'net-ssl-viewer', robots: 'net-sitemap', mac: 'net-mac-lookup', speed_test: 'speed-test',
};
