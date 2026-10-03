/* ============================================================
   TOOLBOX — Animated install guide

   Shows, on a drawn phone or computer, exactly what to tap or click
   to put Toolbox on the home screen, Dock or Start menu. A finger
   (or pointer) glides to each control, the control is ringed, the
   menu or sheet that really opens slides in, and the app icon lands
   on the home screen at the end. Each step loops with a caption; the
   steps advance on their own and can be tapped, paused and replayed.

   One flow per browser family, drawn from what each one really
   shows (menu names change between versions, so each caption also
   gives the other name when there is one):

     phones      ios (Safari, and Chrome/Edge/Firefox on iOS 16.4+),
                 android (Chrome, Brave, Opera…), samsung,
                 edge-android, firefox-android, inapp
     computers   chrome-desktop (Chrome, Brave, Opera, Vivaldi…),
                 edge-desktop, safari-mac (Add to Dock), firefox-desktop

   Motion is transform and opacity only, on the same easing as the
   rest of Toolbox, no overshoot. With reduced motion the guide
   shows each step's result, still, with the control ringed.
   ============================================================ */

const OUT = 'cubic-bezier(.22, 1, .36, 1)';
const CANCELLED = Symbol('cancelled');
const MARK_D = 'M4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM3 1h1v1h-1zM8 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM9 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM11 3h1v1h-1zM0 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM11 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM11 5h1v1h-1zM0 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM11 6h1v1h-1zM0 7h1v1h-1zM11 7h1v1h-1zM0 8h1v1h-1zM11 8h1v1h-1zM0 9h1v1h-1zM1 9h1v1h-1zM2 9h1v1h-1zM3 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM6 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1z';

const ic = (body, size = 16, sw = 1.8) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const I = {
  share: ic('<path d="M12 15V4"/><path d="m8 8 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>', 18),
  back: ic('<path d="m15 18-6-6 6-6"/>', 16),
  fwd: ic('<path d="m9 18 6-6-6-6"/>', 16),
  book: ic('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>', 17),
  tabs: ic('<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>', 17),
  dots: ic('<circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>', 17),
  dotsH: ic('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', 17),
  burger: ic('<path d="M4 7h16M4 12h16M4 17h16"/>', 18),
  lock: ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 11, 2),
  reload: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', 14),
  star: ic('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', 14),
  install: ic('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 8v5"/><path d="m9.5 11 2.5 2.5L14.5 11"/><path d="M8 20h8"/>', 15),
  plusBox: ic('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>', 16),
  check: ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 14, 2.2),
  chevR: ic('<path d="m9 6 6 6-6 6"/>', 12, 2),
  newTab: ic('<path d="M12 5v14M5 12h14"/>', 16),
  clock: ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', 16),
  download: ic('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>', 16),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>', 16),
  globe: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', 16),
  external: ic('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>', 16),
  wifi: ic('<path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>', 12),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>', 16),
};
const mark = (cls = '') => `<svg class="ia-mark ${cls}" viewBox="0 0 12 10" aria-hidden="true"><path d="${MARK_D}" fill="currentColor"/></svg>`;
const appIcon = (cls = '') => `<span class="ia-appicon ${cls}">${mark()}</span>`;
const host = () => { try { return (location.hostname || 'toolbox').replace(/^www\./, ''); } catch { return 'toolbox'; } };
const bar = (n) => Array.from({ length: n }, () => '<i></i>').join('');

/* The page behind everything: Toolbox, drawn as quiet shapes. */
const page = () => `<div class="ia-pg">
  <div class="ia-pg-head">${mark()}<b></b></div>
  <div class="ia-pg-title"><i></i><i></i></div>
  <div class="ia-pg-search"><u></u><span></span><em></em></div>
  <div class="ia-pg-chips"><i></i><i></i><i></i></div>
  <div class="ia-pg-card"><b></b><i></i><i></i></div>
</div>`;

/* A home screen with one empty place for the app to land. */
const homeScreen = (label = 'Toolbox') => {
  const tints = ['#7aa7d9', '#e0a96d', '#8cc7a1', '#c58bd0', '#d98a8a', '#9aa0e0', '#e0c46d', '#78b9c2', '#b3b3b3', '#a3c47a', '#d99a6c'];
  const cells = Array.from({ length: 11 }, (_, i) => `<div class="ia-cell"><span class="ia-ph" style="--t:${tints[i]}"></span><i></i></div>`);
  cells.splice(5, 0, `<div class="ia-cell ia-cell-app" data-p="appicon">${appIcon()}<em>${label}</em></div>`);
  return `<div class="ia-home-wall"></div><div class="ia-home-grid">${cells.join('')}</div><div class="ia-home-dock"><span class="ia-ph" style="--t:#7bd389"></span><span class="ia-ph" style="--t:#6fb1f2"></span><span class="ia-ph" style="--t:#f0a35e"></span><span class="ia-ph" style="--t:#a58cf0"></span></div>`;
};

/* The app, opened: no browser around it. */
const launched = (extra = '') => `<div class="ia-launch"><div class="ia-launch-bar"></div>${page()}${extra}</div>`;

const phoneShell = ({ top = '', bottom = '', layers = '', cls = '' }) => `
<div class="ia-device ia-phone ${cls}">
  <div class="ia-screen">
    <div class="ia-status"><span>9:41</span><span class="ia-island"></span><span class="ia-batt">${I.wifi}<i></i></span></div>
    ${top}
    <div class="ia-viewport" data-p="page">${page()}</div>
    ${bottom}
    ${layers}
  </div>
</div>`;

