/*
  Mailbox-fetchlaag voor de event-pipeline — de tegenhanger van de Firecrawl-laag
  in src/lib/scraper.ts, maar dan voor het nieuwsbrief-kanaal (events@opgietingen.nl).
  De ENIGE plek die weet hoe mail uit de inbox komt; de rest van de pipeline
  (extractie, dedup, poort, MDX) blijft bronneutraal. Hoort bij de scripts (kaal
  Node, nooit door de Next-app geïmporteerd), net als net.ts.

  Strategie:
    1. Verbind via IMAP met de gedeelde inbox.
    2. Haal ONGELEZEN berichten op en parse ze naar platte tekst (markdown-achtig).
    3. Markeer verwerkte berichten als gelezen zodat een volgende run ze overslaat.

  Vereist env:
    MAIL_IMAP_HOST      (bv. imap.jouwhost.nl)
    MAIL_IMAP_PORT      (default 993 bij TLS, 143 bij STARTTLS)
    MAIL_IMAP_USER      (volledig e-mailadres, bv. events@opgietingen.nl)
    MAIL_IMAP_PASS      (wachtwoord of app-password)
    MAIL_IMAP_TLS       (default "true"; "false" voor STARTTLS)
    MAIL_IMAP_MAILBOX   (default "INBOX")
*/
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { htmlToText } from "./content";

/** Eén opgehaald nieuwsbrief-bericht, klaar voor extractie. */
export interface MailMessage {
  uid: number;
  from: string; // afzenderadres, lowercase (bv. "agenda@thermenbussloo.nl")
  subject: string;
  markdown: string; // leesbare inhoud (tekstdeel, of HTML → tekst)
}

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  mailbox: string;
}

/** Leest de IMAP-config uit env of gooit een duidelijke fout. */
export function readMailConfig(): MailConfig {
  const host = process.env.MAIL_IMAP_HOST;
  const user = process.env.MAIL_IMAP_USER;
  const pass = process.env.MAIL_IMAP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "IMAP-config ontbreekt — zet MAIL_IMAP_HOST, MAIL_IMAP_USER en MAIL_IMAP_PASS.",
    );
  }
  const secure = process.env.MAIL_IMAP_TLS !== "false";
  return {
    host,
    user,
    pass,
    secure,
    port: Number(process.env.MAIL_IMAP_PORT) || (secure ? 993 : 143),
    mailbox: process.env.MAIL_IMAP_MAILBOX || "INBOX",
  };
}

/** Kiest het beste leesbare deel van een mail en normaliseert naar tekst. */
function bodyToMarkdown(text: string | undefined, html: string | false): string {
  if (text && text.trim()) return text.trim();
  if (html) return htmlToText(html);
  return "";
}

/** Haalt het kale afzenderadres uit een geparseerde from-header. */
function senderAddress(parsedFrom: { value?: { address?: string }[] } | undefined): string {
  return parsedFrom?.value?.[0]?.address?.toLowerCase().trim() ?? "";
}

/**
 * Haalt ongelezen nieuwsbrief-mails op. Markeert ze als gelezen (\Seen) nadat ze
 * zijn opgehaald, tenzij markSeen=false (bv. bij inspectie).
 * Gooit niet per bericht: een onparsebaar bericht wordt overgeslagen.
 */
export async function fetchUnseenMail(
  cfg: MailConfig,
  opts: { limit?: number; markSeen?: boolean } = {},
): Promise<MailMessage[]> {
  const { limit = Infinity, markSeen = true } = opts;
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  const out: MailMessage[] = [];
  await client.connect();
  const lock = await client.getMailboxLock(cfg.mailbox);
  try {
    // Zoek op UID (niet op sequence-nummer) zodat fetch/flag consistent blijven.
    const uids = (await client.search({ seen: false }, { uid: true })) || [];
    const targets = uids.slice(0, limit === Infinity ? uids.length : limit);

    if (targets.length) {
      // De fetch-generator is betrouwbaarder dan fetchOne (die op sommige servers
      // false teruggeeft). source levert het ruwe MIME-bericht voor mailparser.
      for await (const msg of client.fetch(targets, { source: true }, { uid: true })) {
        if (!msg.source) continue;
        try {
          const parsed = await simpleParser(msg.source);
          const markdown = bodyToMarkdown(parsed.text, parsed.html);
          if (!markdown) continue;
          out.push({
            uid: msg.uid,
            from: senderAddress(parsed.from),
            subject: parsed.subject?.trim() ?? "",
            markdown,
          });
        } catch {
          // Onparsebaar bericht — overslaan, niet als gelezen markeren.
          continue;
        }
      }
    }

    if (markSeen && out.length) {
      await client.messageFlagsAdd(
        out.map((m) => m.uid),
        ["\\Seen"],
        { uid: true },
      );
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return out;
}
