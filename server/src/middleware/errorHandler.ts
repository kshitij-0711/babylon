import { Request, Response, NextFunction } from "express";

// ══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER MIDDLEWARE
// ══════════════════════════════════════════════════════════════
// Catches all unhandled errors to prevent server crashes.
// Must be registered LAST in the Express middleware chain (app.ts).
//
// Error response format (PROJECT.md §Error response format):
//   { "error": "Human readable message", "code": "MACHINE_READABLE_CODE" }
//
// HTTP status codes:
//   400 — invalid input (Zod validation failed)
//   401 — not authenticated
//   403 — authenticated but not authorised
//   404 — resource not found
//   409 — conflict (e.g. insufficient balance, market not open)
//   429 — rate limited
//   500 — unexpected server error
// ══════════════════════════════════════════════════════════════

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.stack) {
    console.error(err.stack);
  }
  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || "INTERNAL_ERROR";

  res.status(statusCode).json({
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    code,
  });
};
