import Link from "next/link";

const ACTIEF_CLASS = "rounded-full bg-ink px-3 py-1 text-sm font-medium text-cream";
const INACTIEF_CLASS = "rounded-full px-3 py-1 text-sm font-medium text-ink-soft hover:bg-sand";

/** Kop van de beheeromgeving: dashboard hier, bewerken in Keystatic. Geen site-chrome. */
export function BeheerNav({ actief }: { actief: "dashboard" }) {
  return (
    <header className="flex items-center justify-between border-b border-sand pb-4">
      <div className="font-display text-lg text-ink">Opgietingen.nl · beheer</div>
      <nav className="flex gap-1">
        <Link href="/beheer" className={actief === "dashboard" ? ACTIEF_CLASS : INACTIEF_CLASS}>
          Dashboard
        </Link>
        {/* Gewone <a>: /keystatic is een client-SPA achter een catch-all; een volledige paginalaad is daar het veiligst. */}
        <a href="/keystatic" className={INACTIEF_CLASS}>
          Bewerken
        </a>
      </nav>
    </header>
  );
}
