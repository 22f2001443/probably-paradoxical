import type { Db, MongoClient as MongoClientType } from "mongodb";
import { ensureMongoCollections } from "./schema.ts";

export interface AppEnv extends Env {
	MONGODB_URI?: string;
	MONGODB_DB?: string;
	SETUP_SECRET?: string;
	JWT_SECRET?: string;
	JWT_EXPIRES_IN_SECONDS?: string;
}

export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigurationError";
	}
}

export interface MongoConnection {
	db: Db;
	close: () => Promise<void>;
}

/**
 * Opens a fresh MongoDB connection for the lifetime of a single request.
 *
 * The connection (and its TCP socket) is bound to the workerd request that
 * created it and cannot be reused by a later request, so we deliberately do
 * NOT cache the client across requests — always close it in a `finally`.
 * For higher throughput, front this with Cloudflare Hyperdrive or the Atlas
 * Data API instead of pooling here.
 */
export async function connectDatabase(env: AppEnv): Promise<MongoConnection> {
	const uri = env.MONGODB_URI;
	if (!uri) {
		throw new ConfigurationError("MONGODB_URI is not configured.");
	}

	const { MongoClient } = await import("mongodb");
	const client = new MongoClient(uri, { maxPoolSize: 1 });
	await client.connect();

	return {
		db: client.db(getDatabaseName(env)),
		close: () => closeQuietly(client),
	};
}

/** Convenience wrapper: open a connection, run `fn`, always close. */
export async function withDatabase<T>(env: AppEnv, fn: (db: Db) => Promise<T>): Promise<T> {
	const connection = await connectDatabase(env);
	try {
		return await fn(connection.db);
	} finally {
		await connection.close();
	}
}

export async function ensureDatabase(env: AppEnv) {
	return withDatabase(env, async (db) => {
		const result = await ensureMongoCollections(db);
		return { database: db.databaseName, ...result };
	});
}

function getDatabaseName(env: AppEnv): string {
	return env.MONGODB_DB || inferDatabaseName(env.MONGODB_URI) || "probably_paradoxical";
}

function inferDatabaseName(uri?: string): string | undefined {
	if (!uri) {
		return undefined;
	}

	try {
		const parsed = new URL(uri);
		const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
		return databaseName || undefined;
	} catch {
		return undefined;
	}
}

async function closeQuietly(client: MongoClientType): Promise<void> {
	try {
		await client.close();
	} catch {
		// best-effort cleanup; the request is already done
	}
}
