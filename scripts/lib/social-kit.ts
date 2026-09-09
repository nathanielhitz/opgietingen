import fs from "node:fs";
import path from "node:path";
import type { PlanningPost, PlanningSlide } from "../../src/lib/social-planning";
import type { Formaat } from "../../src/lib/social";

/* Pure helpers van het social-kit-script; het script zelf regelt flags en de planning-fetch. */

export function bestandsnaam(index: number, slide: PlanningSlide, formaat: Formaat): string {
  const nr = String(index + 1).padStart(2, "0");
  // eventSlug komt uit de planning-JSON van de site; sanitiseren voorkomt dat
  // een `../` daarin ooit buiten `map` terechtkomt via path.join.
  const veiligeSlug = slide.eventSlug?.replace(/[^a-z0-9-]/gi, "");
  const slug = veiligeSlug ? `-${veiligeSlug}` : "";
  return `${nr}-${slide.rol}${slug}-${formaat}.png`;
}

const KANAAL_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" } as const;

export function captionsMarkdown(post: PlanningPost): string {
  const slides = post.slides.map((s, i) => `- ${String(i + 1).padStart(2, "0")} ${s.rol}${s.eventSlug ? ` (${s.eventSlug})` : ""}`);
  const kanalen = (Object.keys(KANAAL_LABEL) as (keyof typeof KANAAL_LABEL)[]).flatMap((k) => [`## ${KANAAL_LABEL[k]}`, "", post.captions[k], ""]);
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
 * Downloadt alle slides van één post in de gevraagde formaten naar `map` en
 * schrijft captions.md. Faalt één download, dan wordt de hele map verwijderd:
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
  fs.mkdirSync(map, { recursive: true });
  try {
    for (const [i, slide] of post.slides.entries()) {
      for (const formaat of formaten) {
        const res = await ophalen(slide[formaat]);
        if (!res.ok) throw new Error(`${slide[formaat]}: HTTP ${res.status}`);
        fs.writeFileSync(path.join(map, bestandsnaam(i, slide, formaat)), Buffer.from(await res.arrayBuffer()));
      }
    }
    fs.writeFileSync(path.join(map, "captions.md"), captionsMarkdown(post));
  } catch (err) {
    fs.rmSync(map, { recursive: true, force: true });
    throw err;
  }
}
