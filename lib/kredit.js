/**
 * lib/kredit.js — Sistem atribusi & kredit Jejak Edu
 * ===================================================
 *
 * Fail ini ialah satu-satunya tempat di mana Jejak Edu memutuskan *bagaimana*
 * karya orang lain dikreditkan. Ia sengaja tidak mengimport apa-apa dari
 * `lib/templates.js` supaya graf import kekal satu arah:
 *
 *     lib/templates.js  →  lib/kredit.js
 *
 * Rujukan undang-undang (Akta Hak Cipta 1987, Akta 332):
 *   - s 13(2)(a) — fair dealing: wajib "acknowledgement of the title of the
 *     work and its authorship".
 *   - s 13(2)(m) — petikan: wajib "mention ... of the source and of the name
 *     of the author".
 *   - s 13(2)(n) — artikel topik semasa: wajib "the source is clearly indicated".
 *   - s 25(2)(a) — hak moral: dilarang mempersembahkan karya tanpa mengenal
 *     pasti pengarang.
 *   - s 13(2A)(d) — faktor paling berat: kesan terhadap pasaran karya asal.
 *     Pautan balik ke karya asal ialah cara kita menangani faktor ini.
 *
 * Setiap komponen di bawah direka supaya keempat-empat perkara itu tidak boleh
 * terlupa: nama penulis + tajuk + penerbit + pautan balik.
 */

const BASE = process.env.VITE_BASE || "/jejak-edu/";

/* ------------------------------------------------------------------ *
 * Utiliti asas
 * ------------------------------------------------------------------ */

/** Prefix link dalaman dengan base path (subpath GitHub Pages atau root). */
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

/** Hanya benarkan skema selamat pada URL yang datang dari frontmatter. */
export function urlSelamat(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return s;
  return "";
}

const BULAN = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

/**
 * Format tarikh gaya Malaysia.
 * "1 Mei 2026" (hari penuh) · "Mei 2026" (bulan sahaja) · "" kalau tiada.
 * gray-matter/js-yaml menukar `2026-05-01` kepada objek Date, jadi kita
 * terima Date, string ISO, dan tahun sahaja.
 */
