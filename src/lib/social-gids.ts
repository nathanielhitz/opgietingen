import type { Gids } from "@/lib/content";
import { normalizeProseDashes } from "@/lib/text";
import { afkap } from "@/lib/social-slides";

/*
  Rubriek "Saunagids" van de social-kit: elke week één gidsartikel als
  evergreen post (cover + een paar kernpunten + afsluiter). Pure functies:
  welke gids deze week aan de beurt is en welke punten uit de MDX-body op
  de slides komen. Geen I/O; de loader levert de gidsen, de routes renderen.
*/

export interface GidsPunt {
  /** Korte kop op de slide, bv. "Kom op tijd". */
  kop: string;
  /** Eén of twee zinnen toelichting, maximaal MAX_PUNT_TEKST tekens. */
  tekst: string;
}

/** Platte gids-weergave voor planning-JSON, captions en slides (geen body, geen producten). */
export interface PlanningGids {
  slug: string;
  titel: string;
  samenvatting: string;
  punten: GidsPunt[];
}

/** Cover + 6 punten + afsluiter = 8 slides (28 s video); meer is op TikTok niet uit te kijken. */
export const MAX_PUNTEN = 6;
/** Leesbaar in 3,5 s op een slide. */
export const MAX_PUNT_TEKST = 160;

