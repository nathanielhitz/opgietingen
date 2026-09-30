"use client";

import { track } from "@vercel/analytics";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { leesStand, maakSpeler, SFEERGELUID_OPSLAG, type Speler, type Stand } from "@/lib/sfeergeluid";

/*
  Eén speler en één stand voor de hele site (spec 2026-09-30): de knop in de
  header en het eenmalige tipje delen deze context. Leeft in SiteChrome en
  blijft gemonteerd bij client-navigatie, zodat de muziek doorloopt. Bij een
  volledige herlaad met "aan" probeert hij te starten; weigert de browser dat
  (autoplay-beleid), dan start hij bij de eerste tik of toets.
*/

interface Sfeergeluid {
  stand: Stand;
  zetAan(): void;
  zetUit(): void;
}

const Context = createContext<Sfeergeluid | null>(null);

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
    // Privémodus of geblokkeerde opslag: werkt, alleen zonder geheugen.
  }
}

export function SfeergeluidProvider({ children }: Readonly<{ children: React.ReactNode }>) {
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

  const zetAan = useCallback(() => {
    setStand("aan");
    bewaarVoorkeur("aan");
    void speler().aan();
    track("sfeergeluid", { stand: "aan" });
  }, []);

  const zetUit = useCallback(() => {
    setStand("uit");
    bewaarVoorkeur("uit");
    speler().uit();
    track("sfeergeluid", { stand: "uit" });
  }, []);

  return <Context.Provider value={{ stand, zetAan, zetUit }}>{children}</Context.Provider>;
}

/** Buiten de provider (bv. de globale 404 zonder SiteChrome) een veilige no-op. */
export function useSfeergeluid(): Sfeergeluid {
  return useContext(Context) ?? { stand: "uit", zetAan: () => {}, zetUit: () => {} };
}
