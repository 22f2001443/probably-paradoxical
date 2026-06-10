import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, CONFIG_SINGLETON_ID } from "../db/collections.ts";
import type { ConfigDocument, RoundDocument, SubmissionDocument } from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

/**
 * GET /team/overview — team-only, read-only. Returns the round pipeline with its
 * live states (and the current round) so the participant UI can lock submissions
 * whose round isn't open. This endpoint only reports state; it does not gate
 * submissions — the submission handlers remain independent.
 */
export async function handleTeamOverview(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}
	if (auth.role !== "team") {
		return { status: 403, body: { error: "Team access required." } };
	}

	const teamId = auth.teamId ?? auth.sub;

	try {
		return await withDatabase(env, async (db) => {
			const rounds = await db
				.collection<RoundDocument>(COLLECTIONS.rounds)
				.find(
					{},
					{ projection: { _id: 0, roundKey: 1, order: 1, title: 1, state: 1, submissionType: 1 } },
				)
				.sort({ order: 1 })
				.toArray();

			const config = await db
				.collection<ConfigDocument>(COLLECTIONS.config)
				.findOne({ _id: CONFIG_SINGLETON_ID }, { projection: { _id: 0, currentRoundKey: 1 } });

			// This team's submissions, keyed by round so the UI can show what's done.
			const submissionDocs = await db
				.collection<SubmissionDocument>(COLLECTIONS.submissions)
				.find({ teamId }, { projection: { _id: 0, roundKey: 1, type: 1, status: 1, submittedAt: 1 } })
				.toArray();
			const submissions: Record<string, { type: string; status: string; submittedAt: Date | null }> = {};
			for (const doc of submissionDocs) {
				submissions[doc.roundKey] = {
					type: doc.type,
					status: doc.status,
					submittedAt: doc.submittedAt ?? null,
				};
			}

			return {
				status: 200,
				body: {
					currentRoundKey: config?.currentRoundKey ?? null,
					rounds,
					submissions,
					generatedAt: new Date().toISOString(),
				},
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to load the round status." },
		};
	}
}
