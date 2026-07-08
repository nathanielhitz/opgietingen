import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Over ons",
  description: `Wat is ${site.name}? Dé onafhankelijke agenda voor opgietingen en Aufguss-events in sauna's in Nederland en België.`,
  alternates: { canonical: "/over" },
};

export default function OverPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Over {site.name}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
        <p>
          {site.name} is dé agenda voor <strong className="text-ink">opgietingen</strong> — Aufguss-sessies,
          opgietweekenden, thema-avonden en kampioenschappen — in sauna's in Nederland en België.
        </p>
        <p>
          We verzamelen op één plek waar en wanneer er bijzondere opgietingen zijn, zodat je nooit meer een sessie van
          je favoriete opgietmeester mist. Filter op provincie, datum of type, en klik door naar de sauna voor tickets
          of meer informatie.
        </p>
        <p>
          Zit er een event nog niet bij, of run je zelf een sauna? Laat het ons weten via de{" "}
          <Link href="/contact" className="font-medium text-ember hover:underline">
            contactpagina
          </Link>{" "}
          of bekijk wat we{" "}
          <Link href="/voor-saunas" className="font-medium text-ember hover:underline">
            voor sauna's
          </Link>{" "}
          kunnen betekenen.
        </p>
      </div>
    </div>
  );
}
