// Request rate limiting for sensitive endpoints (auth).
//
// Prefers a Cloudflare Rate Limiting binding when configured (distributed,
// production-grade — see wrangler.jsonc). Falls back to an in-memory sliding
// window so it still works in `wrangler dev`, tests, and when no binding is
// bound. The in-memory limiter is per-isolate, so treat it as best-effort.

export interface RateLimitBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitResult {
	allowed: boolean;
	retryAfter: number; // seconds
	limit: number;
	remaining: number;
}

interface RateLimitOptions {
	limit?: number;
	windowSeconds?: number;
	binding?: RateLimitBinding;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_SECONDS = 60;

// key -> request timestamps (ms) within the current window.
const hits = new Map<string, number[]>();

export async function rateLimit(key: string, options: RateLimitOptions = {}): Promise<RateLimitResult> {
	const limit = options.limit ?? DEFAULT_LIMIT;
	const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

	// Production path: Cloudflare Rate Limiting binding.
	if (options.binding && typeof options.binding.limit === "function") {
		const { success } = await options.binding.limit({ key });
		return {
			allowed: success,
			retryAfter: success ? 0 : windowSeconds,
			limit,
			remaining: success ? limit - 1 : 0,
		};
	}

	// Fallback: in-memory sliding window.
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

	if (recent.length >= limit) {
		hits.set(key, recent);
		const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
		return { allowed: false, retryAfter, limit, remaining: 0 };
	}

	recent.push(now);
	hits.set(key, recent);
	maybeSweep(now, windowMs);
	return { allowed: true, retryAfter: 0, limit, remaining: limit - recent.length };
}

/** Build a rate-limit key from the client IP and a scope (e.g. the path). */
export function clientKey(request: Request, scope: string): string {
	const ip =
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"anonymous";
	return `${scope}:${ip}`;
}

// Occasionally drop empty/expired buckets so the map can't grow unbounded.
function maybeSweep(now: number, windowMs: number): void {
	if (hits.size < 5000) {
		return;
	}
	for (const [key, timestamps] of hits) {
		const fresh = timestamps.filter((t) => now - t < windowMs);
		if (fresh.length === 0) {
			hits.delete(key);
		} else {
			hits.set(key, fresh);
		}
	}
}
