import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { isGeldigeIsoDatum } from "@/lib/dates";
import { aantalTekst, nieuweEvents } from "@/lib/social";
import { coverBeeld, nietGevonden, parseFormaat, slideResponse } from "@/lib/social-render";
import { CoverSlide, programmaRegels } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

/* Cover "Nieuw in de agenda": events gepubliceerd in de zeven dagen t/m `datum`. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ datum: string }> }) {
  const { datum } = await params;
  if (!isGeldigeIsoDatum(datum)) return nietGevonden();
  const formaat = parseFormaat(request.nextUrl.searchParams);
  const events = nieuweEvents(getAllEvents(), datum);
  const beeld = await coverBeeld(request.nextUrl.origin, "/images/social/nieuw.jpg");
  return slideResponse(
    <CoverSlide
      formaat={formaat}
      beeld={beeld}
      label="Nieuw in de agenda"
      kop={aantalTekst(events.length)}
      sub="Deze week toegevoegd"
      programma={programmaRegels(events, formaat)}
    />,
    FORMATEN[formaat],
  );
}
