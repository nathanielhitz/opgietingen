/*
  Gedeelde netwerk-helpers voor de scraper-pipeline.
  - Nette user-agent met verwijzing naar opgietingen.nl
  - robots.txt ophalen + naleven (per host gecachet)
  - fetch met redirects, timeout en User-Agent
  - 2 sec delay-helper tussen requests
*/

export const USER_AGENT =
  "Opgietingen.nl-bot/1.0 (+https://opgietingen.nl/over; agenda voor opgietingen; contact: info@opgietingen.nl)";

/** Token waarmee wij onszelf in robots.txt herkennen. */
const ROBOT_NAME = "opgietingen.nl-bot";

export const REQUEST_DELAY_MS = 2000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  body: string;
  error?: string;
}

/** Fetch met nette UA, redirects en timeout. Gooit niet: fouten komen in .error. */
export async function fetchUrl(url: string, timeoutMs = 20000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl,nl-NL;q=0.9,en;q=0.8",
      },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      body: "",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- robots.txt ---------- */

interface RobotsRules {
  disallow: string[];
  allow: string[];
  /** true als robots.txt niet bestond/onbereikbaar was → alles toegestaan. */
  permissive: boolean;
}

const robotsCache = new Map<string, RobotsRules>();

/** Parseert de regelblokken die op ons van toepassing zijn (onze naam + '*'). */
function parseRobots(text: string): RobotsRules {
  const disallow: string[] = [];
  const allow: string[] = [];
  const lines = text.split(/\r?\n/);

  let applies = false;
  let sawAnyGroup = false;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      sawAnyGroup = true;
      const ua = value.toLowerCase();
      applies = ua === "*" || ROBOT_NAME.includes(ua) || ua.includes(ROBOT_NAME);
    } else if (applies && field === "disallow") {
      if (value) disallow.push(value);
    } else if (applies && field === "allow") {
      if (value) allow.push(value);
    }
  }

  return { disallow, allow, permissive: !sawAnyGroup };
}

export async function getRobots(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;

  const res = await fetchUrl(`${origin}/robots.txt`, 10000);
  // Geen (bereikbare) robots.txt → conventie: alles toegestaan.
  const rules =
    res.ok && res.body.trim() ? parseRobots(res.body) : { disallow: [], allow: [], permissive: true };
  robotsCache.set(origin, rules);
  return rules;
}

/** Vertaalt een robots-pattern (met '*' wildcard en optioneel '$'-anker) naar regex. */
function ruleMatches(pattern: string, path: string): boolean {
  let p = pattern;
  const anchored = p.endsWith("$");
  if (anchored) p = p.slice(0, -1);
  const body = p
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  try {
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  } catch {
    return false;
  }
}

/** Specificiteit (aantal letterlijke tekens) van de langst-matchende regel, of -1. */
function matchLen(patterns: string[], path: string): number {
  let best = -1;
  for (const pat of patterns) {
    if (ruleMatches(pat, path)) {
      const specificity = pat.replace(/[*$]/g, "").length;
      if (specificity > best) best = specificity;
    }
  }
  return best;
}

/** Longest-match regel volgens de robots-conventie. Allow wint bij gelijke lengte. */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  if (rules.permissive) return true;
  const dis = matchLen(rules.disallow, path);
  if (dis === -1) return true;
  return matchLen(rules.allow, path) >= dis;
}

/** Mag deze URL volgens robots.txt opgehaald worden? */
export async function isAllowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const rules = await getRobots(u.origin);
    return isPathAllowed(rules, u.pathname + u.search);
  } catch {
    return false;
  }
}
