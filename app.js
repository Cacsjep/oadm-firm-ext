// OADM Firmware — product search, AXIS OS track overview and batch download list.
// Listings are scraped from the axis.com "FTP" HTML index; downloads go through
// chrome.downloads so the browser's axis.com cookies are reused.

const BASE = "https://www.axis.com";
const SOURCES = {
  MPQT: "/ftp/pub_soft/MPQT/",
  PACS: "/ftp/pub_soft/PACS/",
};
// AXIS OS long-term-support tracks (major.minor → label). Add new LTS tracks here.
const LTS_TRACKS = {
  "8.40": "LTS 2018",
  "9.80": "LTS 2020",
  "10.12": "LTS 2022",
  "11.11": "LTS 2024",
  "12.11": "LTS 2026"
};
const RELEASE_NOTES = "https://help.axis.com/axis-os-release-notes";
const INDEX_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SUGGESTIONS = 12;

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const displayName = name => name.replace(/_/g, " ");

// ---------- storage ----------

const store = {
  async get(key, fallback) {
    const res = await chrome.storage.local.get(key);
    return res[key] ?? fallback;
  },
  set(key, value) {
    return chrome.storage.local.set({ [key]: value });
  },
};

// ---------- listing scraper ----------

const listingCache = new Map();

async function fetchListing(path) {
  if (listingCache.has(path)) return listingCache.get(path);
  const res = await fetch(BASE + path, { credentials: "include", cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");

  const entries = [];
  for (const row of doc.querySelectorAll("tbody tr")) {
    const a = row.querySelector("td a");
    if (!a || a.getAttribute("href") === "../") continue;
    const raw = a.textContent.trim();
    const isDir = !!row.querySelector('img[alt="[DIR]"]') || raw.endsWith("/");
    entries.push({
      name: raw.replace(/\/$/, ""),
      isDir,
      url: new URL(a.getAttribute("href"), BASE + path).href,
      path: new URL(a.getAttribute("href"), BASE + path).pathname,
      modified: row.querySelector(".modified")?.textContent.trim() || "",
      size: row.querySelector(".size")?.textContent.trim() || "",
      sha256: row.querySelector(".sha256")?.textContent.trim() || "",
    });
  }
  const links = [...doc.querySelectorAll(".product-links a")].map(a => ({ text: a.textContent.trim(), url: a.href }));

  const listing = { entries, links };
  listingCache.set(path, listing);
  return listing;
}

// ---------- versions ----------

// "12_11_147" → [12,11,147]; "9_80_3_10" → [9,80,3,10]; "10_12_195_TTA" → special build.
function parseVersion(name) {
  if (/^\d+(_\d+){2,}$/.test(name)) return { nums: name.split("_").map(Number), special: false };
  const m = name.match(/^(\d+(?:_\d+){2,})_(.+)$/);
  if (m) return { nums: m[1].split("_").map(Number), special: true, suffix: m[2] };
  return null;
}

function cmpNums(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

const versionLabel = v => v.nums.join(".") + (v.special ? ` ${v.suffix}` : "");

// One card per AXIS OS major (its newest build), plus the LTS track when a
// newer non-LTS minor exists in the same major.
function buildTracks(versions) {
  const standard = versions.filter(v => !v.special);
  if (!standard.length) return [];
  const newest = standard.reduce((a, b) => (cmpNums(a.nums, b.nums) >= 0 ? a : b));
  const byKey = new Map();
  const keep = (key, v) => {
    const cur = byKey.get(key);
    if (!cur || cmpNums(v.nums, cur.nums) > 0) byKey.set(key, v);
  };
  for (const v of standard) {
    keep(`major:${v.nums[0]}`, v);
    const track = `${v.nums[0]}.${v.nums[1]}`;
    if (LTS_TRACKS[track]) keep(`lts:${track}`, v);
  }

  const cards = [];
  const seen = new Set();
  for (const v of [...byKey.values()].sort((a, b) => cmpNums(b.nums, a.nums))) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    const track = `${v.nums[0]}.${v.nums[1]}`;
    // LTS wins over "newest": the active track is by definition a non-LTS track,
    // so a product whose newest build is LTS has no active track at all.
    const isActive = v === newest && !LTS_TRACKS[track];
    let badge;
    if (LTS_TRACKS[track]) badge = { cls: "lts", text: LTS_TRACKS[track] };
    else if (isActive) badge = { cls: "active", text: "Active" };
    else badge = { cls: "old", text: "Latest in OS " + v.nums[0] };
    cards.push({ v, badge, isActive });
  }
  return cards;
}

// ---------- product index ----------

let products = [];
let sourcesOn = { MPQT: true, PACS: true };

async function loadIndex(force = false) {
  $("#indexStatus").textContent = "Loading product index…";
  const cached = await store.get("productIndex");
  if (!force && cached && Date.now() - cached.at < INDEX_TTL_MS) {
    products = cached.products;
  } else {
    try {
      const lists = await Promise.all(
        Object.entries(SOURCES).map(async ([src, path]) => {
          listingCache.delete(path);
          const { entries } = await fetchListing(path);
          return entries.filter(e => e.isDir).map(e => ({ name: e.name, src, modified: e.modified }));
        })
      );
      products = lists.flat().sort((a, b) => a.name.localeCompare(b.name));
      await store.set("productIndex", { at: Date.now(), products });
    } catch (err) {
      products = cached?.products || [];
      toast("Could not load product index: " + err.message);
    }
  }
  const at = (await store.get("productIndex"))?.at;
  $("#indexStatus").textContent =
    `${products.length} products` + (at ? ` · ${new Date(at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}` : "");
}

function searchProducts(q) {
  const nq = norm(q);
  if (!nq) return [];
  const hits = [];
  for (const p of products) {
    if (!sourcesOn[p.src]) continue;
    const n = norm(p.name);
    const i = n.indexOf(nq);
    if (i < 0) continue;
    hits.push({ p, score: n === nq ? 0 : i === 0 ? 1 : 2 + i / 100 });
  }
  return hits.sort((a, b) => a.score - b.score || a.p.name.length - b.p.name.length).slice(0, MAX_SUGGESTIONS).map(h => h.p);
}

// ---------- autocomplete ----------

const input = $("#search");
const suggest = $("#suggest");
let suggestions = [];
let selIdx = -1;

function highlight(name, q) {
  const label = displayName(name);
  const i = label.toLowerCase().indexOf(q.trim().toLowerCase());
  if (!q.trim() || i < 0) return esc(label);
  return esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + q.trim().length)) + "</mark>" + esc(label.slice(i + q.trim().length));
}

