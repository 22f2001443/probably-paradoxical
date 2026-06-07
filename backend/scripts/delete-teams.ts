// Deletes all participant (team) data and dependent records. Destructive and
// irreversible. Runs under Node's native TypeScript support:
// `node scripts/delete-teams.ts`.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { COLLECTIONS } from "../src/db/collections.ts";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || inferDatabaseName(mongoUri) || "probably_paradoxical";

// Every collection whose documents belong to participants/teams. Reference data
// (admins, judges, config, rounds, paradoxes, rubrics, round_schedules) and the
// audit log are intentionally left untouched.
const collectionsToClear = [
	COLLECTIONS.teams,
	COLLECTIONS.members,
	COLLECTIONS.teamMembers,
	COLLECTIONS.teamCredentials,
	COLLECTIONS.submissions,
	COLLECTIONS.questionnaires,
	COLLECTIONS.assignments,
	COLLECTIONS.evaluations,
	COLLECTIONS.results,
	COLLECTIONS.files,
];

const client = new MongoClient(mongoUri);

try {
	await client.connect();
	const db = client.db(databaseName);

	const deleted: Record<string, number> = {};
	for (const name of collectionsToClear) {
		const result = await db.collection(name).deleteMany({});
		deleted[name] = result.deletedCount;
	}

	console.log(JSON.stringify({ ok: true, database: db.databaseName, deleted }, null, 2));
} finally {
	await client.close();
}

// --- Helpers ----------------------------------------------------------------

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required. Add it to backend/.env.`);
	}
	return value;
}

function inferDatabaseName(uri: string): string | undefined {
	try {
		const parsed = new URL(uri);
		return decodeURIComponent(parsed.pathname.replace(/^\//, "")) || undefined;
	} catch {
		return undefined;
	}
}

function loadEnvFile(path: string): void {
	if (!existsSync(path)) {
		return;
	}

	const contents = readFileSync(path, "utf8");
	for (const line of contents.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = stripQuotes(trimmedLine.slice(separatorIndex + 1).trim());
		process.env[key] ??= value;
	}
}

function stripQuotes(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}
