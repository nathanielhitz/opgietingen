import fs from "node:fs";
import path from "node:path";
import type { PlanningPost, PlanningSlide } from "../../src/lib/social-planning";
import { KANALEN, type Formaat, type Kanaal } from "../../src/lib/social";

/* Pure helpers van het social-kit-script; het script zelf regelt flags en de planning-fetch. */

/**
 * Bestandsnaam van een slide. Bij een carrousel staan de slides per formaat in
 * een eigen submap (`feed/`, `story/`) en is het formaat in de naam overbodig;
 * bij één slide staan feed en story naast elkaar in de postmap en krijgt de
 * naam het formaat als achtervoegsel (`01-event-<slug>-feed.png`).
 */
export function bestandsnaam(index: number, slide: PlanningSlide, formaat?: Formaat): string {
  const nr = String(index + 1).padStart(2, "0");
  // eventSlug komt uit de planning-JSON van de site; sanitiseren voorkomt dat
  // een `../` daarin ooit buiten `map` terechtkomt via path.join.
  const veiligeSlug = slide.eventSlug?.replace(/[^a-z0-9-]/gi, "");
  const slug = veiligeSlug ? `-${veiligeSlug}` : "";
  return `${nr}-${slide.rol}${slug}${formaat ? `-${formaat}` : ""}.png`;
}

/** Submappen per formaat alleen bij een carrousel; één slide hoeft niet in een map van één bestand. */
export function metSubmappen(post: Pick<PlanningPost, "slides">): boolean {
  return post.slides.length > 1;
}

const KANAAL_LABEL: Record<Kanaal, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

export function captionsMarkdown(post: PlanningPost): string {
  const slides = post.slides.map((s, i) => `- ${String(i + 1).padStart(2, "0")} ${s.rol}${s.eventSlug ? ` (${s.eventSlug})` : ""}`);
  const kanalen = KANALEN.flatMap((k) => [`## ${KANAAL_LABEL[k]}`, "", post.captions[k], ""]);
  return [
    `# ${post.titel}`,
    "",
    `Plaatsingsdag: ${post.plaatsingsdag}`,
    `Rubriek: ${post.rubriek}${post.rang > 1 ? ` (kandidaat ${post.rang})` : ""}`,
    `Periode: ${post.periode.van} t/m ${post.periode.tot}`,
    "",
    "## Slides",
    "",
    ...slides,
    "",
    ...kanalen,
  ].join("\n");
}

export type Ophalen = (url: string) => Promise<Response>;

/** Default fetch mét timeout: een hangende sauna-server mag de hele run niet blokkeren. */
export const ophalenMetTimeout: Ophalen = (url) => fetch(url, { signal: AbortSignal.timeout(20_000) });

/**
 * Downloadt alle slides van één post naar `map` en schrijft captions.md.
 * Een carrousel krijgt per gevraagd formaat een submap (`feed/`, `story/`)
 * zodat alle slides in één keer te selecteren zijn; een post met één slide
 * krijgt de bestanden direct in `map` met het formaat in de naam. Faalt één download, dan wordt de hele map verwijderd:
 * een halve kit is verwarrender dan geen kit.
 *
 * Twee veiligheidschecks vooraf: `map` moet binnen `root` liggen (anders zou
 * een gemanipuleerde post-id uit de planning-JSON buiten de doelmap kunnen
 * schrijven), en een bestaande `map` wordt alleen gewist als hij al een
 * captions.md bevat — bewijs dat hij van een eerdere social-kit-run is.
 * Bestaat de map en ontbreekt dat bewijs, dan stoppen we liever dan iets
 * handmatig neergezets te overschrijven.
 */
export async function downloadPost(
  post: PlanningPost,
  root: string,
  map: string,
  formaten: Formaat[],
  ophalen: Ophalen = ophalenMetTimeout,
): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const resolvedMap = path.resolve(map);
  if (!resolvedMap.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`${map} ligt buiten de doelmap ${root}`);
  }
  if (fs.existsSync(map)) {
    if (!fs.existsSync(path.join(map, "captions.md"))) {
      throw new Error(`${map} bestaat al en lijkt niet van social-kit; verwijder de map handmatig`);
    }
    fs.rmSync(map, { recursive: true, force: true });
  }
  const submappen = metSubmappen(post);
  fs.mkdirSync(map, { recursive: true });
  if (submappen) for (const formaat of formaten) fs.mkdirSync(path.join(map, formaat), { recursive: true });
  try {
    for (const [i, slide] of post.slides.entries()) {
      for (const formaat of formaten) {
        const res = await ophalen(slide[formaat]);
        if (!res.ok) throw new Error(`${slide[formaat]}: HTTP ${res.status}`);
        const doel = submappen ? path.join(map, formaat, bestandsnaam(i, slide)) : path.join(map, bestandsnaam(i, slide, formaat));
        fs.writeFileSync(doel, Buffer.from(await res.arrayBuffer()));
      }
    }
    fs.writeFileSync(path.join(map, "captions.md"), captionsMarkdown(post));
  } catch (err) {
    fs.rmSync(map, { recursive: true, force: true });
    throw err;
  }
}
