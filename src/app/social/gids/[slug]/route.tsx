import type { NextRequest } from "next/server";
import { getGidsBySlug } from "@/lib/content";
import { naarPlanningGids } from "@/lib/social-gids";
import { gidsBeeld, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { GidsCoverSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover van de rubriek Saunagids: titel + samenvatting op het beeld van de gids (terugval: sfeerbeeld). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gids = getGidsBySlug(slug);
  if (!gids) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const beeld = await gidsBeeld(request.nextUrl.origin, gids.afbeelding);
  return slideResponse(<GidsCoverSlide formaat={formaat} beeld={beeld} gids={naarPlanningGids(gids)} />, FORMATEN[formaat]);
}
