// Browser tests: loads the script into a mock Travel page (no real network) and checks behaviour.
// Run: npm test
const { chromium } = require('playwright');
const script = require('fs').readFileSync(require('path').join(__dirname, '..', 'torn-fly-cash-reminder.user.js'),'utf8');
const page = (money) => `<!doctype html><html><head></head><body>
<div id="sidebarroot">${money}</div>
<div class="content-wrapper"><div class="content-title"><h4>Travel Agency</h4></div>
<form id="f" onsubmit="event.preventDefault();window.submitted=(window.submitted||0)+1"><button id="travel" type="submit">TRAVEL</button></form>
<button id="other">Buy item</button></div>
<script>document.addEventListener('click',e=>{if(e.target.id==='travel')window.flew=(window.flew||0)+1},true);
document.addEventListener('keydown',()=>{window.hotkeys=(window.hotkeys||0)+1});</script></body></html>`;
const results = []; const ok = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  async function open(money, storage) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    let html = page(money);
    await p.route('https://www.torn.com/**', r => r.fulfill({ contentType: 'text/html', body: html }));
    await p.goto('https://www.torn.com/page.php?sid=travel');
    if (storage !== undefined) { await p.evaluate(s => localStorage.setItem('tfcr_settings_v1', s), storage); await p.reload(); }
    await p.addScriptTag({ content: script });
    await p.waitForTimeout(50);
    return p;
  }
  const n = (p, k) => p.evaluate(k => window[k] || 0, k);
  let p = await open('<span id="user-money" data-money="250000">$250,000</span>');
  ok('low cash -> red banner', (await p.getAttribute('#tfcr-banner','class')) === 'tfcr-low');
  await p.click('#travel');
  ok('Travel click blocked before page capture handler', (await n(p,'flew')) === 0 && (await n(p,'submitted')) === 0);
  ok('warning dialog shown with aria label', (await p.getAttribute('#tfcr-modal','aria-labelledby')) === 'tfcr-warn-title');
  await p.keyboard.press('Escape');
  ok('Escape closes dialog', !(await p.$('#tfcr-modal')));
  const hk = await n(p,'hotkeys');
  ok('keys inside dialog do not reach page hotkeys', hk === 0);
  await p.click('#other');
  ok('unrelated buttons not blocked', !(await p.$('#tfcr-modal')));
  await p.click('#travel'); await p.click('#tfcr-modal .tfcr-secondary'); await p.click('#travel');
  ok('Fly anyway lets the next click through', (await n(p,'flew')) === 1 && (await n(p,'submitted')) === 1);
  await p.evaluate(() => { const m = document.getElementById('user-money'); m.setAttribute('data-money','5000000'); });
  await p.waitForTimeout(60);
  ok('deposit -> green banner', (await p.getAttribute('#tfcr-banner','class')) === 'tfcr-ok');
  await p.evaluate(() => { document.getElementById('sidebarroot').innerHTML = '<span id="user-money" data-money="10">$10</span>'; });
  await p.waitForTimeout(60);
  ok('sidebar redraw (new cash element) tracked', (await p.getAttribute('#tfcr-banner','class')) === 'tfcr-low');
  await p.evaluate(() => document.getElementById('tfcr-banner').remove());
  await p.waitForTimeout(60);
  ok('banner re-inserted after page redraw', !!(await p.$('#tfcr-banner')));
  await p.click('#tfcr-banner button'); await p.fill('#tfcr-modal input[type=text]','2.5m'); await p.click('#tfcr-modal .tfcr-primary');
  const saved = JSON.parse(await p.evaluate(() => localStorage.getItem('tfcr_settings_v1')));
  ok('settings saved (2.5m)', saved.minCash === 2500000);
  await p.click('#tfcr-banner button'); await p.fill('#tfcr-modal input[type=text]','lots'); await p.click('#tfcr-modal .tfcr-primary');
  ok('invalid amount rejected with message', (await p.textContent('#tfcr-modal .tfcr-err')).length > 0);
  await p.keyboard.press('Escape');
  await p.addScriptTag({ content: script });
  ok('double injection -> one banner', (await p.$$('#tfcr-banner')).length === 1);

  p = await open('<span id="user-money" data-money="250000">$250,000</span>', '{"minCash":"abc","blockClick":"no","bypassSeconds":99999,"__proto__":{"polluted":1}}');
  ok('corrupted settings fall back to defaults (guard stays on)', await (async () => { await p.click('#travel'); return !!(await p.$('#tfcr-modal')); })());
  ok('no prototype pollution', await p.evaluate(() => ({}).polluted === undefined));

  p = await open('');
  ok('missing cash element -> "unknown" banner', (await p.getAttribute('#tfcr-banner','class')) === 'tfcr-unk');
  await p.click('#travel');
  ok('unknown cash fails safe (blocks)', !!(await p.$('#tfcr-modal')));

  p = await open('<span id="user-money"><img src=x onerror="window.pwned=1">junk</span>');
  await p.waitForTimeout(100);
  await p.evaluate(() => { window.pwned = 0; const m = document.getElementById('user-money'); m.appendChild(document.createTextNode(' <img src=y onerror=window.pwned=1>')); });
  await p.waitForTimeout(150);
  ok('hostile page text never executed or injected', (await n(p,'pwned')) === 0 && !(await p.$('#tfcr-banner img')));

  p = await open('<span id="user-money" data-money="0">$0</span>');
  await p.evaluate(() => { document.body.dataset.abroad = 'true'; });
  await p.waitForTimeout(60);
  ok('abroad -> banner hidden', !(await p.$('#tfcr-banner')));
  await p.click('#travel');
  ok('abroad -> flight home not blocked', !(await p.$('#tfcr-modal')) && (await n(p,'flew')) === 1);
  await p.evaluate(() => { document.body.dataset.abroad = 'false'; });
  await p.waitForTimeout(60);
  ok('back in Torn -> banner returns', (await p.getAttribute('#tfcr-banner','class')) === 'tfcr-low');
  await p.evaluate(() => { document.body.dataset.traveling = 'true'; });
  await p.waitForTimeout(60);
  ok('in flight -> banner hidden', !(await p.$('#tfcr-banner')));

  console.log(results.join('\n'));
  if (results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
