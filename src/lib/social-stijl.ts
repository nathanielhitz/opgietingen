import type { Formaat } from "@/lib/social";

/*
  Satori kent geen Tailwind; dit zijn de hexwaarden van de themetokens in
  src/app/globals.css. Wijzigt een token, wijzig het hier mee.
*/
export const KLEUR = {
  cream: "#f7f2ea",
  sand: "#ece1d1",
  ink: "#2b2119",
  inkSoft: "#5f5044",
  wood: "#6d4a2f",
  woodDark: "#3a2718",
  ember: "#c1592a",
  emberSoft: "#e0955f",
} as const;

export const HOUT_GRADIENT = `linear-gradient(135deg, ${KLEUR.woodDark} 0%, ${KLEUR.wood} 100%)`;

export const FORMATEN: Record<Formaat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/** Boven en onder vrijhouden op story-formaat (UI-zones van Instagram/TikTok). */
export const STORY_VEILIG = 250;

export const PROFIEL = { width: 1080, height: 1080 };
export const OMSLAG = { width: 1640, height: 624 };
