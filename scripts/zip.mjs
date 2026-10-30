// Packs dist/ into release/oadm-firmware-downloader-<version>.zip for the Chrome Web Store,
// with manifest.json at the top of the zip. Run after the build (npm run zip does both).
import AdmZip from "adm-zip";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
if (!existsSync(join(dist, "manifest.json"))) throw new Error("dist/manifest.json missing; run the build first.");

const { version } = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
mkdirSync(join(root, "release"), { recursive: true });
const file = join(root, "release", `oadm-firmware-downloader-${version}.zip`);

const zip = new AdmZip();
zip.addLocalFolder(dist);
zip.writeZip(file);
console.log("wrote", file);
