import { assertInternalRequest } from "@/lib/internalAuth";
import { validateCompanyContactsByName, type CompanyResearchCandidate } from "@/services/companyResearchByNameService";

export async function POST(request: Request) {
  try {
    assertInternalRequest(request);
    const body = (await request.json()) as {
      companyName?: string;
      companyUrl?: string | null;
      researchContext?: string | null;
      candidates?: CompanyResearchCandidate[];
    };
    const companyName = body.companyName?.trim();
    if (!companyName) return Response.json({ error: "companyName is required." }, { status: 400 });
    if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
      return Response.json({ error: "At least one contact candidate is required." }, { status: 400 });
    }
    const result = await validateCompanyContactsByName(
      companyName,
      body.candidates,
      body.companyUrl ?? null,
      body.researchContext ?? null,
    );
    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact validation failed.";
    return Response.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
