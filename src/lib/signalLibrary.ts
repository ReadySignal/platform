export type SignalPriority = "high" | "medium" | "low";
export type SignalStyle = "green" | "blue" | "amber" | "slate";

export type SignalCategory = {
  id: string;
  label: string;
  description: string;
  defaultPoints: number;
  style: SignalStyle;
  priority: SignalPriority;
};

export const signalLibrary: SignalCategory[] = [
  {
    id: "promotion",
    label: "Promotion",
    description: "The contact recently moved into a relevant role.",
    defaultPoints: 15,
    style: "green",
    priority: "high",
  },
  {
    id: "job-change",
    label: "Job Change",
    description: "The prospect changed roles and may now own the buying decision.",
    defaultPoints: 15,
    style: "blue",
    priority: "high",
  },
  {
    id: "expansion",
    label: "Expansion",
    description: "The company is scaling operations or opening new capacity.",
    defaultPoints: 15,
    style: "blue",
    priority: "high",
  },
  {
    id: "new-facility",
    label: "New Facility",
    description: "The business is opening or upgrading a facility.",
    defaultPoints: 15,
    style: "amber",
    priority: "medium",
  },
  {
    id: "hiring",
    label: "Hiring",
    description: "Leadership hiring points to new operating priorities.",
    defaultPoints: 15,
    style: "blue",
    priority: "medium",
  },
  {
    id: "capital-investment",
    label: "Capital Investment",
    description: "The company is investing in new systems or capacity.",
    defaultPoints: 15,
    style: "amber",
    priority: "high",
  },
  {
    id: "leadership-change",
    label: "Leadership Change",
    description: "A recent leadership change may open a new buying path.",
    defaultPoints: 15,
    style: "slate",
    priority: "medium",
  },
  {
    id: "new-product-line",
    label: "New Product Line",
    description: "The business is launching a new offering or operating line.",
    defaultPoints: 15,
    style: "blue",
    priority: "medium",
  },
  {
    id: "long-time-since-contact",
    label: "Long Time Since Contact",
    description: "The contact has not been engaged in a while.",
    defaultPoints: 10,
    style: "slate",
    priority: "low",
  },
  {
    id: "no-previous-outreach",
    label: "No Previous Outreach",
    description: "The prospect has not been contacted before.",
    defaultPoints: 10,
    style: "green",
    priority: "medium",
  },
  {
    id: "previous-success",
    label: "Previous Success",
    description: "The team has seen positive prior outcomes with this account.",
    defaultPoints: 10,
    style: "green",
    priority: "high",
  },
  {
    id: "industry-news",
    label: "Industry News",
    description: "Recent industry developments support a timely outreach.",
    defaultPoints: 10,
    style: "amber",
    priority: "medium",
  },
];

export function getSignalCategory(signalId: string | undefined) {
  return signalLibrary.find((signal) => signal.id === signalId) ?? signalLibrary[0];
}

export function getSignalStyleClasses(style: SignalStyle) {
  switch (style) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "blue":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
