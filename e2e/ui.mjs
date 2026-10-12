// Browser smoke test + screenshots. Usage: BASE=http://localhost:3111 node e2e/ui.mjs
// Requires a running server (memory store is fine) and Playwright's Chromium.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const OUT = process.env.OUT ?? "e2e/screens";
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

async function setSwitch(pg, label, on) {
  const sw = pg.locator(`button[role=switch][aria-label="${label}"]`);
  if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/404/.test(m.text()) && errors.push(m.text()));
page.on("response", (r) => r.status() >= 400 && !/\/zzzzzzzz$/.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));

// ---- Home / editor
await page.goto(BASE + "/");
await page.waitForSelector("textarea[name=content]");
await page.screenshot({ path: `${OUT}/01-home-light.png` });
check("home renders editor", await page.locator("textarea[name=content]").isVisible());

// Type, pick language, save with keyboard
const code = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}\n';
await page.fill("textarea[name=content]", code);
await page.fill("input[name=title]", "main.go");
await page.selectOption("select[name=lang]", "go");
await page.selectOption("select[name=expires]", "1d");
await page.keyboard.press("Control+s");
await page.waitForURL(/\/[A-Za-z0-9]{8}$/, { timeout: 15000 });
const pasteUrl = page.url();
check("save navigates to paste", /\/[A-Za-z0-9]{8}$/.test(pasteUrl), pasteUrl);
await page.waitForSelector("h1");
await page.screenshot({ path: `${OUT}/02-paste-light.png` });
check("title shown", (await page.locator("h1").innerText()).includes("main.go"));
check("highlighting applied", (await page.locator('td span[style*="--shiki-light"]').count()) > 0);
check("gutter has 7+ lines", (await page.locator("tr[id^=L]").count()) >= 7);
check("edit token remembered (Edit enabled)", !(await page.locator('button[title^="Edit"]').isDisabled()));

// line linking
await page.click("#L3 a");
check("line click sets hash", page.url().endsWith("#L3"));
await page.click("#L5 a", { modifiers: ["Shift"] });
check("shift-click extends range", page.url().endsWith("#L3-L5"));
check("range highlighted", (await page.locator("tr.line-hl").count()) === 3);

