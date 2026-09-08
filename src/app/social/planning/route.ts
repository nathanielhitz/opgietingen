import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { isGeldigeIsoDatum, todayISO } from "@/lib/dates";
import { bouwPlanning } from "@/lib/social-planning";

/*
  Planning-JSON voor de social-kit (spec §5.3). Geen cache: de standaard-
  datum is "vandaag" en zou anders een dag blijven hangen. noindex via header.
*/
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const datum = request.nextUrl.searchParams.get("datum") ?? todayISO();
  if (!isGeldigeIsoDatum(datum)) {
    return Response.json({ fout: "ongeldige datum, verwacht YYYY-MM-DD" }, { status: 400 });
  }
  const planning = bouwPlanning(getAllEvents(), datum, request.nextUrl.origin);
  return Response.json(planning, {
    headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}
