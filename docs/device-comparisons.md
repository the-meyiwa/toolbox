# Tech Device Comparisons: Icecat setup

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
