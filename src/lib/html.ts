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
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[ingekort]` : text;
}
