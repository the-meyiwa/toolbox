/* ============================================================
   Toolbox Resilient DNS-over-HTTPS (DoH) Resolver
   Dual-provider architecture using Google DoH with Cloudflare DoH fallback.
   Universal browser CORS support and IPv4/IPv6 PTR reverse resolution.
   ============================================================ */

export const DNS_TYPE_MAP = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA'
};

export const REVERSE_TYPE_MAP = Object.fromEntries(
  Object.entries(DNS_TYPE_MAP).map(([k, v]) => [v, Number(k)])
);

/**
 * Converts an IPv4 or IPv6 address to an in-addr.arpa or ip6.arpa PTR lookup name.
 */
export function ipToArpa(ip) {
  const trimmed = String(ip || '').trim();
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return trimmed.split('.').reverse().join('.') + '.in-addr.arpa';
  }
  // IPv6
  if (trimmed.includes(':')) {
    // Expand IPv6 shorthand if necessary
    const parts = trimmed.split('::');
    let full = [];
    if (parts.length === 2) {
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - (left.length + right.length);
      const middle = Array(Math.max(0, missing)).fill('0000');
      full = [...left, ...middle, ...right];
    } else {
      full = trimmed.split(':');
    }
    const hex32 = full.map(h => h.padStart(4, '0')).join('');
    return hex32.split('').reverse().join('.') + '.ip6.arpa';
  }
  return trimmed;
}

/**
 * Queries DNS records via Google DoH with Cloudflare DoH fallback.
 * @param {string} target - Domain name or IP address
 * @param {string} recordType - A, AAAA, MX, TXT, CNAME, NS, SOA, PTR, CAA, ANY
 */
export async function queryDns(target, recordType = 'A') {
  let clean = String(target || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!clean) {
    return { status: 'error', message: 'Domain or IP address is required.' };
  }

  let type = String(recordType || 'A').toUpperCase().trim();
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(clean) || clean.includes(':');

  let queryName = clean;
  if (isIp || type === 'PTR') {
    type = 'PTR';
    queryName = ipToArpa(clean);
  }

  let lastError = null;

  // 1. Primary: Google Public DNS over HTTPS
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(queryName)}&type=${encodeURIComponent(type)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      return formatDnsResponse(json, clean, queryName, type, 'Google DNS over HTTPS');
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Secondary Fallback: Cloudflare 1.1.1.1 DNS over HTTPS
  try {
    const cfUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(queryName)}&type=${encodeURIComponent(type)}`;
    const cfRes = await fetch(cfUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/dns-json' }
    });
    if (cfRes.ok) {
      const json = await cfRes.json();
      return formatDnsResponse(json, clean, queryName, type, 'Cloudflare 1.1.1.1 DoH');
    }
  } catch (err) {
    lastError = err;
  }

  // 3. Optional Local Backend Proxy Fallback (if running locally or self-hosted)
  try {
    const apiRes = await fetch(`/api/dns/lookup?name=${encodeURIComponent(queryName)}&type=${encodeURIComponent(type)}`);
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.status === 'success') return json;
    }
  } catch {}

  return {
    status: 'error',
    domain: clean,
    queryName,
    type,
    message: `DNS resolution failed: ${lastError?.message || 'Both Google and Cloudflare DoH providers were unreachable.'}`,
    answers: []
  };
}

function formatDnsResponse(data, domain, queryName, requestedType, provider) {
  const rawAnswers = data.Answer || [];
  const authority = data.Authority || [];

  const answers = rawAnswers.map(a => {
    const typeNum = Number(a.type);
    const typeStr = DNS_TYPE_MAP[typeNum] || `TYPE_${typeNum}`;
    let value = String(a.data || '').trim();

    // Clean up trailing dots on hostnames
    if (['CNAME', 'NS', 'PTR', 'MX'].includes(typeStr) && value.endsWith('.')) {
      value = value.slice(0, -1);
    }
    // Clean outer quotes from TXT strings
    if (typeStr === 'TXT' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    return {
      name: String(a.name || queryName).replace(/\.$/, ''),
      type: typeStr,
      ttl: a.TTL,
      data: value
    };
  });

  return {
    status: 'success',
    domain,
    queryName,
    type: requestedType,
    provider,
    answers,
    count: answers.length,
    rawStatus: data.Status,
    message: answers.length
      ? `Found ${answers.length} ${requestedType} record(s) via ${provider}.`
      : `No ${requestedType} records found for ${domain}.`
  };
}
