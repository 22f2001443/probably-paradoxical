// OpenAPI 3.0 specification for the probably-paradoxical backend.
// Served as JSON at GET /openapi.json and rendered by Swagger UI at GET /docs
// when SWAGGER_ENABLED=true.

const json = { "application/json": { schema: { $ref: "#/components/schemas/Error" } } };

const authResponses = {
	"401": { description: "Missing or invalid bearer token.", content: json },
	"403": { description: "Authenticated account does not have the required role.", content: json },
} as const;

const errorResponses = {
	"400": { description: "Validation failed or request body is malformed.", content: json },
	"503": { description: "Required backend configuration is missing.", content: json },
	"500": { description: "Unexpected backend error.", content: json },
} as const;

const okResponse = (description = "Request completed.") => ({
	description,
	content: {
		"application/json": {
			schema: { $ref: "#/components/schemas/OkResponse" },
		},
	},
});

const jsonBody = (schema: Record<string, unknown>, example?: Record<string, unknown>) => ({
	required: true,
	content: {
		"application/json": {
			schema,
			...(example ? { example } : {}),
		},
	},
});

const multipartBody = (
	properties: Record<string, unknown>,
	required: string[],
	encoding?: Record<string, unknown>,
) => ({
	required: true,
	content: {
		"multipart/form-data": {
			schema: {
				type: "object",
				required,
				properties,
			},
			...(encoding ? { encoding } : {}),
		},
	},
});

