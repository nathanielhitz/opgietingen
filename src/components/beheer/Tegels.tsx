import type { RunTotalen } from "@/lib/scrape-runs";

function Tegel({ n, label, detail, kleur }: { n: number | string; label: string; detail: string; kleur?: string }) {
  return (
    <div className="rounded-xl bg-cream px-4 py-3">
      <div className={`font-display text-3xl font-medium tabular-nums ${kleur ?? "text-ink"}`}>{n}</div>
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="text-xs text-ink-faint">{detail}</div>
    </div>
  );
}

export function Tegels({ t }: { t: RunTotalen }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tegel n={t.kandidaten ?? "?"} label="kandidaten" detail={`uit ${t.bronnen} bronnen`} />
      <Tegel n={t.gepubliceerd} label="gepubliceerd" detail="trefwoord in titel" kleur="text-ok" />
      <Tegel n={t.concept} label="concept" detail="handmatig beoordelen" kleur="text-warn" />
      <Tegel n={t.fouten} label="aandacht" detail={`${t.dedup ?? "?"} dedup · ${t.verleden ?? "?"} verleden`} kleur="text-bad" />
    </div>
  );
}
