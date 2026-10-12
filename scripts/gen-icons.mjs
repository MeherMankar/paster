// Generates every raster icon from src/app/icon.svg with the bundled Chromium.
// Usage: CHROMIUM_PATH=/path/to/chromium node scripts/gen-icons.mjs
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("src/app/icon.svg", "utf8");
// Maskable icons are cropped to a circle/squircle by launchers: full-bleed background, glyph in the inner 60%.
const maskable = svg.replace('rx="14"', 'rx="0"').replace("<rect x=", '<g transform="translate(32 32) scale(0.72) translate(-32 -32)"><rect x=').replace("</svg>", "</g></svg>");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(source, size, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? "transparent" : "#15171a"}">${source.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  return page.screenshot({ type: "png", omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", await render(svg, 192, true));
writeFileSync("public/icons/icon-512.png", await render(svg, 512, true));
writeFileSync("public/icons/maskable-512.png", await render(maskable, 512, false));
// iOS ignores transparency and adds its own corner radius: ship a square, opaque tile.
writeFileSync("src/app/apple-icon.png", await render(svg.replace('rx="14"', 'rx="0"'), 180, false));

// favicon.ico with PNG entries (16, 32, 48) — supported by every current browser.
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await render(svg, s, true));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const entries = [];
let offset = 6 + 16 * sizes.length;
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s === 256 ? 0 : s, 0);
  e.writeUInt8(s === 256 ? 0 : s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(e);
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
await browser.close();
console.log("wrote public/icons/*, src/app/apple-icon.png, src/app/favicon.ico");
