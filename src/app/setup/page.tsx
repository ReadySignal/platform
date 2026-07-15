"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import {
  createBusinessProfile,
  getActiveBusinessProfile,
  updateBusinessProfile,
} from "../../services/businessProfileService";
import type { BusinessProfile, BusinessProfileInput, TerritoryRules } from "../../types/BusinessProfile";

const emptyTerritoryRules: TerritoryRules = {
  namedStatesOrRegions: [],
  namedAccountsToInclude: [],
  namedAccountsToExclude: [],
  employeeLimitNotes: "",
  revenueLimitNotes: "",
};

const emptyProfile: BusinessProfileInput = {
  profileName: "Default Profile",
  companyName: "",
  productName: "",
  productDescription: "",
  valuePropositions: [],
  customerProblems: [],
  targetIndustries: [],
  targetSubIndustries: [],
  employeeMin: null,
  employeeMax: null,
  revenueMin: null,
  revenueMax: null,
  targetGeographies: [],
  ownershipPreferences: [],
  excludedIndustries: [],
  excludedCompanyTypes: [],
  priorityTitles: [],
  secondaryTitles: [],
  relevantDepartments: [],
  managementLevels: [],
  excludedTitles: [],
  highPrioritySignals: [],
  mediumPrioritySignals: [],
  lowPrioritySignals: [],
  ignoredSignals: [],
  signalRecencyDays: 90,
  callObjective: "",
  meetingOutcome: "",
  commonObjections: [],
  approvedThemes: [],
  territoryRules: emptyTerritoryRules,
  sourceRestrictions: [],
  historicalSuccessNotes: "",
  profileVersion: 1,
  lastUserConfirmedAt: null,
  learningEnabled: false,
  minimumOutcomesBeforeRecommendations: 25,
  learnedRecommendations: {},
  isActive: true,
};

function profileToInput(profile: BusinessProfile): BusinessProfileInput {
  return {
    profileName: profile.profileName,
    companyName: profile.companyName,
    productName: profile.productName,
    productDescription: profile.productDescription,
    valuePropositions: profile.valuePropositions,
    customerProblems: profile.customerProblems,
    targetIndustries: profile.targetIndustries,
    targetSubIndustries: profile.targetSubIndustries,
    employeeMin: profile.employeeMin,
    employeeMax: profile.employeeMax,
    revenueMin: profile.revenueMin,
    revenueMax: profile.revenueMax,
    targetGeographies: profile.targetGeographies,
    ownershipPreferences: profile.ownershipPreferences,
    excludedIndustries: profile.excludedIndustries,
    excludedCompanyTypes: profile.excludedCompanyTypes,
    priorityTitles: profile.priorityTitles,
    secondaryTitles: profile.secondaryTitles,
    relevantDepartments: profile.relevantDepartments,
    managementLevels: profile.managementLevels,
    excludedTitles: profile.excludedTitles,
    highPrioritySignals: profile.highPrioritySignals,
    mediumPrioritySignals: profile.mediumPrioritySignals,
    lowPrioritySignals: profile.lowPrioritySignals,
    ignoredSignals: profile.ignoredSignals,
    signalRecencyDays: profile.signalRecencyDays,
    callObjective: profile.callObjective,
    meetingOutcome: profile.meetingOutcome,
    commonObjections: profile.commonObjections,
    approvedThemes: profile.approvedThemes,
    territoryRules: profile.territoryRules,
    sourceRestrictions: profile.sourceRestrictions,
    historicalSuccessNotes: profile.historicalSuccessNotes,
    profileVersion: profile.profileVersion,
    lastUserConfirmedAt: profile.lastUserConfirmedAt,
    learningEnabled: profile.learningEnabled,
    minimumOutcomesBeforeRecommendations: profile.minimumOutcomesBeforeRecommendations,
    learnedRecommendations: profile.learnedRecommendations,
    isActive: profile.isActive,
  };
}

function parseNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRange(min: number | null, max: number | null, suffix = "") {
  if (min && max) {
    return `${min.toLocaleString()}-${max.toLocaleString()}${suffix}`;
  }

  if (min) {
    return `${min.toLocaleString()}+${suffix}`;
  }

  if (max) {
    return `up to ${max.toLocaleString()}${suffix}`;
  }

  return "";
}

function TagInput({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }

    onChange([...values, value]);
    setDraft("");
  }

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
        />
        <button
          type="button"
          onClick={addValue}
          className="rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Add
        </button>
      </div>
      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              {value} x
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function RequiredArea({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 grid gap-4">{children}</div>
    </section>
  );
}

function AdvancedSection({
  title,
  onSkip,
  children,
}: {
  title: string;
  onSkip: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Skip
        </button>
      </div>
      <div className="mt-3 grid gap-4">{children}</div>
    </section>
  );
}

