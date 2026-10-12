#!/usr/bin/env node
/**
 * paster — paste from the terminal.
 *
 * Zero dependencies (Node ≥ 20). Talks to any paster instance over its HTTP API and
 * implements the same AES-256-GCM envelope as the website, so `paster -E` pastes are
 * end-to-end encrypted without ever opening a browser.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as util from "node:util";
import { createInterface } from "node:readline";

// styleText landed in Node 20.12; older 20.x runs without colour.
const { parseArgs } = util;
const styleText = util.styleText ?? ((_style, s) => s);

export const VERSION = "0.4.3";
const NAME = "paster";
const DEFAULT_HOST = "https://paster.meher.tech";

// ---------------------------------------------------------------------------
// Terminal styling: colour only on a TTY, never when piped or under NO_COLOR,
// so `paster | pbcopy` and scripts see plain text.
// ---------------------------------------------------------------------------

const OUT_TTY = !process.env.NO_COLOR && !!process.stdout.isTTY;
const ERR_TTY = !process.env.NO_COLOR && !!process.stderr.isTTY;
const paint = (style) => (s) => (OUT_TTY && styleText ? styleText(style, s) : s);
const bold = paint("bold");
const dim = paint("dim");
const cyan = paint("cyan");
const yellow = paint("yellow");
const green = paint("green");
const link = paint(["cyan", "underline"]);

const len = (s) => [...s].length;
const fit = (s, n) => (len(s) > n ? [...s].slice(0, Math.max(n - 1, 0)).join("") + "…" : s.padEnd(n));

/** Box-drawn table sized to the terminal; column `shrink` gives up characters first, then the widest. */
export function table(head, rows, styles = [], shrink = -1, width = process.stdout.columns || 120, selected = -1) {
  const w = head.map((h, i) => Math.max(len(h), ...rows.map((r) => len(r[i]))));
  let over = w.reduce((a, b) => a + b, 0) + 3 * w.length + 1 - width;
  while (over > 0) {
    const i = w[shrink] > 8 ? shrink : w.indexOf(Math.max(...w));
    if (w[i] <= 8) break;
    w[i]--;
    over--;
  }
  const rule = (l, m, r) => dim(l + w.map((n) => "─".repeat(n + 2)).join(m) + r);
  const line = (cells, f) => dim("│ ") + cells.map((c, i) => (f[i] ?? ((s) => s))(fit(c, w[i]))).join(dim(" │ ")) + dim(" │");
  const body = rows.map((r, i) => (i === selected ? line(r, r.map(() => paint("inverse"))) : line(r, styles)));
  return [rule("╭", "┬", "╮"), line(head, head.map(() => bold)), rule("├", "┼", "┤"), ...body, rule("╰", "┴", "╯")].join("\n") + "\n";
}

const ok = (msg) => out(`${OUT_TTY ? green("✓ ") : ""}${msg}\n`);
const note = (msg) => process.stderr.write(ERR_TTY ? styleText("dim", `  ${msg}\n`) : `${msg}\n`);

// ---------------------------------------------------------------------------
// Config & history
// ---------------------------------------------------------------------------

export function configDir() {
  if (process.env.PASTER_CONFIG_DIR || process.env.PASTR_CONFIG_DIR) return process.env.PASTER_CONFIG_DIR || process.env.PASTR_CONFIG_DIR;
  if (platform() === "win32") return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), NAME);
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), NAME);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

export function getConfig() {
  return readLegacyAware("config.json", {});
}

export function setConfig(patch) {
  writeJson(join(configDir(), "config.json"), { ...getConfig(), ...patch });
}

export function getHistory() {
  const now = Date.now();
  return readLegacyAware("history.json", []).filter((p) => p.expires === null || p.expires === undefined || p.expires > now);
}

function readLegacyAware(file, fallback) {
  const current = join(configDir(), file);
  if (existsSync(current)) return readJson(current, fallback);
  if (process.env.PASTER_CONFIG_DIR || process.env.PASTR_CONFIG_DIR) return fallback;
  const oldDir = platform() === "win32"
    ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "pastr")
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "pastr");
  return readJson(join(oldDir, file), fallback);
}

