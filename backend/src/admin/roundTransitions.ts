import type { Db } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS, CONFIG_SINGLETON_ID, ROUND_STATE } from "../db/collections.ts";
import type { ConfigDocument, RoundDocument, RoundScheduleDocument } from "../db/types.ts";

export interface TransitionActor {
	actorRole: "admin" | "system";
	actorId: string;
}

/**
 * Make `roundKey` the current stage and cascade the others by order:
 *   earlier stages → stale, the new current → open, later stages → upcoming.
 * Updates config.currentRoundKey and writes an audit event.
 */
export async function applySetCurrentCascade(
	db: Db,
	roundKey: string,
	actor: TransitionActor,
): Promise<void> {
	const rounds = db.collection<RoundDocument>(COLLECTIONS.rounds);
	const all = await rounds
		.find({}, { projection: { roundKey: 1, order: 1 } })
		.sort({ order: 1 })
		.toArray();

	const target = all.find((r) => r.roundKey === roundKey);
	if (!target) {
		throw new Error(`Unknown round: ${roundKey}`);
	}

	const now = new Date();
	const operations = all.map((r) => {
		const state =
			r.order < target.order
				? ROUND_STATE.stale
				: r.order === target.order
					? ROUND_STATE.open
					: ROUND_STATE.upcoming;
		return {
			updateOne: {
				filter: { roundKey: r.roundKey },
				update: { $set: { state, updatedAt: now } },
			},
		};
	});

	if (operations.length > 0) {
		await rounds.bulkWrite(operations);
	}

	await db
		.collection<ConfigDocument>(COLLECTIONS.config)
		.updateOne(
			{ _id: CONFIG_SINGLETON_ID },
			{ $set: { currentRoundKey: roundKey as RoundDocument["roundKey"], updatedAt: now } },
		);

	await db.collection(COLLECTIONS.auditEvents).insertOne({
		actorRole: actor.actorRole,
		actorId: actor.actorId,
		action: "round.set_current",
		targetType: "round",
		targetId: roundKey,
		after: { cascade: true },
		at: now,
	});
}

/**
 * Apply every pending schedule whose `runAt` has passed. Invoked by the cron
 * trigger (and usable on demand). Catches up if the Worker was asleep.
 */
export async function runDueSchedules(env: AppEnv): Promise<{ applied: number }> {
	return withDatabase(env, async (db) => {
		const schedules = db.collection<RoundScheduleDocument>(COLLECTIONS.roundSchedules);
		const due = await schedules
			.find({ status: "pending", runAt: { $lte: new Date() } })
			.sort({ runAt: 1 })
			.toArray();

		let applied = 0;
		for (const schedule of due) {
			try {
				await applySetCurrentCascade(db, schedule.roundKey, {
					actorRole: "system",
					actorId: "scheduler",
				});
				await schedules.updateOne(
					{ _id: schedule._id },
					{ $set: { status: "applied", appliedAt: new Date() } },
				);
				applied += 1;
			} catch {
				// Skip a bad schedule (e.g. unknown round) without blocking others.
				await schedules.updateOne(
					{ _id: schedule._id },
					{ $set: { status: "cancelled", appliedAt: new Date() } },
				);
			}
		}
		return { applied };
	});
}
