import type { NextRequest } from "next/server";
import { getGidsBySlug } from "@/lib/content";
import { naarPlanningGids } from "@/lib/social-gids";
import { gidsBeeld, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { GidsPuntSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Punt-slide van de rubriek Saunagids: /social/gids/<slug>/<nr>, nr 1-based in de volgorde van gidsPunten. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; nr: string }> }) {
  const { slug, nr } = await params;
  const gids = getGidsBySlug(slug);
  if (!gids || !/^\d+$/.test(nr)) return nietGevonden();
  const { punten } = naarPlanningGids(gids);
  const nummer = Number(nr);
  const punt = punten[nummer - 1];
  if (!punt) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const beeld = await gidsBeeld(request.nextUrl.origin, gids.afbeelding);
  return slideResponse(<GidsPuntSlide formaat={formaat} beeld={beeld} punt={punt} nummer={nummer} totaal={punten.length} />, FORMATEN[formaat]);
}