const layer = (name, inner = '', cls = '') => `<div class="ia-layer ${cls}" data-layer="${name}" data-p="${name}">${inner}</div>`;

const row = (label, icon = '', p = '', cls = '') => `<div class="ia-row ${cls}"${p ? ` data-p="${p}"` : ''}><span>${label}</span>${icon ? `<b>${icon}</b>` : ''}</div>`;

/* ---------------- phones ---------------- */

function iosMock(env = {}) {
  const dialog = `<div class="ia-ios-add">
      <div class="ia-ios-add-head"><span>Cancel</span><b>Add to Home Screen</b><span class="ia-ios-add-btn" data-p="add">Add</span></div>
      <div class="ia-ios-add-card"><div class="ia-ios-add-id">${appIcon('ia-lg')}<div><b>Toolbox</b><small>${host()}</small></div></div>
      <p>An icon will be added to your Home Screen so you can quickly access this website.</p></div>
      <div class="ia-ios-toggle" data-p="webtoggle"><span>Open as Web App</span><u class="ia-switch is-on"><i></i></u></div>
    </div>`;
  const sheet = `<div class="ia-grab"></div>
    <div class="ia-sheet-id">${appIcon()}<div><b>Toolbox</b><small>${host()}</small></div><span class="ia-pill">Options ${I.chevR}</span></div>
    <div class="ia-share-row"><div><u></u><small>AirDrop</small></div><div><u></u><small>Messages</small></div><div><u></u><small>Mail</small></div><div><u></u><small>Notes</small></div></div>
    <div class="ia-scroll" data-p="sheetlist"><div class="ia-scroll-in">
      ${row('Copy', I.book)}${row('Add to Reading List', I.book)}${row('Add Bookmark', I.book)}${row('Add to Favourites', I.star)}
      ${row('Add to Quick Note', I.plusBox)}${row('Find on Page', I.globe)}${row('Add to Home Screen', I.plusBox, 'addhome', 'ia-row-key')}${row('Markup', I.gear)}
    </div></div>`;
  return phoneShell({
    cls: 'ia-ios',
    bottom: `<div class="ia-ios-bottom"><div class="ia-urlpill"><span class="ia-aa">AA</span>${I.lock}<span>${host()}</span>${I.reload}</div>
      <div class="ia-ios-tools"><span>${I.back}</span><span>${I.fwd}</span><span data-p="share" class="ia-tool">${I.share}</span><span>${I.book}</span><span>${I.tabs}</span></div></div>`,
    layers: layer('dim', '', 'ia-dim') + layer('sheet', sheet, 'ia-sheet') + layer('addscreen', dialog, 'ia-ios-addwrap') + layer('home', homeScreen(), 'ia-home') + layer('app', launched(), 'ia-app'),
  });
}

function androidMock({ items, key, menuSide = 'top', dialogTitle = 'Install app?', dialogBtn = 'Install', confirmNote = '' }) {
  const list = items.map(l => row(l, '', l === key ? 'install' : '', l === key ? 'ia-row-key' : '')).join('');
  const top = `<div class="ia-and-top"><div class="ia-urlpill ia-flat">${I.lock}<span>${host()}</span></div><span class="ia-tabcount">1</span><span class="ia-tool" data-p="menu">${I.dots}</span></div>`;
  const dialog = `<div class="ia-and-dialog"><div class="ia-and-id">${appIcon('ia-lg')}<div><b>${dialogTitle}</b><small>Toolbox · ${host()}</small></div></div>${confirmNote ? `<p>${confirmNote}</p>` : ''}<div class="ia-and-btns"><span>Cancel</span><span class="ia-and-main" data-p="confirm">${dialogBtn}</span></div></div>`;
  return phoneShell({
    cls: 'ia-android', top,
    layers: layer('dim', '', 'ia-dim') + layer('menupop', `<div class="ia-pop-list">${list}</div>`, `ia-pop ia-pop-${menuSide}`) + layer('dialog', dialog, 'ia-dialog') + layer('home', homeScreen(), 'ia-home') + layer('app', launched(), 'ia-app'),
  });
}

function bottomMenuMock({ glyph = I.burger, menuTitle, grid, subTitle, subItems, subKey, subKeyP = 'homescreen', gridKey, dialogTitle, dialogBtn = 'Add', confirmNote = '' }) {
  const cells = grid.map(l => `<div class="ia-grid-cell${l === gridKey ? ' ia-grid-key' : ''}"${l === gridKey ? ' data-p="addpage"' : ''}><u></u><small>${l}</small></div>`).join('');
  const sub = subItems ? `<div class="ia-pop-list">${subItems.map(l => row(l, '', l === subKey ? subKeyP : '', l === subKey ? 'ia-row-key' : '')).join('')}</div>` : '';
  const dialog = `<div class="ia-and-dialog"><div class="ia-and-id">${appIcon('ia-lg')}<div><b>${dialogTitle}</b><small>Toolbox · ${host()}</small></div></div>${confirmNote ? `<p>${confirmNote}</p>` : ''}<div class="ia-and-btns"><span>Cancel</span><span class="ia-and-main" data-p="confirm">${dialogBtn}</span></div></div>`;
  return phoneShell({
    cls: 'ia-android ia-bottomnav',
    bottom: `<div class="ia-sam-bottom"><span>${I.back}</span><span>${I.fwd}</span><span class="ia-urlpill ia-flat">${I.lock}<span>${host()}</span></span><span>${I.tabs}</span><span class="ia-tool" data-p="menu">${glyph}</span></div>`,
    layers: layer('dim', '', 'ia-dim') + layer('menugrid', `<div class="ia-grab"></div><div class="ia-grid">${cells}</div>`, 'ia-sheet ia-sheet-grid')
      + (subItems ? layer('submenu', `<div class="ia-grab"></div>${sub}`, 'ia-sheet ia-sheet-sub') : '')
      + layer('dialog', dialog, 'ia-dialog') + layer('home', homeScreen(), 'ia-home') + layer('app', launched(), 'ia-app'),
  });
}

