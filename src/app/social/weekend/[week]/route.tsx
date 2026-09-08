import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { formatDagKort, weekendVanIsoWeek } from "@/lib/dates";
import { aantalTekst, weekendEvents } from "@/lib/social";
import { beeldUrlAlsAanwezig, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Dit weekend" per ISO-week, bv. /social/weekend/2026-W37. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const weekend = weekendVanIsoWeek(week);
  if (!weekend) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = weekendEvents(getAllEvents(), week);
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/social/weekend.jpg");
  return slideResponse(
    <CoverSlide
      formaat={formaat}
      beeld={beeld}
      label="Dit weekend"
      kop={aantalTekst(events.length)}
      sub={`${formatDagKort(weekend.van)} t/m ${formatDagKort(weekend.tot)}`}
    />,
    FORMATEN[formaat],
  );
}
