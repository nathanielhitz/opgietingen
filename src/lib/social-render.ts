import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { Formaat } from "@/lib/social";
import { socialFonts } from "@/lib/social-fonts";

/*
  Gedeelde schil om ImageResponse: formaat uit de query, vaste headers
  (noindex; een dag cache, Vercel leegt de edge-cache bij elke deploy en
  content wijzigt alleen via een deploy) en fonts.
*/

export const SOCIAL_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": "public, max-age=300, s-maxage=86400",
};

export function parseFormaat(params: URLSearchParams): Formaat {
  return params.get("formaat") === "story" ? "story" : "feed";
}

export async function slideResponse(element: ReactElement, size: { width: number; height: number }): Promise<ImageResponse> {
  return new ImageResponse(element, { ...size, fonts: await socialFonts(), headers: SOCIAL_HEADERS });
}

export function nietGevonden(): Response {
  return new Response("Niet gevonden", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}

const aanwezig = new Map<string, Promise<boolean>>();

/**
 * Publieke URL van een beeld onder public/, of undefined als het niet bestaat.
 * Satori faalt hard op een 404-beeld; een HEAD vooraf houdt de slide overeind
 * (dan houtgradient). Beelden gaan via de eigen oorsprong (lokaal én Vercel),
 * niet via fs: public/ zit niet in de functiebundel.
 */
export async function beeldUrlAlsAanwezig(oorsprong: string, pad: string | undefined): Promise<string | undefined> {
  if (!pad) return undefined;
  const url = /^https?:\/\//.test(pad) ? pad : `${oorsprong}${pad}`;
  if (!aanwezig.has(url)) {
    aanwezig.set(
      url,
      fetch(url, { method: "HEAD" })
        .then((r) => r.ok)
        .catch(() => false),
    );
  }
  return (await aanwezig.get(url)!) ? url : undefined;
}
