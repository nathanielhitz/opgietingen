import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Voor sauna's — plaats jouw opgietingen",
  description: `Zet jouw sauna en opgiet-events in de spotlight bij saunaliefhebbers in NL & BE. Ontdek de mogelijkheden op ${site.name}.`,
  alternates: { canonical: "/voor-saunas" },
};

const voordelen = [
  {
    titel: "Bereik gerichte bezoekers",
    tekst: "Saunaliefhebbers die actief op zoek zijn naar opgietingen vinden jouw events via de agenda en regiopagina's.",
  },
  {
    titel: "SEO-first vindbaarheid",
    tekst: "Elk event en elke sauna krijgt een eigen, geoptimaliseerde pagina met structured data — sterk voor Google.",
  },
  {
    titel: "Meetbare doorklikken",
    tekst: "Bezoekers klikken via getrackte links door naar jouw eigen website of ticketpagina.",
  },
  {
    titel: "Uitgelichte vermelding",
    tekst: "Wil je extra opvallen? Kies voor een uitgelichte plek boven aan de agenda en op de homepage.",
  },
];

export default function VoorSaunasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-ember">Voor sauna’s</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Zet jouw opgietingen in de spotlight
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        {site.name} brengt saunaliefhebbers in Nederland en België naar jouw opgietweekenden, thema-avonden en
        kampioenschappen. Plaats je events en profiteer van gerichte, meetbare bezoekers.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {voordelen.map((v) => (
          <div key={v.titel} className="rounded-[--radius-card] border border-sand bg-surface p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-ink">{v.titel}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{v.tekst}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[--radius-card] bg-wood-dark warmth-gradient p-8 sm:p-10">
        <h2 className="font-display text-2xl font-semibold text-white">Interesse?</h2>
        <p className="mt-2 max-w-lg text-cream/85">
          Neem contact op en we zetten jouw sauna en events snel live. In de MVP-fase voegen we events handmatig toe —
          later kun je ze zelf beheren.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
        >
          Neem contact op
        </Link>
      </div>
    </div>
  );
}
