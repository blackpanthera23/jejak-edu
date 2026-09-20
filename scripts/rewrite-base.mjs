#!/usr/bin/env node
/**
 * Rewrite link dalaman dalam dist/ supaya prefix dengan BASE.
 * Vite `base` hanya handle asset dan rewrite, bukan href literal dalam HTML template.
 * Jalankan selepas `vite build`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const BASE = process.env.VITE_BASE || "/jejak-edu/";
const prefix = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
const dist = resolve("dist");

if (prefix === "") {
  console.log("[rewrite-base] BASE kosong — tiada perubahan.");
  process.exit(0);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// href="/..." atau src="/..." — kecuali protocol-relative (//), atau yang dah ada prefix
const linkRe = /(href|src)="\/(?!\/)([^"]*)"/g;
const alreadyRe = new RegExp(`^${prefix.replace(/^\//, "")}(/|$)`);
let files = 0, links = 0;

for (const p of walk(dist)) {
  if (!p.endsWith(".html")) continue;
  const src = readFileSync(p, "utf-8");
  const out = src.replace(linkRe, (m, attr, path) => {
    if (alreadyRe.test(path)) return m; // dah ada prefix, jangan double
    links++;
    return `${attr}="${prefix}/${path}"`;
  });
  if (out !== src) {
    writeFileSync(p, out);
    files++;
  }
}

console.log(
  `[rewrite-base] ${links} link dalam ${files} fail ditulis semula dengan prefix "${prefix}".`
);
