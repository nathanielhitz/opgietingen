/**
 * iCalendar-generatie (RFC 5545) voor events: de losse .ics-download per event
 * ("Zet in je agenda") en de abonneerbare agenda-feed (/agenda.ics).
 *
 * Events zijn hele-dag-items (VALUE=DATE): `tijden` is vrije tekst
 * ("19:00–23:00", "hele dag extra opgietingen") en hoort daarom in de
 * omschrijving, niet in DTSTART. DTSTAMP is bewust afgeleid van de startdatum
 * (geen `new Date()`), zodat de output deterministisch is en cachebaar blijft.
 */
import type { OpgietEvent } from "@/lib/content";
import { addDaysISO } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { absoluteUrl } from "@/lib/schema";

/** Escapet tekstwaarden volgens RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-09-12" -> "20260912" */
function dateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

/**
 * Vouwt lange regels (RFC 5545 §3.1: max 75 octetten per regel; vervolgregels
 * beginnen met een spatie). Telt octetten, niet tekens: diakrieten zijn in
 * UTF-8 twee bytes en zouden een tekengrens anders kunnen overschrijden.
 */
const encoder = new TextEncoder();

function fold(line: string): string {
  const parts: string[] = [];
  let huidige = "";
  let octets = 0;
  for (const teken of line) {
    const bytes = encoder.encode(teken).length;
    // 74 i.p.v. 75: vervolgregels beginnen met een spatie (1 octet).
    if (octets + bytes > 74) {
      parts.push(huidige);
      huidige = teken;
      octets = bytes;
    } else {
      huidige += teken;
      octets += bytes;
    }
  }
  parts.push(huidige);
  return parts.join("\r\n ");
}

function eventLines(event: OpgietEvent): string[] {
  const eind = event.eindDatum ?? event.startDatum;
  const url = absoluteUrl(`/event/${event.slug}`);
  const beschrijving = [
    event.tijden ? `Tijden: ${event.tijden}` : "",
    event.prijsIndicatie ? `Prijs: ${event.prijsIndicatie}` : "",
    plainSummary(event.body, 400),
    `Meer info: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${event.slug}@opgietingen.nl`,
    `DTSTAMP:${dateValue(event.startDatum)}T000000Z`,
    `DTSTART;VALUE=DATE:${dateValue(event.startDatum)}`,
    // DTEND is exclusief bij hele-dag-events: de dag ná de laatste eventdag.
    `DTEND;VALUE=DATE:${dateValue(addDaysISO(eind, 1))}`,
    `SUMMARY:${escapeText(`${event.titel} · ${event.sauna.naam}`)}`,
    `DESCRIPTION:${escapeText(beschrijving)}`,
    `LOCATION:${escapeText(`${event.sauna.naam}, ${event.sauna.adres}, ${event.sauna.plaats}`)}`,
    `URL:${url}`,
    "END:VEVENT",
  ];
}

/** Bouwt een complete VCALENDAR voor één of meer events. */
export function buildCalendar(events: OpgietEvent[], naam: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Opgietingen.nl//Agenda//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(naam)}`,
    "X-WR-TIMEZONE:Europe/Amsterdam",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
