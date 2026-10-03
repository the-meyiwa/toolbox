/* ============================================================
   TOOLBOX — Web app mode

   Is Toolbox open in a plain browser tab, or installed and opened
   from the home screen, Dock or Start menu? Everything that
   depends on the answer reads it from here:

   - the Add to home screen banner on Home (only in a tab);
   - the install guide, which opens on the steps for this device;
   - the layout changes that only make sense without browser bars
     (`html.webapp`, set before first paint by an inline script in
     index.html and kept in step here).

   Pure apart from `window`/`navigator`: every function takes the
   environment it reads so tests can pass their own.
   ============================================================ */

const APP_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];

/** True when this page is running as an installed app rather than in a browser tab. */
export function isWebApp(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    if (win.navigator?.standalone === true) return true;                                  // iOS home screen
    if (typeof win.matchMedia === 'function' && APP_MODES.some(m => win.matchMedia(`(display-mode: ${m})`).matches)) return true;
    if (typeof win.document?.referrer === 'string' && win.document.referrer.startsWith('android-app://')) return true;   // Android TWA
  } catch { /* locked-down browsers */ }
  return false;
}

/**
 * What the person is using: { os, browser, mobile, tablet, inApp }.
 *   os       ios | ipados | android | macos | windows | linux | chromeos | other
 *   browser  safari | chrome | edge | firefox | samsung | opera | brave | duckduckgo | arc | other
 *   inApp    the page is inside another app's built-in browser (Instagram, Facebook…): it cannot install
 */
export function detectEnvironment(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const ua = String(nav.userAgent || '');
  const platform = String(nav.platform || '');
  const touch = Number(nav.maxTouchPoints || 0);
  let os = 'other';
  if (/iPhone|iPod/.test(ua)) os = 'ios';
  else if (/iPad/.test(ua) || (platform === 'MacIntel' && touch > 1)) os = 'ipados';     // iPadOS asks for the desktop site
  else if (/Android/.test(ua)) os = 'android';
  else if (/CrOS/.test(ua)) os = 'chromeos';
  else if (/Mac/.test(platform) || /Macintosh|Mac OS X/.test(ua)) os = 'macos';
  else if (/Win/.test(platform) || /Windows/.test(ua)) os = 'windows';
  else if (/Linux|X11/.test(ua) || /Linux/.test(platform)) os = 'linux';

  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest|GSA\//.test(ua);
  let browser = 'other';
  if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/DuckDuckGo/.test(ua)) browser = 'duckduckgo';
  else if (/EdgA|EdgiOS|Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\/|OPiOS|Opera/.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox/.test(ua)) browser = 'firefox';
  else if (nav.brave && typeof nav.brave.isBrave === 'function') browser = 'brave';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua) || /AppleWebKit/.test(ua)) browser = 'safari';

  const mobile = os === 'ios' || os === 'android';
  const tablet = os === 'ipados' || (os === 'android' && !/Mobile/.test(ua));
  return { os, browser, mobile: mobile || tablet, tablet, inApp, phone: mobile && !tablet };
}

/* ---------------- install guide selection ---------------- */

/**
 * Which guide fits this environment, and what the person can do about it.
 *   family  'phone' | 'computer'
 *   flow    the animated guide to open on (see install-guide.js)
 *   native  the browser can show its own install prompt (once it has offered one)
 *   blocked why this browser cannot install (Firefox on a computer, in-app browsers), or ''
 */
export function installTarget(env = detectEnvironment()) {
  const family = env.mobile ? 'phone' : 'computer';
  let flow;
  if (env.os === 'ios' || env.os === 'ipados') flow = 'ios';
  else if (env.os === 'android') flow = env.browser === 'samsung' ? 'samsung' : env.browser === 'firefox' ? 'firefox-android' : env.browser === 'edge' ? 'edge-android' : 'android';
  else if (env.os === 'macos' && env.browser === 'safari') flow = 'safari-mac';
  else if (env.browser === 'edge') flow = 'edge-desktop';
  else if (env.browser === 'firefox') flow = 'firefox-desktop';
  else flow = 'chrome-desktop';                                                    // Chrome, Brave, Opera, Vivaldi, Arc…

  let blocked = '';
  if (env.inApp) blocked = 'in-app';
  else if (flow === 'firefox-desktop') blocked = 'firefox';
  else if ((env.os === 'ios' || env.os === 'ipados') && env.browser === 'firefox') blocked = '';   // iOS 16.4+ allows it from the share sheet
  const native = ['android', 'edge-android', 'chrome-desktop', 'edge-desktop'].includes(flow) && !blocked;
  return { family, flow, native, blocked };
}

/* ---------------- native install prompt ---------------- */

let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

/** The browser's own install prompt, once it has offered one (Chrome, Edge, Samsung Internet on Android…). */
export const canPromptInstall = () => !!deferredPrompt;
export const onInstallStateChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Shows the browser's install prompt. Resolves to 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  const ev = deferredPrompt;
  if (!ev) return 'unavailable';
  deferredPrompt = null;
  emit();
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch { return 'unavailable'; }
}

/* ---------------- page state ---------------- */

function paint() {
  const root = document.documentElement;
  const app = isWebApp();
  root.classList.toggle('webapp', app);
  const env = detectEnvironment();
  root.dataset.os = env.os;
  return app;
}

/** Keeps `html.webapp` right (and `data-os` set), and listens for the browser's install events. */
export function installWebAppMode() {
  if (typeof window === 'undefined') return;
  paint();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; emit(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; paint(); emit(); window.dispatchEvent(new CustomEvent('toolbox:appinstalled')); });
  if (typeof window.matchMedia === 'function') {
    for (const m of APP_MODES) {
      const q = window.matchMedia(`(display-mode: ${m})`);
      (q.addEventListener ? q.addEventListener.bind(q, 'change') : q.addListener?.bind(q))?.(() => { paint(); emit(); });
    }
  }
}