function inAppMock() {
  const top = `<div class="ia-and-top"><div class="ia-urlpill ia-flat">${I.lock}<span>${host()}</span></div><span class="ia-tool" data-p="menu">${I.dotsH}</span></div>`;
  const list = [row('Copy link', I.book), row('Share', I.share), row('Open in browser', I.external, 'openbrowser', 'ia-row-key'), row('Report', I.gear)].join('');
  return phoneShell({ cls: 'ia-android', top, layers: layer('dim', '', 'ia-dim') + layer('menupop', `<div class="ia-pop-list">${list}</div>`, 'ia-pop ia-pop-top') + layer('app', launched(), 'ia-app') });
}

/* ---------------- computers ---------------- */

const winControls = (os) => os === 'mac'
  ? '<div class="ia-lights"><i></i><i></i><i></i></div>'
  : '<div class="ia-winctl"><i></i><i></i><i></i></div>';

function desktopShell({ os = 'mac', toolbar = '', menubar = '', layers = '', dock = '', cls = '' }) {
  return `<div class="ia-device ia-desk ia-os-${os} ${cls}">
    <div class="ia-screen">
      <div class="ia-wall"></div>
      ${menubar}
      <div class="ia-win" data-p="win">
        <div class="ia-titlebar">${winControls(os)}<div class="ia-btab">${mark()}<span>Toolbox</span><b>${I.x}</b></div><span class="ia-newtab">${I.newTab}</span></div>
        <div class="ia-toolbar">${toolbar}</div>
        <div class="ia-viewport" data-p="page">${page()}</div>
      </div>
      ${layers}
      ${dock}
    </div>
  </div>`;
}

const appWindow = (os) => layer('appwin', `<div class="ia-titlebar ia-app-title">${winControls(os)}<span>Toolbox</span></div><div class="ia-viewport">${page()}</div>`, 'ia-appwin');
const dockBar = (os) => os === 'mac'
  ? `<div class="ia-dock"><span class="ia-ph" style="--t:#6fb1f2"></span><span class="ia-ph" style="--t:#f0a35e"></span><span class="ia-ph" style="--t:#7bd389"></span><span class="ia-dock-app" data-p="appicon">${appIcon()}</span></div>`
  : `<div class="ia-taskbar"><span class="ia-ph" style="--t:#6fb1f2"></span><span class="ia-ph" style="--t:#f0a35e"></span><span class="ia-dock-app" data-p="appicon">${appIcon()}</span></div>`;

function chromeDesktopMock(os, edge = false) {
  const toolbar = `<span class="ia-tool">${I.back}</span><span class="ia-tool">${I.fwd}</span><span class="ia-tool">${I.reload}</span>
    <div class="ia-urlpill ia-wide">${I.lock}<span>${host()}</span><span class="ia-pill-gap"></span>${edge ? '' : `<span class="ia-tool ia-installicon" data-p="installicon">${I.install}</span>`}<span class="ia-tool">${I.star}</span></div>
    <span class="ia-tool" data-p="menu">${edge ? I.dotsH : I.dots}</span>`;
  const chromeItems = [row('New tab'), row('New window'), row('History'), row('Downloads'), row('Save and share', I.chevR, 'saveshare'), row('Settings')].join('');
  const edgeItems = [row('New tab'), row('New window'), row('History'), row('Apps', I.chevR, 'apps', 'ia-row-key'), row('Downloads'), row('Settings')].join('');
  const sub = edge
    ? `<div class="ia-pop-list">${row('Install this site as an app', '', 'install', 'ia-row-key')}${row('Manage apps')}${row('Open Apps page')}</div>`
    : `<div class="ia-pop-list">${row('Save page as…')}${row('Install page as app…', '', 'install', 'ia-row-key')}${row('Create shortcut…')}${row('Cast…')}</div>`;
  const prompt = `<div class="ia-prompt"><div class="ia-prompt-id">${appIcon('ia-lg')}<div><b>Install app?</b><small>Toolbox · ${host()}</small></div></div><div class="ia-prompt-btns"><span>Cancel</span><span class="ia-and-main" data-p="confirm">Install</span></div></div>`;
  return desktopShell({
    os, toolbar,
    layers: layer('menupop', `<div class="ia-pop-list">${edge ? edgeItems : chromeItems}</div>`, 'ia-pop ia-pop-desk')
      + layer('submenu', sub, 'ia-pop ia-pop-desk ia-pop-sub') + layer('dialog', prompt, 'ia-pop ia-pop-prompt') + appWindow(os),
    dock: dockBar(os),
  });
}

