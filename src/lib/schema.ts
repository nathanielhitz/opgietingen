import { site, COUNTRY_LABELS } from "@/lib/site";
import { plainSummary } from "@/lib/text";
import type { Gids, OpgietEvent, Sauna } from "@/lib/content";

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
        logo: `${site.url}/logo.svg`,
        description: site.tagline,
        areaServed: ["Nederland", "België"],
      },
    ],
  };
}

/** schema.org BreadcrumbList voor het kruimelpad (Home + items). */
export function breadcrumbSchema(items: { href?: string; label: string }[]) {
  const all = [{ href: "/", label: "Home" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

/**
 * Parseert een prijs uit vrije tekst ("Vanaf € 49,50" → 49.50). Alleen
 * gebruiken voor Offer.price als er precies één bedrag in de tekst staat —
 * een verkeerd geparsede prijs is erger dan geen prijs (SEO-PLAN §7).
 */
export function parsePrijs(indicatie: string | undefined): number | undefined {
  if (!indicatie) return undefined;
  const matches = indicatie.match(/\d+(?:[.,]\d{1,2})?/g);
  if (!matches || matches.length !== 1) return undefined;
  const value = Number(matches[0].replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
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
  const prijs = parsePrijs(event.prijsIndicatie);
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
      url: absoluteUrl(`/sauna/${sauna.slug}`),
    },
    ...(event.ticketUrl
      ? {
          offers: {
            "@type": "Offer",
            url: event.ticketUrl,
            availability: "https://schema.org/InStock",
            ...(prijs !== undefined ? { price: prijs, priceCurrency: "EUR" } : {}),
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

/**
 * schema.org FAQPage. NB: Google toont sinds mei 2026 geen FAQ-rich-results
 * meer; dit schema dient de citeerbaarheid in AI-zoekmachines (GEO), niet de
 * SERP (SEO-PLAN §7).
 */
export function faqSchema(items: { vraag: string; antwoord: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.vraag,
      acceptedAnswer: { "@type": "Answer", text: item.antwoord },
    })),
  };
}

/** schema.org ItemList JSON-LD voor het sauna-overzicht. */
export function saunaItemListSchema(saunas: Sauna[], name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: saunas.length,
    itemListElement: saunas.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/sauna/${s.slug}`),
      name: s.naam,
    })),
  };
}

/** schema.org Article JSON-LD voor een gidsartikel. */
export function articleSchema(gids: Gids) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: gids.titel,
    description: gids.samenvatting || plainSummary(gids.body, 300),
    ...(gids.afbeelding ? { image: [absoluteUrl(gids.afbeelding)] } : {}),
    ...(gids.bijgewerkt ? { dateModified: gids.bijgewerkt } : {}),
    url: absoluteUrl(`/gids/${gids.slug}`),
    inLanguage: "nl-NL",
    author: { "@type": "Organization", name: site.name, url: site.url },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: { "@type": "ImageObject", url: `${site.url}/logo.svg` },
    },
  };
}

/** schema.org ItemList JSON-LD voor het gids-overzicht. */
export function gidsItemListSchema(gidsen: Gids[], name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: gidsen.length,
    itemListElement: gidsen.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/gids/${g.slug}`),
      name: g.titel,
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
