import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, ROUND_KEYS, ROUND_STATE } from "../db/collections.ts";
import type { RoundDocument, RoundScheduleDocument } from "../db/types.ts";
import { getAuthPayload, type AuthPayload } from "../auth/requireAuth.ts";
import { applySetCurrentCascade } from "./roundTransitions.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

const VALID_ROUND_KEYS = new Set<string>(Object.values(ROUND_KEYS));
const VALID_STATES = new Set<string>(Object.values(ROUND_STATE));

/**
 * Admin-only. Three modes:
 *  - { roundKey, state }                       → set one round's state (manual)
 *  - { roundKey, makeCurrent }                 → make current now (cascade)
 *  - { roundKey, makeCurrent, runAt }          → schedule the transition
 */
export async function handleUpdateRound(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;

	const roundKey = typeof parsed.body.roundKey === "string" ? parsed.body.roundKey : "";
	const state = parsed.body.state;
	const makeCurrent = parsed.body.makeCurrent === true;
	const runAtRaw = parsed.body.runAt;

	if (!VALID_ROUND_KEYS.has(roundKey)) {
		return { status: 400, body: { error: "Unknown roundKey." } };
	}
	if (state !== undefined && (typeof state !== "string" || !VALID_STATES.has(state))) {
		return { status: 400, body: { error: "Invalid round state." } };
	}
	if (!makeCurrent && state === undefined) {
		return { status: 400, body: { error: "Provide a state and/or makeCurrent." } };
	}

	// Validate an optional schedule time.
	let runAt: Date | null = null;
	if (makeCurrent && runAtRaw !== undefined && runAtRaw !== null && runAtRaw !== "") {
		const parsedDate = new Date(String(runAtRaw));
		if (Number.isNaN(parsedDate.getTime())) {
			return { status: 400, body: { error: "Invalid runAt timestamp." } };
		}
		runAt = parsedDate;
	}

	try {
		return await withDatabase(env, async (db) => {
			// Scheduled transition (future) → store it for the cron job.
			if (makeCurrent && runAt && runAt.getTime() > Date.now()) {
				const schedules = db.collection<RoundScheduleDocument>(COLLECTIONS.roundSchedules);
				// One pending schedule per round.
				await schedules.updateMany(
					{ roundKey: roundKey as RoundDocument["roundKey"], status: "pending" },
					{ $set: { status: "cancelled", appliedAt: new Date() } },
				);
				const now = new Date();
				const inserted = await schedules.insertOne({
					roundKey: roundKey as RoundDocument["roundKey"],
					runAt,
					status: "pending",
					makeCurrent: true,
					createdBy: auth.payload.sub,
					createdAt: now,
				});
				await db.collection(COLLECTIONS.auditEvents).insertOne({
					actorRole: "admin",
					actorId: auth.payload.sub,
					action: "round.scheduled",
					targetType: "round",
					targetId: roundKey,
					after: { runAt: runAt.toISOString() },
					at: now,
				});
				return {
					status: 200,
					body: { ok: true, scheduled: true, scheduleId: String(inserted.insertedId), runAt: runAt.toISOString() },
				};
			}

			// Immediate "make current" → cascade.
			if (makeCurrent) {
				await applySetCurrentCascade(db, roundKey, { actorRole: "admin", actorId: auth.payload.sub });
				return { status: 200, body: { ok: true, currentRoundKey: roundKey, applied: true } };
			}

			// Manual single-round state change.
			const rounds = db.collection<RoundDocument>(COLLECTIONS.rounds);
			const round = await rounds.findOne({ roundKey: roundKey as RoundDocument["roundKey"] });
			if (!round) return { status: 404, body: { error: "Round not found." } };

			const now = new Date();
			await rounds.updateOne(
				{ roundKey: roundKey as RoundDocument["roundKey"] },
				{ $set: { state: state as RoundDocument["state"], updatedAt: now } },
			);
			await db.collection(COLLECTIONS.auditEvents).insertOne({
				actorRole: "admin",
				actorId: auth.payload.sub,
				action: "round.state_changed",
				targetType: "round",
				targetId: roundKey,
				after: { state },
				at: now,
			});
			return { status: 200, body: { ok: true, round: { ...round, state } } };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return { status, body: { error: error instanceof Error ? error.message : "Unable to update the round." } };
	}
}

/** Admin-only: cancel a pending scheduled transition. */
export async function handleCancelSchedule(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const scheduleId = typeof parsed.body.scheduleId === "string" ? parsed.body.scheduleId : "";
	if (!scheduleId) return { status: 400, body: { error: "scheduleId is required." } };

	try {
		return await withDatabase(env, async (db) => {
			const { ObjectId } = await import("mongodb");
			let id: InstanceType<typeof ObjectId>;
			try {
				id = new ObjectId(scheduleId);
			} catch {
				return { status: 400, body: { error: "Invalid scheduleId." } };
			}
			const res = await db
				.collection<RoundScheduleDocument>(COLLECTIONS.roundSchedules)
				.updateOne({ _id: id, status: "pending" }, { $set: { status: "cancelled", appliedAt: new Date() } });
			if (res.matchedCount === 0) {
				return { status: 404, body: { error: "No pending schedule with that id." } };
			}
			return { status: 200, body: { ok: true, cancelled: true } };
		});
	} catch (error) {
		const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
		return { status, body: { error: error instanceof Error ? error.message : "Unable to cancel the schedule." } };
	}
}

async function requireAdmin(
	request: Request,
	env: AppEnv,
): Promise<{ payload: AuthPayload } | { error: Result }> {
	const payload = await getAuthPayload(request, env);
	if (!payload) return { error: { status: 401, body: { error: "Authentication required." } } };
	if (payload.role !== "admin") return { error: { status: 403, body: { error: "Admin access required." } } };
	return { payload };
}

async function readJson(
	request: Request,
): Promise<{ body: Record<string, unknown> } | { error: Result }> {
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
