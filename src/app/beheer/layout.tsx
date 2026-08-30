import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { beheerBeschikbaar } from "@/lib/beheer";

// Beheer-dashboard: geen site-chrome, nooit indexeren (ook in robots.ts uitgesloten);
// in productie alleen beschikbaar als het beheerpaneel dat ook is (GitHub App).
export const metadata: Metadata = {
  title: { absolute: "Beheer" },
  description: null,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function BeheerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!beheerBeschikbaar()) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</div>;
}
