import type { Collection } from "mongodb";
import type { AppEnv } from "../db/mongodb";
import { withDatabase } from "../db/mongodb";
import { COLLECTIONS } from "../db/collections.ts";
import type { ParadoxDocument } from "../db/types.ts";
import { getAuthPayload, requireAdmin } from "../auth/requireAuth.ts";

interface Result {
	status: number;
	body: Record<string, unknown>;
}

function toPublic(p: ParadoxDocument & { _id?: unknown }) {
	return {
		id: String(p._id),
		paradoxCode: p.paradoxCode,
		name: p.name,
		description: p.description,
		example: p.example ?? "",
		state: p.state,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
	};
}

/** GET /admin/paradoxes — list all paradoxes (admin). */
export async function handleListParadoxes(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	try {
		return await withDatabase(env, async (db) => {
			const items = await db
				.collection<ParadoxDocument>(COLLECTIONS.paradoxes)
				.find({})
				.sort({ paradoxCode: 1 })
				.toArray();
			return { status: 200, body: { paradoxes: items.map(toPublic) } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** GET /paradoxes — list published paradoxes (any authenticated user). */
export async function handleListPublishedParadoxes(request: Request, env: AppEnv): Promise<Result> {
	const auth = await getAuthPayload(request, env);
	if (!auth) {
		return { status: 401, body: { error: "Authentication required." } };
	}

	try {
		return await withDatabase(env, async (db) => {
			const items = await db
				.collection<ParadoxDocument>(COLLECTIONS.paradoxes)
				.find({ state: "published" })
				.sort({ paradoxCode: 1 })
				.toArray();
			return { status: 200, body: { paradoxes: items.map(toPublic) } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/paradoxes — create (admin). Body: { name, description, example? }. */
export async function handleCreateParadox(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;

	const name = str(parsed.body.name);
	const description = str(parsed.body.description);
	const example = str(parsed.body.example);
	if (!name) return bad("A paradox name is required.");
	if (!description) return bad("A description is required.");

	try {
		return await withDatabase(env, async (db) => {
			const col = db.collection<ParadoxDocument>(COLLECTIONS.paradoxes);
			const now = new Date();
			const paradoxCode = await insertWithUniqueCode(col, { name, description, example, now });
			await audit(db, auth.payload.sub, "paradox.created", paradoxCode);
			return { status: 201, body: { ok: true, paradoxCode } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/paradoxes/update — edit (admin). Body: { id, name?, description?, example?, state? }. */
export async function handleUpdateParadox(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;

	const id = str(parsed.body.id);
	if (!id) return bad("id is required.");

	const set: Record<string, unknown> = { updatedAt: new Date() };
	if (parsed.body.name !== undefined) {
		const name = str(parsed.body.name);
		if (!name) return bad("Name cannot be empty.");
		set.name = name;
	}
	if (parsed.body.description !== undefined) {
		const description = str(parsed.body.description);
		if (!description) return bad("Description cannot be empty.");
		set.description = description;
	}
	if (parsed.body.example !== undefined) {
		set.example = str(parsed.body.example);
	}
	if (parsed.body.state !== undefined) {
		const state = str(parsed.body.state);
		if (state !== "draft" && state !== "published") return bad("Invalid state.");
		set.state = state;
		if (state === "published") set.publishedAt = new Date();
	}

	try {
		return await withDatabase(env, async (db) => {
			const { ObjectId } = await import("mongodb");
			let oid: InstanceType<typeof ObjectId>;
			try {
				oid = new ObjectId(id);
			} catch {
				return bad("Invalid id.");
			}
			const res = await db
				.collection<ParadoxDocument>(COLLECTIONS.paradoxes)
				.findOneAndUpdate({ _id: oid }, { $set: set }, { returnDocument: "after" });
			if (!res) return { status: 404, body: { error: "Paradox not found." } };
			await audit(db, auth.payload.sub, "paradox.updated", res.paradoxCode);
			return { status: 200, body: { ok: true, paradox: toPublic(res) } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

/** POST /admin/paradoxes/delete — delete (admin). Body: { id }. */
export async function handleDeleteParadox(request: Request, env: AppEnv): Promise<Result> {
	const auth = await requireAdmin(request, env);
	if ("error" in auth) return auth.error;

	const parsed = await readJson(request);
	if ("error" in parsed) return parsed.error;
	const id = str(parsed.body.id);
	if (!id) return bad("id is required.");

	try {
		return await withDatabase(env, async (db) => {
			const { ObjectId } = await import("mongodb");
			let oid: InstanceType<typeof ObjectId>;
			try {
				oid = new ObjectId(id);
			} catch {
				return bad("Invalid id.");
			}
			const res = await db
				.collection<ParadoxDocument>(COLLECTIONS.paradoxes)
				.findOneAndDelete({ _id: oid });
			if (!res) return { status: 404, body: { error: "Paradox not found." } };
			await audit(db, auth.payload.sub, "paradox.deleted", res.paradoxCode);
			return { status: 200, body: { ok: true } };
		});
	} catch (error) {
		return errorResult(error);
	}
}

// --- helpers ----------------------------------------------------------------

async function insertWithUniqueCode(
	col: Collection<ParadoxDocument>,
	args: { name: string; description: string; example: string; now: Date },
): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const count = await col.estimatedDocumentCount();
		const candidate = `PX${String(count + 1 + attempt).padStart(2, "0")}`;
		const exists = await col.findOne({ paradoxCode: candidate }, { projection: { _id: 1 } });
		const paradoxCode = exists ? `PX${Math.random().toString(36).slice(2, 6).toUpperCase()}` : candidate;
		try {
			await col.insertOne({
				paradoxCode,
				name: args.name,
				description: args.description,
				...(args.example ? { example: args.example } : {}),
				state: "draft",
				createdAt: args.now,
				updatedAt: args.now,
			} as ParadoxDocument);
			return paradoxCode;
		} catch (error) {
			if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
				continue;
			}
			throw error;
		}
	}
	throw new Error("Could not allocate a unique paradox code.");
}

async function audit(db: import("mongodb").Db, actorId: string, action: string, targetId: string) {
	await db.collection(COLLECTIONS.auditEvents).insertOne({
		actorRole: "admin",
		actorId,
		action,
		targetType: "paradox",
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
