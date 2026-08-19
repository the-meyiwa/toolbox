/* ============================================================
   Network measurement.

   Measuring throughput from a browser is easy to do badly. A single
   small request mostly measures latency: on a real 8 Mbit link, a 1 kB
   download reports 0.03 Mbit/s and a 500 kB download reports 8.2, and
   neither number is wrong — the small one is just dominated by the
   round trip.

   So this does what a real speed test does:

     - measures during a fixed time window, not a fixed payload;
     - discards a warm-up period, because TCP slow start and TLS setup
       make the first moments unrepresentative;
     - opens several parallel streams, because one connection rarely
       saturates a link;
     - reports latency and jitter separately rather than folding them
       into the throughput figure.

   Endpoints are Cloudflare's public speed-test workers, which need no
   key. The trade-off is stated plainly in the UI: this measures the
   path to the nearest Cloudflare edge, which is the honest scope of
   any browser-based test.
   ============================================================ */

const DOWN = 'https://speed.cloudflare.com/__down';
const UP   = 'https://speed.cloudflare.com/__up';
const META = 'https://speed.cloudflare.com/meta';

/** Where the connection actually terminates — the context for the numbers. */
export async function connectionInfo(signal) {
  const res = await fetch(META, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`meta ${res.status}`);
  const m = await res.json();
  return {
    ip: m.clientIp,
    isp: m.asOrganization,
    asn: m.asn,
    city: m.city,
    region: m.region,
    country: m.country,
    edge: m.colo ? `${m.colo.city} (${m.colo.iata})` : null,
    edgeCountry: m.colo?.cca2 ?? null,
    protocol: m.httpProtocol,
  };
}

/**
 * Round-trip time from an empty response.
 * Reports the median (robust to one slow sample) and jitter as the mean
 * absolute difference between consecutive pings, which is what actually
 * degrades calls and games.
 */
export async function measureLatency({ samples = 9, signal, onProgress } = {}) {
  const times = [];
  for (let i = 0; i < samples; i++) {
    if (signal?.aborted) break;
    const t0 = performance.now();
    try {
      await fetch(`${DOWN}?bytes=0&r=${Math.random()}`, { cache: 'no-store', signal });
      times.push(performance.now() - t0);
    } catch (err) {
      if (err.name === 'AbortError') break;
    }
    onProgress?.((i + 1) / samples);
  }
  if (!times.length) throw new Error('No latency samples completed.');

  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let jitter = 0;
  for (let i = 1; i < times.length; i++) jitter += Math.abs(times[i] - times[i - 1]);
  jitter = times.length > 1 ? jitter / (times.length - 1) : 0;

  return { median, min: sorted[0], max: sorted[sorted.length - 1], jitter, samples: times.length };
}

/** Bytes counted inside a time window, ignoring a warm-up period. */
function throughputFromSamples(samples, warmupMs) {
  const start = samples.find(s => s.t >= warmupMs) ?? samples[0];
  const end = samples[samples.length - 1];
  const bytes = end.bytes - start.bytes;
  const seconds = (end.t - start.t) / 1000;
  if (seconds <= 0 || bytes <= 0) return 0;
  return (bytes * 8) / seconds / 1e6;      // megabits per second
}

/**
 * Download throughput.
 * Several streams run concurrently; a sampler records cumulative bytes
 * so the final figure comes from the steady-state portion only.
 */
