import rateLimit from "express-rate-limit";

// ══════════════════════════════════════════════════════════════
// RATE LIMITING MIDDLEWARE
// ══════════════════════════════════════════════════════════════
// Uses express-rate-limit. PROJECT.md specifies:
//   - apiLimiter:   100 req / 15 min (global, all routes)
//   - orderLimiter: 10 req / 1 min  (POST /orders only)
//
// Redis store should be added later for multi-instance deployments.
// ══════════════════════════════════════════════════════════════

// Global rate limiter — mounted on all routes in app.ts
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window per IP
  message: { error: "Too many requests, please try again later", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict order limiter — mounted on POST /orders only
export const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,                   // 10 order requests per minute per IP
  message: { error: "Too many order requests, please slow down", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});
