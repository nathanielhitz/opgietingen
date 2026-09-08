import { slideResponse } from "@/lib/social-render";
import { ProfielSlide } from "@/lib/social-slides";
import { PROFIEL } from "@/lib/social-stijl";

export async function GET() {
  return slideResponse(<ProfielSlide />, PROFIEL);
}
