/* eslint-disable @next/next/no-img-element -- satori rendert gewone <img>, geen next/image */
import type { ReactNode } from "react";
import type { OpgietEvent } from "@/lib/content";
import type { Formaat } from "@/lib/social";
import { FORMATEN, HOUT_GRADIENT, KLEUR, OMSLAG, PROFIEL, STORY_VEILIG } from "@/lib/social-stijl";
import { formatDagCompact, formatDateRange } from "@/lib/dates";
import { EVENT_TYPES, site } from "@/lib/site";

/*
  Slide-componenten voor satori (spec §4.4). Satori-regels: elke div met
  meerdere kinderen is flex; tekst als één string per div; <img> met
  expliciete maten. Geen Tailwind.
*/

const KOP = "Fraunces";
const TEKST = "Inter";

/** Kap op woordgrens af met beletselteken. */
export function afkap(tekst: string, max: number): string {
  if (tekst.length <= max) return tekst;
  const stuk = tekst.slice(0, max);
  const spatie = stuk.lastIndexOf(" ");
  return `${stuk.slice(0, spatie > max * 0.6 ? spatie : max).trimEnd()}…`;
}

/* ---------- Programma op de cover ---------- */

export interface ProgrammaRegel {
  dag: string;
  sauna: string;
  plaats: string;
}

export interface Programma {
  regels: ProgrammaRegel[];
  /** Events die niet meer op de cover passen; 0 als alles erop staat. */
  rest: number;
}

/** Maximaal aantal programmaregels per formaat; de story is hoger en heeft ruimte voor meer. */
export const MAX_REGELS: Record<Formaat, number> = { feed: 5, story: 7 };

/**
 * De events van een rubriek als compacte regels voor de cover (dag, sauna,
 * plaats), afgekapt op MAX_REGELS met een teller voor de rest. Pure functie;
 * de volgorde is die van de selectie (datum, dan saunanaam).
 */
export function programmaRegels(
  events: Pick<OpgietEvent, "startDatum" | "eindDatum" | "sauna">[],
  formaat: Formaat,
): Programma {
  const max = MAX_REGELS[formaat];
  const zichtbaar = events.length > max ? events.slice(0, max) : events;
  return {
    regels: zichtbaar.map((e) => ({ dag: formatDagCompact(e.startDatum, e.eindDatum), sauna: e.sauna.naam, plaats: e.sauna.plaats })),
    rest: events.length - zichtbaar.length,
  };
}

function ProgrammaLijst({ programma, formaat }: { programma: Programma; formaat: Formaat }) {
  const breedte = FORMATEN[formaat].width - 2 * 72;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", marginTop: 36, width: breedte, height: 2, background: "rgba(247,242,234,0.25)" }} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 18 }}>
        {programma.regels.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", fontSize: 30 }}>
            <div style={{ display: "flex", width: 150, flexShrink: 0, color: KLEUR.emberSoft, fontWeight: 500 }}>{r.dag}</div>
            <div style={{ display: "flex", fontWeight: 500 }}>{afkap(r.sauna, 30)}</div>
            <div style={{ display: "flex", marginLeft: 14, color: "#f7f2eaaa" }}>{afkap(r.plaats, 20)}</div>
          </div>
        ))}
        {programma.rest > 0 ? (
          <div style={{ display: "flex", fontSize: 30, color: KLEUR.emberSoft }}>{`+ ${programma.rest} meer op opgietingen.nl`}</div>
        ) : null}
      </div>
    </div>
  );
}

function Steam({ kleur, grootte }: { kleur: string; grootte: number }) {
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 64 64">
      <g fill="none" stroke={kleur} strokeWidth="4.5" strokeLinecap="round">
        <path d="M21 16c0 5-5 6.5-5 11.5S21 34 21 39" />
        <path d="M33 13c0 5.5-5.5 7.5-5.5 13S33 33.5 33 39.5" />
        <path d="M45 16c0 5-5 6.5-5 11.5S45 34 45 39" />
      </g>
      <path d="M14 47h36" stroke={kleur} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ tekst }: { tekst: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        padding: "10px 26px",
        borderRadius: 999,
        background: KLEUR.ember,
        color: KLEUR.cream,
        fontSize: 28,
        fontWeight: 500,
      }}
    >
      {tekst}
    </div>
  );
}

/** Standaardsluier over een beeld: licht bovenin, donker waar de tekst staat. */
const SLUIER = "linear-gradient(180deg, rgba(43,33,25,0.2) 0%, rgba(43,33,25,0.88) 100%)";
/** Zwaardere sluier voor covers met programma: de tekst begint al rond 45% van de hoogte. */
const SLUIER_PROGRAMMA = "linear-gradient(180deg, rgba(43,33,25,0.15) 0%, rgba(43,33,25,0.7) 45%, rgba(43,33,25,0.95) 100%)";

function Canvas({
  formaat,
  beeld,
  sluier = SLUIER,
  onderExtra = 0,
  children,
}: {
  formaat: Formaat;
  beeld?: string;
  sluier?: string;
  /** Extra ruimte tussen de inhoud en de merkregel onderin (bv. onder een programmalijst). */
  onderExtra?: number;
  children: ReactNode;
}) {
  const { width, height } = FORMATEN[formaat];
  const onder = (formaat === "story" ? STORY_VEILIG + 110 : 96) + onderExtra;
  const boven = formaat === "story" ? STORY_VEILIG : 72;
  return (
    <div style={{ width, height, display: "flex", position: "relative", background: HOUT_GRADIENT, fontFamily: TEKST, color: KLEUR.cream }}>
      {beeld ? (
        <img alt="" src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          background: beeld ? sluier : "transparent",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `${boven}px 72px ${onder}px 72px`,
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: formaat === "story" ? STORY_VEILIG : 40,
          display: "flex",
          fontSize: 28,
          fontWeight: 500,
          color: "#f7f2eacc",
        }}
      >
        opgietingen.nl
      </div>
    </div>
  );
}

