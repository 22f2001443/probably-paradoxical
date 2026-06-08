// MongoDB `$jsonSchema` validators, applied with validationLevel "moderate" and
// validationAction "error". `required` lists only fields that are always present;
// everything else is optional so the model stays forgiving as it evolves.
import { COLLECTIONS } from "./collections.ts";

const digestProps = {
	passwordHash: { bsonType: "string" },
	passwordSalt: { bsonType: "string" },
	passwordAlgorithm: { bsonType: "string" },
	passwordIterations: { bsonType: "number" },
} as const;

const digestRequired = [
	"passwordHash",
	"passwordSalt",
	"passwordAlgorithm",
	"passwordIterations",
];

export const COLLECTION_VALIDATORS: Record<string, { $jsonSchema: Record<string, unknown> }> = {
	[COLLECTIONS.admins]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["email", ...digestRequired, "role", "isActive", "createdAt", "updatedAt"],
			properties: {
				email: { bsonType: "string" },
				username: { bsonType: "string" },
				name: { bsonType: "string" },
				...digestProps,
				role: { enum: ["admin"] },
				isActive: { bsonType: "bool" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
				lastLoginAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.judges]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["email", "name", ...digestRequired, "isActive", "createdAt", "updatedAt"],
			properties: {
				email: { bsonType: "string" },
				name: { bsonType: "string" },
				affiliation: { bsonType: "string" },
				expertise: { bsonType: "array", items: { bsonType: "string" } },
				...digestProps,
				defaultWeight: { bsonType: "number" },
				isActive: { bsonType: "bool" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
				lastLoginAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.teams]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "teamName", "status", "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				teamName: { bsonType: "string" },
				// Computed: true only when the team has no `unregistered` member.
				pure: { bsonType: "bool" },
				iconFileId: { bsonType: "objectId" },
				leadMemberId: { bsonType: "objectId" },
				status: { enum: ["active", "eliminated", "winner", "withdrawn"] },
				currentRoundKey: { bsonType: "string" },
				progress: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["roundKey", "outcome", "at"],
						properties: {
							roundKey: { bsonType: "string" },
							outcome: { enum: ["advanced", "eliminated"] },
							at: { bsonType: "date" },
						},
					},
				},
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.members]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["email", "name", "createdAt", "updatedAt"],
			properties: {
				email: { bsonType: "string" },
				name: { bsonType: "string" },
				gender: { bsonType: "string" },
				level: { bsonType: "string" },
				phone: { bsonType: "string" },
				affiliation: { bsonType: "string" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.teamMembers]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "memberId", "roleInTeam", "status", "joinedAt", "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				memberId: { bsonType: "objectId" },
				roleInTeam: { enum: ["leader", "member"] },
				tag: { bsonType: "string" },
				status: { enum: ["active", "removed"] },
				joinedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.teamCredentials]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", ...digestRequired, "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				...digestProps,
				lastUsedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.config]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["currentRoundKey", "teamSize", "targetPopulations", "scoringDefaults", "updatedAt"],
			properties: {
				competitionName: { bsonType: "string" },
				branding: { bsonType: "object" },
				currentRoundKey: { bsonType: "string" },
				teamSize: {
					bsonType: "object",
					required: ["min", "max"],
					properties: { min: { bsonType: "number" }, max: { bsonType: "number" } },
				},
				targetPopulations: { bsonType: "array", items: { bsonType: "string" } },
				scoringDefaults: { bsonType: "object" },
				featureFlags: { bsonType: "object" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.rounds]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["roundKey", "order", "title", "state", "submissionType", "requiresJudging", "createdAt", "updatedAt"],
			properties: {
				roundKey: {
					enum: ["stage0_release", "stage1_submission", "stage2_data_collection", "stage3_analysis", "stage4_presentation"],
				},
				order: { bsonType: "number" },
				title: { bsonType: "string" },
				description: { bsonType: "string" },
				opensAt: { bsonType: "date" },
				closesAt: { bsonType: "date" },
				state: { enum: ["upcoming", "open", "closed", "results_published", "stale"] },
				submissionType: { enum: ["none", "theme", "dataset", "analysis_zip", "presentation"] },
				requiresJudging: { bsonType: "bool" },
				rubricKey: { bsonType: "string" },
				scoring: { bsonType: "object" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.paradoxes]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["paradoxCode", "name", "description", "state", "createdAt", "updatedAt"],
			properties: {
				paradoxCode: { bsonType: "string" },
				name: { bsonType: "string" },
				description: { bsonType: "string" },
				example: { bsonType: "string" },
				category: { bsonType: "string" },
				tags: { bsonType: "array", items: { bsonType: "string" } },
				state: { enum: ["draft", "published"] },
				publishedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.rubrics]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["rubricKey", "version", "appliesTo", "criteria", "isActive", "createdAt", "updatedAt"],
			properties: {
				rubricKey: { bsonType: "string" },
				version: { bsonType: "number" },
				appliesTo: { enum: ["questionnaire"] },
				criteria: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["key", "label", "maxScore", "weight"],
						properties: {
							key: { bsonType: "string" },
							label: { bsonType: "string" },
							description: { bsonType: "string" },
							maxScore: { bsonType: "number" },
							weight: { bsonType: "number" },
						},
					},
				},
				isActive: { bsonType: "bool" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.submissions]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "roundKey", "type", "status", "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				roundKey: { bsonType: "string" },
				type: { enum: ["theme", "dataset", "analysis_zip", "presentation"] },
				status: { enum: ["draft", "submitted", "under_review", "accepted", "rejected"] },
				theme: {
					bsonType: "object",
					required: ["paradoxCode", "theme", "targetPopulation"],
					properties: {
						paradoxCode: { bsonType: "string" },
						theme: { bsonType: "string" },
						targetPopulation: { bsonType: "string" },
						rationale: { bsonType: "string" },
					},
				},
				questionnaireId: { bsonType: "objectId" },
				fileIds: { bsonType: "array", items: { bsonType: "objectId" } },
				submittedByMemberId: { bsonType: "objectId" },
				submittedAt: { bsonType: "date" },
				reviewedBy: { bsonType: "objectId" },
				reviewedAt: { bsonType: "date" },
				decisionNote: { bsonType: "string" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.questionnaires]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "paradoxCode", "theme", "targetPopulation", "status", "items", "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				paradoxCode: { bsonType: "string" },
				theme: { bsonType: "string" },
				targetPopulation: { bsonType: "string" },
				status: { enum: ["draft", "submitted", "under_review", "finalized"] },
				items: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["itemId", "order", "type", "prompt"],
						properties: {
							itemId: { bsonType: "string" },
							order: { bsonType: "number" },
							type: { enum: ["likert", "mcq", "open", "scale"] },
							prompt: { bsonType: "string" },
							options: { bsonType: "array", items: { bsonType: "string" } },
							meta: { bsonType: "object" },
						},
					},
				},
				lockedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.files]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["r2Key", "kind", "originalName", "contentType", "extension", "sizeBytes", "teamId", "uploadedAt", "uploadedByEmail"],
			properties: {
				r2Key: { bsonType: "string" },
				kind: { enum: ["team_icon", "dataset", "analysis_zip", "questionnaire_pdf", "presentation"] },
				originalName: { bsonType: "string" },
				contentType: { bsonType: "string" },
				extension: { bsonType: "string" },
				sizeBytes: { bsonType: "number" },
				checksum: { bsonType: "string" },
				teamId: { bsonType: "string" },
				roundKey: { bsonType: "string" },
				submissionId: { bsonType: "objectId" },
				uploadedAt: { bsonType: "date" },
				uploadedByMemberId: { bsonType: "objectId" },
				uploadedByEmail: { bsonType: "string" },
			},
		},
	},

	[COLLECTIONS.assignments]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["questionnaireId", "judgeId", "teamId", "status", "assignedBy", "assignedAt", "createdAt", "updatedAt"],
			properties: {
				questionnaireId: { bsonType: "objectId" },
				judgeId: { bsonType: "objectId" },
				teamId: { bsonType: "string" },
				weight: { bsonType: "number" },
				status: { enum: ["assigned", "in_progress", "completed"] },
				assignedBy: { bsonType: "objectId" },
				assignedAt: { bsonType: "date" },
				dueAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.evaluations]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["questionnaireId", "judgeId", "teamId", "rubricKey", "rubricVersion", "criterionScores", "rawTotal", "status", "createdAt", "updatedAt"],
			properties: {
				questionnaireId: { bsonType: "objectId" },
				judgeId: { bsonType: "objectId" },
				teamId: { bsonType: "string" },
				rubricKey: { bsonType: "string" },
				rubricVersion: { bsonType: "number" },
				itemScores: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["itemId", "criterionKey", "score"],
						properties: {
							itemId: { bsonType: "string" },
							criterionKey: { bsonType: "string" },
							score: { bsonType: "number" },
							comment: { bsonType: "string" },
						},
					},
				},
				criterionScores: {
					bsonType: "array",
					items: {
						bsonType: "object",
						required: ["criterionKey", "score"],
						properties: {
							criterionKey: { bsonType: "string" },
							score: { bsonType: "number" },
						},
					},
				},
				rawTotal: { bsonType: "number" },
				recommendation: { enum: ["advance", "borderline", "reject"] },
				status: { enum: ["draft", "submitted"] },
				submittedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.results]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["roundKey", "teamId", "outcome", "publishedBy", "publishedAt"],
			properties: {
				roundKey: { bsonType: "string" },
				teamId: { bsonType: "string" },
				outcome: { enum: ["advanced", "eliminated"] },
				aggregateScore: { bsonType: "number" },
				rank: { bsonType: "number" },
				breakdown: { bsonType: "object" },
				summary: { bsonType: "string" },
				publishedBy: { bsonType: "objectId" },
				publishedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.roundSchedules]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["roundKey", "runAt", "status", "makeCurrent", "createdBy", "createdAt"],
			properties: {
				roundKey: { bsonType: "string" },
				runAt: { bsonType: "date" },
				status: { enum: ["pending", "applied", "cancelled"] },
				makeCurrent: { bsonType: "bool" },
				createdBy: { bsonType: "string" },
				createdAt: { bsonType: "date" },
				appliedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.passwordResets]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["tokenHash", "subjectType", "subjectId", "email", "expiresAt", "createdAt"],
			properties: {
				tokenHash: { bsonType: "string" },
				subjectType: { enum: ["admin", "judge", "team"] },
				subjectId: { bsonType: "string" },
				email: { bsonType: "string" },
				expiresAt: { bsonType: "date" },
				usedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.attendance]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["teamId", "day", "present", "markedBy", "markedAt", "createdAt", "updatedAt"],
			properties: {
				teamId: { bsonType: "string" },
				day: { enum: ["day1", "day2", "day3"] },
				present: { bsonType: "bool" },
				markedBy: { bsonType: "objectId" },
				markedAt: { bsonType: "date" },
				createdAt: { bsonType: "date" },
				updatedAt: { bsonType: "date" },
			},
		},
	},

	[COLLECTIONS.auditEvents]: {
		$jsonSchema: {
			bsonType: "object",
			required: ["actorRole", "actorId", "action", "targetType", "targetId", "at"],
			properties: {
				actorRole: { enum: ["admin", "team", "judge", "system"] },
				actorId: { bsonType: "string" },
				action: { bsonType: "string" },
				targetType: { bsonType: "string" },
				targetId: { bsonType: "string" },
				before: { bsonType: "object" },
				after: { bsonType: "object" },
				ip: { bsonType: "string" },
				userAgent: { bsonType: "string" },
				at: { bsonType: "date" },
			},
		},
	},
};
