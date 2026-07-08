import { site, COUNTRY_LABELS } from "@/lib/site";
import { plainSummary } from "@/lib/text";
import type { OpgietEvent, Sauna } from "@/lib/content";

/** Maakt van een pad een absolute URL op basis van de site-URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, site.url).toString();
}

const COUNTRY_CODE: Record<string, string> = { NL: "NL", BE: "BE" };

/** WebSite + Organization JSON-LD voor de homepage (merkentiteit / GEO). */
export function siteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site.url}#website`,
        url: site.url,
        name: site.name,
        description: site.description,
        inLanguage: "nl-NL",
        publisher: { "@id": `${site.url}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${site.url}#organization`,
        name: site.name,
        url: site.url,
        description: site.tagline,
        areaServed: ["Nederland", "België"],
      },
    ],
  };
}

function placeSchema(sauna: Sauna) {
  return {
    "@type": "Place",
    name: sauna.naam,
    address: {
      "@type": "PostalAddress",
      streetAddress: sauna.adres,
      addressLocality: sauna.plaats,
      addressRegion: sauna.provincie,
      addressCountry: COUNTRY_CODE[sauna.land] ?? sauna.land,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: sauna.lat,
      longitude: sauna.lng,
    },
  };
}

/** schema.org Event JSON-LD voor een event-detailpagina. */
export function eventSchema(event: OpgietEvent) {
  const { sauna } = event;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.titel,
    startDate: event.startDatum,
    endDate: event.eindDatum ?? event.startDatum,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: plainSummary(event.body, 300),
    ...(event.afbeelding ? { image: [absoluteUrl(event.afbeelding)] } : {}),
    url: absoluteUrl(`/event/${event.slug}`),
    location: placeSchema(sauna),
    organizer: {
      "@type": "Organization",
      name: sauna.naam,
      ...(sauna.website ? { url: sauna.website } : {}),
    },
    ...(event.ticketUrl
      ? {
          offers: {
            "@type": "Offer",
            url: absoluteUrl(`/uit/${event.slug}`),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            category: event.prijsIndicatie ?? "Toegang",
          },
        }
      : {}),
  };
}

/** schema.org ItemList JSON-LD voor lijstpagina's (agenda/maand/provincie). */
export function eventItemListSchema(events: OpgietEvent[], name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: events.length,
    itemListElement: events.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/event/${e.slug}`),
      name: e.titel,
    })),
  };
}

/** schema.org LocalBusiness JSON-LD voor een saunapagina. */
export function saunaSchema(sauna: Sauna) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
    name: sauna.naam,
    description: plainSummary(sauna.body, 300),
    ...(sauna.afbeelding ? { image: [absoluteUrl(sauna.afbeelding)] } : {}),
    url: absoluteUrl(`/sauna/${sauna.slug}`),
    ...(sauna.website ? { sameAs: [sauna.website] } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: sauna.adres,
      addressLocality: sauna.plaats,
      addressRegion: sauna.provincie,
      addressCountry: COUNTRY_CODE[sauna.land] ?? sauna.land,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: sauna.lat,
      longitude: sauna.lng,
    },
    areaServed: COUNTRY_LABELS[sauna.land],
    amenityFeature: sauna.faciliteiten.map((naam) => ({
      "@type": "LocationFeatureSpecification",
      name: naam,
      value: true,
    })),
  };
}
