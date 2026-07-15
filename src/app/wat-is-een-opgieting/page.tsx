import type { Metadata } from "next";
import Link from "next/link";
import { getProvincesWithSaunas, slugify } from "@/lib/content";
import { faqSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumb } from "@/components/Breadcrumb";

/*
  Pillar-pagina (SEO-PLAN fase 2): hét informatieve anker voor de zoektermen
  "wat is een opgieting", "aufguss betekenis" e.d. Definitie bovenaan in
  citeerbare vorm (GEO), daarna verloop, etiquette, soorten en FAQ.
*/

export const metadata: Metadata = {
  title: "Wat is een opgieting (Aufguss)? Alles over het saunaritueel",
  description:
    "Een opgieting (Aufguss) is een saunaritueel waarbij de saunameester water met etherische olie op de hete stenen giet en de hitte met een handdoek verdeelt. Lees hoe een opgieting verloopt, wat de etiquette is en welke soorten er zijn.",
  alternates: { canonical: "/wat-is-een-opgieting" },
};

const FAQ = [
  {
    vraag: "Wat is een opgieting?",
    antwoord:
      "Een opgieting (in het Duits: Aufguss) is een saunaritueel waarbij een saunameester water, vaak met etherische olie, op de hete saunastenen giet. De stoom die vrijkomt wordt met zwaaiende handdoekbewegingen door de sauna verdeeld, waardoor je de hitte in golven over je huid voelt trekken. Een opgieting duurt meestal 10 tot 15 minuten.",
  },
  {
    vraag: "Is een opgieting geschikt voor beginners?",
    antwoord:
      "Ja. Je hoeft niets te kunnen of te weten: je gaat zitten, de saunameester doet de rest. Kies voor je eerste keer een reguliere opgieting (geen extra lange of extra hete sessie), ga op een lagere bank zitten waar het koeler is, en verlaat de sauna gerust tussentijds als het te heet wordt.",
  },
  {
    vraag: "Wat kost een opgieting?",
    antwoord:
      "Bij de meeste sauna's en thermen in Nederland en België zijn opgietingen inbegrepen bij de dagentree. Voor speciale events, zoals opgietweekenden, themasessies of kampioenschappen, kan een toeslag of apart ticket gelden; dat staat dan bij het event vermeld.",
  },
  {
    vraag: "Hoe lang duurt een opgieting?",
    antwoord:
      "Een gewone opgieting duurt ongeveer 10 tot 15 minuten, vaak verdeeld over meerdere opgietrondes. Showopgietingen en wedstrijdsessies (zoals bij het NK of BK Aufguss) duren meestal 12 tot 15 minuten per optreden.",
  },
  {
    vraag: "Wat is het verschil tussen een opgieting en een Aufguss?",
    antwoord:
      "Er is geen verschil: Aufguss is het Duitse woord voor opgieting en wordt in de saunawereld internationaal gebruikt. In Nederland en Vlaanderen worden beide termen door elkaar gebruikt; ook 'löyly' (Fins) verwijst naar de stoom die bij het opgieten vrijkomt.",
  },
  {
    vraag: "Mag je tijdens een opgieting de sauna in of uit?",
    antwoord:
      "Binnenkomen tijdens een opgieting is niet de bedoeling: de deur open laten verstoort het ritueel en laat de hitte ontsnappen. Weggaan mag altijd — als de hitte te veel wordt, verlaat je rustig en zonder schuldgevoel de sauna. Gezondheid gaat boven etiquette.",
  },
  {
    vraag: "Hoe vaak zijn er opgietingen?",
    antwoord:
      "Veel sauna's en thermen verzorgen dagelijks meerdere opgietingen volgens een vast schema. Daarnaast zijn er speciale opgietevents: themadagen, opgietweekenden met gastopgieters en kampioenschappen. De actuele agenda voor Nederland en België vind je op Opgietingen.nl.",
  },
  {
    vraag: "Wat neem je mee naar een opgieting?",
    antwoord:
      "Hetzelfde als voor een gewoon saunabezoek: een (extra) handdoek om op te zitten en eventueel een saunahoed om je hoofd tegen de hitte te beschermen. Drink voor en na de sessie voldoende water.",
  },
];

