import type { ResearchProvider } from "../../types/research";
import { mockCareersProvider } from "./mockCareersProvider";
import { mockNewsProvider } from "./mockNewsProvider";
import { mockWebsiteProvider } from "./mockWebsiteProvider";

export const researchProviders: ResearchProvider[] = [
  mockNewsProvider,
  mockWebsiteProvider,
  mockCareersProvider,
];
