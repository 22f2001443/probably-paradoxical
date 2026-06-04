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
									schemaVersion: 1,
									createdCollections: ["users", "admins", "passwords"],
									updatedCollections: [],
									indexes: [{ collection: "users", name: "users_teamId_unique" }],
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
		"/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Log in as an admin or team member",
				description:
					"Validates the email/password against admins, then teams. On success returns a signed JWT bearer token.",
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