export async function measureDownload({
  durationMs = 8000, warmupMs = 1200, streams = 4, chunkBytes = 26214400,
  signal, onSample,
} = {}) {
  let received = 0;
  const started = performance.now();
  const samples = [{ t: 0, bytes: 0 }];
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });

  const sampler = setInterval(() => {
    const t = performance.now() - started;
    samples.push({ t, bytes: received });
    onSample?.({
      elapsed: t,
      progress: Math.min(t / durationMs, 1),
      mbps: throughputFromSamples(samples, warmupMs),
      bytes: received,
    });
  }, 150);

  const pull = async () => {
    // Loop so a stream that finishes early starts another rather than
    // leaving the link idle for the rest of the window.
    while (!controller.signal.aborted && performance.now() - started < durationMs) {
      try {
        const res = await fetch(`${DOWN}?bytes=${chunkBytes}&r=${Math.random()}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (performance.now() - started >= durationMs) { reader.cancel().catch(() => {}); break; }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        // A dropped stream is normal on a poor link; the others carry on.
        await new Promise(r => setTimeout(r, 120));
      }
    }
  };

  const timer = setTimeout(stop, durationMs);
  await Promise.all(Array.from({ length: streams }, pull));
  clearTimeout(timer);
  clearInterval(sampler);
  signal?.removeEventListener('abort', stop);
  stop();

  samples.push({ t: performance.now() - started, bytes: received });
  const mbps = throughputFromSamples(samples, warmupMs);
  if (!received) throw new Error('No data was received.');
  return { mbps, bytes: received, seconds: (performance.now() - started) / 1000, samples };
}

/**
 * Upload throughput.
 * Bytes are counted as each POST resolves rather than streamed, because
 * request-body streaming is not available in every browser; with several
 * concurrent posts the aggregate still reflects the link.
 */
export async function measureUpload({
  durationMs = 8000, warmupMs = 1200, streams = 3, chunkBytes = 2097152,
  signal, onSample,
} = {}) {
  const payload = new Uint8Array(chunkBytes);
  // Random-ish bytes so nothing along the path can usefully compress them.
  for (let i = 0; i < payload.length; i += 4096) payload[i] = Math.random() * 255;

  let sent = 0;
  const started = performance.now();
  const samples = [{ t: 0, bytes: 0 }];
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });

  const sampler = setInterval(() => {
    const t = performance.now() - started;
    samples.push({ t, bytes: sent });
    onSample?.({
      elapsed: t,
      progress: Math.min(t / durationMs, 1),
      mbps: throughputFromSamples(samples, warmupMs),
      bytes: sent,
    });
  }, 150);

  const push = async () => {
    while (!controller.signal.aborted && performance.now() - started < durationMs) {
      try {
        await fetch(UP, { method: 'POST', body: payload, cache: 'no-store', signal: controller.signal });
        sent += chunkBytes;
      } catch (err) {
        if (err.name === 'AbortError') return;
        await new Promise(r => setTimeout(r, 120));
      }
    }
  };

  const timer = setTimeout(stop, durationMs);
  await Promise.all(Array.from({ length: streams }, push));
  clearTimeout(timer);
  clearInterval(sampler);
  signal?.removeEventListener('abort', stop);
  stop();

  samples.push({ t: performance.now() - started, bytes: sent });
  const mbps = throughputFromSamples(samples, warmupMs);
  if (!sent) throw new Error('No data could be uploaded.');
  return { mbps, bytes: sent, seconds: (performance.now() - started) / 1000, samples };
}

/** Plain-language reading of what a connection can comfortably do. */
export function verdict(downMbps, latencyMs) {
  if (downMbps >= 100) return { grade: 'Excellent', note: '4K streaming, big downloads and video calls all at once.' };
  if (downMbps >= 25)  return { grade: 'Good', note: 'Comfortable for HD streaming, calls and everyday work.' };
  if (downMbps >= 10)  return { grade: 'Workable', note: 'HD video is fine; large downloads will take a while.' };
  if (downMbps >= 4)   return { grade: 'Modest', note: 'Standard-definition video and browsing are fine.' };
  if (downMbps >= 1)   return { grade: 'Slow', note: 'Browsing works; video will buffer.' };
  return { grade: 'Very slow', note: 'Expect pages to struggle.' };
}

export const latencyQuality = (ms) =>
  ms < 40 ? 'excellent' : ms < 90 ? 'good' : ms < 180 ? 'noticeable' : 'high';
