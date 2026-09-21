import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import matter from "gray-matter";
import { marked } from "marked";
import { prosesBlokPetikan, suntikBlok } from "./kredit.js";

marked.setOptions({ gfm: true, breaks: false });

export function parseMarkdownFile(filePath) {
  const fileContent = readFileSync(filePath, "utf-8");
  const { data: frontmatter, content } = matter(fileContent);
  // Blok `:::petikan … ---kredit … :::` ditukar kepada token dahulu supaya
  // `marked` tidak membalut HTML kredit kita dalam <p>, kemudian disuntik
  // semula selepas markdown selesai diproses.
  const { markdown, blok } = prosesBlokPetikan(content);
  return {
    frontmatter,
    raw: content,
    content: suntikBlok(marked(markdown), blok),
    slug: frontmatter.slug || basename(filePath, ".md"),
  };
}

export function getContentFromDirectory(contentDir, options = {}) {
  const { sortBy = "date", order = "desc", filterDraft = true } = options;
  if (!existsSync(contentDir)) return [];
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  const items = files.map((file) => parseMarkdownFile(join(contentDir, file)));
  const filtered = filterDraft ? items.filter((item) => !item.frontmatter.draft) : items;
  return filtered.sort((a, b) => {
    const aVal = a.frontmatter[sortBy];
    const bVal = b.frontmatter[sortBy];
    if (sortBy === "date") {
      return order === "desc" ? new Date(bVal) - new Date(aVal) : new Date(aVal) - new Date(bVal);
    }
    return order === "desc" ? bVal - aVal : aVal - bVal;
  });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString("ms-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function estimateReadingTime(text) {
  const words = String(text).trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
