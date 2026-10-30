// App state shared by the components: product index, current product, download
// list and imported devices. Persisted in chrome.storage.local.

import { computed, reactive, ref, shallowRef, toRaw } from "vue";
import { toast } from "vue-sonner";
import {
  INDEX_TTL_MS, SOURCES, type Product, type ProductVersions, type Source, type Version,
  AUTH_COOKIE, checkSignedIn, displayName, fetchListing, latestLts, fetchNoteAnchors, firmwareFiles, loadVersions, norm, parseSize, versionLabel,
} from "@/lib/axis";
import { allowAxisFramesInThisTab } from "@/lib/frames";
import { type Device, type ImportedList, type Track, cleanModel, matchProduct, planFor, readDeviceFile, variantsOf } from "@/lib/devices";

const store = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const res = await chrome.storage.local.get(key);
    return (res[key] as T) ?? fallback;
  },
  set(key: string, value: unknown) {
    // Reactive proxies do not survive structured clone; store plain data.
    return chrome.storage.local.set({ [key]: JSON.parse(JSON.stringify(toRaw(value))) });
  },
};

// ---------- product index ----------

export const products = shallowRef<Product[]>([]);
export const indexAt = ref<number | null>(null);
export const indexLoading = ref(false);
export const sourcesOn = reactive<Record<Source, boolean>>({ MPQT: true, PACS: true });

export async function loadIndex(force = false) {
  indexLoading.value = true;
  const cached = await store.get<{ at: number; products: Product[] } | null>("productIndex", null);
  if (!force && cached && Date.now() - cached.at < INDEX_TTL_MS) {
    products.value = cached.products;
    indexAt.value = cached.at;
  } else {
    try {
      const lists = await Promise.all(
        (Object.keys(SOURCES) as Source[]).map(async src => {
          const { entries } = await fetchListing(SOURCES[src], true);
          return entries.filter(e => e.isDir).map(e => ({ name: e.name, src, modified: e.modified }));
        }),
      );
      products.value = lists.flat().sort((a, b) => a.name.localeCompare(b.name));
      indexAt.value = Date.now();
      await store.set("productIndex", { at: indexAt.value, products: products.value });
    } catch (err) {
      products.value = cached?.products || [];
      indexAt.value = cached?.at ?? null;
      toast.error("Could not load product index", { description: (err as Error).message });
    }
  }
  indexLoading.value = false;
}

export function searchProducts(q: string, max = 12) {
  const nq = norm(q);
  if (!nq) return [];
  const hits: { p: Product; score: number }[] = [];
  for (const p of products.value) {
    if (!sourcesOn[p.src]) continue;
    const n = norm(p.name);
    const i = n.indexOf(nq);
    if (i < 0) continue;
    hits.push({ p, score: n === nq ? 0 : i === 0 ? 1 : 2 + i / 100 });
  }
  return hits.sort((a, b) => a.score - b.score || a.p.name.length - b.p.name.length).slice(0, max).map(h => h.p);
}

export function setSource(src: Source, on: boolean) {
  sourcesOn[src] = on;
  store.set("sourcesOn", sourcesOn);
}

// ---------- release notes ----------

export const noteAnchors = shallowRef(new Set<string>());

async function loadNoteAnchors() {
  const cached = await store.get<{ at: number; ids: string[] } | null>("noteAnchors", null);
  if (cached && Date.now() - cached.at < INDEX_TTL_MS) {
    noteAnchors.value = new Set(cached.ids);
    return;
  }
  try {
    const ids = await fetchNoteAnchors();
    noteAnchors.value = new Set(ids);
    await store.set("noteAnchors", { at: Date.now(), ids });
  } catch {
    noteAnchors.value = new Set(cached?.ids || []);
  }
}

// ---------- product view ----------

export const current = shallowRef<({ p: Product } & ProductVersions) | null>(null);
export const currentLoading = shallowRef<Product | null>(null);
export const currentError = ref("");

// Bumped by every show/close, so a slow load cannot reopen a product the user left.
let productSeq = 0;

export async function showProduct(p: Product) {
  const seq = ++productSeq;
  currentLoading.value = p;
  currentError.value = "";
  try {
    const loaded = { p, ...(await loadVersions(p)) };
    if (seq === productSeq) current.value = loaded;
  } catch (err) {
    if (seq !== productSeq) return;
    current.value = null;
    currentError.value = `Could not load ${p.name}: ${(err as Error).message}`;
  }
  if (seq === productSeq) currentLoading.value = null;
}

export function closeProduct() {
  productSeq++;
  current.value = null;
  currentLoading.value = null;
  currentError.value = "";
}

// ---------- axis.com sign-in ----------

// null until checked, or when axis.com could not be asked.
export const signedIn = ref<boolean | null>(null);

