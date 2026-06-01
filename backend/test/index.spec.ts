import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("backend worker", () => {
	it("responds to health checks", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("guards database setup when no setup secret is configured", async () => {
		const request = new IncomingRequest("http://example.com/setup/database", {
			method: "POST",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, {}, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "SETUP_SECRET is not configured.",
		});
	});

	it("responds to health checks in integration style", async () => {
		const response = await SELF.fetch("https://example.com/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
});
