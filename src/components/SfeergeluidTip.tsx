"use client";

import { useEffect, useState } from "react";
import { useSfeergeluid } from "@/components/SfeergeluidProvider";
import { SFEERGELUID_TIP_OPSLAG, SFEERGELUID_TIP_VERTRAGING_MS, tipTonen } from "@/lib/sfeergeluid";

/*
  Eenmalig tipje (spec 2026-09-30, variant B: balk aan de onderrand). Verschijnt
  twee seconden na het laden, alleen als het geluid uitstaat en de tip nog nooit
  is getoond; daarna nooit meer (localStorage). "Aan" zet het geluid aan, het
  kruisje sluit. Beide tellen voor de browser als eerste interactie, zodat de
  muziek daarna op elke pagina mag doorlopen. Geen overlay: de inhoud blijft
  zichtbaar; geen animatie (regel: alleen de hero-stoom beweegt).
*/

function tipGezien(): boolean {
  try {
    return window.localStorage.getItem(SFEERGELUID_TIP_OPSLAG) === "gezien";
  } catch {
    return true; // zonder opslag zou de tip elke keer terugkomen: dan liever niet
  }
}

function markeerGezien(): void {
  try {
    window.localStorage.setItem(SFEERGELUID_TIP_OPSLAG, "gezien");
  } catch {
    // zie tipGezien
  }
}

export function SfeergeluidTip() {
  const { stand, zetAan } = useSfeergeluid();
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    if (!tipTonen({ stand, tipGezien: tipGezien() })) return;
    const timer = setTimeout(() => {
      // Nog eens checken: de voorkeur "aan" komt pas in het effect van de provider binnen.
      if (!tipTonen({ stand, tipGezien: tipGezien() })) return;
      markeerGezien();
      setZichtbaar(true);
    }, SFEERGELUID_TIP_VERTRAGING_MS);
    return () => clearTimeout(timer);
  }, [stand]);

  // Zet iemand het geluid via de header aan terwijl de tip staat, dan is de tip klaar.
  useEffect(() => {
    if (stand === "aan") setZichtbaar(false);
  }, [stand]);

  if (!zichtbaar) return null;

  return (
    <div
      role="region"
      aria-label="Tip: sfeergeluid"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 text-cream shadow-[0_-8px_24px_rgba(0,0,0,0.2)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 text-sm sm:px-6">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ember-soft" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
        <p className="flex-1 leading-snug">Zet het sfeergeluid aan voor de sauna-sfeer terwijl je bladert.</p>
        <button
          type="button"
          onClick={zetAan}
          className="shrink-0 rounded-full bg-ember px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-ember/90"
        >
          Aan
        </button>
        <button
          type="button"
          aria-label="Tip sluiten"
          onClick={() => setZichtbaar(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cream/70 transition-colors hover:bg-white/10 hover:text-cream"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
