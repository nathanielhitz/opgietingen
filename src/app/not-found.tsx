import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-ember">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Deze pagina is niet gevonden
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
        De pagina die je zoekt bestaat niet of is verplaatst. Bekijk de agenda of ontdek een sauna.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/agenda"
          className="rounded-full bg-ember px-5 py-3 font-medium text-white transition-colors hover:bg-ember/90"
        >
          Bekijk de agenda
        </Link>
        <Link
          href="/saunas"
          className="rounded-full border border-wood px-5 py-3 font-medium text-wood-dark transition-colors hover:bg-sand"
        >
          Ontdek sauna&apos;s
        </Link>
      </div>
    </div>
  );
}
