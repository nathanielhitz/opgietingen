import type { NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/content";
import { beeldUrlAlsAanwezig, coverBeeld, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { EventSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/** Generiek sfeerbeeld voor event-slides zonder eigen foto; ontbreekt het, dan neemt coverBeeld de homepage-hero. */
const EVENT_SFEERBEELD = "/images/social/event.jpg";

/* Event-slide (spec §4.4). Eigen eventbeeld of saunafoto (event.afbeelding, via de loader), anders het generieke sfeerbeeld met logo. */
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
  // Zonder eigen beeld dezelfde terugval als de covers: rubriekbeeld → homepage-hero → houtgradient.
  const sfeerbeeld = beeld ? undefined : await coverBeeld(oorsprong, EVENT_SFEERBEELD);
  return slideResponse(<EventSlide formaat={formaat} event={event} beeld={beeld} sfeerbeeld={sfeerbeeld} logo={logo} />, FORMATEN[formaat]);
}
