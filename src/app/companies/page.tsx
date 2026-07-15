"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import { getCompanyDirectory, type CompanyDirectoryItem, type CompanyDirectorySort } from "../../services/companyDirectoryService";

const sortOptions: Array<{ value: CompanyDirectorySort; label: string }> = [
  { value: "recently-researched", label: "Recently researched" },
  { value: "strongest-evidence", label: "Strongest evidence" },
  { value: "most-contacts", label: "Most contacts" },
  { value: "company-name", label: "Company name" },
];

function statusClass(status: string) {
  if (status === "Complete") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Researching") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "Failed") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyDirectoryItem[]>([]);
  const [sort, setSort] = useState<CompanyDirectorySort>("recently-researched");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      setIsLoading(true);
      setError(null);

      try {
        setCompanies(await getCompanyDirectory(sort));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load companies.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanies();
  }, [sort]);

  const filteredCompanies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return companies;
    }

    return companies.filter((company) =>
      [company.name, company.industry, company.state, company.hq, company.researchStatus]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [companies, query]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />
        <PageHeader
          eyebrow="Accounts"
          title="Companies"
          supportingText="Find a researched account quickly without leaving the workflow."
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search companies..."
              className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 md:w-80"
            />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as CompanyDirectorySort)}
              className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading companies...</p>
          ) : error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : filteredCompanies.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No companies match that search.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Industry</th>
                    <th className="px-3 py-2">State/HQ</th>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="px-3 py-2">Contacts</th>
                    <th className="px-3 py-2">Research</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((company) => (
                    <tr key={company.id}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                        <Link
                          href={`/companies/${company.id}`}
                          className="underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 hover:decoration-slate-500"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{company.industry}</td>
                      <td className="px-3 py-2 text-slate-600">{company.hq}</td>
                      <td className="px-3 py-2 text-slate-600">{company.activeEvidenceCount}</td>
                      <td className="px-3 py-2 text-slate-600">{company.contactCount}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(company.researchStatus)}`}>
                          {company.researchStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
