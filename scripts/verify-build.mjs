#!/usr/bin/env node
/**
 * verify-build.mjs — Gate terakhir sebelum artifact dist/ naik ke GitHub Pages.
 *
 * KENAPA FAIL INI WUJUD
 * ---------------------
 * Dua kegagalan senyap yang pernah berlaku / boleh berlaku dalam projek ini:
 *
 *   1. Sitemap mendakwa halaman yang tidak wujud.
 *      `gen-sitemap.mjs` membaca dist/*.html dan menulis sitemap. Kalau satu
 *      halaman gagal dijana (template error, frontmatter rosak), ia tidak akan
 *      muncul dalam sitemap — TETAPI rujukan kepada halaman itu dari nav/footer
 *      masih ada, dan Google akan crawl ke 404. Tiada apa pun yang menangkapnya.
 *
 *   2. Placeholder Vite tertinggal dalam output.
 *      `<% ... %>` yang tidak diganti bermakna template tidak dirender. Ia tidak
 *      menyebabkan build gagal, jadi ia boleh terbit ke produksi.
 *
 * Gate ini lulus/gagal secara eksplisit. Kalau ia gagal, JANGAN deploy —
 * betulkan punca, bukan gate.
 *
 * Guna: node scripts/verify-build.mjs
 * Keluar 0 = selamat deploy. Keluar 1 = ada masalah, rujuk output.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, relative, dirname } from "path";

const dist = resolve("dist");
const BASE = process.env.VITE_BASE || "/jejak-edu/";
const prefix = BASE.replace(/^\//, "").replace(/\/$/, "");

if (!existsSync(dist)) {
  console.error("[verify] GAGAL: dist/ tidak wujud — jalankan `npm run build` dulu.");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const allFiles = walk(dist);
const htmlFiles = allFiles.filter((p) => p.endsWith(".html"));
const relOf = (p) => relative(dist, p).replace(/\\/g, "/");
const relSet = new Set(allFiles.map(relOf));

const failures = [];
const warnings = [];

/* ------------------------------------------------------------------ 1
 * Setiap <loc> dalam sitemap.xml MESTI ada fail yang sepadan dalam dist/.
 * Ini gate utama. Sitemap yang menunjuk ke 404 merosakkan crawl budget dan
 * kelihatan seperti laman rosak di Search Console.
 */
if (!existsSync(join(dist, "sitemap.xml"))) {
  failures.push("sitemap.xml tiada dalam dist/ — gen-sitemap.mjs tidak jalan?");
} else {
  const sm = readFileSync(join(dist, "sitemap.xml"), "utf-8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  if (locs.length === 0) failures.push("sitemap.xml ada tetapi tiada <loc> langsung.");

  const expectedRoot = `${prefix}`;
  for (const loc of locs) {
    // Buang origin + prefix, tinggal path relatif dalam dist/
    let path = loc.replace(/^https?:\/\/[^/]+/, "");
    if (expectedRoot && path.startsWith("/" + expectedRoot)) {
      path = path.slice(expectedRoot.length + 1);
    }
    path = path.replace(/^\//, "");
    const target = path === "" || path.endsWith("/") ? "index.html" : path;

    if (!relSet.has(target)) {
      failures.push(`sitemap mendakwa "${loc}" tetapi dist/${target} tidak wujud.`);
    }
  }
  if (failures.length === 0) {
    console.log(`[verify] sitemap: ${locs.length} URL — semua ada fail padanan.`);
  }
}

/* ------------------------------------------------------------------ 2
 * Tiada placeholder Vite tertinggal. `<%` yang tidak dirender bermakna
 * template tidak diproses, dan ia akan terbit ke produksi tanpa error.
 */
const placeholderHits = [];
for (const p of htmlFiles) {
  const src = readFileSync(p, "utf-8");
  if (src.includes("<%")) placeholderHits.push(relOf(p));
}
if (placeholderHits.length) {
  failures.push(
    `placeholder "<%" tertinggal dalam ${placeholderHits.length} fail: ` +
      placeholderHits.slice(0, 8).join(", ")
  );
} else {
  console.log(`[verify] placeholder: 0 daripada ${htmlFiles.length} fail HTML ada "<%".`);
}

/* ------------------------------------------------------------------ 3
 * Link dalaman tidak boleh menunjuk ke halaman yang tidak wujud.
 *
 * Ini yang menjadikan gate bernilai: nav/footer dikongsi oleh setiap halaman,
 * jadi satu entri nav yang mati = 21 halaman dengan link mati. Gate pertama
 * di atas TIDAK menangkap ini (sitemap hanya senarai halaman yang dihasilkan).
 *
 * Diabaikan dengan sengaja: anchor (#...), mailto:, tel:, http(s) luaran,
 * dan link protokol-relatif (//).
 */
const internalRe = /(?:href|src)="([^"]+)"/g;
const brokenLinks = new Map(); // href -> Set<halaman yang merujuk>
const assetChecked = new Set();

