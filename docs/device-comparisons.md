# Tech Device Comparisons

The built-in database (`js/lib/devices/`) holds about 2,000 devices in 22 categories. They are grouped in the picker as follows:

| Group | Categories |
| --- | --- |
| Phones & computers | Phones, tablets, laptops, TVs, monitors, smartwatches, consoles |
| Chips & graphics | Mobile chips, processors and graphics cards. Processors and graphics cards go back to 2007–2009: Core 2, Sandy Bridge, FX, Ryzen 1000–3000, GTX 480–1080 Ti, Titan, HD 5870, R9 and RX 400–5700 |
| Audio | Headphones and earbuds, Bluetooth speakers |
| Charging | Chargers and cables, power banks and portable power stations |
| Office & home | Printers, photocopiers, coffee makers |
| Backup power | Solar inverters, UPS units |
| Music gear | Electric guitars, keyboards and digital pianos |
| Vehicles | Electric cars from Chinese and global brands |

## How the data is organised

- **Schema.** Each category lists its fields once in `schema.js`. Every field has a unit and a direction, meaning whether higher or lower is better. Some categories also have a `note`, which is shown under comparisons and rankings.
- **Data files.** The devices live in `data/<category>.js`. Additions to the original categories are kept in separate files, which the loaders in `db.js` merge: `cpus-legacy.js`, `gpus-legacy.js`, `socs-more.js` and `audio-more.js`.
- **Scoring.** `SCORES` in `db.js` defines each category's sub-scores. The new categories are scored on their features, not on how they feel to use. For example, guitars are judged on versatility, playability and hardware, not tone.
- **Prices.** They are US list prices. Electric cars not sold in the US use the home-market price, converted to US dollars. Photocopiers have no price, because they are sold through dealers.
- **Electric-car range.** EPA, WLTP and CLTC figures are not comparable. The range score converts all three to an EPA-like figure: WLTP × 0.88, CLTC × 0.75.
- **Tests.** `tests/unit/device-database.test.js` checks that:
  - every value matches its field type;
  - ids are unique within a category;
  - every category scores its devices and produces verdicts.

The Assistant's `device_specs` and `device_compare` tools cover every category.

## Choosing a category and switching views

The top of the tool is one **Comparison category** control showing the current category and its group. Clicking it slides a navigator out to the right (the view tabs slide away and blur): first the eight groups, each with its categories' glyphs and device count, then — sliding on — that group's categories, with a back chip. Picking one closes the navigator, swaps the label with a small slide, and loads the category. Escape or a click outside closes it; ← → Home End move between chips, Backspace goes back to the groups. On phones the navigator opens downwards under the control. (`openNav` / `showPane` / `closeNav` in `js/tools/tech-device-comparisons.js`, styles in `css/devices.css`.)

The Compare / Rankings / Spec sheet lookup tabs have a sliding pill behind the selected tab. Changing category or view slides the body content left or right — the direction follows the item's position in its list (`dirOf` + `animateBody`). It is skipped for the first paint, when nothing changes, and under `prefers-reduced-motion: reduce`.

The "X is both the better tech and the better buy" summary line is only shown when the two verdicts actually *disagree* (one device is the better tech, the other the better buy) — when they agree, the device cards' own badges and the two verdict cards already say so, so repeating it a third time was just noise.

## Name matching (typos, shorthand, "A vs B")

Device search is a separate problem from *tool* search (`js/lib/search.js`): a device lookup ("18 pro", "s23 plus", "m6") must match a product's own name and brand only — matching against a *chip* name too ("A18 Pro") turns "18 Pro" into a false hit on the wrong phone.