/** Markdown/MDX naar platte tekst: tags, links, vet/cursief en code weg; witruimte samengevouwen. */
export function schoneTekst(md: string): string {
  return normalizeProseDashes(
    md
      .replace(/<[^>]+>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__|`/g, "")
      .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** De eerste zinnen die samen binnen `max` passen; past de eerste zin al niet, dan afgekapt. */
export function eersteZinnen(tekst: string, max: number = MAX_PUNT_TEKST): string {
  const zinnen = tekst.split(/(?<=[.!?])\s+/).filter(Boolean);
  let uit = "";
  for (const zin of zinnen) {
    const kandidaat = uit ? `${uit} ${zin}` : zin;
    if (kandidaat.length > max) break;
    uit = kandidaat;
  }
  return uit || afkap(tekst, max);
}

interface Blok {
  soort: "kop" | "tekst";
  inhoud: string;
}

/**
 * Body in blokken: een kop (`## …`) of een tekstblok. Een nieuw tekstblok
 * begint bij een lege regel, een lijstmarkering (`-`, `*`, `1.`) of een
 * JSX-tag; ingesprongen vervolgregels van een lijstitem horen bij dat item.
 */
function blokken(body: string): Blok[] {
  const uit: Blok[] = [];
  let huidig: string[] = [];
  const sluit = () => {
    if (huidig.length > 0) uit.push({ soort: "tekst", inhoud: huidig.join(" ") });
    huidig = [];
  };
  for (const regel of body.split(/\r?\n/)) {
    const r = regel.trim();
    if (r === "") {
      sluit();
      continue;
    }
    const kop = r.match(/^##+\s+(.+?)\s*#*$/);
    if (kop) {
      sluit();
      uit.push({ soort: "kop", inhoud: kop[1] });
      continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(r) || /^<[^>]+>$/.test(r)) sluit();
    huidig.push(r);
  }
  sluit();
  return uit;
}

/**
 * "**1. Kom op tijd.** Bij vrijwel elke sauna…" of "- **Materiaal:** wolvilt…"
 * → kop + toelichting. Eindigt de aanzet op een dubbele punt, dan begint de
 * toelichting met een hoofdletter; zonder leesteken ("**Badstof** is dik…")
 * loopt de zin door en komt de aanzet weer vooraan in de toelichting.
 */
function vetteAanzet(inhoud: string): { kop: string; tekst: string } | undefined {
  const m = inhoud.match(/^(?:[-*]|\d+\.)?\s*\*\*(.+?)\*\*\s*(.*)$/s);
  if (!m) return undefined;
  const aanzet = m[1].replace(/^\d+\.\s*/, "").trim();
  const kop = aanzet.replace(/[.:]\s*$/, "").trim();
  const rest = m[2].trim();
  if (!kop) return undefined;
  // Alleen een leesteken na de aanzet ("**Epilepsie…** ."): geen toelichting, maakPunt laat het punt vallen.
  if (!/\p{L}/u.test(rest)) return { kop, tekst: "" };
  if (aanzet.endsWith(":")) return { kop, tekst: rest.charAt(0).toUpperCase() + rest.slice(1) };
  if (aanzet.endsWith(".")) return { kop, tekst: rest };
  return { kop, tekst: `${aanzet} ${rest}` };
}

function maakPunt(kop: string, toelichting: string): GidsPunt | undefined {
  const schoonKop = schoneTekst(kop);
  const schoonTekst = schoneTekst(toelichting);
  // Zonder toelichting met letters erin ("**Epilepsie…** .") is er niets te vertellen.
  if (!schoonKop || !/\p{L}/u.test(schoonTekst)) return undefined;
  const tekst = eersteZinnen(schoonTekst);
  // Een lijstfragment zonder zinseinde ("…of een wisselende bloeddruk;") is geen punt.
  if (!/[.!?…]$/.test(tekst)) return undefined;
  return { kop: afkap(schoonKop, 60), tekst };
}

/**
 * Kernpunten van een gids voor de slides. Per sectie (`## …`): staan er
 * alinea's of lijstitems met een vette aanzet ("**Kom op tijd.** …"), dan
 * is elke aanzet een punt; anders de sectiekop met de eerste alinea. De
 * inleiding vóór de eerste kop telt alleen met vette aanzetten mee. Secties
 * zonder lopende tekst (bv. alleen een `<ProductGrid />`) vallen weg.
 * Maximaal MAX_PUNTEN, in leesvolgorde.
 */
export function gidsPunten(body: string, max: number = MAX_PUNTEN): GidsPunt[] {
  const punten: GidsPunt[] = [];
  let sectieKop: string | undefined;
  let sectieTekst: string | undefined;
  let sectieHeeftAanzet = false;

  const sluitSectie = () => {
    if (sectieKop && !sectieHeeftAanzet && sectieTekst) {
      const punt = maakPunt(sectieKop, sectieTekst);
      if (punt) punten.push(punt);
    }
    sectieKop = undefined;
    sectieTekst = undefined;
    sectieHeeftAanzet = false;
  };

  for (const blok of blokken(body)) {
    if (blok.soort === "kop") {
      sluitSectie();
      sectieKop = blok.inhoud;
      continue;
    }
    const aanzet = vetteAanzet(blok.inhoud);
    if (aanzet) {
      sectieHeeftAanzet = true;
      const punt = maakPunt(aanzet.kop, aanzet.tekst);
      if (punt) punten.push(punt);
    } else if (sectieTekst === undefined && schoneTekst(blok.inhoud)) {
      sectieTekst = blok.inhoud;
    }
  }
  sluitSectie();
  return punten.slice(0, max);
}

export function naarPlanningGids(gids: Gids): PlanningGids {
  return {
    slug: gids.slug,
    titel: normalizeProseDashes(gids.titel),
    samenvatting: normalizeProseDashes(gids.samenvatting.replace(/\s+/g, " ").trim()),
    punten: gidsPunten(gids.body),
  };
}

/**
 * De gids van een ISO-week: alle gidsen op slug (stabiel, los van titelwijzigingen)
 * en het weeknummer als draaischijf, zodat elke gids om de `n` weken terugkomt.
 * Evergreen content mag herhalen; na tien weken kijkt vrijwel niemand nog terug.
 */
export function kiesGids(gidsen: Gids[], weekNummer: number): Gids | undefined {
  if (gidsen.length === 0) return undefined;
  const gesorteerd = [...gidsen].sort((a, b) => a.slug.localeCompare(b.slug));
  return gesorteerd[((weekNummer % gesorteerd.length) + gesorteerd.length) % gesorteerd.length];
}
