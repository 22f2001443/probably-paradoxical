import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, FILE_KIND, ROUND_KEYS, SUBMISSION_TYPE } from "../db/collections.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ROUND_KEY = ROUND_KEYS.stage4Presentation;
const ALLOWED_EXTENSIONS = ["ppt", "pptx", "pdf"];

/**
 * POST /team/presentation-submission — team-only. Multipart form-data:
 *   consent, file (the final presentation: PPT/PPTX or PDF).
 * Stores the file in R2 and upserts the team's Stage 4 presentation submission.
 */
export async function handlePresentationSubmission(request: Request, env: AppEnv): Promise<Result> {
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
		return { status: 400, body: { error: "You must sign the declaration." } };
	}
	if (!(file instanceof File) || file.size === 0) {
		return { status: 400, body: { error: "Attach your presentation." } };
	}

	const extension = (file.name.split(".").pop() || "").toLowerCase();
	if (!ALLOWED_EXTENSIONS.includes(extension)) {
		return { status: 400, body: { error: "The presentation must be a PPT, PPTX, or PDF." } };
	}
	if (file.size > MAX_BYTES) {
		return { status: 400, body: { error: "The presentation must be 50 MB or smaller." } };
	}

	const teamId = auth.teamId ?? auth.sub;
	const contentType = file.type || contentTypeFor(extension);

	try {
		return await withDatabase(env, async (db) => {
			const r2Key = `submissions/${teamId}/${ROUND_KEY}/presentation-${Date.now()}.${extension}`;
			const bytes = await file.arrayBuffer();
			await env.SUBMISSIONS_BUCKET!.put(r2Key, bytes, { httpMetadata: { contentType } });

			const now = new Date();
			const fileInsert = await db.collection(COLLECTIONS.files).insertOne({
				r2Key,
				kind: FILE_KIND.presentation,
				originalName: file.name,
				contentType,
				extension,
				sizeBytes: file.size,
				teamId,
				roundKey: ROUND_KEY,
				uploadedAt: now,
				uploadedByEmail: auth.email ?? "",
			});

			const submission = await db.collection(COLLECTIONS.submissions).findOneAndUpdate(
				{ teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.presentation },
				{
					$set: {
						status: "submitted",
						fileIds: [fileInsert.insertedId],
						submittedAt: now,
						updatedAt: now,
					},
					$setOnInsert: { teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.presentation, createdAt: now },
				},
				{ upsert: true, returnDocument: "after" },
			);

			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "team",
				actorId: teamId,
				action: "submission.presentation.submitted",
				targetType: "submission",
				targetId: submission?._id ? String(submission._id) : teamId,
				at: now,
			});

			return {
				status: 200,
				body: {
					ok: true,
					message: "Presentation submitted.",
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

function contentTypeFor(extension: string): string {
	if (extension === "pdf") return "application/pdf";
	if (extension === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
	return "application/vnd.ms-powerpoint";
}

function str(value: FormDataEntryValue | null): string {
	return typeof value === "string" ? value.trim() : "";
}