- **`js/lib/devices/db.js#deviceNameScore(query, device)`** tokenises the query and the device's brand+name (`tokenizeDeviceName`, e.g. `"Galaxy S23+"` → `['galaxy','s23','plus']`) and requires every query token to match a device token — exactly, as a prefix (so search-as-you-type works), or as a plausible typo (`tokenSimilarity`, Levenshtein-based). **Numbers never fuzzy-match each other** — a mistyped model number is a different device, not a nearby one — only words get typo tolerance. A query that only partly matches a name scores 0 and falls through instead of returning a confusing partial hit.
- **`searchDevices(data, query, limit)`** tries every device's name score first; if none match, it falls back to the original substring search over `_search` (which also covers chip, panel, type, etc.), so attribute queries like "snapdragon 8 elite" or "oled" still work.
- **`js/lib/devices/quick-search.js`** turns a raw typed query into a direct answer:
  - `splitVsQuery("A vs B")` → `["A", "B"]` (also matches "versus"; returns `null` for anything else, including "A vs B vs C").
  - `resolveDevice(query)` scores the query against every category at once and returns the best matches, ranked.
  - `quickDeviceLookup(raw)` returns `{ kind: 'compare', category, a, b }` for a two-sided query where both sides resolve confidently in the *same* category, `{ kind: 'device', category, device }` for a single confident match, or `null`. A `DEVICEY` gate (needs a digit or a recognisable brand/family word) keeps it from firing on ordinary text like "compress a photo".
  - `openQuickResult(hit)` writes the same `toolbox_devices_v2` handoff the Assistant's `device_compare` tool uses and opens Tech Device Comparisons on it.
- **Wired into search everywhere:** Spotlight (`js/lib/palette.js`) shows a debounced "Compare" / "Specs" row at the top of the results once resolved, opened by Enter or a click. The home page search (`js/app.js`) shows the same row above "Ask Assistant" — Enter opens it when found, Ctrl/Cmd+Enter treats it as the first suggestion, and it otherwise falls back to asking the Assistant.
- **Tests:** `tests/unit/device-quick-search.test.js` covers the matcher (shorthand, typos, the chip false-positive, numbers never fuzzy-matching) and `quickDeviceLookup` (same-category and cross-category "vs", a single device, and that ordinary text never misfires).

## Live spec sheets (Icecat)

The tool uses Icecat's JSON product API. Icecat standardizes manufacturer product sheets across IT, consumer electronics, peripherals, accessories and appliances. Availability varies by product, brand authorization and subscription. It is not a guarantee that every gadget has a sheet.

## Enable live lookup

1. Register an Open Icecat account at https://icecat.com/structured-data-content-users/ and confirm access to the brands/categories you need. Full Icecat or brand approval may be required for products outside your Open Icecat entitlement. Do not purchase a plan until the needed coverage is confirmed.
2. In MyIcecat → Access Tokens, create an API token. Set `ICECAT_USERNAME` and `ICECAT_API_TOKEN` in the **API server's** environment. This repository's `vercel.json` forwards `/api/*` to the Render signaling/API service, so configure that Render service, not only the Vercel frontend. For local development, use the ignored `.env` file and restart Vite.
3. Redeploy/restart the API server with this commit. `GET /api/devices/status` should return `configured: true`; this checks presence only, not token validity.
4. Open `#tech-device-comparisons`. Look up a known accessible product using its exact manufacturer part number plus brand, GTIN/EAN/UPC, or Icecat product ID. Confirm its name, variant and source sheet, then add another product and export a comparison.
5. If a sheet is inaccessible, check the token, account entitlement and exact identifier in MyIcecat. Tokens remain on the server; never commit them or put them in browser storage.

This API retrieves one identified product per request. It does **not** provide full-catalog free-text search. Search and category filters in the tool apply to sheets already retrieved and saved on this browser. A future catalog-wide name search would require an authorized Icecat index ingestion/search service. Live results are normalized and cached locally (up to 40 sheets), with retrieval dates and Icecat source links. Four sheets can be compared; saved sheets work offline. No unverified prices, star ratings or automatic winner claims are supplied. Feature IDs and measurement IDs align comparison rows, preserving source display values and missing fields.

No API account or token was available during implementation. Successful upstream requests and failures are covered with contract fixtures; an authenticated live smoke test is required after configuration.

## References

- JSON endpoint, identifiers, authentication headers and schema: https://iceclog.com/manual-for-icecat-json-product-requests/
- Catalog scope and access: https://icecat.com/structured-data-content-users/
- Errors and entitlements: https://iceclog.com/which-json-and-xml-error-messages-can-i-get-using-icecat/

## Notifications

The header bell exposes unread alerts, mark-read, mark-all-read, clear, sound, and opt-in desktop alerts. Settings are shared with Preferences; notifications are stored per signed-in account (or guest) on this browser. New incoming messages in connected sessions feed the center; history sync, local messages and edits do not create duplicates. Desktop alerts require browser permission and a running Toolbox session. This is not a background web-push service when Toolbox is closed.
