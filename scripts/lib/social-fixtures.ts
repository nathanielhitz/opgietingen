// Testfixtures voor de social-kit (taak 9): géén testbestand zelf, dus geen dubbele testrun.
import type { OpgietEvent, Sauna } from "../../src/lib/content";

export const sauna: Sauna = {
  slug: "thermen-bussloo",
  naam: "Thermen Bussloo",
  land: "NL",
  provincie: "Gelderland",
  plaats: "Voorst",
  adres: "Bloemenksweg 38",
  lat: 52.19,
  lng: 6.11,
  faciliteiten: [],
  affiliateUrl: "https://example.com",
  sponsored: false,
  instagram: "thermenbussloo",
  body: "",
};

export function maakEvent(o: Partial<OpgietEvent> & { slug: string; startDatum: string }): OpgietEvent {
  return {
    saunaSlug: sauna.slug,
    titel: `Event ${o.slug}`,
    type: "thema",
    status: "gepubliceerd",
    body: "",
    sauna,
    ...o,
  };
}
