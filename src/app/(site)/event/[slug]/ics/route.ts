import { getAllEvents, getEventBySlug } from "@/lib/content";
import { buildCalendar } from "@/lib/ics";

/*
  "Zet in je agenda": .ics-download voor één event. Een agenda-reminder brengt
  de bezoeker op de eventdatum terug naar de sauna (retentie, audit §retentie).
*/

export function generateStaticParams() {
  return getAllEvents().map((e) => ({ slug: e.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return new Response("Niet gevonden", { status: 404 });

  return new Response(buildCalendar([event], event.titel), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
