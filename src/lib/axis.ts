// axis.com "FTP" HTML index: product folders, version folders and release notes.
// Fetches send the browser's axis.com cookies, so a signed-in session is reused.

export const BASE = "https://www.axis.com";
export const SOURCES = {
  MPQT: "/ftp/pub_soft/MPQT/",
  PACS: "/ftp/pub_soft/PACS/",
} as const;
export type Source = keyof typeof SOURCES;

// AXIS OS long-term-support tracks (major.minor → label). Add new LTS tracks here.
export const LTS_TRACKS: Record<string, string> = {
  "8.40": "LTS 2018",
  "9.80": "LTS 2020",
  "10.12": "LTS 2022",
  "11.11": "LTS 2024",
  "12.11": "LTS 2026",
};
export const RELEASE_NOTES = "https://help.axis.com/axis-os-release-notes";
export const INDEX_TTL_MS = 12 * 60 * 60 * 1000;

export interface Entry {
  name: string;
  isDir: boolean;
  url: string;
  path: string;
  modified: string;
  size: string;
  sha256: string;
}
export interface Listing {
  entries: Entry[];
  links: { text: string; url: string }[];
}
export interface Product {
  name: string;
  src: Source;
  modified: string;
}
export interface Version {
  nums: number[];
  special: boolean;
  suffix?: string;
  name: string;
  path: string;
  modified: string;
  /** Shown instead of the numbers (the "latest" folder of products without numbered builds). */
  label?: string;
  isLatest?: boolean;
  /** Variant folder the build lives in (P1455-LE_29_mm for P1455-LE), when not the product's own. */
  variant?: Product;
}
export interface ProductVersions {
  versions: Version[];
  links: Listing["links"];
  extras: Entry[];
  path: string;
  latest?: Entry;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const displayName = (name: string) => name.replace(/_/g, " ");

// ---------- listing scraper ----------

const listingCache = new Map<string, Listing>();

export async function fetchListing(path: string, fresh = false): Promise<Listing> {
  if (fresh) listingCache.delete(path);
  const cached = listingCache.get(path);
  if (cached) return cached;
  const res = await fetch(BASE + path, { credentials: "include", cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");

  const entries: Entry[] = [];
  for (const row of doc.querySelectorAll("tbody tr")) {
    const a = row.querySelector("td a");
    if (!a || a.getAttribute("href") === "../") continue;
    const raw = a.textContent!.trim();
    const isDir = !!row.querySelector('img[alt="[DIR]"]') || raw.endsWith("/");
    const url = new URL(a.getAttribute("href")!, BASE + path);
    entries.push({
      name: raw.replace(/\/$/, ""),
      isDir,
      url: url.href,
      path: url.pathname,
      modified: row.querySelector(".modified")?.textContent!.trim() || "",
      size: row.querySelector(".size")?.textContent!.trim() || "",
      sha256: row.querySelector(".sha256")?.textContent!.trim() || "",
    });
  }
  const links = [...doc.querySelectorAll<HTMLAnchorElement>(".product-links a")].map(a => ({ text: a.textContent!.trim(), url: a.href }));

  const listing = { entries, links };
  listingCache.set(path, listing);
  return listing;
}

// ---------- versions ----------

// "12_11_147" → [12,11,147]; "9_80_3_10" → [9,80,3,10]; "10_12_195_TTA" → special build.
export function parseVersion(name: string): Pick<Version, "nums" | "special" | "suffix"> | null {
  if (/^\d+(_\d+){2,}$/.test(name)) return { nums: name.split("_").map(Number), special: false };
  const m = name.match(/^(\d+(?:_\d+){2,})_(.+)$/);
  if (m) return { nums: m[1].split("_").map(Number), special: true, suffix: m[2] };
  return null;
}

export function cmpNums(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export const versionLabel = (v: Version) => v.label || v.nums.join(".") + (v.special ? ` ${v.suffix}` : "");
export const ltsOf = (v: Version) => (v.special || v.isLatest ? undefined : LTS_TRACKS[`${v.nums[0]}.${v.nums[1]}`]);
export const newest = (vs: Version[]) => (vs.length ? vs.reduce((a, b) => (cmpNums(a.nums, b.nums) >= 0 ? a : b)) : null);
export const latestLts = (vs: Version[]) => newest(vs.filter(v => ltsOf(v)));
export const latestActive = (vs: Version[]) => newest(vs.filter(v => !v.special));

export interface TrackCard {
  v: Version;
  badge: { kind: "active" | "lts" | "old"; text: string };
  isActive: boolean;
}

// One card per AXIS OS major (its newest build), plus the LTS track when a
// newer non-LTS minor exists in the same major.
export function buildTracks(versions: Version[]): TrackCard[] {
  const standard = versions.filter(v => !v.special && !v.isLatest);
  if (!standard.length) return [];
  const top = newest(standard)!;
  const byKey = new Map<string, Version>();
  const keep = (key: string, v: Version) => {
    const cur = byKey.get(key);
    if (!cur || cmpNums(v.nums, cur.nums) > 0) byKey.set(key, v);
  };
  for (const v of standard) {
    keep(`major:${v.nums[0]}`, v);
    if (ltsOf(v)) keep(`lts:${v.nums[0]}.${v.nums[1]}`, v);
  }

  const cards: TrackCard[] = [];
  const seen = new Set<string>();
  for (const v of [...byKey.values()].sort((a, b) => cmpNums(b.nums, a.nums))) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    const lts = ltsOf(v);
    // LTS wins over "newest": the active track is by definition a non-LTS track,
    // so a product whose newest build is LTS has no active track at all.
    const isActive = v === top && !lts;
    const badge = lts
      ? { kind: "lts" as const, text: lts }
      : isActive
        ? { kind: "active" as const, text: "Active" }
        : { kind: "old" as const, text: "Latest in OS " + v.nums[0] };
    cards.push({ v, badge, isActive });
  }
  return cards;
}

// Version folders of a product, newest first.
export async function loadVersions(p: Product): Promise<ProductVersions> {
  const path = SOURCES[p.src] + p.name + "/";
  const { entries, links } = await fetchListing(path);
  const versions: Version[] = [];
  const extras: Entry[] = [];
  for (const e of entries.filter(e => e.isDir)) {
    const v = parseVersion(e.name);
    if (v) versions.push({ ...v, name: e.name, path: e.path, modified: e.modified });
    else if (e.name !== "latest") extras.push(e);
  }
  versions.sort((a, b) => cmpNums(b.nums, a.nums) || Number(a.special) - Number(b.special));
  const latest = entries.find(e => e.isDir && e.name === "latest");
  // Old products (P3215) and some new ones (P1455-LE) have no numbered folder, only
  // "latest". Its ver.txt names the version when there is one (6.50.2); without it
  // the folder is offered as "Latest", version not published.
  if (latest && !versions.some(v => !v.special)) {
    const ver = await latestVersion(latest.path);
    versions.unshift(ver
      ? { nums: ver, special: false, name: "latest", path: latest.path, modified: latest.modified }
      : { nums: [0], special: false, name: "latest", label: "Latest", isLatest: true, path: latest.path, modified: latest.modified });
  }
  return { versions, links, extras, path, latest };
}

// "6.50.2" from latest/ver.txt; null when there is none (the request then ends on an
// HTML "Page not found" page, so only a bare version number counts).
async function latestVersion(path: string) {
  try {
    const res = await fetch(BASE + path + "ver.txt", { credentials: "include" });
    const text = res.ok ? (await res.text()).trim() : "";
    return /^\d+(\.\d+){1,3}$/.test(text) ? text.split(".").map(Number) : null;
  } catch {
    return null;
  }
}

// The .bin files of one version folder.
export async function firmwareFiles(v: Version) {
  const { entries } = await fetchListing(v.path);
  const files = entries.filter(f => !f.isDir && /\.bin$/i.test(f.name));
  if (!files.length) throw new Error("no .bin firmware file in this version folder");
  return files;
}

// ---------- release notes ----------

// Anchor ids on the release notes page. Builds get "axis-os-12-11-147", tracks
// "lts-2026-12-11" / "axis-os-13". Older builds move to archive pages, so we only
// deep-link anchors that actually exist and fall back to the track section.
export async function fetchNoteAnchors() {
  const html = await (await fetch(RELEASE_NOTES, { cache: "no-cache" })).text();
  return [...new Set([...html.matchAll(/id="((?:axis-os|lts)-[\w-]+)"/g)].map(m => m[1]))];
}

export function releaseNotesUrl(v: Version, anchors: Set<string>) {
  const [major, minor] = v.nums;
  const lts = ltsOf(v);
  const candidates = [
    `axis-os-${v.nums.join("-")}`,
    lts && `lts-${lts.replace(/\D/g, "")}-${major}-${minor}`,
    `axis-os-${major}-${minor}`,
    `axis-os-${major}-archived-release-notes`,
    `axis-os-${major}`,
  ].filter(Boolean) as string[];
  const anchor = candidates.find(id => anchors.has(id));
  return RELEASE_NOTES + (anchor ? "#" + anchor : "");
}

// ---------- sign-in ----------

export const LOGIN_URL = BASE + "/my-axis/login";
// axis.com sets this cookie while signed in.
export const AUTH_COOKIE = "axis_auth";
// Any firmware file works as a probe: signed out, axis.com redirects the
// download to its login page. Listings are public, so they cannot tell.
const PROBE = BASE + "/ftp/pub_soft/MPQT/P1455-LE/latest/P1455-LE.bin";

// true / false, or null when axis.com could not be asked (offline, probe moved).
// No axis_auth cookie answers "signed out" at once; a cookie is confirmed with the
// probe, since it can outlive a session that expired on the server.
export async function checkSignedIn(probe = PROBE): Promise<boolean | null> {
  const cookie = await chrome.cookies.get({ url: BASE, name: AUTH_COOKIE });
  if (!cookie || (cookie.expirationDate && cookie.expirationDate * 1000 < Date.now())) return false;
  try {
    const res = await fetch(probe, { method: "HEAD", credentials: "include", cache: "no-store" });
    // Signed out the download ends on a login page: /my-axis/login, which itself
    // redirects to the login service (eu.login.connect.axis.com/login).
    const end = new URL(res.url);
    if (/(^|\.)login\./.test(end.hostname) || /\/login(\/|$)/.test(end.pathname)) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}

// ---------- sizes ----------

export function parseSize(s: string | undefined) {
  const m = /^([\d.]+)\s*([KMG]?)/i.exec(s || "");
  if (!m) return 0;
  return parseFloat(m[1]) * ({ "": 1, K: 1e3, M: 1e6, G: 1e9 } as Record<string, number>)[m[2].toUpperCase()];
}
export const fmtSize = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + " MB");
