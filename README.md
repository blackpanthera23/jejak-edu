# Jejak Edu

MVP portal pendidikan Malaysia — data dan konteks untuk pelajar, ibu bapa dan guru.

**Stack:** Vite 7 · Tailwind CSS 4 · Alpine.js 3 · Markdown blog

## Jalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
```

## Struktur

```
content/blog/       Artikel markdown (frontmatter: title, slug, date, description, kategori, sumber)
templates/          blog-list.html, blog-post.html
lib/content.js      Parse markdown + reading time
lib/templates.js    Blog card + source block generator
index.html          Homepage
gaji.html           Data gaji graduan (7,339 rekod)
about.html          Tentang + prinsip editorial
base.html           Layout (nav + footer)
```

## Tambah artikel

```bash
cat > content/blog/slug-artikel.md << 'EOF'
---
title: "Tajuk"
slug: slug-artikel
date: 2026-09-20
description: "Under 160 chars"
kategori: Dasar | Data | Kerjaya | Pendidikan
sumber:
  - "Sumber pertama"
  - "Sumber kedua"
---

Kandungan markdown...
EOF
```

Page auto-generate di `/blog/slug-artikel.html`.

## Sumber data

- Rancangan Pendidikan Negara 2026–2035 (KPM/KPT)
- PISA 2025 (OECD)
- Kurikulum Persekolahan 2027 (BPK, KPM)
- 7,339 rekod gaji anonim (2024–2026)

Semua data gaji dalam `gaji.html` dikira daripada dataset penuh. Kalau nak update, guna script scrape di `~/.hermes/references/paygap/scrape_paygap.py`.

## Prinsip editorial

1. Data sebelum pendapat
2. Sumber boleh disemak
3. Bahasa manusia
4. Anonim itu penting
5. Tiada iklan yang menyamar sebagai artikel

## Deploy

```bash
npm run build
```

Works dengan Netlify, Vercel, Cloudflare Pages, GitHub Pages.