function safariMacMock() {
  const toolbar = `<span class="ia-tool">${I.back}</span><span class="ia-tool">${I.fwd}</span><div class="ia-urlpill ia-wide ia-center">${I.lock}<span>${host()}</span>${I.reload}</div><span class="ia-tool" data-p="share">${I.share}</span><span class="ia-tool">${I.tabs}</span>`;
  const menubar = `<div class="ia-menubar"><b></b><span>Safari</span><span data-p="filemenu" class="ia-mb-file">File</span><span>Edit</span><span>View</span><span>History</span><span>Bookmarks</span></div>`;
  const file = [row('New Window'), row('New Tab'), row('Open Location…'), row('Close Window'), row('Add to Dock…', '', 'adddock', 'ia-row-key'), row('Share')].join('');
  const dialog = `<div class="ia-prompt"><div class="ia-prompt-id">${appIcon('ia-lg')}<div><b>Add to Dock</b><small>Toolbox · ${host()}</small></div></div><p>Open this website like an app from your Dock.</p><div class="ia-prompt-btns"><span>Cancel</span><span class="ia-and-main" data-p="add">Add</span></div></div>`;
  return desktopShell({
    os: 'mac', toolbar, menubar, cls: 'ia-safari',
    layers: layer('menupop', `<div class="ia-pop-list">${file}</div>`, 'ia-pop ia-pop-file') + layer('dialog', dialog, 'ia-pop ia-pop-prompt ia-mac-add') + appWindow('mac'),
    dock: dockBar('mac'),
  });
}

function firefoxDesktopMock() {
  const toolbar = `<span class="ia-tool">${I.back}</span><span class="ia-tool">${I.fwd}</span><span class="ia-tool">${I.reload}</span><div class="ia-urlpill ia-wide">${I.lock}<span>${host()}</span></div><span class="ia-tool">${I.burger}</span>`;
  const browsers = ['Chrome', 'Edge', 'Safari'].map((b, i) => `<div class="ia-bro" data-p="bro${i}"><u>${b[0]}</u><small>${b}</small></div>`).join('');
  return desktopShell({
    os: 'mac', toolbar, cls: 'ia-ff',
    layers: layer('nope', `<div class="ia-nope"><b>${I.x}</b><span>Firefox can’t install web apps on computers</span></div>`, 'ia-pop ia-pop-prompt ia-pop-nope') + layer('browsers', `<div class="ia-bros">${browsers}</div>`, 'ia-pop ia-pop-prompt ia-pop-bros') + appWindow('mac'),
    dock: dockBar('mac'),
  });
}

/* ---------------- flows ---------------- */

