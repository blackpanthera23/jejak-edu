#!/usr/bin/env node
/**
 * Sitemap + RSS generator untuk Jejak Edu.
 * Dijalankan selepas `vite build` (lihat package.json scripts.build).
 *
 * Sumber kebenaran URL: fail .html yang benar-benar dihasilkan dalam dist/.
 * Jangan senaraikan halaman yang tidak wujud.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, relative } from "path";

const BASE = process.env.VITE_BASE || "/jejak-edu/";
const ORIGIN = process.env.VITE_SITE_ORIGIN || "https://blackpanthera23.github.io";
const prefix = BASE.replace(/^\//, "").replace(/\/$/, "");
const siteRoot = `${ORIGIN.replace(/\/$/, "")}/${prefix}`;

const dist = resolve("dist");
if (!existsSync(dist)) {
  console.error("[sitemap] dist/ tidak wujud — jalankan vite build dulu.");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Keutamaan ikut jenis halaman. */
function priority(rel) {
  if (rel === "index.html") return "1.0";
  if (["gaji.html", "sejarah-pendidikan.html", "benchmarking.html"].includes(rel)) return "0.9";
  if (rel.startsWith("suara-") || rel === "resources.html") return "0.8";
  if (rel.startsWith("blog/")) return "0.7";
  if (rel.startsWith("penulis")) return "0.5";
  if (rel === "sumber-kredit.html") return "0.4";
  return "0.6";
}

const today = new Date().toISOString().slice(0, 10);

const pages = walk(dist)
  .filter((p) => p.endsWith(".html"))
  .map((p) => {
    const rel = relative(dist, p).replace(/\\/g, "/");
    const url = rel === "index.html" ? `${siteRoot}/` : `${siteRoot}/${rel}`;
    return { url, priority: priority(rel), rel };
  })
  .sort((a, b) => parseFloat(b.priority) - parseFloat(a.priority));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.rel.startsWith("blog/") ? "monthly" : "weekly"}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
writeFileSync(join(dist, "sitemap.xml"), sitemap);

/* ---------- RSS ---------- */
const blogDir = resolve("content/blog");
let items = [];
if (existsSync(blogDir)) {
  items = readdirSync(blogDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(join(blogDir, f), "utf-8");
      const fm = raw.split("---")[1] || "";
      const pick = (k) => {
        const m = fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, "m"));
        return m ? m[1].trim() : "";
      };
      const slug = pick("slug") || f.replace(/\.md$/, "");
      return {
        title: pick("title"),
        slug,
        date: pick("date"),
        description: pick("description"),
      };
    })
    .filter((x) => x.title && x.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Jejak Edu — Artikel</title>
    <link>${siteRoot}/blog.html</link>
    <description>Konteks pendidikan Malaysia — dasar, data dan apa maknanya untuk anda.</description>
    <language>ms-MY</language>
    <atom:link href="${siteRoot}/feed.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (it) => `    <item>
      <title>${it.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
      <link>${siteRoot}/blog/${it.slug}.html</link>
      <guid>${siteRoot}/blog/${it.slug}.html</guid>
      <pubDate>${new Date(it.date).toUTCString()}</pubDate>
      <description>${(it.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</description>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>
`;
writeFileSync(join(dist, "feed.xml"), rss);

console.log(`[sitemap] ${pages.length} URL dalam sitemap.xml | ${items.length} item dalam feed.xml`);