export default function SetupPage() {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profile, setProfile] = useState<BusinessProfileInput>(emptyProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const existingProfile = await getActiveBusinessProfile();
        if (existingProfile) {
          setProfileId(existingProfile.id);
          setProfile(profileToInput(existingProfile));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  const summary = useMemo(() => {
    const size = formatRange(profile.employeeMin, profile.employeeMax, " employees");
    const sizePhrase = size ? `${size} ` : "";
    const industries =
      profile.targetIndustries.length > 0 ? profile.targetIndustries.join(", ") : "your target";
    const geographies =
      profile.targetGeographies.length > 0 ? profile.targetGeographies.join(", ") : "your territory";
    const roles =
      profile.relevantDepartments.length > 0 ? profile.relevantDepartments.join(", ") : "the roles you choose";

    return `ReadySignal will begin by looking for ${sizePhrase}${industries} companies in ${geographies} and contacts involved in ${roles}.`;
  }, [profile]);

  const canSave =
    profile.companyName.trim() &&
    profile.productName.trim() &&
    profile.productDescription.trim() &&
    profile.customerProblems.length > 0 &&
    profile.targetIndustries.length > 0 &&
    profile.targetGeographies.length > 0 &&
    profile.relevantDepartments.length > 0;

  function update<K extends keyof BusinessProfileInput>(key: K, value: BusinessProfileInput[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateTerritory<K extends keyof TerritoryRules>(key: K, value: TerritoryRules[K]) {
    setProfile((current) => ({
      ...current,
      territoryRules: {
        ...current.territoryRules,
        [key]: value,
      },
    }));
  }

  async function saveProfile() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const savedProfile = profileId
        ? await updateBusinessProfile(profileId, profile)
        : await createBusinessProfile(profile);
      setProfileId(savedProfile.id);
      setProfile(profileToInput(savedProfile));
      setMessage("Profile saved. ReadySignal will use these declared rules as the starting point.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <TopNavigation />
        <PageHeader
          eyebrow="Profile"
          title="Lightweight Onboarding"
          supportingText="Give ReadySignal enough context to begin discovery. Advanced details can wait."
        />

        {isLoading ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 text-sm text-slate-600 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
            Loading profile...
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
            <div className="grid gap-4">
              <RequiredArea title="What do you sell?">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">Your company</span>
                    <input
                      value={profile.companyName}
                      onChange={(event) => update("companyName", event.target.value)}
                      className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">Product or service</span>
                    <input
                      value={profile.productName}
                      onChange={(event) => update("productName", event.target.value)}
                      className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Short description</span>
                  <textarea
                    value={profile.productDescription}
                    onChange={(event) => update("productDescription", event.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </RequiredArea>

              <RequiredArea title="What business problem does it solve?">
                <TagInput
                  label="Customer problems"
                  values={profile.customerProblems}
                  placeholder="Unplanned downtime"
                  onChange={(values) => update("customerProblems", values)}
                />
              </RequiredArea>

              <RequiredArea title="Which industries do you target?">
                <TagInput
                  label="Target industries"
                  values={profile.targetIndustries}
                  placeholder="Manufacturing"
                  onChange={(values) => update("targetIndustries", values)}
                />
              </RequiredArea>

              <RequiredArea title="Which geography or territory do you cover?">
                <TagInput
                  label="Territory"
                  values={profile.targetGeographies}
                  placeholder="Ohio"
                  onChange={(values) => update("targetGeographies", values)}
                />
              </RequiredArea>

              <RequiredArea title="Which broad roles are usually relevant?">
                <TagInput
                  label="Broad roles or functions"
                  values={profile.relevantDepartments}
                  placeholder="Maintenance"
                  onChange={(values) => update("relevantDepartments", values)}
                />
              </RequiredArea>

              <RequiredArea title="What companies or contacts should ReadySignal avoid?">
                <div className="grid gap-4 md:grid-cols-2">
                  <TagInput
                    label="Excluded industries"
                    values={profile.excludedIndustries}
                    placeholder="Retail"
                    onChange={(values) => update("excludedIndustries", values)}
                  />
                  <TagInput
                    label="Disqualifying titles or departments"
                    values={profile.excludedTitles}
                    placeholder="Human Resources"
                    onChange={(values) => update("excludedTitles", values)}
                  />
                </div>
              </RequiredArea>
            </div>

            <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced Setup</summary>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Optional details can sharpen discovery later. Skip any section that is not useful yet.
              </p>
              <div className="mt-4 grid gap-4">
                <AdvancedSection
                  title="Company size and revenue"
                  onSkip={() => {
                    update("employeeMin", null);
                    update("employeeMax", null);
                    update("revenueMin", null);
                    update("revenueMax", null);
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Employee minimum</span>
                      <input value={profile.employeeMin ?? ""} onChange={(event) => update("employeeMin", parseNumber(event.target.value))} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Employee maximum</span>
                      <input value={profile.employeeMax ?? ""} onChange={(event) => update("employeeMax", parseNumber(event.target.value))} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Revenue minimum</span>
                      <input value={profile.revenueMin ?? ""} onChange={(event) => update("revenueMin", parseNumber(event.target.value))} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Revenue maximum</span>
                      <input value={profile.revenueMax ?? ""} onChange={(event) => update("revenueMax", parseNumber(event.target.value))} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                  </div>
                </AdvancedSection>

                <AdvancedSection
                  title="Sub-industries and named accounts"
                  onSkip={() => {
                    update("targetSubIndustries", []);
                    updateTerritory("namedAccountsToInclude", []);
                  }}
                >
                  <TagInput label="Sub-industries" values={profile.targetSubIndustries} placeholder="Food production" onChange={(values) => update("targetSubIndustries", values)} />
                  <TagInput label="Named accounts" values={profile.territoryRules.namedAccountsToInclude} placeholder="STERIS" onChange={(values) => updateTerritory("namedAccountsToInclude", values)} />
                </AdvancedSection>

                <AdvancedSection
                  title="Detailed titles, departments, and levels"
                  onSkip={() => {
                    update("priorityTitles", []);
                    update("secondaryTitles", []);
                    update("managementLevels", []);
                  }}
                >
                  <TagInput label="Priority titles" values={profile.priorityTitles} placeholder="Maintenance Manager" onChange={(values) => update("priorityTitles", values)} />
                  <TagInput label="Secondary titles" values={profile.secondaryTitles} placeholder="Plant Manager" onChange={(values) => update("secondaryTitles", values)} />
                  <TagInput label="Management levels" values={profile.managementLevels} placeholder="Director" onChange={(values) => update("managementLevels", values)} />
                </AdvancedSection>

                <AdvancedSection
                  title="Signal priorities"
                  onSkip={() => {
                    update("highPrioritySignals", []);
                    update("mediumPrioritySignals", []);
                    update("lowPrioritySignals", []);
                    update("ignoredSignals", []);
                  }}
                >
                  <TagInput label="High-priority signals" values={profile.highPrioritySignals} placeholder="New facility" onChange={(values) => update("highPrioritySignals", values)} />
                  <TagInput label="Medium-priority signals" values={profile.mediumPrioritySignals} placeholder="Hiring" onChange={(values) => update("mediumPrioritySignals", values)} />
                  <TagInput label="Low-priority signals" values={profile.lowPrioritySignals} placeholder="Industry award" onChange={(values) => update("lowPrioritySignals", values)} />
                  <TagInput label="Signals to ignore" values={profile.ignoredSignals} placeholder="Generic award" onChange={(values) => update("ignoredSignals", values)} />
                </AdvancedSection>

                <AdvancedSection
                  title="Sales motion"
                  onSkip={() => {
                    update("commonObjections", []);
                    update("approvedThemes", []);
                    update("callObjective", "");
                    update("meetingOutcome", "");
                  }}
                >
                  <TagInput label="Common objections" values={profile.commonObjections} placeholder="Budget timing" onChange={(values) => update("commonObjections", values)} />
                  <TagInput label="Approved conversation themes" values={profile.approvedThemes} placeholder="Reliability after expansion" onChange={(values) => update("approvedThemes", values)} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Typical call objective</span>
                      <input value={profile.callObjective ?? ""} onChange={(event) => update("callObjective", event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Desired meeting outcome</span>
                      <input value={profile.meetingOutcome ?? ""} onChange={(event) => update("meetingOutcome", event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                    </label>
                  </div>
                </AdvancedSection>

                <AdvancedSection
                  title="Restrictions and historical notes"
                  onSkip={() => {
                    update("sourceRestrictions", []);
                    update("excludedCompanyTypes", []);
                    update("historicalSuccessNotes", "");
                    updateTerritory("namedAccountsToExclude", []);
                  }}
                >
                  <TagInput label="Source and compliance restrictions" values={profile.sourceRestrictions} placeholder="No restricted sources" onChange={(values) => update("sourceRestrictions", values)} />
                  <TagInput label="Excluded company types" values={profile.excludedCompanyTypes} placeholder="Government" onChange={(values) => update("excludedCompanyTypes", values)} />
                  <TagInput label="Named accounts to exclude" values={profile.territoryRules.namedAccountsToExclude} placeholder="Existing customer account" onChange={(values) => updateTerritory("namedAccountsToExclude", values)} />
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">Historical success data or notes</span>
                    <textarea value={profile.historicalSuccessNotes} onChange={(event) => update("historicalSuccessNotes", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                  </label>
                </AdvancedSection>
              </div>
            </details>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-700">Declared Profile</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{summary}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  These are user-entered rules. ReadySignal will not silently overwrite them.
                </p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Learned Recommendations</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Future recommendations may use observed outcomes after enough calls have been logged. Suggestions will require user approval before changing the declared profile.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Learning is {profile.learningEnabled ? "enabled" : "off"} for now. Stored recommendations: none.
                </p>
              </section>
            </div>

            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Required onboarding should take only a few minutes. Advanced setup is optional.</p>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSaving || !canSave}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
