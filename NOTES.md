# Jejak Edu — Nota Projek & Konvensyen

Portal pendidikan Malaysia. Prinsip teras: **data sebelum pendapat.**

Repo: https://github.com/blackpanthera23/jejak-edu

> Nota: fail ini menggantikan `AGENTS.md`. Sistem Hermes block tulisan ke `AGENTS.md`
> (agent-instruction file, perlu approval interaktif yang tak sampai). Rujuk fail ini
> untuk semua konvensyen projek.

---

## Bahasa & tone

- **BM formal-warm.** Bukan textbook, bukan English-only, bukan slang berlebihan.
- Guna **"anda"** untuk artikel pembaca umum (Dasar, Pendidikan).
- Guna **"kau"** untuk artikel gaya langsung (Kerjaya, Data) — sengaja lebih rapat dengan pembaca muda.
- Istilah tepat sahaja: *dasar*, *kurikulum*, *median*, *jurang*, *sampel*, *pedagogi*.
- Jangan guna: hype, "revolusi", tanda seru bertindan, emoji dalam artikel, ayat pemasaran.
- Satu idea satu perenggan. Ayat pendek menang. Kalau satu perenggan perlu dibaca dua kali, itu masalah kita.

## Peraturan kandungan — HARD RULES

1. **Setiap dakwaan yang boleh diukur MESTI ada angka.** Kalau tiada angka, tulis "tidak diketahui". Jangan ganti dengan ayat umum yang bunyi meyakinkan.
2. **Setiap artikel MESTI ada frontmatter `sumber`.** Kalau tak boleh tunjuk sumber, jangan dakwa ia fakta.
3. **JANGAN reka data.** Fabrication adalah kegagalan tunggal paling teruk dalam projek ini.
4. **Label hipotesis sebagai hipotesis.** Jangan tulis andaian sebagai fakta.
5. **Sampel kecil (n < 25) tidak dipaparkan** dalam paparan data gaji.
6. **Nama individu:** boleh sebagai pakar dengan kredit penuh (nama + peranan + organisasi). Jangan petik tanpa kredit.
7. **Tiada iklan yang menyamar sebagai artikel.** Kalau ada kerjasama komersial, labelkan jelas.

## Struktur artikel standard

```
Pembuka    — kenapa ini penting (2-3 perenggan, kait ke pembaca)
Data       — angka, jadual, petikan bernilai
Konteks    — apa maksudnya, kenapa jadi begini
Untuk anda — apa yang pembaca patut buat dengan maklumat ini
Seterusnya — apa yang perlu diperhatikan + cara kami pantau
Sumber     — dari frontmatter, auto-render
```

Perhatikan: sentiasa ada seksyen **"untuk pembaca"**. Data tanpa tindakan tidak berguna.

## Frontmatter artikel

```yaml
---
title: "Tajuk — boleh panjang, jangan clickbait"
slug: slug-sama-dengan-nama-fail
date: 2026-09-20
description: "Under 160 aksara. Ini yang muncul dalam kad dan meta description."
kategori: Dasar | Data | Kerjaya | Pendidikan
sumber:
  - "Sumber pertama — institusi, tarikh"
  - "Sumber kedua"
---
```

**Kategori mesti salah satu daripada empat.** Warna badge ditentukan oleh kategori dalam `lib/templates.js`.

## Teknikal

- Markdown sahaja dalam `content/blog/`. **Jangan edit HTML generate.**
- Slug mesti sama dengan nama fail (`pisa-2025-matematik-malaysia.md` → slug `pisa-2025-matematik-malaysia`).
- **Semua output dinamik dalam `lib/templates.js` mesti melalui `escapeHtml()`** — frontmatter adalah input, escape sebelum inject.
- Jangan guna `innerHTML` dengan data luaran. Jangan concat string SQL/shell dengan input.
- `marked` diset dengan `breaks: false` — jangan tukar tanpa sebab.

## Menambah artikel

```bash
cat > content/blog/slug-artikel.md << 'EOF'
---
title: "Tajuk"
slug: slug-artikel
date: 2026-09-20
description: "..."
kategori: Dasar
sumber:
  - "Sumber"
---

Kandungan...
EOF

npm run build
```

Page auto-generate di `/blog/slug-artikel.html`. Tiada langkah manual.

## Verify sebelum kata selesai

```bash
npm run build
```

Kemudian **semak sebenar** (bukan andaikan):

- [ ] Tiada `<% %>` placeholder tertinggal dalam `dist/`
- [ ] Setiap artikel ada sumber block (cari `not-prose` dalam HTML)
- [ ] Kalau ubah angka data: cross-check semula terhadap `~/.hermes/references/paygap/salaries_full.csv` dengan Python — jangan kira dalam kepala
- [ ] Buka dalam browser, ambil screenshot, tengok sendiri
- [ ] Uji 390px viewport — tiada horizontal overflow

## Data

Dataset penuh: `~/.hermes/references/paygap/salaries_full.json` (7,339 rekod).
Script scrape semula: `~/.hermes/references/paygap/scrape_paygap.py`.

**Kalau update angka dalam `gaji.html`, kira guna Python dari CSV, bukan manual.** Setiap angka dalam site mesti boleh dikesan semula ke dataset.

## Deploy

Push ke `main` → GitHub Actions auto-build → GitHub Pages.

- Repo: https://github.com/blackpanthera23/jejak-edu
- Site: https://blackpanthera23.github.io/jejak-edu/
- Workflow: `.github/workflows/deploy-pages.yml`

**Nota base path — PENTING:** site ini deploy di subpath `/jejak-edu/`. Link absolute (`href="/blog.html"`) akan pecah di GitHub Pages kerana ia resolve ke root domain. Kalau nak deploy ke subpath, kena guna relative link atau set `base` dalam `vite.config.js`. Untuk root domain (contoh: jejakedu.my), set `base: '/'`.

## Guardrails

- Jangan delete fail sedia ada. Rename dengan suffix `.bak.YYYYMMDD_HHMMSS` atau pindah ke `~/.hermes/.quarantine/`.
- Jangan commit `.env`, token, atau kredensial.
- Jangan paparkan maklumat yang boleh mengesan individu dalam data gaji.
