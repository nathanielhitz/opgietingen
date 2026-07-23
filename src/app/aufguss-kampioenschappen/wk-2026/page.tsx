import type { Metadata } from "next";
import Link from "next/link";
import { getEventBySlug, getSaunaBySlug } from "@/lib/content";
import { faqSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { EventCard } from "@/components/EventCard";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  WK-editiepagina (audit-item 12 / V5): subpagina van de evergreen
  kampioenschappen-hub voor "WK aufguss 2026" / "aufguss WM 2026".
  Alle feiten geverifieerd (juli 2026) via aufguss-wm.com (datum, locatie,
  playoffs, nationale voorrondes), thermenbussloo.nl (NK-uitslag, playoffticket)
  en waerwaters.com (BK-finale). Niet-verifieerbare details (BK-uitslag,
  definitieve deelnemerslijst) zijn bewust weggelaten.
*/

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "WK Aufguss 2026: datum, locatie en de NL/BE-selectie",
  description:
    "Het WK Aufguss 2026 is van 14 t/m 20 september bij Satama Sauna Resort bij Berlijn. Lees hoe NL en BE zich plaatsen, met de playoffs bij Thermen Bussloo.",
  alternates: { canonical: "/aufguss-kampioenschappen/wk-2026" },
};

const FAQ = [
  {
    vraag: "Wanneer is het WK Aufguss 2026?",
    antwoord:
      "Het WK Aufguss (Aufguss-WM) 2026 vindt plaats van 14 tot en met 20 september 2026. De officiële kwalificatieronde, de WM-playoffs, is van 26 tot en met 29 augustus 2026 bij Thermen Bussloo in Nederland.",
  },
  {
    vraag: "Waar wordt het WK Aufguss 2026 gehouden?",
    antwoord:
      "Het WK Aufguss 2026 wordt gehouden bij Satama Sauna Resort & Spa in Wendisch Rietz (Brandenburg), vlak bij Berlijn in Duitsland. Ook eerdere edities van de Aufguss-WM vonden daar plaats.",
  },
  {
    vraag: "Hoe plaatst Nederland zich voor het WK Aufguss?",
    antwoord:
      "Via het Aufguss NK, het Nederlands kampioenschap van saunabond VNSWB. In 2026 waren de voorrondes op 10 en 11 april bij Thermen Bussloo en de finale op 19 en 20 juni bij Thermen Berendonck. De nummers 1 tot en met 3 van de categorieën single en team plaatsten zich rechtstreeks voor het WK.",
  },
  {
    vraag: "Wat zijn de Aufguss WM-playoffs bij Thermen Bussloo?",
    antwoord:
      "De WM-playoffs (26 t/m 29 augustus 2026, Thermen Bussloo) zijn de laatste kwalificatieronde voor het WK Aufguss: opgieters zonder direct ticket, en deelnemers uit landen zonder eigen nationaal kampioenschap, strijden er om de laatste WK-plekken. De sessies zijn voor saunabezoekers gewoon bij te wonen.",
  },
];

