/*
  Kale HTML → leesbare tekst, zonder dependencies. Gedeeld door de scraper-laag
  (goedkope fetch-route) en de scripts (mail-parsing, verify-bronnen).
*/

/** Ruwe HTML → leesbare tekst; verwijdert scripts/styles en comprimeert witruimte. */
export function htmlToText(html: string, maxChars = 60000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "€")
    // Betekenisdragende entities decoderen vóór de catch-all: "&lt;12 jaar"
    // dat een spatie wordt draait de betekenis om ("<12 jaar" → "12 jaar").
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:#39|apos|rsquo|lsquo);/gi, "'")
    .replace(/&(?:ldquo|rdquo);/gi, '"')
    .replace(/&deg;/gi, "°")
    .replace(/&(?:mdash|ndash);/gi, "-")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[ingekort]` : text;
}