// Probes with a queued file when there is one (it is what will be downloaded).
export async function refreshSignIn() {
  const queued = list.value.find(i => i.state !== "complete")?.url;
  signedIn.value = await checkSignedIn(queued);
  return signedIn.value;
}

// ---------- download list ----------

export interface ListItem {
  url: string;
  dir: string;
  file: string;
  product: string;
  src: Source;
  version: string;
  size: string;
  sha256: string;
  state: "queued" | "downloading" | "complete" | "auth" | "failed";
  dlId?: number;
  received?: number;
  total?: number;
  error?: string;
}

export const list = ref<ListItem[]>([]);
const saveList = () => store.set("dlList", list.value);

export const inList = (dir: string) => list.value.some(i => i.dir === dir);
export const totalSize = computed(() => list.value.reduce((s, i) => s + parseSize(i.size), 0));
export const pendingCount = computed(() => list.value.filter(i => i.state !== "complete" && i.state !== "downloading").length);

// Queues the .bin files of one version folder.
export async function addToList(p: Product, v: Version) {
  for (const f of await firmwareFiles(v)) {
    if (list.value.some(i => i.url === f.url)) continue;
    list.value.push({
      url: f.url, dir: v.path, file: f.name, product: p.name, src: p.src,
      version: versionLabel(v), size: f.size, sha256: f.sha256, state: "queued",
    });
  }
  saveList();
}

export function removeDir(dir: string) {
  list.value = list.value.filter(i => i.dir !== dir);
  saveList();
}

export function removeItem(idx: number) {
  list.value.splice(idx, 1);
  saveList();
}