function remember(entry) {
  const list = getHistory().filter((p) => p.id !== entry.id);
  list.unshift(entry);
  writeJson(join(configDir(), "history.json"), list.slice(0, 500));
}

function forget(id) {
  writeJson(
    join(configDir(), "history.json"),
    getHistory().filter((p) => p.id !== id),
  );
}

export function resolveHost(flag) {
  const host = flag || process.env.PASTER_HOST || process.env.PASTR_HOST || getConfig().host || DEFAULT_HOST;
  return host.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Crypto — identical envelope to the website (src/lib/crypto.ts)
// ---------------------------------------------------------------------------

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
export const PBKDF2_ITERATIONS = 600_000;

export const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
export const unb64u = (s) => new Uint8Array(Buffer.from(s, "base64url"));

async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptEnvelope(envelope, opts) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(envelope));
  if (opts.password === undefined) {
    const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    const raw = await subtle.exportKey("raw", key);
    return { ciphertext: b64u(ct), meta: { alg: "AES-GCM", kdf: "fragment", iv: b64u(iv) }, fragment: b64u(raw) };
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(opts.password, salt);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { ciphertext: b64u(ct), meta: { alg: "AES-GCM", kdf: "password", iv: b64u(iv), salt: b64u(salt), iterations: PBKDF2_ITERATIONS } };
}

export async function decryptEnvelope(ciphertext, meta, secret) {
  const key =
    secret.fragment !== undefined
      ? await subtle.importKey("raw", unb64u(secret.fragment), { name: "AES-GCM" }, false, ["decrypt"])
      : await deriveKey(secret.password, unb64u(meta.salt), meta.iterations ?? PBKDF2_ITERATIONS);
  let pt;
  try {
    pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64u(meta.iv) }, key, unb64u(ciphertext));
  } catch {
    throw new CliError("wrong key or corrupted data");
  }
  return JSON.parse(dec.decode(pt));
}

// ---------------------------------------------------------------------------
// Platform helpers: clipboard, browser, prompts
// ---------------------------------------------------------------------------

const isWsl = () => platform() === "linux" && /microsoft/i.test(safeRead("/proc/version"));
function safeRead(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function tryExec(cmds, encoding = "utf8") {
  for (const [cmd, args] of cmds) {
    try {
      return execFileSync(cmd, args, { encoding, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export function readClipboard() {
  const os = platform();
  const cmds =
    os === "darwin"
      ? [["pbpaste", []]]
      : os === "win32"
        ? [["powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"]]]
        : [
            ...(process.env.WAYLAND_DISPLAY ? [["wl-paste", ["--no-newline"]]] : []),
            ["xclip", ["-selection", "clipboard", "-o"]],
            ["xsel", ["--clipboard", "--output"]],
            ...(isWsl() ? [["powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard -Raw"]]] : []),
          ];
  const out = tryExec(cmds);
  if (out === null) throw new CliError("could not read the clipboard (install wl-clipboard, xclip or xsel on Linux)");
  return out;
}

/** PNG bytes of an image on the clipboard (a screenshot, say), or null when the clipboard holds no image. */
export function readClipboardImage() {
  const os = platform();
  const ps = "$i = Get-Clipboard -Format Image; if ($i) { $m = New-Object IO.MemoryStream; $i.Save($m, [Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String($m.ToArray()) }";
  if (os === "darwin") {
    // osascript prints the PNG as «data PNGf89504E47...»
    const hex = tryExec([["osascript", ["-e", "the clipboard as «class PNGf»"]]])?.match(/PNGf([0-9A-Fa-f]+)/)?.[1];
    return hex ? Buffer.from(hex, "hex") : null;
  }
  if (os === "win32" || isWsl()) {
    const b64 = tryExec([[os === "win32" ? "powershell" : "powershell.exe", ["-NoProfile", "-Command", ps]]])?.trim();
    return b64 ? Buffer.from(b64, "base64") : null;
  }
  const buf = tryExec(
    [...(process.env.WAYLAND_DISPLAY ? [["wl-paste", ["-t", "image/png"]]] : []), ["xclip", ["-selection", "clipboard", "-t", "image/png", "-o"]]],
    "buffer",
  );
  return buf?.length ? buf : null;
}

export function writeClipboard(text) {
  const os = platform();
  const cmds =
    os === "darwin"
      ? [["pbcopy", []]]
      : os === "win32"
        ? [["clip", []]]
        : [
            ...(process.env.WAYLAND_DISPLAY ? [["wl-copy", []]] : []),
            ["xclip", ["-selection", "clipboard"]],
            ["xsel", ["--clipboard", "--input"]],
            ...(isWsl() ? [["clip.exe", []]] : []),
          ];
  for (const [cmd, args] of cmds) {
    const r = spawnSync(cmd, args, { input: text, stdio: ["pipe", "ignore", "ignore"] });
    if (r.status === 0) return true;
  }
  return false;
}

function openInBrowser(url) {
  const os = platform();
  const [cmd, args] = os === "darwin" ? ["open", [url]] : os === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const r = spawnSync(cmd, args, { stdio: "ignore" });
  return r.status === 0;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = function (s) {
      if (s.includes(question)) write.call(rl, s);
      else write.call(rl, "");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer);
    });
  });
}

