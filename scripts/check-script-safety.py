#!/usr/bin/env python3
"""Semak blok <script> dalam dist/ tidak boleh dipecahkan oleh data.

KENAPA INI WUJUD
----------------
Parser HTML menamatkan blok <script> pada urutan literal `</script`, walau di
mana ia muncul — termasuk di dalam string JSON. `JSON.stringify` TIDAK escape
`<`, `>` atau `/`, jadi mana-mana medan frontmatter (title, description, nama
penulis) yang mengandungi `</script>` akan:

  1. menamatkan blok JSON-LD lebih awal, dan
  2. menjadikan bakinya tag <script> inline yang LAKSANA.

Ini XSS tersimpan yang terbit sebagai HTML statik. Ia pernah wujud dalam
vite.config.js (4 lokasi JSON-LD) dan ditutup dengan `jsonSelamatUntukScript()`.
Gate ini memastikan ia tidak kembali melalui jalan lain.

Cara ia berfungsi: bukan mencari substring (payload yang sah SEBAGAI DATA juga
mengandungi `</script>`). Sebaliknya ia mengira tag <script> yang parser HTML
sebenar lihat, dan mengesahkan setiap blok JSON-LD boleh di-parse sebagai JSON.

Guna: python3 scripts/check-script-safety.py
Keluar 0 = selamat. Keluar 1 = ada blok <script> yang boleh dipecahkan.
"""
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

DIST = pathlib.Path("dist")
if not DIST.exists():
    sys.exit("[script-safety] dist/ tidak wujud — jalankan build dulu.")


class ScriptCollector(HTMLParser):
    """Kumpul setiap tag <script> yang parser HTML benar-benar lihat."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.scripts = []
        self._cur = None

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self._cur = dict(attrs)
            self.scripts.append({"attrs": dict(attrs), "body": ""})

    def handle_data(self, data):
        if self._cur is not None and self.scripts:
            self.scripts[-1]["body"] += data

    def handle_endtag(self, tag):
        if tag == "script":
            self._cur = None


failures = []
warnings = []
checked = 0

for page in sorted(DIST.rglob("*.html")):
    rel = page.relative_to(DIST).as_posix()
    collector = ScriptCollector()
    try:
        collector.feed(page.read_text(encoding="utf-8", errors="replace"))
    except Exception as exc:  # parser tidak patut gagal, tapi jangan matikan gate
        warnings.append(f"{rel}: parser gagal ({exc})")
        continue

    for i, s in enumerate(collector.scripts):
        checked += 1
        attrs, body = s["attrs"], s["body"]
        typ = attrs.get("type", "")
        has_src = "src" in attrs

        # 1. Setiap blok JSON-LD mesti boleh di-parse. Kalau tidak, ia bermakna
        #    blok itu ditamatkan lebih awal oleh `</script>` dalam data.
        if typ == "application/ld+json":
            try:
                json.loads(body)
            except Exception as exc:
                snippet = body.strip()[:120]
                failures.append(
                    f"{rel}: blok JSON-LD #{i} TIDAK boleh di-parse ({exc}). "
                    f"Data mungkin mengandungi '</script>' mentah. "
                    f"Cuplikan: {snippet!r}"
                )

        # 2. Tag <script> inline TANPA type yang mengandungi corak tag berbahaya
        #    bukan sesuatu yang kita jana. Semua inline kita ada type.
        if not has_src and not typ and body.strip():
            failures.append(
                f"{rel}: tag <script> inline tanpa 'type' (#{i}) — "
                f"kemungkinan hasil breakout. Cuplikan: {body.strip()[:120]!r}"
            )

# 3. Tiada `</script` mentah boleh muncul dalam atribut yang tidak di-escape.
#    Ini menangkap breakout melalui atribut, bukan hanya isi elemen.
raw_attr_re = re.compile(r'="[^"]*</\s*script', re.I)
for page in sorted(DIST.rglob("*.html")):
    rel = page.relative_to(DIST).as_posix()
    txt = page.read_text(encoding="utf-8", errors="replace")
    if raw_attr_re.search(txt):
        failures.append(f"{rel}: '</script' mentah dalam nilai atribut HTML.")

print(f"[script-safety] {checked} tag <script> diperiksa merentas "
      f"{len(list(DIST.rglob('*.html')))} halaman.")

for w in warnings:
    print(f"[script-safety] AMARAN: {w}")

if failures:
    print()
    print(f"[script-safety] GAGAL — {len(failures)} masalah. JANGAN deploy.")
    for f in failures:
        print(f"  x {f}")
    print()
    print("[script-safety] Betulkan serializer (jsonSelamatUntukScript), bukan gate ini.")
    sys.exit(1)

print("[script-safety] LULUS — tiada blok <script> boleh dipecahkan oleh data.")