export function CoverSlide({
  formaat,
  beeld,
  label,
  kop,
  sub,
  programma,
}: {
  formaat: Formaat;
  beeld?: string;
  label: string;
  kop: string;
  sub: string;
  /** Programmaregels onder de kop; zonder (of leeg) blijft de cover alleen kop + bereik. */
  programma?: Programma;
}) {
  const metProgramma = programma !== undefined && programma.regels.length > 0;
  return (
    <Canvas formaat={formaat} beeld={beeld} sluier={metProgramma ? SLUIER_PROGRAMMA : SLUIER} onderExtra={metProgramma ? 24 : 0}>
      <Badge tekst={label} />
      {/* kop is `aantalTekst(n)`: t/m 13 tekens ('9 opgietingen') groot, daarboven ('14 opgietingen', '123 opgietingen') iets kleiner; met programma eronder een maat kleiner. */}
      <div style={{ display: "flex", marginTop: metProgramma ? 28 : 32, fontFamily: KOP, fontWeight: 600, fontSize: kop.length > 13 ? (metProgramma ? 80 : 92) : metProgramma ? 96 : 112, lineHeight: 1.05 }}>
        {kop}
      </div>
      <div style={{ display: "flex", marginTop: metProgramma ? 16 : 22, fontSize: metProgramma ? 36 : 40, color: KLEUR.emberSoft }}>{sub}</div>
      {metProgramma ? <ProgrammaLijst programma={programma} formaat={formaat} /> : null}
    </Canvas>
  );
}

export function EventSlide({
  formaat,
  event,
  beeld,
  logo,
}: {
  formaat: Formaat;
  event: OpgietEvent;
  /** Eigen eventbeeld of echte saunafoto; ontbreekt → houtgradient met logo. */
  beeld?: string;
  logo?: string;
}) {
  const titel = afkap(event.titel, 90);
  const wanneer = `${formatDateRange(event.startDatum, event.eindDatum)}${event.tijden ? ` · ${event.tijden}` : ""}`;
  const logoPlaat = event.sauna.logoAchtergrond === "donker" ? KLEUR.woodDark : KLEUR.cream;
  return (
    <Canvas formaat={formaat} beeld={beeld}>
      {!beeld && logo ? (
        <div style={{ display: "flex", alignSelf: "flex-start", padding: 28, borderRadius: 24, background: logoPlaat, marginBottom: 44 }}>
          <img alt="" src={logo} width={320} height={160} style={{ width: 320, height: 160, objectFit: "contain" }} />
        </div>
      ) : null}
      <Badge tekst={EVENT_TYPES[event.type]} />
      {/* Als enige div block i.p.v. flex: satori honoreert lineClamp alleen bij display block. */}
      <div
        style={{
          display: "block",
          marginTop: 30,
          fontFamily: KOP,
          fontWeight: 600,
          fontSize: titel.length > 40 ? 64 : 78,
          lineHeight: 1.1,
          lineClamp: 3,
          wordBreak: "break-word",
        }}
      >
        {titel}
      </div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 38, fontWeight: 500 }}>{`${event.sauna.naam} · ${event.sauna.plaats}`}</div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 34, color: KLEUR.emberSoft }}>{wanneer}</div>
      {event.prijsIndicatie ? <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: "#f7f2eacc" }}>{event.prijsIndicatie}</div> : null}
    </Canvas>
  );
}

export function AfsluiterSlide({ formaat }: { formaat: Formaat }) {
  return (
    <Canvas formaat={formaat}>
      <Steam kleur={KLEUR.emberSoft} grootte={150} />
      <div style={{ display: "flex", marginTop: 36, fontFamily: KOP, fontWeight: 600, fontSize: 84, lineHeight: 1.08 }}>
        Alle opgietingen in Nederland en België op één plek
      </div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 42, color: KLEUR.emberSoft }}>Link in bio</div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 32, color: "#f7f2eacc" }}>Sla deze post op en deel hem met je saunamaatje.</div>
    </Canvas>
  );
}

export function ProfielSlide() {
  return (
    <div style={{ width: PROFIEL.width, height: PROFIEL.height, display: "flex", alignItems: "center", justifyContent: "center", background: KLEUR.cream }}>
      <Steam kleur={KLEUR.ember} grootte={720} />
    </div>
  );
}

export function OmslagSlide({ beeld }: { beeld?: string }) {
  const { width, height } = OMSLAG;
  return (
    <div style={{ width, height, display: "flex", position: "relative", background: HOUT_GRADIENT, fontFamily: TEKST, color: KLEUR.cream }}>
      {beeld ? <img alt="" src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(90deg, rgba(43,33,25,0.85) 0%, rgba(43,33,25,0.35) 70%, rgba(43,33,25,0) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px" }}>
        <div style={{ display: "flex", fontFamily: KOP, fontWeight: 600, fontSize: 96 }}>{`${site.name}`}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, color: KLEUR.emberSoft, maxWidth: 900 }}>{site.tagline}</div>
      </div>
    </div>
  );
}