async function readStdin() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  // Interactive: readline handles Ctrl-D itself, so it ends the paste on Windows too (the console's
  // Ctrl-Z convention never reaches a Node stream reliably there).
  note("Type or paste, then press Ctrl-D on an empty line to finish:");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true, prompt: "" });
  const lines = [];
  rl.on("line", (l) => lines.push(l));
  rl.on("SIGINT", () => process.exit(130));
  await new Promise((resolve) => rl.on("close", resolve));
  return lines.length ? lines.join("\n") + "\n" : "";
}

// ---------------------------------------------------------------------------
// Language from file name (mirrors the server's registry for the common cases)
// ---------------------------------------------------------------------------

const EXT = {
  txt: "text", md: "markdown", markdown: "markdown", js: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", mts: "typescript",
  jsx: "jsx", tsx: "tsx", json: "json", jsonc: "jsonc", yml: "yaml", yaml: "yaml", toml: "toml", html: "html", htm: "html", css: "css", scss: "scss",
  vue: "vue", svelte: "svelte", py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c", cpp: "cpp", cc: "cpp",
  hpp: "cpp", cs: "csharp", php: "php", rb: "ruby", dart: "dart", scala: "scala", hs: "haskell", ex: "elixir", exs: "elixir", erl: "erlang",
  clj: "clojure", lua: "lua", pl: "perl", r: "r", jl: "julia", zig: "zig", nim: "nim", ml: "ocaml", sh: "shellscript", bash: "shellscript",
  zsh: "shellscript", ps1: "powershell", bat: "bat", fish: "fish", nix: "nix", sql: "sql", graphql: "graphql", gql: "graphql", prisma: "prisma",
  proto: "proto", xml: "xml", svg: "xml", diff: "diff", patch: "diff", log: "log", csv: "csv", tex: "latex", tf: "terraform", hcl: "terraform",
  ini: "ini", conf: "ini", cfg: "ini", env: "dotenv", mmd: "mermaid", sol: "solidity", http: "http",
  png: "png", jpg: "jpeg", jpeg: "jpeg", gif: "gif", webp: "webp",
};

/** Image "languages": the content is the file as base64 and the server caps the decoded size. */
const IMAGE_LANGS = new Set(["png", "jpeg", "gif", "webp"]);
const MAX_IMAGE_BYTES = 700 * 1024;

function imageItem(buf, lang, title) {
  if (buf.length > MAX_IMAGE_BYTES) throw new CliError(`${title} is ${Math.round(buf.length / 1024)} KB; images are limited to ${MAX_IMAGE_BYTES / 1024} KB`);
  return { content: buf.toString("base64"), lang, title };
}

export function langFromFilename(name) {
  const lower = name.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".env" || lower.startsWith(".env.")) return "dotenv";
  const i = lower.lastIndexOf(".");
  return i === -1 ? undefined : EXT[lower.slice(i + 1)];
}

