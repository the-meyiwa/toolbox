import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export function isPublicAddress(address) {
  const ip = String(address).toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Permit only global unicast IPv6; reject mapped IPv4, local, multicast,
  // documentation and transition ranges that can tunnel to a private address.
  return net.isIP(ip) === 6 && /^[23][0-9a-f]{3}:/.test(ip) &&
    !/^2001:(?:0*:|db8:|[12][0-9a-f]:)/.test(ip) && !/^2002:/.test(ip);
}

export async function resolvePublicUrl(value, lookup = dns.lookup) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) || !host ||
      host === 'localhost' || /(?:^|\.)(?:localhost|local|internal|onion)$/.test(host)) {
    throw new Error('Only public HTTP or HTTPS addresses are allowed.');
  }
  const records = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some(record => !isPublicAddress(record.address))) {
    throw new Error('Access to private or reserved network addresses is prohibited.');
  }
  url.hash = '';
  return { url, records };
}

/** Public-page fetch with DNS pinned to checked IPs at connection time.
 * No user credentials/cookies, automatic redirects or unbounded bodies cross this boundary. */
export async function fetchPublicUrl(value, { headers = {}, signal, maxBytes = 12 * 1024 * 1024, timeoutMs = 20_000 } = {}, dependencies = {}) {
  const lookup = dependencies.lookup || dns.lookup;
  const requestFor = dependencies.requestFor || (protocol => protocol === 'https:' ? https.request : http.request);
  const deadline = AbortSignal.timeout(timeoutMs);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let target = value;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const { url, records } = await resolvePublicUrl(target, lookup);
    cancellation.throwIfAborted();
    const safeHeaders = {};
    for (const [name, value] of Object.entries(headers)) {
      if (/^(?:accept|accept-language|user-agent)$/i.test(name)) safeHeaders[name] = value;
    }
    safeHeaders['Accept-Encoding'] = 'identity';
    const result = await new Promise((resolve, reject) => {
      const pinnedLookup = (_hostname, options, callback) => {
        if (typeof options === 'function') { callback = options; options = {}; }
        const family = Number(options?.family || 0);
        const addresses = family ? records.filter(item => item.family === family) : records;
        if (!addresses.length) return callback(new Error('No public address for this address family.'));
        callback(null, ...(options?.all ? [addresses] : [addresses[0].address, addresses[0].family]));
      };
      const req = requestFor(url.protocol)(url, { method: 'GET', headers: safeHeaders, lookup: pinnedLookup, agent: false, signal: cancellation }, res => {
        const status = res.statusCode || 502;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.destroy();
          resolve({ redirect: new URL(res.headers.location, url).href });
          return;
        }
        if (Number(res.headers['content-length']) > maxBytes) { res.destroy(); reject(new Error('Remote content exceeds the download limit.')); return; }
        const chunks = [];
        let size = 0;
        res.on('data', chunk => {
          size += chunk.length;
          if (size > maxBytes) { res.destroy(); reject(new Error('Remote content exceeds the download limit.')); }
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          const responseHeaders = new Headers();
          for (const name of ['content-type', 'content-length', 'content-disposition']) {
            if (res.headers[name]) responseHeaders.set(name, String(res.headers[name]));
          }
          const response = new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers: responseHeaders });
          Object.defineProperty(response, 'url', { value: url.href });
          resolve({ response });
        });
      });
      req.on('error', reject);
      req.end();
    });
    if (result.response) return result.response;
    target = result.redirect;
  }
  throw new Error('The remote page redirected too many times.');
}

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
export function isLocalDevelopmentRequest(request) {
  const headers = request.headers || {};
  return process.env.NODE_ENV !== 'production' && /^(?:::1|127\.|::ffff:127\.)/.test(request.socket?.remoteAddress || '') &&
    /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(headers.host || '') &&
    !['x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'cf-connecting-ip', 'x-vercel-id'].some(name => headers[name]) &&
    (!headers.origin || LOCAL_ORIGIN.test(headers.origin)) && headers['sec-fetch-site'] !== 'cross-site';
}

export function isAllowedRequestOrigin(origin, request) {
  if (!origin || origin === 'null') return false;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) return false;
  const allowed = (process.env.TOOLBOX_ALLOWED_ORIGINS || '').split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (LOCAL_ORIGIN.test(origin)) return isLocalDevelopmentRequest(request);
  // Forwarding headers are caller-controlled unless independently authenticated.
  return parsed.protocol === 'https:' && parsed.host === request.headers.host;
}

export function privateResponseHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

export function safeProviderError(provider, error) {
  const status = Number(error?.status) || 502;
  return `${provider}: request failed (${status}).`;
}

// Hash cache keys so bearer credentials themselves are not retained as map keys.
export const sessionCacheKey = token => crypto.createHash('sha256').update(token).digest('hex');
