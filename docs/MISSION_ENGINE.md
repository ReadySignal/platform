# ReadySignal Mission Engine

## Purpose

The Mission Engine is the orchestration layer that produces Today's Mission: the prioritized set of recommended conversations for the current day.

It answers one product question:

Who should this SDR spend their limited conversation time on today?

## Mission Philosophy

ReadySignal should not ask the SDR to reason across discovery runs, research jobs, evidence, contact scoring, signals, and previous outcomes. Those systems produce intelligence. The Mission Engine turns that intelligence into a concise recommendation.

Mission decisions are made in this order:

- Is this account actually assigned to this SDR?
- Is there verified evidence that creates a reason to call?
- Is there a validated contact with sufficient confidence?
- Has this person already been contacted recently?
- Would another recommended mission produce more value?

## Inputs

The Mission Engine may consume:

- Active Business Profile
- Discovery Candidates
- Company Research
- Company Evidence
- Contact Intelligence
- Active Opportunity Signals
- Previous Outreach
- Today's Outcomes
- Mission Outcomes
- Existing Company and Contact Data
- Contact Discovery role-validation results

In the current implementation, the engine consumes the ranked queue, active signals, and today's call outcomes. Future iterations should move more profile, evidence, and contact-intelligence orchestration behind this service.

Contact discovery introduces an eligibility progression:

Identified
-> Role Validated
-> Contact Method Verified
-> Mission Eligible

Stage 1 contact discovery produces Identified candidates. Stage 2 responsibility validation produces Role Validated candidates. The Mission Engine must distinguish these states. A contact is not Mission eligible solely because their name and title were discovered or because a user approved the candidate.

Mission Outcomes introduce the first feedback loop. Follow-ups due today rank above new opportunities, Meeting Booked removes a mission from active recommendations, and Already Customer or Disqualified outcomes stop future recommendations unless manually reactivated later.

## Outputs

The engine returns typed Mission objects. A mission represents one recommended conversation and includes:

- Company
- Primary Contact
- Mission Score
- Confidence
- Why Today
- Call Brief
- Supporting Evidence
- Previous Interaction Summary
- Recommended Next Action
- Estimated Value
- Decision Explanation

The homepage should consume Mission objects rather than assembling recommendation logic directly from lower-level services.

## Responsibilities

The Mission Engine is responsible for:

- Producing Today's Mission
- Restoring today's completed status from saved outcomes
- Prioritizing follow-ups due today
- Calculating daily mission counters
- Explaining why a recommendation ranked where it did
- Coordinating existing intelligence services into one recommendation path
- Preserving a single place for mission-level recommendation decisions

## Non-Responsibilities

The Mission Engine does not:

- Run company discovery
- Perform external research
- Call AI models
- Create unsupported facts
- Store evidence
- Replace the Research Engine, Signal Engine, Contact Intelligence, or Opportunity Generation services
- Automatically learn or rewrite profile rules

## Future Learning

The Mission Engine is not machine learning. Future learning systems may improve it by suggesting better weights, thresholds, or profile recommendations from observed outcomes.

Any learned recommendation that changes declared profile or assignment rules must require user approval. The Mission Engine should remain the single place where approved intelligence becomes daily conversation recommendations.
