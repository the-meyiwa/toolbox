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

/** Signal cancellation the same way fetch does, so callers need only
    one check. Without this, an aborted run resolved normally and the
    caller happily carried on to the next phase. */
function abortError() {
  const err = new Error('Measurement cancelled');
  err.name = 'AbortError';
  return err;
}

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
  if (signal?.aborted) throw abortError();
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

  if (signal?.aborted) throw abortError();

  samples.push({ t: performance.now() - started, bytes: received });
  const mbps = throughputFromSamples(samples, warmupMs);
  if (!received) throw new Error('No data was received.');
  return { mbps, bytes: received, seconds: (performance.now() - started) / 1000, samples };
}

/**
 * Upload throughput.
 *
 * Uses XMLHttpRequest rather than fetch, because `xhr.upload.onprogress`
 * is the only way a browser will tell you how many bytes have actually
 * left — fetch offers no upload progress, and request-body streaming is
 * not available everywhere.
 *
 * That distinction is not academic. Counting bytes only when a POST
 * *resolves* meant that on a modest uplink, where a chunk takes longer
 * than the measurement window, nothing was ever counted and the tool
 * reported 0.00 Mbps. Measured here: a single 2 MB chunk took 2.7 s, and
 * three concurrent ones mostly failed outright rather than sharing the
 * link — so concurrency is kept low and progress is sampled continuously.
 */
export async function measureUpload({
  durationMs = 9000, warmupMs = 1500, streams = 2, chunkBytes = 1048576,
  signal, onSample,
} = {}) {
  const payload = new Uint8Array(chunkBytes);
  // Vary the bytes so nothing along the path can usefully compress them.
  for (let i = 0; i < payload.length; i += 1024) payload[i] = (Math.random() * 255) | 0;

  /* Two counters, because they answer different questions.

     `sent` comes from upload progress events and is what the live
     readout follows — it moves smoothly and feels responsive.

     `confirmed` only counts a chunk once the server has answered, which
     is the figure the final number is computed from. Progress events
     report bytes handed to the operating system's send buffer, not bytes
     acknowledged by the far end, so on a slow uplink a large chunk can
     appear to fly out and then stall. That is why an earlier version
     swung between 0.9 and 12.6 Mbps on the same connection. Smaller
     chunks and a completion-based figure keep the reading stable. */
  let sent = 0;
  let confirmed = 0;
  let failures = 0;
  const started = performance.now();
  const samples = [{ t: 0, bytes: 0 }];
  const confirmedSamples = [{ t: 0, bytes: 0 }];
  const open = new Set();
  let stopped = false;

  const stop = () => {
    stopped = true;
    for (const xhr of open) { try { xhr.abort(); } catch { /* already done */ } }
    open.clear();
  };
  signal?.addEventListener('abort', stop, { once: true });

  const sampler = setInterval(() => {
    const t = performance.now() - started;
    samples.push({ t, bytes: sent });
    confirmedSamples.push({ t, bytes: confirmed });
    // The live figure follows confirmed bytes once there are any, and
    // falls back to progress early on so the readout is not stuck at zero
    // while the first chunk is still in flight.
    const live = confirmed > 0
      ? throughputFromSamples(confirmedSamples, warmupMs)
      : throughputFromSamples(samples, warmupMs);
    onSample?.({
      elapsed: t,
      progress: Math.min(t / durationMs, 1),
      mbps: live,
      bytes: Math.max(sent, confirmed),
    });
  }, 150);

  /** One POST, resolving when it finishes, errors, or is aborted. */
  const postOnce = () => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    open.add(xhr);
    let last = 0;

    xhr.upload.onprogress = (e) => {
      // Deltas, because `loaded` is cumulative per request.
      const delta = e.loaded - last;
      last = e.loaded;
      if (delta > 0) sent += delta;
    };
    const done = (ok) => { open.delete(xhr); resolve(ok); };
    xhr.onload = () => {
      // The far end answered, so this chunk genuinely crossed the link.
      confirmed += chunkBytes;
      done(true);
    };
    xhr.onerror = () => { failures++; done(false); };
    xhr.onabort = () => done(false);
    xhr.ontimeout = () => { failures++; done(false); };

    try {
      xhr.open('POST', UP, true);
      xhr.timeout = Math.max(durationMs, 15000);
      xhr.send(payload);
    } catch {
      failures++;
      done(false);
    }
  });

  const push = async () => {
    while (!stopped && performance.now() - started < durationMs) {
      const ok = await postOnce();
      if (stopped) return;
      // A failed post on a strained uplink is normal; back off briefly
      // rather than hammering the endpoint.
      if (!ok) await new Promise(r => setTimeout(r, 200));
    }
  };

  const timer = setTimeout(stop, durationMs);
  await Promise.all(Array.from({ length: streams }, push));
  clearTimeout(timer);
  clearInterval(sampler);
  signal?.removeEventListener('abort', stop);
  stop();

  if (signal?.aborted) throw abortError();

  const endedAt = performance.now() - started;
  samples.push({ t: endedAt, bytes: sent });
  confirmedSamples.push({ t: endedAt, bytes: confirmed });

  if (!sent && !confirmed) {
    throw new Error(failures
      ? 'The upload test server refused the connection.'
      : 'No data could be uploaded.');
  }

  // Prefer the acknowledged figure. Only if nothing completed at all —
  // a very slow uplink — fall back to progress, which is better than
  // reporting nothing but is noted as approximate by being the lesser
  // of the two.
  const mbps = confirmed > 0
    ? throughputFromSamples(confirmedSamples, warmupMs)
    : throughputFromSamples(samples, warmupMs);

  return {
    mbps,
    bytes: confirmed || sent,
    confirmed,
    approximate: confirmed === 0,
    seconds: (performance.now() - started) / 1000,
    samples: confirmedSamples,
  };
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
