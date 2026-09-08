import { site, type EventType } from "@/lib/site";
import { slugify } from "@/lib/content";
import { formatDagKort, MONTHS_NL, parseISO } from "@/lib/dates";
import { normalizeProseDashes } from "@/lib/text";
import { utmUrl } from "@/lib/utm";
import { aantalTekst, dagenTussen, weekNummer, MAX_EVENT_SLIDES, type Kanaal, type PlanningEvent, type SocialPost } from "@/lib/social";

/*
  Captions uit templates (spec §5.4): deterministisch, feitelijk, zonder
  superlatieven. Variatie via drie openingen die op weeknummer rouleren.
  Het kalender-emoji vóór elke eventregel is het enige emoji.
*/

export const LIMIET: Record<Kanaal, number> = { instagram: 2200, facebook: Number.POSITIVE_INFINITY, tiktok: 4000 };

const KERN = ["opgieting", "opgietingen", "aufguss", "sauna", "saunaliefhebbers", "wellness"];
/** Facebook krijgt bewust maar drie, kernachtige tags (geen meervoudsdubbel met "opgieting"). */
const KERN_FACEBOOK = ["opgieting", "aufguss", "sauna"];
const TYPE_TAGS: Partial<Record<EventType, string>> = {
  opgietweekend: "opgietweekend",
  kampioenschap: "aufgusskampioenschap",
  thema: "themaopgieting",
};

function uniek<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** ", van Groningen tot Limburg" als de events over minstens twee provincies verspreid zijn. */
function spreiding(post: SocialPost): string {
  const provincies = uniek(post.events.map((e) => e.provincie));
  return provincies.length >= 2 ? `, van ${provincies[0]} tot ${provincies[provincies.length - 1]}` : "";
}

function maandNaam(post: SocialPost): string {
  return MONTHS_NL[parseISO(post.periode.van).getUTCMonth()];
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
    (p) => `Dit weekend staan er ${aantalTekst(p.events.length)} op de agenda in Nederland en België.`,
    (p) => `Zin in een opgieting dit weekend? Dit is er te doen${spreiding(p)}.`,
    (p) => `Weekendplanning: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  nieuw: [
    (p) => `Nieuw in de agenda: ${aantalTekst(p.events.length)} toegevoegd deze week.`,
    (p) => `Vers toegevoegd aan de agenda: ${aantalTekst(p.events.length)}.`,
    (p) => `Deze week nieuw op opgietingen.nl: ${aantalTekst(p.events.length)}.`,
  ],
  maand: [
    (p) => `${hoofdletter(maandNaam(p))} op de agenda: ${aantalTekst(p.events.length)} in Nederland en België.`,
    (p) => `Wat staat er in ${maandNaam(p)} op het programma? ${aantalTekst(p.events.length)}.`,
    (p) => `Overzicht ${maandNaam(p)}: ${aantalTekst(p.events.length)}${spreiding(p)}.`,
  ],
  uitgelicht: [
    (p) => `Uitgelicht: ${p.events[0].titel} bij ${p.events[0].sauna} in ${p.events[0].plaats}.`,
    (p) => `Alvast in je agenda: ${p.events[0].titel}, ${dagLabel(p.events[0])} bij ${p.events[0].sauna}.`,
    (p) => `Over ${wekenTekst(dagenTussen(p.plaatsingsdag, p.events[0].startDatum))}: ${p.events[0].titel} bij ${p.events[0].sauna}.`,
  ],
};

function saunaLabel(e: PlanningEvent): string {
  return e.sauna.toLowerCase().includes(e.plaats.toLowerCase()) ? e.sauna : `${e.sauna}, ${e.plaats}`;
}

function eventRegel(e: PlanningEvent, kanaal: Kanaal): string {
  const tag = kanaal === "instagram" && e.instagram ? ` @${e.instagram}` : "";
  return `📅 ${dagLabel(e)} · ${e.titel} · ${saunaLabel(e)}${tag}`;
}

function detailRegels(e: PlanningEvent): string[] {
  return [...(e.tijden ? [`Tijden: ${e.tijden}`] : []), ...(e.prijsIndicatie ? [`Prijs: ${e.prijsIndicatie}`] : [])];
}

/** Doelpagina op de site per rubriek (voor de Facebook-caption). */
export function doelPad(post: SocialPost): string {
  switch (post.rubriek) {
    case "weekend":
      return "/opgietingen/dit-weekend";
    case "maand":
      return `/agenda/${post.id.replace(/^maand-/, "")}`;
    case "uitgelicht":
      return `/event/${post.events[0].slug}`;
    case "nieuw":
      return "/agenda";
  }
}

function oproep(post: SocialPost, kanaal: Kanaal): string {
  if (kanaal !== "facebook") {
    return post.rubriek === "uitgelicht" ? "Meer info en tickets via de link in bio." : "Volledige agenda via de link in bio.";
  }
  const url = utmUrl(new URL(doelPad(post), site.url).toString(), { source: "facebook", medium: "social", campaign: post.id });
  return post.rubriek === "uitgelicht" ? `Meer info en tickets: ${url}` : `Volledige agenda: ${url}`;
}

export function hashtags(post: SocialPost, kanaal: Kanaal): string[] {
  if (kanaal === "facebook") return KERN_FACEBOOK;
  if (kanaal === "tiktok") return KERN.slice(0, 5);
  const types = uniek(post.events.map((e) => TYPE_TAGS[e.type]).filter((t): t is string => Boolean(t)));
  const plaatsen = uniek(post.events.slice(0, MAX_EVENT_SLIDES).map((e) => slugify(e.plaats).replace(/-/g, ""))).slice(0, 3);
  return uniek([...KERN, ...types, ...plaatsen]).slice(0, 12);
}

/** Caption per kanaal; te lange captions laten eventregels van achteren weg. */
export function bouwCaption(post: SocialPost, kanaal: Kanaal): string {
  const varianten = OPENINGEN[post.rubriek];
  const opening = varianten[weekNummer(post.plaatsingsdag) % varianten.length](post);
  const regels = post.events.map((e) => eventRegel(e, kanaal));
  const extra = post.rubriek === "uitgelicht" ? detailRegels(post.events[0]) : [];
  const slot = oproep(post, kanaal);
  const tags = hashtags(post, kanaal).map((t) => `#${t}`).join(" ");

  const samenstellen = (aantal: number): string => {
    const weggelaten = regels.length - aantal;
    return normalizeProseDashes(
      [
        opening,
        "",
        ...regels.slice(0, aantal),
        ...(weggelaten > 0 ? [`…en ${weggelaten} meer op opgietingen.nl`] : []),
        ...(extra.length > 0 ? ["", ...extra] : []),
        "",
        slot,
        "",
        tags,
      ].join("\n"),
    );
  };

  let aantal = regels.length;
  let tekst = samenstellen(aantal);
  while (tekst.length > LIMIET[kanaal] && aantal > 0) {
    aantal--;
    tekst = samenstellen(aantal);
  }
  return tekst;
}
