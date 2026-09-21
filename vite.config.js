import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { createMpaPlugin } from "vite-plugin-virtual-mpa";
import { resolve } from "path";
import { readFileSync } from "fs";
import { marked } from "marked";
import {
  getContentFromDirectory,
  formatDate,
  estimateReadingTime,
} from "./lib/content.js";
import {
  generateBlogCard,
  generateTldrBlok,
  url,
  escapeHtml,
} from "./lib/templates.js";
import {
  generateKreditSumber,
  generateByline,
  generatePenulisKad,
  generateKadPenulisArtikel,
  generatePenulisIndex as generatePenulisIndexKad,
} from "./lib/kredit.js";
import {
  muatPenulis,
  petaPenulis,
  sahkanRujukanPenulis,
  bilanganArtikelPenulis,
  artikelPenulis,
  penulisArtikel,
  penulisDipetik,
} from "./lib/penulis.js";

const __dirname = resolve();

// GitHub Pages deploy di subpath /jejak-edu/. Set VITE_BASE="/" untuk root domain.
const BASE = process.env.VITE_BASE || "/jejak-edu/";

// ==== IDENTITI SITE (SEO/AEO) ====
// Tukar SITE_ORIGIN bila pindah ke domain sendiri (contoh: "https://jejakedu.my").
const SITE_ORIGIN = process.env.VITE_SITE_ORIGIN || "https://blackpanthera23.github.io";
const SITE_NAME = "Jejak Edu";
const SITE_DESC = "Data dan konteks pendidikan Malaysia untuk pelajar, ibu bapa dan guru.";

