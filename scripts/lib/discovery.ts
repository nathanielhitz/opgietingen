/*
  Agendapagina-discovery-scoring voor verify-bronnen. Losgetrokken uit het
  script zodat de heuristiek unit-testbaar is (het script draait main() bij
  import en is dus niet importeerbaar vanuit tests).
*/

const KEYWORD_SCORE: Array<[RegExp, number]> = [
  [/agenda/i, 50],
  [/aufguss/i, 40],
  [/opgiet/i, 40],
  [/event/i, 20],
  [/programma/i, 20],
];

// Losse artikelen/nieuws/overige pagina's zijn geen agenda-overzicht → uitsluiten.
const DISQUALIFY = /(^|\/)(blog|nieuws|news|artikel|pers|werkenbij|vacature|sponsor|faq|contact|over|arrangement|meeting|zakelijk|vergader|cadeau|webshop)/i;

export interface Scored {
  url: string;
  score: number;
  depth: number;
}

/**
 * Scoort een kandidaat-URL als agendapagina. `huidigeUrl` (de bestaande,
 * gecureerde agendaUrl) krijgt een incumbent-bonus zodat een uitdager de
 * zittende URL overtuigend moet verslaan — dat dempt de wekelijkse churn
 * waarbij campagnepagina's ("valentijn-2026") een werkende agendapagina
 * verdrongen. Paden met een jaartal in het laatste segment krijgen een
 * penalty: agenda-overzichten zijn evergreen, actiepagina's dragen jaartallen.
 */
export function scoreUrl(url: string, matchToken?: string, huidigeUrl?: string): Scored | null {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (DISQUALIFY.test(path)) return null;

  let score = 0;
  for (const [re, pts] of KEYWORD_SCORE) if (re.test(path)) score += pts;
  if (matchToken && path.includes(matchToken.toLowerCase())) score += 100;
  if (score === 0) return null;

  const laatsteSegment = path.split("/").filter(Boolean).pop() ?? "";
  if (/(^|[^0-9])20\d{2}([^0-9]|$)/.test(laatsteSegment)) score -= 40;
  if (huidigeUrl && url === huidigeUrl) score += 30;

  const depth = path.split("/").filter(Boolean).length;
  // Voorkeur voor ondiepe sectiepagina's boven diepe URLs.
  return { url, score: score - Math.max(0, depth - 1) * 10, depth };
}
