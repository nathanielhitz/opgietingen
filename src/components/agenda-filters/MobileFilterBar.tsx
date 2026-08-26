/** Knop die de filter-sheet opent, met teller van actieve filters (excl. zoekterm). */
export function MobileFilterButton({ aantal, onClick }: { aantal: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-sand bg-cream px-3 text-sm font-medium text-ink transition-colors hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 5h14M6 10h8M8.5 15h3" />
      </svg>
      Filters{aantal > 0 ? ` (${aantal})` : ""}
    </button>
  );
}
