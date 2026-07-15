import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookiebeleid",
  description: `${site.name} plaatst geen tracking- of marketingcookies. Kort uitgelegd wat we wel en niet gebruiken.`,
  alternates: { canonical: "/cookiebeleid" },
};

export default function CookiebeleidPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Cookiebeleid</h1>
      <p className="mt-3 text-sm text-ink-faint">Laatst bijgewerkt: 13 juli 2026</p>

      <div className="mt-6 space-y-6 leading-relaxed text-ink-soft">
        <p>
          {site.name} gebruikt <strong className="text-ink">geen tracking-, advertentie- of marketingcookies</strong>.
          Daarom zie je op deze site ook geen cookiebanner: er is niets waarvoor we je toestemming hoeven te vragen.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Statistieken zonder cookies</h2>
          <p className="mt-3">
            Voor bezoekcijfers gebruiken we Vercel Web Analytics. Dit werkt <strong className="text-ink">cookieloos</strong>{" "}
            en meet geanonimiseerd: er worden geen cookies op je apparaat geplaatst en geen persoonsgegevens opgeslagen.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Technisch noodzakelijk</h2>
          <p className="mt-3">
            Onze hostingpartner (Vercel) kan strikt noodzakelijke, technische cookies of vergelijkbare gegevens
            gebruiken voor beveiliging en het correct afleveren van de site. Deze volgen je niet en worden niet voor
            marketing gebruikt.
          </p>
        </section>

        <p className="text-sm text-ink-faint">
          Meer over hoe we met gegevens omgaan lees je in ons{" "}
          <Link href="/privacybeleid" className="font-medium text-ember hover:underline">
            privacybeleid
          </Link>
          . Dit beleid kan worden aangepast als de site nieuwe functies krijgt.
        </p>
      </div>
    </div>
  );
}
