/* Toolbox edge Worker.
   Static files are served straight from ./dist by Cloudflare; only /api/*
   reaches this code (see run_worker_first in wrangler.jsonc). Those requests
   are forwarded unchanged to the Node API on Render, so the browser keeps
   calling same-origin /api/... exactly as it did on Vercel. */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.BACKEND_URL);
      const forwarded = new Request(target, request);
      // Tell the API which public host the visitor used, so OAuth callbacks
      // (e.g. /api/mail/oauth/callback) point back at this domain, not Render.
      forwarded.headers.set('X-Forwarded-Host', url.host);
      forwarded.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
      try {
        // "manual" passes OAuth redirects through to the browser untouched.
        return await fetch(forwarded, { redirect: 'manual' });
      } catch {
        return Response.json({ success: false, error: 'The Toolbox API could not be reached. Try again in a moment.' }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },

  // Runs every 10 minutes (see "triggers" in wrangler.jsonc). Render's free plan puts the
  // API to sleep after 15 idle minutes and the first request then waits ~30-50 s for it to
  // wake; a light health check keeps it awake so the Assistant answers straight away.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(new URL('/health', env.BACKEND_URL), { headers: { 'User-Agent': 'toolbox-keepwarm' } }).catch(() => {}));
  },
};
