import { assertInternalRequest } from "@/lib/internalAuth";
import { researchCompanyByName } from "@/services/companyResearchByNameService";

export async function POST(request: Request) {
  try {
    assertInternalRequest(request);

    const body = (await request.json()) as { companyName?: string; companyUrl?: string | null };
    const companyName = body.companyName?.trim();

    if (!companyName) {
      return Response.json({ error: "companyName is required." }, { status: 400 });
    }

    const result = await researchCompanyByName(companyName, body.companyUrl ?? null);

    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed.";
    const status = message === "Unauthorized." ? 401 : message.includes("token is not configured") ? 500 : 500;

    return Response.json({ error: message }, { status });
  }
}
