// @jsxRuntime automatic
// @jsxImportSource react
import type { CSSProperties } from "react";

// Decoratieve stoomlaag voor de homepage-hero: zes wazige wolken die vanaf de
// saunaoven (rechtsonder in beide herofoto's) opstijgen, plus een ademende
// gloed op de stenen. Puur CSS (keyframes in globals.css); de variatie per
// wolk zit in drie custom properties. Bij prefers-reduced-motion verbergt
// globals.css de hele laag.
const WOLKEN: Array<{ duur: string; start: string; drift: string }> = [
  { duur: "11s", start: "0s", drift: "-30%" },
  { duur: "13s", start: "-2.2s", drift: "-42%" },
  { duur: "10s", start: "-4.1s", drift: "-18%" },
  { duur: "12s", start: "-6.3s", drift: "-36%" },
  { duur: "14s", start: "-8.5s", drift: "-26%" },
  { duur: "11.5s", start: "-10.2s", drift: "-48%" },
];

export default function HeroStoom() {
  return (
    <div className="hero-stoom pointer-events-none absolute inset-0" aria-hidden>
      {WOLKEN.map((w) => (
        <span
          key={w.start}
          className="stoom-wolk"
          style={{ "--duur": w.duur, "--start": w.start, "--drift": w.drift } as CSSProperties}
        />
      ))}
      <span className="stoom-gloed" />
    </div>
  );
}
