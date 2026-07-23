import { getAllEvents } from "@/lib/content";
import { formatDateRange, isUpcoming, todayISO } from "@/lib/dates";
import { site } from "@/lib/site";
import { absoluteUrl } from "@/lib/schema";
import { plainSummary } from "@/lib/text";

/*
  RSS-feed van komende events: versheidssignaal, linkbaar/abonneerbaar kanaal
  voor sauna's en agenda-sites (audit §retentie & off-page). Nieuwe events uit
  de wekelijkse scrape verschijnen automatisch als nieuwe items (guid = URL).
*/

export const revalidate = 3600;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GET() {
  const vandaag = todayISO();
  const events = getAllEvents().filter((e) => isUpcoming(e, vandaag));

  const items = events
    .map((e) => {
      const url = absoluteUrl(`/event/${e.slug}`);
      const titel = `${e.titel} · ${e.sauna.naam} (${formatDateRange(e.startDatum, e.eindDatum)})`;
      return [
        "    <item>",
        `      <title>${xmlEscape(titel)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <description>${xmlEscape(plainSummary(e.body, 300))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${site.name}: komende opgietingen`)}</title>
    <link>${xmlEscape(site.url)}</link>
    <atom:link href="${xmlEscape(`${site.url}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <description>${xmlEscape(site.description)}</description>
    <language>nl</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
