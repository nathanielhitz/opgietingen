import type { Metadata } from "next";
import KeystaticApp from "./keystatic";

// Beheerpaneel: geen site-chrome, nooit indexeren (ook in robots.ts uitgesloten).
export const metadata: Metadata = {
  title: "Beheer",
  robots: { index: false, follow: false },
};

export default function KeystaticLayout() {
  return <KeystaticApp />;
}