const none = {};
const flows = {
  ios: {
    family: 'phone', label: 'iPhone & iPad', note: 'Safari, and Chrome, Edge or Firefox on iOS 16.4 and later',
    mock: iosMock,
    steps: [
      { title: 'Tap the Share button', text: 'It is in the bar at the bottom of Safari (top right on iPad). In Chrome or Edge it sits in the address bar.', target: 'share', from: none, end: { dim: 1, sheet: 1 },
        async run(d) { await d.tap('share'); d.show('dim', 'fade'); await d.show('sheet', 'sheet'); } },
      { title: 'Choose “Add to Home Screen”', text: 'Scroll the list of actions until you see it.', target: 'addhome', from: { dim: 1, sheet: 1 }, end: { dim: 1, addscreen: 1 },
        async run(d) { await d.wait(300); await d.scroll('sheetlist', 74); await d.tap('addhome'); await d.hide('sheet', 'sheet'); await d.show('addscreen', 'dialog'); } },
      { title: 'Keep “Open as Web App” on, then tap Add', text: 'That is what makes Toolbox open full screen, without Safari around it.', target: 'add', from: { dim: 1, addscreen: 1 }, end: { home: 1 },
        async run(d) { await d.wait(250); await d.ring('webtoggle'); await d.wait(500); await d.tap('add'); await d.hide('addscreen', 'fade'); d.hide('dim', 'fade'); await d.show('home', 'fade'); await d.show('appicon', 'icon'); } },
      { title: 'Open Toolbox from your home screen', text: 'It now has its own icon and opens like any other app.', target: 'appicon', from: { home: 1 }, end: { home: 1, app: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.show('app', 'launch'); } },
    ],
  },
  android: {
    family: 'phone', label: 'Android', note: 'Chrome, Brave, Opera and most other browsers',
    mock: () => androidMock({ items: ['New tab', 'New Incognito tab', 'History', 'Downloads', 'Bookmarks', 'Install app', 'Share…', 'Settings'], key: 'Install app', confirmNote: '' }),
    steps: [
      { title: 'Open the browser menu', text: 'Tap the three dots at the top right.', target: 'menu', from: none, end: { menupop: 1 },
        async run(d) { await d.tap('menu'); await d.show('menupop', 'pop'); } },
      { title: 'Tap “Install app”', text: 'If you see “Add to Home screen” instead, choose that, then Install.', target: 'install', from: { menupop: 1 }, end: { dim: 1, dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('install'); await d.hide('menupop', 'pop'); d.show('dim', 'fade'); await d.show('dialog', 'dialog'); } },
      { title: 'Confirm with Install', text: 'Toolbox is added to your home screen and app drawer.', target: 'confirm', from: { dim: 1, dialog: 1 }, end: { home: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'fade'); d.hide('dim', 'fade'); await d.show('home', 'fade'); await d.show('appicon', 'icon'); } },
      { title: 'Open Toolbox like any app', text: 'It opens full screen with no address bar.', target: 'appicon', from: { home: 1 }, end: { home: 1, app: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.show('app', 'launch'); } },
    ],
  },
  'firefox-android': {
    family: 'phone', label: 'Firefox', note: 'Firefox for Android',
    mock: () => androidMock({ items: ['New tab', 'New private tab', 'History', 'Downloads', 'Bookmarks', 'Install', 'Share', 'Settings'], key: 'Install', dialogTitle: 'Add to Home screen', dialogBtn: 'Add' }),
    steps: [
      { title: 'Open the Firefox menu', text: 'Tap the three dots next to the address bar.', target: 'menu', from: none, end: { menupop: 1 },
        async run(d) { await d.tap('menu'); await d.show('menupop', 'pop'); } },
      { title: 'Tap “Install”', text: 'If it says “Add to Home screen”, choose that instead.', target: 'install', from: { menupop: 1 }, end: { dim: 1, dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('install'); await d.hide('menupop', 'pop'); d.show('dim', 'fade'); await d.show('dialog', 'dialog'); } },
      { title: 'Tap Add', text: 'Toolbox lands on your home screen.', target: 'confirm', from: { dim: 1, dialog: 1 }, end: { home: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'fade'); d.hide('dim', 'fade'); await d.show('home', 'fade'); await d.show('appicon', 'icon'); } },
      { title: 'Open it from your home screen', text: 'It opens in its own window.', target: 'appicon', from: { home: 1 }, end: { home: 1, app: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.show('app', 'launch'); } },
    ],
  },
  samsung: {
    family: 'phone', label: 'Samsung Internet', note: 'Samsung Galaxy phones and tablets',
    mock: () => bottomMenuMock({ menuTitle: 'Menu', grid: ['Downloads', 'History', 'Add page to', 'Settings', 'Share', 'Print'], gridKey: 'Add page to', subTitle: 'Add page to', subItems: ['Quick access', 'Bookmarks', 'Home screen', 'Saved pages'], subKey: 'Home screen', dialogTitle: 'Add to Home screen', dialogBtn: 'Add' }),
    steps: [
      { title: 'Open the menu', text: 'Tap the three lines at the bottom right.', target: 'menu', from: none, end: { dim: 1, menugrid: 1 },
        async run(d) { await d.tap('menu'); d.show('dim', 'fade'); await d.show('menugrid', 'sheet'); } },
      { title: 'Tap “Add page to”', text: 'You may need to swipe the menu to find it.', target: 'addpage', from: { dim: 1, menugrid: 1 }, end: { dim: 1, submenu: 1 },
        async run(d) { await d.wait(250); await d.tap('addpage'); await d.hide('menugrid', 'sheet'); await d.show('submenu', 'sheet'); } },
      { title: 'Choose “Home screen”', text: 'Then confirm the name and tap Add.', target: 'homescreen', from: { dim: 1, submenu: 1 }, end: { dim: 1, dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('homescreen'); await d.hide('submenu', 'sheet'); await d.show('dialog', 'dialog'); } },
      { title: 'Tap Add', text: 'Toolbox is on your home screen.', target: 'confirm', from: { dim: 1, dialog: 1 }, end: { home: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'fade'); d.hide('dim', 'fade'); await d.show('home', 'fade'); await d.show('appicon', 'icon'); } },
      { title: 'Open it like an app', text: 'It opens full screen.', target: 'appicon', from: { home: 1 }, end: { home: 1, app: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.show('app', 'launch'); } },
    ],
  },
  'edge-android': {
    family: 'phone', label: 'Edge', note: 'Microsoft Edge for Android',
    mock: () => bottomMenuMock({ glyph: I.dotsH, menuTitle: 'Menu', grid: ['Downloads', 'History', 'Add to phone', 'Settings', 'Share', 'Print'], gridKey: 'Add to phone', dialogTitle: 'Add to phone', dialogBtn: 'Add' }),
    steps: [
      { title: 'Open the menu', text: 'Tap the three dots at the bottom of the screen.', target: 'menu', from: none, end: { dim: 1, menugrid: 1 },
        async run(d) { await d.tap('menu'); d.show('dim', 'fade'); await d.show('menugrid', 'sheet'); } },
      { title: 'Tap “Add to phone”', text: 'It may also be called “Add to Home screen”.', target: 'addpage', from: { dim: 1, menugrid: 1 }, end: { dim: 1, dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('addpage'); await d.hide('menugrid', 'sheet'); await d.show('dialog', 'dialog'); } },
      { title: 'Tap Add', text: 'Toolbox lands on your home screen.', target: 'confirm', from: { dim: 1, dialog: 1 }, end: { home: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'fade'); d.hide('dim', 'fade'); await d.show('home', 'fade'); await d.show('appicon', 'icon'); } },
      { title: 'Open it like an app', text: 'It opens full screen.', target: 'appicon', from: { home: 1 }, end: { home: 1, app: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.show('app', 'launch'); } },
    ],
  },
  inapp: {
    family: 'phone', label: 'Open in your browser', note: 'Links opened inside Instagram, Facebook and similar apps',
    mock: inAppMock,
    steps: [
      { title: 'Open the app’s menu', text: 'This page is inside another app, which cannot install websites. Tap its menu, usually three dots.', target: 'menu', from: none, end: { menupop: 1 },
        async run(d) { await d.tap('menu'); await d.show('menupop', 'pop'); } },
      { title: 'Choose “Open in browser”', text: 'Then follow the steps for your browser.', target: 'openbrowser', from: { menupop: 1 }, end: { app: 1 },
        async run(d) { await d.wait(250); await d.tap('openbrowser'); await d.hide('menupop', 'pop'); await d.show('app', 'launch'); } },
    ],
  },
  'chrome-desktop': {
    family: 'computer', label: 'Chrome', note: 'Chrome, Brave, Opera, Vivaldi and other Chromium browsers',
    mock: () => chromeDesktopMock('mac'),
    steps: [
      { title: 'Click the install icon', text: 'It sits at the right end of the address bar. No icon? Open ⋮ → Save and share → Install page as app….', target: 'installicon', from: none, end: { dialog: 1 },
        async run(d) { await d.ring('installicon'); await d.wait(450); await d.tap('installicon'); await d.show('dialog', 'pop'); } },
      { title: 'Click Install', text: 'Toolbox gets its own window.', target: 'confirm', from: { dialog: 1 }, end: { appwin: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'pop'); await d.show('appwin', 'win'); await d.show('appicon', 'icon'); } },
      { title: 'Open it from your Dock or Start menu', text: 'Pin it to the Dock or taskbar to keep it one click away.', target: 'appicon', from: { appwin: 1 }, end: { appwin: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.ring('appicon'); } },
    ],
  },
  'edge-desktop': {
    family: 'computer', label: 'Edge', note: 'Microsoft Edge on Windows and Mac',
    mock: () => chromeDesktopMock('win', true),
    steps: [
      { title: 'Open the menu', text: 'Click the three dots at the top right. (You may also see an “App available” icon in the address bar.)', target: 'menu', from: none, end: { menupop: 1 },
        async run(d) { await d.tap('menu'); await d.show('menupop', 'pop'); } },
      { title: 'Choose Apps', text: 'It opens a short list to the side.', target: 'apps', from: { menupop: 1 }, end: { menupop: 1, submenu: 1 },
        async run(d) { await d.wait(250); await d.tap('apps'); await d.show('submenu', 'pop'); } },
      { title: 'Click “Install this site as an app”', text: 'Then confirm with Install.', target: 'install', from: { menupop: 1, submenu: 1 }, end: { dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('install'); await d.hide('submenu', 'pop'); await d.hide('menupop', 'pop'); await d.show('dialog', 'pop'); } },
      { title: 'Click Install', text: 'Toolbox opens in its own window, with a Start menu and taskbar icon.', target: 'confirm', from: { dialog: 1 }, end: { appwin: 1 },
        async run(d) { await d.wait(250); await d.tap('confirm'); await d.hide('dialog', 'pop'); await d.show('appwin', 'win'); await d.show('appicon', 'icon'); } },
    ],
  },
  'safari-mac': {
    family: 'computer', label: 'Safari', note: 'Safari 17 or later on macOS Sonoma or later',
    mock: safariMacMock,
    steps: [
      { title: 'Open the File menu', text: 'Or click the Share button in the toolbar, which has the same option.', target: 'filemenu', from: none, end: { menupop: 1 },
        async run(d) { await d.tap('filemenu'); await d.show('menupop', 'pop'); } },
      { title: 'Choose “Add to Dock…”', text: 'Safari remembers the name and icon.', target: 'adddock', from: { menupop: 1 }, end: { dialog: 1 },
        async run(d) { await d.wait(250); await d.tap('adddock'); await d.hide('menupop', 'pop'); await d.show('dialog', 'pop'); } },
      { title: 'Click Add', text: 'Toolbox appears in your Dock.', target: 'add', from: { dialog: 1 }, end: { appwin: 1 },
        async run(d) { await d.wait(250); await d.tap('add'); await d.hide('dialog', 'pop'); await d.show('appicon', 'icon'); await d.show('appwin', 'win'); } },
      { title: 'Open it from the Dock', text: 'It opens in its own window, without Safari’s toolbar.', target: 'appicon', from: { appwin: 1 }, end: { appwin: 1 },
        async run(d) { await d.wait(300); await d.tap('appicon'); await d.ring('appicon'); } },
    ],
  },
  'firefox-desktop': {
    family: 'computer', label: 'Firefox', note: 'Firefox on Windows, Mac and Linux',
    mock: firefoxDesktopMock,
    steps: [
      { title: 'Firefox cannot install web apps', text: 'On computers, Firefox has no install option for websites.', target: 'nope', from: none, end: { nope: 1 },
        async run(d) { await d.show('nope', 'pop'); } },
      { title: 'Open Toolbox in Chrome, Edge or Safari', text: 'Copy the address and paste it there. The steps for each are one tab over.', target: 'bro1', from: none, end: { browsers: 1 },
        async run(d) { await d.show('browsers', 'pop'); await d.wait(300); await d.ring('bro0'); await d.wait(300); await d.ring('bro1'); await d.wait(300); await d.ring('bro2'); } },
    ],
  },
};