export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "Probably Paradoxical Backend API",
		version: "0.0.0",
		description:
			"Cloudflare Worker backend for the Probably Paradoxical portal. Provides setup, authentication, admin controls, judge workflows, team dashboards, paradox publishing, result publishing, and R2-backed file submissions.",
	},
	servers: [{ url: "http://localhost:8787", description: "Local wrangler dev" }],
	tags: [
		{ name: "Service", description: "Service metadata, health, and API documentation." },
		{ name: "Setup", description: "One-time MongoDB provisioning." },
		{ name: "Auth", description: "Authentication and password management." },
		{ name: "Admin", description: "Organizer dashboard, rounds, assignments, results, and paradox management." },
		{ name: "Judge", description: "Judge queue and evaluation submission." },
		{ name: "Team", description: "Team roster, submissions, published paradoxes, and results." },
	],
	paths: {
		"/": {
			get: {
				tags: ["Service"],
				summary: "Service info",
				responses: {
					"200": {
						description: "Service is reachable.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ServiceInfo" },
								example: { ok: true, service: "probably-paradoxical-backend" },
							},
						},
					},
				},
			},
		},
		"/health": {
			get: {
				tags: ["Service"],
				summary: "Health check",
				responses: {
					"200": {
						description: "Worker is healthy.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/Health" }, example: { ok: true } } },
					},
				},
			},
		},
		"/openapi.json": {
			get: {
				tags: ["Service"],
				summary: "OpenAPI JSON",
				description: "Returns this OpenAPI document when SWAGGER_ENABLED is true.",
				responses: {
					"200": { description: "OpenAPI document." },
					"404": { description: "Swagger/OpenAPI is disabled.", content: json },
				},
			},
		},
		"/docs": {
			get: {
				tags: ["Service"],
				summary: "Swagger UI",
				description: "Renders Swagger UI for /openapi.json when SWAGGER_ENABLED is true.",
				responses: {
					"200": { description: "Swagger UI HTML.", content: { "text/html": { schema: { type: "string" } } } },
					"404": { description: "Swagger/OpenAPI is disabled.", content: json },
				},
			},
		},
		"/setup/database": {
			post: {
				tags: ["Setup"],
				summary: "Provision database schema and indexes",
				description:
					"Creates MongoDB collections, validators, and indexes. Idempotent. Requires x-setup-secret to match SETUP_SECRET.",
				parameters: [
					{ name: "x-setup-secret", in: "header", required: true, schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Database provisioned.", content: { "application/json": { schema: { $ref: "#/components/schemas/SetupResult" } } } },
					"401": { description: "Missing or incorrect x-setup-secret header.", content: json },
					...errorResponses,
				},
			},
		},
		"/auth/signup": {
			post: {
				tags: ["Auth"],
				summary: "Register a team",
				requestBody: jsonBody({ $ref: "#/components/schemas/SignupRequest" }, {
					teamName: "Team Paradox",
					password: "a-strong-shared-password",
					leaderEmail: "lead@example.com",
					members: [
						{ name: "Lead Person", email: "lead@example.com" },
						{ name: "Second Person", email: "second@example.com" },
					],
				}),
				responses: {
					"201": { description: "Team created.", content: { "application/json": { schema: { $ref: "#/components/schemas/SignupResponse" } } } },
					"409": { description: "A member email is already registered to an active team.", content: json },
					...errorResponses,
				},
			},
		},
		"/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Log in as admin, judge, or team member",
				requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }, {
					email: "admin@example.com",
					password: "your-password",
				}),
				responses: {
					"200": { description: "Authenticated.", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
					"401": { description: "Invalid email or password.", content: json },
					...errorResponses,
				},
			},
		},
		"/auth/forgot-password": {
			post: {
				tags: ["Auth"],
				summary: "Request a password reset",
				description:
					"Starts a password reset for an admin, judge, or team. Always returns a generic acknowledgement to avoid account enumeration.",
				requestBody: jsonBody({
					type: "object",
					required: ["email"],
					properties: { email: { type: "string", format: "email" } },
				}, { email: "judge@example.com" }),
				responses: {
					"200": { description: "Generic acknowledgement.", content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordResponse" } } } },
					...errorResponses,
				},
			},
		},
		"/auth/reset-password": {
			post: {
				tags: ["Auth"],
				summary: "Reset a password with a token",
				requestBody: jsonBody({
					type: "object",
					required: ["token", "password"],
					properties: {
						token: { type: "string" },
						password: { type: "string", format: "password", minLength: 8 },
					},
				}, { token: "<reset-token>", password: "new-strong-password" }),
				responses: {
					"200": { description: "Password reset.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
					...errorResponses,
				},
			},
		},
		"/auth/change-password": {
			post: {
				tags: ["Auth"],
				summary: "Change password",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({
					type: "object",
					required: ["currentPassword", "newPassword"],
					properties: {
						currentPassword: { type: "string", format: "password" },
						newPassword: { type: "string", format: "password", minLength: 8 },
					},
				}),
				responses: {
					"200": { description: "Password updated.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/admin/overview": {
			get: {
				tags: ["Admin"],
				summary: "Admin dashboard overview",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Overview snapshot.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminOverview" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/admin/rounds": {
			post: {
				tags: ["Admin"],
				summary: "Update or schedule round state",
				description:
					"Admin-only. Set one round state, make a round current immediately, or schedule a current-round transition.",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/RoundUpdateRequest" }, {
					roundKey: "stage1_submission",
					makeCurrent: true,
					runAt: "2026-06-10T06:30:00.000Z",
				}),
				responses: { "200": okResponse("Round updated or scheduled."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/rounds/cancel": {
			post: {
				tags: ["Admin"],
				summary: "Cancel a pending round schedule",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({
					type: "object",
					required: ["scheduleId"],
					properties: { scheduleId: { type: "string" } },
				}),
				responses: { "200": okResponse("Pending schedule cancelled."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/paradoxes": {
			get: {
				tags: ["Admin"],
				summary: "List all paradoxes",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "All draft and published paradoxes.", content: { "application/json": { schema: { type: "object", properties: { paradoxes: { type: "array", items: { $ref: "#/components/schemas/Paradox" } } } } } } },
					...authResponses,
					...errorResponses,
				},
			},
			post: {
				tags: ["Admin"],
				summary: "Create a paradox",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/ParadoxCreateRequest" }, {
					name: "Simpson's Paradox",
					description: "A trend appears in groups but reverses when groups are combined.",
					example: "Admission rates can reverse after stratifying by department.",
				}),
				responses: {
					"201": { description: "Paradox created.", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, paradoxCode: { type: "string" } } } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/admin/paradoxes/update": {
			post: {
				tags: ["Admin"],
				summary: "Update a paradox",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/ParadoxUpdateRequest" }),
				responses: { "200": okResponse("Paradox updated."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/paradoxes/delete": {
			post: {
				tags: ["Admin"],
				summary: "Delete a paradox",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ type: "object", required: ["id"], properties: { id: { type: "string" } } }),
				responses: { "200": okResponse("Paradox deleted."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/assignments": {
			get: {
				tags: ["Admin"],
				summary: "List judge assignments",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Judges, submitted questionnaires, and assignment rows.", content: { "application/json": { schema: { $ref: "#/components/schemas/AssignmentsResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
			post: {
				tags: ["Admin"],
				summary: "Assign a judge to a team questionnaire",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/AssignmentRequest" }),
				responses: { "200": okResponse("Assignment created."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/assignments/delete": {
			post: {
				tags: ["Admin"],
				summary: "Delete a judge assignment",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/AssignmentRequest" }),
				responses: { "200": okResponse("Assignment deleted."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/assignments/auto": {
			post: {
				tags: ["Admin"],
				summary: "Auto-assign judges",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({
					type: "object",
					required: ["judgesPerTeam"],
					properties: {
						judgesPerTeam: { type: "integer", minimum: 1 },
						reset: { type: "boolean", default: false },
					},
				}, { judgesPerTeam: 2, reset: true }),
				responses: { "200": okResponse("Assignments created."), ...authResponses, ...errorResponses },
			},
		},
		"/admin/results": {
			get: {
				tags: ["Admin"],
				summary: "List result publishing data",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Judged rounds, teams, published results, and computed scores.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminResultsResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/admin/results/publish": {
			post: {
				tags: ["Admin"],
				summary: "Publish results for a round",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/PublishResultsRequest" }),
				responses: { "200": okResponse("Results published."), ...authResponses, ...errorResponses },
			},
		},
		"/judge/queue": {
			get: {
				tags: ["Judge"],
				summary: "Judge assignment queue",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Assigned questionnaires and rubric.", content: { "application/json": { schema: { $ref: "#/components/schemas/JudgeQueueResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/judge/evaluations": {
			post: {
				tags: ["Judge"],
				summary: "Save or submit an evaluation",
				security: [{ bearerAuth: [] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/EvaluationRequest" }),
				responses: { "200": okResponse("Evaluation saved or submitted."), ...authResponses, ...errorResponses },
			},
		},
		"/paradoxes": {
			get: {
				tags: ["Team"],
				summary: "List published paradoxes",
				description: "Authenticated endpoint used by team participants to choose from published paradox statements.",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Published paradoxes.", content: { "application/json": { schema: { type: "object", properties: { paradoxes: { type: "array", items: { $ref: "#/components/schemas/Paradox" } } } } } } },
					"401": { description: "Authentication required.", content: json },
					...errorResponses,
				},
			},
		},
		"/team/members": {
			get: {
				tags: ["Team"],
				summary: "Signed-in team's roster",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Team member roster.", content: { "application/json": { schema: { $ref: "#/components/schemas/TeamMembersResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
		"/team/theme-submission": {
			post: {
				tags: ["Team"],
				summary: "Submit theme and questionnaire PDF",
				security: [{ bearerAuth: [] }],
				requestBody: multipartBody({
					paradoxCode: { type: "string" },
					theme: { type: "string" },
					rationale: { type: "string" },
					consent: { type: "string", enum: ["true"] },
					file: { type: "string", format: "binary", description: "Questionnaire PDF, max 10 MB." },
				}, ["paradoxCode", "theme", "consent", "file"], { file: { contentType: "application/pdf" } }),
				responses: { "200": { description: "Submission saved.", content: { "application/json": { schema: { $ref: "#/components/schemas/FileSubmissionResponse" } } } }, ...authResponses, ...errorResponses },
			},
		},
		"/team/dataset-submission": {
			post: {
				tags: ["Team"],
				summary: "Submit raw dataset",
				security: [{ bearerAuth: [] }],
				requestBody: multipartBody({
					consent: { type: "string", enum: ["true"] },
					file: { type: "string", format: "binary", description: "CSV/XLS/XLSX dataset, max 25 MB." },
				}, ["consent", "file"]),
				responses: { "200": { description: "Dataset saved.", content: { "application/json": { schema: { $ref: "#/components/schemas/FileSubmissionResponse" } } } }, ...authResponses, ...errorResponses },
			},
		},
		"/team/analysis-submission": {
			post: {
				tags: ["Team"],
				summary: "Submit analysis ZIP",
				security: [{ bearerAuth: [] }],
				requestBody: multipartBody({
					consent: { type: "string", enum: ["true"] },
					file: { type: "string", format: "binary", description: "Analysis ZIP, max 50 MB." },
				}, ["consent", "file"], { file: { contentType: "application/zip" } }),
				responses: { "200": { description: "Analysis saved.", content: { "application/json": { schema: { $ref: "#/components/schemas/FileSubmissionResponse" } } } }, ...authResponses, ...errorResponses },
			},
		},
		"/team/presentation-submission": {
			post: {
				tags: ["Team"],
				summary: "Submit final presentation",
				security: [{ bearerAuth: [] }],
				requestBody: multipartBody({
					consent: { type: "string", enum: ["true"] },
					file: { type: "string", format: "binary", description: "PPT/PPTX/PDF presentation, max 50 MB." },
				}, ["consent", "file"]),
				responses: { "200": { description: "Presentation saved.", content: { "application/json": { schema: { $ref: "#/components/schemas/FileSubmissionResponse" } } } }, ...authResponses, ...errorResponses },
			},
		},
		"/team/results": {
			get: {
				tags: ["Team"],
				summary: "Signed-in team's published results",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Published results for the signed-in team.", content: { "application/json": { schema: { $ref: "#/components/schemas/TeamResultsResponse" } } } },
					...authResponses,
					...errorResponses,
				},
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
		},
		schemas: {
			ServiceInfo: {
				type: "object",
				properties: { ok: { type: "boolean" }, service: { type: "string" } },
			},
			Health: { type: "object", properties: { ok: { type: "boolean" } } },
			Error: { type: "object", properties: { error: { type: "string" } } },
			OkResponse: { type: "object", properties: { ok: { type: "boolean" } } },
			MessageResponse: { type: "object", properties: { message: { type: "string" } } },
			SetupResult: {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					database: { type: "string" },
					schemaVersion: { type: "integer" },
					createdCollections: { type: "array", items: { type: "string" } },
					updatedCollections: { type: "array", items: { type: "string" } },
					indexes: { type: "array", items: { type: "object" } },
				},
			},
			SignupRequest: {
				type: "object",
				required: ["teamName", "password", "members"],
				properties: {
					teamName: { type: "string" },
					password: { type: "string", format: "password", minLength: 8 },
					leaderEmail: { type: "string", format: "email" },
					members: {
						type: "array",
						minItems: 2,
						maxItems: 5,
						items: {
							type: "object",
							required: ["name", "email"],
							properties: {
								name: { type: "string" },
								email: { type: "string", format: "email" },
								tag: { type: "string" },
							},
						},
					},
				},
			},
			SignupResponse: {
				type: "object",
				properties: {
					team: { type: "object" },
					token: { type: "string", nullable: true },
					tokenType: { type: "string", example: "Bearer" },
					expiresIn: { type: "integer" },
					user: { type: "object" },
				},
			},
			LoginRequest: {
				type: "object",
				required: ["email", "password"],
				properties: {
					email: { type: "string", format: "email" },
					password: { type: "string", format: "password" },
				},
			},
			LoginResponse: {
				type: "object",
				properties: {
					token: { type: "string" },
					tokenType: { type: "string", example: "Bearer" },
					expiresIn: { type: "integer" },
					user: {
						type: "object",
						properties: {
							role: { type: "string", enum: ["admin", "judge", "team"] },
							email: { type: "string" },
							username: { type: "string" },
							name: { type: "string" },
							teamId: { type: "string" },
							teamName: { type: "string" },
							roleInTeam: { type: "string", enum: ["leader", "member"] },
						},
					},
				},
			},
			ForgotPasswordResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					devResetToken: { type: "string", description: "Development only." },
					devResetPath: { type: "string", description: "Development only." },
					expiresInSeconds: { type: "integer" },
				},
			},
			AdminOverview: {
				type: "object",
				properties: {
					counts: { type: "object" },
					paradoxes: { type: "object" },
					currentRoundKey: { type: "string", nullable: true },
					currentRound: { type: "object", nullable: true },
					rounds: { type: "array", items: { type: "object" } },
					schedules: { type: "array", items: { type: "object" } },
					rubric: { type: "object", nullable: true },
					recentActivity: { type: "array", items: { type: "object" } },
					generatedAt: { type: "string", format: "date-time" },
				},
			},
			RoundUpdateRequest: {
				type: "object",
				required: ["roundKey"],
				properties: {
					roundKey: { type: "string", enum: ["stage0_release", "stage1_submission", "stage2_data_collection", "stage3_analysis", "stage4_presentation"] },
					state: { type: "string", enum: ["upcoming", "open", "closed", "results_published", "stale"] },
					makeCurrent: { type: "boolean" },
					runAt: { type: "string", format: "date-time" },
				},
			},
			Paradox: {
				type: "object",
				properties: {
					id: { type: "string" },
					paradoxCode: { type: "string" },
					name: { type: "string" },
					description: { type: "string" },
					example: { type: "string" },
					state: { type: "string", enum: ["draft", "published"] },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			ParadoxCreateRequest: {
				type: "object",
				required: ["name", "description"],
				properties: {
					name: { type: "string" },
					description: { type: "string" },
					example: { type: "string" },
				},
			},
			ParadoxUpdateRequest: {
				type: "object",
				required: ["id"],
				properties: {
					id: { type: "string" },
					name: { type: "string" },
					description: { type: "string" },
					example: { type: "string" },
					state: { type: "string", enum: ["draft", "published"] },
				},
			},
			AssignmentsResponse: {
				type: "object",
				properties: {
					judges: { type: "array", items: { type: "object" } },
					submissions: { type: "array", items: { type: "object" } },
					assignments: { type: "array", items: { type: "object" } },
				},
			},
			AssignmentRequest: {
				type: "object",
				required: ["teamId", "judgeId"],
				properties: { teamId: { type: "string" }, judgeId: { type: "string" } },
			},
			AdminResultsResponse: {
				type: "object",
				properties: {
					rounds: { type: "array", items: { type: "object" } },
					teams: { type: "array", items: { type: "object" } },
					results: { type: "array", items: { type: "object" } },
					computedScores: { type: "object" },
					rubricTotal: { type: "number" },
				},
			},
			PublishResultsRequest: {
				type: "object",
				required: ["roundKey", "outcomes"],
				properties: {
					roundKey: { type: "string" },
					outcomes: {
						type: "array",
						items: {
							type: "object",
							required: ["teamId", "outcome"],
							properties: {
								teamId: { type: "string" },
								outcome: { type: "string", enum: ["advanced", "eliminated"] },
								aggregateScore: { type: "number" },
								rank: { type: "integer" },
							},
						},
					},
				},
			},
			JudgeQueueResponse: {
				type: "object",
				properties: {
					rubric: { type: "object", nullable: true },
					queue: { type: "array", items: { type: "object" } },
				},
			},
			EvaluationRequest: {
				type: "object",
				required: ["questionnaireId", "criterionScores"],
				properties: {
					questionnaireId: { type: "string" },
					criterionScores: {
						type: "array",
						items: {
							type: "object",
							required: ["criterionKey", "score"],
							properties: {
								criterionKey: { type: "string" },
								score: { type: "number" },
							},
						},
					},
					recommendation: { type: "string", enum: ["advance", "borderline", "reject"] },
					status: { type: "string", enum: ["draft", "submitted"] },
				},
			},
			TeamMembersResponse: {
				type: "object",
				properties: {
					teamId: { type: "string" },
					teamName: { type: "string" },
					members: { type: "array", items: { type: "object" } },
				},
			},
			FileSubmissionResponse: {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					message: { type: "string" },
					submissionId: { type: "string", nullable: true },
					fileId: { type: "string" },
				},
			},
			TeamResultsResponse: {
				type: "object",
				properties: {
					teamId: { type: "string" },
					results: { type: "array", items: { type: "object" } },
				},
			},
		},
	},
} as const;

// Minimal self-contained Swagger UI page that loads assets from the jsDelivr CDN
// and points at the spec served by this Worker.
export const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Probably Paradoxical API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
      });
    </script>
  </body>
</html>`;
