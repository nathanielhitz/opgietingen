import type { NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/content";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { EventSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Event-slide (spec §4.4). Eigen eventbeeld of saunafoto (event.afbeelding, via de loader), anders logo. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const oorsprong = request.nextUrl.origin;
  const [beeld, logo] = await Promise.all([
    beeldUrlAlsAanwezig(oorsprong, event.afbeelding),
    beeldUrlAlsAanwezig(oorsprong, event.sauna.logo),
  ]);
  return slideResponse(<EventSlide formaat={formaat} event={event} beeld={beeld} logo={logo} />, FORMATEN[formaat]);
}
