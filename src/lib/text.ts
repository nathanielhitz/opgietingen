/** Strip lichte markdown/MDX tot platte tekst en kort in (voor meta-descriptions). */
export function plainSummary(markdown: string, maxLen = 160): string {
  const text = markdown
    .replace(/^---[\s\S]*?---/, "") // eventuele frontmatter
    .replace(/^#{1,6}\s+/gm, "") // koppen
    .replace(/[*_`>#-]/g, "") // markdown-tekens
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> tekst
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim()}…`;
}
