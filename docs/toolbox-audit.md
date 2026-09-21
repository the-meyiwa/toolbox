# Toolbox audit — 21 September 2026

## Verification coverage

- All 129 registered tool modules import, render, accept their first interaction,
  expose valid artifact hooks where declared, and complete lifecycle teardown in the
  component suite.
- All 127 visible tool routes were opened in a real browser and reached a completed
  mount without the shell's tool-load error state. The hidden Browser tool is covered
  by the component suite.
- Desktop and 390 × 844 mobile layouts were visually checked for the tool directory,
  About story, Files, Preferences, and contribution interface. Files single-click
  preview was exercised in grid view and its disposable audit files were removed.
- Production build and the complete automated suite were run after the changes.

This verifies the application shell and local interactions. It does not claim that
every external provider, microphone/camera permission, mailbox, or real payment was
exercised with a live account.

## Performance and reliability work

- Large compound data now loads only for compound search/database use instead of with
  every Assistant or chemistry-engine load.
- 3D rendering pauses offscreen and uses a lower pixel-density ceiling on modest
  devices. Home scrolling is coalesced through one animation frame.
- Repeated tool navigation cannot let a stale async render replace the current route.
- Video, audio-tag editing, speaker-cleaner sweeps, vehicle lookups, object URLs,
  global listeners, and delayed context-menu listeners now clean up on unmount.
- MP3 export writes typed arrays directly, avoiding millions of temporary boxed values.
- Nested glass cards no longer create their own backdrop-filter layer.

## Interaction and design work

- Menus share a short transform-and-opacity unfolding motion with keyboard navigation
  and reduced-motion support. Dialog and Preferences transitions use the same timing.
- The About story uses scroll-linked sideways replacement: copy and scene enter from
  opposite sides, remain fully readable, then leave as the next chapter arrives.
- Tool cards use a clearer block structure inspired by shadcn: compact icon well,
  stronger title, quiet border/elevation, and a small directional affordance.
- The Toolbox wordmark now includes a compact three-part toolbox mark that inherits
  every theme color.

## Owner setup still required

- Run the current `supabase/supporters.sql` migration. It enables guest contributions
  and secure post-payment account claiming.
- Confirm the API host, rather than only the Vercel frontend, has
  `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY`. Local development has none of these values. The Vercel
  and GitHub CLIs are unavailable in this workspace, so their dashboards could not be
  inspected. No credential was removed or exposed by this work.
- Configure Google and Microsoft OAuth callback URLs/secrets for live Mail, then test
  consent, refresh, sending, archive, and multi-account behavior with provider accounts.
- Add `GEMINI_API_KEY` to the API host and test a signed-in Assistant conversation.
- Add Icecat credentials and confirm account entitlements with exact product IDs.
- Payment Hub remains intentionally unavailable until a real merchant receiving
  integration exists. It no longer fabricates account numbers or payment success.
- Automobile Guide now ships interactive procedural packages for the 2013 and
  2014–2016 Toyota Corolla (body, cabin, engine bay, chassis; 55 articulations each).
  Other models still depend on licensed source geometry being added through the
  vehicle-package pipeline.
