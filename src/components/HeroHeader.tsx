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
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40">
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
          className="mt-8 flex max-w-2xl flex-col gap-3 rounded-[--radius-card] border border-white/15 bg-white/10 p-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-cream/80">Provincie</span>
            <select
              name="provincie"
              className="select-glass w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white focus:border-ember-soft focus:outline-none"
            >
              <option value="">Alle provincies</option>
              {provinces.map((p) => (
                <option key={p.provincie} value={slugify(p.provincie)}>
                  {p.provincie} — {COUNTRY_LABELS[p.land]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1 block px-1 text-xs font-medium text-cream/80">Type</span>
            <select
              name="type"
              className="select-glass w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white focus:border-ember-soft focus:outline-none"
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
            className="rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
          >
            Zoek opgietingen
          </button>
        </form>
      </div>
    </section>
  );
}
