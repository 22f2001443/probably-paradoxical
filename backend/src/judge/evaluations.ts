import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type {
	AssignmentDocument,
	EvaluationDocument,
	FileDocument,
	RubricDocument,
	SubmissionDocument,
	TeamDocument,
} from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

/** Active questionnaire rubric (latest version). */
async function activeRubric(db: Db): Promise<RubricDocument | null> {
	return db
		.collection<RubricDocument>(COLLECTIONS.rubrics)
		.findOne({ appliesTo: "questionnaire", isActive: true }, { sort: { version: -1 } });
}

/** GET /judge/queue — the signed-in judge's assigned questionnaires + rubric + own scores. */
export async function handleJudgeQueue(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) return { status: 401, body: { error: "Authentication required." } };
	if (auth.role !== "judge") return { status: 403, body: { error: "Judge access required." } };

	let judgeId: ObjectId;
	try {
		judgeId = new ObjectId(auth.sub);
	} catch {
		return { status: 400, body: { error: "Invalid judge token." } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const assignments = await db
				.collection<AssignmentDocument>(COLLECTIONS.assignments)
				.find({ judgeId })
				.toArray();

			const qIds = assignments.map((a) => a.questionnaireId);
			const [submissions, evaluations, rubric] = await Promise.all([
				qIds.length
					? db.collection<SubmissionDocument>(COLLECTIONS.submissions).find({ _id: { $in: qIds } }).toArray()
					: Promise.resolve([]),
				qIds.length
					? db.collection<EvaluationDocument>(COLLECTIONS.evaluations).find({ judgeId, questionnaireId: { $in: qIds } }).toArray()
					: Promise.resolve([]),
				activeRubric(db),
			]);

			const subById = new Map(submissions.map((s) => [String(s._id), s]));
			const evalByQ = new Map(evaluations.map((e) => [String(e.questionnaireId), e]));
			const teamIds = submissions.map((s) => s.teamId);
			const teams = teamIds.length
				? await db.collection<TeamDocument>(COLLECTIONS.teams).find({ teamId: { $in: teamIds } }).toArray()
				: [];
			const teamName = new Map(teams.map((t) => [t.teamId, t.teamName]));

			const queue = assignments
				.map((a) => {
					const sub = subById.get(String(a.questionnaireId));
					if (!sub) return null;
					const ev = evalByQ.get(String(a.questionnaireId));
					return {
						questionnaireId: String(a.questionnaireId),
						teamId: a.teamId,
						teamName: teamName.get(a.teamId) ?? a.teamId,
						paradoxCode: sub.theme?.paradoxCode ?? "",
						theme: sub.theme?.theme ?? "",
						rationale: sub.theme?.rationale ?? "",
						targetPopulation: sub.theme?.targetPopulation ?? "",
						hasPdf: Boolean(sub.fileIds && sub.fileIds.length > 0),
						evaluation: ev
							? {
									criterionScores: ev.criterionScores,
									rawTotal: ev.rawTotal,
									recommendation: ev.recommendation ?? null,
									status: ev.status,
								}
							: null,
					};
				})
				.filter((x): x is NonNullable<typeof x> => x !== null);

			return {
				status: 200,
				body: {
					rubric: rubric
						? {
								rubricKey: rubric.rubricKey,
								version: rubric.version,
								criteria: rubric.criteria.map((c) => ({ key: c.key, label: c.label, maxScore: c.maxScore })),
								total: rubric.criteria.reduce((s, c) => s + (c.maxScore || 0), 0),
							}
						: null,
					queue,
				},
			};
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * POST /judge/evaluations — submit (or draft) scores for an assigned questionnaire.
 * Body: { questionnaireId, criterionScores: [{criterionKey, score}], recommendation?, status? }.
 */
export async function handleSubmitEvaluation(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) return { status: 401, body: { error: "Authentication required." } };
	if (auth.role !== "judge") return { status: 403, body: { error: "Judge access required." } };

	let judgeId: ObjectId;
	try {
		judgeId = new ObjectId(auth.sub);
	} catch {
		return { status: 400, body: { error: "Invalid judge token." } };
	}

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;

	const questionnaireIdRaw = str(parsed.body.questionnaireId);
	const scoresInput = Array.isArray(parsed.body.criterionScores) ? parsed.body.criterionScores : null;
	const recommendation = str(parsed.body.recommendation);
	const status = str(parsed.body.status) === "draft" ? "draft" : "submitted";
	if (!questionnaireIdRaw || !scoresInput) return bad("questionnaireId and criterionScores are required.");

	let questionnaireId: ObjectId;
	try {
		questionnaireId = new ObjectId(questionnaireIdRaw);
	} catch {
		return bad("Invalid questionnaireId.");
	}

	try {
		return await withDatabase(env, async (db) => {
			const assignment = await db
				.collection<AssignmentDocument>(COLLECTIONS.assignments)
				.findOne({ questionnaireId, judgeId });
			if (!assignment) return { status: 403, body: { error: "You are not assigned to this questionnaire." } };

			const rubric = await activeRubric(db);
			if (!rubric) return bad("No active rubric is configured.");

			const byKey = new Map(rubric.criteria.map((c) => [c.key, c]));
			const criterionScores: { criterionKey: string; score: number }[] = [];
			for (const c of rubric.criteria) {
				const match = scoresInput.find((s) => str((s as Record<string, unknown>).criterionKey) === c.key);
				const score = Number((match as Record<string, unknown>)?.score);
				if (!Number.isFinite(score) || score < 0 || score > c.maxScore) {
					return bad(`Score for "${c.label}" must be between 0 and ${c.maxScore}.`);
				}
				criterionScores.push({ criterionKey: c.key, score });
			}
			// Reject unknown criterion keys.
			for (const s of scoresInput) {
				const k = str((s as Record<string, unknown>).criterionKey);
				if (k && !byKey.has(k)) return bad(`Unknown criterion: ${k}.`);
			}

			const rawTotal = criterionScores.reduce((sum, c) => sum + c.score, 0);
			const now = new Date();

			await db.collection(COLLECTIONS.evaluations).updateOne(
				{ questionnaireId, judgeId },
				{
					$set: {
						teamId: assignment.teamId,
						rubricKey: rubric.rubricKey,
						rubricVersion: rubric.version,
						criterionScores,
						rawTotal,
						...(recommendation ? { recommendation } : {}),
						status,
						...(status === "submitted" ? { submittedAt: now } : {}),
						updatedAt: now,
					},
					$setOnInsert: { questionnaireId, judgeId, createdAt: now },
				},
				{ upsert: true },
			);

			await db
				.collection(COLLECTIONS.assignments)
				.updateOne(
					{ questionnaireId, judgeId },
					{ $set: { status: status === "submitted" ? "completed" : "in_progress", updatedAt: now } },
				);

			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "judge",
				actorId: auth.sub,
				action: status === "submitted" ? "evaluation.submitted" : "evaluation.saved",
				targetType: "evaluation",
				targetId: assignment.teamId,
				at: now,
			});

			return { status: 200, body: { ok: true, rawTotal, status } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * GET /judge/submission-file?questionnaireId=... — streams the questionnaire PDF
 * (from R2) for a questionnaire the signed-in judge is assigned to. Returns the
 * raw file inline (not JSON), so index.ts returns this Response directly.
 */
export async function handleJudgeSubmissionFile(request: Request, env: AppEnv): Promise<Response> {
	const auth = await getAuthPayload(request, env);
	if (!auth) return fileError("Authentication required.", 401);
	if (auth.role !== "judge") return fileError("Judge access required.", 403);
	if (!env.SUBMISSIONS_BUCKET) return fileError("File storage is not configured.", 503);

	let judgeId: ObjectId;
	try {
		judgeId = new ObjectId(auth.sub);
	} catch {
		return fileError("Invalid judge token.", 400);
	}

	const qidRaw = new URL(request.url).searchParams.get("questionnaireId") ?? "";
	let questionnaireId: ObjectId;
	try {
		questionnaireId = new ObjectId(qidRaw);
	} catch {
		return fileError("Invalid questionnaireId.", 400);
	}

	try {
		return await withDatabase(env, async (db) => {
			// Only the assigned judge may read the file.
			const assignment = await db
				.collection<AssignmentDocument>(COLLECTIONS.assignments)
				.findOne({ questionnaireId, judgeId });
			if (!assignment) return fileError("You are not assigned to this questionnaire.", 403);

			const submission = await db
				.collection<SubmissionDocument>(COLLECTIONS.submissions)
				.findOne({ _id: questionnaireId });
			const fileId = submission?.fileIds?.[0];
			if (!fileId) return fileError("No file is attached to this submission.", 404);

			const fileDoc = await db.collection<FileDocument>(COLLECTIONS.files).findOne({ _id: fileId });
			if (!fileDoc) return fileError("File record not found.", 404);

			const object = await env.SUBMISSIONS_BUCKET!.get(fileDoc.r2Key);
			if (!object) return fileError("File is no longer available.", 404);

			const safeName = (fileDoc.originalName || "questionnaire.pdf").replace(/["\\\r\n]/g, "_");
			const headers = new Headers();
			headers.set("content-type", fileDoc.contentType || "application/octet-stream");
			headers.set("content-disposition", `inline; filename="${safeName}"`);
			headers.set("cache-control", "private, no-store");
			return new Response(object.body, { status: 200, headers });
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return fileError(error instanceof Error ? error.message : "Unable to load the file.", status);
	}
}

// --- helpers ----------------------------------------------------------------

function fileError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
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
