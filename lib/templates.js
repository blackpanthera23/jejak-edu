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
    <article class="group bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-md transition-all flex flex-col">
      <div class="p-6 flex flex-col flex-1">
        <span class="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${warna} self-start mb-4">${escapeHtml(kategori)}</span>
        <h3 class="text-lg font-bold text-slate-900 mb-3 leading-snug">
          <a href="/blog/${encodeURIComponent(post.slug)}.html" class="hover:text-teal-700 transition-colors">${safeTitle}</a>
        </h3>
        <p class="text-sm text-slate-600 leading-relaxed mb-5 flex-1">${safeDesc}</p>
        <div class="flex items-center justify-between pt-4 border-t border-stone-100 mt-auto">
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
  const items = sumber
    .map((s) => `<li class="leading-relaxed">${escapeHtml(s)}</li>`)
    .join("\n");
  return `
    <aside class="mt-12 bg-stone-100 border border-stone-200 rounded-xl p-6 not-prose">
      <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Sumber</h2>
      <ul class="space-y-2 text-sm text-slate-600 list-disc list-inside">
        ${items}
      </ul>
      <p class="text-xs text-slate-500 mt-4 pt-4 border-t border-stone-200">
        Jejak Edu memetik sumber primer. Kalau anda jumpa ketidaktepatan, sila hubungi kami untuk pembetulan.
      </p>
    </aside>
  `;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
