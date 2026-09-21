import Alpine from "alpinejs";
import "./style.css";

/* ============================================================
   tldrModul — kawalan TL;DR tanpa menyembunyikan kandungan.
   Prinsip: kandungan penuh TIDAK pernah dikeluarkan dari DOM.
   ============================================================ */
Alpine.data("tldrModul", () => ({
  terbuka: false,
  anchorTerakhir: null,
  _melompat: false, // penjaga: jangan jejak skrol yang kita sendiri cetuskan
  _t: null,

  init() {
    // 1. Kalau JS hidup, matikan kawalan <details> asli supaya tidak berebut.
    const det = this.$root.querySelector("details[data-tldr]");
    if (det) {
      det.open = true;
      det.querySelector("summary")?.setAttribute("inert", "");
    }

    // 2. Kalau datang dari pautan #anchor, anggap kandungan sudah "terbuka".
    if (location.hash && location.hash.length > 1) {
      this.terbuka = true;
      this.anchorTerakhir = location.hash;
    }

    // 3. Ingat seksyen terakhir yang dibaca.
    let tick = false;
    const jejak = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        // Satu-satunya penjaga yang diperlukan: jangan kemas kini penanda
        // semasa kita sendiri yang menatal.
        if (this._melompat) return;

        const h2s = this.$root.parentElement.querySelectorAll("#kandungan-penuh h2[id]");
        let calon = null;
        for (const h of h2s) {
          if (h.getBoundingClientRect().top <= window.innerHeight * 0.25) calon = h;
          else break;
        }
        if (calon) this.anchorTerakhir = "#" + calon.id;
      });
    };
    window.addEventListener("scroll", jejak, { passive: true });

    // Buka semula penjejak sebaik skrol program tamat.
    window.addEventListener("scrollend", () => { this._melompat = false; });

    jejak();
  },

  bukaPenuh() {
    if (!this.terbuka) {
      // "Baca penuh" = bawa ke tempat pembaca berhenti, atau ke h2 pertama.
      this.terbuka = true;
      const sasaran =
        this.anchorTerakhir ||
        "#" + this.$root.parentElement.querySelector("#kandungan-penuh h2[id]")?.id;
      this._lompat(sasaran);
    } else {
      // "Tutup balik" = naik ke TL;DR. anchorTerakhir TIDAK disentuh.
      this.terbuka = false;
      this._lompat("#tldr-tajuk");
    }
  },

  _lompat(sel) {
    const el = sel && document.querySelector(sel);
    if (!el) return;

    this._melompat = true;
    clearTimeout(this._t);
    this._t = setTimeout(() => { this._melompat = false; }, 1000);

    const kurangkanGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: kurangkanGerak ? "auto" : "smooth", block: "start" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  },
}));

/* ============================================================
   navigasiKumpulan — menu header + panel mudah alih
   ============================================================ */
Alpine.data("navigasiKumpulan", () => ({
  menuBuka: false,
  kumpulanBuka: null,

  tutupSemua() {
    this.menuBuka = false;
    this.kumpulanBuka = null;
  },

  init() {
    this.$el.addEventListener("click", (e) => {
      if (e.target.closest("a") && window.matchMedia("(max-width: 767px)").matches) {
        this.menuBuka = false;
      }
    });
  },
}));

/* ============================================================
   borangSuara — borang hantaran anonim (mock; endpoint belum wujud)
   ============================================================ */
Alpine.data("borangSuara", () => ({
  kategori: "",
  cerita: "",
  namaPanggilan: "",
  negeri: "",
  persetujuan: false,
  menghantar: false,
  siap: false,
  rujukan: "",
  ralat: "",
  tidakTersedia: false,

  HAD: 500,
  MIN: 50,

  get baki() { return this.HAD - this.cerita.length; },
  get terlaluPendek() { return this.cerita.trim().length < this.MIN; },

  get perluBantuan() {
    if (this.kategori === "isu") return true;
    return this.kategori === "duka" && this.cerita.length > 150;
  },

  get bolehHantar() {
    return (
      this.kategori !== "" &&
      !this.terlaluPendek &&
      this.cerita.length <= this.HAD &&
      this.persetujuan &&
      !this.menghantar
    );
  },

  hantarLagi() {
    this.kategori = ""; this.cerita = ""; this.namaPanggilan = "";
    this.negeri = ""; this.persetujuan = false;
    this.siap = false; this.ralat = ""; this.rujukan = "";
    this.$nextTick(() => this.$root.querySelector("input[name=kategori]")?.focus());
  },

  async hantar() {
    this.ralat = "";
    if (!this.bolehHantar) return;

    // Honeypot: kalau diisi, ia bot. Gagal senyap.
    const perangkap = this.$root.querySelector("input[name=laman_web]");
    if (perangkap && perangkap.value) return;

    this.menghantar = true;
    try {
      const endpoint = this.$el.dataset.endpoint;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori: this.kategori,
          cerita: this.cerita.trim(),
          nama_panggilan: this.namaPanggilan.trim() || null,
          negeri: this.negeri || null,
          // JANGAN hantar: IP, UA, rujukan, cookie.
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      this.rujukan = data.rujukan || "SP-" + Date.now().toString(36).toUpperCase();
      this.siap = true;
      this.$nextTick(() => this.$root.querySelector("[role=status]")?.focus());
    } catch (e) {
      // Endpoint belum wujud lagi — beritahu perkara sebenar, jangan menipu.
      this.tidakTersedia = true;
      this.ralat =
        "Sambungan hantaran belum dibuka lagi. Cerita anda masih ada di skrin ini — sila salin dan simpan dahulu, atau hantar melalui emel hello@jejakedu.my.";
    } finally {
      this.menghantar = false;
    }
  },
}));

/* ============================================================
   laporKandungan — dialog lapor (tanpa nama)
   ============================================================ */
Alpine.data("laporKandungan", (idEntri = "") => ({
  lapor: false,
  sebabLapor: "",
  melapor: false,
  selesai: false,
  ralatLapor: "",

  buka() {
    this.lapor = true;
    this.$nextTick(() => this.$root.querySelector("[role=dialog] input")?.focus());
  },

  tutup() {
    this.lapor = false;
    if (!this.selesai) { this.sebabLapor = ""; }
  },

  async hantarLaporan() {
    if (!this.sebabLapor || this.melapor) return;
    this.melapor = true;
    try {
      const res = await fetch(this.$el.dataset.endpointLapor, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entri: idEntri, sebab: this.sebabLapor }),
      });
      if (!res.ok) throw new Error(String(res.status));
      this.selesai = true;
      setTimeout(() => {
        this.lapor = false;
        this.sebabLapor = "";
        this.selesai = false;
      }, 2500);
    } catch (e) {
      this.ralatLapor = "Laporan gagal dihantar. Cuba sekali lagi.";
    } finally {
      this.melapor = false;
    }
  },
}));

/* ============================================================
   penapisJadual — tapisan jadual perbandingan (Penanda Aras)
   ============================================================ */
Alpine.data("penapisJadual", (tajuk = "") => ({
  dipilih: tajuk,
  init() { this.dipilih = tajuk; },
}));

window.Alpine = Alpine;
Alpine.start();
