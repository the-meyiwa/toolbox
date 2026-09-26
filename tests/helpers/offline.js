/* ============================================================
   Offline guard for the test suite
   Preloaded into every test process (see tests/test-runner.js).
   Any attempt to reach a non-loopback host through fetch, raw
   sockets, or DNS fails immediately instead of waiting on the
   network, so the suite is fast and deterministic without
   internet access. Tests that need a remote response must stub
   globalThis.fetch themselves.
   Set TOOLBOX_TEST_NETWORK=1 to disable the guard.
   ============================================================ */

import net from 'node:net';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';

if (process.env.TOOLBOX_TEST_NETWORK !== '1') {
  const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '::', '[::1]']);
  const isLocal = (host) => {
    if (!host) return true;
    const h = String(host).toLowerCase();
    return LOOPBACK.has(h) || h.startsWith('127.') || h.endsWith('.localhost');
  };
  const blocked = (what) => {
    const err = new Error(`Network access is disabled in tests (${what})`);
    err.code = 'ENETUNREACH';
    if (process.env.TOOLBOX_TEST_NETWORK_LOG === '1') {
      process.stderr.write(`[offline] blocked ${what}\n`);
    }
    return err;
  };

  const realFetch = globalThis.fetch;
  if (typeof realFetch === 'function') {
    globalThis.fetch = async function offlineFetch(input, init) {
      let url;
      try {
        url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      } catch {
        return realFetch(input, init);
      }
      if ((url.protocol === 'http:' || url.protocol === 'https:') && !isLocal(url.hostname)) {
        throw new TypeError('fetch failed', { cause: blocked(`fetch ${url.origin}`) });
      }
      return realFetch(input, init);
    };
  }

  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function offlineConnect(...args) {
    const opts = args[0];
    let host;
    if (Array.isArray(opts)) host = opts[0]?.host;
    else if (opts && typeof opts === 'object') host = opts.path ? 'localhost' : opts.host;
    else if (typeof opts === 'number') host = typeof args[1] === 'string' ? args[1] : 'localhost';
    else if (typeof opts === 'string') host = 'localhost'; // unix socket path
    if (!isLocal(host)) {
      const err = blocked(`socket ${host}`);
      process.nextTick(() => this.destroy(err));
      return this;
    }
    return realConnect.apply(this, args);
  };

  const wrapLookup = (real) => function offlineLookup(hostname, ...rest) {
    if (isLocal(hostname)) return real.call(this, hostname, ...rest);
    const cb = rest.find((a) => typeof a === 'function');
    const err = blocked(`dns ${hostname}`);
    err.code = 'ENOTFOUND';
    if (cb) process.nextTick(() => cb(err));
  };
  for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveMx', 'resolveTxt', 'resolveCname', 'resolveNs']) {
    if (typeof dns[name] === 'function') dns[name] = wrapLookup(dns[name]);
  }
  const wrapPromise = (real) => async function offlinePromiseLookup(hostname, ...rest) {
    if (isLocal(hostname)) return real.call(this, hostname, ...rest);
    const err = blocked(`dns ${hostname}`);
    err.code = 'ENOTFOUND';
    throw err;
  };
  for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveMx', 'resolveTxt', 'resolveCname', 'resolveNs']) {
    if (typeof dns.promises[name] === 'function') dns.promises[name] = wrapPromise(dns.promises[name]);
  }
  // Propagate the patches to named ESM imports (import { lookup } from 'node:dns').
  syncBuiltinESMExports();
}
