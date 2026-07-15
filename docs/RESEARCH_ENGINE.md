# ReadySignal Research Engine

## Purpose

The Research Engine turns newly imported prospect lists into evidence-backed signals that help ReadySignal rank the best people to call. It gathers reliable business evidence, stores the source trail, and prepares structured inputs for the existing ranking workflow.

## Core Principle

The Research Engine discovers evidence.

The Signal Engine decides whether that evidence matters.

The Opportunity Engine decides whether the SDR should act on it.

## When Research Runs

- Research begins when new contacts are imported.
- Do not continuously crawl the web in V1.
- Skip companies that were recently researched.
- Research new companies first.
- Perform contact-level research only for higher-priority contacts when practical.

## V1 Sources

Prioritize reliable, safe, publicly available sources:

- Recent reputable news articles
- Company newsroom and press releases
- Company website
- Company careers page
- Industry publications relevant to that company
- Reliable public announcements involving a contact

Do not include LinkedIn scraping or restricted sources in V1.

## Company Evidence Categories

- Expansion
- New facility
- Capital investment
- Hiring
- Acquisition
- Leadership change
- New product line
- Modernization or reliability initiative
- Relevant industry news

## Contact Evidence Categories

- Promotion
- New role
- New hire
- Public recognition
- Speaking engagement
- Direct mention in a reliable company or industry announcement

## Evidence Requirements

Every evidence record must include:

- `company_id`
- `contact_id` when applicable
- Evidence type
- Headline
- Concise factual summary
- Source name
- Source URL
- Published date when available
- Discovered date
- Confidence level

Never create a signal without supporting evidence.

Never invent facts or imply that something happened without a source.

## Evidence-To-Signal Rules

- One piece of evidence may create one or more structured signals.
- Signals should use brief categories and one concise explanation.
- Weak or irrelevant evidence should be discarded.
- The SDR-facing view should remain brief.
- Source details should be available only when the user expands the explanation.

## Research Flow

CSV Import
-> Normalize and deduplicate
-> Identify new companies
-> Research companies
-> Store evidence
-> Create company signals
-> Initial opportunity ranking
-> Research selected high-priority contacts
-> Store contact evidence
-> Create contact signals
-> Final opportunity ranking
-> Confidence Workspace

## Duplicate and Refresh Rules

- Do not research the same company repeatedly within a short period.
- Add a future `last_researched_at` field to companies.
- Reuse stored evidence when appropriate.
- Do not create duplicate evidence or duplicate signals from the same source and event.
- Allow manual research refresh later, but do not build scheduling in V1.

## Trust and Safety

- Use only sources the system is permitted to access.
- Preserve source attribution.
- Clearly separate facts from system interpretation.
- Mark uncertain findings rather than presenting them as confirmed.
- Do not expose private contact data from unauthorized sources.
- Keep research limited to business-relevant public information.

## V1 Boundaries

V1 does not include:

- Constant background crawling
- Unrestricted web scraping
- LinkedIn scraping
- Automatic CRM integrations
- AI-generated unsupported claims
- Long research reports
- Automatic outreach or messaging

## Success Criteria

The V1 Research Engine is successful when:

- A user imports a list
- ReadySignal researches new companies
- Reliable evidence becomes structured signals
- The strongest opportunities move to the top
- Each recommendation has a brief, source-backed reason to call
- The SDR can understand the reason in under five seconds

## Open Questions

- How recently a company must have been researched before being skipped
- Which search provider or API to use
- How many companies to process per research run
- When contact-level research should begin
- How confidence thresholds should be calibrated