export default function Wk2026Page() {
  const playoffs = getEventBySlug("aufguss-wm-playoffs-2026-08-26");
  const bussloo = getSaunaBySlug("thermen-bussloo");

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={faqSchema(FAQ)} />
      <Breadcrumb
        items={[
          { href: "/agenda", label: "Agenda" },
          { href: "/aufguss-kampioenschappen", label: "Kampioenschappen" },
          { label: "WK 2026" },
        ]}
      />

      <header className="mt-4">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          WK Aufguss 2026: datum, locatie en de weg ernaartoe
        </h1>
      </header>

      <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
        {/* Citeerbare kernfeiten direct onder de H1 (GEO) */}
        <p className="text-lg">
          <strong className="text-ink">
            Het WK Aufguss 2026 (officieel: Aufguss-WM) vindt plaats van 14 tot en met 20 september
            2026 bij Satama Sauna Resort &amp; Spa in Wendisch Rietz, vlak bij Berlijn.
          </strong>{" "}
          Het is de grootste internationale wedstrijd in het showopgieten: saunameesters uit
          tientallen landen strijden er in de categorieën single en team om de wereldtitel. De
          allerlaatste WK-tickets worden eind augustus verdeeld tijdens de WM-playoffs bij Thermen
          Bussloo in Nederland.
        </p>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">Wat is het WK Aufguss?</h2>
        <p>
          Bij een wedstrijdopgieting draait een saunameester een complete voorstelling: water en ijs
          met etherische oliën gaan op de hete kachel en de geurgolven worden met waaierdoeken door
          de cabine gestuurd, strak gechoreografeerd op muziek, licht en een eigen verhaallijn. Een
          internationale vakjury beoordeelt onder meer thema, geurcompositie, hittebeheersing en
          handdoektechniek. Het WK is daarin het hoogst haalbare podium; deelnemers plaatsen zich
          via hun nationale kampioenschap of via de playoffs. Nieuw in de saunawereld?{" "}
          <Link href="/wat-is-een-opgieting" className="font-medium text-ember hover:underline">
            Lees eerst wat een opgieting is
          </Link>
          .
        </p>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">Datum en locatie</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Wanneer:</strong> 14 t/m 20 september 2026 (bron:
            aufguss-wm.com, de organisatie).
          </li>
          <li>
            <strong className="text-ink">Waar:</strong> Satama Sauna Resort &amp; Spa in Wendisch
            Rietz (Brandenburg, Duitsland), zo&rsquo;n uur ten zuidoosten van Berlijn. Ook eerdere
            WK-edities vonden hier plaats.
          </li>
          <li>
            <strong className="text-ink">Categorieën:</strong> single en team.
          </li>
        </ul>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">
          WM-playoffs bij Thermen Bussloo: 26 t/m 29 augustus 2026
        </h2>
        <p>
          Vlak voor het WK is Nederland zelf even het middelpunt van de internationale
          opgietwereld: van 26 tot en met 29 augustus 2026 vinden in het Sauna Theater van{" "}
          {bussloo ? (
            <Link href={`/sauna/${bussloo.slug}`} className="font-medium text-ember hover:underline">
              Thermen Bussloo
            </Link>
          ) : (
            "Thermen Bussloo"
          )}{" "}
          (Voorst, Gelderland) de officiële <strong className="text-ink">Aufguss WM-playoffs</strong>{" "}
          plaats. Opgieters die op hun nationale kampioenschap net naast een direct ticket grepen,
          en deelnemers uit landen zonder eigen kampioenschap, strijden er om de laatste plekken in
          de WK-finale. Namens Nederland verdienden de nummers vier van het NK, Robin Lukassen en
          Desirée Daniels, volgens Thermen Bussloo een startbewijs in deze playoffs. Als bezoeker
          kun je de sessies gewoon bijwonen; kom op tijd, want het Sauna Theater zit bij
          wedstrijden snel vol.
        </p>
        {playoffs && (
          <div className="max-w-md pt-1">
            <EventCard event={playoffs} />
          </div>
        )}

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">
          Zo werkt de Nederlandse selectie
        </h2>
        <p>
          Nederland vaardigt zijn deelnemers af via het <strong className="text-ink">Aufguss NK</strong>,
          georganiseerd door saunabond VNSWB. In 2026 waren de voorrondes op 10 en 11 april bij
          Thermen Bussloo; de finale volgde op 19 en 20 juni bij Thermen Berendonck in Wijchen. De
          nummers 1 tot en met 3 van beide categorieën plaatsten zich rechtstreeks voor het WK.
        </p>
        <p>
          De uitslag van het NK Aufguss 2026: bij de singles won{" "}
          <strong className="text-ink">Jo-Annie Hulleman</strong> (Thermen Bussloo) met haar show
          &ldquo;The Thief and the Stone&rdquo;; bij de teams ging de titel naar{" "}
          <strong className="text-ink">Sigrid van Rijswijk en Job Verheijen</strong> (Thermen
          Berendonck) met &ldquo;Honey I&rsquo;m Home&rdquo;. Zij dragen in september de
          Nederlandse kleuren bij Satama.
        </p>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">
          Zo werkt de Belgische selectie
        </h2>
        <p>
          België wijst zijn WK-gangers aan via het <strong className="text-ink">BK Aufguss</strong>{" "}
          (het Belgisch kampioenschap showopgieten), georganiseerd door de Opgietersvereniging
          België. De finale van 2026 vond eind april plaats bij Waer Waters in Groot-Bijgaarden en
          was uitverkocht. De best geklasseerde Belgische opgieters plaatsen zich via het BK voor
          het WK.
        </p>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">
          Zelf een wedstrijdopgieting meemaken?
        </h2>
        <p>
          De playoffs bij Thermen Bussloo zijn dé kans om dit niveau van opgieten in Nederland te
          zien. Daarnaast zijn er het hele jaar door wedstrijden en show-events in Nederland en
          België: van voorrondes tot volwaardige kampioenschappen. Bekijk alle{" "}
          <Link href="/aufguss-kampioenschappen" className="font-medium text-ember hover:underline">
            Aufguss-kampioenschappen
          </Link>{" "}
          of blader door de{" "}
          <Link href="/agenda" className="font-medium text-ember hover:underline">
            volledige opgietagenda
          </Link>
          .
        </p>

        <h2 className="pt-6 font-display text-2xl font-semibold text-ink">Veelgestelde vragen</h2>
        <dl className="space-y-5">
          {FAQ.map((item) => (
            <div key={item.vraag}>
              <dt className="font-display text-lg font-semibold text-ink">{item.vraag}</dt>
              <dd className="mt-1">{item.antwoord}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-label="Meer agenda" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/aufguss-kampioenschappen"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Alle kampioenschappen
        </Link>
        <Link
          href="/agenda"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Volledige agenda
        </Link>
      </nav>
    </article>
  );
}
