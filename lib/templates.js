const BASE = process.env.VITE_BASE || "/jejak-edu/";

import {
  generateKreditSumber,
  generatePenulisKad as kadKreditPenulis,
} from "./kredit.js";

/** Prefix link dalaman dengan base path supaya jalan di subpath (GitHub Pages) atau root. */
export function url(path) {
  const b = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
  const p = String(path).startsWith("/") ? String(path) : "/" + String(path);
  return b + p;
}

export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Attribute-safe: sama seperti escapeHtml, untuk nilai atribut. */
export function escapeAttr(str) {
  return escapeHtml(str);
}

export function generateBlogCard(post) {
  const { frontmatter } = post;
  const date = new Date(frontmatter.date).toLocaleDateString("ms-MY", {
    day: "numeric", month: "long", year: "numeric",
  });
  const kategori = frontmatter.kategori || "Pendidikan";
  const warna = {
    "Dasar": "bg-purple-50 text-purple-700 border-purple-200",
    "Data": "bg-teal-50 text-teal-700 border-teal-200",
    "Kerjaya": "bg-amber-50 text-amber-700 border-amber-200",
    "Pendidikan": "bg-slate-100 text-slate-700 border-slate-200",
  }[kategori] || "bg-slate-100 text-slate-700 border-slate-200";

  const safeTitle = escapeHtml(frontmatter.title);
  const safeDesc = escapeHtml(frontmatter.description || "");

  return `
    <article class="group bg-white border border-stone-500 rounded-xl overflow-hidden hover:border-teal-600 hover:shadow-md transition-all flex flex-col">
      <div class="p-6 flex flex-col flex-1">
        <span class="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${warna} self-start mb-4">${escapeHtml(kategori)}</span>
        <h3 class="text-lg font-bold text-slate-900 mb-3 leading-snug">
          <a href="${url(`/blog/${encodeURIComponent(post.slug)}.html`)}" class="hover:text-teal-700 transition-colors">${safeTitle}</a>
        </h3>
        <p class="text-sm text-slate-600 leading-relaxed mb-5 flex-1">${safeDesc}</p>
        <div class="flex items-center justify-between pt-4 border-t border-stone-200 mt-auto">
          <time datetime="${escapeHtml(frontmatter.date)}" class="text-xs text-slate-500">${date}</time>
          <span class="text-xs font-semibold text-teal-700 group-hover:text-teal-800">Baca &rarr;</span>
        </div>
      </div>
    </article>
  `;
}

export function generateSourceBlock(post) {
  const sumber = post.frontmatter.sumber;
  if (!sumber || !Array.isArray(sumber) || sumber.length === 0) return "";
  // Delegasi ke lib/kredit.js — satu-satunya tempat format kredit ditentukan.
  // Ia menyokong KEDUA-DUA format: senarai rentetan lama dan senarai objek
  // berstruktur (jenis/penulis/tajuk/penerbit/tarikh/url/lisén), termasuk
  // campuran kedua-duanya dalam satu artikel.
  return generateKreditSumber(sumber);
}

/* ============================================================
   A. TL;DR + Peta Seksyen
   ============================================================ */

