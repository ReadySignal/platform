# ReadySignal Business Profile

## Purpose

The Business Profile gives ReadySignal enough context to begin discovery without asking the SDR to complete a heavy configuration process. It is a starting hypothesis, not permanent truth.

ReadySignal must understand the sales motion before it searches for companies or contacts.

## Lightweight Onboarding

Required onboarding should take only a few minutes and capture six areas:

- What the SDR sells
- The business problem it solves
- Target industries
- Covered geography or territory
- Broad relevant roles or functions
- Companies or contacts ReadySignal should avoid

Advanced setup is optional and collapsed by default. It may capture company size, revenue range, sub-industries, named accounts, detailed titles, departments, management levels, signal priorities, objections, approved themes, source restrictions, and historical success notes.

## Declared Profile

Declared Profile values are explicitly entered by the user. They include target markets, territory, relevant roles, exclusions, restrictions, and sales-motion preferences.

ReadySignal must not silently overwrite declared values. If future evidence suggests a better rule, the system should show a recommendation and require approval before changing the profile.

## Learned Recommendations

Learning is not implemented in this iteration. The profile model includes metadata so future recommendations can be stored separately from declared rules:

- `profile_version`
- `last_user_confirmed_at`
- `learning_enabled`
- `minimum_outcomes_before_recommendations`
- `learned_recommendations`

The `learned_recommendations` field should remain empty until an explicit recommendation workflow exists.

## Future Profile Lifecycle

Initial onboarding
-> Discovery begins
-> Outcomes collected
-> Patterns detected
-> Recommendation shown
-> User approves or rejects
-> Profile version updated

Outcome patterns may suggest that certain industries, roles, company sizes, signals, or conversation themes perform better. Those suggestions are recommendations only. The user remains responsible for confirming profile changes.

## Future Contact Role Validation

Titles are only one signal. Future contact validation may consider:

- Department
- Function
- Management level
- Public or licensed professional descriptions
- Company context
- Imported notes
- Observed outcomes

ReadySignal should not depend on unauthorized LinkedIn scraping. Contact-role validation is not implemented in this iteration, and the system should not imply that individual contacts have been externally researched unless that capability exists.

## How Discovery Will Use The Profile Later

Automated discovery should use the profile as a filter and ranking guide, not as a source of facts.

Planned uses:

- Prefer companies that match target industries and territory
- Skip companies, industries, or source types the user has excluded
- Prioritize contacts whose responsibilities appear relevant
- Treat stored evidence differently based on signal priorities
- Keep SDR-facing guidance grounded in stored evidence and approved themes

The profile works with the existing Research Engine boundaries:

- The Research Engine discovers evidence.
- The Signal Engine decides whether that evidence matters.
- The Opportunity Engine decides whether the SDR should act.

## Matching Helper Behavior

The matching helper should stay broad and explainable. It returns:

- Match result
- Contributing profile rules
- Missing information
- Uncertainty

This keeps profile matching transparent while avoiding brittle title-only validation.

## What ReadySignal Will Not Infer Without Confirmation

ReadySignal should not silently infer:

- The SDR's product positioning
- Excluded industries or company types
- Source restrictions
- That a company is a good fit without profile support
- That a contact is relevant from title alone
- That a signal matters if the profile says to ignore it
- Unsupported business claims, buyer pain, urgency, or outreach angles

If the profile is missing important context, ReadySignal should say what is missing or ask for confirmation rather than inventing a sales motion.

## V1 Boundary

V1 stores and edits the profile, exposes a reusable matching helper, and documents how the profile may guide future discovery. It does not change current opportunity scoring, alter the Confidence Workspace, run automated discovery, perform contact-role validation, or create signals from profile data alone.
