"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventFilters } from "@/lib/filters";
import { EVENT_TYPES, COUNTRY_LABELS, type Country, type EventType } from "@/lib/site";
import { todayISO } from "@/lib/dates";
import { labelVoorDatumbereik } from "@/lib/filter-presets";
import { DesktopFilterPanel } from "./agenda-filters/DesktopFilterPanel";
import { FilterSheet } from "./agenda-filters/FilterSheet";
import { MobileFilterButton } from "./agenda-filters/MobileFilterBar";
import type { ProvinceOption } from "./agenda-filters/types";

export type { ProvinceOption } from "./agenda-filters/types";

export function AgendaFilters({
  provinces,
  filters,
  error,
  resultaatAantal,
}: {
  provinces: ProvinceOption[];
  filters: EventFilters;
  error: string | null;
  /** Aantal events na filtering (voor "Toon N events" in de sheet). */
  resultaatAantal: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = filters.q ?? "";
  const land = filters.land ?? "";
  const provincie = filters.provincie ?? "";
  const type = filters.type ?? "";
  const van = filters.van ?? "";
  const tot = filters.tot ?? "";
  const paramsKey = params.toString();
  const [searchValue, setSearchValue] = useState(q);
  const latestParamsRef = useRef(new URLSearchParams(paramsKey));
  const requestedParamsRef = useRef(new Set<string>());
  const pendingParamsRef = useRef<string | null>(null);
  const draftRevisionRef = useRef(0);
  const submittedSearchRef = useRef<{ value: string; revision: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // "Vandaag" pas na mount zetten: server en client zouden anders kunnen verschillen.
  const [vandaag, setVandaag] = useState("");
  useEffect(() => {
    setVandaag(todayISO());
  }, []);

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

  const datumLabel = van || tot ? labelVoorDatumbereik(van, tot, vandaag) : null;
  const activeFilters = [
    q.trim() ? { key: "q", label: `Zoeken: “${q.trim()}”` } : null,
    land ? { key: "land", label: COUNTRY_LABELS[land as Country] ?? land } : null,
    provincie
      ? { key: "provincie", label: provinces.find((p) => p.slug === provincie)?.provincie ?? provincie }
      : null,
    type ? { key: "type", label: EVENT_TYPES[type as EventType] ?? type } : null,
    datumLabel ? { key: "datum", label: datumLabel } : null,
  ].filter((filter): filter is { key: string; label: string } => filter !== null);
  const filterTeller = activeFilters.filter((f) => f.key !== "q").length;

  function verwijderFilter(key: string) {
    update(key === "datum" ? { van: "", tot: "" } : { [key]: "" });
  }

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
            aria-label="Zoeken"
            className="flex min-h-11 items-center rounded-lg bg-ember px-3 text-sm font-medium text-white transition-colors hover:bg-ember/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 sm:px-4"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 17 17" />
            </svg>
            <span className="hidden sm:inline">Zoeken</span>
          </button>
          <div className="sm:hidden">
            <MobileFilterButton aantal={filterTeller} onClick={() => setSheetOpen(true)} />
          </div>
        </div>
      </form>

      {/* Volledig paneel vanaf sm; op mobiel zit alles in de sheet. */}
      <div className="hidden sm:block">
        <DesktopFilterPanel filters={filters} provinces={provinces} update={update} vandaag={vandaag} />
      </div>
      <div className="sm:hidden">
        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          resultaatAantal={resultaatAantal}
          resetFilters={resetFilters}
          filters={filters}
          provinces={provinces}
          update={update}
          vandaag={vandaag}
        />
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
              onClick={() => verwijderFilter(filter.key)}
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

