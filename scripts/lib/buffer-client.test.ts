// scripts/lib/buffer-client.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFFER_API_URL, BufferFout, maakBufferClient, type BufferPostInput, type Ophalen } from "./buffer-client";

interface Aanroep { url: string; init: RequestInit; body: { query: string; variables?: Record<string, unknown> } }

/** Mock-fetch die elke aanroep vastlegt en het opgegeven antwoord teruggeeft. */
function mock(antwoord: unknown, status = 200): { ophalen: Ophalen; aanroepen: Aanroep[] } {
  const aanroepen: Aanroep[] = [];
  const ophalen: Ophalen = async (url, init) => {
    aanroepen.push({ url, init, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(antwoord), { status, headers: { "Content-Type": "application/json" } });
  };
  return { ophalen, aanroepen };
}

const input: BufferPostInput = {
  channelId: "ch_fb",
  text: "Tekst",
  assets: [{ image: { url: "https://opgietingen.nl/social/afsluiter?formaat=feed" } }],
  schedulingType: "automatic",
  mode: "customScheduled",
  needsApproval: false,
  dueAt: "2026-10-02T10:00:00.000Z",
};

test("organisaties: POST naar api.buffer.com met Bearer-header en JSON-body", async () => {
  const { ophalen, aanroepen } = mock({ data: { account: { organizations: [{ id: "org1", name: "Opgietingen" }] } } });
  const client = maakBufferClient("sleutel-123", ophalen);
  const orgs = await client.organisaties();
  assert.deepEqual(orgs, [{ id: "org1", name: "Opgietingen" }]);
  assert.equal(aanroepen.length, 1);
  assert.equal(aanroepen[0].url, BUFFER_API_URL);
  assert.equal(aanroepen[0].init.method, "POST");
  const headers = aanroepen[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sleutel-123");
  assert.equal(headers["Content-Type"], "application/json");
  assert.match(aanroepen[0].body.query, /organizations/);
});

test("kanalen: organisatie-id in de query, service en id terug", async () => {
  const { ophalen, aanroepen } = mock({ data: { channels: [{ id: "ch_fb", name: "Opgietingen.nl", service: "facebook" }] } });
  const kanalen = await maakBufferClient("k", ophalen).kanalen("org1");
  assert.deepEqual(kanalen, [{ id: "ch_fb", name: "Opgietingen.nl", service: "facebook" }]);
  assert.match(aanroepen[0].body.query, /organizationId: "org1"/);
});

test("maakPost: input als variabele, id en dueAt terug bij PostActionSuccess", async () => {
  const { ophalen, aanroepen } = mock({ data: { createPost: { post: { id: "post_1", dueAt: "2026-10-02T10:00:00.000Z" } } } });
  const post = await maakBufferClient("k", ophalen).maakPost(input);
  assert.deepEqual(post, { id: "post_1", dueAt: "2026-10-02T10:00:00.000Z" });
  assert.deepEqual(aanroepen[0].body.variables, { input });
  assert.match(aanroepen[0].body.query, /createPost\(input: \$input\)/);
  assert.match(aanroepen[0].body.query, /PostActionSuccess/);
  assert.match(aanroepen[0].body.query, /MutationError/);
});

test("maakPost: MutationError wordt een BufferFout met het bericht", async () => {
  const { ophalen } = mock({ data: { createPost: { message: "Queue limit reached" } } });
  await assert.rejects(maakBufferClient("k", ophalen).maakPost(input), (err: unknown) => {
    assert.ok(err instanceof BufferFout);
    assert.match(err.message, /Queue limit reached/);
    return true;
  });
});

test("HTTP-fout en GraphQL-errors worden een BufferFout met status of bericht", async () => {
  const http = mock({}, 401);
  await assert.rejects(maakBufferClient("k", http.ophalen).organisaties(), /HTTP 401/);
  const graphql = mock({ errors: [{ message: "Cannot query field foo" }] });
  await assert.rejects(maakBufferClient("k", graphql.ophalen).organisaties(), /Cannot query field foo/);
  const leeg = mock({});
  await assert.rejects(maakBufferClient("k", leeg.ophalen).organisaties(), /leeg antwoord/);
});

test("niet-JSON-antwoord wordt een BufferFout", async () => {
  const ophalen: Ophalen = async () => new Response("<html>", { status: 200 });
  await assert.rejects(maakBufferClient("k", ophalen).organisaties(), /geen JSON-antwoord/);
});

test("netwerkfout of timeout wordt een BufferFout met 'onbereikbaar'", async () => {
  const ophalen: Ophalen = async () => {
    throw new Error("fetch failed");
  };
  await assert.rejects(maakBufferClient("k", ophalen).organisaties(), /Buffer onbereikbaar: fetch failed/);
});

test("HTTP-fout met parsebare errors in de body geeft die door in de melding", async () => {
  const { ophalen } = mock({ errors: [{ message: 'Variable "$input" got invalid value' }] }, 400);
  await assert.rejects(maakBufferClient("k", ophalen).organisaties(), /HTTP 400: Variable/);
});
