"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNavigation } from "../../../components/TopNavigation";
import { getCompanyIntelligence } from "../../../services/companyIntelligenceService";
import type { CompanyIntelligence } from "../../../types/CompanyIntelligence";

function formatDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "Unknown";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInteger(value: number | null) {
  return value === null ? "Unknown" : value.toLocaleString();
}

function formatScoreLabel(value: number) {
  if (value >= 75) {
    return "High";
  }

  if (value >= 45) {
    return "Medium";
  }

  return "Low";
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = getParamValue(params.companyId);
  const [companyIntelligence, setCompanyIntelligence] = useState<CompanyIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompany() {
      if (!companyId) {
        setError("Missing company id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getCompanyIntelligence(companyId);
        setCompanyIntelligence(data);
      } catch (loadError) {
        console.error("Failed to load company intelligence:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadCompany();
  }, [companyId]);

  const activeSignalCount = useMemo(
    () => companyIntelligence?.contacts.reduce((total, contact) => total + contact.activeSignals.length, 0) ?? 0,
    [companyIntelligence],
  );
  const outcomeCount = useMemo(
    () => companyIntelligence?.contacts.reduce((total, contact) => total + contact.callOutcomes.length, 0) ?? 0,
    [companyIntelligence],
  );
  const evidenceCount = companyIntelligence?.evidence.length ?? 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />

        <div>
          <Link href="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950">
            Back to queue
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-600 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Loading company intelligence...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Failed to load company intelligence: {error}
          </div>
        ) : companyIntelligence ? (
          <>
            <section className="rounded-2xl border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{companyIntelligence.company.name}</h1>
                    <span
                      className={
                        companyIntelligence.company.is_target_account
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700"
                          : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                      }
                    >
                      {companyIntelligence.company.is_target_account ? "Target Account" : "Not Target"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{companyIntelligence.company.industry}</span>
                    <span>State: {companyIntelligence.company.state}</span>
                    <span>{companyIntelligence.company.employee_count.toLocaleString()} employees</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-lg font-semibold text-slate-950">{companyIntelligence.contacts.length}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Contacts</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-lg font-semibold text-slate-950">{activeSignalCount}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Signals</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-lg font-semibold text-slate-950">{outcomeCount}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Outcomes</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Company Intelligence
                </p>
                <p className="text-sm text-slate-500">Imported company facts available for research and prioritization.</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Industry", companyIntelligence.company.primary_industry || companyIntelligence.company.industry],
                  ["Sub-industry", companyIntelligence.company.sub_industry || "Unknown"],
                  ["Employees", companyIntelligence.company.employee_count.toLocaleString()],
                  ["Revenue", formatMoney(companyIntelligence.company.annual_revenue)],
                  [
                    "HQ",
                    [companyIntelligence.company.hq_city, companyIntelligence.company.hq_state, companyIntelligence.company.hq_country]
                      .filter(Boolean)
                      .join(", ") || "Unknown",
                  ],
                  ["Ownership", companyIntelligence.company.ownership_type || "Unknown"],
                  ["Ticker", companyIntelligence.company.ticker || "Unknown"],
                  ["Locations", formatInteger(companyIntelligence.company.location_count)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Website</p>
                  {companyIntelligence.company.website ? (
                    <a
                      href={companyIntelligence.company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                    >
                      {companyIntelligence.company.website}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-900">Unknown</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">LinkedIn</p>
                  {companyIntelligence.company.linkedin_url ? (
                    <a
                      href={companyIntelligence.company.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                    >
                      {companyIntelligence.company.linkedin_url}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-900">Unknown</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Ranked Contacts
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Contacts ranked by title fit, stored evidence, outreach history, verified contact data, and imported context.
                  </p>
                </div>

                {companyIntelligence.rankedContacts.map((contact) => (
                  <article
                    key={contact.id}
                    className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                          #{contact.companyRank}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{contact.name}</p>
                            {contact.recommended ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                Recommended
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{contact.title}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-700">
                            {formatScoreLabel(contact.overallScore)} confidence - {contact.overallScore}%
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-500 sm:text-right">
                        {contact.email ? <p>{contact.email}</p> : null}
                        {contact.phone ? <p>{contact.phone}</p> : null}
                        {contact.mobile ? <p>{contact.mobile}</p> : null}
                      </div>
                    </div>

                    {contact.companyRank === 1 && companyIntelligence.salesInsight ? (
                      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-700">
                            Call Brief
                          </p>
                        </div>

                        {!companyIntelligence.salesInsight.hasSufficientEvidence ? (
                          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            Stored evidence is insufficient. The guidance below avoids unsupported claims.
                          </p>
                        ) : null}

                        <div className="mt-4 grid gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Why this contact</p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {companyIntelligence.salesInsight.whyThisContact}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-950">Conversation angle</p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {companyIntelligence.salesInsight.conversationAngle}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-950">Discovery Questions</p>
                            <ol className="mt-2 list-decimal space-y-2 pl-5">
                              {companyIntelligence.salesInsight.discoveryQuestions.map((question) => (
                                <li key={question} className="text-sm leading-6 text-slate-700">
                                  {question}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Why This Contact
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{contact.whyThisContact}</p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                          Score Breakdown
                        </p>
                        <div className="mt-2 space-y-2">
                          {[
                            ["Title relevance", contact.scoreBreakdown.titleRelevance],
                            ["Evidence relevance", contact.scoreBreakdown.evidenceRelevance],
                            ["Previous outreach", contact.scoreBreakdown.previousOutreach],
                            ["Verified contact info", contact.scoreBreakdown.verifiedContactInformation],
                            ["Imported context", contact.scoreBreakdown.importedContext],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">{label}</p>
                                <span className="text-xs font-semibold text-slate-500">+{value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                          Outreach Status
                        </p>
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">{contact.previousOutreachStatus}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            {contact.verifiedContact ? "Verified contact information is available." : "Contact information is not verified."}
                          </p>
                          {contact.relevantContext ? (
                            <p className="mt-2 text-sm leading-6 text-slate-600">{contact.relevantContext}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
                <details className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Company Evidence ({evidenceCount})
                  </summary>
                  <div className="mt-3 divide-y divide-slate-200">
                    {companyIntelligence.evidence.length > 0 ? (
                      companyIntelligence.evidence.slice(0, 5).map((evidence) => (
                        <article key={evidence.id} className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">{evidence.headline}</p>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                              {evidence.evidenceType}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                              {evidence.confidence}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {evidence.sourceName} - {formatDate(evidence.publishedAt)}
                          </p>
                          <a
                            href={evidence.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                          >
                            View source
                          </a>
                        </article>
                      ))
                    ) : (
                      <p className="py-3 text-sm text-slate-500">No source-backed evidence has been stored yet.</p>
                    )}
                  </div>
                </details>

                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Activity Timeline</p>
                <div className="mt-4 space-y-3">
                  {companyIntelligence.activityTimeline.length > 0 ? (
                    companyIntelligence.activityTimeline.map((item) => (
                      <div key={item.id} className="border-l-2 border-slate-200 pl-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              item.type === "signal"
                                ? "rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700"
                                : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700"
                            }
                          >
                            {item.type === "signal" ? "Signal" : "Outcome"}
                          </span>
                          <span className="text-xs text-slate-500">{formatDate(item.date)}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{item.contactName}</p>
                        {item.detail ? <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No signals or outcomes yet.</p>
                  )}
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