export const GUIDES = flows;
export const guideFlows = (family) => Object.entries(flows).filter(([, f]) => f.family === family).map(([id, f]) => ({ id, label: f.label, note: f.note }));

/* ---------------- the director ---------------- */

class Director {
  constructor(stage, reduced) {
    this.stage = stage;
    this.reduced = reduced;
    this.run = 0;
    this.live = new Set();
    this.finger = stage.querySelector('.ia-finger');
    this.at = null;
  }
  p(name) { return this.stage.querySelector(`[data-p="${name}"]`); }
  cancel() {
    this.run++;
    for (const a of this.live) { try { a.cancel(); } catch { /* done */ } }
    this.live.clear();
    this.stage.querySelectorAll('.ia-ripple, .ia-ring').forEach(n => n.remove());
  }
  check(id) { if (id !== this.run) throw CANCELLED; }
  animate(el, keyframes, options) {
    if (!el || this.reduced || typeof el.animate !== 'function') return Promise.resolve();
    const a = el.animate(keyframes, { fill: 'both', ...options });
    this.live.add(a);
    return a.finished.catch(() => {}).then(() => { this.live.delete(a); });
  }
  async wait(ms) {
    const id = this.run;
    if (this.reduced) return;
    await new Promise(r => setTimeout(r, ms));
    this.check(id);
  }
  /** Instantly shows exactly these layers (and the app icon, when the home screen is up). */
  set(on = {}) {
    for (const el of this.stage.querySelectorAll('[data-layer]')) {
      el.classList.toggle('is-on', !!on[el.dataset.layer]);
      el.getAnimations?.().forEach(a => a.cancel());
      el.style.opacity = ''; el.style.transform = '';
    }
    const icon = this.p('appicon');
    if (icon) {
      icon.getAnimations?.().forEach(a => a.cancel());
      const placed = !!(on.home || on.appwin || on.app);
      icon.classList.toggle('is-away', !placed);
    }
    this.p('sheetlist')?.firstElementChild && (this.p('sheetlist').firstElementChild.style.transform = '');
    this.stage.classList.toggle('has-pointer', false);
    if (this.finger) { this.finger.getAnimations?.().forEach(a => a.cancel()); this.finger.style.opacity = '0'; this.at = null; }
  }
  rel(el) {
    const s = this.stage.getBoundingClientRect(); const r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, w: r.width, h: r.height, l: r.left - s.left, t: r.top - s.top };
  }
  async ring(name) {
    const id = this.run; const el = this.p(name);
    if (!el) return;
    const r = this.rel(el);
    const ring = document.createElement('i');
    ring.className = 'ia-ring';
    ring.style.cssText = `left:${r.l - 4}px;top:${r.t - 4}px;width:${r.w + 8}px;height:${r.h + 8}px`;
    this.stage.appendChild(ring);
    if (this.reduced) { ring.style.opacity = '.9'; return; }
    await this.animate(ring, [{ opacity: 0, transform: 'scale(1.18)' }, { opacity: 1, transform: 'scale(1)', offset: .4 }, { opacity: 1, transform: 'scale(1)', offset: .75 }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 760, easing: OUT });
    ring.remove();
    this.check(id);
  }
  async tap(name) {
    const id = this.run; const el = this.p(name);
    if (!el) return;
    if (this.reduced) { this.ring(name); return; }
    const r = this.rel(el);
    const f = this.finger;
    const from = this.at || { x: r.x + 46, y: r.y + 70 };
    f.style.opacity = '1';
    // glide in, ring the target as the finger arrives
    this.animate(f, [{ transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: this.at ? 1 : 0 }, { transform: `translate(${r.x}px, ${r.y}px) scale(1)`, opacity: 1 }], { duration: this.at ? 620 : 520, easing: OUT });
    await this.wait(this.at ? 480 : 380);
    this.ring(name);
    await this.wait(240);
    // press and release
    const ripple = document.createElement('i');
    ripple.className = 'ia-ripple';
    ripple.style.cssText = `left:${r.x}px;top:${r.y}px`;
    this.stage.appendChild(ripple);
    this.animate(ripple, [{ transform: 'translate(-50%, -50%) scale(.3)', opacity: .5 }, { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 }], { duration: 560, easing: OUT }).then(() => ripple.remove());
    await this.animate(f, [{ transform: `translate(${r.x}px, ${r.y}px) scale(1)` }, { transform: `translate(${r.x}px, ${r.y}px) scale(.78)`, offset: .4 }, { transform: `translate(${r.x}px, ${r.y}px) scale(1)` }], { duration: 300, easing: OUT });
    this.at = { x: r.x, y: r.y };
    this.check(id);
  }
  async scroll(name, dy) {
    const id = this.run; const el = this.p(name)?.firstElementChild;
    if (!el) return;
    await this.animate(el, [{ transform: 'translateY(0)' }, { transform: `translateY(${-dy}px)` }], { duration: 620, easing: OUT });
    this.check(id);
  }
  async show(name, how = 'fade') {
    const id = this.run; const el = this.p(name);
    if (!el) return;
    el.classList.remove('is-away');
    el.classList.add('is-on');
    const k = {
      fade: [{ opacity: 0 }, { opacity: 1 }],
      sheet: [{ transform: 'translateY(104%)' }, { transform: 'translateY(0)' }],
      pop: [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }],
      dialog: [{ opacity: 0, transform: 'translate(-50%, calc(-50% + 12px)) scale(.97)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }],
      icon: [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }],
      win: [{ opacity: 0, transform: 'translateY(14px) scale(.93)' }, { opacity: 1, transform: 'none' }],
      launch: [{ opacity: 0, transform: 'scale(.55)', borderRadius: '24px' }, { opacity: 1, transform: 'scale(1)', borderRadius: '0px' }],
    }[how] || [{ opacity: 0 }, { opacity: 1 }];
    const ms = { fade: 320, sheet: 520, pop: 280, dialog: 340, icon: 560, win: 560, launch: 520 }[how] || 320;
    await this.animate(el, k, { duration: ms, easing: OUT });
    this.check(id);
    el.getAnimations?.().forEach(a => a.cancel());
  }
  async hide(name, how = 'fade') {
    const id = this.run; const el = this.p(name);
    if (!el || !el.classList.contains('is-on')) return;
    const k = {
      fade: [{ opacity: 1 }, { opacity: 0 }],
      sheet: [{ transform: 'translateY(0)' }, { transform: 'translateY(104%)' }],
      pop: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }],
    }[how] || [{ opacity: 1 }, { opacity: 0 }];
    await this.animate(el, k, { duration: 240, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    this.check(id);
    el.classList.remove('is-on');
    el.getAnimations?.().forEach(a => a.cancel());
  }
}

