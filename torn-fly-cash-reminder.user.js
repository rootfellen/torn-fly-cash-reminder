// ==UserScript==
// @name         Torn - Don't Fly Broke
// @namespace    https://github.com/rootfellen/torn-fly-cash-reminder
// @version      1.0.0
// @description  Warns you on the Travel page when you're about to fly without enough cash for plushies, flowers, Xanax or rehab. Reads only the page you're on. No API key, no requests.
// @author       0o0o0
// @license      MIT
// @homepageURL  https://github.com/rootfellen/torn-fly-cash-reminder
// @supportURL   https://github.com/rootfellen/torn-fly-cash-reminder/issues
// @downloadURL  https://raw.githubusercontent.com/rootfellen/torn-fly-cash-reminder/main/torn-fly-cash-reminder.user.js
// @updateURL    https://raw.githubusercontent.com/rootfellen/torn-fly-cash-reminder/main/torn-fly-cash-reminder.user.js
// @match        https://www.torn.com/page.php?sid=travel*
// @match        https://torn.com/page.php?sid=travel*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

/*
 * Torn - Don't Fly Broke
 * ----------------------
 * Torn scripting rules: this script only reads data from the page you have
 * loaded yourself (your sidebar cash). It makes NO requests to Torn or anywhere
 * else, needs NO API key, and never clicks anything on your behalf.
 * "Fly anyway" simply stops blocking YOUR next click for a few seconds.
 *
 * Works in Tampermonkey, Violentmonkey and Torn PDA. Settings are stored in
 * your browser's localStorage and never leave your device.
 */

