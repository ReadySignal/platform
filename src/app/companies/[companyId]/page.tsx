"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopNavigation } from "../../../components/TopNavigation";
import { getCompanyIntelligence } from "../../../services/companyIntelligenceService";
import { promoteSingleResearchedContact } from "../../../services/opportunityGenerationService";
import { createSalesInsight } from "../../../services/salesInsightService";
import type { CompanyIntelligence, RankedCompanyContact } from "../../../types/CompanyIntelligence";

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

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBestContactMethod(contact: RankedCompanyContact) {
  if (contact.mobile) {
    return `Mobile: ${contact.mobile}`;
  }

  if (contact.phone) {
    return `Phone: ${contact.phone}`;
  }

  if (contact.email) {
    return `Email: ${contact.email}`;
  }

  return "No contact method";
}

function hasActiveResearchedOpportunity(contact: RankedCompanyContact) {
  return contact.activeSignals.some((signal) => signal.signalType === "researched-opportunity");
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = getParamValue(params.companyId);
  const [companyIntelligence, setCompanyIntelligence] = useState<CompanyIntelligence | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [addingContactId, setAddingContactId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
        setExpandedContactId(data.rankedContacts[0]?.id ?? null);
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

  async function addContactToToday(contact: RankedCompanyContact) {
    if (!companyIntelligence) {
      return;
    }

    setAddingContactId(contact.id);
    setActionMessage(null);
    setActionError(null);

    try {
      const result = await promoteSingleResearchedContact(Number(companyIntelligence.company.id), contact.id);
      if (result.contactsAdded > 0) {
        setActionMessage(`${contact.name} was added to Today's Opportunities.`);
        setCompanyIntelligence(await getCompanyIntelligence(String(companyIntelligence.company.id)));
      } else {
        setActionError(result.skippedCompanies[0]?.reason || "This contact could not be added.");
      }
    } catch (addError) {
      setActionError(addError instanceof Error ? addError.message : "Failed to add contact to Today.");
    } finally {
      setAddingContactId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />

        <div>
          <Link href="/companies" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950">
            Back to companies
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
                  {[
                    ["Contacts", companyIntelligence.contacts.length],
                    ["Signals", activeSignalCount],
                    ["Outcomes", outcomeCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-lg font-semibold text-slate-950">{value}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Company Intelligence</p>
              <p className="mt-1 text-sm text-slate-500">Imported company facts available for research and prioritization.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Industry", companyIntelligence.company.primary_industry || companyIntelligence.company.industry],
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
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Ranked Contacts</p>
                <p className="text-sm text-slate-500">
                  Contact priority is based on imported contact data and verified company evidence. Individual contact research has not been added yet.
                </p>
              </div>

              {actionMessage ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {actionMessage}
                </p>
              ) : null}
              {actionError ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {actionError}
                </p>
              ) : null}

              <div className="mt-4 divide-y divide-slate-100">
                {companyIntelligence.rankedContacts.map((contact) => {
                  const expanded = expandedContactId === contact.id;
                  const activeOpportunity = hasActiveResearchedOpportunity(contact);
                  const salesInsight = createSalesInsight({
                    company: companyIntelligence.company,
                    rankedContact: contact,
                    evidence: companyIntelligence.evidence,
                  });

                  return (
                    <article key={contact.id} className="py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedContactId((current) => (current === contact.id ? null : contact.id))}
                        className="grid w-full gap-3 text-left md:grid-cols-[48px_1.4fr_1fr_110px_1fr_1fr] md:items-center"
                      >
                        <span className="text-sm font-semibold text-slate-500">#{contact.companyRank}</span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-950">{contact.name}</span>
                          <span className="block text-sm text-slate-500">{contact.location || "Location unknown"}</span>
                        </span>
                        <span className="text-sm text-slate-600">{contact.title}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-700">
                          {contact.overallScore}%
                        </span>
                        <span className="text-sm text-slate-600">{getBestContactMethod(contact)}</span>
                        <span className="text-sm text-slate-600">{contact.previousOutreachStatus}</span>
                      </button>

                      {expanded ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Why this contact</p>
                                <p className="mt-1 text-sm leading-6 text-slate-700">
                                  {salesInsight?.whyThisContact || contact.whyThisContact}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Call Brief</p>
                                <p className="mt-1 text-sm leading-6 text-slate-700">
                                  {salesInsight?.conversationAngle || "No timely evidence-backed conversation angle is available yet."}
                                </p>
                                <ol className="mt-2 list-decimal space-y-1 pl-5">
                                  {(salesInsight?.discoveryQuestions || []).slice(0, 3).map((question) => (
                                    <li key={question} className="text-sm leading-6 text-slate-700">
                                      {question}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {activeOpportunity ? (
                                  <Link
                                    href="/"
                                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                                  >
                                    Start Conversation
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => addContactToToday(contact)}
                                    disabled={addingContactId === contact.id}
                                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                                  >
                                    {addingContactId === contact.id ? "Adding..." : "Add to Today's Opportunities"}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Score Breakdown</p>
                                <div className="mt-2 space-y-1">
                                  {[
                                    ["Title", contact.scoreBreakdown.titleRelevance],
                                    ["Evidence", contact.scoreBreakdown.evidenceRelevance],
                                    ["Outreach", contact.scoreBreakdown.previousOutreach],
                                    ["Contact info", contact.scoreBreakdown.verifiedContactInformation],
                                    ["Context", contact.scoreBreakdown.importedContext],
                                  ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                                      <span className="font-semibold text-slate-700">{label}</span>
                                      <span className="text-slate-500">+{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-950">Contact Methods</p>
                                <p className="mt-2">Email: {contact.email || "Not available"}</p>
                                <p>Phone: {contact.phone || "Not available"}</p>
                                <p>Mobile: {contact.mobile || "Not available"}</p>
                                <p className="mt-3 font-semibold text-slate-950">Previous Outreach</p>
                                <p className="mt-1">{contact.previousOutreachStatus}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <details className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                Company Evidence ({evidenceCount})
              </summary>
              <div className="mt-3 divide-y divide-slate-200">
                {companyIntelligence.evidence.length > 0 ? (
                  companyIntelligence.evidence.map((evidence) => (
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
          </>
        ) : null}
      </div>
    </main>
  );
}
