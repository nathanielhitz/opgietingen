"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_TYPES, COUNTRY_LABELS, type Country, type EventType } from "@/lib/site";
import {
  PERIODE_KEUZES,
  PERIODE_LABELS,
  keuzeVoorPeriode,
  parseWaar,
  periodeVoorKeuze,
  waarValue,
  type PeriodeKeuze,
} from "@/lib/filter-presets";
import { DateInput } from "./DateInput";
import { INPUT_CLASS, type FilterPanelProps } from "./types";

/**
 * Bottom-sheet met drie rustige selects (Waar / Type / Periode) voor mobiel.
 * Elke wijziging schrijft direct naar de URL; "Toon N events" sluit alleen.
 */
export function FilterSheet({
  open,
  onClose,
  resultaatAantal,
  resetFilters,
  filters,
  provinces,
  update,
  vandaag,
}: FilterPanelProps & {
  open: boolean;
  onClose: () => void;
  resultaatAantal: number;
  resetFilters: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [datumsOpen, setDatumsOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const land = filters.land ?? "";
  const provincie = filters.provincie ?? "";
  const type = filters.type ?? "";
  const van = filters.van ?? "";
  const tot = filters.tot ?? "";

  const keuzeUitUrl = keuzeVoorPeriode(van, tot, vandaag);
  const keuze: PeriodeKeuze = keuzeUitUrl === "alles" && datumsOpen ? "custom" : keuzeUitUrl;
  const toonDatums = keuze === "custom";

  function kiesPeriode(nieuw: PeriodeKeuze) {
    if (nieuw === "custom") {
      setDatumsOpen(true);
      return;
    }
    setDatumsOpen(false);
    const p = periodeVoorKeuze(nieuw, vandaag);
    update(p ? { van: p.van, tot: p.tot } : { van: "", tot: "" });
  }

  function kiesWaar(value: string) {
    const parsed = parseWaar(value);
    update({ land: parsed.land, provincie: parsed.provincie });
  }

  const knopLabel =
    resultaatAantal === 0
      ? "Geen events – pas filters aan"
      : `Toon ${resultaatAantal} ${resultaatAantal === 1 ? "event" : "events"}`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // klik op de backdrop
      }}
      aria-label="Filters"
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="px-4 pb-6 pt-3">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-sand" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() => {
              setDatumsOpen(false);
              resetFilters();
            }}
            className="min-h-11 px-2 text-sm font-medium text-ember hover:text-ember/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2"
          >
            Wissen
          </button>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Waar</span>
          <select value={waarValue(land, provincie)} onChange={(e) => kiesWaar(e.target.value)} className={INPUT_CLASS}>
            <option value="">Overal</option>
            {(["NL", "BE"] as Country[]).map((c) => (
              <optgroup key={c} label={COUNTRY_LABELS[c]}>
                <option value={c}>{COUNTRY_LABELS[c]} – alle provincies</option>
                {provinces
                  .filter((p) => p.land === c)
                  .map((p) => (
                    <option key={p.slug} value={waarValue(c, p.slug)}>
                      {p.provincie} ({p.count})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Type</span>
          <select value={type} onChange={(e) => update({ type: e.target.value })} className={INPUT_CLASS}>
            <option value="">Alle types</option>
            {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPES[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-faint">Periode</span>
          <select value={keuze} onChange={(e) => kiesPeriode(e.target.value as PeriodeKeuze)} className={INPUT_CLASS}>
            {PERIODE_KEUZES.map((k) => (
              <option key={k} value={k}>
                {PERIODE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        {toonDatums && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <DateInput label="Vanaf" value={van} onChange={(v) => update({ van: v })} />
            <DateInput label="Tot en met" value={tot} onChange={(v) => update({ tot: v })} />
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 min-h-12 w-full rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 ${
            resultaatAantal === 0 ? "bg-sand text-ink-soft" : "bg-ember text-white hover:bg-ember/90"
          }`}
        >
          {knopLabel}
        </button>
      </div>
    </dialog>
  );
}
