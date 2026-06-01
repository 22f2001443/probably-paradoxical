import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import YAML from "yaml";
import { COLLECTIONS, ensureMongoCollections } from "../src/db/schema.js";
import { hashPassword } from "../src/security/password.js";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(backendRoot, ".env"));

const mongoUri = requireEnv("MONGODB_URI");
const databaseName =
	process.env.MONGODB_DB || inferDatabaseName(mongoUri) || "probably_paradoxical";
const teamInfoPath = resolve(backendRoot, "../frontend/src/data/teamInfo.yml");

const teamInfo = YAML.parse(await readFile(teamInfoPath, "utf8"));
const teams = normalizeTeams(teamInfo);

const client = new MongoClient(mongoUri);

try {
	await client.connect();

	const db = client.db(databaseName);
	const schemaResult = await ensureMongoCollections(db);
	const teamResult = await upsertTeams(db, teamInfo, teams);
	const adminResult = await upsertInitialAdmin(db);
	const passwordResult = await upsertTeamPasswords(db, teams);

	console.log(
		JSON.stringify(
			{
				ok: true,
				database: db.databaseName,
				schema: schemaResult,
				teams: teamResult,
				admin: adminResult,
				passwords: passwordResult,
			},
			null,
			2,
		),
	);
} finally {
	await client.close();
}

async function upsertTeams(db, teamInfoDocument, normalizedTeams) {
	if (normalizedTeams.length === 0) {
		return { matched: 0, modified: 0, upserted: 0 };
	}

	const now = new Date();
	const operations = normalizedTeams.map((team) => ({
		updateOne: {
			filter: { teamId: team.teamId },
			update: {
				$set: {
					teamName: team.teamName,
					members: team.members,
					rosterLastUpdated: teamInfoDocument.lastUpdated,
					rosterLastUpdatedIso: teamInfoDocument.lastUpdatedIso,
					updatedAt: now,
				},
				$setOnInsert: {
					teamId: team.teamId,
					createdAt: now,
				},
			},
			upsert: true,
		},
	}));

	const result = await db.collection(COLLECTIONS.users).bulkWrite(operations, {
		ordered: false,
	});

	return {
		matched: result.matchedCount,
		modified: result.modifiedCount,
		upserted: result.upsertedCount,
	};
}

async function upsertInitialAdmin(db) {
	const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD;

	if (!email && !password) {
		return { skipped: true, reason: "ADMIN_EMAIL and ADMIN_PASSWORD not provided" };
	}

	if (!email || !password) {
		throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD, or leave both empty.");
	}

	const now = new Date();
	const digest = await hashPassword(password);
	const result = await db.collection(COLLECTIONS.admins).updateOne(
		{ email },
		{
			$set: {
				email,
				username: process.env.ADMIN_USERNAME?.trim() || email,
				name: process.env.ADMIN_NAME?.trim() || "Administrator",
				role: "admin",
				isActive: true,
				...digest,
				updatedAt: now,
			},
			$setOnInsert: {
				createdAt: now,
			},
		},
		{ upsert: true },
	);

	return {
		matched: result.matchedCount,
		modified: result.modifiedCount,
		upserted: result.upsertedCount,
	};
}

async function upsertTeamPasswords(db, teams) {
	const teamPasswords = readTeamPasswords(teams);
	const entries = Object.entries(teamPasswords);

	if (entries.length === 0) {
		return {
			skipped: true,
			reason: "TEAM_PASSWORDS_JSON or DEFAULT_TEAM_PASSWORD not provided",
		};
	}

	const validTeamIds = new Set(teams.map((team) => team.teamId));
	for (const [teamId] of entries) {
		if (!validTeamIds.has(teamId)) {
			throw new Error(`Team password provided for unknown teamId: ${teamId}`);
		}
	}

	const now = new Date();
	const operations = [];
	for (const [teamId, password] of entries) {
		const digest = await hashPassword(password);
		operations.push({
			updateOne: {
				filter: { teamId },
				update: {
					$set: {
						teamId,
						...digest,
						updatedAt: now,
					},
					$setOnInsert: {
						createdAt: now,
					},
				},
				upsert: true,
			},
		});
	}

	const result = await db.collection(COLLECTIONS.passwords).bulkWrite(operations, {
		ordered: false,
	});

	return {
		matched: result.matchedCount,
		modified: result.modifiedCount,
		upserted: result.upsertedCount,
	};
}

function readTeamPasswords(teams) {
	const configuredPasswords = process.env.TEAM_PASSWORDS_JSON
		? JSON.parse(process.env.TEAM_PASSWORDS_JSON)
		: {};
	const defaultPassword = process.env.DEFAULT_TEAM_PASSWORD;

	if (defaultPassword) {
		for (const team of teams) {
			configuredPasswords[team.teamId] ??= defaultPassword;
		}
	}

	for (const [teamId, password] of Object.entries(configuredPasswords)) {
		if (typeof password !== "string" || password.length === 0) {
			throw new Error(`Password for ${teamId} must be a non-empty string.`);
		}
	}

	return configuredPasswords;
}

function normalizeTeams(teamInfoDocument) {
	if (!Array.isArray(teamInfoDocument?.teams)) {
		throw new Error("teamInfo.yml must contain a teams array.");
	}

	return teamInfoDocument.teams.map((team) => ({
		teamId: requireString(team.teamId, "teamId"),
		teamName: requireString(team.teamName, "teamName"),
		members: normalizeMembers(team.members, team.teamId),
	}));
}

function normalizeMembers(members, teamId) {
	if (!Array.isArray(members) || members.length === 0) {
		throw new Error(`Team ${teamId} must contain at least one member.`);
	}

	return members.map((member) => {
		const normalizedMember = {
			name: requireString(member.name, `member.name for ${teamId}`),
			email: requireString(member.email, `member.email for ${teamId}`),
		};

		if (member.tag) {
			normalizedMember.tag = requireString(member.tag, `member.tag for ${teamId}`);
		}

		return normalizedMember;
	});
}

function requireString(value, fieldName) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${fieldName} must be a non-empty string.`);
	}

	return value.trim();
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required. Add it to backend/.env.`);
	}

	return value;
}

function inferDatabaseName(uri) {
	try {
		const parsed = new URL(uri);
		return decodeURIComponent(parsed.pathname.replace(/^\//, "")) || undefined;
	} catch {
		return undefined;
	}
}

function loadEnvFile(path) {
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

function stripQuotes(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