/** URL kanonik penuh untuk satu halaman. */
function kanonik(slug) {
  const b = SITE_ORIGIN.replace(/\/$/, "");
  const p = BASE.replace(/^\//, "").replace(/\/$/, "");
  const s = String(slug || "").replace(/^\//, "");
  return `${b}/${p}/${s}`;
}

/**
 * Serialize JSON supaya SELAMAT dimasukkan ke dalam blok <script>.
 *
 * KENAPA INI WAJIB
 * ----------------
 * Parser HTML tidak tahu apa-apa tentang JavaScript. Ia menamatkan blok <script>
 * pada urutan literal `</script`, walau di mana ia muncul — termasuk di dalam
 * string JSON. `JSON.stringify` TIDAK escape `<`, `>` atau `/`, jadi:
 *
 *   title = '"</script><script>alert(1)</script>'
 *   =>  <script type="application/ld+json">{"headline":""</script><script>alert(1)</script>""}</script>
 *
 * Parser menutup blok JSON-LD pada `</script>` pertama, dan bakinya menjadi tag
 * <script> inline yang SEBENAR dan akan LAKSANA. Ini XSS tersimpan (stored XSS):
 * mana-mana frontmatter — title, description, nama penulis — boleh mencetusnya,
 * dan sauh itu terbit ke produksi sebagai HTML statik.
 *
 * Escaping `<` sebagai \u003c menutup vektor ini sepenuhnya: JSON yang dihasilkan
 * tetap mengekod nilai yang sama persis selepas JSON.parse, tetapi HTML parser
 * tidak lagi melihat `<` untuk ditafsir. `\u2028`/`\u2029` juga diescape kerana
 * ia adalah terminator baris yang sah dalam JSON tetapi haram dalam JS literal.
 */
function jsonSelamatUntukScript(nilai) {
  return JSON.stringify(nilai)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}


/** Normalisasi medan `penulis` — terima string, objek, atau senarai kedua-duanya. */
function namaPenulis(medan) {
  if (!medan) return [];
  const arr = Array.isArray(medan) ? medan : [medan];
  return arr
    .map((x) => (typeof x === "string" ? x : x && (x.nama || x.name)))
    .filter(Boolean);
}

/** Bina JSON-LD. Hanya data yang kita benar-benar tahu — jangan reka. */
function jsonLdUntuk({ jenis, title, description, slug, tarikh, kategori, penulis }) {
  const url = kanonik(slug);
  const org = {
    "@type": "Organization",
    name: SITE_NAME,
    url: kanonik(""),
    description: SITE_DESC,
  };
  if (jenis === "artikel") {
    const graf = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: description,
      url,
      inLanguage: "ms-MY",
      datePublished: tarikh,
      publisher: org,
      isAccessibleForFree: true,
    };
    if (kategori) graf.articleSection = kategori;
    if (penulis && penulis.length) {
      graf.author = penulis.map((n) => ({ "@type": "Person", name: n }));
    }
    return `<script type="application/ld+json">${jsonSelamatUntukScript(graf)}</script>`;
  }
  if (jenis === "dataset") {
    return `<script type="application/ld+json">${jsonSelamatUntukScript({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: title,
      description,
      url,
      inLanguage: "ms-MY",
      creator: org,
      isAccessibleForFree: true,
      license: kanonik("sumber-kredit.html"),
    })}</script>`;
  }
  // Lalai: WebSite + Organization pada halaman utama, WebPage untuk yang lain
  if (jenis === "laman-utama") {
    return `<script type="application/ld+json">${jsonSelamatUntukScript({
      "@context": "https://schema.org",
      "@graph": [
        org,
        { "@type": "WebSite", name: SITE_NAME, url: kanonik(""), inLanguage: "ms-MY", description: SITE_DESC },
      ],
    })}</script>`;
  }
  return `<script type="application/ld+json">${jsonSelamatUntukScript({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
    inLanguage: "ms-MY",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: kanonik("") },
  })}</script>`;
}

/** Suntik canonical + jsonLd ke setiap page sebagai `data`. */
function SEO(pages, jenis, opts = {}) {
  return pages.map((p) => ({
    ...p,
    data: {
      ...p.data,
      canonical: kanonik(p.data.slugHalaman),
      jsonLd: jsonLdUntuk({
        jenis,
        title: p.data.title,
        description: p.data.description,
        slug: p.data.slugHalaman,
        ...opts(p),
      }),
    },
  }));
}

const blogDir = resolve(__dirname, "content/blog");
const blogPosts = getContentFromDirectory(blogDir, {
  sortBy: "date",
  order: "desc",
});

const recentBlogPosts = blogPosts.slice(0, 3);

/* ------------------------------------------------------------------ *
 * Penulis
 * ------------------------------------------------------------------ */

const dirPenulis = resolve(__dirname, "content/penulis");
const penulis = muatPenulis(dirPenulis);
const peta = petaPenulis(dirPenulis);

// Rujukan penulis yang rosak = build GAGAL. Pautan penulis yang rosak di portal
// terbuka lebih buruk daripada build yang rosak semasa pembangunan.
sahkanRujukanPenulis(blogPosts, peta);

const dipetik = penulisDipetik(blogPosts, dirPenulis);

/* ------------------------------------------------------------------ *
 * Templat
 * ------------------------------------------------------------------ */

const baca = (f) => readFileSync(resolve(__dirname, f), "utf-8");

const blogListTemplate = baca("templates/blog-list.html");
const blogPostTemplate = baca("templates/blog-post.html");
const penulisTemplate = baca("templates/penulis.html");
const penulisIndexTemplate = baca("templates/penulis-index.html");
const penulisDipetikTemplate = baca("templates/penulis-dipetik.html");
const penulisDipetikHalamanTemplate = baca("templates/penulis-dipetik-halaman.html");
const indexContent = baca("index.html");
const gajiContent = baca("gaji.html");
const aboutContent = baca("about.html");

// ---------- Halaman baharu (Jejak Edu) ----------
const sejarahContent = baca("sejarah-pendidikan.html");
const benchmarkingContent = baca("benchmarking.html");
const suaraGuruContent = baca("suara-guru.html");
const suaraPelajarContent = baca("suara-pelajar.html");
const resourcesContent = baca("resources.html");
const sumberKreditContent = baca("sumber-kredit.html");

/* ------------------------------------------------------------------ *
 * Penjana
 * ------------------------------------------------------------------ */

function generateBlogListContent() {
  const cardsHtml = blogPosts.map((post) => generateBlogCard(post)).join("\n");
  return blogListTemplate.replace("<%- blogCards %>", cardsHtml);
}

function generateBlogPostContent(post) {
  const { frontmatter, content, raw } = post;
  const dateFormatted = formatDate(frontmatter.date);
  const minutes = estimateReadingTime(raw || content);

  // Pasang modul TL;DR hanya kalau frontmatter ada `tldr`,
  // ATAU artikel cukup panjang (>= 4 minit bacaan).
  const cukupPanjang = minutes >= 4;
  const { html: blokTldr, htmlArtikel } = cukupPanjang
    ? generateTldrBlok(post, content)
    : { html: "", htmlArtikel: content };

  const senaraiPenulis = penulisArtikel(frontmatter, peta);
  const byline = generateByline(senaraiPenulis, {
    tarikh: dateFormatted,
    tarikhIso: frontmatter.date,
    readingTime: minutes,
  });

  // Kad "Tentang penulis" di hujung artikel — penulis pertama sahaja.
  const utama = senaraiPenulis[0]
    ? peta.get(senaraiPenulis[0].slug) || senaraiPenulis[0]
    : null;
  const penulisBlok = utama ? generateKadPenulisArtikel(utama) : "";

  return blogPostTemplate
    .replace(/<%=\s*kategori\s*%>/g, escapeHtml(frontmatter.kategori || "Pendidikan"))
    .replace(/<%=\s*title\s*%>/g, escapeHtml(frontmatter.title))
    .replace(/<%=\s*description\s*%>/g, escapeHtml(frontmatter.description || ""))
    .replace(/<%=\s*date\s*%>/g, dateFormatted)
    .replace(/<%=\s*readingTime\s*%>/g, minutes)
    .replace(/<%- byline %>/g, byline)
    .replace(/<%- penulisBlok %>/g, penulisBlok)
    .replace(/<%- sumber %>/g, generateKreditSumber(frontmatter.sumber))
    .replace(/<%- sourceBlock %>/g, generateKreditSumber(frontmatter.sumber))
    .replace(/<%=\s*sourceBlock\s*%>/g, generateKreditSumber(frontmatter.sumber))
    .replace(/<%- blokTldr %>/g, cukupPanjang ? blokTldr : "")
    .replace(/<%- content %>/g, htmlArtikel);
}

function generateHomepageContent() {
  const recentBlogHtml = recentBlogPosts
    .map((post) => generateBlogCard(post))
    .join("\n");
  return indexContent.replace("<%- recentBlogPosts %>", recentBlogHtml);
}

function generatePenulisIndexContent() {
  const kad = generatePenulisIndexKad(penulis, {
    bilanganArtikel: (slug) => bilanganArtikelPenulis(blogPosts, slug),
    petikan: dipetik,
  });
  return penulisIndexTemplate.replace("<%- kadPenulis %>", kad);
}

function generatePenulisDipetikContent() {
  if (!dipetik.length) {
    return penulisDipetikTemplate.replace(
      "<%- senaraiDipetik %>",
      `<p class="text-slate-600 leading-relaxed">Belum ada penulis pihak ketiga direkodkan.</p>`
    );
  }
  const kad = dipetik
    .map((p) =>
      generatePenulisKad(p, p.sumber.length, {
        label: "petikan",
        kredit: p.sumber
          .slice(0, 3)
          .map(
            (s) =>
              `<a href="${escapeHtml(url(`/blog/${s.artikel}.html`))}" class="font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2">${escapeHtml(s.tajukArtikel || s.artikel)}</a>`
          )
          .join(" &middot; "),
      })
    )
    .join("\n");
  return penulisDipetikTemplate.replace(
    "<%- senaraiDipetik %>",
    `<ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">${kad}</ul>`
  );
}

/**
 * Halaman individu untuk penulis PIHAK KETIGA yang karyanya kami petik.
 *
 * Ini bahagian "naikkan exposure": penulis ini tidak menulis untuk kami, tetapi
 * setiap petikan kami memberi mereka pautan kekal ke karya asal. Halaman ini
 * wujud semata-mata untuk menghantar pembaca kepada mereka.
 */
function generatePenulisDipetikHalaman(p) {
  const senaraiKarya = (p.sumber || [])
    .map((s) => {
      const luar = /^https?:\/\//i.test(s.url || "") ? s.url : "";
      const tajuk = s.tajuk || s.title || "Karya asal";
      const meta = [
        s.penerbit ? escapeHtml(s.penerbit) : "",
        s.tarikh ? escapeHtml(formatDate(s.tarikh)) : "",
      ]
        .filter(Boolean)
        .join(" &middot; ");
      const petikan = s.petikan
        ? `<blockquote class="mt-3 border-l-2 border-teal-700 pl-3 text-sm text-slate-700 leading-relaxed">${escapeHtml(s.petikan)}</blockquote>`
        : "";
      const pautan = luar
        ? `<a href="${escapeHtml(luar)}" rel="noopener" class="mt-3 inline-flex items-center min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2">Baca karya penuh &rarr;</a>`
        : "";
      return `
        <li class="bg-white border border-stone-500 rounded-xl p-5 mb-4">
          <p class="font-bold text-slate-900 leading-snug mb-1">${escapeHtml(tajuk)}</p>
          ${meta ? `<p class="text-xs text-slate-600">${meta}</p>` : ""}
          ${petikan}
          ${pautan}
        </li>`;
    })
    .join("");

  const slugArtikel = [...new Set((p.sumber || []).map((s) => s.artikel).filter(Boolean))];
  const kadArtikel = slugArtikel.length
    ? slugArtikel
        .map((slug) => {
          const post = blogPosts.find((b) => b.slug === slug);
          return post ? generateBlogCard(post) : "";
        })
        .join("\n")
    : "";

  const senaraiArtikelHtml = kadArtikel
    ? `<div class="grid gap-5 sm:grid-cols-2">${kadArtikel}</div>`
    : `<p class="text-slate-600 leading-relaxed">Belum ada artikel yang memetik karya ini.</p>`;

  return penulisDipetikHalamanTemplate
    .replace(/<%=\s*nama\s*%>/g, escapeHtml(p.nama))
    .replace(
      /<%- perananBlok %>/g,
      p.peranan
        ? `<p class="text-sm font-semibold text-teal-700 mb-3">${escapeHtml(p.peranan)}</p>`
        : ""
    )
    .replace(/<%=\s*bilanganArtikel\s*%>/g, slugArtikel.length)
    .replace(/<%- senaraiKarya %>/g, `<ul class="list-none p-0 m-0">${senaraiKarya}</ul>`)
    .replace(/<%- senaraiArtikel %>/g, senaraiArtikelHtml);
}

function generatePenulisHalaman(p) {
  const bilangan = bilanganArtikelPenulis(blogPosts, p.penulis_slug);
  const senaraiArtikel = artikelPenulis(blogPosts, p.penulis_slug);

  // Keadaan sifar artikel: jangan tunjuk grid kosong.
  const artikelHtml =
    senaraiArtikel.length === 0
      ? `<p class="text-slate-600 leading-relaxed">
           Belum ada artikel yang diterbitkan. Tulisan pertama akan muncul di sini.
         </p>`
      : `<div class="grid gap-5 sm:grid-cols-2">${senaraiArtikel
          .map((post) => generateBlogCard(post))
          .join("\n")}</div>`;

  const bioPanjang = p.bio_panjang
    ? `<div class="prose prose-lg max-w-none mt-8 prose-headings:font-bold prose-a:text-teal-700">
         ${marked(String(p.bio_panjang))}
       </div>`
    : "";

  const pautanLain = (p.links || [])
    .filter((l) => l && l.url && !String(l.url).startsWith("mailto:"))
    .map((l) => {
      const luar = /^https?:/i.test(l.url);
      return `
        <li>
          <a href="${escapeHtml(l.url)}"
             ${luar ? 'rel="noopener noreferrer" target="_blank"' : ""}
             class="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-lg bg-white
                    border border-slate-500 text-slate-700 hover:bg-stone-100 hover:border-teal-700
                    font-semibold text-sm transition-colors focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
            ${escapeHtml(l.label || l.url)}
          </a>
        </li>`;
    })
    .join("");

  return penulisTemplate
    .replace(/<%=\s*avatar\s*%>/g, url(p.avatar || "/images/penulis/team-jejak-edu.svg"))
    .replace(/<%=\s*nama\s*%>/g, escapeHtml(p.nama))
    .replace(/<%=\s*peranan\s*%>/g, escapeHtml(p.peranan || ""))
    .replace(/<%=\s*bio\s*%>/g, escapeHtml(p.bio || ""))
    .replace(/<%=\s*emel\s*%>/g, escapeHtml(p.emel || "hello@jejakedu.my"))
    .replace(/<%=\s*bilanganArtikel\s*%>/g, bilangan)
    .replace(/<%- bioPanjang %>/g, bioPanjang)
    .replace(/<%- pautanLain %>/g, pautanLain)
    .replace(/<%- artikelPenulis %>/g, artikelHtml);
}

/* ------------------------------------------------------------------ *
 * Senarai halaman
 * ------------------------------------------------------------------ */

const halamanBaharu = [
  {
    name: "sejarah-pendidikan",
    entry: "/src/main.js",
    data: {
      title: "Sejarah Pendidikan Malaysia 1816–2026 — Jejak Edu",
      description:
        "Garis masa kronologi pendidikan Malaysia: Penang Free School 1816 hingga PISA 2025. Setiap peristiwa ada tahun, satu ayat dan satu sumber.",
      slugHalaman: "sejarah-pendidikan.html",
      activePage: "sejarah-pendidikan",
      activeKumpulan: "belajar",
      url,
      content: sejarahContent,
    },
  },
  {
    name: "benchmarking",
    entry: "/src/main.js",
    data: {
      title: "Penanda Aras Pendidikan Malaysia — Jejak Edu",
      description:
        "Perbandingan antarabangsa: PISA 2025, TIMSS 2023, Learning Poverty, perbelanjaan dan enrolmen. Setiap baris ada negara, angka, tahun dan sumber.",
      slugHalaman: "benchmarking.html",
      activePage: "benchmarking",
      activeKumpulan: "data",
      url,
      content: benchmarkingContent,
    },
  },
  {
    name: "suara-guru",
    entry: "/src/main.js",
    data: {
      title: "Suara Guru — Jejak Edu",
      description:
        "Apa yang guru Malaysia katakan tentang beban kerja, kekurangan guru dan kesihatan mental — dengan angka, tahun data dan atribusi jelas.",
      slugHalaman: "suara-guru.html",
      activePage: "suara-guru",
      activeKumpulan: "suara",
      url,
      content: suaraGuruContent,
    },
  },
  {
    name: "suara-pelajar",
    entry: "/src/main.js",
    data: {
      title: "Suara Pelajar — Jejak Edu",
      description:
        "Cerita pelajar Malaysia tentang kesihatan mental, buli dan tekanan akademik — dihantar tanpa nama. Tiada nama penuh, tiada nama sekolah.",
      slugHalaman: "suara-pelajar.html",
      activePage: "suara-pelajar",
      activeKumpulan: "suara",
      url,
      content: suaraPelajarContent,
    },
  },
  {
    name: "resources",
    entry: "/src/main.js",
    data: {
      title: "Panduan Sumber Pendidikan — Jejak Edu",
      description:
        "Sekolah, universiti, tusyen, kerjaya dan bantuan — daripada sumber yang sah: data KPM, data.gov.my CC BY 4.0, dan OpenStreetMap.",
      slugHalaman: "resources.html",
      activePage: "resources",
      activeKumpulan: "sumber",
      url,
      content: resourcesContent,
    },
  },
  {
    name: "sumber-kredit",
    entry: "/src/main.js",
    data: {
      title: "Sumber & Kredit — Jejak Edu",
      description:
        "Cara Jejak Edu memetik, mengkredit dan memautkan karya orang lain — selaras dengan Akta Hak Cipta 1987 (Akta 332).",
      slugHalaman: "sumber-kredit.html",
      activePage: "sumber-kredit",
      activeKumpulan: "sumber",
      url,
      content: sumberKreditContent,
    },
  },
  {
    name: "penulis",
    entry: "/src/main.js",
    data: {
      title: "Penulis Kami — Jejak Edu",
      description:
        "Orang di belakang setiap artikel Jejak Edu. Biodata, artikel dan cara menghubungi mereka.",
      slugHalaman: "penulis.html",
      activePage: "penulis",
      activeKumpulan: "sumber",
      url,
      content: generatePenulisIndexContent(),
    },
  },
  {
    name: "penulis-dipetik",
    entry: "/src/main.js",
    data: {
      title: "Penulis Yang Kami Petik — Jejak Edu",
      description:
        "Wartawan, penyelidik dan penerbit yang karyanya kami rujuk — dengan pautan balik ke karya asal mereka.",
      slugHalaman: "penulis-dipetik.html",
      activePage: "penulis-dipetik",
      activeKumpulan: "sumber",
      url,
      content: generatePenulisDipetikContent(),
    },
  },
  // Halaman individu untuk setiap penulis pihak ketiga yang kami petik.
  // Ini yang menjadikan "kredit" boleh diklik dan berkekalan.
  ...dipetik.map((p) => ({
    name: `penulis-dipetik-${p.penulis_slug}`,
    filename: `penulis/${p.penulis_slug}.html`,
    entry: "/src/main.js",
    data: {
      title: `${p.nama} — Penulis Yang Kami Petik — Jejak Edu`,
      description: `Karya ${p.nama} yang dipetik oleh Jejak Edu, dengan pautan ke karya asal.`,
      slugHalaman: `penulis/${p.penulis_slug}.html`,
      activePage: "penulis-dipetik",
      activeKumpulan: "sumber",
      url,
      content: generatePenulisDipetikHalaman(p),
    },
  })),
  ...penulis.filter((p) => p.aktif).map((p) => ({
    name: `penulis-${p.penulis_slug}`,
    filename: `penulis/${p.penulis_slug}.html`,
    entry: "/src/main.js",
    data: {
      title: `${p.nama} — Penulis Jejak Edu`,
      description: p.bio || `Profil penulis Jejak Edu: ${p.nama}.`,
      slugHalaman: `penulis/${p.penulis_slug}.html`,
      activePage: "penulis",
      activeKumpulan: "sumber",
      url,
      content: generatePenulisHalaman(p),
    },
  })),
];

const pagesAsas = [
  {
    name: "index",
    entry: "/src/main.js",
    data: {
      title: "Jejak Edu — Data & Konteks Pendidikan Malaysia",
      description:
        "Data dan konteks pendidikan Malaysia untuk pelajar, ibu bapa dan guru. PISA, Kurikulum 2027, data gaji graduan.",
      slugHalaman: "",
      activePage: "home",
      activeKumpulan: "",
      url,
      content: generateHomepageContent(),
    },
  },
  {
    name: "gaji",
    entry: "/src/main.js",
    data: {
      title: "Data Gaji Graduan — Jejak Edu",
      description:
        "7,339 rekod gaji anonim Malaysia. Median ikut industri, jawatan, tahap dan pendidikan.",
      slugHalaman: "gaji.html",
      activePage: "gaji",
      activeKumpulan: "data",
      url,
      content: gajiContent,
    },
  },
  {
    name: "about",
    entry: "/src/main.js",
    data: {
      title: "Tentang — Jejak Edu",
      description:
        "Prinsip editorial dan sumber data Jejak Edu. Data sebelum pendapat.",
      slugHalaman: "about.html",
      activePage: "about",
      activeKumpulan: "sumber",
      url,
      content: aboutContent,
    },
  },
  {
    name: "blog",
    entry: "/src/main.js",
    data: {
      title: "Artikel — Jejak Edu",
      description: "Konteks pendidikan Malaysia — dasar, data dan apa maknanya untuk anda.",
      slugHalaman: "blog.html",
      activePage: "blog",
      activeKumpulan: "belajar",
      url,
      content: generateBlogListContent(),
    },
  },
  ...blogPosts.map((post) => ({
    name: `blog-${post.slug}`,
    filename: `blog/${post.slug}.html`,
    entry: "/src/main.js",
    data: {
      title: `${post.frontmatter.title} — Jejak Edu`,
      description: post.frontmatter.description,
      slugHalaman: `blog/${post.slug}.html`,
      activePage: "blog",
      activeKumpulan: "belajar",
      url,
      content: generateBlogPostContent(post),
    },
  })),
  ...halamanBaharu,
];

const pages = [
  ...pagesAsas.filter((p) => p.name === "index").map((p) => ({ ...p, data: { ...p.data, canonical: kanonik(""), jsonLd: jsonLdUntuk({ jenis: "laman-utama", title: p.data.title, description: p.data.description, slug: "" }) } })),
  ...pagesAsas.filter((p) => p.name === "gaji").map((p) => ({ ...p, data: { ...p.data, canonical: kanonik(p.data.slugHalaman), jsonLd: jsonLdUntuk({ jenis: "dataset", title: p.data.title, description: p.data.description, slug: p.data.slugHalaman }) } })),
  ...pagesAsas.filter((p) => !["index", "gaji"].includes(p.name) && !p.name.startsWith("blog-")).map((p) => ({ ...p, data: { ...p.data, canonical: kanonik(p.data.slugHalaman), jsonLd: jsonLdUntuk({ jenis: "laman", title: p.data.title, description: p.data.description, slug: p.data.slugHalaman }) } })),
  ...blogPosts.map((post) => ({
    name: `blog-${post.slug}`,
    filename: `blog/${post.slug}.html`,
    entry: "/src/main.js",
    data: {
      title: `${post.frontmatter.title} — Jejak Edu`,
      description: post.frontmatter.description,
      slugHalaman: `blog/${post.slug}.html`,
      activePage: "blog",
      activeKumpulan: "belajar",
      url,
      ogType: "article",
      canonical: kanonik(`blog/${post.slug}.html`),
      jsonLd: jsonLdUntuk({
        jenis: "artikel",
        title: post.frontmatter.title,
        description: post.frontmatter.description,
        slug: `blog/${post.slug}.html`,
        tarikh: post.frontmatter.date,
        kategori: post.frontmatter.kategori,
        penulis: namaPenulis(post.frontmatter.penulis),
      }),
      content: generateBlogPostContent(post),
    },
  })),
];

const rewrites = [
  ...blogPosts.map((post) => ({
    from: new RegExp(`^/blog/${post.slug}(\\.html)?$`),
    to: `/blog/${post.slug}.html`,
  })),
  ...penulis.filter((p) => p.aktif).map((p) => ({
    from: new RegExp(`^/penulis/${p.penulis_slug}(\\.html)?$`),
    to: `/penulis/${p.penulis_slug}.html`,
  })),
  { from: /^\/gaji(\.html)?$/, to: "/gaji.html" },
  { from: /^\/about(\.html)?$/, to: "/about.html" },
  { from: /^\/blog(\.html)?$/, to: "/blog.html" },
  { from: /^\/sejarah-pendidikan(\.html)?$/, to: "/sejarah-pendidikan.html" },
  { from: /^\/benchmarking(\.html)?$/, to: "/benchmarking.html" },
  { from: /^\/suara-guru(\.html)?$/, to: "/suara-guru.html" },
  { from: /^\/suara-pelajar(\.html)?$/, to: "/suara-pelajar.html" },
  { from: /^\/resources(\.html)?$/, to: "/resources.html" },
  { from: /^\/penulis(\.html)?$/, to: "/penulis.html" },
  { from: /^\/penulis-dipetik(\.html)?$/, to: "/penulis-dipetik.html" },
  ...dipetik.map((p) => ({
    from: new RegExp(`^/penulis/${p.penulis_slug}(\\.html)?$`),
    to: `/penulis/${p.penulis_slug}.html`,
  })),
  { from: /^\/sumber-kredit(\.html)?$/, to: "/sumber-kredit.html" },
];

export default defineConfig({
  base: BASE,
  plugins: [
    tailwindcss(),
    createMpaPlugin({
      template: "base.html",
      pages,
      rewrites,
    }),
  ],
});
