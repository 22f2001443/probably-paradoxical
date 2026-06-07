import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { ConfigDocument, RoundDocument, RubricDocument } from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

/** Admin-only dashboard overview: live entity counts, round status, activity. */
export async function handleAdminOverview(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}
	if (auth.role !== "admin") {
		return { status: 403, body: { error: "Admin access required." } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const [
				teams,
				members,
				judges,
				submissions,
				questionnaires,
				evaluations,
				assignments,
				results,
				paradoxesTotal,
				paradoxesPublished,
			] = await Promise.all([
				db.collection(COLLECTIONS.teams).countDocuments(),
				db.collection(COLLECTIONS.members).countDocuments(),
				db.collection(COLLECTIONS.judges).countDocuments(),
				db.collection(COLLECTIONS.submissions).countDocuments(),
				db.collection(COLLECTIONS.questionnaires).countDocuments(),
				db.collection(COLLECTIONS.evaluations).countDocuments(),
				db.collection(COLLECTIONS.assignments).countDocuments(),
				db.collection(COLLECTIONS.results).countDocuments(),
				db.collection(COLLECTIONS.paradoxes).countDocuments(),
				db.collection(COLLECTIONS.paradoxes).countDocuments({ state: "published" }),
			]);

			const config = await db
				.collection<ConfigDocument>(COLLECTIONS.config)
				.findOne({ _id: "singleton" });

			const rounds = await db
				.collection<RoundDocument>(COLLECTIONS.rounds)
				.find(
					{},
					{ projection: { _id: 0, roundKey: 1, title: 1, order: 1, state: 1, submissionType: 1, requiresJudging: 1 } },
				)
				.sort({ order: 1 })
				.toArray();

			const currentRoundKey = config?.currentRoundKey ?? null;
			const currentRound = rounds.find((r) => r.roundKey === currentRoundKey) ?? null;

			const recentActivity = await db
				.collection(COLLECTIONS.auditEvents)
				.find({}, { projection: { _id: 0, action: 1, actorRole: 1, targetType: 1, targetId: 1, at: 1 } })
				.sort({ at: -1 })
				.limit(8)
				.toArray();

			const pendingSchedules = await db
				.collection(COLLECTIONS.roundSchedules)
				.find({ status: "pending" }, { projection: { roundKey: 1, runAt: 1 } })
				.sort({ runAt: 1 })
				.toArray();
			const schedules = pendingSchedules.map((s) => ({
				id: String(s._id),
				roundKey: s.roundKey,
				runAt: s.runAt,
			}));

			const rubricDoc = await db
				.collection<RubricDocument>(COLLECTIONS.rubrics)
				.findOne({ appliesTo: "questionnaire", isActive: true }, { sort: { version: -1 } });
			const rubric = rubricDoc
				? {
						rubricKey: rubricDoc.rubricKey,
						version: rubricDoc.version,
						criteria: rubricDoc.criteria.map((c) => ({ key: c.key, label: c.label, maxScore: c.maxScore })),
						total: rubricDoc.criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0),
					}
				: null;

			return {
				status: 200,
				body: {
					counts: {
						teams,
						members,
						judges,
						submissions,
						questionnaires,
						evaluations,
						assignments,
						results,
					},
					paradoxes: { total: paradoxesTotal, published: paradoxesPublished },
					currentRoundKey,
					currentRound,
					rounds,
					schedules,
					rubric,
					recentActivity,
					generatedAt: new Date().toISOString(),
				},
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to load the overview." },
		};
	}
}
