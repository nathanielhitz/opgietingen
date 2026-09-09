import fs from "node:fs";
import path from "node:path";
import type { PlanningPost, PlanningSlide } from "../../src/lib/social-planning";
import type { Formaat } from "../../src/lib/social";

/* Pure helpers van het social-kit-script; het script zelf regelt flags en de planning-fetch. */

export function bestandsnaam(index: number, slide: PlanningSlide, formaat: Formaat): string {
  const nr = String(index + 1).padStart(2, "0");
  const slug = slide.eventSlug ? `-${slide.eventSlug}` : "";
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

/**
 * Downloadt alle slides van één post in de gevraagde formaten naar `map` en
 * schrijft captions.md. Faalt één download, dan wordt de hele map verwijderd:
 * een halve kit is verwarrender dan geen kit.
 */
export async function downloadPost(post: PlanningPost, map: string, formaten: Formaat[], ophalen: Ophalen = fetch): Promise<void> {
  fs.rmSync(map, { recursive: true, force: true });
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