function renderSuggest() {
  const q = input.value;
  if (!q.trim()) return closeSuggest();
  suggestions = searchProducts(q);
  if (selIdx >= suggestions.length) selIdx = suggestions.length - 1;
  suggest.innerHTML = suggestions.length
    ? suggestions.map((p, i) => `
        <li role="option" data-i="${i}" aria-selected="${i === selIdx}">
          <span class="name">${highlight(p.name, q)}</span>
          <span class="date">${esc(p.modified.split(" ")[0])}</span>
        </li>`).join("")
    : `<li class="none">No products match “${esc(q)}”</li>`;
  suggest.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function closeSuggest() {
  suggest.hidden = true;
  selIdx = -1;
  input.setAttribute("aria-expanded", "false");
}

function pick(p) {
  input.value = displayName(p.name);
  closeSuggest();
  showProduct(p);
}

input.addEventListener("input", () => { selIdx = 0; renderSuggest(); });
input.addEventListener("focus", () => input.value && renderSuggest());
input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (suggest.hidden) renderSuggest();
    if (!suggestions.length) return;
    e.preventDefault();
    selIdx = (selIdx + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
    renderSuggest();
    suggest.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    const hit = suggestions[selIdx] || suggestions.find(p => norm(p.name) === norm(input.value));
    if (hit) pick(hit);
  } else if (e.key === "Escape") {
    closeSuggest();
  }
});
suggest.addEventListener("mousedown", e => {
  const li = e.target.closest("li[data-i]");
  if (li) { e.preventDefault(); pick(suggestions[+li.dataset.i]); }
});
input.addEventListener("blur", () => setTimeout(closeSuggest, 100));
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); input.select(); }
});