export function parsePasteRef(ref) {
  // Accepts an id, or a URL like https://host/AbCd1234.go#key or https://host/AbCd1234/raw
  let id = ref;
  let key;
  let host;
  try {
    const u = new URL(ref);
    host = u.origin;
    const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
    id = seg.split(".")[0];
    if (u.hash && !/^#L\d/.test(u.hash)) key = u.hash.slice(1);
  } catch {
    /* plain id */
  }
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) throw new UsageError(`"${ref}" doesn't look like a paste id or URL`);
  return { id, key, host };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class UsageError extends Error {}
class CliError extends Error {}

async function api(host, path, init = {}) {
  let res;
  try {
    res = await fetch(host + path, {
      ...init,
      headers: { Accept: "application/json", "User-Agent": `${NAME}-cli/${VERSION}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new CliError(`could not reach ${host} (${e.cause?.code ?? e.message})`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not json */
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? text.trim() ?? res.statusText;
    throw new CliError(`${res.status} ${msg}`);
  }
  return data;
}

async function createPaste(host, { content, title, lang, expires, burn, encrypt, password }) {
  let body;
  let fragment;
  if (encrypt || password !== undefined) {
    const r = await encryptEnvelope({ title, lang: lang ?? "text", content }, { password });
    fragment = r.fragment;
    body = { content: r.ciphertext, enc: r.meta, expires, burn };
  } else {
    body = { content, title, lang, expires, burn };
  }
  const p = await api(host, "/api/v1/pastes", { method: "POST", body: JSON.stringify(body) });
  const url = fragment ? `${p.url}#${fragment}` : p.url;
  remember({ id: p.id, url, editToken: p.editToken, key: fragment, title, lang: p.lang, created: p.created, expires: p.expires, burn: p.burn, encrypted: !!p.enc });
  return { ...p, url };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP = `${NAME} ${VERSION} · paste from the terminal

Usage
  ${NAME} [options] [file ...]        paste files (text, or png/jpeg/gif/webp up to 700 KB), or stdin
  ${NAME} clip [options]              paste the clipboard (text or an image)
  ${NAME} text [options] <words ...>  paste literal text
  ${NAME} get <id|url> [--json]       print a paste (decrypts when the URL carries a #key)
  ${NAME} ls [--json]                 browse pastes made here: arrows or click, enter reveals the edit token
  ${NAME} rm <id|url>                 delete a paste created from this machine
  ${NAME} token <id|url>              print the edit token (paste it into the site's Edit/Delete prompt)
  ${NAME} config [host <url>]         show or set the default host

Options
  -t, --title <text>      title (defaults to the file name)
  -l, --lang <id>         language id or alias (default: from the file name, else plain text)
  -e, --expires <when>    10m | 1h | 1d | 7d | 30d | never  (default: 7d)
  -b, --burn              destroy after the first read
  -E, --encrypt           encrypt here; the key goes in the URL after #
  -p, --password <pw>     encrypt with a password instead ("-P" prompts for it)
  -P, --ask-password      prompt for a password
  -c, --copy              copy the URL to the clipboard
  -o, --open              open the URL in a browser
  -r, --raw               print the raw URL (plain text) instead of the page URL
  -j, --json              print the full API response
  -H, --host <url>        server to use (default ${DEFAULT_HOST}; env PASTER_HOST, or \`${NAME} config host …\`)
  -h, --help              show this help
  -v, --version           show the version

Examples
  ls -la | ${NAME}
  ${NAME} main.go --expires 1d
  ${NAME} clip -E -c                  # encrypted clipboard paste, URL copied back
  ${NAME} text "hello there" -b       # burn after read
  ${NAME} get https://host/AbCd1234#key > file.txt
  ${NAME} shot.png -e 1d              # image paste; "get" writes the bytes back
`;

/** Bold section headings, cyan command/flag column, dim trailing comments. */
const styleHelp = (s) =>
  s
    .split("\n")
    .map((l) => (/^\S/.test(l) ? bold(l) : l.replace(/^(\s+)(\S.*?)(\s{2,}|$)/, (_, a, b, c) => a + cyan(b) + c).replace(/#.*$/, dim)))
    .join("\n");

function fmtRel(ms) {
  const d = ms - Date.now();
  const abs = Math.abs(d);
  const u = abs < 60e3 ? [1e3, "s"] : abs < 3600e3 ? [60e3, "m"] : abs < 86400e3 ? [3600e3, "h"] : [86400e3, "d"];
  const n = Math.round(abs / u[0]);
  return d >= 0 ? `in ${n}${u[1]}` : `${n}${u[1]} ago`;
}

const flags = (p) => [p.encrypted && "enc", p.burn && "burn"].filter(Boolean).join(" ");

/** Keys stay out of the table (`get <id>` finds them in history); the piped form has the full URL. */
function lsTable(list, selected = -1) {
  const head = ["id", "title", "lang", "created", "expires", "", "url"];
  const rows = list.map((p) => [p.id, p.title || "", p.lang || "", fmtRel(p.created), p.expires ? fmtRel(p.expires) : "never", flags(p), p.url.split("#")[0]]);
  // Narrow window: drop the url column (the id is enough for `get`) rather than mangling it.
  const need = head.reduce((sum, h, i) => sum + 3 + Math.min(i === 1 ? 20 : Infinity, Math.max(len(h), ...rows.map((r) => len(r[i])))), 1);
  if (need > (process.stdout.columns || 120)) for (const r of [head, ...rows]) r.pop();
  return table(head, rows, [cyan, undefined, dim, dim, undefined, yellow, dim], 1, process.stdout.columns || 120, selected);
}

/**
 * Interactive `ls`: arrow keys or a mouse click pick a paste, Enter (or a second click) reveals its
 * edit token, once more copies it. Runs on the alternate screen so the shell scrollback stays clean.
 */
function browse(list) {
  const { stdin, stdout } = process;
  let sel = 0;
  let revealed = false;
  let msg = "";
  let confirmDelete = false;
  const rowsVisible = () => Math.max(3, (stdout.rows || 24) - 10);
  const first = () => Math.min(Math.max(0, sel - rowsVisible() + 1), Math.max(0, list.length - rowsVisible()));
  const draw = () => {
    const p = list[sel];
    const start = first();
    const detail = [
      `  ${cyan(p.id)}  ${p.title || dim("untitled")}`,
      `  ${dim("url    ")}${link(p.url)}`,
      `  ${dim("token  ")}${p.editToken ? (revealed ? yellow(p.editToken) : dim("•".repeat(24) + "  enter to reveal")) : dim("not on this machine")}`,
      "",
      confirmDelete ? yellow(`  delete ${p.id} from the server? y/n`) : msg ? `  ${msg}` : dim("  ↑↓ move · enter reveal, again to copy token · c copy url · o open · d delete · q quit"),
    ];
    stdout.write("\x1b[H\x1b[2J" + lsTable(list.slice(start, start + rowsVisible()), sel - start) + detail.join("\n") + "\n");
  };
  const enter = async () => {
    const p = list[sel];
    if (!p.editToken) return (msg = yellow("no token stored for this paste"));
    if (!revealed) return (revealed = true);
    msg = writeClipboard(p.editToken) ? green("✓ token copied") : yellow("could not copy");
  };
  const select = (i) => {
    if (i === sel || i < 0 || i >= list.length) return false;
    sel = i;
    revealed = false;
    msg = "";
    return true;
  };
  return new Promise((resolve) => {
    const done = () => {
      stdout.write("\x1b[?1006l\x1b[?1000l\x1b[?25h\x1b[?1049l");
      stdin.setRawMode(false);
      stdin.pause();
      resolve();
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdout.write("\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h");
    draw();
    stdin.on("data", async (k) => {
      const mouse = /^\x1b\[<(\d+);(\d+);(\d+)M/.exec(k);
      if (confirmDelete) {
        confirmDelete = false;
        if (k === "y") {
          const p = list[sel];
          try {
            await api(new URL(p.url).origin, `/api/v1/pastes/${p.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${p.editToken}` } });
            forget(p.id);
            list.splice(sel, 1);
            if (!list.length) return done();
            sel = Math.min(sel, list.length - 1);
            msg = green(`✓ deleted ${p.id}`);
          } catch (err) {
            msg = yellow(err.message);
          }
        }
      } else if (mouse) {
        const [, button, , y] = mouse.map(Number);
        if (button === 64) select(sel - 1);
        else if (button === 65) select(sel + 1);
        else if (button === 0) {
          const i = y - 4 + first(); // 3 header lines above the first row
          if (i >= 0 && i < list.length && !select(i)) await enter();
        }
      } else if (k === "\x1b[A" || k === "k") select(sel - 1);
      else if (k === "\x1b[B" || k === "j") select(sel + 1);
      else if (k === "\r") await enter();
      else if (k === "c") msg = writeClipboard(list[sel].url) ? green("✓ url copied") : yellow("could not copy");
      else if (k === "o") openInBrowser(list[sel].url);
      else if (k === "d") confirmDelete = !!list[sel].editToken || ((msg = yellow("no token stored for this paste")), false);
      else if (k === "q" || k === "\x1b" || k === "\x03") return done();
      draw();
    });
  });
}

export async function main(argv) {
  const { values: o, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      title: { type: "string", short: "t" },
      lang: { type: "string", short: "l" },
      expires: { type: "string", short: "e" },
      burn: { type: "boolean", short: "b", default: false },
      encrypt: { type: "boolean", short: "E", default: false },
      password: { type: "string", short: "p" },
      "ask-password": { type: "boolean", short: "P", default: false },
      copy: { type: "boolean", short: "c", default: false },
      open: { type: "boolean", short: "o", default: false },
      raw: { type: "boolean", short: "r", default: false },
      json: { type: "boolean", short: "j", default: false },
      host: { type: "string", short: "H" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (o.help) return out(styleHelp(HELP));
  if (o.version) return out(`${NAME} ${VERSION}\n`);

  const [cmd, ...rest] = positionals;

  if (cmd === "config") {
    if (rest[0] === "host" && rest[1]) {
      setConfig({ host: rest[1].replace(/\/+$/, "") });
      return ok(`host set to ${rest[1]}`);
    }
    const cfg = getConfig();
    const hostEnv = process.env.PASTER_HOST || process.env.PASTR_HOST;
    const source = hostEnv ? "env PASTER_HOST" : cfg.host ? "config" : "default";
    return out(`${dim("host   ")} ${link(hostEnv || cfg.host || DEFAULT_HOST)} ${dim(`(${source})`)}\n${dim("config ")} ${configDir()}\n`);
  }

  if (cmd === "ls") {
    const list = getHistory();
    if (o.json) return out(JSON.stringify(list, null, 2) + "\n");
    if (!list.length) return out(`no pastes yet${OUT_TTY ? dim(` · try: ls -la | ${NAME}`) : ""}\n`);
    // Piped: one tab-separated line per paste, ISO dates. TTY: a table sized to the window.
    if (!OUT_TTY) {
      for (const p of list) out([p.id, p.title || "", p.lang || "", new Date(p.created).toISOString(), p.expires ? new Date(p.expires).toISOString() : "never", flags(p), p.url].join("\t") + "\n");
      return;
    }
    if (process.stdin.isTTY) return browse(list);
    out(lsTable(list));
    return out(dim(`  ${list.length} ${list.length === 1 ? "paste" : "pastes"} · ${NAME} get <id> · ${NAME} rm <id>\n`));
  }

  if (cmd === "get") {
    if (!rest[0]) throw new UsageError("usage: get <id|url>");
    const ref = parsePasteRef(rest[0]);
    const host = ref.host ?? resolveHost(o.host);
    const p = await api(host, `/api/v1/pastes/${ref.id}`);
    if (o.json) return out(JSON.stringify(p, null, 2) + "\n");
    if (!p.enc) return emit(p.content, p.lang);
    let secret;
    if (p.enc.kdf === "fragment") {
      const key = ref.key ?? getHistory().find((h) => h.id === ref.id)?.key;
      if (!key) throw new CliError("this paste is encrypted; pass the full URL including the #key");
      secret = { fragment: key };
    } else {
      secret = { password: o.password ?? (await promptHidden("Password: ")) };
    }
    const env = await decryptEnvelope(p.content, p.enc, secret);
    return emit(env.content, env.lang);
  }

  if (cmd === "token") {
    if (!rest[0]) throw new UsageError("usage: token <id|url>");
    const { id } = parsePasteRef(rest[0]);
    const entry = getHistory().find((h) => h.id === id);
    if (!entry?.editToken) throw new CliError(`no edit token for ${id} on this machine`);
    if (OUT_TTY) note("Anyone with this token can edit or delete the paste.");
    return out(entry.editToken + "\n");
  }

  if (cmd === "rm") {
    if (!rest[0]) throw new UsageError("usage: rm <id|url>");
    const ref = parsePasteRef(rest[0]);
    const host = ref.host ?? resolveHost(o.host);
    const entry = getHistory().find((h) => h.id === ref.id);
    const token = entry?.editToken ?? process.env.PASTER_EDIT_TOKEN ?? process.env.PASTR_EDIT_TOKEN;
    if (!token) throw new CliError(`no edit token for ${ref.id} on this machine (set PASTER_EDIT_TOKEN to use one)`);
    await api(host, `/api/v1/pastes/${ref.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    forget(ref.id);
    return ok(`deleted ${ref.id}`);
  }

  // ---- create ----
  const host = resolveHost(o.host);
  const password = o["ask-password"] ? await promptHidden("Password: ") : o.password;
  const items = [];
  if (cmd === "clip") {
    const img = readClipboardImage();
    items.push(img ? imageItem(img, "png", o.title ?? "clipboard.png") : { content: readClipboard(), title: o.title });
  } else if (cmd === "text") {
    if (!rest.length) throw new UsageError("usage: text <words ...>");
    items.push({ content: rest.join(" "), title: o.title });
  } else {
    const files = cmd ? [cmd, ...rest] : [];
    if (!files.length) items.push({ content: await readStdin(), title: o.title });
    for (const f of files) {
      if (!existsSync(f)) throw new UsageError(`no such file: ${f}`);
      const buf = readFileSync(f);
      const lang = o.lang ?? langFromFilename(basename(f));
      if (IMAGE_LANGS.has(lang)) {
        items.push(imageItem(buf, lang, o.title ?? basename(f)));
        continue;
      }
      if (buf.includes(0)) throw new CliError(`${f} looks binary; only text and png/jpeg/gif/webp images can be pasted`);
      items.push({ content: buf.toString("utf8"), title: o.title ?? basename(f), lang });
    }
  }

  for (const item of items) {
    if (!item.content.trim()) throw new CliError("nothing to paste");
    // Progress on stderr while the upload (and PBKDF2 for -p) runs, cleared before the result.
    if (ERR_TTY) process.stderr.write(styleText("dim", "  uploading…"));
    let p;
    try {
      p = await createPaste(host, { content: item.content, title: item.title, lang: item.lang ?? o.lang, expires: o.expires, burn: o.burn, encrypt: o.encrypt, password });
    } finally {
      if (ERR_TTY) process.stderr.write("\r\x1b[2K");
    }
    const url = o.raw ? p.rawUrl : p.url;
    if (p.kind === "link" && p.link) process.stderr.write(`short link → ${p.link}\n`);
    if (o.json) out(JSON.stringify(p, null, 2) + "\n");
    else out(link(url) + "\n");
    const copied = o.copy ? (writeClipboard(url) ? "copied to clipboard" : "could not copy to clipboard") : "";
    // The URL alone goes to stdout; everything else is a dim stderr line so pipes stay clean.
    if (!o.json && (ERR_TTY || copied)) {
      const meta = ERR_TTY ? [item.title, p.expires ? `expires ${fmtRel(p.expires)}` : "never expires", p.burn && "burn after read", p.enc && "encrypted", copied, `${NAME} token ${p.id} to edit on the site`] : [copied];
      note(meta.filter(Boolean).join(" · "));
    }
    if (o.open) openInBrowser(url);
  }
}

function out(s) {
  process.stdout.write(s);
}

/** Text goes out as is; image pastes are decoded so `get shot > shot.png` works. */
function emit(content, lang) {
  process.stdout.write(IMAGE_LANGS.has(lang) ? Buffer.from(content, "base64") : content);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain || (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])) {
  main(process.argv.slice(2)).catch((err) => {
    const usage = err instanceof UsageError || err?.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" || err?.code?.startsWith?.("ERR_PARSE_ARGS");
    const prefix = ERR_TTY ? styleText("red", "✗") : `${NAME}:`;
    const hint = usage ? `Run \`${NAME} --help\` for usage.\n` : "";
    process.stderr.write(`${prefix} ${err.message}\n${ERR_TTY ? styleText("dim", hint) : hint}`);
    process.exit(usage ? 2 : 1);
  });
}
