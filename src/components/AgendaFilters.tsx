"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EVENT_TYPES, COUNTRY_LABELS, type Country, type EventType } from "@/lib/site";

export interface ProvinceOption {
  land: Country;
  provincie: string;
  slug: string;
  count: number;
}

export function AgendaFilters({ provinces }: { provinces: ProvinceOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const land = params.get("land") ?? "";
  const provincie = params.get("provincie") ?? "";
  const type = params.get("type") ?? "";
  const van = params.get("van") ?? "";
  const tot = params.get("tot") ?? "";
  const activeCount = [land, provincie, type, van, tot].filter(Boolean).length;

  const update = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Provincie wissen als het land wisselt (voorkomt onmogelijke combinatie).
      if ("land" in changes) next.delete("provincie");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const visibleProvinces = provinces.filter((p) => !land || p.land === land);

  return (
    <div className="rounded-[--radius-card] border border-sand bg-surface p-4 shadow-sm sm:p-5">
      {/* Land */}
      <div className="flex flex-wrap items-center gap-2">
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
      <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <Pill active={!type} onClick={() => update({ type: "" })}>
          Alle types
        </Pill>
        {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
          <Pill key={t} active={type === t} onClick={() => update({ type: t })}>
            {EVENT_TYPES[t]}
          </Pill>
        ))}
      </div>

      {/* Provincie + datumbereik */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Provincie</span>
          <select
            value={provincie}
            onChange={(e) => update({ provincie: e.target.value })}
            className="w-full rounded-lg border border-sand bg-cream px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          >
            <option value="">Alle provincies</option>
            {visibleProvinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.provincie} ({p.count})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Vanaf</span>
          <input
            type="date"
            value={van}
            onChange={(e) => update({ van: e.target.value })}
            className="w-full rounded-lg border border-sand bg-cream px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Tot en met</span>
          <input
            type="date"
            value={tot}
            onChange={(e) => update({ tot: e.target.value })}
            className="w-full rounded-lg border border-sand bg-cream px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          />
        </label>
      </div>

      {activeCount > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-sand pt-3">
          <span className="text-xs text-ink-faint">
            {activeCount} {activeCount === 1 ? "filter" : "filters"} actief
          </span>
          <button
            onClick={() => router.replace(pathname, { scroll: false })}
            className="text-sm font-medium text-ember hover:text-ember/80"
          >
            Wis filters
          </button>
        </div>
      )}
    </div>
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
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-ember text-white shadow-sm" : "bg-cream text-ink-soft hover:bg-sand"
      }`}
    >
      {children}
    </button>
  );
}