for (const p of htmlFiles) {
  const src = readFileSync(p, "utf-8");
  for (const m of src.matchAll(internalRe)) {
    let href = m[1].trim();

    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("data:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    // Buang query/hash, jangan sentuh yang lain
    const clean = href.split("#")[0].split("?")[0];
    if (!clean) continue;

    // Buang prefix BASE kalau ada
    let target = clean;
    if (prefix && target.startsWith("/" + prefix + "/")) target = target.slice(prefix.length + 1);
    else if (prefix && target === "/" + prefix) target = "";
    target = target.replace(/^\//, "");
    if (target === "") target = "index.html";

    // Resolve relatif kepada halaman semasa
    let resolved = target;
    if (!target.startsWith("dist/") && !relSet.has(target)) {
      const dir = dirname(relOf(p));
      const candidate = dir === "." ? target : join(dir, target).replace(/\\/g, "/");
      if (relSet.has(candidate)) resolved = candidate;
      else if (target.endsWith("/") && relSet.has(candidate + "index.html"))
        resolved = candidate + "index.html";
    }

    if (relSet.has(resolved)) continue;

    // Kalau ia kelihatan seperti aset (ada sambungan fail), itu link mati sebenar.
    // Kalau tiada sambungan, ia mungkin URL bersih yang dihidangkan oleh host —
    // pada GitHub Pages itu TIDAK berfungsi, jadi ia tetap lulus sebagai amaran.
    const looksLikeAsset = /\.[a-z0-9]{1,6}$/i.test(target);
    if (looksLikeAsset) {
      if (!brokenLinks.has(href)) brokenLinks.set(href, new Set());
      brokenLinks.get(href).add(relOf(p));
    } else {
      warnings.push(`link mungkin mati (tiada sambungan fail): "${href}" dalam ${relOf(p)}`);
    }
    assetChecked.add(href);
  }
}

if (brokenLinks.size) {
  for (const [href, pages] of brokenLinks) {
    failures.push(
      `link mati "${href}" dirujuk oleh ${pages.size} halaman (cth: ${[...pages].slice(0, 3).join(", ")})`
    );
  }
} else {
  console.log(`[verify] link dalaman: 0 link mati merentas ${htmlFiles.length} halaman.`);
}

/* ------------------------------------------------------------------ 4
 * Amaran (bukan kegagalan): halaman wujud dalam dist/ tapi tiada dalam sitemap.
 * Biasanya ini tidak disengajakan — halaman yang dilupakan tidak akan diindeks.
 */
if (existsSync(join(dist, "sitemap.xml"))) {
  const sm = readFileSync(join(dist, "sitemap.xml"), "utf-8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const inSitemap = new Set(
    locs.map((loc) => {
      let path = loc.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "");
      if (prefix && path.startsWith(prefix + "/")) path = path.slice(prefix.length + 1);
      else if (prefix && path === prefix) path = "";
      return path === "" || path.endsWith("/") ? "index.html" : path;
    })
  );
  const missing = htmlFiles.map(relOf).filter((r) => !inSitemap.has(r));
  if (missing.length) {
    warnings.push(
      `${missing.length} halaman dalam dist/ tiada dalam sitemap: ${missing.slice(0, 8).join(", ")}`
    );
  }
}

/* ------------------------------------------------------------------ laporan */
if (warnings.length) {
  console.log("");
  for (const w of warnings) console.log(`[verify] AMARAN: ${w}`);
}

if (failures.length) {
  console.error("");
  console.error(`[verify] GAGAL — ${failures.length} masalah. JANGAN deploy.`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  console.error("[verify] Betulkan punca, bukan gate ini.");
  process.exit(1);
}

console.log("");
console.log("[verify] LULUS — artifact dist/ selamat untuk deploy.");
process.exit(0);
