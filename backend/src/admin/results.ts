import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, ROUND_STATE } from "../db/collections.ts";
import type {
	EvaluationDocument,
	JudgeDocument,
	RoundDocument,
	RubricDocument,
	SubmissionDocument,
	TeamDocument,
	ResultDocument,
} from "../db/types.ts";
import { requireAdmin } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const VALID_OUTCOMES = new Set(["advanced", "eliminated"]);

/** GET /admin/results — judged stages, active teams, and already-published results. */
export async function handleListResults(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	try {
		return await withDatabase(env, async (db) => {
			const rounds = await db
				.collection<RoundDocument>(COLLECTIONS.rounds)
				.find({ requiresJudging: true }, { projection: { _id: 0, roundKey: 1, title: 1, order: 1, state: 1 } })
				.sort({ order: 1 })
				.toArray();

			const teams = await db
				.collection<TeamDocument>(COLLECTIONS.teams)
				.find({}, { projection: { _id: 0, teamId: 1, teamName: 1, status: 1 } })
				.sort({ teamId: 1 })
				.toArray();

			const results = await db
				.collection<ResultDocument>(COLLECTIONS.results)
				.find({}, { projection: { _id: 0, roundKey: 1, teamId: 1, outcome: 1, aggregateScore: 1, rank: 1 } })
				.toArray();

			// Computed scores from judges' marks, per round per team (weighted by
			// judge weight). Used so the questionnaire stage's result derives from
			// the judges rather than manual entry.
			const { computedScores, rubricTotal } = await aggregateJudgeScores(db);

			return { status: 200, body: { rounds, teams, results, computedScores, rubricTotal } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * POST /admin/results/publish — publish a stage's results.
 * Body: { roundKey, outcomes: [{ teamId, outcome, aggregateScore?, rank? }] }.
 * Upserts result docs, updates each team's status + progress, and flips the
 * round to `results_published`.
 */
export async function handlePublishResults(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;

	const roundKey = str(parsed.body.roundKey);
	const outcomes = Array.isArray(parsed.body.outcomes) ? parsed.body.outcomes : null;
	if (!roundKey) return bad("roundKey is required.");
	if (!outcomes || outcomes.length === 0) return bad("Provide at least one team outcome.");

	const clean: { teamId: string; outcome: string; aggregateScore?: number; rank?: number }[] = [];
	for (const o of outcomes) {
		const teamId = str((o as Record<string, unknown>).teamId);
		const outcome = str((o as Record<string, unknown>).outcome);
		if (!teamId || !VALID_OUTCOMES.has(outcome)) {
			return bad("Each outcome needs a teamId and outcome of 'advanced' or 'eliminated'.");
		}
		const entry: { teamId: string; outcome: string; aggregateScore?: number; rank?: number } = { teamId, outcome };
		const score = Number((o as Record<string, unknown>).aggregateScore);
		const rank = Number((o as Record<string, unknown>).rank);
		if (Number.isFinite(score)) entry.aggregateScore = score;
		if (Number.isFinite(rank)) entry.rank = rank;
		clean.push(entry);
	}

	try {
		return await withDatabase(env, async (db) => {
			const round = await db
				.collection<RoundDocument>(COLLECTIONS.rounds)
				.findOne({ roundKey: roundKey as RoundDocument["roundKey"] });
			if (!round) return bad("Unknown roundKey.");

			const publishedBy = new ObjectId(auth.payload.sub);
			const now = new Date();

			for (const o of clean) {
				await db.collection(COLLECTIONS.results).updateOne(
					{ roundKey, teamId: o.teamId },
					{
						$set: {
							roundKey,
							teamId: o.teamId,
							outcome: o.outcome,
							...(o.aggregateScore !== undefined ? { aggregateScore: o.aggregateScore } : {}),
							...(o.rank !== undefined ? { rank: o.rank } : {}),
							publishedBy,
							publishedAt: now,
						},
					},
					{ upsert: true },
				);

				// Reflect the outcome on the team: eliminated → status eliminated,
				// advanced → keep active. Record/replace the progress entry for this round.
				const teamStatus = o.outcome === "eliminated" ? "eliminated" : "active";
				await db.collection(COLLECTIONS.teams).updateOne(
					{ teamId: o.teamId },
					{ $pull: { progress: { roundKey } }, $set: { status: teamStatus, updatedAt: now } },
				);
				await db.collection(COLLECTIONS.teams).updateOne(
					{ teamId: o.teamId },
					{ $push: { progress: { roundKey, outcome: o.outcome, at: now } } },
				);
			}

			await db
				.collection(COLLECTIONS.rounds)
				.updateOne({ roundKey }, { $set: { state: ROUND_STATE.resultsPublished, updatedAt: now } });

			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "admin",
				actorId: auth.payload.sub,
				action: "results.published",
				targetType: "round",
				targetId: roundKey,
				at: now,
			});

			const advanced = clean.filter((o) => o.outcome === "advanced").length;
			return {
				status: 200,
				body: { ok: true, roundKey, published: clean.length, advanced, eliminated: clean.length - advanced },
			};
		});
	} catch (error) {
		return errorResult(error);
	}
}

// --- helpers ----------------------------------------------------------------

/**
 * Weighted-average score per (roundKey, teamId) from submitted evaluations.
 * Evaluations reference the questionnaire submission; we map that back to its
 * round so each judged stage gets aggregated scores derived from judge marks.
 */
async function aggregateJudgeScores(
	db: Db,
): Promise<{ computedScores: Record<string, Record<string, { score: number; judges: number }>>; rubricTotal: number }> {
	const submissions = await db
		.collection<SubmissionDocument>(COLLECTIONS.submissions)
		.find({}, { projection: { _id: 1, teamId: 1, roundKey: 1 } })
		.toArray();
	const subMeta = new Map(submissions.map((s) => [String(s._id), { teamId: s.teamId, roundKey: s.roundKey as string }]));

	const evaluations = await db
		.collection<EvaluationDocument>(COLLECTIONS.evaluations)
		.find({ status: "submitted" })
		.toArray();

	const judges = await db.collection<JudgeDocument>(COLLECTIONS.judges).find({}).toArray();
	const weightById = new Map(judges.map((j) => [String(j._id), j.defaultWeight ?? 1]));

	// roundKey -> teamId -> { weightedSum, weight, judges }
	const acc = new Map<string, Map<string, { weightedSum: number; weight: number; judges: number }>>();
	for (const ev of evaluations) {
		const meta = subMeta.get(String(ev.questionnaireId));
		if (!meta) continue;
		const w = weightById.get(String(ev.judgeId)) ?? 1;
		if (!acc.has(meta.roundKey)) acc.set(meta.roundKey, new Map());
		const teamMap = acc.get(meta.roundKey)!;
		const cur = teamMap.get(meta.teamId) ?? { weightedSum: 0, weight: 0, judges: 0 };
		cur.weightedSum += ev.rawTotal * w;
		cur.weight += w;
		cur.judges += 1;
		teamMap.set(meta.teamId, cur);
	}

	const computedScores: Record<string, Record<string, { score: number; judges: number }>> = {};
	for (const [roundKey, teamMap] of acc) {
		computedScores[roundKey] = {};
		for (const [teamId, v] of teamMap) {
			computedScores[roundKey][teamId] = {
				score: v.weight > 0 ? Math.round((v.weightedSum / v.weight) * 100) / 100 : 0,
				judges: v.judges,
			};
		}
	}

	const rubric = await db
		.collection<RubricDocument>(COLLECTIONS.rubrics)
		.findOne({ appliesTo: "questionnaire", isActive: true }, { sort: { version: -1 } });
	const rubricTotal = rubric ? rubric.criteria.reduce((s, c) => s + (c.maxScore || 0), 0) : 0;

	return { computedScores, rubricTotal };
}

function str(v: unknown): string {
	return typeof v === "string" ? v.trim() : "";
}
function bad(message: string): Result {
	return { status: 400, body: { error: message } };
}
function errorResult(error: unknown): Result {
	const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
	return { status, body: { error: error instanceof Error ? error.message : "Request failed." } };
}
async function readJson(request: Request): Promise<{ body: Record<string, unknown> } | { error: Result }> {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return { error: { status: 400, body: { error: "Request body must be a JSON object." } } };
		}
		return { body: body as Record<string, unknown> };
	} catch {
		return { error: { status: 400, body: { error: "Request body must be valid JSON." } } };
	}
}
