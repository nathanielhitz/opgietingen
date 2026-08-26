import { formatDate } from "./dates";

/**
 * Meta description voor saunapagina's. Brand-zoekers ("zwaluwhoeve") landen
 * hier; de snippet moet meteen zeggen wat de agenda voor deze sauna in huis
 * heeft: aantal komende opgietingen + eerstvolgende datum, of anders de
 * vaste opgiettijden / de provincie-agenda als vangnet.
 */

export const MAX_DESCRIPTION = 155;

export interface SaunaMetaInput {
  naam: string;
  plaats: string;
  provincie: string;
  /** Komende events, gesorteerd op startDatum oplopend. */
  komende: { startDatum: string }[];
  heeftRooster: boolean;
}

export function saunaMetaDescription(s: SaunaMetaInput): string {
  const n = s.komende.length;
  const eerste = s.komende[0]?.startDatum;
  const plaatsInNaam = s.naam.toLowerCase().includes(s.plaats.toLowerCase());
  const kop = plaatsInNaam ? s.naam : `${s.naam} in ${s.plaats}`;

  const kandidaten: string[] = [];
  if (n > 0 && eerste) {
    const telling = n === 1 ? "1 komende opgieting" : `${n} komende opgietingen`;
    const eerstvolgende = `eerstvolgende op ${formatDate(eerste)}`;
    const staart = s.heeftRooster ? "Vaste opgiettijden, programma en tickets." : "Programma, tijden en tickets.";
    kandidaten.push(
      `${kop}: ${telling}, ${eerstvolgende}. ${staart} Bekijk de agenda.`,
      `${kop}: ${telling}, ${eerstvolgende}. ${staart}`,
      `${kop}: ${telling}, ${eerstvolgende}. Bekijk de agenda.`,
    );
  } else if (s.heeftRooster) {
    kandidaten.push(
      `${kop}: vaste opgiettijden per dag, Aufguss-programma en praktische info. Plus alle komende opgietingen in ${s.provincie}.`,
      `${kop}: vaste opgiettijden per dag en Aufguss-programma. Plus komende opgietingen in ${s.provincie}.`,
      `${kop}: vaste opgiettijden en Aufguss-programma. Bekijk de agenda.`,
    );
  } else {
    kandidaten.push(
      `${kop}: opgietingen, Aufguss en praktische info. Nog geen events gepland; bekijk komende opgietingen in ${s.provincie}.`,
      `${kop}: opgietingen en Aufguss. Bekijk komende opgietingen in ${s.provincie}.`,
      `${kop}: opgietingen en Aufguss. Bekijk de agenda.`,
    );
  }
  return kandidaten.find((k) => k.length <= MAX_DESCRIPTION) ?? kandidaten[kandidaten.length - 1];
}
