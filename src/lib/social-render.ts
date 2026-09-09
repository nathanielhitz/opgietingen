import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { Formaat } from "@/lib/social";
import { socialFonts } from "@/lib/social-fonts";

/*
  Gedeelde schil om ImageResponse: formaat uit de query, vaste headers
  (noindex; een dag cache, Vercel leegt de edge-cache bij elke deploy en
  content wijzigt alleen via een deploy) en fonts.

  De headersleutels zijn bewust lowercase: @vercel/og zet zelf een
  cache-control (een jaar immutable) en een sleutel met hoofdletters komt
  daar als tweede header naast in plaats van hem te vervangen.
*/

export const SOCIAL_HEADERS = {
  "x-robots-tag": "noindex",
  "cache-control": "public, max-age=300, s-maxage=86400",
};

export function parseFormaat(params: URLSearchParams): Formaat {
  return params.get("formaat") === "story" ? "story" : "feed";
}

export async function slideResponse(element: ReactElement, size: { width: number; height: number }): Promise<Response> {
  try {
    return new ImageResponse(element, { ...size, fonts: await socialFonts(), headers: SOCIAL_HEADERS });
  } catch (err) {
    console.error("social-render:", err);
    return new Response("Renderfout", { status: 500, headers: { "x-robots-tag": "noindex" } });
  }
}

export function nietGevonden(): Response {
  return new Response("Niet gevonden", { status: 404, headers: { "x-robots-tag": "noindex" } });
}

/** Beeldformaten die satori kan decoderen; een ander type (bv. webp) breekt de render. */
const SATORI_TYPES = new Set(["image/png", "image/apng", "image/jpeg", "image/gif", "image/svg+xml"]);

const aanwezig = new Map<string, Promise<boolean>>();

/**
 * Publieke URL van een beeld onder public/, of undefined als het niet bestaat
 * of in een formaat staat dat satori niet aankan. Satori faalt hard op een
 * 404-beeld; een HEAD vooraf houdt de slide overeind (dan houtgradient).
 * Beelden gaan via de eigen oorsprong (lokaal én Vercel), niet via fs:
 * public/ zit niet in de functiebundel.
 */
export async function beeldUrlAlsAanwezig(oorsprong: string, pad: string | undefined): Promise<string | undefined> {
  if (!pad) return undefined;
  const url = /^https?:\/\//.test(pad) ? pad : `${oorsprong}${pad}`;
  if (!aanwezig.has(url)) {
    const check = fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) })
      .then((r) => {
        const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        return r.ok && SATORI_TYPES.has(type);
      })
      .catch(() => {
        // Netwerkfout is geen bewijs dat het beeld ontbreekt: entry weg, volgende request probeert opnieuw.
        if (aanwezig.get(url) === check) aanwezig.delete(url);
        return false;
      });
    aanwezig.set(url, check);
  }
  return (await aanwezig.get(url)!) ? url : undefined;
}
