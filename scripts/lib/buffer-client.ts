// scripts/lib/buffer-client.ts
/*
  Dunne GraphQL-client voor de Buffer-API (spec §3). Alleen wat de adapter
  nodig heeft: organisaties, kanalen, post aanmaken. fetch is injecteerbaar
  zodat tests niets op het netwerk doen. Bron: https://developers.buffer.com
*/

export const BUFFER_API_URL = "https://api.buffer.com";

export type Ophalen = (url: string, init: RequestInit) => Promise<Response>;

export interface BufferOrganisatie {
  id: string;
  name: string;
}

export interface BufferKanaal {
  id: string;
  name: string;
  /** Netwerknaam zoals Buffer die geeft: facebook, instagram, tiktok, … */
  service: string;
}

export interface BufferAsset {
  image: { url: string };
}

/** Subset van CreatePostInput die wij gebruiken. Enum-waarden gaan als string mee in de variabelen. */
export interface BufferPostInput {
  channelId: string;
  text: string;
  /** Geordend; elke url publiek, direct en https. */
  assets: BufferAsset[];
  schedulingType: "automatic";
  mode: "customScheduled" | "addToQueue";
  needsApproval: false;
  /** UTC-ISO; alleen bij customScheduled. */
  dueAt?: string;
  /** Concept in Buffer; publiceert niet en telt niet mee voor de wachtrijlimiet. */
  saveToDraft?: boolean;
  metadata?: {
    instagram?: { type: string; shouldShareToFeed: boolean };
    tiktok?: { title: string; type: string };
  };
}

export interface BufferPost {
  id: string;
  dueAt: string | null;
}

export class BufferFout extends Error {}

const Q_ORGANISATIES = `query Organisaties { account { organizations { id name } } }`;

const M_MAAK_POST = `mutation MaakPost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

/** Default fetch mét timeout: een hangende API mag de run niet blokkeren. */
const ophalenMetTimeout: Ophalen = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

export function maakBufferClient(sleutel: string, ophalen: Ophalen = ophalenMetTimeout) {
  async function vraag<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await ophalen(BUFFER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sleutel}` },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });
    if (!res.ok) throw new BufferFout(`Buffer HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new BufferFout(`Buffer GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    if (!json.data) throw new BufferFout("Buffer: leeg antwoord");
    return json.data;
  }

  return {
    async organisaties(): Promise<BufferOrganisatie[]> {
      const d = await vraag<{ account: { organizations: BufferOrganisatie[] } }>(Q_ORGANISATIES);
      return d.account.organizations;
    },
    async kanalen(organizationId: string): Promise<BufferKanaal[]> {
      // Id inline (JSON-gequote string) in plaats van als variabele: de exacte
      // scalar-naam van het input-type staat niet in de docs.
      const query = `query Kanalen { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name service } }`;
      const d = await vraag<{ channels: BufferKanaal[] }>(query);
      return d.channels;
    },
    async maakPost(input: BufferPostInput): Promise<BufferPost> {
      const d = await vraag<{ createPost: { post?: BufferPost; message?: string } }>(M_MAAK_POST, { input });
      if (d.createPost.post) return d.createPost.post;
      throw new BufferFout(`Buffer weigert de post: ${d.createPost.message ?? "onbekende fout"}`);
    },
  };
}

export type BufferClient = ReturnType<typeof maakBufferClient>;
