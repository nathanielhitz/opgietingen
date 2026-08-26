/**
 * Pure helpers voor de mobiele agenda-filters: snelkeuze-periodes, de
 * gecombineerde "Waar"-waarde (land + provincie) en leesbare chip-labels.
 * Alles neemt `vandaag` als parameter zodat het deterministisch testbaar is.
 */
import { addDaysISO, parseISO, weekendRange } from "@/lib/dates";
import type { Country } from "@/lib/site";

export type PeriodeKeuze = "alles" | "weekend" | "30dagen" | "dezeMaand" | "volgendeMaand" | "custom";

export const PERIODE_LABELS: Record<PeriodeKeuze, string> = {
  alles: "Alles wat komt",
  weekend: "Dit weekend",
  "30dagen": "Komende 30 dagen",
  dezeMaand: "Deze maand",
  volgendeMaand: "Volgende maand",
  custom: "Kies datums…",
};

/** Volgorde in de select. */
export const PERIODE_KEUZES: PeriodeKeuze[] = ["alles", "weekend", "30dagen", "dezeMaand", "volgendeMaand", "custom"];

const SNELKEUZES = ["weekend", "30dagen", "dezeMaand", "volgendeMaand"] as const;

function laatsteDagVanMaand(jaar: number, maandIndex: number): string {
  // Dag 0 van de volgende maand = laatste dag van deze maand.
  return new Date(Date.UTC(jaar, maandIndex + 1, 0)).toISOString().slice(0, 10);
}

/** Van/tot voor een snelkeuze; null voor "alles" en "custom". */
export function periodeVoorKeuze(keuze: PeriodeKeuze, vandaag: string): { van: string; tot: string } | null {
  const d = parseISO(vandaag);
  const jaar = d.getUTCFullYear();
  const maand = d.getUTCMonth();
  switch (keuze) {
    case "weekend":
      return weekendRange(vandaag);
    case "30dagen":
      return { van: vandaag, tot: addDaysISO(vandaag, 30) };
    case "dezeMaand":
      return { van: vandaag, tot: laatsteDagVanMaand(jaar, maand) };
    case "volgendeMaand": {
      const eerste = new Date(Date.UTC(jaar, maand + 1, 1));
      return {
        van: eerste.toISOString().slice(0, 10),
        tot: laatsteDagVanMaand(eerste.getUTCFullYear(), eerste.getUTCMonth()),
      };
    }
    default:
      return null;
  }
}

/** Welke keuze hoort bij dit van/tot? Leeg = "alles", geen exacte match = "custom". */
export function keuzeVoorPeriode(van: string, tot: string, vandaag: string): PeriodeKeuze {
  if (!van && !tot) return "alles";
  for (const keuze of SNELKEUZES) {
    const p = periodeVoorKeuze(keuze, vandaag);
    if (p && p.van === van && p.tot === tot) return keuze;
  }
  return "custom";
}

/** Gecombineerde select-waarde: "", "NL", "BE", "NL:gelderland". */
export function waarValue(land: string, provincie: string): string {
  if (!land) return "";
  return provincie ? `${land}:${provincie}` : land;
}

export function parseWaar(value: string): { land: Country | ""; provincie: string } {
  const [land, provincie = ""] = value.split(":");
  if (land !== "NL" && land !== "BE") return { land: "", provincie: "" };
  return { land, provincie };
}

const kort = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
const kortMetJaar = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function fmt(iso: string, metJaar: boolean): string {
  return (metJaar ? kortMetJaar : kort).format(parseISO(iso)).replace(/\.$/, "").replace(/\. /, " ");
}

/** Chip-label voor een datumbereik: snelkeuze-naam, anders "1 sep – 15 sep". */
export function labelVoorDatumbereik(van: string, tot: string, vandaag: string): string {
  const keuze = keuzeVoorPeriode(van, tot, vandaag);
  if (keuze !== "custom" && keuze !== "alles") return PERIODE_LABELS[keuze];
  if (van && tot) {
    const anderJaar = van.slice(0, 4) !== tot.slice(0, 4);
    return `${fmt(van, anderJaar)} – ${fmt(tot, anderJaar)}`;
  }
  if (van) return `vanaf ${fmt(van, false)}`;
  return `t/m ${fmt(tot, false)}`;
}
