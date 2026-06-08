import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { ATTENDANCE_DAYS, ATTENDANCE_DAY_KEYS, COLLECTIONS } from "../db/collections.ts";
import type { AttendanceDocument, TeamDocument } from "../db/types.ts";
import { requireAdmin } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const DAY_KEYS = new Set<string>(ATTENDANCE_DAY_KEYS);

/** GET /admin/attendance — the event days, all teams, and present records. */
export async function handleListAttendance(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	try {
		return await withDatabase(env, async (db) => {
			const teams = await db
				.collection<TeamDocument>(COLLECTIONS.teams)
				.find({}, { projection: { _id: 0, teamId: 1, teamName: 1, status: 1 } })
				.sort({ teamId: 1 })
				.toArray();

			const records = await db
				.collection<AttendanceDocument>(COLLECTIONS.attendance)
				.find({ present: true }, { projection: { _id: 0, teamId: 1, day: 1, present: 1 } })
				.toArray();

			return {
				status: 200,
				body: { days: ATTENDANCE_DAYS, teams, attendance: records },
			};
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/attendance — mark one team for one day. Body: { teamId, day, present }. */
export async function handleMarkAttendance(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const teamId = str(parsed.body.teamId);
	const day = str(parsed.body.day);
	const present = parsed.body.present === true;
	if (!teamId || !DAY_KEYS.has(day)) return bad("Valid teamId and day are required.");

	try {
		return await withDatabase(env, async (db) => {
			await upsertAttendance(db, teamId, day, present, auth.payload.sub);
			return { status: 200, body: { ok: true, teamId, day, present } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/**
 * POST /admin/attendance/bulk — mark every team for a day at once.
 * Body: { day, present }.
 */
export async function handleBulkAttendance(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const day = str(parsed.body.day);
	const present = parsed.body.present === true;
	if (!DAY_KEYS.has(day)) return bad("Valid day is required.");

	try {
		return await withDatabase(env, async (db) => {
			const teams = await db
				.collection<TeamDocument>(COLLECTIONS.teams)
				.find({}, { projection: { teamId: 1 } })
				.toArray();
			for (const t of teams) {
				await upsertAttendance(db, t.teamId, day, present, auth.payload.sub);
			}
			return { status: 200, body: { ok: true, day, present, count: teams.length } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

// --- helpers ----------------------------------------------------------------

async function upsertAttendance(db: Db, teamId: string, day: string, present: boolean, adminSub: string) {
	const now = new Date();
	await db.collection(COLLECTIONS.attendance).updateOne(
		{ teamId, day },
		{
			$set: { teamId, day, present, markedBy: new ObjectId(adminSub), markedAt: now, updatedAt: now },
			$setOnInsert: { createdAt: now },
		},
		{ upsert: true },
	);
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
