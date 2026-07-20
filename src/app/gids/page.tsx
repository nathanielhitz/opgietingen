import type { Metadata } from "next";
import Link from "next/link";
import { getAllGidsen } from "@/lib/content";
import { absoluteUrl, gidsItemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumb } from "@/components/Breadcrumb";
import { GidsCard } from "@/components/GidsCard";

export const revalidate = 3600;

const TITLE = "Saunagids — tips & spullen voor de opgieting";
const DESCRIPTION =
  "Praktische gidsen over opgietingen en de saunacultuur: wat neem je mee, welke saunahoed kies je, en hoe haal je het meeste uit een Aufguss-sessie.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/gids" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/gids"),
  },
};

export default function GidsIndexPage() {
  const gidsen = getAllGidsen();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={gidsItemListSchema(gidsen, "Saunagidsen")} />

      <Breadcrumb items={[{ label: "Gids" }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Saunagids</h1>
        <p className="mt-3 text-ink-soft">{DESCRIPTION}</p>
      </header>

      {gidsen.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gidsen.map((gids) => (
            <GidsCard key={gids.slug} gids={gids} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-[--radius-card] border border-sand bg-surface p-6 text-ink-soft">
          Er staan nog geen gidsen online. Kom binnenkort terug — of bekijk de{" "}
          <Link href="/agenda" className="font-medium text-ember hover:underline">
            agenda
          </Link>
          .
        </p>
      )}
    </div>
  );
}