export function formatTarikhBM(nilai, gaya = "penuh") {
  if (nilai == null || nilai === "") return "";
  let d;
  if (nilai instanceof Date) d = nilai;
  else if (typeof nilai === "number") d = new Date(Date.UTC(nilai, 0, 1));
  else {
    const s = String(nilai).trim();
    if (/^\d{4}$/.test(s)) return s;
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return String(nilai);
  const bulan = BULAN[d.getUTCMonth()];
  if (gaya === "bulan") return `${bulan} ${d.getUTCFullYear()}`;
  if (gaya === "tahun") return String(d.getUTCFullYear());
  return `${d.getUTCDate()} ${bulan} ${d.getUTCFullYear()}`;
}

/** Tarikh ISO (YYYY-MM-DD) untuk atribut `datetime`. */
export function tarikhISO(nilai) {
  if (nilai == null || nilai === "") return "";
  const d = nilai instanceof Date ? nilai : new Date(String(nilai));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Inisial untuk avatar lalai — elak imej rosak apabila tiada fail avatar. */
export function inisial(nama) {
  const bahagian = String(nama || "")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(binti|bin|bt|dato|datuk|datuk|datin|tan|sri|dr|prof)$/i.test(w));
  const sumber = bahagian.length ? bahagian : String(nama || "?").split(/\s+/);
  return (sumber[0]?.[0] || "?") + (sumber[1]?.[0] || "");
}

/* ------------------------------------------------------------------ *
 * Lesen
 * ------------------------------------------------------------------ */

const PETA_CC = {
  "cc0": { label: "CC0 1.0 (domain awam)", pautan: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "cc by 4.0": { label: "CC BY 4.0", pautan: "https://creativecommons.org/licenses/by/4.0/" },
  "cc by 3.0": { label: "CC BY 3.0", pautan: "https://creativecommons.org/licenses/by/3.0/" },
  "cc by-sa": { label: "CC BY-SA 4.0", pautan: "https://creativecommons.org/licenses/by-sa/4.0/" },
  "cc by-nd": { label: "CC BY-ND 4.0", pautan: "https://creativecommons.org/licenses/by-nd/4.0/" },
  "cc by-nc": { label: "CC BY-NC 4.0", pautan: "https://creativecommons.org/licenses/by-nc/4.0/" },
  "cc by-nc-sa": { label: "CC BY-NC-SA 4.0", pautan: "https://creativecommons.org/licenses/by-nc-sa/4.0/" },
  "cc by-nc-nd": { label: "CC BY-NC-ND 4.0", pautan: "https://creativecommons.org/licenses/by-nc-nd/4.0/" },
  "cc by": { label: "CC BY", pautan: "https://creativecommons.org/licenses/by/4.0/" },
};

/** Lesen yang Jejak Edu terima untuk penggunaan semula kandungan. */
export const LESEN_DITERIMA = [
  { label: "CC BY 4.0", pautan: "https://creativecommons.org/licenses/by/4.0/", nota: "Boleh guna, ubah suai dan terjemah. Wajib kredit." },
  { label: "CC BY-SA 4.0", pautan: "https://creativecommons.org/licenses/by-sa/4.0/", nota: "Boleh ubah suai, tetapi karya terbitan mesti dilesenkan sama." },
  { label: "CC BY-ND 4.0", pautan: "https://creativecommons.org/licenses/by-nd/4.0/", nota: "Boleh guna tanpa ubah suai. Tiada terjemahan." },
  { label: "CC0 1.0", pautan: "https://creativecommons.org/publicdomain/zero/1.0/", nota: "Domain awam. Tiada syarat, tetapi kami tetap kredit." },
  { label: "Data terbuka Kerajaan Malaysia", pautan: "https://data.gov.my/data-catalogue/datasets", nota: "data.gov.my — CC BY 4.0." },
];

/** Lesen yang Jejak Edu TIDAK guna untuk penggunaan semula. */
export const LESEN_DITOLAK = [
  { label: "CC BY-NC 4.0", sebab: "Menghalang penggunaan komersial. Portal ini boleh membawa iklan, jadi kami tidak bergantung pada lesen NC." },
  { label: "CC BY-NC-SA 4.0", sebab: "Sama seperti NC, ditambah syarat kongsi-lesen-sama." },
  { label: "CC BY-NC-ND 4.0", sebab: "Menghalang penggunaan komersial dan adaptasi." },
  { label: "Lesen proprietari / berbayar", sebab: "Langganan memberi hak membaca, bukan hak menerbitkan semula." },
];

/**
 * Klasifikasikan rentetan lesen bebas kepada kategori yang boleh dipaparkan.
 * Menerima apa sahaja yang penulis tulis dalam frontmatter — termasuk ejaan
 * bercampur ("CC-BY-4.0", "cc by 4.0", "fair dealing s 13(2)(a)").
 */
export function jenisLesen(lesen) {
  const asal = String(lesen == null ? "" : lesen).trim();
  if (!asal) {
    return {
      kategori: "asal",
      label: "Sumber asal",
      pautan: null,
      badge: "bg-slate-100 text-slate-700 border-slate-500",
      nota: "Kami kredit sumber ini sebagai karya pihak ketiga.",
    };
  }
  const l = asal.toLowerCase();

  // Creative Commons — padankan kunci terpanjang dahulu (by-nc-sa sebelum by).
  if (l.includes("cc") || l.includes("creative commons")) {
    const kunci = Object.keys(PETA_CC).sort((a, b) => b.length - a.length);
    for (const k of kunci) {
      const corak = k.replace(/[- ]/g, "[- ]?").replace(/\./g, "\\.");
      if (new RegExp(`cc[- ]?${corak.replace(/^cc[- ]?/, "")}`, "i").test(l)) {
        const info = PETA_CC[k];
        // Lesen NC dan ND tidak digunakan untuk penggunaan semula kandungan.
        const adaNC = /-nc/.test(k) || /noncommercial|non-commercial/i.test(l);
        const adaND = /-nd/.test(k) || /noderiv|no-deriv/i.test(l);
        return {
          kategori: "cc",
          label: info.label,
          pautan: info.pautan,
          badge: "bg-teal-50 text-teal-800 border-teal-700",
          diterima: !adaNC && !adaND,
          nota: adaNC || adaND
            ? "Lesen ini tidak membenarkan penggunaan komersial atau ubah suai — Jejak Edu tidak bergantung padanya untuk penggunaan semula."
            : "Kandungan berlesen terbuka. Kredit penuh (Tajuk, Penulis, Sumber, Lesen) dipaparkan di bawah.",
        };
      }
    }
    if (l.includes("cc0") || l.includes("publicdomain/zero")) {
      return {
        kategori: "cc",
        label: PETA_CC["cc0"].label,
        pautan: PETA_CC["cc0"].pautan,
        badge: "bg-teal-50 text-teal-800 border-teal-700",
        nota: "Dedikasi domain awam. Atribusi tidak diwajibkan — kami beri juga.",
      };
    }
    return {
      kategori: "cc",
      label: asal,
      pautan: "https://creativecommons.org/share-your-work/cclicenses/",
      badge: "bg-teal-50 text-teal-800 border-teal-700",
      nota: "Kandungan berlesen terbuka.",
    };
  }

  if (l.includes("domain awam") || l.includes("public domain")) {
    return {
      kategori: "cc",
      label: asal,
      pautan: null,
      badge: "bg-teal-50 text-teal-800 border-teal-700",
      nota: "Karya dalam domain awam — tiada perlindungan hak cipta lagi.",
    };
  }

  if (
    l.includes("fair dealing") || l.includes("s 13(2)") || l.includes("s13(2)") ||
    l.includes("petikan sah") || l.includes("seksyen 13")
  ) {
    return {
      kategori: "petikan",
      label: "Petikan sah — s 13(2) Akta Hak Cipta 1987",
      pautan: "https://www.myipo.gov.my/copyright-act",
      badge: "bg-amber-50 text-amber-900 border-amber-600",
      nota: "Kami petik sebahagian kecil sahaja, dengan nama penulis dan tajuk dinyatakan, serta pautan ke karya penuh.",
    };
  }

  if (
    l.includes("kerajaan") || l.includes("kpm") || l.includes("oecd") ||
    l.includes("gov") || l.includes("dokumen rasmi") || l.includes("rasmi")
  ) {
    return {
      kategori: "kerajaan",
      label: asal === "" ? "Dokumen rasmi" : asal,
      pautan: null,
      badge: "bg-slate-100 text-slate-800 border-slate-500",
      nota: "Dokumen rasmi kerajaan atau badan antarabangsa.",
    };
  }

  if (l.includes("kebenaran") || l.includes("izin") || l.includes("permission") || l.includes("dilesenkan")) {
    return {
      kategori: "izin",
      label: asal,
      pautan: null,
      badge: "bg-purple-50 text-purple-800 border-purple-500",
      nota: "Digunakan dengan kebenaran pemegang hak.",
    };
  }

  return {
    kategori: "asal",
    label: asal,
    pautan: null,
    badge: "bg-slate-100 text-slate-700 border-slate-500",
    nota: "",
  };
}

/* ------------------------------------------------------------------ *
 * Normalisasi sumber — sokong DUA format
 * ------------------------------------------------------------------ */

/**
 * Jejak Edu bermula dengan `sumber:` sebagai senarai rentetan biasa:
 *
 *     sumber:
 *       - "PISA 2025 — OECD"
 *
 * Skema yang diperluas menggunakan objek:
 *
 *     sumber:
 *       - jenis: petikan
 *         penulis: "Dato' X"
 *         tajuk: "Tajuk artikel"
 *         penerbit: "The Star"
 *         tarikh: 2026-05-01
 *         url: "https://..."
 *         lisén: "fair dealing s 13(2)(a)"
 *
 * `normalizeSumber()` menukar KEDUA-DUANYA kepada satu bentuk dalaman supaya
 * pemapar tidak perlu tahu yang mana satu penulis asal gunakan.
 */
export function normalizeSumber(item) {
  if (item == null) return null;

  // Format lama: rentetan biasa.
  if (typeof item === "string") {
    const teks = item.trim();
    if (!teks) return null;
    return {
      struktur: false,
      jenis: "asal",
      penulis: "",
      penulisSlug: "",
      peranan: "",
      tajuk: "",
      penerbit: "",
      tarikh: null,
      tarikhAkses: null,
      url: "",
      petikan: "",
      nota: "",
      lesenAsal: "",
      lesen: jenisLesen(""),
      teks,
    };
  }

  if (typeof item !== "object") return null;

  const lesenAsal = item["lisén"] ?? item["lesen"] ?? item["lisens"] ?? item["license"] ?? item["licence"] ?? "";
  const tajuk = item.tajuk || item.title || "";
  const penerbit = item.penerbit || item.publisher || item.laman || "";
  const urlSumber = urlSelamat(item.url || item.pautan || "");

  return {
    struktur: true,
    jenis: String(item.jenis || "asal").toLowerCase(),
    penulis: item.penulis || item.author || "",
    penulisSlug: item.slug || item.penulis_slug || "",
    peranan: item.peranan || item.role || "",
    tajuk,
    penerbit,
    tarikh: item.tarikh ?? item.date ?? null,
    tarikhAkses: item.dicapai ?? item.accessed ?? null,
    url: urlSumber,
    petikan: item.petikan || item.quote || "",
    nota: item.nota || item.perubahan || item.note || "",
    lesenAsal: String(lesenAsal || ""),
    lesen: jenisLesen(lesenAsal),
    // Teks sandaran untuk senarai ringkas (contoh: halaman penulis).
    teks: [item.penulis, tajuk, penerbit, formatTarikhBM(item.tarikh ?? item.date)]
      .filter(Boolean)
      .join(", "),
  };
}

/** Normalisasi satu senarai sumber. Entri tidak sah dibuang, bukan dilempar. */
export function normalizeSenaraiSumber(sumber) {
  if (!sumber) return [];
  const senarai = Array.isArray(sumber) ? sumber : [sumber];
  return senarai.map(normalizeSumber).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Komponen 1 — blok sumber penuh
 * ------------------------------------------------------------------ */

function pautanPenulis(item) {
  if (!item.penulis) return "";
  const nama = escapeHtml(item.penulis);
  if (item.penulisSlug) {
    return `<a href="${escapeHtml(url(`/penulis/${item.penulisSlug}.html`))}" class="font-semibold text-teal-700 hover:text-teal-800 hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1">${nama}</a>`;
  }
  return `<strong class="font-semibold text-slate-900">${nama}</strong>`;
}

function badgeLesen(item) {
  const { lesen } = item;
  const dalam = escapeHtml(lesen.label);
  const kelas = `inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${lesen.badge}`;
  if (lesen.pautan) {
    return `<a href="${escapeHtml(lesen.pautan)}" rel="license noopener" class="${kelas} hover:underline">${dalam}</a>`;
  }
  return `<span class="${kelas}">${dalam}</span>`;
}

/**
 * Satu baris kredit yang memenuhi s 13(2)(a) + s 13(2)(m) + s 25(2)(a):
 * nama penulis · tajuk · penerbit · tarikh · pautan balik.
 */
export function generateKreditSebaris(item, opsyen = {}) {
  const s = item && item.struktur !== undefined ? item : normalizeSumber(item);
  if (!s) return "";
  const { tunjukLesen = true } = opsyen;

  // Format lama: paparkan teks asal sahaja, tanpa struktur palsu.
  if (!s.struktur) {
    return `<span class="text-slate-700">${escapeHtml(s.teks)}</span>`;
  }

  const bahagian = [];
  if (s.penulis) bahagian.push(pautanPenulis(s));
  if (s.tajuk) bahagian.push(`&ldquo;<cite class="not-italic text-slate-800">${escapeHtml(s.tajuk)}</cite>&rdquo;`);
  if (s.penerbit) bahagian.push(`<em class="text-slate-700">${escapeHtml(s.penerbit)}</em>`);
  const tarikh = formatTarikhBM(s.tarikh);
  if (tarikh) {
    const iso = tarikhISO(s.tarikh);
    bahagian.push(iso ? `<time datetime="${iso}">${escapeHtml(tarikh)}</time>` : escapeHtml(tarikh));
  }
  if (!bahagian.length && s.teks) bahagian.push(escapeHtml(s.teks));

  const akses = formatTarikhBM(s.tarikhAkses);
  const pautan = s.url
    ? ` <a href="${escapeHtml(s.url)}" rel="noopener" class="font-semibold text-teal-700 hover:text-teal-800 hover:underline underline-offset-2">Baca karya penuh &rarr;</a>`
    : "";

  return `<span class="text-slate-700">${bahagian.join(", ")}.</span>${pautan}${
    akses ? ` <span class="text-slate-500">Dicapai ${escapeHtml(akses)}.</span>` : ""
  }${tunjukLesen && s.lesen.kategori !== "asal" ? " " + badgeLesen(s) : ""}`;
}

/**
 * `generateKreditSumber(sumber[])` — blok sumber penuh untuk hujung artikel.
 * Sokong campuran rentetan lama dan objek baharu dalam senarai yang sama.
 */
export function generateKreditSumber(sumber, opsyen = {}) {
  const senarai = normalizeSenaraiSumber(sumber);
  if (!senarai.length) return "";

  const {
    tajuk = "Sumber & kredit",
    id = "sumber-kredit",
    pautanPolisi = true,
    notaKaki = true,
  } = opsyen;

  const items = senarai
    .map((s, i) => {
      const nombor = `<span class="text-slate-500 tabular-nums shrink-0" aria-hidden="true">${i + 1}.</span>`;
      const badan = generateKreditSebaris(s);
      const nota = s.struktur && s.nota
        ? `<p class="mt-1 text-xs text-slate-600">${escapeHtml(s.nota)}</p>`
        : "";
      const petikan = s.struktur && s.petikan
        ? `<blockquote class="mt-2 border-l-2 border-teal-700 pl-3 text-sm text-slate-700 leading-relaxed">${escapeHtml(s.petikan)}</blockquote>`
        : "";
      return `
        <li class="flex gap-2.5 leading-relaxed">${nombor}<div class="min-w-0">
            <p class="text-sm text-slate-700 m-0">${badan}</p>
            ${petikan}
            ${nota}
          </div>
        </li>`;
    })
    .join("\n");

  const kaki = notaKaki
    ? `<p class="text-xs text-slate-600 mt-5 pt-4 border-t border-stone-500 leading-relaxed">
        Kami petik dan rumuskan — bukan salin penuh. Setiap sumber di atas ada nama penulis, tajuk, penerbit dan
        pautan ke karya asal. Hak moral penulis dihormati di bawah s 25 Akta Hak Cipta 1987.
        ${
          pautanPolisi
            ? `Baca <a href="${escapeHtml(url("/sumber-kredit.html"))}" class="font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2">polisi sumber &amp; kredit kami</a>, atau hubungi
               <a href="mailto:hello@jejakedu.my" class="font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2">hello@jejakedu.my</a>
               untuk pembetulan atau penarikan.`
            : ""
        }
      </p>`
    : "";

  return `
    <aside id="${escapeHtml(id)}" class="mt-12 bg-stone-100 border border-stone-500 rounded-xl p-6 not-prose" aria-labelledby="${escapeHtml(id)}-tajuk">
      <h2 id="${escapeHtml(id)}-tajuk" class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">${escapeHtml(tajuk)}</h2>
      <ol class="space-y-3 list-none p-0 m-0">
        ${items}
      </ol>
      ${kaki}
    </aside>
  `;
}

/* ------------------------------------------------------------------ *
 * Komponen 2 — petikan dalam badan artikel
 * ------------------------------------------------------------------ */

/**
 * Petikan + kredit sebaris yang bersih.
 * Struktur: <figure><blockquote>…</blockquote><figcaption>…kredit…</figcaption></figure>
 */
export function generatePetikan({ petikan, sumber, penulis, peranan, tajuk, penerbit, tarikh, url: pautan, lesen } = {}) {
  if (!petikan) return "";
  const item = normalizeSumber(
    sumber && typeof sumber === "object"
      ? sumber
      : { jenis: "petikan", penulis, peranan, tajuk, penerbit, tarikh, url: pautan, "lisén": lesen }
  );

  const kredit = generateKreditSebaris(item, { tunjukLesen: false });

  return `
    <figure class="not-prose my-8 bg-white border border-stone-500 border-l-4 border-l-teal-700 rounded-r-xl p-5 sm:p-6">
      <blockquote class="m-0 text-lg text-slate-800 leading-relaxed">
        <p class="m-0">&ldquo;${escapeHtml(petikan)}&rdquo;</p>
      </blockquote>
      <figcaption class="mt-4 pt-3 border-t border-stone-200 text-sm text-slate-600 leading-relaxed">
        ${kredit}
      </figcaption>
    </figure>
  `;
}

/**
 * Pemproses blok `:::petikan` dalam markdown.
 *
 *     :::petikan
 *     Teks petikan di sini.
 *     ---kredit
 *     penulis: Datin Noor Azimah Abdul Rahim
 *     peranan: Pengerusi, PAGE
 *     tajuk: Family socioeconomic background 'big influence' on Pisa
 *     penerbit: Free Malaysia Today
 *     tarikh: 2026-09-19
 *     url: https://...
 *     lesen: fair dealing s 13(2)(a)
 *     :::
 *
 * Blok ditukar kepada token HTML comment dahulu supaya `marked` tidak
 * membalut HTML kita dalam <p>. Selepas `marked` selesai, `suntikBlok()`
 * menggantikan token dengan HTML sebenar.
 */
export function prosesBlokPetikan(markdown) {
  const blok = [];
  const teks = String(markdown == null ? "" : markdown);
  const keluar = teks.replace(
    /^[ \t]*:::petikan[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gm,
    (_padan, isi) => {
      const bahagian = isi.split(/^[ \t]*---kredit[ \t]*$/m);
      const petikan = bahagian[0].trim();
      const medan = {};
      if (bahagian[1]) {
        for (const baris of bahagian[1].split(/\r?\n/)) {
          const m = baris.match(/^\s*([A-Za-z_éè]+)\s*:\s*(.*)$/);
          if (!m) continue;
          let nilai = m[2].trim().replace(/^["']|["']$/g, "");
          medan[m[1].toLowerCase()] = nilai;
        }
      }
      const html = generatePetikan({
        petikan,
        penulis: medan.penulis || medan.author || "",
        peranan: medan.peranan || medan.role || "",
        tajuk: medan.tajuk || medan.title || "",
        penerbit: medan.penerbit || medan.publisher || "",
        tarikh: medan.tarikh || medan.date || null,
        url: medan.url || "",
        lesen: medan["lisén"] || medan.lesen || medan.licence || medan.license || "",
      });
      const indeks = blok.push(html) - 1;
      return `\n\n<!--KREDIT-PETIKAN-${indeks}-->\n\n`;
    }
  );
  return { markdown: keluar, blok };
}

/** Gantikan token daripada `prosesBlokPetikan()` dengan HTML sebenar. */
export function suntikBlok(html, blok) {
  if (!blok || !blok.length) return html;
  return String(html).replace(/<!--KREDIT-PETIKAN-(\d+)-->/g, (padan, i) => blok[Number(i)] ?? "");
}

/** Kredit sebaris untuk diletakkan terus dalam perenggan teks. */
export function generateKreditInline(sumber) {
  const s = normalizeSumber(sumber);
  if (!s) return "";
  return `<span class="text-sm text-slate-600">${generateKreditSebaris(s)}</span>`;
}

/* ------------------------------------------------------------------ *
 * Komponen 3 — kad penulis
 * ------------------------------------------------------------------ */

const SAIZ_AVATAR = {
  mini: { imej: "w-6 h-6", teks: "w-6 h-6 text-[10px]" },
  kecil: { imej: "w-14 h-14", teks: "w-14 h-14 text-sm" },
  sedang: { imej: "w-12 h-12", teks: "w-12 h-12 text-sm" },
  besar: { imej: "w-20 h-20 sm:w-24 sm:h-24", teks: "w-20 h-20 sm:w-24 sm:h-24 text-xl" },
};

function avatarPenulis(p, saiz = "kecil") {
  const s = SAIZ_AVATAR[saiz] || SAIZ_AVATAR.kecil;
  if (p && p.avatar) {
    return `<img src="${escapeHtml(p.avatar)}" alt="" width="320" height="320" loading="lazy" decoding="async" class="${s.imej} rounded-full object-cover border border-stone-500 shrink-0" />`;
  }
  const nama = p && p.nama ? p.nama : "JE";
  return `<span class="${s.teks} rounded-full bg-teal-50 text-teal-800 border border-stone-500 flex items-center justify-center font-bold uppercase shrink-0" aria-hidden="true">${escapeHtml(inisial(nama))}</span>`;
}

function pautanPenulisHalaman(p) {
  return url(`/penulis/${p.penulis_slug || p.slug}.html`);
}

/**
 * `generatePenulisKad(p, bilanganArtikel)` — satu kad, tiga konteks:
 * halaman agregat penulis, halaman individu, dan blok "yang kami petik".
 */
export function generatePenulisKad(p, bilanganArtikel = 0, opsyen = {}) {
  const { label = "artikel", kredit = "" } = opsyen;
  const adaHalaman = Boolean(p.penulis_slug || p.slug);
  const dalaman = `
      ${avatarPenulis(p, "kecil")}
      <div class="min-w-0">
        <p class="font-bold text-slate-900 leading-snug">${escapeHtml(p.nama)}</p>
        ${p.peranan ? `<p class="text-xs font-semibold text-teal-700 mb-2">${escapeHtml(p.peranan)}</p>` : ""}
        ${p.bio ? `<p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(p.bio)}</p>` : ""}
        ${
          bilanganArtikel
            ? `<p class="mt-3 text-xs text-slate-600">${bilanganArtikel} ${escapeHtml(label)}</p>`
            : ""
        }
        ${kredit ? `<p class="mt-2 text-xs text-slate-600">${kredit}</p>` : ""}
      </div>`;

  const isi = adaHalaman
    ? `<a href="${escapeHtml(pautanPenulisHalaman(p))}" class="flex items-start gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">${dalaman}</a>`
    : `<div class="flex items-start gap-4">${dalaman}</div>`;

  return `
    <li class="bg-white border border-stone-500 rounded-xl p-5 hover:border-teal-700 hover:shadow-md transition-all">
      ${isi}
    </li>`;
}

/** Kad "Tentang penulis" di hujung artikel — hanya untuk pembaca yang sampai ke bawah. */
export function generateKadPenulisArtikel(p) {
  if (!p) return "";
  return `
    <aside class="mt-8 bg-stone-100 border border-stone-500 rounded-xl p-5 flex items-start gap-4 not-prose">
      ${avatarPenulis(p, "sedang")}
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1">Tentang penulis</p>
        <p class="text-sm text-slate-700 leading-relaxed">
          <a href="${escapeHtml(pautanPenulisHalaman(p))}" class="font-semibold text-teal-700 hover:text-teal-800 hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1">${escapeHtml(p.nama)}</a>${
            p.peranan ? `, ${escapeHtml(p.peranan)}` : ""
          }${p.bio ? ` &mdash; ${escapeHtml(p.bio)}` : ""}
        </p>
        <a href="${escapeHtml(pautanPenulisHalaman(p))}" class="mt-2 inline-flex items-center min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline underline-offset-2">Semua artikel beliau &rarr;</a>
      </div>
    </aside>
  `;
}

/**
 * Byline artikel — satu baris, sama berat dengan tarikh, bukan blok besar.
 * `penulis` boleh jadi objek tunggal atau senarai.
 */
export function generateByline(penulis, opsyen = {}) {
  const { tarikh = "", readingTime = null, tarikhIso = "" } = opsyen;
  const senarai = (Array.isArray(penulis) ? penulis : penulis ? [penulis] : []).filter(Boolean);

  const nama = senarai
    .map((p) => {
      const obj = typeof p === "string" ? { nama: p } : p;
      const pautan = obj.penulis_slug || obj.slug;
      const teks = escapeHtml(obj.nama || "");
      if (!pautan) return `<span class="font-semibold text-slate-800">${teks}</span>`;
      return `<a href="${escapeHtml(url(`/penulis/${pautan}.html`))}" class="font-semibold text-teal-700 hover:text-teal-800 hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1">${teks}</a>`;
    })
    .join('<span class="text-slate-500"> &amp; </span>');

  const senaraiPeranan = senarai
    .map((p) => (typeof p === "object" ? p.peranan : ""))
    .filter(Boolean);

  const bahagian = [];
  if (nama) {
    bahagian.push(
      `<span class="flex items-center gap-2">${avatarPenulis(senarai[0] && typeof senarai[0] === "object" ? senarai[0] : { nama: "JE" }, "mini")}${nama}</span>`
    );
    // Setiap peranan di-escape secara berasingan; pemisahnya HTML, bukan teks —
    // join dengan entiti akan ter-escape dan muncul sebagai "&middot;" literal.
    if (senaraiPeranan.length) {
      bahagian.push(
        senaraiPeranan
          .map((r) => `<span class="text-slate-500">${escapeHtml(r)}</span>`)
          .join('<span class="text-slate-500" aria-hidden="true">&middot;</span>')
      );
    }
  }
  if (tarikh) {
    bahagian.push(
      tarikhIso
        ? `<time datetime="${escapeHtml(tarikhIso)}">${escapeHtml(tarikh)}</time>`
        : `<span>${escapeHtml(tarikh)}</span>`
    );
  }
  if (readingTime != null) bahagian.push(`<span>${escapeHtml(readingTime)} minit bacaan</span>`);

  if (!bahagian.length) return "";
  return `<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">${bahagian.join(
    '<span aria-hidden="true" class="text-slate-500">&middot;</span>'
  )}</div>`;
}

/* ------------------------------------------------------------------ *
 * Halaman agregat penulis
 * ------------------------------------------------------------------ */

/** Kad penulis untuk `/penulis.html`. */
export function generatePenulisIndex(penulis, opsyen = {}) {
  const { bilanganArtikel = () => 0, petikan = [] } = opsyen;
  if (!penulis.length && !petikan.length) {
    return `<p class="text-slate-600">Belum ada halaman penulis diterbitkan.</p>`;
  }
  const kad = penulis
    .filter((p) => p.aktif !== false)
    .map((p) => generatePenulisKad(p, bilanganArtikel(p.penulis_slug || p.slug)))
    .join("\n");
  return `
    <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
      ${kad}
    </ul>`;
}
