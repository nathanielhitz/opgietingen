import type { OpgietEvent } from "@/lib/content";
import type { EventType } from "@/lib/site";
import {
  addDaysISO,
  eersteVanMaandIn,
  isoWeek,
  monthYearSlug,
  parseISO,
  parseMonthYearSlug,
  volgendeWeekdag,
  weekendVanIsoWeek,
} from "@/lib/dates";

/*
  Social-kit: welke posts horen bij een referentiedatum (spec §5). Pure
  functies zonder I/O; de routes onder /social en het script social-kit zijn
  dunne schillen hieromheen. Referentie is normaal een vrijdag (Nathaniels
  plandag); vanuit maandag (latere Buffer-adapter) komt hetzelfde weekend.
*/

export type Rubriek = "weekend" | "uitgelicht" | "maand" | "nieuw";
export type Kanaal = "instagram" | "facebook" | "tiktok";
export type Formaat = "feed" | "story";

export const KANALEN: readonly Kanaal[] = ["instagram", "facebook", "tiktok"];
/** Instagram-carrousels tellen maximaal 10 slides: cover + 8 events + afsluiter. */
export const MAX_EVENT_SLIDES = 8;

/** Platte event-weergave voor planning-JSON en captions (geen body, geen sauna-object). */
export interface PlanningEvent {
  slug: string;
  titel: string;
  type: EventType;
  startDatum: string;
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  sauna: string;
  plaats: string;
  provincie: string;
  /** Instagram-handle van de sauna zonder @, als bekend. */
  instagram?: string;
}

export interface Slide {
  rol: "cover" | "event" | "afsluiter";
  eventSlug?: string;
  /** Pad zonder `?formaat=`; de planning maakt er feed- en story-URL's van. */
  pad: string;
}

export interface SocialPost {
  /** Stabiel per week/event, bv. weekend-2026-W37, uitgelicht-<slug>. */
  id: string;
  rubriek: Rubriek;
  /** 1, behalve de tweede en derde uitgelicht-kandidaat (2 en 3). */
  rang: number;
  titel: string;
  plaatsingsdag: string;
  /** Bereik waar de post over gaat (weekend, maand, nieuw-venster of eventdatum). */
  periode: { van: string; tot: string };
  events: PlanningEvent[];
  slides: Slide[];
}

const PRIORITEIT: Record<EventType, number> = { opgietweekend: 0, kampioenschap: 1, thema: 2, regulier: 3 };

function opDatumEnSauna(a: OpgietEvent, b: OpgietEvent): number {
  return a.startDatum.localeCompare(b.startDatum) || a.sauna.naam.localeCompare(b.sauna.naam, "nl");
}

export function aantalTekst(n: number): string {
  return `${n} ${n === 1 ? "opgieting" : "opgietingen"}`;
}

export function naarPlanningEvent(e: OpgietEvent): PlanningEvent {
  return {
    slug: e.slug,
    titel: e.titel,
    type: e.type,
    startDatum: e.startDatum,
    eindDatum: e.eindDatum,
    tijden: e.tijden,
    prijsIndicatie: e.prijsIndicatie,
    sauna: e.sauna.naam,
    plaats: e.sauna.plaats,
    provincie: e.sauna.provincie,
    instagram: e.sauna.instagram,
  };
}

/* ---------- Selectie ---------- */

/** Events die (deels) in het weekend vr–zo van de ISO-week vallen. */
export function weekendEvents(events: OpgietEvent[], week: string): OpgietEvent[] {
  const w = weekendVanIsoWeek(week);
  if (!w) return [];
  return events
    .filter((e) => e.startDatum <= w.tot && (e.eindDatum ?? e.startDatum) >= w.van)
    .sort(opDatumEnSauna);
}

/** Events met startdatum in de maand van de slug ("oktober-2026"). */
export function maandEvents(events: OpgietEvent[], maandSlug: string): OpgietEvent[] {
  const p = parseMonthYearSlug(maandSlug);
  if (!p) return [];
  const prefix = `${p.year}-${String(p.monthIndex + 1).padStart(2, "0")}`;
  return events.filter((e) => e.startDatum.startsWith(prefix)).sort(opDatumEnSauna);
}

/** Events die in [datum-6, datum] zijn gepubliceerd en nog komen. */
export function nieuweEvents(events: OpgietEvent[], datum: string): OpgietEvent[] {
  const van = addDaysISO(datum, -6);
  return events
    .filter((e) => e.gepubliceerdOp !== undefined && e.gepubliceerdOp >= van && e.gepubliceerdOp <= datum && e.startDatum >= datum)
    .sort(opDatumEnSauna);
}

