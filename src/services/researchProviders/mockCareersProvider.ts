import type { ResearchProvider } from "../../types/research";

export const mockCareersProvider: ResearchProvider = {
  id: "mock-careers",
  name: "Mock Careers Provider",
  async researchCompany() {
    return {
      status: "Failed",
      evidence: [],
      errorMessage: "Mock careers provider failed intentionally for orchestration testing.",
    };
  },
};
