// OpenAPI 3.0 specification for the probably-paradoxical backend.
// Served as JSON at GET /openapi.json and rendered by Swagger UI at GET /docs.
export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "Probably Paradoxical Backend API",
		version: "0.0.0",
		description:
			"Cloudflare Worker backend for the Probably Paradoxical portal. Provides health checks, one-time database setup, and JWT authentication for admins and teams.",
	},
	servers: [{ url: "http://localhost:8787", description: "Local wrangler dev" }],
	tags: [
		{ name: "Service", description: "Service metadata and health" },
		{ name: "Setup", description: "One-time database provisioning" },
		{ name: "Auth", description: "Authentication and tokens" },
	],
	paths: {
		"/": {
			get: {
				tags: ["Service"],
				summary: "Service info",
				description: "Returns a small JSON document identifying the service.",
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
				description: "Lightweight liveness probe.",
				responses: {
					"200": {
						description: "Worker is healthy.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Health" },
								example: { ok: true },
							},
						},
					},
				},
			},
		},
		"/setup/database": {
			post: {
				tags: ["Setup"],
				summary: "Provision database schema and indexes",
				description:
					"Creates the MongoDB collections, validators, and indexes. Idempotent. Requires the `x-setup-secret` header to match the server's `SETUP_SECRET`.",
				parameters: [
					{
						name: "x-setup-secret",
						in: "header",
						required: true,
						schema: { type: "string" },
						description: "Must equal the server's SETUP_SECRET.",
					},
				],
				responses: {
					"200": {
						description: "Database provisioned.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SetupResult" },
								example: {
									ok: true,
									database: "probably_paradoxical",
									schemaVersion: 2,
									createdCollections: ["admins", "judges", "teams", "members", "team_members"],
									updatedCollections: [],
									indexes: [{ collection: "teams", name: "teams_teamId_unique" }],
								},
							},
						},
					},
					"401": {
						description: "Missing or incorrect x-setup-secret header.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "Unauthorized" },
							},
						},
					},
					"503": {
						description: "SETUP_SECRET or MONGODB_URI is not configured.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "SETUP_SECRET is not configured." },
							},
						},
					},
					"500": {
						description: "Unexpected error while provisioning.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/auth/signup": {
			post: {
				tags: ["Auth"],
				summary: "Register a team",
				description:
					"Self-service team registration. Creates the members, the team, the team_members roster (first member — or `leaderEmail` — becomes the leader), and a shared team password hashed with argon2id. Returns the new team and, if `JWT_SECRET` is configured, an auto-login bearer token for the leader.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/SignupRequest" },
							example: {
								teamName: "Team Paradox",
								password: "a-strong-shared-password",
								leaderEmail: "lead@example.com",
								members: [
									{ name: "Lead Person", email: "lead@example.com" },
									{ name: "Second Person", email: "second@example.com" },
								],
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Team created.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SignupResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed (missing fields, bad email, team-size out of range, weak password).",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "A team must have between 2 and 5 members." },
							},
						},
					},
					"409": {
						description: "A member email is already registered to an active team.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "Email already registered to a team: lead@example.com" },
							},
						},
					},
					"503": {
						description: "Database is not configured.",
						content: {
							"application/json": { schema: { $ref: "#/components/schemas/Error" } },
						},
					},
				},
			},
		},
		"/admin/overview": {
			get: {
				tags: ["Admin"],
				summary: "Admin dashboard overview (live stats)",
				description:
					"Admin-only. Returns live entity counts (teams, members, judges, submissions, …), paradox/round status, the current round, and recent activity. Intended to be polled by the admin dashboard.",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "Overview snapshot.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										counts: { type: "object" },
										paradoxes: { type: "object" },
										currentRoundKey: { type: "string", nullable: true },
										currentRound: { type: "object", nullable: true },
										rounds: { type: "array", items: { type: "object" } },
										recentActivity: { type: "array", items: { type: "object" } },
										generatedAt: { type: "string", format: "date-time" },
									},
								},
							},
						},
					},
					"401": { description: "Missing/invalid token.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
					"403": { description: "Not an admin.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: "Admin access required." } } } },
				},
			},
		},
		"/auth/forgot-password": {
			post: {
				tags: ["Auth"],
				summary: "Request a password reset",
				description:
					"Starts a password reset for an admin, judge, or team (resolved by email). Always responds 200 with a generic message to avoid email enumeration. In development the response also includes `devResetToken` so the flow is testable; in production the token is emailed instead.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email"],
								properties: { email: { type: "string", format: "email" } },
							},
							example: { email: "judge1@example.com" },
						},
					},
				},
				responses: {
					"200": {
						description: "Generic acknowledgement (plus devResetToken in development).",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: { type: "string" },
										devResetToken: { type: "string", description: "Development only." },
										devResetPath: { type: "string", description: "Development only." },
										expiresInSeconds: { type: "integer" },
									},
								},
							},
						},
					},
					"400": { description: "Missing/invalid email.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
				},
			},
		},
		"/auth/reset-password": {
			post: {
				tags: ["Auth"],
				summary: "Reset a password with a token",
				description:
					"Consumes a reset token from /auth/forgot-password and sets a new argon2id password on the matching account. Tokens are single-use and expire after 30 minutes.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["token", "password"],
								properties: {
									token: { type: "string" },
									password: { type: "string", format: "password", minLength: 8 },
								},
							},
							example: { token: "<token-from-forgot-password>", password: "a-new-strong-password" },
						},
					},
				},
				responses: {
					"200": { description: "Password reset.", content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" } } } } } },
					"400": { description: "Invalid/expired token or weak password.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: "Invalid or expired reset token." } } } },
				},
			},
		},
		"/auth/change-password": {
			post: {
				tags: ["Auth"],
				summary: "Change password (authenticated)",
				description:
					"Changes the password of the signed-in account (admin, judge, or team — resolved from the bearer token). Requires the current password. For teams this updates the shared team password.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["currentPassword", "newPassword"],
								properties: {
									currentPassword: { type: "string", format: "password" },
									newPassword: { type: "string", format: "password", minLength: 8 },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Password updated.", content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" } } } } } },
					"400": { description: "Validation failed.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
					"401": { description: "Missing/invalid token or wrong current password.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: "Current password is incorrect." } } } },
				},
			},
		},
		"/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Log in as an admin, judge, or team member",
				description:
					"Validates the email/password against admins, then judges, then teams (member email + shared team password). On success returns a signed JWT bearer token whose `role` claim is `admin`, `judge`, or `team`.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LoginRequest" },
							example: { email: "admin@example.com", password: "your-password" },
						},
					},
				},
				responses: {
					"200": {
						description: "Authenticated. Returns a bearer token.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/LoginResponse" },
								example: {
									token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
									tokenType: "Bearer",
									expiresIn: 28800,
									user: {
										role: "admin",
										email: "admin@example.com",
										username: "admin",
										name: "Administrator",
									},
								},
							},
						},
					},
					"400": {
						description: "Missing fields or invalid JSON body.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "Email and password are required." },
							},
						},
					},
					"401": {
						description: "Invalid email or password.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "Invalid email or password." },
							},
						},
					},
					"503": {
						description: "JWT_SECRET or database is not configured.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: { error: "JWT_SECRET is not configured." },
							},
						},
					},
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
				properties: {
					ok: { type: "boolean" },
					service: { type: "string" },
				},
			},
			Health: {
				type: "object",
				properties: { ok: { type: "boolean" } },
			},
			Error: {
				type: "object",
				properties: { error: { type: "string" } },
			},
			SetupResult: {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					database: { type: "string" },
					schemaVersion: { type: "integer" },
					createdCollections: { type: "array", items: { type: "string" } },
					updatedCollections: { type: "array", items: { type: "string" } },
					indexes: {
						type: "array",
						items: {
							type: "object",
							properties: {
								collection: { type: "string" },
								name: { type: "string" },
							},
						},
					},
				},
			},
			SignupRequest: {
				type: "object",
				required: ["teamName", "password", "members"],
				properties: {
					teamName: { type: "string" },
					password: { type: "string", format: "password", minLength: 8, description: "Shared team password (argon2id-hashed)." },
					leaderEmail: { type: "string", format: "email", description: "Optional; defaults to the first member." },
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
					team: {
						type: "object",
						properties: {
							teamId: { type: "string" },
							teamName: { type: "string" },
							leadEmail: { type: "string" },
							memberCount: { type: "integer" },
						},
					},
					token: { type: "string", nullable: true, description: "Auto-login token; null if JWT_SECRET is unset." },
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
					expiresIn: { type: "integer", description: "Token lifetime in seconds." },
					user: {
						type: "object",
						properties: {
							role: { type: "string", enum: ["admin", "team"] },
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
