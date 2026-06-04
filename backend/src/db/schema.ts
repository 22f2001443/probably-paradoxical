// Idempotent provisioning: creates every collection with its validator and
// indexes, or updates the validator in place if the collection already exists.
import type { Db } from "mongodb";
import { COLLECTIONS, DATABASE_SCHEMA_VERSION } from "./collections.ts";
import { COLLECTION_VALIDATORS } from "./validators.ts";
import { COLLECTION_INDEXES } from "./indexes.ts";

export { COLLECTIONS, DATABASE_SCHEMA_VERSION };

export interface EnsureResult {
	schemaVersion: number;
	createdCollections: string[];
	updatedCollections: string[];
	indexes: { collection: string; name: string }[];
}

export async function ensureMongoCollections(db: Db): Promise<EnsureResult> {
	const existing = new Set(
		(await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
	);

	const createdCollections: string[] = [];
	const updatedCollections: string[] = [];
	const indexes: { collection: string; name: string }[] = [];

	for (const [collectionName, validator] of Object.entries(COLLECTION_VALIDATORS)) {
		if (existing.has(collectionName)) {
			await db.command({
				collMod: collectionName,
				validator,
				validationAction: "error",
				validationLevel: "moderate",
			});
			updatedCollections.push(collectionName);
		} else {
			await db.createCollection(collectionName, {
				validator,
				validationAction: "error",
				validationLevel: "moderate",
			});
			createdCollections.push(collectionName);
		}

		for (const index of COLLECTION_INDEXES[collectionName] ?? []) {
			const name = await db.collection(collectionName).createIndex(index.keys, index.options);
			indexes.push({ collection: collectionName, name });
		}
	}

	return {
		schemaVersion: DATABASE_SCHEMA_VERSION,
		createdCollections,
		updatedCollections,
		indexes,
	};
}
