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

/* ---------- Streepjes-normalisatie (gedeeld door scrapers en social-captions) ---------- */

/**
 * Verwijdert em-streepjes (—) uit vrije proza-tekst (titel, beschrijving).
 * Die lezen als 'AI-achtig'; we vervangen ze context-neutraal maar
 * grammaticaal veilig:
 *   - een ingesloten/aanhangend streepje met spaties (" — ") wordt een komma;
 *   - een streepje zonder spaties (woord—woord) wordt een gewoon koppelteken;
 *   - overtollige spaties vóór komma's en dubbele komma's worden opgeruimd.
 * En-streepjes (–) blijven ongemoeid: die zijn de nette bereikscheiding.
 */
export function normalizeProseDashes(text: string): string {
  return text
    // Regel-initiële em-dash is een opsomming: nette markdown-bullet van maken
    // (vóór de generieke vervangingen, die anders regels aan elkaar plakken).
    .replace(/^—[ \t]*/gm, "- ")
    // Alleen horizontale witruimte matchen: \s zou ook newlines opeten en
    // daarmee een opsomming tot één kommaregel verminken.
    .replace(/[ \t]+—[ \t]+/g, ", ")
    .replace(/—/g, "-")
    .replace(/[ \t]+,/g, ",")
    .replace(/,[ \t]*,/g, ",");
}

/**
 * Voor bereikvelden (tijden, prijsindicatie): een em-streepje is vrijwel altijd
 * een bereikscheiding, dus wordt het het halve streepje zonder spaties dat de
 * rest van de content ook gebruikt (bv. "11:00–18:00").
 */
export function normalizeRangeDashes(text: string): string {
  return text.replace(/\s*—\s*/g, "–");
}
