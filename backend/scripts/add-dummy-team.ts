// Inserts a single dummy team with login credentials. Idempotent: re-running
// updates the same documents. `node scripts/add-dummy-team.ts`.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";
import { COLLECTIONS } from "../src/db/collections.ts";
import { hashPassword } from "../src/security/password.js";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const mongoUri = requireEnv("MONGODB_URI");
const databaseName = process.env.MONGODB_DB || inferDatabaseName(mongoUri) || "probably_paradoxical";

const TEAM_ID = "TD001";
const TEAM_NAME = "Dummy";
const TEAM_PASSWORD = "TD001@probably.paradoxical";
const MEMBER_EMAIL = "td001@dummy.local";
const MEMBER_NAME = "Dummy Lead";

const client = new MongoClient(mongoUri);

try {
	await client.connect();
	const db = client.db(databaseName);
	const now = new Date();

	// Dummy lead member.
	const member = await db.collection(COLLECTIONS.members).findOneAndUpdate(
		{ email: MEMBER_EMAIL },
		{
			$set: { email: MEMBER_EMAIL, name: MEMBER_NAME, updatedAt: now },
			$setOnInsert: { createdAt: now },
		},
		{ upsert: true, returnDocument: "after" },
	);
	const leadMemberId = member?._id as ObjectId;

	// Team document.
	await db.collection(COLLECTIONS.teams).updateOne(
		{ teamId: TEAM_ID },
		{
			$set: { teamName: TEAM_NAME, status: "active", leadMemberId, updatedAt: now },
			$setOnInsert: { teamId: TEAM_ID, createdAt: now },
		},
		{ upsert: true },
	);

	// Membership mapping (leader).
	await db.collection(COLLECTIONS.teamMembers).updateOne(
		{ teamId: TEAM_ID, memberId: leadMemberId },
		{
			$set: { roleInTeam: "leader", status: "active", updatedAt: now },
			$setOnInsert: { teamId: TEAM_ID, memberId: leadMemberId, joinedAt: now, createdAt: now },
		},
		{ upsert: true },
	);

	// Credential (shared team password).
	const digest = await hashPassword(TEAM_PASSWORD);
	await db.collection(COLLECTIONS.teamCredentials).updateOne(
		{ teamId: TEAM_ID },
		{ $set: { teamId: TEAM_ID, ...digest, updatedAt: now }, $setOnInsert: { createdAt: now } },
		{ upsert: true },
	);

	console.log(
		JSON.stringify(
			{ ok: true, database: db.databaseName, teamId: TEAM_ID, teamName: TEAM_NAME, leadMemberId },
			null,
			2,
		),
	);
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
