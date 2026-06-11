import { ObjectId } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { FileDocument, RoundDocument, SubmissionDocument, TeamDocument } from "../db/types.ts";
import { requireAdmin } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

/**
 * GET /admin/submissions — every team's submitted artifacts across all rounds,
 * joined with team names and the file metadata needed to download each artifact.
 */
export async function handleListSubmissions(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	try {
		return await withDatabase(env, async (db) => {
			const submissions = await db
				.collection<SubmissionDocument>(COLLECTIONS.submissions)
				.find({})
				.sort({ submittedAt: -1 })
				.toArray();

			const teamIds = [...new Set(submissions.map((s) => s.teamId))];
			const teams = teamIds.length
				? await db.collection<TeamDocument>(COLLECTIONS.teams).find({ teamId: { $in: teamIds } }).toArray()
				: [];
			const teamName = new Map(teams.map((t) => [t.teamId, t.teamName]));

			const fileIds = submissions.flatMap((s) => s.fileIds ?? []);
			const files = fileIds.length
				? await db.collection<FileDocument>(COLLECTIONS.files).find({ _id: { $in: fileIds } }).toArray()
				: [];
			const fileById = new Map(files.map((f) => [String(f._id), f]));

			const rounds = await db
				.collection<RoundDocument>(COLLECTIONS.rounds)
				.find({}, { projection: { _id: 0, roundKey: 1, title: 1, order: 1, submissionType: 1 } })
				.sort({ order: 1 })
				.toArray();

			const list = submissions.map((s) => ({
				submissionId: String(s._id),
				teamId: s.teamId,
				teamName: teamName.get(s.teamId) ?? s.teamId,
				roundKey: s.roundKey,
				type: s.type,
				status: s.status,
				submittedAt: s.submittedAt ?? null,
				paradoxCode: s.theme?.paradoxCode ?? "",
				theme: s.theme?.theme ?? "",
				files: (s.fileIds ?? [])
					.map((id) => {
						const f = fileById.get(String(id));
						return f
							? {
									fileId: String(f._id),
									name: f.originalName,
									contentType: f.contentType,
									sizeBytes: f.sizeBytes,
									extension: f.extension,
								}
							: null;
					})
					.filter((f): f is NonNullable<typeof f> => f !== null),
			}));

			return { status: 200, body: { submissions: list, rounds, generatedAt: new Date().toISOString() } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * GET /admin/submission-file?fileId=... — streams any submitted artifact (PDF,
 * dataset, analysis ZIP, presentation) from R2. Admin-only. Returns the raw file
 * inline (not JSON), so index.ts returns this Response directly.
 */
export async function handleAdminSubmissionFile(request: Request, env: AppEnv): Promise<Response> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return fileError(String(auth.error.body.error ?? "Forbidden"), auth.error.status);
	if (!env.SUBMISSIONS_BUCKET) return fileError("File storage is not configured.", 503);

	const fileIdRaw = new URL(request.url).searchParams.get("fileId") ?? "";
	let fileId: ObjectId;
	try {
		fileId = new ObjectId(fileIdRaw);
	} catch {
		return fileError("Invalid fileId.", 400);
	}

	try {
		return await withDatabase(env, async (db) => {
			const fileDoc = await db.collection<FileDocument>(COLLECTIONS.files).findOne({ _id: fileId });
			if (!fileDoc) return fileError("File record not found.", 404);

			const object = await env.SUBMISSIONS_BUCKET!.get(fileDoc.r2Key);
			if (!object) return fileError("File is no longer available.", 404);

			const safeName = (fileDoc.originalName || `artifact.${fileDoc.extension || "bin"}`).replace(/["\\\r\n]/g, "_");
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

function errorResult(error: unknown): Result {
	const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
	return { status, body: { error: error instanceof Error ? error.message : "Request failed." } };
}