/** Kandidaten voor Uitgelicht: start over 1–4 weken; opgietweekend > kampioenschap > thema > regulier, dan datum. */
export function uitgelichtKandidaten(events: OpgietEvent[], datum: string, n = 3): OpgietEvent[] {
  const van = addDaysISO(datum, 7);
  const tot = addDaysISO(datum, 28);
  return events
    .filter((e) => e.startDatum >= van && e.startDatum <= tot)
    .sort((a, b) => PRIORITEIT[a.type] - PRIORITEIT[b.type] || opDatumEnSauna(a, b))
    .slice(0, n);
}

/* ---------- Posts ---------- */

function carrousel(coverPad: string, events: OpgietEvent[]): Slide[] {
  return [
    { rol: "cover", pad: coverPad },
    ...events.slice(0, MAX_EVENT_SLIDES).map((e) => ({ rol: "event" as const, eventSlug: e.slug, pad: `/social/event/${e.slug}` })),
    { rol: "afsluiter", pad: "/social/afsluiter" },
  ];
}

/** Eerste en laatste dag van de maand van een maandslug. */
export function maandBereik(maandSlug: string): { van: string; tot: string } | null {
  const p = parseMonthYearSlug(maandSlug);
  if (!p) return null;
  const eerste = new Date(Date.UTC(p.year, p.monthIndex, 1));
  const volgende = new Date(Date.UTC(p.year, p.monthIndex + 1, 1));
  return { van: eerste.toISOString().slice(0, 10), tot: addDaysISO(volgende.toISOString().slice(0, 10), -1) };
}

/** Alle posts voor een referentiedatum, gesorteerd op plaatsingsdag en rang. Lege rubrieken vallen weg. */
export function bouwPosts(events: OpgietEvent[], datum: string): SocialPost[] {
  const posts: SocialPost[] = [];

  const week = isoWeek(datum);
  const weekend = weekendVanIsoWeek(week);
  const we = weekendEvents(events, week);
  if (weekend && we.length > 0) {
    posts.push({
      id: `weekend-${week}`,
      rubriek: "weekend",
      rang: 1,
      titel: `Dit weekend: ${aantalTekst(we.length)}`,
      plaatsingsdag: weekend.van > datum ? weekend.van : datum,
      periode: weekend,
      events: we.map(naarPlanningEvent),
      slides: carrousel(`/social/weekend/${week}`, we),
    });
  }

  const nieuw = nieuweEvents(events, datum);
  if (nieuw.length > 0) {
    posts.push({
      id: `nieuw-${datum}`,
      rubriek: "nieuw",
      rang: 1,
      titel: `Nieuw in de agenda: ${aantalTekst(nieuw.length)}`,
      plaatsingsdag: volgendeWeekdag(datum, 1),
      periode: { van: addDaysISO(datum, -6), tot: datum },
      events: nieuw.map(naarPlanningEvent),
      slides: carrousel(`/social/nieuw/${datum}`, nieuw),
    });
  }

  uitgelichtKandidaten(events, datum).forEach((e, i) => {
    posts.push({
      id: `uitgelicht-${e.slug}`,
      rubriek: "uitgelicht",
      rang: i + 1,
      titel: `Uitgelicht: ${e.titel}`,
      plaatsingsdag: volgendeWeekdag(datum, 3),
      periode: { van: e.startDatum, tot: e.eindDatum ?? e.startDatum },
      events: [naarPlanningEvent(e)],
      slides: [{ rol: "event", eventSlug: e.slug, pad: `/social/event/${e.slug}` }],
    });
  });

  const eerste = eersteVanMaandIn(datum, 6);
  if (eerste) {
    const slug = monthYearSlug(eerste);
    const me = maandEvents(events, slug);
    const bereik = maandBereik(slug);
    if (me.length > 0 && bereik) {
      const maandNaam = slug.split("-")[0];
      posts.push({
        id: `maand-${slug}`,
        rubriek: "maand",
        rang: 1,
        titel: `Deze maand: ${aantalTekst(me.length)} in ${maandNaam}`,
        plaatsingsdag: eerste,
        periode: bereik,
        events: me.map(naarPlanningEvent),
        slides: carrousel(`/social/maand/${slug}`, me),
      });
    }
  }

  return posts.sort((a, b) => a.plaatsingsdag.localeCompare(b.plaatsingsdag) || a.rang - b.rang);
}

/** Nummer van de ISO-week (1–53), voor het rouleren van captionvarianten. */
export function weekNummer(iso: string): number {
  return Number(isoWeek(iso).slice(-2));
}

/** Aantal dagen van `van` tot `tot` (positief als `tot` later is). */
export function dagenTussen(van: string, tot: string): number {
  return Math.round((parseISO(tot).getTime() - parseISO(van).getTime()) / 86_400_000);
}
