# Torn: Don't Fly Broke ✈️💸

A free userscript for [Torn](https://www.torn.com) that stops you from taking off with an empty wallet.

It's the most common travel mistake in Torn. You fly to Mexico for plushies, Japan for flowers, South Africa for Xanax or Switzerland for rehab, land, and realize you left your cash in the vault. This script catches that **before** you board.

## What it does

On the **Travel** page (`torn.com/page.php?sid=travel`):

- **Cash banner.** Shows the cash you have on hand. It turns **red** when you're below your minimum and updates live as you withdraw.
- **Pre-flight warning.** If you press *Travel* while under your minimum, a pop-up asks whether you really want to go.
  - **Stay & get cash** closes the pop-up so you can go get money.
  - **Fly anyway** unblocks the Travel button for a few seconds. You then press it again yourself.
- **Quiet on the way home.** While you're abroad, the script stays hidden. Flying back broke is fine.
- **Settings.** Set your own minimum (`500000`, `750k` and `2.5m` all work), the unlock time, and turn the banner or the pop-up on or off.

<!-- TODO: add screenshot.png of the banner + pop-up, then replace this line with: ![screenshot](screenshot.png) -->

## Install

### Desktop browser (Chrome, Firefox, Edge, Safari)

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open **[torn-fly-cash-reminder.user.js](https://raw.githubusercontent.com/rootfellen/torn-fly-cash-reminder/main/torn-fly-cash-reminder.user.js)**. Your manager will offer to install it.
3. Open the Travel page in Torn. The banner appears at the top.

Updates install automatically through your userscript manager.

### Torn PDA (mobile)

1. In Torn PDA, open **Settings → Advanced browser settings → User scripts**.
2. Add a new script and paste in the contents of `torn-fly-cash-reminder.user.js`.
3. Set injection time to **End**, save, and open the Travel page.

## Is it allowed?

Yes. Torn's scripting rules allow scripts that use data from the API or from a page you loaded yourself and are currently viewing, as long as they make no extra non-API requests to Torn.

This script:

- ✅ reads only your cash from the sidebar of the page you're already on
- ✅ makes **zero** network requests (to Torn or anywhere else)
- ✅ needs **no API key**
- ✅ never clicks or submits anything for you. "Fly anyway" only lets *your* next click through.

## Security & privacy

Nothing is collected or sent anywhere. Your settings are saved in your own browser's `localStorage` and never leave your device.

The script is a single readable file, and it's linted and tested on every change. See [SECURITY.md](SECURITY.md) for the details.

## Troubleshooting

| Problem | Fix |
|---|---|
| Banner is yellow: "Couldn't read your cash" | Torn may have changed the sidebar. Please [open an issue](https://github.com/rootfellen/torn-fly-cash-reminder/issues). |
| Pop-up doesn't appear when pressing Travel | Check that "Pop up a warning when I press Travel" is on in Settings. If it is, open an issue with a screenshot. |
| I hid the banner and want it back | A small "Don't Fly Broke · Settings" bar stays on the page. Click Settings. |

## Feedback and contributions

Bug reports and ideas are welcome in [Issues](https://github.com/rootfellen/torn-fly-cash-reminder/issues), or message me in Torn: **[0o0o0](https://www.torn.com/profiles.php?XID=4263920)**. Pull requests are welcome too. Please keep any change within Torn's scripting rules (no automated actions, no extra requests).

## Development

```bash
npm install
npx playwright install chromium
npm run check   # lint + browser tests
```

Players don't need any of this. It's only for working on the script.

## License

[MIT](LICENSE). Free to use, share and modify.

Made by **0o0o0** in Torn. If it saved you a wasted trip, a message or a plushie is always appreciated. ✈️
