"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { href: "/agenda", label: "Agenda" },
  { href: "/saunas", label: "Sauna's" },
  { href: "/over", label: "Over" },
  { href: "/voor-saunas", label: "Voor sauna's" },
];

export function SiteHeader() {
  // Op de homepage zweeft de header transparant over de herofoto en krijgt hij
  // pas een achtergrond zodra er gescrold wordt; elders is hij altijd solide.
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);

    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const overlay = isHome && !scrolled;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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

        <nav aria-label="Hoofdnavigatie" className="flex items-center gap-1 text-sm sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`hidden rounded-full px-3 py-1.5 font-medium transition-colors sm:inline-block ${
                isActive(item.href)
                  ? overlay
                    ? "bg-white/15 text-white"
                    : "bg-sand text-ink"
                  : overlay
                  ? "text-cream/90 hover:bg-white/10 hover:text-white"
                  : "text-ink-soft hover:bg-sand hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/agenda"
            aria-current={isActive("/agenda") ? "page" : undefined}
            className="hidden rounded-full bg-ember px-4 py-1.5 font-medium text-white shadow-sm transition-colors hover:bg-ember/90 sm:inline-block"
          >
            Bekijk agenda
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuOpen ? "Menu sluiten" : "Menu openen"}
            aria-controls="mobiele-navigatie"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`grid h-11 w-11 place-items-center rounded-full transition-colors sm:hidden ${
              overlay
                ? "text-white hover:bg-white/10"
                : "text-ink hover:bg-sand"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </nav>
      </div>
      {menuOpen && (
        <nav
          ref={mobileMenuRef}
          id="mobiele-navigatie"
          aria-label="Mobiele navigatie"
          className="border-t border-sand bg-cream px-4 py-3 shadow-lg sm:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`min-h-11 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-ember-tint text-ink"
                    : "text-ink-soft hover:bg-sand hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