(function () {
  'use strict';

  if (window.__tfcrLoaded) return; // guard against double injection (PDA + extension)
  window.__tfcrLoaded = true;

  // ------------------------------------------------------------------ settings
  const STORAGE_KEY = 'tfcr_settings_v1';
  const DEFAULTS = Object.freeze({
    minCash: 1000000,     // warn below this amount of cash on hand
    blockClick: true,     // show the pop-up when you press Travel/Continue
    showBanner: true,     // show the cash banner on the Travel page
    bypassSeconds: 15,    // how long "Fly anyway" lets clicks through
  });

  const LIMITS = Object.freeze({
    maxCash: 1e12,        // sanity cap for the minimum
    bypassMin: 3,
    bypassMax: 120,
  });

  /**
   * Stored settings are untrusted input (they can be corrupted, hand-edited or
   * left over from another version). Only known keys with valid values are
   * accepted; anything else falls back to the default, so a bad value can
   * never silently switch the protection off.
   */
  function sanitizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = { ...DEFAULTS };

    const min = Number(src.minCash);
    if (Number.isFinite(min) && min >= 0 && min <= LIMITS.maxCash) out.minCash = Math.round(min);

    const bypass = Number(src.bypassSeconds);
    if (Number.isInteger(bypass) && bypass >= LIMITS.bypassMin && bypass <= LIMITS.bypassMax) {
      out.bypassSeconds = bypass;
    }

    if (typeof src.blockClick === 'boolean') out.blockClick = src.blockClick;
    if (typeof src.showBanner === 'boolean') out.showBanner = src.showBanner;

    return Object.freeze(out);
  }

  function loadSettings() {
    try {
      return sanitizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (_) {
      return sanitizeSettings({});
    }
  }

  function saveSettings(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {
      /* storage blocked (private mode etc.), keep in memory only */
    }
  }

  let settings = loadSettings();
  let bypassUntil = 0;

  // ------------------------------------------------------------------- helpers
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

  /** Parses "1,500,000", "$2.5m", "750k", "1b" -> number (NaN if invalid). */
  function parseMoney(input) {
    if (input === null || input === undefined) return NaN;
    const s = String(input).trim().toLowerCase().replace(/[$,\s]/g, '');
    const m = s.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
    if (!m) return NaN;
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  /** Cash on hand from the sidebar (Torn renders it as #user-money[data-money]). */
  function getCash() {
    const node = document.getElementById('user-money');
    if (!node) return NaN;
    const attr = (node.getAttribute('data-money') || '').trim();
    if (/^\d+$/.test(attr)) return Number(attr);
    return parseMoney(node.textContent);
  }

  /**
   * Torn uses the same travel page for the flight home. Flying home broke is
   * fine, so the script stays out of the way while you're abroad or in the air.
   * Torn marks this on <body data-abroad="true"> / <body data-traveling="true">.
   */
  const isAwayFromTorn = () =>
    document.body.dataset.abroad === 'true' || document.body.dataset.traveling === 'true';

  // Unknown cash counts as low: failing safe is the whole point of the script.
  const isLow = (cash) => !Number.isFinite(cash) || cash < settings.minCash;

  /** Returns the clicked element if it's a button that starts/confirms a flight. */
  const FLY_TEXT = /^\s*(travel|continue|fly|confirm)\b/i;
  function findFlyButton(target) {
    if (!(target instanceof Element)) return null;
    const btn = target.closest(
      'button, a, input[type="submit"], input[type="button"], [role="button"]'
    );
    if (!btn) return null;
    if (btn.closest('#tfcr-banner, #tfcr-modal, #sidebarroot, .sidebar, header')) return null;
    const text = (btn.value || btn.textContent || '').trim();
    return FLY_TEXT.test(text) ? btn : null;
  }

  /**
   * Tiny DOM builder. All text goes through textContent / text nodes, never
   * innerHTML, so nothing read from the page can be interpreted as markup.
   */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, String(v));
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  // -------------------------------------------------------------------- styles
  if (!document.getElementById('tfcr-style')) {
    const style = el('style', { id: 'tfcr-style' });
    style.textContent = `
      #tfcr-banner{margin:8px 0;padding:10px 12px;border-radius:6px;font:13px/1.4 Arial,sans-serif;
        display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;
        border:1px solid;box-sizing:border-box}
      #tfcr-banner.tfcr-ok{background:#1e3a1e;border-color:#3c7a3c;color:#cfe8cf}
      #tfcr-banner.tfcr-low{background:#4a1b1b;border-color:#b33;color:#ffd6d6}
      #tfcr-banner.tfcr-unk{background:#3a3520;border-color:#8a7a30;color:#f0e6b8}
      #tfcr-banner b{color:#fff}
      #tfcr-banner button{background:transparent;border:1px solid currentColor;color:inherit;
        border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px}
      #tfcr-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2147483646;
        display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
      #tfcr-modal .tfcr-box{background:#222;color:#eee;border:2px solid #555;border-radius:8px;
        max-width:380px;width:100%;padding:18px;font:14px/1.5 Arial,sans-serif;box-sizing:border-box}
      #tfcr-modal .tfcr-box.tfcr-warn{border-color:#c33;text-align:center}
      #tfcr-modal h3{margin:0 0 10px;font-size:18px}
      #tfcr-modal .tfcr-warn h3{color:#ff6b6b}
      #tfcr-modal .tfcr-muted{font-size:12px;color:#aaa;margin-top:8px}
      #tfcr-modal .tfcr-row{display:flex;gap:10px;margin-top:14px}
      #tfcr-modal .tfcr-row button{flex:1;padding:10px;border-radius:5px;border:0;cursor:pointer;
        font-weight:bold;font-size:14px}
      #tfcr-modal .tfcr-primary{background:#3c7a3c;color:#fff}
      #tfcr-modal .tfcr-secondary{background:#555;color:#ddd}
      #tfcr-modal label{display:block;margin-top:10px;font-size:13px}
      #tfcr-modal input[type=text],#tfcr-modal input[type=number]{width:100%;box-sizing:border-box;
        margin-top:4px;padding:8px;border-radius:4px;border:1px solid #666;background:#111;color:#eee;
        font-size:14px}
      #tfcr-modal input[type=checkbox]{margin-right:6px;vertical-align:middle}
      #tfcr-modal .tfcr-err{color:#ff8080;font-size:12px;min-height:16px;margin-top:4px}
      #tfcr-modal .tfcr-link{background:none;border:0;color:#8ab4f8;cursor:pointer;
        font-size:12px;padding:0;margin-top:10px;text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  // -------------------------------------------------------------------- modals
  let returnFocusTo = null;

  function closeModal() {
    const m = document.getElementById('tfcr-modal');
    if (!m) return;
    m.remove();
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
    returnFocusTo = null;
  }

  function openModal(box, titleId) {
    closeModal();
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = el(
      'div',
      { id: 'tfcr-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      box
    );
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    // Keep keystrokes inside our dialog from reaching Torn's page hotkeys.
    overlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') closeModal();
    });
    document.body.appendChild(overlay);
  }

  function showWarning(cash) {
    const box = el('div', { class: 'tfcr-box tfcr-warn' }, [
      el('h3', { id: 'tfcr-warn-title', text: "Wait, you're flying broke!" }),
      el('div', {}, ['Cash on hand: ', el('b', { text: Number.isFinite(cash) ? fmt(cash) : 'unknown' })]),
      el('div', {}, ['Your minimum: ', el('b', { text: fmt(settings.minCash) })]),
      el('div', { class: 'tfcr-muted', text: "Plushies, flowers, Xanax, rehab... none of it's free abroad." }),
      el('div', { class: 'tfcr-row' }, [
        el('button', { type: 'button', class: 'tfcr-primary', text: 'Stay & get cash', onclick: closeModal }),
        el('button', {
          type: 'button', class: 'tfcr-secondary', text: 'Fly anyway',
          onclick: () => { bypassUntil = Date.now() + settings.bypassSeconds * 1000; closeModal(); },
        }),
      ]),
      el('div', {
        class: 'tfcr-muted',
        text: `"Fly anyway" unblocks the Travel button for ${settings.bypassSeconds}s. Press it again yourself.`,
      }),
    ]);
    openModal(box, 'tfcr-warn-title');
    box.querySelector('.tfcr-primary').focus();
  }

  function showSettings() {
    const minInput = el('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: '20', value: String(settings.minCash),
    });
    const bypassInput = el('input', {
      type: 'number', min: String(LIMITS.bypassMin), max: String(LIMITS.bypassMax), step: '1',
      value: String(settings.bypassSeconds),
    });
    const blockInput = el('input', { type: 'checkbox' });
    const bannerInput = el('input', { type: 'checkbox' });
    blockInput.checked = settings.blockClick;
    bannerInput.checked = settings.showBanner;
    const err = el('div', { class: 'tfcr-err' });

    const save = () => {
      const minCash = parseMoney(minInput.value);
      const bypass = Number(bypassInput.value);
      if (!Number.isFinite(minCash) || minCash > LIMITS.maxCash) {
        err.textContent = 'Enter an amount like 500000, 750k or 2.5m.';
        return;
      }
      if (!Number.isInteger(bypass) || bypass < LIMITS.bypassMin || bypass > LIMITS.bypassMax) {
        err.textContent = `Unlock time must be ${LIMITS.bypassMin}–${LIMITS.bypassMax} whole seconds.`;
        return;
      }
      settings = sanitizeSettings({
        minCash, bypassSeconds: bypass, blockClick: blockInput.checked, showBanner: bannerInput.checked,
      });
      saveSettings(settings);
      lastBannerKey = '';
      closeModal();
      render();
    };

    const box = el('div', { class: 'tfcr-box' }, [
      el('h3', { id: 'tfcr-settings-title', text: "Don't Fly Broke: settings" }),
      el('label', {}, ['Warn me if cash on hand is below', minInput]),
      el('label', {}, ['"Fly anyway" unlock time (seconds)', bypassInput]),
      el('label', {}, [blockInput, 'Pop up a warning when I press Travel']),
      el('label', {}, [bannerInput, 'Show the cash banner on this page']),
      err,
      el('div', { class: 'tfcr-row' }, [
        el('button', { type: 'button', class: 'tfcr-primary', text: 'Save', onclick: save }),
        el('button', { type: 'button', class: 'tfcr-secondary', text: 'Cancel', onclick: closeModal }),
      ]),
      el('button', {
        type: 'button', class: 'tfcr-link', text: 'Reset to defaults',
        onclick: () => {
          minInput.value = String(DEFAULTS.minCash);
          bypassInput.value = String(DEFAULTS.bypassSeconds);
          blockInput.checked = DEFAULTS.blockClick;
          bannerInput.checked = DEFAULTS.showBanner;
          err.textContent = '';
        },
      }),
    ]);
    minInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    openModal(box, 'tfcr-settings-title');
    minInput.focus();
  }

  // -------------------------------------------------------------------- banner
  function findBannerAnchor() {
    return (
      document.querySelector('.content-wrapper .content-title') ||
      document.querySelector('.content-wrapper') ||
      document.querySelector('#mainContainer') ||
      document.body
    );
  }

  let lastBannerKey = '';
  function render() {
    let banner = document.getElementById('tfcr-banner');

    if (isAwayFromTorn()) {
      if (banner) banner.remove();
      lastBannerKey = '';
      return;
    }

    if (!settings.showBanner) {
      // Keep a tiny settings entry point so users can turn it back on.
      if (!banner || banner.dataset.mode !== 'mini') {
        if (banner) banner.remove();
        banner = el('div', { id: 'tfcr-banner', class: 'tfcr-unk', 'data-mode': 'mini' }, [
          el('span', { text: "Don't Fly Broke" }),
          el('button', { type: 'button', text: 'Settings', onclick: showSettings }),
        ]);
        insertBanner(banner);
      }
      return;
    }

    const cash = getCash();
    const key = `${cash}|${settings.minCash}`;
    if (banner && banner.dataset.mode === 'full' && key === lastBannerKey) return;
    lastBannerKey = key;

    let cls; let msg;
    if (!Number.isFinite(cash)) {
      cls = 'tfcr-unk';
      msg = [el('span', { text: "Couldn't read your cash. Check you have money on hand before flying." })];
    } else if (cash < settings.minCash) {
      cls = 'tfcr-low';
      msg = [el('span', {}, [
        '⚠️ You have ', el('b', { text: fmt(cash) }), ' on hand, below your minimum of ',
        el('b', { text: fmt(settings.minCash) }), '. Grab cash before you fly!',
      ])];
    } else {
      cls = 'tfcr-ok';
      msg = [el('span', {}, ['✈️ Cash on hand: ', el('b', { text: fmt(cash) }), ` (minimum ${fmt(settings.minCash)})`])];
    }

    const next = el('div', { id: 'tfcr-banner', class: cls, 'data-mode': 'full' }, [
      ...msg,
      el('button', { type: 'button', text: 'Settings', onclick: showSettings }),
    ]);
    if (banner) banner.replaceWith(next);
    else insertBanner(next);
  }

  function insertBanner(banner) {
    const anchor = findBannerAnchor();
    if (anchor.classList && anchor.classList.contains('content-title')) {
      anchor.insertAdjacentElement('afterend', banner);
    } else {
      anchor.prepend(banner);
    }
  }

  // ------------------------------------------------------- intercept the flight
  function guard(e, target) {
    if (!settings.blockClick) return;
    if (isAwayFromTorn()) return;
    if (Date.now() < bypassUntil) return;
    const cash = getCash();
    if (!isLow(cash)) return;
    if (!findFlyButton(target)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showWarning(cash);
  }

  // Capture phase on window: runs before any handler Torn attaches to the
  // document or its app root, so the flight request is never sent.
  window.addEventListener('click', (e) => guard(e, e.target), true);
  window.addEventListener('submit', (e) => guard(e, e.submitter || document.activeElement), true);

  // ---------------------------------------------------------- keep it updated
  let scheduled = false;
  const scheduleRender = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  };

  // Watch only the cash element for changes (cheap), and re-attach if Torn
  // swaps that element out when it redraws the sidebar.
  const moneyObserver = new MutationObserver(scheduleRender);
  let watchedMoney = null;
  function watchMoney() {
    const node = document.getElementById('user-money');
    if (node === watchedMoney) return;
    moneyObserver.disconnect();
    watchedMoney = node;
    if (node) {
      moneyObserver.observe(node, { attributes: true, attributeFilter: ['data-money'], childList: true, characterData: true, subtree: true });
    }
    scheduleRender();
  }

  // Structural changes only (no text/attribute noise): re-insert the banner if
  // the page redraws, and pick up a replaced cash element.
  new MutationObserver(() => {
    watchMoney();
    if (!document.getElementById('tfcr-banner')) scheduleRender();
  }).observe(document.body, { childList: true, subtree: true });

  // Landing or taking off flips these flags on <body>.
  new MutationObserver(scheduleRender).observe(document.body, {
    attributes: true, attributeFilter: ['data-abroad', 'data-traveling'],
  });

  watchMoney();
  render();

  // Settings changed in another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { settings = loadSettings(); lastBannerKey = ''; render(); }
  });
})();
