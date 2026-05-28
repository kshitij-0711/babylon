import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import prisma from "../lib/prisma";

// ══════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════
// Supabase handles all OAuth. The backend never issues tokens.
//
// Flow (for every protected request):
//   1. Read Bearer token from Authorization header
//   2. Call supabase.auth.getUser(token) — Supabase verifies it
//   3. Look up the user row in public.users by the Supabase UUID
//   4. Attach { id, email, role } to req.user
//   5. Route handler runs
//
// Key fact: User.id in our DB IS the Supabase auth UUID. Same
// value. No mapping needed.
//
// Three middleware exported:
//   requireAuth  — blocks unauthenticated requests with 401
//   optionalAuth — populates req.user if token present, continues anonymously if not
//   requireAdmin — blocks non-ADMIN users with 403 (use AFTER requireAuth)
// ══════════════════════════════════════════════════════════════

/**
 * requireAuth
 * Blocks unauthenticated requests. Returns 401 if token is missing or invalid.
 * Attaches { id, email, role } to req.user on success.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header", code: "AUTH_REQUIRED" });
    }

    const token = authHeader.split(" ")[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" }) as any;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !dbUser.isActive) return res.status(401).json({ error: "User not found or banned", code: "USER_INACTIVE" }) as any;

    req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Authentication failed", code: "AUTH_FAILED" });
  }
};

/**
 * optionalAuth
 * Same as requireAuth but non-blocking. Populates req.user if a valid
 * token is present, otherwise continues anonymously (req.user = null).
 * Used for public endpoints that show extra data to logged-in users.
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(" ")[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      req.user = undefined;
      return next();
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !dbUser.isActive) {
      req.user = undefined;
      return next();
    }

    req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role };

    next();
  } catch (error) {
    // Non-blocking — continue anonymously on any error
    req.user = undefined;
    next();
  }
};

/**
 * requireAdmin
 * Must be chained AFTER requireAuth. Checks req.user.role === "ADMIN".
 * Returns 403 if the authenticated user is not an admin.
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required", code: "FORBIDDEN" });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
  }
};
