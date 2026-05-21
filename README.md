# SpaceX S-1 Atlas

A source-cited React/Vite dashboard for reviewing SpaceX's preliminary S-1 package. The app turns the filing, exhibits, OCR'd graphics, financial tables, risk factors, governance disclosures, and source packets into a mobile-friendly investor memo and evidence atlas.

Live dashboard: https://silent-aurora-p5v5.here.now/

## What it includes

- Executive S-1 memo view with source-backed proof points
- Segment, financial, risk, governance, and source-explorer tabs
- 331 disclosure/evidence packets and crawler-visible share pages
- Mobile-first layouts with narrow-width overflow QA
- External model tab crediting Jared L. Kubin's open SpaceX IPO model
- Original Jared Kubin XLSX bundled for download with attribution

## Source and attribution

Primary filing layer:

- SEC S-1 package, filed exhibits, filing-fee exhibit, and OCR from S-1 graphics
- Filing-derived JSON artifacts live under `public/`

External model layer:

- Model by Jared L. Kubin ([@JaredKubin on X](https://x.com/JaredKubin))
- Jared shared the model publicly as “OCCUPY MARS: SpaceX IPO first cut” and caveated it as a starting point with likely mistakes, not a final answer or investment advice
- The dashboard separates filed facts from external model assumptions

This repository is not affiliated with SpaceX, the SEC, Jared L. Kubin, X/Twitter, or here.now.

## Development

```bash
npm ci
npm run check
npm run preview -- --port 4182
```

Common scripts:

- `npm run generate:assets` — regenerate atlas/share/social artifacts from source payloads
- `npm run validate:data` — validate public JSON contracts and cross-file atlas invariants
- `npm run test` — run pure-logic and scenario math tests
- `npm run lint` — run ESLint and React Hooks checks
- `npm run build` — production Vite build
- `npm run verify:release` — release sanity checks
- `npm run check` / `npm run release:check` — full local release check

## Project structure

```text
src/                 React app and styling
public/              Filing-derived JSON payloads, share pages, model payloads, social card
scripts/             Asset generation and release verification scripts
```

`dist/` and `node_modules/` are intentionally ignored.

## Publication

The current public build was published separately to here.now. GitHub is the source repository; here.now remains the static artifact host.

## Disclaimer

This is a research and filing-review artifact: a source-cited filing map of the SEC S-1 package, not investment advice or a recommendation to buy or sell securities. This repository and dashboard are not affiliated with SpaceX, the SEC, Jared L. Kubin, X/Twitter, or here.now. External model assumptions are separate from filed facts and are presented for education and scenario analysis only.
