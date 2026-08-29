import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { beheerBeschikbaar } from "@/lib/beheer";
import KeystaticApp from "./keystatic";

// Beheerpaneel: geen site-chrome, nooit indexeren (ook in robots.ts uitgesloten); in productie alleen met GitHub App.
export const metadata: Metadata = {
  title: { absolute: "Beheer" },
  description: null,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function KeystaticLayout() {
  if (!beheerBeschikbaar()) notFound();

  return <KeystaticApp />;
}