export default function WatIsEenOpgietingPage() {
  const provincies = getProvincesWithSaunas();

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={faqSchema(FAQ)} />
      <Breadcrumb items={[{ label: "Wat is een opgieting?" }]} />

      <header className="mt-4">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Wat is een opgieting (Aufguss)?
        </h1>
      </header>

      <div className="prose-opgieting mt-6 space-y-4 leading-relaxed text-ink-soft">
        {/* Citeerbare definitie direct onder de H1 (GEO) */}
        <p className="text-lg">
          <strong className="text-ink">
            Een opgieting — internationaal bekend als Aufguss — is een saunaritueel waarbij de
            saunameester water met etherische olie op de hete saunastenen giet en de vrijgekomen
            stoom met zwaaiende handdoekbewegingen door de sauna verdeelt.
          </strong>{" "}
          De hitte komt daardoor in golven over je huid, de geur van de olie vult de ruimte en de
          temperatuurbeleving stijgt flink — zonder dat de sauna zelf heter wordt. Een sessie duurt
          meestal 10 tot 15 minuten en is bij de meeste sauna&rsquo;s inbegrepen bij de entree.
        </p>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">Hoe verloopt een opgieting?</h2>
        <p>
          Een opgieting volgt bijna overal hetzelfde ritme. De saunameester kondigt de sessie aan en
          bezoekers zoeken een plek — hoe hoger de bank, hoe heter. De deur gaat dicht en gaat pas
          weer open als de sessie klaar is. Daarna volgen meestal drie opgietrondes:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-ink">Het opgieten.</strong> Water met etherische olie (bijvoorbeeld
            eucalyptus, den of citrus) gaat met een houten lepel op de stenen van de saunakachel. De
            luchtvochtigheid stijgt en de warmte wordt direct voelbaarder.
          </li>
          <li>
            <strong className="text-ink">Het wapperen.</strong> Met een grote handdoek, waaier of vlag
            verdeelt de saunameester de hete stoom door de ruimte — van sierlijke draaibewegingen tot
            spectaculaire technieken bij showopgietingen.
          </li>
          <li>
            <strong className="text-ink">De afronding.</strong> Na de laatste ronde koel je af: buiten,
            onder de douche of in het dompelbad. Rustig bijkomen en water drinken hoort erbij.
          </li>
        </ol>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">Etiquette: zo doe je mee</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Kom op tijd — tijdens de sessie blijft de deur dicht en kun je niet meer naar binnen.</li>
          <li>Neem een handdoek mee om volledig op te zitten (geen zweet op het hout).</li>
          <li>Praat niet tijdens de sessie; de opgieting is voor veel bezoekers een moment van rust.</li>
          <li>Te heet? Ga rustig weg. Dat is nooit onbeleefd — gezondheid gaat voor.</li>
          <li>Volg de aanwijzingen van de saunameester; die kent de sauna en de sessie het best.</li>
        </ul>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">Soorten opgietingen</h2>
        <p>
          Niet elke opgieting is hetzelfde. Dit zijn de vormen die je in Nederland en België het
          vaakst tegenkomt:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Reguliere opgieting</strong> — de dagelijkse sessie volgens het
            opgietschema van de sauna, meestal inbegrepen bij de entree.
          </li>
          <li>
            <strong className="text-ink">Thema-opgieting</strong> — een sessie rond een verhaal, seizoen
            of muziekstijl, vaak met bijpassende geuren en verlichting. Zie de{" "}
            <Link href="/agenda?type=thema" className="font-medium text-ember hover:underline">
              agenda met thema-events
            </Link>
            .
          </li>
          <li>
            <strong className="text-ink">Opgietweekend</strong> — een heel weekend met extra veel
            (gast)opgietingen. Bekijk de{" "}
            <Link href="/opgietweekenden" className="font-medium text-ember hover:underline">
              komende opgietweekenden
            </Link>
            .
          </li>
          <li>
            <strong className="text-ink">Show- en wedstrijdopgieting</strong> — choreografie, muziek en
            verhaal komen samen; het hoogtepunt zijn het NK en BK Aufguss. Lees meer over{" "}
            <Link href="/aufguss-kampioenschappen" className="font-medium text-ember hover:underline">
              Aufguss-kampioenschappen
            </Link>
            .
          </li>
        </ul>

        <h2 className="pt-4 font-display text-2xl font-semibold text-ink">
          Waar kun je een opgieting meemaken?
        </h2>
        <p>
          Vrijwel elke grotere sauna of thermen in Nederland en België heeft opgietingen op het
          programma. Op Opgietingen.nl verzamelen we de bijzondere sessies en events op één plek:
          bekijk{" "}
          <Link href="/opgietingen/vandaag" className="font-medium text-ember hover:underline">
            de opgietingen van vandaag
          </Link>
          ,{" "}
          <Link href="/opgietingen/dit-weekend" className="font-medium text-ember hover:underline">
            dit weekend
          </Link>{" "}
          of de{" "}
          <Link href="/agenda" className="font-medium text-ember hover:underline">
            volledige agenda
          </Link>
          . Liever dichtbij huis zoeken? Kies je provincie:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {provincies.map((p) => (
            <Link
              key={p.provincie}
              href={`/opgietingen/${slugify(p.provincie)}`}
              className="rounded-full border border-sand bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember"
            >
              {p.provincie}
            </Link>
          ))}
        </div>

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
    </article>
  );
}
