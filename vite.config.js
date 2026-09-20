import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { createMpaPlugin } from "vite-plugin-virtual-mpa";
import { resolve } from "path";
import { readFileSync } from "fs";
import { getContentFromDirectory, formatDate, estimateReadingTime } from "./lib/content.js";
import { generateBlogCard, generateSourceBlock, url } from "./lib/templates.js";

const __dirname = resolve();

// GitHub Pages deploy di subpath /jejak-edu/. Set VITE_BASE="/" untuk root domain.
const BASE = process.env.VITE_BASE || "/jejak-edu/";

const blogDir = resolve(__dirname, "content/blog");
const blogPosts = getContentFromDirectory(blogDir, {
  sortBy: "date",
  order: "desc",
});

const recentBlogPosts = blogPosts.slice(0, 3);

const blogListTemplate = readFileSync(
  resolve(__dirname, "templates/blog-list.html"),
  "utf-8"
);
const blogPostTemplate = readFileSync(
  resolve(__dirname, "templates/blog-post.html"),
  "utf-8"
);

const indexContent = readFileSync(resolve(__dirname, "index.html"), "utf-8");
const gajiContent = readFileSync(resolve(__dirname, "gaji.html"), "utf-8");
const aboutContent = readFileSync(resolve(__dirname, "about.html"), "utf-8");

function generateBlogListContent() {
  const cardsHtml = blogPosts.map((post) => generateBlogCard(post)).join("\n");
  return blogListTemplate.replace("<%- blogCards %>", cardsHtml);
}

function generateBlogPostContent(post) {
  const { frontmatter, content, raw } = post;
  const dateFormatted = formatDate(frontmatter.date);
  const minutes = estimateReadingTime(raw || content);
  return blogPostTemplate
    .replace(/<%=\s*kategori\s*%>/g, frontmatter.kategori || "Pendidikan")
    .replace(/<%=\s*title\s*%>/g, frontmatter.title)
    .replace(/<%=\s*description\s*%>/g, frontmatter.description || "")
    .replace(/<%=\s*date\s*%>/g, dateFormatted)
    .replace(/<%=\s*readingTime\s*%>/g, minutes)
    .replace(/<%- sourceBlock %>/g, generateSourceBlock(post))
    .replace(/<%=\s*sourceBlock\s*%>/g, generateSourceBlock(post))
    .replace(/<%- sumber %>/g, generateSourceBlock(post))
    .replace(/<%- content %>/g, content);
}

function generateHomepageContent() {
  const recentBlogHtml = recentBlogPosts.map((post) => generateBlogCard(post)).join("\n");
  return indexContent.replace("<%- recentBlogPosts %>", recentBlogHtml);
}

const pages = [
  {
    name: "index",
    entry: "/src/main.js",
    data: {
      title: "Jejak Edu — Data & Konteks Pendidikan Malaysia",
      description:
        "Data dan konteks pendidikan Malaysia untuk pelajar, ibu bapa dan guru. PISA, Kurikulum 2027, data gaji graduan.",
      activePage: "home",
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
      activePage: "gaji",
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
      activePage: "about",
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
      activePage: "blog",
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
      activePage: "blog",
      url,
      content: generateBlogPostContent(post),
    },
  })),
];

const rewrites = [
  ...blogPosts.map((post) => ({
    from: new RegExp(`^/blog/${post.slug}(\\.html)?$`),
    to: `/blog/${post.slug}.html`,
  })),
  { from: /^\/gaji(\.html)?$/, to: "/gaji.html" },
  { from: /^\/about(\.html)?$/, to: "/about.html" },
  { from: /^\/blog(\.html)?$/, to: "/blog.html" },
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