export function clearList() {
  list.value = [];
  saveList();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export async function downloadAll() {
  if ((await refreshSignIn()) === false) {
    toast.error("Sign in to axis.com first", { description: "Downloading firmware needs a signed-in axis.com account." });
    return;
  }
  for (const i of list.value) {
    if (i.state === "complete" || i.state === "downloading") continue;
    try {
      i.dlId = await chrome.downloads.download({ url: i.url, filename: i.file, conflictAction: "uniquify", saveAs: false });
      Object.assign(i, { state: "downloading", received: 0, total: parseSize(i.size), error: "" });
    } catch (err) {
      Object.assign(i, { state: "failed", error: (err as Error).message });
    }
  }
  saveList();
  startPolling();
}

function startPolling() {
  if (!pollTimer) pollTimer = setInterval(pollDownloads, 600);
}

async function pollDownloads() {
  const active = list.value.filter(i => i.state === "downloading" && i.dlId != null);
  if (!active.length) { clearInterval(pollTimer!); pollTimer = null; return; }
  for (const i of active) {
    const [d] = await chrome.downloads.search({ id: i.dlId });
    if (!d) { Object.assign(i, { state: "failed", error: "download was removed" }); continue; }
    i.received = d.bytesReceived;
    if (d.totalBytes > 0) i.total = d.totalBytes;
    if (d.state === "complete") {
      // A login redirect saves a small HTML page instead of the firmware.
      const isHtml = /html/i.test(d.mime || "") || (d.fileSize < 100_000 && parseSize(i.size) > 1e6);
      i.state = isHtml ? "auth" : "complete";
    } else if (d.state === "interrupted") {
      Object.assign(i, { state: "failed", error: d.error || "interrupted" });
    }
  }
  saveList();
}

// ---------- imported devices ----------

export const fleet = ref<ImportedList | null>(null);
// Product name → versions, or the error loading them.
const fleetVersions = reactive(new Map<string, Version[] | { error: string }>());

export interface FleetRow {
  key: string;
  model: string;
  raw: string;
  devices: Device[];
  match: { p: Product; exact: boolean } | null;
  plan: ReturnType<typeof planFor>;
}

export const fleetRows = computed<FleetRow[]>(() => {
  if (!fleet.value) return [];
  const groups = new Map<string, Omit<FleetRow, "plan">>();
  for (const d of fleet.value.devices) {
    const model = cleanModel(d.model);
    const key = norm(model) || "?";
    if (!groups.has(key)) groups.set(key, { key, model: model || "Unknown model", raw: d.model, devices: [], match: model ? matchProduct(model, products.value) : null });
    groups.get(key)!.devices.push(d);
  }
  return [...groups.values()]
    .sort((a, b) => Number(!a.match) - Number(!b.match) || a.model.localeCompare(b.model))
    .map(g => ({ ...g, plan: planFor(g.devices, g.match ? fleetVersions.get(g.match.p.name) : undefined, !!g.match, g.match ? fleet.value!.choice?.[g.match.p.name] : undefined, fleet.value!.track) }));
});

export const fleetLoading = computed(() => fleetRows.value.some(r => r.plan.state === "loading"));

// Loads version lists of matched products, 4 at a time.
export async function loadFleetVersions() {
  const todo = [...new Map(fleetRows.value.filter(r => r.match && !fleetVersions.has(r.match.p.name)).map(r => [r.match!.p.name, r.match!.p])).values()];
  const worker = async () => {
    for (let p; (p = todo.shift());) {
      try {
        const { versions } = await loadVersions(p);
        if (versions.some(v => !v.special && !v.isLatest)) { fleetVersions.set(p.name, versions); continue; }
        // Some products (P1455-LE) keep their numbered builds in variant folders
        // (P1455-LE_29_mm, P1455-LE_9_mm). The device list does not say which
        // variant a device is, so all are offered, after the product's own
        // "latest" folder (which has no version number).
        const variants = await Promise.all(variantsOf(p, products.value).map(async q =>
          (await loadVersions(q).catch(() => ({ versions: [] as Version[] }))).versions.map(v => ({ ...v, variant: q }))));
        fleetVersions.set(p.name, [...versions, ...variants.flat()]);
      } catch (err) {
        fleetVersions.set(p.name, { error: (err as Error).message });
      }
    }
  };
  await Promise.all([1, 2, 3, 4].map(worker));
}

const saveFleet = () => store.set("fleet", fleet.value);

export async function importFile(file: File) {
  try {
    fleet.value = readDeviceFile(file.name, await file.text());
    saveFleet();
    toast.success(`Imported ${fleet.value.devices.length} devices`, { description: `${fleet.value.source} · ${file.name}` });
    loadFleetVersions();
  } catch (err) {
    toast.error("Could not import", { description: (err as Error).message });
  }
}

export function clearFleet() {
  fleet.value = null;
  saveFleet();
}

export function choose(row: FleetRow, path: string) {
  if (!fleet.value || !row.match) return;
  fleet.value.choice = { ...fleet.value.choice, [row.match.p.name]: path };
  saveFleet();
}

// A product picked in the search while devices are imported becomes a row of its own.
export function addFleetProduct(p: Product) {
  if (!fleet.value) return;
  if (fleetRows.value.some(r => r.match?.p.name === p.name)) return toast(`${displayName(p.name)} is already in the list`);
  fleet.value.devices.push({ model: displayName(p.name), firmware: "", added: true });
  saveFleet();
  loadFleetVersions();
  toast(`Added ${displayName(p.name)} to the list`);
}

export function removeFleetRow(row: FleetRow) {
  if (!fleet.value) return;
  fleet.value.devices = fleet.value.devices.filter(d => !row.devices.includes(d));
  saveFleet();
}

export async function addSelected(rows: FleetRow[]) {
  let failed = 0;
  for (const r of rows) {
    const v = r.plan.selected;
    if (!v || !r.match || inList(v.path)) continue;
    try { await addToList(v.variant || r.match.p, v); } catch { failed++; }
  }
  if (failed) toast.error(`${failed} version${failed > 1 ? "s" : ""} could not be added`);
}

// Sets every row's version: recommended (each device's own track), the newest
// LTS build, or the newest build. Picks made in single rows are dropped.
export function applyTrack(track: Track) {
  if (!fleet.value) return;
  fleet.value.track = track;
  fleet.value.choice = {};
  saveFleet();
  const noLts = track === "lts" ? fleetRows.value.filter(r => r.plan.versions.length && !latestLts(r.plan.versions)).length : 0;
  if (noLts) toast(`${noLts} model${noLts > 1 ? "s" : ""} without an LTS build get the newest build`);
}

// Rows whose chosen version is not queued yet.
export const notQueued = computed(() => fleetRows.value.filter(r => r.match && r.plan.selected && !inList(r.plan.selected.path)));

export async function addAll() {
  const rows = notQueued.value;
  await addSelected(rows);
  toast.success(`Added firmware for ${rows.length} model${rows.length === 1 ? "" : "s"}`);
}

// ---------- boot ----------

export async function boot() {
  // Before anything can open the viewer (the login opens it right away).
  await allowAxisFramesInThisTab().catch(() => {});
  Object.assign(sourcesOn, await store.get("sourcesOn", sourcesOn));
  list.value = await store.get<ListItem[]>("dlList", []);
  if (list.value.some(i => i.state === "downloading")) startPolling();
  loadNoteAnchors();
  refreshSignIn();
  // Signing in happens in another tab; check again when the user comes back, and
  // as soon as the axis_auth cookie is set or removed.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshSignIn(); });
  chrome.cookies.onChanged.addListener(({ cookie }) => {
    if (cookie.name === AUTH_COOKIE && cookie.domain.endsWith("axis.com")) refreshSignIn();
  });
  await loadIndex();
  fleet.value = await store.get<ImportedList | null>("fleet", null);
  loadFleetVersions();
}

export async function refreshIndex() {
  await loadIndex(true);
  loadFleetVersions();
}
