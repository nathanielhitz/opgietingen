/*
  CTA naar de affiliate-redirect (/uit/[slug]). Nooit direct naar de sauna
  linken — de redirect logt de klik (PRD §5). rel="sponsored" markeert de
  affiliate-relatie voor zoekmachines.
*/
export function AffiliateButton({
  slug,
  label,
  variant = "primary",
}: {
  slug: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const base =
    "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition-colors";
  const styles =
    variant === "primary"
      ? "bg-ember text-white hover:bg-ember/90"
      : "border border-wood/30 bg-cream text-ink hover:bg-sand";

  return (
    <a href={`/uit/${slug}`} rel="sponsored nofollow noopener" target="_blank" className={`${base} ${styles}`}>
      {label}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
