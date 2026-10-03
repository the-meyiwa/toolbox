# Toolbox as an app

Toolbox can be installed (home screen, Dock, Start menu) and then runs without browser bars. Everything
that depends on that reads it from `js/lib/web-app.js`.

| piece | where |
|---|---|
| Is this an installed app? (`display-mode`, iOS `navigator.standalone`, Android TWA) | `isWebApp()`; `html.webapp` is set before first paint by an inline script in `index.html` |
| Which device and browser? Which guide? | `detectEnvironment()`, `installTarget()` |
| The browser's own install prompt | `canPromptInstall()` / `promptInstall()` (Chrome, Edge, Samsung Internet on Android) |
| Manifest and icons | `public/manifest.webmanifest`, `public/icons/` (any, maskable, 180 px touch icon) |
| Banner on Home (plain tab only, snoozed for a week when closed) | `mountInstallBanner()` in `js/lib/install-app.js`; slot `#install-banner` above the footer |
| The panel, and Settings → General → App → Install Toolbox | `openInstallGuide()` |
| The animated guides (phone and computer, one per browser family) | `js/lib/install-guide.js`, styles in `css/install-app.css` |

## Guides

Phones: iPhone and iPad (Safari; Chrome, Edge and Firefox on iOS 16.4+ use the share sheet too), Android
(Chrome, Brave, Opera), Samsung Internet, Edge for Android, Firefox for Android, and an "open in your
browser" guide for in-app browsers (Instagram, Facebook…). Computers: Chrome and other Chromium browsers,
Edge, Safari on macOS Sonoma+ (Add to Dock), and Firefox (which cannot install; the guide says so and points
to a browser that can). Menu names change between versions; each caption gives the other name when there is
one. `tests/unit/install-app.test.js` checks that every step points at something its drawing really has.

## What changes only when installed (`html.webapp`)

* the Install banner and the Settings row go away;
* Home is centred in the window with equal room above and below (in a tab it hangs from the top with the
  banner under it);
* pull-to-refresh is switched off so a scroll cannot reload the app.

## Gestures and Back

* `js/lib/back-stack.js`: anything dismissable (Settings, the Assistant pop-up, the palette, the install
  panel) registers a closer. The edge swipe, Android Back and the browser's Back close the top one first.
  Each also holds one history entry so the system Back closes it instead of leaving the page.
* `js/lib/gestures.js`: swipe in from the left edge to go back (a round arrow follows the finger); swipe
  sideways between Home, Tools and Files. Settings → General → Swipe gestures turns both off.
* `leaveTool()` in `js/app.js`: leaving a tool goes back to where the person came from, or to Tools when the
  tool was opened directly. History entries are stamped with a depth for this.
* A web page cannot disable a phone's own edge swipe or home gesture. CSS removes what it can
  (`overscroll-behavior`, the double-tap delay, callouts, selecting the chrome); the page keeps its history
  in step so the system gesture and ours end in the same place.
