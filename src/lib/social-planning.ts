import type { OpgietEvent } from "@/lib/content";
import { isGeldigeIsoDatum } from "@/lib/dates";
import { site } from "@/lib/site";
import { bouwPosts, type Kanaal, type PlanningEvent, type Rubriek } from "@/lib/social";
import { bouwCaption } from "@/lib/social-captions";

/*
  Het contract dat /social/planning serveert (spec §5.3). Consumenten: het
  script social-kit (nu) en de Buffer-adapter (later). Wijzig velden hier
  alleen achterwaarts compatibel.
*/

export interface PlanningSlide {
  rol: "cover" | "event" | "afsluiter";
  eventSlug?: string;
  feed: string;
  story: string;
}

export interface PlanningPost {
  id: string;
  rubriek: Rubriek;
  rang: number;
  titel: string;
  plaatsingsdag: string;
  periode: { van: string; tot: string };
  events: PlanningEvent[];
  slides: PlanningSlide[];
  captions: Record<Kanaal, string>;
}

export interface PlanningJson {
  datum: string;
  /** Oorsprong waarop de slide-URL's zijn gebouwd. */
  basis: string;
  posts: PlanningPost[];
}

export function bouwPlanning(events: OpgietEvent[], datum: string, basis: string): PlanningJson {
  const oorsprong = basis.replace(/\/$/, "");
  const posts = bouwPosts(events, datum).map((post) => ({
    id: post.id,
    rubriek: post.rubriek,
    rang: post.rang,
    titel: post.titel,
    plaatsingsdag: post.plaatsingsdag,
    periode: post.periode,
    events: post.events,
    slides: post.slides.map((s) => ({
      rol: s.rol,
      ...(s.eventSlug ? { eventSlug: s.eventSlug } : {}),
      feed: `${oorsprong}${s.pad}?formaat=feed`,
      story: `${oorsprong}${s.pad}?formaat=story`,
    })),
    captions: {
      instagram: bouwCaption(post, "instagram"),
      facebook: bouwCaption(post, "facebook"),
      tiktok: bouwCaption(post, "tiktok"),
    },
  }));
  return { datum, basis: oorsprong, posts };
}

export interface PlanningAntwoord {
  status: 200 | 400;
  body: PlanningJson | { fout: string };
  headers: Record<string, string>;
}

/**
 * Routegedrag van /social/planning als pure functie. `basis`: in productie
 * altijd `site.url` (captions gebruiken die ook; een preview- of interne
 * host mag nooit in het contract lekken), anders de oorsprong van het request
 * zodat lokaal en op previews de beelden van diezelfde host komen.
 */
export function planningAntwoord(opties: {
  datumParam: string | null;
  origin: string;
  events: OpgietEvent[];
  vandaag: string;
  vercelEnv?: string;
}): PlanningAntwoord {
  const datum = opties.datumParam ?? opties.vandaag;
  const headers = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
  if (!isGeldigeIsoDatum(datum)) {
    return { status: 400, body: { fout: `Ongeldige datum "${datum}", verwacht YYYY-MM-DD` }, headers };
  }
  const basis = opties.vercelEnv === "production" ? site.url : opties.origin;
  return { status: 200, body: bouwPlanning(opties.events, datum, basis), headers };
}
