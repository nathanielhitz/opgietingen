// scripts/lib/social-buffer.ts
import type { PlanningJson, PlanningPost } from "../../src/lib/social-planning";
import { KANALEN, type Kanaal, type Rubriek } from "../../src/lib/social";
import { nlTijdNaarUtc, todayISOInTimeZone } from "../../src/lib/dates";
import type { BufferKanaal, BufferPostInput } from "./buffer-client";

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
 * toekomst (late herstart), dan nu + 15 minuten, afgekapt op de minuut:
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
 * Uitgelicht per plaatsingsdag: de kandidaat met de laagste rang die nog niet
 * eerder is geplaatst. `uitgelicht-<slug>` hangt aan het event, en hetzelfde
 * event staat vaak twee à drie maandagen op rang 1; zonder deze regel valt
 * Uitgelicht vanaf de tweede week weg ("al in Buffer"). Een eerdere plaatsing
 * met een dueAt op dezelfde plaatsingsdag (NL-datum) is een herstart binnen
 * dezelfde week: die kandidaat blijft gekozen. Geeft de gekozen post-id's.
 */
function kiesUitgelicht(posts: PlanningPost[], eerderGeplaatst: (postId: string) => string | undefined): Set<string> {
  const perDag = new Map<string, PlanningPost[]>();
  for (const post of posts) {
    if (post.rubriek !== "uitgelicht") continue;
    perDag.set(post.plaatsingsdag, [...(perDag.get(post.plaatsingsdag) ?? []), post]);
  }
  const gekozen = new Set<string>();
  for (const [dag, kandidaten] of perDag) {
    const keuze = [...kandidaten]
      .sort((a, b) => a.rang - b.rang)
      .find((p) => {
        const dueAt = eerderGeplaatst(p.id);
        return dueAt === undefined || todayISOInTimeZone(new Date(dueAt)) === dag;
      });
    if (keuze) gekozen.add(keuze.id);
  }
  return gekozen;
}

/**
 * Welke posts naar Buffer gaan: rang 1, behalve bij Uitgelicht (de eerste
 * kandidaat die nog niet eerder is geplaatst, zie kiesUitgelicht), en geen
 * post waarvan de plaatsingsdag vóór de run-dag ligt. `vandaag` is de NL-datum
 * van de run, `nu` het moment (voor dueAt), `eerderGeplaatst` geeft de dueAt
 * uit het grootboek als de post op enig kanaal al geplaatst is.
 */
