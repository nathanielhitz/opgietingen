import { site, PROVINCES, type EventType } from "@/lib/site";
import { slugify } from "@/lib/content";
import { formatDagKort, monthYearSlug, MONTHS_NL, parseISO } from "@/lib/dates";
import { normalizeProseDashes, normalizeRangeDashes } from "@/lib/text";
import { utmUrl } from "@/lib/utm";
import { aantalTekst, dagenTussen, weekNummer, MAX_EVENT_SLIDES, type Kanaal, type PlanningEvent, type SocialPost } from "@/lib/social";

/*
  Captions uit templates (spec §5.4): deterministisch, feitelijk, zonder
  superlatieven. Variatie via drie openingen die op weeknummer + rang
  rouleren (rang telt mee zodat de 2e/3e uitgelicht-post in dezelfde week
  niet toevallig dezelfde opening krijgt als de 1e).
  Het kalender-emoji vóór elke eventregel is het enige emoji.
*/

export const LIMIET: Record<Kanaal, number> = { instagram: 2200, facebook: Number.POSITIVE_INFINITY, tiktok: 4000 };

const KERN = ["opgieting", "opgietingen", "aufguss", "sauna", "saunaliefhebbers", "wellness"];
/** Facebook krijgt bewust maar drie, kernachtige tags (geen meervoudsdubbel met "opgieting"). */
const KERN_FACEBOOK = ["opgieting", "aufguss", "sauna"];
/** Evergreen gidsposts: geen plaatsen of types, wel de zoektermen van beginners. */
const GIDS_TAGS = ["saunatips", "saunagids"];
/**
 * Maximum per kanaal. TikTok is een zoekmachine: daar mogen de plaats- en
 * saunanamen erbij (ruimte zat, 4000 tekens); Instagram kapt bij 12 omdat
 * langere tagreeksen daar als spam gelden.
 */
const MAX_TAGS: Record<Kanaal, number> = { instagram: 12, tiktok: 15, facebook: 3 };
/** Hoeveel plaats- resp. saunanamen als hashtag meegaan. */
const MAX_NAAM_TAGS = 3;
const TYPE_TAGS: Partial<Record<EventType, string>> = {
  opgietweekend: "opgietweekend",
  kampioenschap: "aufgusskampioenschap",
  thema: "themaopgieting",
};

/** Noord -> zuid, NL vóór BE; onbekende provincies (zou niet moeten voorkomen) komen achteraan. */
const PROVINCIE_VOLGORDE = [...PROVINCES.NL, ...PROVINCES.BE];

function uniek<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function provincieIndex(naam: string): number {
  const i = PROVINCIE_VOLGORDE.indexOf(naam);
  return i === -1 ? PROVINCIE_VOLGORDE.length : i;
}

/** ", van Groningen tot Limburg" als de events over minstens twee provincies verspreid zijn (altijd noord->zuid, NL->BE). */
function spreiding(post: SocialPost): string {
  const provincies = uniek(post.events.map((e) => e.provincie)).sort((a, b) => provincieIndex(a) - provincieIndex(b));
  return provincies.length >= 2 ? `, van ${provincies[0]} tot ${provincies[provincies.length - 1]}` : "";
}

function maandNaam(post: SocialPost): string {
  return MONTHS_NL[parseISO(post.periode.van).getUTCMonth()];
}

