export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-sand pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-3">
      <dt className="w-24 flex-none text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  );
}