export function kiesPosts(
  planning: Pick<PlanningJson, "posts">,
  vandaag: string,
  nu: Date,
  eerderGeplaatst: (postId: string) => string | undefined,
): { gekozen: Keuze[]; overgeslagen: Overgeslagen[] } {
  const gekozen: Keuze[] = [];
  const overgeslagen: Overgeslagen[] = [];
  const uitgelicht = kiesUitgelicht(planning.posts, eerderGeplaatst);
  for (const post of planning.posts) {
    if (post.rubriek === "uitgelicht" && !uitgelicht.has(post.id)) {
      const dueAt = eerderGeplaatst(post.id);
      const eerder = dueAt !== undefined && todayISOInTimeZone(new Date(dueAt)) !== post.plaatsingsdag;
      overgeslagen.push({ post, reden: eerder ? "eerder al uitgelicht" : `kandidaat ${post.rang}` });
    } else if (post.rubriek !== "uitgelicht" && post.rang !== 1) {
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
  const kort = titel.slice(0, TIKTOK_TITEL_MAX);
  const spatie = kort.lastIndexOf(" ");
  if (spatie > 0) return `${kort.slice(0, spatie).trimEnd()}…`;
  // Geen spatie binnen de limiet: harde knip op codepoints, anders raakt een
  // emoji (die uit meerdere UTF-16-eenheden bestaat) halverwege geknipt.
  return `${Array.from(titel).slice(0, TIKTOK_TITEL_MAX - 1).join("").trimEnd()}…`;
}

/* ---------- Mapping per kanaal (spec §6) ---------- */

/** Instagram-posttype voor een reeks beelden; na de verificatie met een concept eventueel "carousel". */
export const INSTAGRAM_TYPE = "post";

export interface InputOpties {
  /** true = concept in Buffer (saveToDraft, wachtrijmodus, geen dueAt). */
  concept: boolean;
}

/**
 * createPost-input voor één post op één kanaal. Facebook en Instagram krijgen
 * de feed-slides (4:5), TikTok de story-slides (9:16, fotomodus). Caption per
 * kanaal komt uit de planning.
 */
export function bouwInput(post: PlanningPost, kanaal: Kanaal, kanaalId: string, dueAt: string, opties: InputOpties): BufferPostInput {
  const formaat = kanaal === "tiktok" ? "story" : "feed";
  const input: BufferPostInput = {
    channelId: kanaalId,
    text: post.captions[kanaal],
    assets: post.slides.map((s) => ({ image: { url: s[formaat] } })),
    schedulingType: "automatic",
    needsApproval: false,
    ...(opties.concept ? { mode: "addToQueue" as const, saveToDraft: true } : { mode: "customScheduled" as const, dueAt }),
  };
  if (kanaal === "instagram") input.metadata = { instagram: { type: INSTAGRAM_TYPE, shouldShareToFeed: true } };
  if (kanaal === "tiktok") input.metadata = { tiktok: { title: tiktokTitel(post.titel), type: "post" } };
  return input;
}

/* ---------- Kanaalontdekking (spec §9) ---------- */

export type KanaalIds = Partial<Record<Kanaal, string>>;

export interface Ontdekking {
  ids: KanaalIds;
  /** Kanalen zonder Buffer-koppeling; worden overgeslagen met een waarschuwing. */
  ontbrekend: Kanaal[];
}

/**
 * Per social-kanaal precies één Buffer-kanaal: een override wint; anders het
 * enige kanaal met die service; geen kanaal = ontbrekend; meer dan één = fout
 * met de id's, zodat de override gezet kan worden.
 */
export function ontdekKanalen(kanalen: BufferKanaal[], overrides: KanaalIds = {}): Ontdekking {
  const ids: KanaalIds = {};
  const ontbrekend: Kanaal[] = [];
  for (const kanaal of KANALEN) {
    const override = overrides[kanaal];
    if (override) {
      if (kanalen.length > 0 && !kanalen.some((k) => k.id === override)) {
        throw new Error(`BUFFER_KANAAL_${kanaal.toUpperCase()}=${override} komt niet voor onder de Buffer-kanalen`);
      }
      ids[kanaal] = override;
      continue;
    }
    const gevonden = kanalen.filter((k) => k.service.toLowerCase() === kanaal);
    if (gevonden.length === 1) {
      ids[kanaal] = gevonden[0].id;
    } else if (gevonden.length === 0) {
      ontbrekend.push(kanaal);
    } else {
      const lijst = gevonden.map((k) => `${k.name}=${k.id}`).join(", ");
      throw new Error(`Meer dan één ${kanaal}-kanaal in Buffer (${lijst}); zet BUFFER_KANAAL_${kanaal.toUpperCase()} op de juiste id`);
    }
  }
  return { ids, ontbrekend };
}

/** Kanaal-id-overrides uit de omgeving (BUFFER_KANAAL_FACEBOOK enz.); lege waarden tellen niet. */
export function overridesUitEnv(env: Record<string, string | undefined>): KanaalIds {
  const ids: KanaalIds = {};
  for (const kanaal of KANALEN) {
    const waarde = env[`BUFFER_KANAAL_${kanaal.toUpperCase()}`];
    if (waarde) ids[kanaal] = waarde;
  }
  return ids;
}

/* ---------- Versheidscheck (spec §8) ---------- */

/** Komt de deploy die de planning maakte overeen met de commit op de runner? Onbekend als een van beide ontbreekt. */
export function commitKomtOvereen(planningCommit: string | null, runnerCommit: string | undefined): "overeen" | "afwijkend" | "onbekend" {
  if (!planningCommit || !runnerCommit) return "onbekend";
  return planningCommit === runnerCommit ? "overeen" : "afwijkend";
}

/* ---------- Beslisregel per post × kanaal ---------- */

export type Modus = "inplannen" | "concept" | "dry-run";

/**
 * Wat de adapter doet met één post op één kanaal. Een post in het grootboek
 * wordt ook bij een dry-run als "al in Buffer" getoond; alleen concept-modus
 * negeert het grootboek (verificatie, schrijft er ook niet in).
 */
export function besluit(opties: { kanaalId: string | undefined; inGrootboek: boolean; modus: Modus }): "kanaal ontbreekt" | "al in Buffer" | "dry-run" | "maak" {
  if (!opties.kanaalId) return "kanaal ontbreekt";
  if (opties.inGrootboek && opties.modus !== "concept") return "al in Buffer";
  if (opties.modus === "dry-run") return "dry-run";
  return "maak";
}

/* ---------- Samenvatting (spec §4 stap 7) ---------- */

export type ResultaatStatus = "ingepland" | "concept" | "al in Buffer" | "dry-run" | "kanaal ontbreekt" | "mislukt";

export interface Resultaat {
  post: string;
  kanaal: Kanaal;
  /** UTC-ISO. */
  dueAt: string;
  status: ResultaatStatus;
  detail: string;
}

/** "vr 02-10 12:00" in Europe/Amsterdam. */
export function formatNlTijd(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(/,/g, "");
}

/** Markdown-tabel voor de console en $GITHUB_STEP_SUMMARY. */
export function resultaatTabel(regels: Resultaat[]): string {
  const kop = ["| Post | Kanaal | Plaatsing (NL) | Status | Detail |", "|---|---|---|---|---|"];
  const rijen = regels.map(
    (r) =>
      `| ${r.post} | ${r.kanaal} | ${formatNlTijd(r.dueAt)} | ${r.status} | ${r.detail.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ")} |`,
  );
  return [...kop, ...rijen].join("\n");
}
