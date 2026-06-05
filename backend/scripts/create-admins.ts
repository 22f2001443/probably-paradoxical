// Create (or update) one or more admin accounts with an argon2id password.
// Usage: ADMIN_ACCOUNTS_PASSWORD=... node scripts/create-admins.ts <email> [...]
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { COLLECTIONS } from "../src/db/collections.ts";
import { hashPassword } from "../src/security/passwords.ts";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const emails = process.argv.slice(2).map(normalizeEmail).filter(Boolean);
const password = process.env.ADMIN_ACCOUNTS_PASSWORD || process.env.ADMIN_PASSWORD;

if (emails.length === 0 || !password) {
	console.error("Usage: ADMIN_ACCOUNTS_PASSWORD=... node scripts/create-admins.ts <email> [...]");
	process.exit(1);
}
if (password.length < 8) {
	console.error("Password must be at least 8 characters.");
	process.exit(1);
}

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || "probably_paradoxical";
const client = new MongoClient(mongoUri, { family: 4 });

try {
	await client.connect();
	const db = client.db(databaseName);
	const now = new Date();
	const results = [];

	for (const email of emails) {
		const digest = await hashPassword(password);
		const username = email.split("@")[0];
		const result = await db.collection(COLLECTIONS.admins).updateOne(
			{ email },
			{
				$set: {
					email,
					username,
					name: username,
					role: "admin",
					isActive: true,
					...digest,
					updatedAt: now,
				},
				$setOnInsert: { createdAt: now },
			},
			{ upsert: true },
		);

		results.push({
			email,
			created: result.upsertedCount === 1,
			updated: result.matchedCount === 1,
			algorithm: digest.passwordAlgorithm,
		});
	}

	console.log(JSON.stringify({ ok: true, total: results.length, admins: results }, null, 2));
} finally {
	await client.close();
}

function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
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
