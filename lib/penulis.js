/**
 * lib/penulis.js — pemuat penulis dengan pengesahan
 * =================================================
 *
 * Satu sumber kebenaran: `content/penulis/*.md`.
 *
 * Prinsip: pautan penulis yang rosak lebih buruk daripada build yang rosak.
 * Jadi kalau satu artikel merujuk slug penulis yang tiada, build GAGAL.
 * Tetapi kalau artikel langsung tidak menyatakan penulis (kes tiga artikel
 * lama Jejak Edu), ia dibiarkan begitu sahaja — tiada byline, tiada ralat.
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import matter from "gray-matter";

let _cache = null;
let _petaCache = null;

/** Buang penanda yang tidak sepatutnya muncul dalam nama paparan. */
function bersihkanNama(nama) {
  return String(nama == null ? "" : nama).trim();
}

/**
 * Muat semua penulis dari `content/penulis/`.
 * Fail yang tidak aktif (`aktif: false`) dibuang, tetapi masih boleh dirujuk
 * oleh artikel (supaya arkib tidak pecah).
 */
export function muatPenulis(dirPenulis, opsyen = {}) {
  const { abaikanCache = false } = opsyen;
  if (_cache && !abaikanCache) return _cache;
  if (!existsSync(dirPenulis)) return (_cache = []);

  const penulis = readdirSync(dirPenulis)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(readFileSync(join(dirPenulis, f), "utf-8"));
      const slugFail = basename(f, ".md");
      const slug = data.penulis_slug || data.slug || slugFail;

      if (!data.nama) {
        throw new Error(`[penulis] ${f}: medan 'nama' wajib ada.`);
      }
      if (slug !== slugFail) {
        throw new Error(
          `[penulis] ${f}: slug "${slug}" tidak sepadan dengan nama fail "${slugFail}". ` +
            `Nama fail ialah satu-satunya sumber kebenaran untuk slug.`
        );
      }

      return {
        ...data,
        nama: bersihkanNama(data.nama),
        penulis_slug: slugFail,
        bio: data.bio || String(content || "").trim().split(/\n\s*\n/)[0] || "",
        bio_panjang: data.bio_panjang || String(content || "").trim(),
        links: Array.isArray(data.links) ? data.links : [],
        aktif: data.aktif !== false,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "ms"));

  _cache = penulis;
  return penulis;
}

/** Peta slug -> penulis, untuk semakan rujukan artikel. */
export function petaPenulis(dirPenulis, opsyen = {}) {
  if (_petaCache && !opsyen.abaikanCache) return _petaCache;
  _petaCache = new Map(muatPenulis(dirPenulis, opsyen).map((p) => [p.penulis_slug, p]));
  return _petaCache;
}

/**
 * Normalisasi medan penulis satu artikel kepada bentuk objek seragam.
 *
 * Menyokong tiga bentuk yang berbeza — dan ini disengajakan, kerana penulis
 * kandungan Jejak Edu bukan semua orang teknikal:
 *
 *   1. `penulis: "Nama"` + `penulis_slug: nama-slug`      (skema UI/UX spec)
 *   2. `penulis: [{nama, peranan, slug}, ...]`            (skema diperluas)
 *   3. tiada `penulis` langsung                            (3 artikel lama)
 */
export function penulisArtikel(frontmatter, peta) {
  const fm = frontmatter || {};
  const mentah = fm.penulis;

  // Bentuk 3 — tiada penulis.
  if (mentah == null || mentah === "") return [];

  // Bentuk 2 — senarai objek.
  if (Array.isArray(mentah)) {
    return mentah
      .map((item) => {
        if (typeof item === "string") {
          const rujukan = peta ? peta.get(item) : null;
          return { nama: item, slug: rujukan ? item : "", peranan: rujukan?.peranan || "", bio: rujukan?.bio || "" };
        }
        if (!item || typeof item !== "object") return null;
        const slug = item.slug || item.penulis_slug || "";
        const rujukan = slug && peta ? peta.get(slug) : null;
        const nama = bersihkanNama(item.nama || rujukan?.nama || "");
        if (!nama) return null;
        return {
          nama,
          slug,
          peranan: item.peranan || rujukan?.peranan || "",
          bio: item.bio || rujukan?.bio || "",
          avatar: item.avatar || rujukan?.avatar || "",
        };
      })
      .filter(Boolean);
  }

  // Bentuk 1 — rentetan nama (mungkin dengan penulis_slug berasingan).
  if (typeof mentah === "string") {
    const nama = bersihkanNama(mentah);
    if (!nama) return [];
    const slug = fm.penulis_slug || "";
    const rujukan = slug && peta ? peta.get(slug) : null;
    return [
      {
        nama: rujukan?.nama || nama,
        slug,
        peranan: fm.penulis_peranan || rujukan?.peranan || "",
        bio: rujukan?.bio || "",
        avatar: rujukan?.avatar || "",
      },
    ];
  }

  return [];
}

