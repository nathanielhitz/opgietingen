import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { monthYearLabel } from "@/lib/dates";
import { aantalTekst, maandEvents } from "@/lib/social";
import { coverBeeld, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide, programmaRegels } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Deze maand", bv. /social/maand/oktober-2026. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ maand: string }> }) {
  const { maand } = await params;
  const label = monthYearLabel(maand);
  if (!label) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = maandEvents(getAllEvents(), maand);
  const beeld = await coverBeeld(request.nextUrl.origin, "/images/social/maand.jpg");
  return slideResponse(
    <CoverSlide formaat={formaat} beeld={beeld} label="Deze maand" kop={aantalTekst(events.length)} sub={label} programma={programmaRegels(events, formaat)} />,
    FORMATEN[formaat],
  );
}
