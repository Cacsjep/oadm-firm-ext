// Device lists from OADM (Export devices .csv, or any CSV with a Model column)
// and AXIS Device Manager (device export .json, file format 1.x and 2.x: both
// keep model + firmwareVersion in data.deviceData.devices; passwords and tags,
// where the two differ, are never read). Models are matched to a product folder
// and get the newest build of the track they are on.

import { type Product, type Version, cmpNums, latestActive, latestLts, ltsOf, newest, norm } from "./axis";

export type Track = "recommended" | "lts" | "active";

export interface Device {
  model: string;
  firmware: string;
  /** Picked in the search, not from the file: no device behind it. */
  added?: boolean;
}
export interface ImportedList {
  file: string;
  source: string;
  devices: Device[];
  /** Product name → chosen version folder. */
  choice?: Record<string, string>;
  /** What every row was last set to with the "set all" select. */
  track?: Track;
}

// Separator from the header line: OADM writes tags as "Building A; PTZ" unquoted,
// so ";" only separates when the header has no comma (Excel in some locales).
export function parseCsv(text: string) {
  const header = text.split(/\r?\n/, 1)[0];
  const sep = !header.includes(",") && header.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim()));
}

export function readCsvDevices(text: string) {
  const [head = [], ...rows] = parseCsv(text);
  const col = (re: RegExp) => head.findIndex(h => re.test(h.trim()));
  const model = col(/^(model|product|product name)$/i);
  const firmware = col(/^(firmware|firmware version)$/i);
  if (model < 0) throw new Error("the CSV has no Model column. Use Export devices in OADM.");
  const isOadm = col(/^mac address$/i) >= 0 && firmware >= 0;
  return {
    source: isOadm ? "OADM" : "CSV",
    devices: rows.map(r => ({ model: (r[model] || "").trim(), firmware: ((firmware >= 0 && r[firmware]) || "").trim() })),
  };
}

// Property names case-insensitive, like OADM's own ADM reader.
function prop(o: unknown, name: string): unknown {
  if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
  const key = Object.keys(o).find(k => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : (o as Record<string, unknown>)[key];
}

export function readAdmDevices(text: string) {
  let root: unknown;
  try { root = JSON.parse(text); } catch { throw new Error("the file is not a device export of AXIS Device Manager."); }
  if (prop(root, "encrypted") === true) throw new Error("the export is encrypted. Export the devices again in AXIS Device Manager without encryption.");
  const major = prop(root, "fileFormatVersionMayor");
  const version = Number.isInteger(major) ? major : 1;
  const devices = prop(prop(prop(root, "data"), "deviceData"), "devices");
  if (!Array.isArray(devices)) throw new Error("the file is not a device export of AXIS Device Manager.");
  return {
    source: `ADM ${version}.x`,
    devices: devices.filter(d => d && typeof d === "object").map(d => ({
      model: String(prop(d, "model") ?? "").trim(),
      firmware: String(prop(d, "firmwareVersion") ?? "").trim(),
    })),
  };
}

export function readDeviceFile(name: string, raw: string): ImportedList {
  const text = raw.replace(/^﻿/, "");
  const parsed = /^\s*[{[]/.test(text) ? readAdmDevices(text) : readCsvDevices(text);
  if (!parsed.devices.length) throw new Error("the file contains no devices.");
  return { file: name, ...parsed, choice: {} };
}

// "AXIS P3265-LVE Dome Camera" / "AXIS M3046-V 1.8mm (50Hz)" → "P3265-LVE" / "M3046-V 1.8mm"
export function cleanModel(raw: string) {
  return raw
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^axis\s+/i, "")
    .replace(/\s+(network|dome|bullet|box|ptz|panoramic|thermal|modular|fixed|fisheye|cube|mini|positioning|horn|cabinet|ceiling|door|network\s+\w+)*\s*(camera|cameras|encoder|speaker|intercom|station|radar|recorder|decoder|controller|reader)$/i, "")
    .trim();
}

// Exact (case/punctuation-insensitive) folder match first, else the longest folder
// the model starts with up to a word break (M3206-LVE-EUR → M3206-LVE, shown as a
// guess). Word breaks keep P12 Mk III from matching P12_MkII.
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function matchProduct(model: string, products: Product[]) {
  const n = norm(model);
  if (!n) return null;
  const w = words(model) + " ";
  let guess: Product | null = null, guessLen = 0;
  for (const p of products) {
    if (n === norm(p.name) || n === norm(p.name).replace(/^axis/, "")) return { p, exact: true };
    const k = words(p.name) + " ";
    if (k.length > guessLen && k.length >= 5 && w.startsWith(k)) { guess = p; guessLen = k.length; }
  }
  return guess ? { p: guess, exact: false } : null;
}

// Variant folders of a product: its name plus an underscore suffix (P1455-LE →
// P1455-LE_29_mm, P1455-LE_9_mm). A dash suffix is a different model
// (P1455-LE-3), so it is not a variant.
export function variantsOf(p: Product, products: Product[]) {
  return products.filter(q => q.src === p.src && q.name.startsWith(p.name + "_"));
}

export function parseInstalled(s: string) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(s || "");
  return m ? m.slice(1).filter(x => x !== undefined).map(Number) : null;
}

// Newest build of the installed track: an LTS install stays on its LTS track,
// anything else gets the newest build of the same AXIS OS major.
export function targetFor(versions: Version[], installed: string) {
  const standard = versions.filter(v => !v.special);
  if (!standard.length) return null;
  const nums = parseInstalled(installed);
  let pool = standard;
  if (nums) {
    const lts = ltsOf({ nums, special: false, name: "", path: "", modified: "" });
    const same = standard.filter(v => v.nums[0] === nums[0] && (!lts || v.nums[1] === nums[1]));
    if (same.length) pool = same;
  }
  return newest(pool);
}

export interface Plan {
  installed: Map<string, number>;
  state: "loading" | "error" | "none" | "ready";
  versions: Version[];
  recommended: Version | null;
  selected: Version | null;
  upToDate: boolean;
}

// Installed version → count, the versions on offer and the chosen one (the
// user's pick, else what the list-wide setting gives; recommended = the newest
// build of the installed track, and the newest build for products picked in the search).
export function planFor(devices: Device[], versions: Version[] | { error: string } | undefined, matched: boolean, choice?: string, track: Track = "recommended"): Plan {
  const installed = new Map<string, number>();
  for (const d of devices) if (!d.added) installed.set(d.firmware || "?", (installed.get(d.firmware || "?") || 0) + 1);
  const empty = { installed, versions: [], recommended: null, selected: null, upToDate: false };
  if (!Array.isArray(versions)) return { ...empty, state: versions ? "error" : matched ? "loading" : "none" };
  const recommended = installed.size
    ? newest([...installed.keys()].map(fw => targetFor(versions, fw)).filter((v): v is Version => !!v))
    : latestActive(versions);
  // A pick in the row wins; else the list-wide setting (no LTS build → newest build).
  const byTrack = track === "lts" ? latestLts(versions) || latestActive(versions) : track === "active" ? latestActive(versions) : recommended;
  const selected = versions.find(v => v.path === choice) || byTrack;
  const upToDate = !!selected && !selected.isLatest && installed.size > 0 && [...installed.keys()].every(fw => {
    const nums = parseInstalled(fw);
    return !!nums && cmpNums(nums, selected.nums) >= 0;
  });
  return { installed, state: "ready", versions, recommended, selected, upToDate };
}
