import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, FILE_KIND, ROUND_KEYS, SUBMISSION_TYPE } from "../db/collections.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB
const ROUND_KEY = ROUND_KEYS.stage3Analysis;

/**
 * POST /team/analysis-submission — team-only. Multipart form-data:
 *   consent, file (a .zip containing the clean dataset, analysis artifacts, and findings doc).
 * Stores the ZIP in R2 and upserts the team's Stage 3 analysis submission.
 */
export async function handleAnalysisSubmission(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}
	if (auth.role !== "team") {
		return { status: 403, body: { error: "Team access required." } };
	}
	if (!env.SUBMISSIONS_BUCKET) {
		return { status: 503, body: { error: "File storage is not configured." } };
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return { status: 400, body: { error: "Expected multipart/form-data." } };
	}

	const consent = str(form.get("consent")) === "true";
	const file = form.get("file");

	if (!consent) {
		return { status: 400, body: { error: "You must sign the originality declaration." } };
	}
	if (!(file instanceof File) || file.size === 0) {
		return { status: 400, body: { error: "Attach your analysis ZIP." } };
	}

	const isZip =
		file.name.toLowerCase().endsWith(".zip") ||
		file.type === "application/zip" ||
		file.type === "application/x-zip-compressed";
	if (!isZip) {
		return { status: 400, body: { error: "The submission must be a single .zip file." } };
	}
	if (file.size > MAX_ZIP_BYTES) {
		return { status: 400, body: { error: "The ZIP must be 50 MB or smaller." } };
	}

	const teamId = auth.teamId ?? auth.sub;

	try {
		return await withDatabase(env, async (db) => {
			const r2Key = `submissions/${teamId}/${ROUND_KEY}/analysis-${Date.now()}.zip`;
			const bytes = await file.arrayBuffer();
			await env.SUBMISSIONS_BUCKET!.put(r2Key, bytes, {
				httpMetadata: { contentType: "application/zip" },
			});

			const now = new Date();
			const fileInsert = await db.collection(COLLECTIONS.files).insertOne({
				r2Key,
				kind: FILE_KIND.analysisZip,
				originalName: file.name,
				contentType: "application/zip",
				extension: "zip",
				sizeBytes: file.size,
				teamId,
				roundKey: ROUND_KEY,
				uploadedAt: now,
				uploadedByEmail: auth.email ?? "",
			});

			const submission = await db.collection(COLLECTIONS.submissions).findOneAndUpdate(
				{ teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.analysisZip },
				{
					$set: {
						status: "submitted",
						fileIds: [fileInsert.insertedId],
						submittedAt: now,
						updatedAt: now,
					},
					$setOnInsert: { teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.analysisZip, createdAt: now },
				},
				{ upsert: true, returnDocument: "after" },
			);

			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "team",
				actorId: teamId,
				action: "submission.analysis.submitted",
				targetType: "submission",
				targetId: submission?._id ? String(submission._id) : teamId,
				at: now,
			});

			return {
				status: 200,
				body: {
					ok: true,
					message: "Analysis submitted.",
					submissionId: submission?._id ? String(submission._id) : null,
					fileId: String(fileInsert.insertedId),
				},
			};
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return {
			status,
			body: { error: error instanceof Error ? error.message : "Unable to submit." },
		};
	}
}

function str(value: FormDataEntryValue | null): string {
	return typeof value === "string" ? value.trim() : "";
}
