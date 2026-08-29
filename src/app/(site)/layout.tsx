import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteChrome } from "@/components/SiteChrome";

// Analytics en Speed Insights staan hier en niet in de root-layout, zodat het
// beheerpaneel (/keystatic) geen pageviews en CWV-metingen bijdraagt.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteChrome>{children}</SiteChrome>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
