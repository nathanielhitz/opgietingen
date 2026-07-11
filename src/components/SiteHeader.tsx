"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/agenda", label: "Agenda" },
  { href: "/saunas", label: "Sauna's" },
  { href: "/over", label: "Over" },
  { href: "/voor-saunas", label: "Voor sauna's" },
];

export function SiteHeader() {
  // Op de homepage zweeft de header transparant over de herofoto en krijgt hij
  // pas een achtergrond zodra er gescrold wordt; elders is hij altijd solide.
  const isHome = usePathname() === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overlay = isHome && !scrolled;

  return (
    <header
      className={`${isHome ? "fixed inset-x-0" : "sticky"} top-0 z-40 border-b transition-colors duration-300 ${
        overlay
          ? "border-transparent bg-transparent"
          : "border-sand/70 bg-cream/85 shadow-sm backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className={`grid h-9 w-9 place-items-center rounded-full text-ember-soft shadow-sm transition-transform group-hover:scale-105 ${
              overlay ? "bg-white/10 ring-1 ring-white/25 backdrop-blur-sm" : "bg-wood-dark"
            }`}
          >
            {/* stoomwolkje-glyph */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M8 3c0 1.5-1.5 2-1.5 3.5S8 8.5 8 10" />
              <path d="M12 2.5c0 1.6-1.6 2.2-1.6 3.8S12 8.6 12 10.3" />
              <path d="M16 3c0 1.5-1.5 2-1.5 3.5S16 8.5 16 10" />
              <path d="M5 14h14a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5Z" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span
            className={`font-display text-lg font-semibold tracking-tight transition-colors ${
              overlay ? "text-white" : "text-ink"
            }`}
          >
            Opgietingen<span className={overlay ? "text-ember-soft" : "text-ember"}>.nl</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`hidden rounded-full px-3 py-1.5 font-medium transition-colors sm:inline-block ${
                overlay
                  ? "text-cream/90 hover:bg-white/10 hover:text-white"
                  : "text-ink-soft hover:bg-sand hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/agenda"
            className="rounded-full bg-ember px-4 py-1.5 font-medium text-white shadow-sm transition-colors hover:bg-ember/90"
          >
            Bekijk agenda
          </Link>
        </nav>
      </div>
    </header>
  );
}
