// scripts/lib/social-buffer.ts
import type { PlanningJson, PlanningPost } from "../../src/lib/social-planning";
import type { Rubriek } from "../../src/lib/social";
import { nlTijdNaarUtc } from "../../src/lib/dates";

/*
  Pure functies van de Buffer-adapter (spec §5, §6, §8, §9): welke posts,
  op welk tijdstip, met welke createPost-input per kanaal. Geen I/O; het
  script scripts/social-buffer.ts is de schil eromheen.
*/

/** Vaste plaatsingstijden per rubriek, Europe/Amsterdam (spec §5). */
export const PLAATSINGSTIJD: Record<Rubriek, string> = {
  nieuw: "17:00",
  uitgelicht: "19:00",
  weekend: "12:00",
  maand: "10:00",
};

/** Hoeveel later dan "nu" een al verstreken tijdstip wordt gezet. */
export const UITSTEL_MS = 15 * 60_000;

/** TikTok-limiet voor de titel van een fotopost. */
export const TIKTOK_TITEL_MAX = 90;

export interface Keuze {
  post: PlanningPost;
  /** UTC-ISO. */
  dueAt: string;
}

export interface Overgeslagen {
  post: PlanningPost;
  reden: string;
}

/**
 * Plaatsingsdag + rubriektijd (NL) als UTC. Is dat tijdstip niet meer in de
 * toekomst (late herstart), dan nu + 15 minuten, afgerond op de minuut:
 * Buffer wil een toekomstig tijdstip.
 */
export function dueAtVoor(post: Pick<PlanningPost, "rubriek" | "plaatsingsdag">, nu: Date): string {
  const gepland = nlTijdNaarUtc(post.plaatsingsdag, PLAATSINGSTIJD[post.rubriek]);
  if (new Date(gepland).getTime() > nu.getTime()) return gepland;
  const uitgesteld = new Date(nu.getTime() + UITSTEL_MS);
  uitgesteld.setUTCSeconds(0, 0);
  return uitgesteld.toISOString();
}

/**
 * Welke posts naar Buffer gaan: alleen rang 1 (van Uitgelicht de hoogste
 * prioriteit), en geen post waarvan de plaatsingsdag vóór de run-dag ligt.
 * `vandaag` is de NL-datum van de run, `nu` het moment (voor dueAt).
 */
export function kiesPosts(planning: Pick<PlanningJson, "posts">, vandaag: string, nu: Date): { gekozen: Keuze[]; overgeslagen: Overgeslagen[] } {
  const gekozen: Keuze[] = [];
  const overgeslagen: Overgeslagen[] = [];
  for (const post of planning.posts) {
    if (post.rang !== 1) {
      overgeslagen.push({ post, reden: `kandidaat ${post.rang}` });
    } else if (post.plaatsingsdag < vandaag) {
      overgeslagen.push({ post, reden: "plaatsingsdag verstreken" });
    } else {
      gekozen.push({ post, dueAt: dueAtVoor(post, nu) });
    }
  }
  return { gekozen, overgeslagen };
}

/** Titel van een TikTok-fotopost: maximaal 90 tekens, afgekapt op een woordgrens met "…". */
export function tiktokTitel(titel: string): string {
  if (titel.length <= TIKTOK_TITEL_MAX) return titel;
  const kort = titel.slice(0, TIKTOK_TITEL_MAX - 1);
  const spatie = kort.lastIndexOf(" ");
  return `${(spatie > 0 ? kort.slice(0, spatie) : kort).trimEnd()}…`;
}