/** Sluit af met een punt, tenzij de tekst al op een leesteken eindigt ("…welke kies je?"). */
function zin(s: string): string {
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 week" of "3 weken", minimaal 1. */
function wekenTekst(dagen: number): string {
  const n = Math.max(1, Math.round(dagen / 7));
  return n === 1 ? "1 week" : `${n} weken`;
}

function dagLabel(e: PlanningEvent): string {
  return e.eindDatum && e.eindDatum !== e.startDatum
    ? `${formatDagKort(e.startDatum)} t/m ${formatDagKort(e.eindDatum)}`
    : formatDagKort(e.startDatum);
}

const OPENINGEN: Record<SocialPost["rubriek"], ((p: SocialPost) => string)[]> = {
  weekend: [
    (p) => `Dit weekend op de agenda: ${aantalTekst(p.events.length)}.`,
    (p) => `Zin in een opgieting dit weekend? Dit is er te doen${spreiding(p)}.`,
    (p) => `Weekendplanning: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  nieuw: [
    (p) => `Nieuw in de agenda: ${aantalTekst(p.events.length)} toegevoegd deze week.`,
    (p) => `Vers toegevoegd aan de agenda: ${aantalTekst(p.events.length)}.`,
    (p) => `Deze week nieuw op opgietingen.nl: ${aantalTekst(p.events.length)}.`,
  ],
  maand: [
    (p) => `${hoofdletter(maandNaam(p))} op de agenda: ${aantalTekst(p.events.length)}.`,
    (p) => `Wat staat er in ${maandNaam(p)} op het programma? ${aantalTekst(p.events.length)}.`,
    (p) => `Overzicht ${maandNaam(p)}: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  uitgelicht: [
    (p) => `Uitgelicht: ${p.events[0].titel} bij ${p.events[0].sauna} in ${p.events[0].plaats}.`,
    (p) => `Alvast in je agenda: ${p.events[0].titel}, ${dagLabel(p.events[0])} bij ${p.events[0].sauna}.`,
    (p) => `Over ${wekenTekst(dagenTussen(p.plaatsingsdag, p.events[0].startDatum))}: ${p.events[0].titel} bij ${p.events[0].sauna}.`,
  ],
  gids: [
    (p) => zin(`Saunagids: ${p.gids?.titel ?? p.titel}`),
    (p) => p.gids?.samenvatting || zin(`Saunagids: ${p.titel}`),
    (p) => zin(`Goed om te weten voor je volgende opgieting: ${p.gids?.titel ?? p.titel}`),
  ],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plaats alleen aan de naam toevoegen als die er niet als los woord al in zit. */
function saunaLabel(sauna: string, plaats: string): string {
  const bevatPlaats = new RegExp(`\\b${escapeRegExp(plaats)}\\b`, "i").test(sauna);
  return bevatPlaats ? sauna : `${sauna}, ${plaats}`;
}

function eventRegel(e: PlanningEvent, kanaal: Kanaal): string {
  const tag = kanaal === "instagram" && e.instagram ? ` @${e.instagram}` : "";
  const titel = normalizeProseDashes(e.titel);
  const sauna = normalizeProseDashes(e.sauna);
  const plaats = normalizeProseDashes(e.plaats);
  return `📅 ${dagLabel(e)} · ${titel} · ${saunaLabel(sauna, plaats)}${tag}`;
}

/** De kernpunten van een gids als genummerde regels (zelfde volgorde als de slides). */
function puntRegels(post: SocialPost): string[] {
  return (post.gids?.punten ?? []).map((p, i) => `${i + 1}. ${p.kop}`);
}

function detailRegels(e: PlanningEvent): string[] {
  return [
    ...(e.tijden ? [`Tijden: ${normalizeRangeDashes(e.tijden)}`] : []),
    ...(e.prijsIndicatie ? [`Prijs: ${normalizeRangeDashes(e.prijsIndicatie)}`] : []),
  ];
}

/** Doelpagina op de site per rubriek (voor de Facebook-caption). */
export function doelPad(post: SocialPost): string {
  switch (post.rubriek) {
    case "weekend":
      return "/opgietingen/dit-weekend";
    case "maand":
      return `/agenda/${monthYearSlug(post.periode.van)}`;
    case "uitgelicht":
      return `/event/${post.events[0].slug}`;
    case "nieuw":
      return "/agenda";
    case "gids":
      return post.gids ? `/gids/${post.gids.slug}` : "/gids";
  }
}

function oproepTekst(post: SocialPost): string {
  switch (post.rubriek) {
    case "uitgelicht":
      return "Meer info en tickets";
    case "gids":
      return "De hele gids";
    default:
      return "Volledige agenda";
  }
}

function oproep(post: SocialPost, kanaal: Kanaal): string {
  if (kanaal !== "facebook") return `${oproepTekst(post)} via de link in bio.`;
  const url = utmUrl(new URL(doelPad(post), site.url).toString(), { source: "facebook", medium: "social", campaign: post.id });
  return `${oproepTekst(post)}: ${url}`;
}

/** Hashtag-vorm van een naam: "Sint-Michielsgestel" → "sintmichielsgestel". */
function naamTag(naam: string): string {
  return slugify(naam).replace(/-/g, "");
}

/**
 * Kern + eventtype + plaatsnamen; op TikTok ook de saunanamen (daar wordt op
 * gezocht). Gidsposts krijgen de kern plus de gidstags. Facebook altijd drie.
 */
export function hashtags(post: SocialPost, kanaal: Kanaal): string[] {
  if (kanaal === "facebook") return [...KERN_FACEBOOK];
  if (post.rubriek === "gids") return uniek([...KERN, ...GIDS_TAGS]).slice(0, MAX_TAGS[kanaal]);
  const zichtbaar = post.events.slice(0, MAX_EVENT_SLIDES);
  const types = uniek(post.events.map((e) => TYPE_TAGS[e.type]).filter((t): t is string => Boolean(t)));
  const plaatsen = uniek(zichtbaar.map((e) => naamTag(e.plaats))).slice(0, MAX_NAAM_TAGS);
  const saunas = kanaal === "tiktok" ? uniek(zichtbaar.map((e) => naamTag(e.sauna))).slice(0, MAX_NAAM_TAGS) : [];
  return uniek([...KERN, ...types, ...plaatsen, ...saunas]).slice(0, MAX_TAGS[kanaal]);
}

/**
 * Caption per kanaal; te lange captions laten eventregels van achteren weg.
 * Alleen eventregels worden ingekort; opening, details, oproep en hashtags
 * gaan ervan uit dat ze samen onder de limiet blijven.
 */
export function bouwCaption(post: SocialPost, kanaal: Kanaal): string {
  const varianten = OPENINGEN[post.rubriek];
  const variantIndex = (weekNummer(post.plaatsingsdag) + post.rang - 1) % varianten.length;
  const opening = normalizeProseDashes(varianten[variantIndex](post));
  const regels = post.rubriek === "gids" ? puntRegels(post) : post.events.map((e) => eventRegel(e, kanaal));
  const extra = post.rubriek === "uitgelicht" ? detailRegels(post.events[0]) : [];
  const slot = oproep(post, kanaal);
  const tags = hashtags(post, kanaal).map((t) => `#${t}`).join(" ");

  const samenstellen = (aantal: number): string => {
    const weggelaten = regels.length - aantal;
    return [
      opening,
      "",
      ...regels.slice(0, aantal),
      ...(weggelaten > 0 ? [`Nog ${weggelaten} meer op opgietingen.nl`] : []),
      ...(extra.length > 0 ? ["", ...extra] : []),
      "",
      slot,
      "",
      tags,
    ].join("\n");
  };

  let aantal = regels.length;
  let tekst = samenstellen(aantal);
  while (tekst.length > LIMIET[kanaal] && aantal > 0) {
    aantal--;
    tekst = samenstellen(aantal);
  }
  return tekst;
}
