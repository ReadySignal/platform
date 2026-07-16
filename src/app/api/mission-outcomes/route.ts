import "server-only";

import { getActiveBusinessProfile } from "../../../services/businessProfileService";
import { createMissionOutcomeAdmin } from "../../../services/missionOutcomeAdminService";
import type { MissionOutcomeValue } from "../../../types/MissionOutcome";

export const runtime = "nodejs";

const outcomeValues: MissionOutcomeValue[] = [
  "Voicemail",
  "No Answer",
  "Wrong Person",
  "Meeting Booked",
  "Follow Up",
  "Timing",
  "No Budget",
  "Already Customer",
  "Not Interested",
  "Disqualified",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      missionId?: unknown;
      companyId?: unknown;
      contactId?: unknown;
      connected?: unknown;
      outcome?: unknown;
      followUpDate?: unknown;
      recommendedNextAction?: unknown;
      reason?: unknown;
      learnedSignal?: unknown;
      notes?: unknown;
      clientSubmissionId?: unknown;
    };
    const missionId = typeof body.missionId === "string" ? body.missionId.trim() : "";
    const companyId = Number(body.companyId);
    const contactId = body.contactId === null || body.contactId === undefined ? null : Number(body.contactId);
    const connected = typeof body.connected === "boolean" ? body.connected : null;
    const outcome = typeof body.outcome === "string" ? body.outcome : "";
    const clientSubmissionId = typeof body.clientSubmissionId === "string" ? body.clientSubmissionId.trim() : "";

    if (!missionId) {
      return Response.json({ error: "Missing mission id." }, { status: 400 });
    }

    if (!Number.isFinite(companyId)) {
      return Response.json({ error: "Missing company id." }, { status: 400 });
    }

    if (contactId !== null && !Number.isFinite(contactId)) {
      return Response.json({ error: "Invalid contact id." }, { status: 400 });
    }

    if (!outcomeValues.includes(outcome as MissionOutcomeValue)) {
      return Response.json({ error: "Invalid mission outcome." }, { status: 400 });
    }

    if (connected === null) {
      return Response.json({ error: "Missing connected status." }, { status: 400 });
    }

    if (!clientSubmissionId) {
      return Response.json({ error: "Missing submission id." }, { status: 400 });
    }

    const profile = await getActiveBusinessProfile();
    const saved = await createMissionOutcomeAdmin({
      missionId,
      companyId,
      contactId,
      businessProfileId: profile?.id ?? null,
      connected,
      outcome: outcome as MissionOutcomeValue,
      followUpDate: typeof body.followUpDate === "string" ? body.followUpDate : null,
      recommendedNextAction: typeof body.recommendedNextAction === "string" ? body.recommendedNextAction : null,
      reason: typeof body.reason === "string" ? body.reason : null,
      learnedSignal: typeof body.learnedSignal === "string" ? body.learnedSignal : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      clientSubmissionId,
    });

    return Response.json({ outcome: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save mission outcome.";
    console.error(`[mission-outcomes] Save failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
