import { supabase } from "../supabase";
import type { Company } from "../../types/Company";

export async function getCompanies(): Promise<Company[]> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return (data as Company[]) || [];
  } catch (error) {
    console.error("getCompanies error:", error);
    throw error;
  }
}
