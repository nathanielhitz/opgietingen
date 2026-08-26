import type { EventFilters } from "@/lib/filters";
import type { Country } from "@/lib/site";

export interface ProvinceOption {
  land: Country;
  provincie: string;
  slug: string;
  count: number;
}

/** Schrijft wijzigingen naar de URL; lege waarde = param verwijderen. */
export type FilterUpdate = (changes: Record<string, string>) => void;

export interface FilterPanelProps {
  filters: EventFilters;
  provinces: ProvinceOption[];
  update: FilterUpdate;
  /** ISO-datum van vandaag (client-side gezet na mount; "" tijdens SSR). */
  vandaag: string;
}

export const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-lg border border-sand bg-cream px-3 py-2 text-sm text-ink focus-visible:border-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40";
