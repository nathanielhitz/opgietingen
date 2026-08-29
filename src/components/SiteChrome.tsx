import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/*
  De publieke "chrome" van de site: skip-link, header, main en footer.
  Wordt gebruikt door de (site)-layout én door de globale 404 (die buiten de
  route group valt). Het beheerpaneel (/keystatic) gebruikt dit bewust niet.
  De sticky-footer-container (min-h-dvh flex flex-col) staat hier en niet op <body>, zodat /keystatic die niet erft.
*/
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#hoofdinhoud" className="skip-link">
        Ga naar de hoofdinhoud
      </a>
      <SiteHeader />
      <main id="hoofdinhoud" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
