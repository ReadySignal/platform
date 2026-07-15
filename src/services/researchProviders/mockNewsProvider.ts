import type { ResearchProvider } from "../../types/research";

export const mockNewsProvider: ResearchProvider = {
  id: "mock-news",
  name: "Mock News Provider",
  async researchCompany(company) {
    return {
      status: "Completed",
      evidence: [
        {
          companyId: company.id,
          evidenceType: "relevant industry news",
          headline: `${company.name} mentioned in mock industry coverage`,
          summary:
            "Controlled demo evidence showing how a reputable news result would be stored before signal interpretation.",
          sourceName: "ReadySignal Mock News",
          sourceUrl: `https://demo.readysignal.local/research/news/${company.id}`,
          publishedAt: new Date().toISOString(),
          confidence: "Medium",
        },
      ],
    };
  },
};
