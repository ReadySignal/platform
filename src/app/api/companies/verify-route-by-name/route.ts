import { assertInternalRequest } from "@/lib/internalAuth";
import { verifyContactRouteWaterfall } from "@/services/contactRouteWaterfallService";
import type { CompanyResearchCandidate } from "@/services/companyResearchByNameService";

export async function POST(request: Request) {
  try {
    assertInternalRequest(request);
    const body = (await request.json()) as {
      companyName?: string;
      companyUrl?: string | null;
      candidate?: CompanyResearchCandidate;
    };

    const companyName = body.companyName?.trim();
    if (!companyName) return Response.json({ error: "companyName is required." }, { status: 400 });
    if (!body.candidate?.fullName?.trim() || !body.candidate.currentTitle?.trim()) {
      return Response.json({ error: "A named contact candidate is required." }, { status: 400 });
    }

    const result = await verifyContactRouteWaterfall({
      companyName,
      companyUrl: body.companyUrl ?? null,
      candidate: body.candidate,
    });
    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route verification failed.";
    return Response.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
