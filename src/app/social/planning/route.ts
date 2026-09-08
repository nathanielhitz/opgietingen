import type { NextRequest } from "next/server";
import { getAllEvents } from "@/lib/content";
import { todayISO } from "@/lib/dates";
import { planningAntwoord } from "@/lib/social-planning";

/*
  Planning-JSON voor de social-kit (spec §5.3). Geen cache: de standaard-
  datum is "vandaag" en zou anders een dag blijven hangen. noindex via header.
  Het routegedrag zelf zit in planningAntwoord (pure functie, apart getest);
  deze handler is alleen de Next-schil eromheen.
*/
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const antwoord = planningAntwoord({
    datumParam: request.nextUrl.searchParams.get("datum"),
    origin: request.nextUrl.origin,
    events: getAllEvents(),
    vandaag: todayISO(),
    vercelEnv: process.env.VERCEL_ENV,
  });
  return Response.json(antwoord.body, { status: antwoord.status, headers: antwoord.headers });
}
