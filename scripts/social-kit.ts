/*
  Social-kit: haalt de weekplanning en alle slides van de site en zet ze klaar
  om in Buffer in te plannen (spec §6).

    npm run social-kit                                  # vandaag, van opgietingen.nl
    npm run social-kit -- --datum 2026-09-18            # andere referentiedatum
    npm run social-kit -- --basis http://localhost:3000 # lokale dev-server
    npm run social-kit -- --formaat feed                # feed | story | beide (default)
    npm run social-kit -- --map data/social             # doelmap (default)

  Uitvoer: data/social/<datum>/<post-id>/NN-<rol>[-<slug>]-<formaat>.png + captions.md
*/
import path from "node:path";
import { todayISOInTimeZone } from "../src/lib/dates";
import type { Formaat } from "../src/lib/social";
import type { PlanningJson } from "../src/lib/social-planning";
import { downloadPost } from "./lib/social-kit";

function flag(naam: string, standaard: string): string {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const DATUM = flag("--datum", todayISOInTimeZone());
const BASIS = flag("--basis", "https://opgietingen.nl").replace(/\/$/, "");
const FORMAAT = flag("--formaat", "beide");
const MAP = flag("--map", "data/social");

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  if (!["beide", "feed", "story"].includes(FORMAAT)) throw new Error(`Ongeldig --formaat: ${FORMAAT} (feed | story | beide)`);
  const formaten: Formaat[] = FORMAAT === "beide" ? ["feed", "story"] : [FORMAAT as Formaat];

  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
  const planning = (await res.json()) as PlanningJson;

  if (planning.posts.length === 0) {
    console.log(`Geen posts voor ${DATUM}: de agenda is leeg voor deze week.`);
    return;
  }

  console.log(`Social-kit voor ${DATUM} (${planning.posts.length} posts) → ${MAP}/${DATUM}/\n`);
  for (const post of planning.posts) {
    const map = path.join(process.cwd(), MAP, DATUM, post.id);
    await downloadPost(post, map, formaten);
    const kandidaat = post.rang > 1 ? ` (kandidaat ${post.rang})` : "";
    console.log(
      `${post.plaatsingsdag}  ${post.rubriek.padEnd(10)} ${String(post.slides.length).padStart(2)} slides  ${String(post.events.length).padStart(2)} events  ${post.titel}${kandidaat}`,
    );
  }
  console.log("\nKlaar. Sleep de PNG's in Buffer en plak de caption uit captions.md.");
}

main().catch((err) => {
  console.error(`social-kit: ${(err as Error).message}`);
  process.exit(1);
});
