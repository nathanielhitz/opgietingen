import { site, socials, type SocialId } from "@/lib/site";

/*
  UTM-conventie (spec §8.4):
    utm_source   instagram | facebook | tiktok | whatsapp | link | native | social
    utm_medium   bio (link-in-bio) | social (caption-link) | deel (deelknoppen)
    utm_campaign links | <post-id> | event-<slug>
  Vercel Analytics toont utm_source als bron.
*/
export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
}

function schoon(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Voegt UTM-parameters toe; een relatief pad blijft relatief, bestaande query blijft staan. */
export function utmUrl(padOfUrl: string, utm: UtmParams): string {
  const absoluut = /^https?:\/\//.test(padOfUrl);
  const url = new URL(padOfUrl, site.url);
  url.searchParams.set("utm_source", schoon(utm.source));
  url.searchParams.set("utm_medium", schoon(utm.medium));
  url.searchParams.set("utm_campaign", schoon(utm.campaign));
  return absoluut ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/** `?k=` van /links naar een bekend kanaal; onbekend of leeg wordt "social". */
export function kanaalUitParam(k: string | undefined): SocialId | "social" {
  const gevonden = socials.find((s) => s.id === k);
  return gevonden ? gevonden.id : "social";
}
