import type { OpgietEvent } from "@/lib/content";
import { bouwPosts, KANALEN, type Kanaal, type PlanningEvent, type Rubriek } from "@/lib/social";
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
    captions: Object.fromEntries(KANALEN.map((k) => [k, bouwCaption(post, k)])) as Record<Kanaal, string>,
  }));
  return { datum, basis: oorsprong, posts };
}
