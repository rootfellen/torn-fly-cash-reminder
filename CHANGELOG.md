# Changelog

## 1.0.0 (2026-09-22)

First public release.

- Runs on the Travel page (`page.php?sid=travel`)
- Stays hidden while you're abroad or flying, so there's no false warning on the flight home
- Cash banner on the Travel page, live-updating and colour-coded (OK / low / unknown)
- Pre-flight warning pop-up when pressing Travel/Continue below your minimum
- "Fly anyway" unlocks your own next click for a configurable time. Nothing is clicked for you.
- Settings panel: minimum cash (accepts `750k`, `2.5m`), unlock time, toggles for banner and pop-up
- Settings sync across open tabs
- Works in Tampermonkey, Violentmonkey and Torn PDA
- No API key, no network requests, no data collection
- Hardened: validated settings (corrupted values can't disable the warning), fail-safe when cash can't be read, no `innerHTML` anywhere, `@noframes`, click guard runs before any page handler, dialog keystrokes isolated from page hotkeys
- Dev tooling: ESLint (blocks network APIs and HTML injection), 22 browser tests, GitHub Actions CI
