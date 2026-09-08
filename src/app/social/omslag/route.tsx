import type { NextRequest } from "next/server";
import { beeldUrlAlsAanwezig, slideResponse } from "@/lib/social-render";
import { OmslagSlide } from "@/lib/social-slides";
import { OMSLAG } from "@/lib/social-stijl";

export async function GET(request: NextRequest) {
  const beeld = await beeldUrlAlsAanwezig(request.nextUrl.origin, "/images/hero/hero-desktop.jpg");
  return slideResponse(<OmslagSlide beeld={beeld} />, OMSLAG);
}