// ---------- product view ----------

const productEl = $("#product");
let current = null; // { p, versions }

async function showProduct(p) {
  $("#empty").hidden = true;
  productEl.hidden = false;
  productEl.innerHTML = `<div class="loading"><span class="spinner"></span>Loading versions for ${esc(displayName(p.name))}…</div>`;
  const path = SOURCES[p.src] + p.name + "/";
  try {
    const { entries, links } = await fetchListing(path);
    const versions = [];
    const extras = [];
    for (const e of entries.filter(e => e.isDir)) {
      const v = parseVersion(e.name);
      if (v) versions.push({ ...v, name: e.name, path: e.path, modified: e.modified });
      else if (e.name !== "latest") extras.push(e);
    }
    versions.sort((a, b) => cmpNums(b.nums, a.nums) || (a.special - b.special));
    current = { p, versions, links, extras, path };
    renderProduct();
  } catch (err) {
    productEl.innerHTML = `<div class="error">Could not load ${esc(p.name)}: ${esc(err.message)}</div>`;
  }
}

// ---------- release notes ----------

// Anchor ids on the release notes page. Builds get "axis-os-12-11-147", tracks
// "lts-2026-12-11" / "axis-os-13". Older builds move to archive pages, so we only
// deep-link anchors that actually exist and fall back to the track section.
let noteAnchors = new Set();

async function loadNoteAnchors() {
  const cached = await store.get("noteAnchors");
  if (cached && Date.now() - cached.at < INDEX_TTL_MS) {
    noteAnchors = new Set(cached.ids);
  } else {
    try {
      const html = await (await fetch(RELEASE_NOTES, { cache: "no-cache" })).text();
      const ids = [...new Set([...html.matchAll(/id="((?:axis-os|lts)-[\w-]+)"/g)].map(m => m[1]))];
      noteAnchors = new Set(ids);
      await store.set("noteAnchors", { at: Date.now(), ids });
    } catch {
      noteAnchors = new Set(cached?.ids || []);
    }
  }
  renderProduct();
}

function releaseNotesUrl(v) {
  const [major, minor] = v.nums;
  const lts = LTS_TRACKS[`${major}.${minor}`];
  const candidates = [
    `axis-os-${v.nums.join("-")}`,
    lts && `lts-${lts.replace(/\D/g, "")}-${major}-${minor}`,
    `axis-os-${major}-${minor}`,
    `axis-os-${major}-archived-release-notes`,
    `axis-os-${major}`,
  ].filter(Boolean);
  const anchor = candidates.find(id => noteAnchors.has(id));
  return RELEASE_NOTES + (anchor ? "#" + anchor : "");
}

function notesLink(v, text = "Release notes") {
  if (v.special) return "";
  return `<a class="notes" href="${esc(releaseNotesUrl(v))}" target="_blank" rel="noopener" title="AXIS OS ${esc(versionLabel(v))} release notes">${text}<svg viewBox="0 0 24 24"><path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H6v10h10v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg></a>`;
}

function addButton(v) {
  const added = list.some(i => i.dir === v.path);
  return `<button class="btn ${added ? "added" : "primary"} sm" data-add="${esc(v.path)}">${added ? "✓ In list" : "+ Add"}</button>`;
}

