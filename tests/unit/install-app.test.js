import test from 'node:test';
import assert from 'node:assert/strict';
import { detectEnvironment, installTarget, isWebApp } from '../../js/lib/web-app.js';
import { GUIDES, guideFlows } from '../../js/lib/install-guide.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
  ipadDesktopSite: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  androidEdge: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.0.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  winOpera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
};
const env = (ua, platform = '', touch = 0) => detectEnvironment({ userAgent: ua, platform, maxTouchPoints: touch });
const flowOf = (ua, platform, touch) => installTarget(env(ua, platform, touch)).flow;

test('the device and browser are told apart', () => {
  assert.deepEqual([env(UA.iphoneSafari).os, env(UA.iphoneSafari).browser], ['ios', 'safari']);
  assert.deepEqual([env(UA.iphoneChrome).os, env(UA.iphoneChrome).browser], ['ios', 'chrome']);
  assert.equal(env(UA.iphoneFirefox).browser, 'firefox');
  const ipad = env(UA.ipadDesktopSite, 'MacIntel', 5);
  assert.equal(ipad.os, 'ipados', 'an iPad asking for the desktop site is still an iPad');
  assert.equal(ipad.mobile, true);
  assert.equal(env(UA.macSafari, 'MacIntel', 0).os, 'macos');
  assert.equal(env(UA.samsung).browser, 'samsung');
  assert.equal(env(UA.androidEdge).browser, 'edge');
  assert.equal(env(UA.winEdge, 'Win32').browser, 'edge');
  assert.equal(env(UA.winOpera, 'Win32').browser, 'opera');
  assert.equal(env(UA.instagram).inApp, true);
  assert.equal(env(UA.androidChrome).phone, true);
});

test('every device opens on its own steps', () => {
  assert.equal(flowOf(UA.iphoneSafari), 'ios');
  assert.equal(flowOf(UA.iphoneChrome), 'ios');
  assert.equal(flowOf(UA.ipadDesktopSite, 'MacIntel', 5), 'ios');
  assert.equal(flowOf(UA.androidChrome), 'android');
  assert.equal(flowOf(UA.samsung), 'samsung');
  assert.equal(flowOf(UA.androidFirefox), 'firefox-android');
  assert.equal(flowOf(UA.androidEdge), 'edge-android');
  assert.equal(flowOf(UA.macSafari, 'MacIntel'), 'safari-mac');
  assert.equal(flowOf(UA.macChrome, 'MacIntel'), 'chrome-desktop');
  assert.equal(flowOf(UA.winEdge, 'Win32'), 'edge-desktop');
  assert.equal(flowOf(UA.winFirefox, 'Win32'), 'firefox-desktop');
  assert.equal(flowOf(UA.winOpera, 'Win32'), 'chrome-desktop');
  assert.equal(installTarget(env(UA.iphoneSafari)).family, 'phone');
  assert.equal(installTarget(env(UA.macChrome, 'MacIntel')).family, 'computer');
});

test('browsers that cannot install say so', () => {
  assert.equal(installTarget(env(UA.winFirefox, 'Win32')).blocked, 'firefox');
  assert.equal(installTarget(env(UA.instagram)).blocked, 'in-app');
  assert.equal(installTarget(env(UA.iphoneFirefox)).blocked, '', 'Firefox on iOS 16.4+ installs from the share sheet');
  assert.equal(installTarget(env(UA.macChrome, 'MacIntel')).native, true);
  assert.equal(installTarget(env(UA.iphoneSafari)).native, false, 'iOS has no install prompt');
});

test('installed and in-a-tab are told apart', () => {
  const win = (over) => ({ navigator: {}, matchMedia: () => ({ matches: false }), document: { referrer: '' }, ...over });
  assert.equal(isWebApp(win()), false);
  assert.equal(isWebApp(win({ navigator: { standalone: true } })), true, 'iOS home screen');
  assert.equal(isWebApp(win({ matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) })), true, 'Chrome, Edge, Android');
  assert.equal(isWebApp(win({ matchMedia: (q) => ({ matches: q === '(display-mode: window-controls-overlay)' }) })), true);
  assert.equal(isWebApp(win({ document: { referrer: 'android-app://com.android.chrome' } })), true);
  assert.equal(isWebApp(null), false);
});

test('every guide is complete: each step points at something its drawing actually has', async () => {
  assert.ok(guideFlows('phone').length >= 5 && guideFlows('computer').length >= 4);
  for (const [id, flow] of Object.entries(GUIDES)) {
    const html = flow.mock();
    assert.ok(flow.steps.length >= 2, id);
    for (const step of flow.steps) {
      assert.ok(step.title && step.text, `${id}: a step needs words`);
      if (step.target) assert.ok(html.includes(`data-p="${step.target}"`), `${id}: target "${step.target}" is not drawn`);
      for (const layer of [...Object.keys(step.from || {}), ...Object.keys(step.end || {})]) assert.ok(html.includes(`data-layer="${layer}"`), `${id}: layer "${layer}" is not drawn`);
    }
    // Run every step against a recording director: each control it touches must exist in the drawing.
    const touched = [];
    const record = (name) => async (part) => { touched.push([name, part]); };
    const d = { wait: async () => {}, tap: record('tap'), ring: record('ring'), show: record('show'), hide: record('hide'), scroll: record('scroll') };
    for (const step of flow.steps) {
      touched.length = 0;
      await step.run(d);
      for (const [, part] of touched) assert.ok(html.includes(`data-p="${part}"`), `${id}: "${part}" is not drawn`);
    }
  }
});
