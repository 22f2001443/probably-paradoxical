import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { ResultDocument } from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

/** Team-only: the signed-in team's published results, newest first. */
export async function handleTeamResults(request: Request, env: AppEnv): Promise<Result> {
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
			// "pending" results are saved scores with no published advance/eliminate
			// decision yet — never surface them to the team.
			const docs = await db
				.collection<ResultDocument>(COLLECTIONS.results)
				.find({ teamId, outcome: { $ne: "pending" } })
				.sort({ publishedAt: -1 })
				.toArray();

			const results = docs.map((r) => ({
				roundKey: r.roundKey,
				outcome: r.outcome,
				aggregateScore: r.aggregateScore ?? null,
				rank: r.rank ?? null,
				summary: r.summary ?? "",
				breakdown: r.breakdown ?? null,
				publishedAt: r.publishedAt,
			}));

			return { status: 200, body: { teamId, results } };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to load results." },
		};
	}
}
