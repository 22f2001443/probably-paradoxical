// Create (or update) a judge account with an argon2id password.
// Usage: node scripts/create-judge.ts <email> <name> <password> [affiliation]
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { COLLECTIONS } from "../src/db/collections.ts";
import { hashPassword } from "../src/security/passwords.ts";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const [email, name, password, affiliation] = process.argv.slice(2);
if (!email || !name || !password) {
	console.error('Usage: node scripts/create-judge.ts <email> <name> <password> [affiliation]');
	process.exit(1);
}
if (password.length < 8) {
	console.error("Password must be at least 8 characters.");
	process.exit(1);
}

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || "probably_paradoxical";
const client = new MongoClient(mongoUri);

try {
	await client.connect();
	const db = client.db(databaseName);
	const now = new Date();
	const digest = await hashPassword(password);

	const result = await db.collection(COLLECTIONS.judges).updateOne(
		{ email: email.trim().toLowerCase() },
		{
			$set: {
				email: email.trim().toLowerCase(),
				name: name.trim(),
				...(affiliation ? { affiliation: affiliation.trim() } : {}),
				defaultWeight: 1,
				isActive: true,
				...digest,
				updatedAt: now,
			},
			$setOnInsert: { createdAt: now },
		},
		{ upsert: true },
	);

	console.log(
		JSON.stringify(
			{
				ok: true,
				email: email.trim().toLowerCase(),
				algorithm: digest.passwordAlgorithm,
				created: result.upsertedCount === 1,
				updated: result.modifiedCount === 1,
			},
			null,
			2,
		),
	);
} finally {
	await client.close();
}

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`${key} is required. Add it to backend/.env.`);
	}
	return value;
}

function loadEnvFile(path: string): void {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const i = trimmed.indexOf("=");
		if (i === -1) continue;
		const key = trimmed.slice(0, i).trim();
		let value = trimmed.slice(i + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		process.env[key] ??= value;
	}
}
