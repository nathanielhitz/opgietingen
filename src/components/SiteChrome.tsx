import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/*
  De publieke "chrome" van de site: skip-link, header, main en footer.
  Wordt gebruikt door de (site)-layout én door de globale 404 (die buiten de
  route group valt). Het beheerpaneel (/keystatic) gebruikt dit bewust niet.
*/
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#hoofdinhoud" className="skip-link">
        Ga naar de hoofdinhoud
      </a>
      <SiteHeader />
      <main id="hoofdinhoud" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
