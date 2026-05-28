import { Router } from "express";
import { getCurrentUser, logoutUser } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

// ──────────────────────────────────────────────────────────────
// AUTH ROUTES
// Supabase handles the actual OAuth flow (Google login, JWT,
// refresh tokens). These endpoints deal with the app-level
// session — fetching the logged-in profile and server-side logout.
// ──────────────────────────────────────────────────────────────

// GET /auth/me — decode JWT, return current user's profile row
authRouter.get("/me", requireAuth, getCurrentUser);

// POST /auth/logout — invalidate Supabase session server-side
authRouter.post("/logout", requireAuth, logoutUser);
