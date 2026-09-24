# Security

## What this script can and can't do

- **No network access.** The script makes no requests to Torn or anywhere else. It has no `fetch`, `XMLHttpRequest` or `WebSocket` calls, and `@grant none` gives it no userscript-manager privileges. The linter blocks any network API from being added.
- **No API key.** It never asks for one and never reads one.
- **Reads one value.** It reads the cash shown in your sidebar on the Travel page you opened yourself.
- **Never acts for you.** It never clicks, submits or sends anything. It can only *stop* your own Travel click and show a warning.
- **No HTML injection.** Everything it shows is built with `textContent`, never `innerHTML`, so text from the page can't run as code. This is also enforced by the linter.
- **Local settings only.** Settings live in your browser's `localStorage`. They are validated on load, so a corrupted value falls back to the safe default and can't silently switch the warning off.

## Verify it yourself

The whole script is one readable file: [`torn-fly-cash-reminder.user.js`](torn-fly-cash-reminder.user.js). Only install it from this repository or its official Greasy Fork page.

## Reporting a problem

Found a security issue? Please message [0o0o0 [4263920]](https://www.torn.com/profiles.php?XID=4263920) in Torn instead of opening a public issue.
