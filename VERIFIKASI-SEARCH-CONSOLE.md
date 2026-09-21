# Verifikasi Google Search Console — Langkah Manual

Tag verifikasi sudah ada dalam `base.html`. Yang tinggal: ganti placeholder
dengan kod sebenar dari Google, build, push, kemudian tekan Verify.

---

## 1. Daftar property

1. Buka https://search.google.com/search-console
2. Login dengan `akmal.gnipharma@gmail.com`
3. Klik **Add property**
4. Pilih jenis **URL prefix** (kiri), bukan Domain (kanan)
5. Masukkan tepat:
   ```
   https://blackpanthera23.github.io/jejak-edu/
   ```
6. Klik **Continue**

> Kenapa URL prefix dan bukan Domain? Domain property perlukan akses DNS ke
> `github.io` — kita tak kawal. URL prefix cukup dengan tag HTML.

---

## 2. Ambil kod verifikasi

Google akan tunjuk beberapa kaedah. Pilih tab **HTML tag**.

Ia akan bagi sesuatu seperti:

```html
<meta name="google-site-verification" content="AbC123XyZ_abc123XYZ456" />
```

**Salin nilai `content` sahaja** — bahagian dalam tanda petik.

---

## 3. Tampal ke dalam projek

Buka `~/Sites/jejak-edu/base.html`, cari baris:

```html
<meta name="google-site-verification" content="KOD_VERIFIKASI" />
```

Ganti `KOD_VERIFIKASI` dengan kod yang kau salin. Contoh:

```html
<meta name="google-site-verification" content="AbC123XyZ_abc123XYZ456" />
```

Selepas itu, build dan push:

```bash
cd ~/Sites/jejak-edu
npm run build
git add -A && git commit -m "chore: tag verifikasi Search Console"
git push origin main
```

Tunggu ~45 saat untuk GitHub Pages deploy.

---

## 4. Verify

Balik ke Search Console, klik **Verify**.

Kalau gagal, biasanya sebab:
- Belum deploy (tunggu 1-2 minit, tekan Verify lagi)
- Tag ada dalam `base.html` tapi build tak dijalankan
- Kod tersalah salin (perhatikan underscore dan huruf besar/kecil)

---

## 5. Submit sitemap

Selepas verify berjaya:

1. Menu kiri → **Sitemaps**
2. Di bawah "Add a new sitemap", taip:
   ```
   sitemap.xml
   ```
3. Klik **Submit**

Status akan jadi "Success" dalam beberapa minit. Ia akan tunjuk 22 URL.

> URL penuh sitemap kita: `https://blackpanthera23.github.io/jejak-edu/sitemap.xml`

---

## 6. Selepas itu

Google ambil masa. Jangkaan realistik:

| Bila | Apa yang berlaku |
|---|---|
| 1-3 hari | Sitemap diproses, URL ditemui |
| 1-2 minggu | Mula muncul dalam carian (brand name: "Jejak Edu") |
| 2-8 minggu | Muncul untuk carian topikal ("gaji graduan Malaysia") |
| 3-6 bulan | Mula dapat trafik bermakna jika kandungan terus ditambah |

Untuk mempercepat: **URL Inspection** tool dalam Search Console. Taip URL,
klik "Request Indexing". Ada had kuota harian (~10-15 URL), jadi utamakan
halaman utama dahulu.

---

## Nota tentang Bing

Bing Webmaster Tools: https://www.bing.com/webmasters
Kaedah sama — daftar, ambil kod, ganti `KOD_VERIFIKASI_BING` dalam `base.html`.

Bonus: Bing Webmaster ada ciri **import dari Search Console**. Kalau Search
Console dah verified, Bing boleh import terus.

---

## ⚠️ Jangan buat

- **Jangan guna Domain property** — perlukan DNS, kita tak kawal `github.io`
- **Jangan submit sitemap sebelum verify** — ia akan tolak
- **Jangan letak dua tag verifikasi berbeza** dalam satu fail (satu property = satu tag)
