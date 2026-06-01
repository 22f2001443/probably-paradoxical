import type { Db, MongoClient as MongoClientType } from "mongodb";
import { ensureMongoCollections } from "./schema.js";

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

let cachedClientPromise: Promise<MongoClientType> | undefined;
let cachedUri: string | undefined;

export async function getDatabase(env: AppEnv): Promise<Db> {
	const uri = env.MONGODB_URI;
	if (!uri) {
		throw new ConfigurationError("MONGODB_URI is not configured.");
	}

	const client = await getMongoClient(uri);
	return client.db(getDatabaseName(env));
}

export async function ensureDatabase(env: AppEnv) {
	const db = await getDatabase(env);
	const result = await ensureMongoCollections(db);

	return {
		database: db.databaseName,
		...result,
	};
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

async function getMongoClient(uri: string): Promise<MongoClientType> {
	if (!cachedClientPromise || cachedUri !== uri) {
		const { MongoClient } = await import("mongodb");
		cachedUri = uri;
		cachedClientPromise = new MongoClient(uri, {
			maxPoolSize: 5,
		}).connect();
	}

	return cachedClientPromise;
}