// dark mode screenshot
await page.emulateMedia({ colorScheme: "dark" });
await page.evaluate(() => { localStorage.setItem("theme", "dark"); document.documentElement.classList.add("dark"); });
await page.screenshot({ path: `${OUT}/03-paste-dark.png` });
check("dark tokens applied", await page.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgb(15, 17, 20)"));
await page.evaluate(() => { localStorage.setItem("theme", "light"); document.documentElement.classList.remove("dark"); });
await page.emulateMedia({ colorScheme: "light" });

// edit flow
await page.click('button[title^="Edit"]');
await page.waitForSelector("textarea[name=content]");
await page.fill("textarea[name=content]", code.replace("hello", "edited"));
await page.click('button[type=submit]');
await page.waitForFunction(() => document.body.innerText.includes("edited"), null, { timeout: 15000 });
check("edit saved and re-rendered", (await page.locator("table").innerText()).includes("edited"));

// your pastes menu
await page.click('button[aria-label="Your pastes"]');
check("local pastes menu lists paste", (await page.locator('#your-pastes').innerText()).includes("main.go"));
await page.keyboard.press("Escape");

// ---- Markdown
await page.goto(BASE + "/");
await page.fill("textarea[name=content]", "# Title\n\nSome **bold** text and `code`.\n\n- a\n- b\n\n```js\nconsole.log(1)\n```\n");
await page.selectOption("select[name=lang]", "markdown");
await page.click('button[type=submit]');
await page.waitForURL(/\/[A-Za-z0-9]{8}$/, { timeout: 15000 });
await page.waitForSelector("article.prose");
check("markdown preview renders", (await page.locator("article.prose h1").innerText()) === "Title");
await page.screenshot({ path: `${OUT}/04-markdown.png` });
await page.click("text=Source");
check("markdown source toggle", (await page.locator("table tr[id^=L]").count()) > 5);

// ---- Encrypted (fragment key)
await page.goto(BASE + "/");
await page.fill("textarea[name=content]", "SECRET_VALUE_123\nline two");
await page.selectOption("select[name=lang]", "text");
await setSwitch(page, "Encrypt in browser", true);
await setSwitch(page, "Protect with a password instead of a link key", false);
await page.click('button[type=submit]');
await page.waitForURL(/\/[A-Za-z0-9]{8}#[A-Za-z0-9_-]{43}$/, { timeout: 15000 });
const encUrl = page.url();
await page.waitForFunction(() => document.body.innerText.includes("SECRET_VALUE_123"), null, { timeout: 15000 });
check("encrypted paste decrypts with fragment", true, encUrl);
await page.screenshot({ path: `${OUT}/05-encrypted.png` });
const id = encUrl.match(/\/([A-Za-z0-9]{8})#/)[1];
const rawRes = await page.request.get(`${BASE}/${id}/raw`);
check("raw of encrypted paste is ciphertext", !(await rawRes.text()).includes("SECRET_VALUE_123") && rawRes.headers()["x-encrypted"] === "1");
// fresh context without key → asks for key
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/${id}`);
await p2.waitForSelector("input[placeholder=Key]");
check("encrypted paste without key asks for it", true);
await p2.screenshot({ path: `${OUT}/06-encrypted-gate.png` });
await p2.fill("input[placeholder=Key]", encUrl.split("#")[1]);
await p2.click("button:has-text('Decrypt')");
await p2.waitForFunction(() => document.body.innerText.includes("SECRET_VALUE_123"), null, { timeout: 15000 });
check("manual key decrypts", true);
await ctx2.close();

// ---- Password encrypted
await page.goto(BASE + "/");
await page.fill("textarea[name=content]", "PW_SECRET");
await setSwitch(page, "Encrypt in browser", true);
await setSwitch(page, "Protect with a password instead of a link key", true);
await page.fill('input[aria-label=Password]', "hunter2");
await page.click('button[type=submit]');
await page.waitForURL(/\/[A-Za-z0-9]{8}$/, { timeout: 15000 });
await page.waitForSelector("input[placeholder=Password]");
await page.fill("input[placeholder=Password]", "wrong");
await page.click("button:has-text('Decrypt')");
await page.waitForFunction(() => document.body.innerText.includes("wrong key"), null, { timeout: 15000 });
check("wrong password rejected", true);
await page.fill("input[placeholder=Password]", "hunter2");
await page.click("button:has-text('Decrypt')");
await page.waitForFunction(() => document.body.innerText.includes("PW_SECRET"), null, { timeout: 20000 });
check("password decrypts", true);

// ---- Burn after read
await page.goto(BASE + "/");
await page.fill("textarea[name=content]", "BURN_ME");
await setSwitch(page, "Encrypt in browser", false);
await setSwitch(page, "Burn after read", true);
await page.click('button[type=submit]');
await page.waitForURL(/\/[A-Za-z0-9]{8}$/, { timeout: 15000 });
const burnUrl = page.url();
await page.waitForSelector("button:has-text('Reveal and destroy')");
await page.screenshot({ path: `${OUT}/07-burn-gate.png` });
check("burn gate shown before reveal", true);
const ctx3 = await browser.newContext();
const p3 = await ctx3.newPage();
await p3.goto(burnUrl);
await p3.waitForSelector("button:has-text('Reveal and destroy')");
check("burn paste survives a page load without reveal", true);
await p3.click("button:has-text('Reveal and destroy')");
await p3.waitForFunction(() => document.body.innerText.includes("BURN_ME"), null, { timeout: 15000 });
check("burn reveal shows content", true);
await p3.reload();
check("burned paste is gone (404)", (await p3.locator("text=Nothing here").count()) > 0);
await ctx3.close();

// ---- Short link
await page.goto(BASE + "/");
await setSwitch(page, "Encrypt in browser", false);
await setSwitch(page, "Burn after read", false);
await page.fill("textarea[name=content]", "https://example.com/some/long/path?utm=1");
check("editor hints about shortening", (await page.locator("form").innerText()).includes("short link"));
await page.click('button[type=submit]');
await page.waitForURL(/\/[A-Za-z0-9]{8}\+$/, { timeout: 15000 });
await page.waitForSelector("text=goes to");
check("short link preview page", (await page.locator("body").innerText()).includes("example.com"));
await page.screenshot({ path: `${OUT}/12-short-link.png` });
const shortId = page.url().match(/\/([A-Za-z0-9]{8})\+$/)[1];
const redir = await page.request.get(`${BASE}/${shortId}`, { maxRedirects: 0 });
check("bare short link redirects", redir.status() === 307 && redir.headers()["location"] === "https://example.com/some/long/path?utm=1");

// ---- Docs + 404 + mobile
await page.goto(BASE + "/docs");
check("docs page", (await page.locator("h1").count()) > 0);
await page.screenshot({ path: `${OUT}/08-docs.png`, fullPage: true });
await page.goto(BASE + "/zzzzzzzz");
check("404 page", (await page.locator("text=Nothing here").count()) > 0);
// iOS Safari zooms the page when a focused control is under 16px, so on touch screens every control must be 16px+.
await page.goto(BASE + "/");
check("desktop keeps the 13.5px editor", await page.evaluate(() => !matchMedia("(pointer: coarse)").matches && getComputedStyle(document.querySelector(".editor-textarea")).fontSize === "13.5px"));
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mobile.newPage();
mp.on("pageerror", (e) => errors.push(String(e)));
mp.on("console", (m) => m.type() === "error" && !/404/.test(m.text()) && errors.push(m.text()));
const controlSizes = (pg) =>
  pg.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea")]
      .filter((el) => el.getClientRects().length)
      .map((el) => `${el.getAttribute("aria-label") || el.name || el.tagName}=${getComputedStyle(el).fontSize}`),
  );
const allBig = (sizes) => sizes.length > 0 && sizes.every((s) => parseFloat(s.split("=")[1]) >= 16);
const settle = (pg) => pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
const bottomSheet = (pg) =>
  pg.evaluate(async () => {
    const d = document.querySelector("dialog[open]");
    await Promise.all(d.getAnimations().map((a) => a.finished));
    const r = d.getBoundingClientRect();
    return Math.abs(r.bottom - window.innerHeight) <= 1 && r.left === 0 && Math.abs(r.width - window.innerWidth) <= 1;
  });
await mp.goto(BASE + "/");
check("mobile context is a coarse pointer", await mp.evaluate(() => matchMedia("(pointer: coarse)").matches));
let sizes = await controlSizes(mp);
check("home controls are 16px+ on touch", sizes.length >= 2 && allBig(sizes), sizes.join(", "));
check(
  "editor gutter matches textarea metrics on touch",
  await mp.evaluate(() => {
    const g = getComputedStyle(document.querySelector(".editor-gutter"));
    const t = getComputedStyle(document.querySelector(".editor-textarea"));
    return g.fontSize === t.fontSize && g.lineHeight === t.lineHeight && g.fontFamily === t.fontFamily && parseFloat(t.fontSize) >= 16;
  }),
);
// App shell: the editor fills the screen edge to edge above a bottom bar; the desktop chip row is gone.
check("mobile home has a bottom bar", await mp.locator('nav[aria-label="Editor actions"]').isVisible());
check("desktop option chips hidden on mobile", !(await mp.locator("select[name=lang]").isVisible()));
check(
  "editor fills the screen above the bar",
  await mp.evaluate(() => {
    const card = document.querySelector("form").firstElementChild.getBoundingClientRect();
    const bar = document.querySelector('nav[aria-label="Editor actions"]').getBoundingClientRect();
    return Math.abs(card.bottom - bar.top) <= 1 && card.left === 0 && Math.abs(card.right - window.innerWidth) <= 1 && Math.abs(bar.bottom - window.innerHeight) <= 1;
  }),
);
await settle(mp);
await mp.screenshot({ path: `${OUT}/09-mobile-home.png` });
// Options sheet: anchored to the bottom and driving the same state as the desktop chips.
await mp.click('nav[aria-label="Editor actions"] button:has-text("Options")');
await mp.waitForSelector("dialog[open]");
check("options open as a bottom sheet", await bottomSheet(mp));
sizes = await controlSizes(mp);
check("sheet controls are 16px+ on touch", allBig(sizes), sizes.join(", "));
await mp.selectOption('dialog[open] select[aria-label="Expiry"]', "1h");
await mp.click('dialog[open] button[role=switch]:has-text("Burn after read")');
await settle(mp);
await mp.screenshot({ path: `${OUT}/11-mobile-options.png` });
await mp.click('dialog[open] button:has-text("Done")');
await mp.waitForSelector("dialog[open]", { state: "detached" });
check(
  "sheet closes and the editor reflects the options",
  (await mp.locator("form").innerText()).includes("burn") && (await mp.locator("select[name=expires]").inputValue()) === "1h",
);
check("closing the sheet returns focus to the Options button", await mp.evaluate(() => document.activeElement?.textContent?.trim() === "Options"));
// Dragging the sheet header down dismisses it, like a native sheet.
await mp.click('nav[aria-label="Editor actions"] button:has-text("Options")');
await mp.waitForSelector("dialog[open]");
await settle(mp);
await mp.evaluate(() => {
  const head = document.querySelector("dialog[open] h2").parentElement.parentElement;
  const touch = (type, y) =>
    head.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: head, clientX: 200, clientY: y })] }));
  touch("touchstart", 700);
  touch("touchmove", 760);
  touch("touchmove", 840);
  touch("touchend", 840);
});
await mp.waitForSelector("dialog[open]", { state: "detached", timeout: 3000 });
check("swiping the sheet down dismisses it", true);
await mp.click('button[aria-label="Your pastes"]');
sizes = await controlSizes(mp);
check("open-by-id input is 16px+ on touch", sizes.some((s) => s.startsWith("Open a paste")) && allBig(sizes), sizes.join(", "));
check(
  "pastes menu spans the width on mobile",
  await mp.evaluate(() => {
    const r = document.getElementById("your-pastes").getBoundingClientRect();
    return r.left === 0 && Math.abs(r.width - window.innerWidth) <= 1;
  }),
);
await settle(mp);
await mp.screenshot({ path: `${OUT}/16-mobile-pastes.png` });
await mp.click('button[aria-label="Your pastes"]');
// Paste page: bottom bar, hidden desktop toolbar, full-bleed code, More sheet, Share sheet.
await mp.goto(pasteUrl);
await mp.waitForSelector("h1");
check("paste toolbar hidden on mobile", !(await mp.locator("[role=toolbar]").isVisible()));
check("paste page has a bottom bar", await mp.locator('nav[aria-label="Paste actions"]').isVisible());
check(
  "code block is full-bleed on mobile",
  await mp.evaluate(() => {
    const r = document.querySelector(".code").getBoundingClientRect();
    return r.left === 0 && Math.abs(r.right - window.innerWidth) <= 1;
  }),
);
check("no horizontal overflow on mobile", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await settle(mp);
await mp.screenshot({ path: `${OUT}/10-mobile-paste.png` });
await mp.click('nav[aria-label="Paste actions"] button:has-text("More")');
await mp.waitForSelector("dialog[open]");
const moreText = await mp.locator("dialog[open]").innerText();
check("more sheet lists the secondary actions", await bottomSheet(mp) && ["Wrap long lines", "Download", "Fork", "Edit", "Delete", "Report"].every((t) => moreText.includes(t)), moreText.replace(/\s+/g, " ").slice(0, 120));
await settle(mp);
await mp.screenshot({ path: `${OUT}/13-mobile-more.png` });
await mp.keyboard.press("Escape");
await mp.waitForSelector("dialog[open]", { state: "detached" });
await mp.click('nav[aria-label="Paste actions"] button:has-text("Share")');
await mp.waitForSelector("dialog[open]");
check("share opens as a bottom sheet", await bottomSheet(mp));
await settle(mp);
await mp.screenshot({ path: `${OUT}/14-mobile-share.png` });
await mp.keyboard.press("Escape");
await mp.waitForSelector("dialog[open]", { state: "detached" });
// Edit mode on a phone: hand over the edit token saved by the desktop flow, then check the editor fills the screen without a dead scroll.
const savedPastes = await page.evaluate(() => localStorage.getItem("paster:pastes"));
await mp.evaluate((v) => localStorage.setItem("paster:pastes", v), savedPastes);
await mp.reload();
await mp.waitForSelector("h1");
await mp.click('nav[aria-label="Paste actions"] button:has-text("More")');
await mp.click('dialog[open] button:has-text("Edit")');
await mp.waitForSelector("textarea[name=content]");
await settle(mp);
check(
  "phone edit mode fills the screen above the bar without scrolling",
  await mp.evaluate(() => {
    const card = document.querySelector("form").firstElementChild.getBoundingClientRect();
    const bar = document.querySelector('nav[aria-label="Editor actions"]').getBoundingClientRect();
    return document.documentElement.scrollHeight <= window.innerHeight + 1 && Math.abs(card.bottom - bar.top) <= 1 && card.top <= 50;
  }),
);
await mp.screenshot({ path: `${OUT}/17-mobile-edit.png` });
await mp.click('button:has-text("Cancel")');
await mp.waitForSelector("h1");
// Dark theme on the phone layout.
await mp.emulateMedia({ colorScheme: "dark" });
await mp.evaluate(() => {
  localStorage.setItem("theme", "dark");
  document.documentElement.classList.add("dark");
});
await mp.goto(BASE + "/");
await mp.waitForSelector("textarea[name=content]");
await settle(mp);
await mp.screenshot({ path: `${OUT}/15-mobile-home-dark.png` });
await mobile.close();
// Without JavaScript a phone still gets the desktop option chips (the form submits without the bar or sheets).
const nojs = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
const np = await nojs.newPage();
await np.goto(BASE + "/");
check("no-js phone keeps the option chips", (await np.locator("select[name=lang]").isVisible()) && !(await np.locator('nav[aria-label="Editor actions"]').isVisible()));
await nojs.close();

check("no console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
