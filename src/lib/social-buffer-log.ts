// src/lib/social-buffer-log.ts
import fs from "node:fs";
import path from "node:path";
import { KANALEN, type Kanaal } from "@/lib/social";

/*
  Grootboek van de Buffer-adapter (data/social-buffer.json): welke planning-post
  op welk kanaal al in Buffer staat. Dit is de enige plek die het bestand kent,
  zodat /beheer het later kan tonen zonder de adapter te raken. Spec:
  docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md §7.
*/

export interface GrootboekRegel {
  /** Post-id uit de planning, bv. weekend-2026-W40. */
  post: string;
  kanaal: Kanaal;
  /** Id van de post in Buffer. */
  bufferId: string;
  /** Ingepland tijdstip, UTC-ISO. */
  dueAt: string;
  /** Moment van de createPost-aanroep, UTC-ISO. */
  aangemaakt: string;
  /** GITHUB_RUN_ID of "lokaal". */
  run: string;
  /** Publieke URL van de slideshow-video (Vercel Blob), alleen bij een videopost. */
  video?: string;
}

export interface Grootboek {
  posts: GrootboekRegel[];
}

export const SOCIAL_BUFFER_LOG_PATH = path.join(process.cwd(), "data", "social-buffer.json");

const KANALEN_SET: ReadonlySet<string> = new Set<string>(KANALEN);

function isRegel(x: unknown): x is GrootboekRegel {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.post === "string" &&
    r.post.length > 0 &&
    typeof r.kanaal === "string" &&
    KANALEN_SET.has(r.kanaal) &&
    typeof r.bufferId === "string" &&
    r.bufferId.length > 0 &&
    typeof r.dueAt === "string" &&
    typeof r.aangemaakt === "string" &&
    typeof r.run === "string" &&
    (r.video === undefined || typeof r.video === "string")
  );
}

/**
 * Leest het grootboek. Ontbrekend bestand = leeg grootboek. Onleesbaar of
 * ongeldig = fout: doorgaan zou elke post opnieuw aanmaken, en overschrijven
 * zou de historie wissen. Herstel met `git checkout data/social-buffer.json`.
 */
export function leesGrootboek(bestand: string = SOCIAL_BUFFER_LOG_PATH): Grootboek {
  if (!fs.existsSync(bestand)) return { posts: [] };
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(bestand, "utf8"));
  } catch {
    throw new Error(`${bestand}: onleesbare JSON (herstel met git checkout data/social-buffer.json)`);
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { posts?: unknown }).posts)) {
    throw new Error(`${bestand}: geen posts-lijst`);
  }
  const posts = (data as { posts: unknown[] }).posts;
  const ongeldig = posts.findIndex((r) => !isRegel(r));
  if (ongeldig !== -1) throw new Error(`${bestand}: regel ${ongeldig} is ongeldig`);
  return { posts: posts as GrootboekRegel[] };
}

export function schrijfGrootboek(grootboek: Grootboek, bestand: string = SOCIAL_BUFFER_LOG_PATH): void {
  fs.mkdirSync(path.dirname(bestand), { recursive: true });
  // Atomair: eerst naar een tijdelijk bestand, dan hernoemen, zodat een crash
  // halverwege nooit een half grootboek achterlaat.
  const tijdelijk = bestand + ".tmp";
  fs.writeFileSync(tijdelijk, JSON.stringify(grootboek, null, 2) + "\n");
  fs.renameSync(tijdelijk, bestand);
}

/** De regel voor een post-id op een kanaal, of undefined. */
export function zoekRegel(grootboek: Grootboek, post: string, kanaal: Kanaal): GrootboekRegel | undefined {
  return grootboek.posts.find((r) => r.post === post && r.kanaal === kanaal);
}

/** De eerste regel voor een post-id, op welk kanaal ook, of undefined (voor de keuze van Uitgelicht). */
export function eersteRegelVoorPost(grootboek: Grootboek, post: string): GrootboekRegel | undefined {
  return grootboek.posts.find((r) => r.post === post);
}

/** Nieuw grootboek met de regel erbij (geen mutatie); een bestaande combinatie blijft staan. */
export function voegRegelToe(grootboek: Grootboek, regel: GrootboekRegel): Grootboek {
  if (zoekRegel(grootboek, regel.post, regel.kanaal)) return grootboek;
  return { posts: [...grootboek.posts, regel] };
}
