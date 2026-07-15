import Image from "next/image";
import { getProvincesWithEvents, slugify } from "@/lib/content";
import { EVENT_TYPES, COUNTRY_LABELS, type EventType } from "@/lib/site";

// Fotografische homepage-hero: liggende foto ≥md, staande foto <md, donkere
// scrim eroverheen, en het GET-zoekformulier naar /agenda (werkt zonder JS).
// De zoekbalk-markup is identiek aan de oude inline hero in page.tsx.
export default function HeroHeader({
  provinces,
}: {
  provinces: ReturnType<typeof getProvincesWithEvents>;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-wood-dark">
      {/* Foto-lagen: art-direction per breakpoint (staand mobiel, liggend desktop) */}
      <Image
        src="/images/hero/hero-mobiel.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover md:hidden"
      />
      <Image
        src="/images/hero/hero-desktop.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="hidden object-cover md:block"
      />

      {/* Donkere scrim voor leesbaarheid */}
      <div className="hero-overlay absolute inset-0" aria-hidden />

      {/* Inhoud */}
      {/* De site-header zweeft transparant over de foto; pt compenseert zijn hoogte. */}
      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
        <p className="text-sm font-semibold uppercase tracking-wider text-ember-soft">
          Opgietingen · Aufguss · NL &amp; BE
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Vind de mooiste opgietingen bij jou in de buurt
        </h1>
        <p className="mt-4 max-w-xl text-lg text-cream/85">
          Dé agenda voor opgietweekenden, thema-avonden en Aufguss-kampioenschappen in sauna&apos;s
          in Nederland en België.
        </p>

        {/* Zoekbalk: GET-form naar /agenda (werkt zonder JS). Frosted glass zodat
            hij in de herofoto opgaat in plaats van er als wit blok op te liggen. */}
        <form
          action="/agenda"
          className="mt-8 grid max-w-4xl gap-3 rounded-[--radius-card] border border-white/15 bg-white/10 p-3 shadow-lg backdrop-blur-md sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
        >
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block px-1 text-xs font-medium text-cream/80">
              Zoek op event, sauna of plaats
            </span>
            <input
              type="search"
              name="q"
              placeholder="Bijv. Aufguss, Thermen of Utrecht"
              className="h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-cream/55 focus:border-ember-soft"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-cream/80">Provincie</span>
            <select
              name="provincie"
              className="select-glass h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white focus:border-ember-soft"
            >
              <option value="">Alle provincies</option>
              {provinces.map((p) => (
                <option key={p.provincie} value={slugify(p.provincie)}>
                  {p.provincie}, {COUNTRY_LABELS[p.land]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-cream/80">Type</span>
            <select
              name="type"
              className="select-glass h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white focus:border-ember-soft"
            >
              <option value="">Alle types</option>
              {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPES[t]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-11 rounded-full bg-ember px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
          >
            Zoek opgietingen
          </button>
        </form>
      </div>
    </section>
  );
}
