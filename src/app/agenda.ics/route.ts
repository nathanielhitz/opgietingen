import { getAllEvents } from "@/lib/content";
import { isUpcoming, todayISO } from "@/lib/dates";
import { buildCalendar } from "@/lib/ics";

/*
  Abonneerbare agenda-feed (webcal): alle komende opgietingen in één
  iCalendar. Kalender-apps verversen het abonnement zelf periodiek; ISR van
  een uur houdt de inhoud vers zonder per-request te renderen.
*/

export const revalidate = 3600;

export function GET() {
  const vandaag = todayISO();
  const events = getAllEvents().filter((e) => isUpcoming(e, vandaag));

  return new Response(buildCalendar(events, "Opgietingen in Nederland & België"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="opgietingen-agenda.ics"',
    },
  });
}
