# SpaceX S-1 Atlas polish ledger

## 2026-05-21 — mobile segmented nav behavior

Changed:
- Applied the responsive-nav polish pattern to the existing segmented mobile header.
- Added outside-click and Escape-key dismissal for the mobile `More` dropdown.
- Made overflow-route selection coherent: packet routes highlight `Atlas`; poster routes highlight `More`/`Poster` instead of incorrectly highlighting `Overview`.
- Dropdown selections now close the menu before route navigation.

Verification:
- `npm run release:check` passed locally on 2026-05-21; existing lint warnings only.
- Desktop browser QA on `/poster/business-stack`: `Overview` is no longer highlighted on Poster; the separate Poster control represents the current route.
- Mobile screenshot QA at 390px with `More` open: `More` is active, `Poster` is highlighted inside the dropdown, and the menu has no visible overflow/cramped styling.
- Mobile overflow audit passed at 390, 375, and 360px on the Poster route with `More` open.
- Menu behavior check passed: Escape and outside click both close the dropdown.
- here.now read-back passed on `https://henry.here.now/spacex-s1-atlas/?verify=skill-apply-nav`; live HTML references `index-CTkaXgcd.css` and `index-CCMsQTyt.js`.
- Pending in this run: CI after commit.

Next target:
- If more polish is needed, audit dense lower-page sections for redundant tinted alert panels and convert only true card surfaces to shared utilities without weakening warning callouts.
