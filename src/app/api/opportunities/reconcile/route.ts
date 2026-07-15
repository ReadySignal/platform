import "server-only";

import { reconcileResearchedOpportunities } from "../../../../services/opportunityGenerationService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { auditCompanyNames?: unknown };
    const auditCompanyNames = Array.isArray(body.auditCompanyNames)
      ? body.auditCompanyNames.filter((name): name is string => typeof name === "string")
      : [];
    const result = await reconcileResearchedOpportunities(auditCompanyNames);

    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reconcile researched opportunities.";
    console.error(`[opportunities] Reconciliation failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