function renderProduct() {
  if (!current) return;
  const { p, versions, links, extras, path } = current;
  const cards = buildTracks(versions);
  productEl.innerHTML = `
    <div class="product-head">
      <h2>AXIS ${esc(displayName(p.name))}</h2>
      <div class="links">
        ${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("")}
        <a href="${esc(BASE + path)}" target="_blank" rel="noopener">FTP folder</a>
      </div>
    </div>
    ${cards.length ? `<div class="tracks">${cards.map(c => `
      <div class="track ${c.isActive ? "is-active" : ""}">
        <div class="track-top"><span class="track-os">AXIS OS ${c.v.nums[0]}</span><span class="badge ${c.badge.cls}">${esc(c.badge.text)}</span></div>
        <div class="track-ver">${esc(versionLabel(c.v))}</div>
        <div class="track-meta">Released ${esc(c.v.modified.split(" ")[0] || "—")}${notesLink(c.v)}</div>
        ${addButton(c.v)}
      </div>`).join("")}</div>`
      : `<div class="error">No firmware versions found in this folder.</div>`}
    ${versions.length ? `
      <details class="all-versions">
        <summary>All versions (${versions.length})</summary>
        <table class="versions">
          <thead><tr><th>Version</th><th>Track</th><th>Date</th><th>Notes</th><th></th></tr></thead>
          <tbody>${versions.map(v => {
            const track = `${v.nums[0]}.${v.nums[1]}`;
            return `<tr><td class="mono">${esc(versionLabel(v))}</td><td>${v.special ? "Special build" : esc(LTS_TRACKS[track] || "AXIS OS " + v.nums[0])}</td><td>${esc(v.modified)}</td><td>${notesLink(v, "View")}</td><td>${addButton(v)}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </details>` : ""}
    ${extras.length ? `<div class="extra-dirs">Other folders: ${extras.map(e => `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a>`).join(", ")}</div>` : ""}
  `;
}

productEl.addEventListener("click", async e => {
  const btn = e.target.closest("[data-add]");
  if (!btn || !current) return;
  const dir = btn.dataset.add;
  if (list.some(i => i.dir === dir)) {
    list = list.filter(i => i.dir !== dir);
    return saveList();
  }
  const v = current.versions.find(v => v.path === dir);
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>`;
  try {
    const { entries } = await fetchListing(dir);
    const files = entries.filter(f => !f.isDir && /\.bin$/i.test(f.name));
    if (!files.length) throw new Error("no .bin firmware file in this version folder");
    for (const f of files) {
      if (list.some(i => i.url === f.url)) continue;
      list.push({
        url: f.url, dir, file: f.name, product: current.p.name, src: current.p.src,
        version: versionLabel(v), size: f.size, sha256: f.sha256, state: "queued",
      });
    }
    toast(`Added ${displayName(current.p.name)} ${versionLabel(v)}`);
  } catch (err) {
    toast("Could not add: " + err.message);
  }
  saveList();
});

// ---------- download list ----------

let list = [];
let pollTimer = null;

function parseSize(s) {
  const m = /^([\d.]+)\s*([KMG]?)/i.exec(s || "");
  if (!m) return 0;
  return parseFloat(m[1]) * ({ "": 1, K: 1e3, M: 1e6, G: 1e9 })[m[2].toUpperCase()];
}
const fmtSize = b => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + " MB");

function stateHtml(i) {
  switch (i.state) {
    case "downloading": {
      const pct = i.total ? Math.round((i.received / i.total) * 100) : 0;
      return `<div class="state"><div class="bar"><i style="width:${pct}%"></i></div>${pct}%</div>`;
    }
    case "complete": return `<div class="state complete">✓ Downloaded</div>`;
    case "auth": return `<div class="state auth">Got a login page instead of firmware. <a href="https://www.axis.com/" target="_blank" rel="noopener" data-external>Sign in on axis.com</a>, then download again.</div>`;
    case "failed": return `<div class="state failed">Failed: ${esc(i.error || "unknown error")}</div>`;
    default: return "";
  }
}

function renderList() {
  const el = $("#dlList");
  el.innerHTML = list.map((i, idx) => `
    <li>
      <div><span class="p">${esc(displayName(i.product))}</span><span class="v">${esc(i.version)}</span></div>
      <div class="f" title="${esc(i.file)}">${esc(i.file)} · ${esc(i.size)}</div>
      <button class="x" data-remove="${idx}" title="Remove"><svg viewBox="0 0 24 24"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg></button>
      ${stateHtml(i)}
    </li>`).join("");
  $("#dlEmpty").hidden = list.length > 0;
  const total = list.reduce((s, i) => s + parseSize(i.size), 0);
  $("#listMeta").textContent = list.length ? `${list.length} file${list.length > 1 ? "s" : ""} · ${fmtSize(total)}` : "0 files";
  const pending = list.filter(i => i.state !== "complete" && i.state !== "downloading").length;
  $("#downloadAll").disabled = !pending;
  $("#clearList").disabled = !list.length;
}