/* ---------------- mounting ---------------- */

const prefersReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/**
 * Draws the guide for `flowId` into `host`.
 * Returns { destroy(), go(i), play(), pause(), get index }. `onStep(i, step)` fires as the step changes.
 */
export function mountGuide(hostEl, flowId, { onStep } = {}) {
  const flow = flows[flowId] || flows.android;
  const reduced = prefersReduced();
  hostEl.innerHTML = `
    <div class="ia-guide" data-family="${flow.family}" data-flow="${flowId}">
      <div class="ia-stage" aria-hidden="true">${flow.mock()}<i class="ia-finger"></i></div>
      <div class="ia-cap" aria-live="polite"><span class="ia-cap-n"></span><h4></h4><p></p></div>
      <div class="ia-ctl">
        <button type="button" class="ia-ctl-btn" data-ctl="prev" aria-label="Previous step">${I.back}</button>
        <div class="ia-dots" role="group" aria-label="Steps">${flow.steps.map((s, i) => `<button type="button" class="ia-dot" data-i="${i}" aria-label="Step ${i + 1}: ${s.title.replace(/"/g, '')}"><i></i></button>`).join('')}</div>
        <button type="button" class="ia-ctl-btn" data-ctl="next" aria-label="Next step">${I.fwd}</button>
        <button type="button" class="ia-ctl-btn ia-ctl-play" data-ctl="play" aria-label="Pause"><svg class="ia-i-pause" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="ia-i-play" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
      </div>
    </div>`;
  const stage = hostEl.querySelector('.ia-stage');
  const cap = hostEl.querySelector('.ia-cap');
  const dots = [...hostEl.querySelectorAll('.ia-dot')];
  const playBtn = hostEl.querySelector('[data-ctl="play"]');
  const director = new Director(stage, reduced);
  let index = 0; let paused = reduced; let dead = false; let token = 0;

  const paintCaption = (i, animate) => {
    const s = flow.steps[i];
    cap.querySelector('.ia-cap-n').textContent = `Step ${i + 1} of ${flow.steps.length}`;
    cap.querySelector('h4').textContent = s.title;
    cap.querySelector('p').textContent = s.text;
    dots.forEach((d, n) => { d.classList.toggle('is-done', n < i); d.classList.toggle('is-now', n === i); d.setAttribute('aria-current', n === i ? 'step' : 'false'); });
    if (animate && !reduced && cap.animate) cap.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: OUT });
    onStep?.(i, s);
  };
  const paintPlay = () => { playBtn.classList.toggle('is-paused', paused); playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause'); };

  async function playStep(i) {
    const my = ++token;
    director.cancel();
    index = ((i % flow.steps.length) + flow.steps.length) % flow.steps.length;
    const step = flow.steps[index];
    paintCaption(index, true);
    director.set(step.from);
    // the dot fills over the length of the step
    dots.forEach(d => d.style.removeProperty('--fill'));
    if (reduced) {
      director.set(step.end || step.from);
      if (step.target) director.ring(step.target);
      return;
    }
    try {
      await director.wait(420);
      await step.run(director);
      await director.wait(step === flow.steps[flow.steps.length - 1] ? 2600 : 1100);
    } catch (e) { if (e === CANCELLED) return; throw e; }
    if (dead || my !== token || paused) return;
    playStep(index + 1);
  }

  hostEl.querySelector('.ia-ctl').addEventListener('click', (e) => {
    const dot = e.target.closest('.ia-dot');
    const btn = e.target.closest('[data-ctl]');
    if (dot) { playStep(+dot.dataset.i); return; }
    if (!btn) return;
    const k = btn.dataset.ctl;
    if (k === 'prev') playStep(index - 1);
    else if (k === 'next') playStep(index + 1);
    else if (k === 'play') { paused = !paused; paintPlay(); if (!paused) playStep(index); }
  });
  // Tapping the drawing replays the current step.
  stage.addEventListener('click', () => playStep(index));
  paintPlay();
  playStep(0);

  return {
    get index() { return index; },
    go: (i) => playStep(i),
    play() { paused = false; paintPlay(); playStep(index); },
    pause() { paused = true; paintPlay(); },
    destroy() { dead = true; token++; director.cancel(); hostEl.innerHTML = ''; },
  };
}
