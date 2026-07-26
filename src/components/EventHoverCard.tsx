"use client";

/*
  Hovercard-gedrag voor event-previews (desktop-only). De inhoud (`kaart`)
  wordt server-side meegerenderd en hier alleen getoond/gepositioneerd:
  - hover-intent van 200 ms zodat er niets flikkert bij het scannen;
  - alleen op apparaten met een muis (pointer: fine) — op touch verandert
    er niets aan het tapgedrag;
  - positie: rechts van de trigger, klapt naar links bij de viewport-rand,
    verticaal geklemd binnen het scherm;
  - toetsenbord: focus toont de kaart, Escape en blur sluiten;
  - de kaart zelf vangt geen muis (pointer-events: none), klikken gaat
    gewoon naar de onderliggende link.
*/

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const TOON_VERTRAGING_MS = 200;
const MARGE = 8;

export function EventHoverCard({
  kaart,
  children,
  className = "",
}: {
  kaart: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const kaartRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [positie, setPositie] = useState<CSSProperties | null>(null);

  const toon = (direct = false) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    window.clearTimeout(timer.current);
    if (direct) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), TOON_VERTRAGING_MS);
  };

  const verberg = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPositie(null);
  };

  // Positioneren zodra de kaart gerenderd is (eerst onzichtbaar gemeten).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !kaartRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const kw = kaartRef.current.offsetWidth;
    const kh = kaartRef.current.offsetHeight;

    let links = t.right + MARGE;
    if (links + kw > window.innerWidth - MARGE) links = t.left - kw - MARGE;
    if (links < MARGE) links = Math.min(Math.max(MARGE, t.left), window.innerWidth - kw - MARGE);

    let boven = Math.min(t.top, window.innerHeight - kh - MARGE);
    if (boven < MARGE) boven = MARGE;

    setPositie({ left: links, top: boven });
  }, [open]);

  // Escape sluit; scrollen ook (de kaart staat position:fixed en zou anders
  // van zijn anker los scrollen).
  useEffect(() => {
    if (!open) return;
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") verberg();
    };
    window.addEventListener("keydown", opToets);
    window.addEventListener("scroll", verberg, true);
    return () => {
      window.removeEventListener("keydown", opToets);
      window.removeEventListener("scroll", verberg, true);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      ref={triggerRef}
      className={className}
      onMouseEnter={() => toon()}
      onMouseLeave={verberg}
      onFocus={() => toon(true)}
      onBlur={verberg}
    >
      {children}
      {open && (
        <div
          ref={kaartRef}
          role="tooltip"
          className="pointer-events-none"
          style={{ position: "fixed", zIndex: 60, ...(positie ?? { left: 0, top: 0, visibility: "hidden" }) }}
        >
          {kaart}
        </div>
      )}
    </div>
  );
}
