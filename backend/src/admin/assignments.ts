import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, ROUND_KEYS, SUBMISSION_TYPE } from "../db/collections.ts";
import type { JudgeDocument, SubmissionDocument, TeamDocument } from "../db/types.ts";
import { requireAdmin } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const ROUND_KEY = ROUND_KEYS.stage1Submission;

/**
 * GET /admin/assignments — judges, Stage 1 questionnaire submissions, and the
 * existing judge→questionnaire assignments. The team's Stage 1 theme submission
 * (which carries the questionnaire PDF) is the unit assigned; its _id is stored
 * as the assignment's `questionnaireId`.
 */
export async function handleListAssignments(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	try {
		return await withDatabase(env, async (db) => {
			const [judges, submissions, assignments] = await Promise.all([
				db.collection<JudgeDocument>(COLLECTIONS.judges).find({ isActive: true }).sort({ name: 1 }).toArray(),
				db
					.collection<SubmissionDocument>(COLLECTIONS.submissions)
					.find({ roundKey: ROUND_KEY, type: SUBMISSION_TYPE.theme, status: "submitted" })
					.toArray(),
				db.collection(COLLECTIONS.assignments).find({}).toArray(),
			]);

			const teamIds = submissions.map((s) => s.teamId);
			const teams = teamIds.length
				? await db.collection<TeamDocument>(COLLECTIONS.teams).find({ teamId: { $in: teamIds } }).toArray()
				: [];
			const teamName = new Map(teams.map((t) => [t.teamId, t.teamName]));

			const assignmentList = assignments.map((a) => ({
				id: String(a._id),
				questionnaireId: String(a.questionnaireId),
				teamId: a.teamId as string,
				judgeId: String(a.judgeId),
				status: a.status as string,
			}));

			const countByJudge = new Map<string, number>();
			for (const a of assignmentList) countByJudge.set(a.judgeId, (countByJudge.get(a.judgeId) ?? 0) + 1);

			return {
				status: 200,
				body: {
					judges: judges.map((j) => ({
						id: String(j._id),
						name: j.name,
						email: j.email,
						defaultWeight: j.defaultWeight ?? 1,
						assignedCount: countByJudge.get(String(j._id)) ?? 0,
					})),
					submissions: submissions.map((s) => ({
						submissionId: String(s._id),
						teamId: s.teamId,
						teamName: teamName.get(s.teamId) ?? s.teamId,
						paradoxCode: s.theme?.paradoxCode ?? "",
						theme: s.theme?.theme ?? "",
						judgeIds: assignmentList.filter((a) => a.questionnaireId === String(s._id)).map((a) => a.judgeId),
					})),
					assignments: assignmentList,
				},
			};
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/assignments — assign one judge to one team's questionnaire. Body: { teamId, judgeId }. */
export async function handleCreateAssignment(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const teamId = str(parsed.body.teamId);
	const judgeId = str(parsed.body.judgeId);
	if (!teamId || !judgeId) return bad("teamId and judgeId are required.");

	try {
		return await withDatabase(env, async (db) => {
			const judge = await loadJudge(db, judgeId);
			if (!judge) return bad("Unknown judge.");
			const submission = await db
				.collection<SubmissionDocument>(COLLECTIONS.submissions)
				.findOne({ teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.theme, status: "submitted" });
			if (!submission?._id) return bad("That team has no submitted questionnaire.");

			await upsertAssignment(db, submission._id, judge._id!, teamId, judge.defaultWeight ?? 1, auth.payload.sub);
			await audit(db, auth.payload.sub, "assignment.created", teamId);
			return { status: 200, body: { ok: true } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/assignments/delete — remove one assignment. Body: { teamId, judgeId }. */
export async function handleDeleteAssignment(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const teamId = str(parsed.body.teamId);
	const judgeId = str(parsed.body.judgeId);
	if (!teamId || !judgeId) return bad("teamId and judgeId are required.");

	try {
		return await withDatabase(env, async (db) => {
			let jid: ObjectId;
			try {
				jid = new ObjectId(judgeId);
			} catch {
				return bad("Invalid judgeId.");
			}
			await db.collection(COLLECTIONS.assignments).deleteOne({ teamId, judgeId: jid });
			await audit(db, auth.payload.sub, "assignment.deleted", teamId);
			return { status: 200, body: { ok: true } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * POST /admin/assignments/auto — randomly (but load-balanced) assign judges to
 * every Stage 1 questionnaire. Body: { judgesPerTeam, reset? }.
 */
export async function handleAutoAssign(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const judgesPerTeam = Math.floor(Number(parsed.body.judgesPerTeam));
	const reset = parsed.body.reset === true;
	if (!Number.isFinite(judgesPerTeam) || judgesPerTeam < 1) return bad("judgesPerTeam must be at least 1.");

	try {
		return await withDatabase(env, async (db) => {
			const judges = await db.collection<JudgeDocument>(COLLECTIONS.judges).find({ isActive: true }).toArray();
			if (judges.length === 0) return bad("There are no active judges to assign.");
			const perTeam = Math.min(judgesPerTeam, judges.length);

			const submissions = await db
				.collection<SubmissionDocument>(COLLECTIONS.submissions)
				.find({ roundKey: ROUND_KEY, type: SUBMISSION_TYPE.theme, status: "submitted" })
				.toArray();
			if (submissions.length === 0) return bad("No submitted questionnaires to assign.");

			if (reset) {
				const qIds = submissions.map((s) => s._id!).filter(Boolean);
				await db.collection(COLLECTIONS.assignments).deleteMany({ questionnaireId: { $in: qIds } });
			}

			// Balance load across judges; random tiebreak so distribution varies.
			const load = new Map<string, number>(judges.map((j) => [String(j._id), 0]));
			if (!reset) {
				const existing = await db.collection(COLLECTIONS.assignments).find({}).toArray();
				for (const a of existing) {
					const k = String(a.judgeId);
					if (load.has(k)) load.set(k, (load.get(k) ?? 0) + 1);
				}
			}

			let created = 0;
			for (const submission of submissions) {
				const already = reset
					? new Set<string>()
					: new Set(
							(await db.collection(COLLECTIONS.assignments).find({ questionnaireId: submission._id }).toArray()).map(
								(a) => String(a.judgeId),
							),
						);
				const pool = judges.filter((j) => !already.has(String(j._id)));
				const chosen = pickLeastLoaded(pool, load, perTeam - already.size);
				for (const judge of chosen) {
					await upsertAssignment(db, submission._id!, judge._id!, submission.teamId, judge.defaultWeight ?? 1, auth.payload.sub);
					load.set(String(judge._id), (load.get(String(judge._id)) ?? 0) + 1);
					created += 1;
				}
			}

			await audit(db, auth.payload.sub, "assignment.auto", `perTeam=${perTeam}`);
			return { status: 200, body: { ok: true, created, judgesPerTeam: perTeam } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

// --- helpers ----------------------------------------------------------------

function pickLeastLoaded(pool: JudgeDocument[], load: Map<string, number>, n: number): JudgeDocument[] {
	if (n <= 0) return [];
	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	shuffled.sort((a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0));
	return shuffled.slice(0, n);
}

async function upsertAssignment(
	db: Db,
	questionnaireId: ObjectId,
	judgeId: ObjectId,
	teamId: string,
	weight: number,
	adminSub: string,
): Promise<void> {
	const now = new Date();
	await db.collection(COLLECTIONS.assignments).updateOne(
		{ questionnaireId, judgeId },
		{
			$set: { teamId, weight, status: "assigned", updatedAt: now },
			$setOnInsert: {
				questionnaireId,
				judgeId,
				assignedBy: new ObjectId(adminSub),
				assignedAt: now,
				createdAt: now,
			},
		},
		{ upsert: true },
	);
}

async function loadJudge(db: Db, judgeId: string): Promise<JudgeDocument | null> {
	try {
		return db.collection<JudgeDocument>(COLLECTIONS.judges).findOne({ _id: new ObjectId(judgeId) });
	} catch {
		return null;
	}
}

async function audit(db: Db, actorId: string, action: string, targetId: string) {
	await db.collection(COLLECTIONS.auditEvents).insertOne({
		actorRole: "admin",
		actorId,
		action,
		targetType: "assignment",
		targetId,
		at: new Date(),
	});
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