/** Buang tag, kembalikan teks mentah (untuk teks peta seksyen). */
function teksSahaja(html) {
  return String(html).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

/** Setiap <h2> mesti ada id. Kalau tiada, jana dari teksnya. */
export function senaraiSeksyen(htmlArtikel) {
  const seksyen = [];
  const re = /<h2([^>]*)>([\s\S]*?)<\/h2>/g;
  let m, i = 0;
  let hasil = htmlArtikel;
  while ((m = re.exec(htmlArtikel)) !== null) {
    i++;
    const attr = m[1];
    const teks = teksSahaja(m[2]);
    let id = (attr.match(/id="([^"]+)"/) || [])[1];
    if (!id) {
      id = "seksyen-" + i + "-" + teks.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      // Suntik id ke dalam HTML supaya anchor benar-benar wujud
      hasil = hasil.replace(m[0], `<h2 id="${id}"${attr}>${m[2]}</h2>`);
    }
    seksyen.push({ id, teks, nombor: i });
  }
  return { seksyen, htmlArtikel: hasil };
}

export function generateTldrBlok(post, htmlArtikel) {
  const { tldr } = post.frontmatter;
  const adaTldr = Array.isArray(tldr) && tldr.length > 0;

  const { seksyen, htmlArtikel: htmlBaru } = senaraiSeksyen(htmlArtikel);

  // Tiada `tldr` DAN kurang 3 seksyen: tiada apa yang berguna untuk ditambah.
  if (!adaTldr && seksyen.length < 3) {
    return { html: "", htmlArtikel: htmlBaru };
  }

  const mata = (adaTldr ? tldr.slice(0, 5) : [])
    .map(
      (m) => `
        <li class="flex gap-3">
          <span aria-hidden="true" class="mt-2 w-1.5 h-1.5 rounded-full bg-teal-700 shrink-0"></span>
          <span>${escapeHtml(m)}</span>
        </li>`
    )
    .join("");

  const peta = seksyen
    .map(
      (s) => `
        <li>
          <a href="#${escapeHtml(s.id)}"
             class="flex items-center gap-3 min-h-11 px-3 rounded-lg text-slate-700
                    hover:bg-stone-100 hover:text-teal-700 transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
            <span class="text-xs font-bold text-slate-600 tabular-nums" aria-hidden="true">${s.nombor}</span>
            <span class="text-sm">${escapeHtml(s.teks)}</span>
          </a>
        </li>`
    )
    .join("");

  const petaBlok = seksyen.length >= 3 ? `
    <nav id="senarai-seksyen" aria-label="Peta kandungan artikel"
         class="mt-4 bg-white border border-stone-500 rounded-xl p-5">
      <h2 class="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Kandungan</h2>
      <ol class="space-y-1">${peta}</ol>
    </nav>` : "";

  // Kad ringkasan hanya dirender kalau ada mata `tldr` sebenar.
  // Artikel panjang tanpa `tldr` tetap dapat peta seksyen — itu yang berguna,
  // dan kita tidak mereka ringkasan yang tidak ditulis oleh penulis.
  const kadTldr = adaTldr ? `
      <div class="bg-teal-50 border border-teal-200 rounded-xl overflow-hidden">
        <details open data-tldr class="group">
          <summary class="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer
                          list-none focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-teal-700 focus-visible:ring-inset">
            <h2 id="tldr-tajuk" class="text-sm font-bold text-teal-800 uppercase tracking-wide">
              Ringkasan Pantas
            </h2>
            <span class="text-xs text-teal-700 font-semibold" aria-hidden="true">
              <span class="group-open:hidden">Buka</span>
              <span class="hidden group-open:inline">Tutup</span>
            </span>
          </summary>
          <div class="px-5 pb-5">
            <ul class="space-y-2.5 text-slate-800 leading-relaxed">${mata}</ul>
            <p class="mt-4 pt-4 border-t border-teal-200 text-xs text-teal-800">
              Ringkasan ini bukan pengganti artikel penuh. Semua angka ada sumber di bawah.
            </p>
          </div>
        </details>
      </div>` : `
      <div class="bg-white border border-stone-500 rounded-xl p-5">
        <h2 id="tldr-tajuk" class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">
          Kandungan artikel
        </h2>
        <p class="text-sm text-slate-600 leading-relaxed">
          Artikel ini tiada ringkasan pantas. Ia ada ${seksyen.length} bahagian — guna senarai
          di bawah untuk melompat terus ke bahagian yang anda perlukan.
        </p>
      </div>`;

  const butangKawalan = adaTldr ? `
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" @click="bukaPenuh()"
                :aria-expanded="terbuka ? 'true' : 'false'"
                aria-controls="kandungan-penuh"
                class="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-3 rounded-lg
                       bg-teal-700 hover:bg-teal-800 text-white font-semibold transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700
                       focus-visible:ring-offset-2">
          <span x-text="terbuka ? 'Tutup balik' : 'Baca penuh'">Baca penuh</span>
          <svg class="w-4 h-4 transition-transform" :class="terbuka && 'rotate-180'"
               fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>` : "";

  const html = `
    <section x-data="tldrModul()" x-init="init()" class="mb-10" aria-labelledby="tldr-tajuk">
      ${kadTldr}
      ${butangKawalan}
      ${petaBlok}
    </section>`;

  return { html, htmlArtikel: htmlBaru };
}

/* ============================================================
   B. Penulis
   ============================================================ */

const AVATAR_LALAI = "/images/penulis/team-jejak-edu.svg";

export function generatePenulisKad(p, bilanganArtikel = 0) {
  const avatar = p.avatar || AVATAR_LALAI;
  const teksArtikel = bilanganArtikel === 0
    ? "Belum ada artikel"
    : `${bilanganArtikel} artikel`;
  return `
    <li class="bg-white border border-stone-500 rounded-xl p-5 hover:border-teal-600 hover:shadow-md transition-all">
      <a href="${url(`/penulis/${encodeURIComponent(p.penulis_slug)}.html`)}"
         class="flex items-start gap-4 focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-teal-700 focus-visible:ring-offset-2 rounded-lg">
        <img src="${url(avatar)}" alt="" width="320" height="320" loading="lazy" decoding="async"
             class="w-14 h-14 rounded-full object-cover border border-stone-500 shrink-0" />
        <div class="min-w-0">
          <p class="font-bold text-slate-900 leading-snug">${escapeHtml(p.nama)}</p>
          <p class="text-xs font-semibold text-teal-700 mb-2">${escapeHtml(p.peranan || "")}</p>
          <p class="text-sm text-slate-600 leading-relaxed line-clamp-2">${escapeHtml(p.bio || "")}</p>
          <p class="mt-3 text-xs text-slate-600">${escapeHtml(teksArtikel)}</p>
        </div>
      </a>
    </li>
  `;
}

/** Kad pengarang ringkas di hujung artikel. */
export function generatePenulisBlok(penulis) {
  if (!penulis) return "";
  const avatar = penulis.avatar || AVATAR_LALAI;
  const pautanPenulis = url(`/penulis/${encodeURIComponent(penulis.penulis_slug)}.html`);
  return `
    <aside class="mt-8 bg-stone-100 border border-stone-500 rounded-xl p-5 flex items-start gap-4 not-prose">
      <img src="${url(avatar)}" alt="" width="320" height="320" loading="lazy" decoding="async"
           class="w-12 h-12 rounded-full object-cover border border-stone-500 shrink-0" />
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1">Tentang penulis</p>
        <p class="text-sm text-slate-700 leading-relaxed">
          <a href="${pautanPenulis}" class="font-semibold text-teal-700 hover:underline underline-offset-2">
            ${escapeHtml(penulis.nama)}
          </a> &mdash; ${escapeHtml(penulis.bio || "")}
        </p>
        <a href="${pautanPenulis}"
           class="mt-2 inline-flex items-center min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800">
          Semua artikel beliau &rarr;
        </a>
      </div>
    </aside>
  `;
}

/* ============================================================
   D. Penulis yang kami petik (pihak ketiga)
   ============================================================ */

/**
 * Kad untuk penulis yang karyanya dipetik Jejak Edu tetapi tidak menulis
 * untuk kami. Ini komponen "naikkan exposure": setiap penulis yang kami sebut
 * mendapat halaman yang kekal, dengan pautan ke karya asal mereka.
 */
export function generateKadPenulisDipetik(p) {
  const jumlah = (p.sumber || []).length;
  const pautan = (p.sumber || [])
    .slice(0, 3)
    .map((s) => {
      const tajuk = s.tajuk || s.title || "Karya asal";
      const luar = /^https?:\/\//i.test(s.url || "") ? s.url : "";
      return luar
        ? `<li class="mt-1.5"><a href="${escapeHtml(luar)}" rel="noopener" class="text-sm text-teal-700 hover:text-teal-800 hover:underline underline-offset-2">${escapeHtml(tajuk)} &rarr;</a></li>`
        : `<li class="mt-1.5 text-sm text-slate-600">${escapeHtml(tajuk)}</li>`;
    })
    .join("");

  return `
    <li class="bg-white border border-stone-500 rounded-xl p-5">
      <p class="font-bold text-slate-900 leading-snug">${escapeHtml(p.nama)}</p>
      ${p.peranan ? `<p class="text-xs font-semibold text-teal-700 mb-2">${escapeHtml(p.peranan)}</p>` : ""}
      <p class="text-xs text-slate-600 mb-2">${jumlah} karya dipetik oleh Jejak Edu</p>
      <ul class="list-none p-0 m-0">${pautan}</ul>
    </li>
  `;
}

/** Senarai penulis pihak ketiga, dengan kredit nama sahaja (tiada halaman). */
export function generateSenaraiPenulisDipetik(senarai) {
  if (!senarai || !senarai.length) return "";
  return `
    <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
      ${senarai.map(generateKadPenulisDipetik).join("\n")}
    </ul>
  `;
}

/**
 * Blok rujukan dengan nombor + label, untuk halaman seperti Sejarah,
 * Penanda Aras, Resources. Setiap dakwaan angka mesti ada satu baris di sini.
 */
export function generateRujukanBlok(tajuk, senarai) {
  if (!Array.isArray(senarai) || senarai.length === 0) return "";
  const items = senarai
    .map(
      (s, i) => `
      <li class="flex gap-3 leading-relaxed">
        <span class="text-xs font-bold text-slate-600 tabular-nums shrink-0 w-5 pt-0.5" aria-hidden="true">${i + 1}</span>
        <span class="text-sm text-slate-700">${escapeHtml(s)}</span>
      </li>`
    )
    .join("");
  return `
    <aside class="mt-12 bg-stone-100 border border-stone-500 rounded-xl p-6" aria-labelledby="rujukan-tajuk">
      <h2 id="rujukan-tajuk" class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
        ${escapeHtml(tajuk)}
      </h2>
      <ol class="space-y-2.5">${items}</ol>
      <p class="text-xs text-slate-600 mt-5 pt-4 border-t border-stone-200">
        Semua angka di halaman ini boleh disemak pada sumber di atas. Kalau anda jumpa
        ketidaktepatan, sila hubungi kami untuk pembetulan.
      </p>
    </aside>
  `;
}
