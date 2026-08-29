import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../../keystatic.config";
import { beheerBeschikbaar } from "@/lib/beheer";

// In productie zonder GitHub App bestaat deze route niet (zie src/lib/beheer.ts).
const nietGevonden = async () => new Response("Not Found", { status: 404 });
const handlers = beheerBeschikbaar() ? makeRouteHandler({ config }) : null;

export const GET = handlers?.GET ?? nietGevonden;
export const POST = handlers?.POST ?? nietGevonden;
