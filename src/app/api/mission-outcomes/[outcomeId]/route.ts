import "server-only";

import { updateMissionOutcomeAdmin } from "../../../../services/missionOutcomeAdminService";
import type { MissionOutcomeValue } from "../../../../types/MissionOutcome";

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

export async function PATCH(request: Request, context: { params: Promise<{ outcomeId: string }> }) {
  try {
    const { outcomeId } = await context.params;
    const parsedOutcomeId = Number(outcomeId);
    const body = (await request.json()) as {
      connected?: unknown;
      outcome?: unknown;
      followUpDate?: unknown;
      recommendedNextAction?: unknown;
      reason?: unknown;
      learnedSignal?: unknown;
      notes?: unknown;
    };
    const outcome = typeof body.outcome === "string" ? body.outcome : "";
    const connected = typeof body.connected === "boolean" ? body.connected : null;

    if (!Number.isFinite(parsedOutcomeId)) {
      return Response.json({ error: "Missing mission outcome id." }, { status: 400 });
    }

    if (!outcomeValues.includes(outcome as MissionOutcomeValue)) {
      return Response.json({ error: "Invalid mission outcome." }, { status: 400 });
    }

    if (connected === null) {
      return Response.json({ error: "Missing connected status." }, { status: 400 });
    }

    const saved = await updateMissionOutcomeAdmin(parsedOutcomeId, {
      connected,
      outcome: outcome as MissionOutcomeValue,
      followUpDate: typeof body.followUpDate === "string" ? body.followUpDate : null,
      recommendedNextAction: typeof body.recommendedNextAction === "string" ? body.recommendedNextAction : null,
      reason: typeof body.reason === "string" ? body.reason : null,
      learnedSignal: typeof body.learnedSignal === "string" ? body.learnedSignal : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return Response.json({ outcome: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update mission outcome.";
    console.error(`[mission-outcomes] Update failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
