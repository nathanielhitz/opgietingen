import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacybeleid",
  description: `Hoe ${site.name} omgaat met je gegevens. Kort en duidelijk: we verzamelen zo min mogelijk.`,
  alternates: { canonical: "/privacybeleid" },
};

export default function PrivacybeleidPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Privacybeleid</h1>
      <p className="mt-3 text-sm text-ink-faint">Laatst bijgewerkt: 13 juli 2026</p>

      <div className="mt-6 space-y-6 leading-relaxed text-ink-soft">
        <p>
          {site.name} houdt privacy simpel: we verzamelen zo min mogelijk. Je kunt de agenda volledig gebruiken zonder
          account, zonder in te loggen en zonder persoonsgegevens achter te laten.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Welke gegevens we verwerken</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Bezoekstatistieken.</strong> We gebruiken Vercel Web Analytics om te zien
              hoeveel mensen de site bezoeken. Dit gebeurt <strong className="text-ink">zonder cookies</strong> en
              zonder dat er persoonsgegevens of volledige IP-adressen worden opgeslagen. De cijfers zijn geanonimiseerd
              en niet naar jou herleidbaar.
            </li>
            <li>
              <strong className="text-ink">E-mail.</strong> Stuur je ons een bericht, dan gebruiken we je e-mailadres en
              inhoud alleen om te reageren. We bewaren het niet langer dan nodig en delen het niet met derden.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Wat we níet doen</h2>
          <p className="mt-3">
            Geen accounts, geen nieuwsbrief-tracking, geen advertentie- of marketingcookies, en geen verkoop of deling
            van gegevens met derden voor marketing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Links naar sauna&apos;s</h2>
          <p className="mt-3">
            Via onze links ga je door naar de website van een sauna of ticketpartner. Op die externe sites geldt hun
            eigen privacybeleid; daar hebben wij geen invloed op.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Hosting</h2>
          <p className="mt-3">
            De site wordt gehost door Vercel. Zoals bij elke webserver worden technische logs (zoals tijdstip en globale
            regio van een verzoek) tijdelijk verwerkt voor beveiliging en het correct afleveren van de pagina.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Je rechten</h2>
          <p className="mt-3">
            Je hebt recht op inzage, correctie of verwijdering van gegevens die we van je hebben. Omdat we vrijwel niets
            opslaan, is dit meestal snel geregeld. Mail ons via{" "}
            <a href="mailto:hallo@opgietingen.nl" className="font-medium text-ember hover:underline">
              hallo@opgietingen.nl
            </a>
            .
          </p>
        </section>

        <p className="text-sm text-ink-faint">
          Zie ook ons{" "}
          <Link href="/cookiebeleid" className="font-medium text-ember hover:underline">
            cookiebeleid
          </Link>
          . Dit beleid kan worden aangepast als de site nieuwe functies krijgt; de datum bovenaan geeft de laatste
          wijziging aan.
        </p>
      </div>
    </div>
  );
}
