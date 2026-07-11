"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EVENT_TYPES, COUNTRY_LABELS, type Country, type EventType } from "@/lib/site";

export interface ProvinceOption {
  land: Country;
  provincie: string;
  slug: string;
  count: number;
}

export function AgendaFilters({
  provinces,
  error,
}: {
  provinces: ProvinceOption[];
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const land = params.get("land") ?? "";
  const provincie = params.get("provincie") ?? "";
  const type = params.get("type") ?? "";
  const van = params.get("van") ?? "";
  const tot = params.get("tot") ?? "";
  const paramsKey = params.toString();
  const [searchValue, setSearchValue] = useState(q);
  const latestParamsRef = useRef(new URLSearchParams(paramsKey));
  const requestedParamsRef = useRef(new Set<string>());
  const pendingParamsRef = useRef<string | null>(null);
  const draftRevisionRef = useRef(0);
  const submittedSearchRef = useRef<{ value: string; revision: number } | null>(null);

  // Eigen router-updates kunnen in een andere volgorde renderen dan ze zijn aangevraagd.
  // Alleen de nieuwste bevestigen we; een onbekende URL behandelen we als externe navigatie.
  useEffect(() => {
    const pendingParams = pendingParamsRef.current;

    if (pendingParams === paramsKey) {
      latestParamsRef.current = new URLSearchParams(paramsKey);
      pendingParamsRef.current = null;
      requestedParamsRef.current.clear();

      const submittedSearch = submittedSearchRef.current;
      if (submittedSearch?.value === q) {
        if (submittedSearch.revision === draftRevisionRef.current) {
          setSearchValue(q);
        }
        submittedSearchRef.current = null;
      }
      return;
    }

    if (requestedParamsRef.current.has(paramsKey)) {
      requestedParamsRef.current.delete(paramsKey);
      return;
    }

    latestParamsRef.current = new URLSearchParams(paramsKey);
    pendingParamsRef.current = null;
    requestedParamsRef.current.clear();
    submittedSearchRef.current = null;
    draftRevisionRef.current += 1;
    setSearchValue(q);
  }, [paramsKey, q]);

  const update = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(latestParamsRef.current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Provincie wissen als het land wisselt (voorkomt onmogelijke combinatie).
      if ("land" in changes) next.delete("provincie");
      const qs = next.toString();
      latestParamsRef.current = next;
      requestedParamsRef.current.add(qs);
      pendingParamsRef.current = qs;

      if ("q" in changes) {
        draftRevisionRef.current += 1;
        submittedSearchRef.current = {
          value: changes.q,
          revision: draftRevisionRef.current,
        };
        setSearchValue(changes.q);
      }

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const resetFilters = useCallback(() => {
    const emptyParams = new URLSearchParams();
    latestParamsRef.current = emptyParams;
    requestedParamsRef.current.add("");
    pendingParamsRef.current = "";
    draftRevisionRef.current += 1;
    submittedSearchRef.current = {
      value: "",
      revision: draftRevisionRef.current,
    };
    setSearchValue("");
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const visibleProvinces = provinces.filter((p) => !land || p.land === land);
  const activeFilters = [
    q.trim() ? { key: "q", label: `Zoeken: “${q.trim()}”` } : null,
    land ? { key: "land", label: `Land: ${COUNTRY_LABELS[land as Country] ?? land}` } : null,
    provincie
      ? {
          key: "provincie",
          label: `Provincie: ${provinces.find((p) => p.slug === provincie)?.provincie ?? provincie}`,
        }
      : null,
    type
      ? { key: "type", label: `Type: ${EVENT_TYPES[type as EventType] ?? type}` }
      : null,
    van ? { key: "van", label: `Vanaf: ${van}` } : null,
    tot ? { key: "tot", label: `Tot en met: ${tot}` } : null,
  ].filter((filter): filter is { key: string; label: string } => filter !== null);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: searchValue.trim() });
  }

  return (
    <div className="rounded-[--radius-card] border border-sand bg-surface p-4 shadow-sm sm:p-5">
      <form onSubmit={submitSearch}>
        <label htmlFor="agenda-search" className="mb-1 block text-xs font-medium text-ink-faint">
          Zoek op event, sauna of plaats
        </label>
        <div className="flex gap-2">
          <input
            id="agenda-search"
            type="search"
            name="q"
            autoComplete="off"
            value={searchValue}
            onChange={(event) => {
              draftRevisionRef.current += 1;
              setSearchValue(event.target.value);
            }}
            placeholder="Bijvoorbeeld Aufguss of Thermen Bussloo"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-sand bg-cream px-3 text-sm text-ink focus:border-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          />
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-ember px-4 text-sm font-medium text-white transition-colors hover:bg-ember/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
          >
            Zoeken
          </button>
        </div>
      </form>

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

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}

      {activeFilters.length > 0 && (
        <div
          role="group"
          aria-label="Actieve filters"
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand pt-3"
        >
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => update({ [filter.key]: "" })}
              aria-label={`${filter.label} verwijderen`}
              className="min-h-11 rounded-full bg-cream px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
            >
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto min-h-11 px-2 text-sm font-medium text-ember hover:text-ember/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
          >
            Wis alle filters
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
      aria-pressed={active}
      className={`min-h-11 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 ${
        active ? "bg-ember text-white shadow-sm" : "bg-cream text-ink-soft hover:bg-sand"
      }`}
    >
      {children}
    </button>
  );
}