function saveList() {
  store.set("dlList", list);
  renderList();
  renderProduct();
}

$("#dlList").addEventListener("click", e => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  list.splice(+btn.dataset.remove, 1);
  saveList();
});

$("#clearList").addEventListener("click", () => {
  list = [];
  saveList();
});

$("#downloadAll").addEventListener("click", async () => {
  for (const i of list) {
    if (i.state === "complete" || i.state === "downloading") continue;
    try {
      i.dlId = await chrome.downloads.download({
        url: i.url,
        filename: i.file,
        conflictAction: "uniquify",
        saveAs: false,
      });
      Object.assign(i, { state: "downloading", received: 0, total: parseSize(i.size), error: "" });
    } catch (err) {
      Object.assign(i, { state: "failed", error: err.message });
    }
  }
  saveList();
  startPolling();
});

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollDownloads, 600);
}

async function pollDownloads() {
  const active = list.filter(i => i.state === "downloading" && i.dlId != null);
  if (!active.length) { clearInterval(pollTimer); pollTimer = null; return; }
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
  store.set("dlList", list);
  renderList();
}

// ---------- page viewer ----------

// External links open in a slide-in panel instead of a new tab. Links marked
// data-external (sign-in, "open in new tab") keep their normal behaviour.
const viewerFrame = $("#viewerFrame");
const viewerLoading = $("#viewerLoading");

function openViewer(url, title) {
  $("#viewerTitle").textContent = title || new URL(url).hostname;
  $("#viewerExternal").href = url;
  const sameDoc = viewerFrame.src.split("#")[0] === url.split("#")[0];
  // A hash change on the same page only scrolls, so no load event will fire.
  viewerLoading.hidden = sameDoc;
  viewerFrame.src = url;
  document.body.classList.add("viewer-open");
  $("#viewer").setAttribute("aria-hidden", "false");
}

function closeViewer() {
  document.body.classList.remove("viewer-open");
  $("#viewer").setAttribute("aria-hidden", "true");
}

viewerFrame.addEventListener("load", () => (viewerLoading.hidden = true));
$("#viewerClose").addEventListener("click", closeViewer);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.body.classList.contains("viewer-open") && document.activeElement !== input) closeViewer();
});

document.addEventListener("click", e => {
  const a = e.target.closest('a[target="_blank"]');
  if (!a || a.hasAttribute("data-external") || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const product = current ? `AXIS ${displayName(current.p.name)} · ` : "";
  openViewer(a.href, (a.title || product + a.textContent.trim()).replace(/\s+/g, " "));
});

// Drag the left edge to resize; width is remembered per browser.
try {
  const w = localStorage.getItem("viewerWidth");
  if (w) document.documentElement.style.setProperty("--viewer-w", w + "px");
} catch {}
$("#viewerResize").addEventListener("pointerdown", e => {
  e.preventDefault();
  document.body.classList.add("viewer-resizing");
  const move = ev => {
    const w = Math.round(Math.min(Math.max(window.innerWidth - ev.clientX, 320), window.innerWidth - 360));
    document.documentElement.style.setProperty("--viewer-w", w + "px");
    try { localStorage.setItem("viewerWidth", w); } catch {}
  };
  const up = () => {
    document.body.classList.remove("viewer-resizing");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

// ---------- misc UI ----------

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

for (const src of Object.keys(SOURCES)) {
  const cb = $("#src" + src);
  cb.addEventListener("change", () => {
    sourcesOn[src] = cb.checked;
    store.set("sourcesOn", sourcesOn);
    if (input.value) renderSuggest();
  });
}

$("#refreshIndex").addEventListener("click", () => loadIndex(true));

// ---------- boot ----------

(async () => {
  sourcesOn = await store.get("sourcesOn", sourcesOn);
  for (const src of Object.keys(SOURCES)) $("#src" + src).checked = sourcesOn[src] !== false;
  list = await store.get("dlList", []);
  renderList();
  if (list.some(i => i.state === "downloading")) startPolling();
  loadNoteAnchors();
  await loadIndex();
  input.focus();
})();
