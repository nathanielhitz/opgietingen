import { MONTHS_NL, parseISO, formatDate, formatDateRange } from "./dates";

/**
 * SEO-titel en meta description voor event-pagina's.
 *
 * Aanleiding: GSC toonde ~400 vertoningen op "natupop 2026"/"natupop zeewolde"
 * met 0% CTR. De oude titel ("<titel> bij <sauna>") miste datum en plaats, en
 * de description was een afgekapte eerste alinea zonder hook. Dit patroon
 * zet event, datum, sauna/plaats en een concrete hook in elke snippet, en
 * maakt voor afgelopen events duidelijk dat er geen tickets meer zijn.
 */

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;
export const MIN_DESCRIPTION = 120;

export interface EventMetaInput {
  titel: string;
  startDatum: string;
  eindDatum?: string;
  sauna: { naam: string; plaats: string };
  /** Is het event al geweest (t.o.v. de request-datum)? */
  afgelopen: boolean;
}

/** Compacte datum voor titels: "24 juli 2026", "24–26 juli 2026", "31 okt – 2 nov 2026". */
export function formatDateCompact(start: string, end?: string, metJaar = true): string {
  const s = parseISO(start);
  const e = end && end !== start ? parseISO(end) : null;
  const jaar = metJaar ? ` ${(e ?? s).getUTCFullYear()}` : "";
  if (!e) return `${s.getUTCDate()} ${MONTHS_NL[s.getUTCMonth()]}${jaar}`;
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  if (sameMonth) return `${s.getUTCDate()}–${e.getUTCDate()} ${MONTHS_NL[e.getUTCMonth()]}${jaar}`;
  return `${s.getUTCDate()} ${MONTHS_NL[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS_NL[e.getUTCMonth()]}${jaar}`;
}

/** Datum in lopende tekst: "24 juli 2026" of "24 t/m 26 juli 2026". */
export function formatDateProse(start: string, end?: string): string {
  if (!end || end === start) return formatDate(start);
  return formatDateRange(start, end).replace(" – ", " t/m ");
}

/**
 * Titel: "<event> · <datum> · <sauna> <plaats>", ingekort in vaste stappen tot
 * hij binnen MAX_TITLE past. De site-template hangt er nog " · Opgietingen.nl"
 * achter; Google kapt zelf af, dus de belangrijkste woorden staan vooraan.
 */
export function eventMetaTitle(e: EventMetaInput): string {
  const titel = e.titel.trim();
  const { naam, plaats } = e.sauna;
  const datum = formatDateCompact(e.startDatum, e.eindDatum);
  // Plaats alleen toevoegen als die niet al in de saunanaam zit ("Thermen Bussloo" + "Bussloo").
  const plaatsInNaam = naam.toLowerCase().includes(plaats.toLowerCase());
  const locatieVol = plaatsInNaam ? naam : `${naam} ${plaats}`;

  const kandidaten = [
    `${titel} · ${datum} · ${locatieVol}`,
    `${titel} · ${datum} · ${naam}`,
    `${titel} · ${datum} · ${plaats}`,
    // Laatste stap houdt bewust het jaar: zoekers typen "<event> 2026".
    `${titel} · ${datum}`,
  ];
  return kandidaten.find((k) => k.length <= MAX_TITLE) ?? kandidaten[kandidaten.length - 1];
}

/**
 * Description: event + datum + sauna/plaats, gevolgd door een hook. Komende
 * events krijgen de ticket-hook; afgelopen events zeggen expliciet dat het
 * geweest is (geen tickets suggereren) en verwijzen naar komende opgietingen.
 * De langste variant die binnen MAX_DESCRIPTION past wint.
 */
export function eventMetaDescription(e: EventMetaInput): string {
  const titel = e.titel.trim();
  const { naam, plaats } = e.sauna;
  const datum = formatDateProse(e.startDatum, e.eindDatum);
  const plaatsInNaam = naam.toLowerCase().includes(plaats.toLowerCase());
  const locatie = plaatsInNaam ? naam : `${naam} in ${plaats}`;

  const basis = e.afgelopen
    ? [`${titel} was op ${datum} bij ${locatie}.`, `${titel} was op ${datum} bij ${naam}.`]
    : [`${titel} op ${datum} bij ${locatie}.`, `${titel} op ${datum} bij ${naam}.`];

  const hooks = e.afgelopen
    ? [
        `Dit event is geweest. Bekijk het programma terug en vind de komende opgietingen bij ${naam}.`,
        "Dit event is geweest. Bekijk het programma terug en de komende opgietingen in de agenda.",
        "Dit event is geweest. Bekijk de agenda voor komende opgietingen.",
        `Bekijk de komende opgietingen bij ${naam}.`,
        "Bekijk de komende opgietingen in de agenda.",
      ]
    : [
        "Bekijk het volledige programma met opgietingen, tijden, prijzen en tickets, en plan je saunadag.",
        "Bekijk het programma met opgietingen, tijden, prijzen en tickets.",
        "Programma, opgietingen, tijden en tickets.",
        "Programma en tickets.",
      ];

  for (const b of basis) {
    for (const h of hooks) {
      const s = `${b} ${h}`;
      if (s.length <= MAX_DESCRIPTION) return s;
    }
  }
  // Extreem lange titel: kap de basiszin af op een woordgrens.
  return truncateWords(basis[basis.length - 1], MAX_DESCRIPTION);
}

function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max - 1).trim()}…`;
}
