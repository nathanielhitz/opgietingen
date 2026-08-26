import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGalleryDlOutput, filterRecentePosts } from "../../src/lib/facebook";

// Verkorte, maar structureel identieke vorm van echte `gallery-dl -j`-output
// (geverifieerd tegen https://www.facebook.com/ThermenBinnenmaas/photos): elke
// post komt twee keer voor (een Directory- en een Url-Message), telkens met de
// post-metadata als LAATSTE array-element.
const VOORBEELD_STDOUT = JSON.stringify([
  [
    2,
    {
      caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
      date: "2026-08-24 08:30:03",
      id: "1365586929090243",
    },
  ],
  [
    3,
    "https://scontent.example/photo1.jpg",
    {
      caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
      date: "2026-08-24 08:30:03",
      id: "1365586929090243",
    },
  ],
  [
    2,
    { caption: "Regenachtige dag? Kom lekker genieten.", date: "2026-06-01 10:00:00", id: "999888777" },
  ],
  [
    3,
    "https://scontent.example/photo2.jpg",
    { caption: "Regenachtige dag? Kom lekker genieten.", date: "2026-06-01 10:00:00", id: "999888777" },
  ],
]);

test("parseGalleryDlOutput dedupliceert dezelfde post op id en behoudt caption + datum", () => {
  const posts = parseGalleryDlOutput(VOORBEELD_STDOUT);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0], {
    caption: "Opgietweekend! Zaterdag 26 en zondag 27 september.",
    datum: "2026-08-24",
  });
  assert.deepEqual(posts[1], { caption: "Regenachtige dag? Kom lekker genieten.", datum: "2026-06-01" });
});

test("parseGalleryDlOutput slaat items zonder caption of zonder id over", () => {
  const stdout = JSON.stringify([
    [2, { date: "2026-08-24 08:30:03", id: "111" }], // geen caption
    [3, "https://scontent.example/x.jpg", { caption: "Tekst zonder id", date: "2026-08-24 08:30:03" }], // geen id
  ]);
  assert.deepEqual(parseGalleryDlOutput(stdout), []);
});

test("parseGalleryDlOutput geeft een lege lijst bij ongeldige JSON", () => {
  assert.deepEqual(parseGalleryDlOutput("dit is geen JSON"), []);
});

test("parseGalleryDlOutput geeft een lege lijst bij een niet-array top-level waarde", () => {
  assert.deepEqual(parseGalleryDlOutput(JSON.stringify({ foo: "bar" })), []);
});

test("filterRecentePosts sluit posts uit die ouder zijn dan de grens; exact op de grens telt nog mee", () => {
  const posts = [
    { caption: "vandaag", datum: "2026-08-26" },
    { caption: "op de grens (1 dag terug)", datum: "2026-08-25" },
    { caption: "te oud (2 dagen terug)", datum: "2026-08-24" },
  ];
  const gefilterd = filterRecentePosts(posts, "2026-08-26", 1);
  assert.deepEqual(
    gefilterd.map((p) => p.caption),
    ["vandaag", "op de grens (1 dag terug)"],
  );
});

test("filterRecentePosts houdt alles binnen een ruime marge", () => {
  const posts = [
    { caption: "recent", datum: "2026-08-01" },
    { caption: "twee maanden terug", datum: "2026-07-01" },
  ];
  assert.equal(filterRecentePosts(posts, "2026-08-26", 60).length, 2);
});
