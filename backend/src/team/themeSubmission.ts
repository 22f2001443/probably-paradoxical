import type { Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, FILE_KIND, ROUND_KEYS, SUBMISSION_TYPE } from "../db/collections.ts";
import type { ParadoxDocument } from "../db/types.ts";
import { getAuthPayload } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const ROUND_KEY = ROUND_KEYS.stage1Submission;

/**
 * POST /team/theme-submission — team-only. Multipart form-data:
 *   paradoxCode, theme, rationale (optional), consent, file (the questionnaire PDF).
 * Stores the PDF in R2 and upserts the team's theme submission.
 */
export async function handleThemeSubmission(request: Request, env: AppEnv): Promise<Result> {
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

	const paradoxCode = str(form.get("paradoxCode"));
	const theme = str(form.get("theme"));
	const rationale = str(form.get("rationale"));
	const consent = str(form.get("consent")) === "true";
	const file = form.get("file");

	if (!consent) {
		return { status: 400, body: { error: "You must accept the consent declaration." } };
	}
	if (!paradoxCode) {
		return { status: 400, body: { error: "Select a paradox." } };
	}
	if (!theme) {
		return { status: 400, body: { error: "A theme is required." } };
	}
	if (!(file instanceof File) || file.size === 0) {
		return { status: 400, body: { error: "Attach the questionnaire PDF." } };
	}
	if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
		return { status: 400, body: { error: "The questionnaire must be a PDF." } };
	}
	if (file.size > MAX_PDF_BYTES) {
		return { status: 400, body: { error: "The PDF must be 10 MB or smaller." } };
	}

	const teamId = auth.teamId ?? auth.sub;

	try {
		return await withDatabase(env, async (db) => {
			const paradox = await db
				.collection<ParadoxDocument>(COLLECTIONS.paradoxes)
				.findOne({ paradoxCode, state: "published" });
			if (!paradox) {
				return { status: 400, body: { error: "That paradox is not available." } };
			}

			// Upload the PDF to R2.
			const r2Key = `submissions/${teamId}/${ROUND_KEY}/questionnaire-${Date.now()}.pdf`;
			const bytes = await file.arrayBuffer();
			await env.SUBMISSIONS_BUCKET!.put(r2Key, bytes, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const now = new Date();
			const fileInsert = await db.collection(COLLECTIONS.files).insertOne({
				r2Key,
				kind: FILE_KIND.questionnairePdf,
				originalName: file.name,
				contentType: "application/pdf",
				extension: "pdf",
				sizeBytes: file.size,
				teamId,
				roundKey: ROUND_KEY,
				uploadedAt: now,
				uploadedByEmail: auth.email ?? "",
			});

			const setOnInsert: Record<string, unknown> = {
				teamId,
				roundKey: ROUND_KEY,
				type: SUBMISSION_TYPE.theme,
				createdAt: now,
			};
			const submission = await db.collection(COLLECTIONS.submissions).findOneAndUpdate(
				{ teamId, roundKey: ROUND_KEY, type: SUBMISSION_TYPE.theme },
				{
					$set: {
						status: "submitted",
						theme: { paradoxCode, theme, targetPopulation: "", ...(rationale ? { rationale } : {}) },
						fileIds: [fileInsert.insertedId],
						submittedAt: now,
						updatedAt: now,
					},
					$setOnInsert: setOnInsert,
				},
				{ upsert: true, returnDocument: "after" },
			);

			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "team",
				actorId: teamId,
				action: "submission.theme.submitted",
				targetType: "submission",
				targetId: submission?._id ? String(submission._id) : teamId,
				at: now,
			});

			return {
				status: 200,
				body: {
					ok: true,
					message: "Theme & questionnaire submitted.",
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
