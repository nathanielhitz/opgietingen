/**
 * Datum-helpers. Alle event-datums zijn ISO-strings (YYYY-MM-DD) in frontmatter.
 * Formatteren gebeurt in het Nederlands via Intl.
 */

export const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

/** Parseert een ISO-datum (YYYY-MM-DD) naar een Date in UTC (voorkomt tijdzone-drift). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** "14 november 2026" (of korter met opts). */
export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  return new Intl.DateTimeFormat("nl-NL", { ...opts, timeZone: "UTC" }).format(parseISO(iso));
}

/** Compacte weergave met weekdag: "za 14 nov 2026". */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseISO(iso));
}

/** Bereik: "14 – 16 november 2026" of één datum als er geen eind is. */
export function formatDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatDate(start);

  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();

  if (sameMonth) {
    return `${s.getUTCDate()} – ${e.getUTCDate()} ${MONTHS_NL[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${s.getUTCDate()} ${MONTHS_NL[s.getUTCMonth()]} – ${e.getUTCDate()} ${
      MONTHS_NL[e.getUTCMonth()]
    } ${e.getUTCFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Slug voor maand-SEO-pagina's: "2026-11-01" -> "november-2026". */
export function monthYearSlug(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS_NL[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Leesbaar label: "november-2026" -> "November 2026". */
export function monthYearLabel(slug: string): string | null {
  const parsed = parseMonthYearSlug(slug);
  if (!parsed) return null;
  const name = MONTHS_NL[parsed.monthIndex];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${parsed.year}`;
}

/** "november-2026" -> { monthIndex: 10, year: 2026 } | null. */
export function parseMonthYearSlug(slug: string): { monthIndex: number; year: number } | null {
  const match = slug.match(/^([a-z]+)-(\d{4})$/i);
  if (!match) return null;
  const monthIndex = MONTHS_NL.indexOf(match[1].toLowerCase() as (typeof MONTHS_NL)[number]);
  if (monthIndex === -1) return null;
  return { monthIndex, year: Number(match[2]) };
}

/** Datum als ISO-string (YYYY-MM-DD) in de Nederlandse sitetijdzone. */
export function todayISOInTimeZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Vandaag als ISO-string (YYYY-MM-DD) in Europe/Amsterdam. Alleen op request-tijd gebruiken. */
export function todayISO(): string {
  return todayISOInTimeZone();
}

/** Is het event nog niet afgelopen t.o.v. referentie (default vandaag)? */
export function isUpcoming(event: { startDatum: string; eindDatum?: string }, ref: string = todayISO()): boolean {
  const laatste = event.eindDatum ?? event.startDatum;
  return laatste >= ref;
}

/** ISO-datum + n dagen (UTC-veilig). */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Het (eerstvolgende) weekend t.o.v. referentiedatum: vrijdag t/m zondag.
 * Valt de referentie zelf in het weekend, dan loopt het bereik van vandaag
 * t/m zondag (voor /opgietingen/dit-weekend).
 */
export function weekendRange(ref: string): { van: string; tot: string } {
  const day = parseISO(ref).getUTCDay(); // 0 = zondag ... 6 = zaterdag
  if (day === 0) return { van: ref, tot: ref }; // zondag: alleen vandaag nog
  const totVrijdag = (5 - day + 7) % 7; // dagen tot komende vrijdag (0 op vrijdag)
  const van = day === 6 ? ref : addDaysISO(ref, totVrijdag);
  const zondag = day === 6 ? addDaysISO(ref, 1) : addDaysISO(van, 2);
  return { van, tot: zondag };
}

/** "juli-2026"-slug van de huidige maand (voor het sitemap-venster). */
export function currentMonthSlug(ref: string = todayISO()): string {
  return monthYearSlug(ref);
}

/* ---------- Weken en weekdagen (social-kit) ---------- */

/** ISO 8601-weeknummer: "2026-09-11" -> "2026-W37" (maandag als weekstart, jaargrens conform ISO). */
export function isoWeek(iso: string): string {
  const d = parseISO(iso);
  const dag = d.getUTCDay() || 7; // ma = 1 … zo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dag); // de donderdag van deze week bepaalt het ISO-jaar
  const jaarStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jaarStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Vrijdag t/m zondag van een ISO-week ("2026-W37" -> 2026-09-11 … 2026-09-13); null bij een ongeldige week. */
export function weekendVanIsoWeek(week: string): { van: string; tot: string } | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const jaar = Number(m[1]);
  const nr = Number(m[2]);
  if (nr < 1 || nr > 53) return null;
  // 4 januari ligt altijd in ISO-week 1.
  const vierJan = new Date(Date.UTC(jaar, 0, 4));
  const maandagW1 = new Date(vierJan);
  maandagW1.setUTCDate(vierJan.getUTCDate() - ((vierJan.getUTCDay() || 7) - 1));
  const vrijdag = new Date(maandagW1);
  vrijdag.setUTCDate(maandagW1.getUTCDate() + (nr - 1) * 7 + 4);
  const van = vrijdag.toISOString().slice(0, 10);
  if (isoWeek(van) !== week) return null; // week 53 bestaat niet elk jaar
  return { van, tot: addDaysISO(van, 2) };
}

/** Eerstvolgende datum met weekdag `dag` (0 = zo … 6 = za); `iso` zelf als die al die weekdag heeft. */
export function volgendeWeekdag(iso: string, dag: number): string {
  const huidige = parseISO(iso).getUTCDay();
  return addDaysISO(iso, (dag - huidige + 7) % 7);
}

/** De eerste dag van een maand binnen [iso, iso + dagen], of undefined. */
export function eersteVanMaandIn(iso: string, dagen: number): string | undefined {
  for (let i = 0; i <= dagen; i++) {
    const d = addDaysISO(iso, i);
    if (d.endsWith("-01")) return d;
  }
  return undefined;
}

/** Korte dagweergave zonder jaar, voor captions: "vr 11 sep". */
export function formatDagKort(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(parseISO(iso))
    .replace(/\./g, "")
    .replace(/[\s  ]+/g, " ");
}

/** Geldige kalenderdatum in de vorm YYYY-MM-DD (geen 2026-02-30). */
export function isGeldigeIsoDatum(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysISO(s, 0) === s;
}
