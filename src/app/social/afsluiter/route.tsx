import type { NextRequest } from "next/server";
import { parseFormaat, slideResponse } from "@/lib/social-render";
import { AfsluiterSlide } from "@/lib/social-slides";
import { FORMATEN } from "@/lib/social-stijl";

export async function GET(request: NextRequest) {
  const formaat = parseFormaat(request.nextUrl.searchParams);
  return slideResponse(<AfsluiterSlide formaat={formaat} />, FORMATEN[formaat]);
}
