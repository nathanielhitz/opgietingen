import { EVENT_TYPES, COUNTRY_LABELS, type Country, type EventType } from "@/lib/site";
import { DateInput } from "./DateInput";
import { INPUT_CLASS, type FilterPanelProps } from "./types";

/** Het volledige filterpaneel (pills + selects), zichtbaar vanaf `sm`. */
export function DesktopFilterPanel({ filters, provinces, update }: FilterPanelProps) {
  const land = filters.land ?? "";
  const provincie = filters.provincie ?? "";
  const type = filters.type ?? "";
  const visibleProvinces = provinces.filter((p) => !land || p.land === land);

  return (
    <>
      {/* Land */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill active={!land} onClick={() => update({ land: "" })}>
          Alle landen
        </Pill>
        {(["NL", "BE"] as Country[]).map((c) => (
          <Pill key={c} active={land === c} onClick={() => update({ land: c })}>
            {COUNTRY_LABELS[c]}
          </Pill>
        ))}
      </div>

      {/* Type */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill active={!type} onClick={() => update({ type: "" })}>
          Alle types
        </Pill>
        {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
          <Pill key={t} active={type === t} onClick={() => update({ type: t })}>
            {EVENT_TYPES[t]}
          </Pill>
        ))}
      </div>

      {/* Provincie + datumbereik (Vanaf/Tot altijd naast elkaar) */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Provincie</span>
          <select
            value={provincie}
            onChange={(e) => update({ provincie: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">Alle provincies</option>
            {visibleProvinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.provincie} ({p.count})
              </option>
            ))}
          </select>
        </label>
        <DateInput label="Vanaf" value={filters.van ?? ""} onChange={(v) => update({ van: v })} />
        <DateInput label="Tot en met" value={filters.tot ?? ""} onChange={(v) => update({ tot: v })} />
      </div>
    </>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 ${
        active ? "bg-ember text-white shadow-sm" : "bg-cream text-ink-soft hover:bg-sand"
      }`}
    >
      {children}
    </button>
  );
}