/**
 * Sahkan setiap rujukan penulis wujud. Gagalkan build kalau tidak.
 * Artikel tanpa medan penulis dilepaskan — itu keadaan sah untuk arkib lama.
 */
export function sahkanRujukanPenulis(posts, peta) {
  const ralat = [];
  for (const post of posts) {
    const fm = post.frontmatter || {};
    const slug = [].concat(fm.penulis_slug || []).filter(Boolean);
    // Kumpul slug dari bentuk senarai objek juga.
    if (Array.isArray(fm.penulis)) {
      for (const item of fm.penulis) {
        if (item && typeof item === "object" && (item.slug || item.penulis_slug)) {
          slug.push(item.slug || item.penulis_slug);
        }
      }
    }
    for (const s of slug) {
      if (!peta.has(s)) {
        ralat.push(
          `[penulis] artikel "${post.slug}" merujuk penulis "${s}" yang tiada dalam content/penulis/.`
        );
      }
    }
  }
  if (ralat.length) {
    throw new Error(
      `\n${ralat.join("\n")}\n` +
        `Pautan penulis yang rosak lebih buruk daripada build yang rosak. ` +
        `Cipta fail content/penulis/<slug>.md atau betulkan rujukan.\n`
    );
  }
}

/** Bilangan artikel yang ditulis/dirujuk oleh satu penulis. */
export function bilanganArtikelPenulis(posts, slug) {
  return posts.filter((p) => {
    const fm = p.frontmatter || {};
    const slugs = [].concat(fm.penulis_slug || []).filter(Boolean);
    if (Array.isArray(fm.penulis)) {
      for (const item of fm.penulis) {
        if (item && typeof item === "object" && (item.slug || item.penulis_slug)) {
          slugs.push(item.slug || item.penulis_slug);
        }
      }
    }
    return slugs.includes(slug);
  }).length;
}

/** Artikel yang ditulis oleh satu penulis, tersusun terkini dahulu. */
export function artikelPenulis(posts, slug) {
  return posts.filter((p) => {
    const fm = p.frontmatter || {};
    const slugs = [].concat(fm.penulis_slug || []).filter(Boolean);
    if (Array.isArray(fm.penulis)) {
      for (const item of fm.penulis) {
        if (item && typeof item === "object" && (item.slug || item.penulis_slug)) {
          slugs.push(item.slug || item.penulis_slug);
        }
      }
    }
    return slugs.includes(slug);
  });
}

/**
 * Penulis pihak ketiga yang karyanya dipetik oleh Jejak Edu.
 *
 * Ini bahagian "naikkan exposure" — kami bina halaman untuk orang yang *tidak*
 * menulis untuk kami, supaya setiap petikan kami memberi mereka pautan balik
 * yang kekal. Seorang penulis dikira di sini kalau namanya muncul dalam
 * mana-mana `sumber:` berstruktur, tetapi dia tiada fail content/penulis/.
 */
export function penulisDipetik(posts, dirPenulis) {
  const petaLokal = petaPenulis(dirPenulis);
  const kumpulan = new Map();

  for (const post of posts) {
    const sumber = post.frontmatter?.sumber;
    if (!Array.isArray(sumber)) continue;
    for (const item of sumber) {
      if (!item || typeof item !== "object") continue;
      const nama = bersihkanNama(item.penulis);
      if (!nama) continue;
      const slug = item.slug || item.penulis_slug || slugDaripadaNama(nama);
      if (petaLokal.has(slug)) continue; // penulis dalaman, bukan pihak ketiga
      if (!kumpulan.has(slug)) {
        kumpulan.set(slug, {
          penulis_slug: slug,
          nama,
          peranan: item.peranan || "",
          bio: "",
          pihakKetiga: true,
          sumber: [],
        });
      }
      const rekod = kumpulan.get(slug);
      if (item.peranan && !rekod.peranan) rekod.peranan = item.peranan;
      rekod.sumber.push({ ...item, artikel: post.slug, tajukArtikel: post.frontmatter?.title || "" });
    }
  }

  return [...kumpulan.values()].sort((a, b) => a.nama.localeCompare(b.nama, "ms"));
}

/** Tukar nama paparan kepada slug URL yang stabil. */
export function slugDaripadaNama(nama) {
  return String(nama || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
