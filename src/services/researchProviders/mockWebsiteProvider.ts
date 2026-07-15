import type { ResearchProvider } from "../../types/research";

export const mockWebsiteProvider: ResearchProvider = {
  id: "mock-website",
  name: "Mock Website Provider",
  async researchCompany() {
    return {
      status: "No Evidence",
      evidence: [],
    };
  },
};
