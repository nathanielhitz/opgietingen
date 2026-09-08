/* eslint-disable @next/next/no-img-element -- satori rendert gewone <img>, geen next/image */
import type { ReactNode } from "react";
import type { OpgietEvent } from "@/lib/content";
import type { Formaat } from "@/lib/social";
import { FORMATEN, HOUT_GRADIENT, KLEUR, OMSLAG, PROFIEL, STORY_VEILIG } from "@/lib/social-stijl";
import { formatDateRange } from "@/lib/dates";
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

function Canvas({ formaat, beeld, children }: { formaat: Formaat; beeld?: string; children: ReactNode }) {
  const { width, height } = FORMATEN[formaat];
  const onder = formaat === "story" ? STORY_VEILIG + 48 : 96;
  const boven = formaat === "story" ? STORY_VEILIG : 72;
  return (
    <div style={{ width, height, display: "flex", position: "relative", background: HOUT_GRADIENT, fontFamily: TEKST, color: KLEUR.cream }}>
      {beeld ? (
        <img src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          background: beeld ? "linear-gradient(180deg, rgba(43,33,25,0.2) 0%, rgba(43,33,25,0.88) 100%)" : "transparent",
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

export function CoverSlide({ formaat, beeld, label, kop, sub }: { formaat: Formaat; beeld?: string; label: string; kop: string; sub: string }) {
  return (
    <Canvas formaat={formaat} beeld={beeld}>
      <Badge tekst={label} />
      <div style={{ display: "flex", marginTop: 32, fontFamily: KOP, fontWeight: 600, fontSize: kop.length > 16 ? 92 : 112, lineHeight: 1.05 }}>{kop}</div>
      <div style={{ display: "flex", marginTop: 22, fontSize: 40, color: KLEUR.emberSoft }}>{sub}</div>
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
          <img src={logo} width={320} height={160} style={{ width: 320, height: 160, objectFit: "contain" }} />
        </div>
      ) : null}
      <Badge tekst={EVENT_TYPES[event.type]} />
      <div style={{ display: "flex", marginTop: 30, fontFamily: KOP, fontWeight: 600, fontSize: titel.length > 40 ? 64 : 78, lineHeight: 1.1, lineClamp: 3 }}>
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
      {beeld ? <img src={beeld} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(90deg, rgba(43,33,25,0.85) 0%, rgba(43,33,25,0.35) 70%, rgba(43,33,25,0) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px" }}>
        <div style={{ display: "flex", fontFamily: KOP, fontWeight: 600, fontSize: 96 }}>{`${site.name}`}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, color: KLEUR.emberSoft, maxWidth: 900 }}>{site.tagline}</div>
      </div>
    </div>
  );
}
