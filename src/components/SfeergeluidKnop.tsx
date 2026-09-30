"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef, useState } from "react";
import { leesStand, maakSpeler, SFEERGELUID_OPSLAG, wissel, type Speler, type Stand } from "@/lib/sfeergeluid";

/*
  Aan/uit-knop voor het sfeergeluid in de header (spec 2026-09-30). Standaard
  uit; de keuze staat in localStorage. Leeft in SiteHeader en blijft dus
  gemonteerd bij client-navigatie, zodat de muziek doorloopt. Bij een
  volledige herlaad met "aan" probeert hij te starten; weigert de browser dat
  (autoplay-beleid), dan start hij bij de eerste tik of toets. Geen animatie:
  twee statische iconen.
*/

function leesVoorkeur(): Stand {
  try {
    return leesStand(window.localStorage.getItem(SFEERGELUID_OPSLAG));
  } catch {
    return "uit";
  }
}

function bewaarVoorkeur(stand: Stand): void {
  try {
    window.localStorage.setItem(SFEERGELUID_OPSLAG, stand);
  } catch {
    // Privémodus of geblokkeerde opslag: de knop werkt, alleen zonder geheugen.
  }
}

export function SfeergeluidKnop({ overlay }: { overlay: boolean }) {
  // Server en eerste client-render zijn altijd "uit"; de voorkeur komt in het effect (geen hydration-verschil).
  const [stand, setStand] = useState<Stand>("uit");
  const spelerRef = useRef<Speler | null>(null);
  const speler = () => (spelerRef.current ??= maakSpeler());

  useEffect(() => {
    if (leesVoorkeur() !== "aan") return;
    setStand("aan");
    let opgeruimd = false;
    const startBijInteractie = () => {
      void speler().aan();
      verwijder();
    };
    const verwijder = () => {
      document.removeEventListener("pointerdown", startBijInteractie);
      document.removeEventListener("keydown", startBijInteractie);
    };
    void speler()
      .aan()
      .then((gestart) => {
        if (gestart || opgeruimd) return;
        // Geblokkeerd door het autoplay-beleid: bij de eerste interactie alsnog starten.
        document.addEventListener("pointerdown", startBijInteractie, { once: true });
        document.addEventListener("keydown", startBijInteractie, { once: true });
      });
    return () => {
      opgeruimd = true;
      verwijder();
    };
  }, []);

  const klik = () => {
    const nieuw = wissel(stand);
    setStand(nieuw);
    bewaarVoorkeur(nieuw);
    if (nieuw === "aan") void speler().aan();
    else speler().uit();
    track("sfeergeluid", { stand: nieuw });
  };

  const aan = stand === "aan";
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={aan ? "Sfeergeluid uit" : "Sfeergeluid aan"}
      title={aan ? "Sfeergeluid uit" : "Sfeergeluid aan"}
      onClick={klik}
      className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${
        overlay ? "text-white hover:bg-white/10" : "text-ink hover:bg-sand"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {aan ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m22 9-6 6M16 9l6 6" />
        )}
      </svg>
    </button>
  );
}
