// Renders the store images (store/images/src/*.html) to PNG with headless Chrome.
// Usage: npm run store:images   (set CHROME to the browser binary if it is not found)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "store/images/src");
const out = join(root, "store/images");

const chrome = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(p => p && existsSync(p));
if (!chrome) throw new Error("Chrome not found; set CHROME to its path.");

const images = [
  { page: "promo-small.html", file: "promo-small-440x280.png", w: 440, h: 280 },
  { page: "promo-marquee.html", file: "promo-marquee-1400x560.png", w: 1400, h: 560 },
  { page: "store-icon.html", file: "store-icon-128.png", w: 128, h: 128, transparent: true },
];

for (const img of images) {
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--window-size=${img.w},${img.h}`,
    ...(img.transparent ? ["--default-background-color=00000000"] : []),
    `--screenshot=${join(out, img.file)}`,
    pathToFileURL(join(src, img.page)).href,
  ], { stdio: "ignore" });
  console.log("wrote", img.file);
}
