import Link from "next/link";

/** Kop van de beheeromgeving: dashboard hier, bewerken in Keystatic. Geen site-chrome. */
export function BeheerNav({ actief }: { actief: "dashboard" }) {
  const item = (href: string, label: string, isActief: boolean) => (
    <Link
      href={href}
      className={
        isActief
          ? "rounded-full bg-ink px-3 py-1 text-sm font-medium text-cream"
          : "rounded-full px-3 py-1 text-sm font-medium text-ink-soft hover:bg-sand"
      }
    >
      {label}
    </Link>
  );
  return (
    <header className="flex items-center justify-between border-b border-sand pb-4">
      <div className="font-display text-lg text-ink">Opgietingen.nl · beheer</div>
      <nav className="flex gap-1">
        {item("/beheer", "Dashboard", actief === "dashboard")}
        {item("/keystatic", "Bewerken", false)}
      </nav>
    </header>
  );
}
