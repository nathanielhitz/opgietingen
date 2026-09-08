import { monthYearLabel } from "@/lib/dates";
import { utmUrl } from "@/lib/utm";

export interface LinkKnop {
  label: string;
  href: string;
}

/**
 * Knoppen van /links (link-in-bio). `kanaal` is de utm_source, `maandSlug` de
 * huidige maand (bv. "oktober-2026"). Volgorde = wat een volger het vaakst zoekt.
 */
export function linkKnoppen(maandSlug: string, kanaal: string): LinkKnop[] {
  const utm = { source: kanaal, medium: "bio", campaign: "links" };
  const maandLabel = monthYearLabel(maandSlug) ?? "deze maand";
  return [
    { label: "Dit weekend", pad: "/opgietingen/dit-weekend" },
    { label: "Volledige agenda", pad: "/agenda" },
    { label: `Deze maand: ${maandLabel}`, pad: `/agenda/${maandSlug}` },
    { label: "Wat is een opgieting?", pad: "/wat-is-een-opgieting" },
    { label: "Saunagids", pad: "/gids" },
    { label: "Onze saunahoed", pad: "/saunahoed" },
  ].map(({ label, pad }) => ({ label, href: utmUrl(pad, utm) }));
}
