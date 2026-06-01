export const DATABASE_SCHEMA_VERSION = 1;

export const COLLECTIONS = Object.freeze({
	users: "users",
	admins: "admins",
	passwords: "passwords",
});

export const COLLECTION_VALIDATORS = Object.freeze({
	[COLLECTIONS.users]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "teamName", "members", "createdAt", "updatedAt"],
			properties: {
				teamId: {
					bsonType: "string",
					description: "Public team identifier, for example T01.",
				},
				teamName: {
					bsonType: "string",
				},
				members: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["name", "email"],
						properties: {
							name: { bsonType: "string" },
							email: { bsonType: "string" },
							tag: { bsonType: "string" },
						},
					},
				},
				rosterLastUpdated: {
					bsonType: "string",
				},
				rosterLastUpdatedIso: {
					bsonType: "string",
				},
				createdAt: {
					bsonType: "date",
				},
				updatedAt: {
					bsonType: "date",
				},
			},
		},
	},
	[COLLECTIONS.admins]: {
		$jsonSchema: {
			bsonType: "object",
			required: [
				"email",
				"passwordHash",
				"passwordSalt",
				"passwordAlgorithm",
				"passwordIterations",
				"role",
				"isActive",
				"createdAt",
				"updatedAt",
			],
			properties: {
				email: { bsonType: "string" },
				username: { bsonType: "string" },
				name: { bsonType: "string" },
				passwordHash: { bsonType: "string" },
				passwordSalt: { bsonType: "string" },
				passwordAlgorithm: { bsonType: "string" },
				passwordIterations: { bsonType: "number" },
				role: {
					enum: ["admin"],
				},
				isActive: { bsonType: "bool" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
				lastLoginAt: { bsonType: "date" },
			},
		},
	},
	[COLLECTIONS.passwords]: {
		$jsonSchema: {
			bsonType: "object",
			required: [
				"teamId",
				"passwordHash",
				"passwordSalt",
				"passwordAlgorithm",
				"passwordIterations",
				"createdAt",
				"updatedAt",
			],
			properties: {
				teamId: { bsonType: "string" },
				passwordHash: { bsonType: "string" },
				passwordSalt: { bsonType: "string" },
				passwordAlgorithm: { bsonType: "string" },
				passwordIterations: { bsonType: "number" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
				lastUsedAt: { bsonType: "date" },
			},
		},
	},
});

export const COLLECTION_INDEXES = Object.freeze({
	[COLLECTIONS.users]: [
		{
			keys: { teamId: 1 },
			options: { name: "users_teamId_unique", unique: true },
		},
		{
			keys: { "members.email": 1 },
			options: { name: "users_members_email" },
		},
	],
	[COLLECTIONS.admins]: [
		{
			keys: { email: 1 },
			options: { name: "admins_email_unique", unique: true },
		},
		{
			keys: { username: 1 },
			options: { name: "admins_username_unique", unique: true, sparse: true },
		},
	],
	[COLLECTIONS.passwords]: [
		{
			keys: { teamId: 1 },
			options: { name: "passwords_teamId_unique", unique: true },
		},
	],
});

export async function ensureMongoCollections(db) {
	const existingCollections = new Set(
		(await db.listCollections({}, { nameOnly: true }).toArray()).map(
			(collection) => collection.name,
		),
	);
	const createdCollections = [];
	const updatedCollections = [];
	const indexes = [];

	for (const [collectionName, validator] of Object.entries(COLLECTION_VALIDATORS)) {
		if (!existingCollections.has(collectionName)) {
			await db.createCollection(collectionName, {
				validator,
				validationAction: "error",
				validationLevel: "moderate",
			});
			createdCollections.push(collectionName);
		} else {
			await db.command({
				collMod: collectionName,
				validator,
				validationAction: "error",
				validationLevel: "moderate",
			});
			updatedCollections.push(collectionName);
		}

		for (const index of COLLECTION_INDEXES[collectionName] ?? []) {
			const indexName = await db
				.collection(collectionName)
				.createIndex(index.keys, index.options);
			indexes.push({ collection: collectionName, name: indexName });
		}
	}

	return {
		schemaVersion: DATABASE_SCHEMA_VERSION,
		createdCollections,
		updatedCollections,
		indexes,
	};
}
