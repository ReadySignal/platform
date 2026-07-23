import { assertInternalRequest } from "@/lib/internalAuth";
import { findCompanyContactsByName } from "@/services/companyResearchByNameService";

export async function POST(request: Request) {
  try {
    assertInternalRequest(request);

    const body = (await request.json()) as {
      companyName?: string;
      companyUrl?: string | null;
      researchContext?: string | null;
    };
    const companyName = body.companyName?.trim();
    if (!companyName) return Response.json({ error: "companyName is required." }, { status: 400 });

    const result = await findCompanyContactsByName(
      companyName,
      body.companyUrl ?? null,
      body.researchContext ?? null,
    );
    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact search failed.";
    return Response.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
