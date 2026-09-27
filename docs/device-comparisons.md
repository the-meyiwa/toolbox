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
