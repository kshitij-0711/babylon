import { Router } from "express";
import { getUserProfile, updateMyProfile, getMyWallet } from "../controllers/userController";
import { requireAuth } from "../middleware/auth";

export const userRouter = Router();

// ──────────────────────────────────────────────────────────────
// USER ROUTES
// Public profile lookup is unauthenticated; editing own profile
// and viewing wallet require authentication.
// Never expose email or role in public API responses.
// ──────────────────────────────────────────────────────────────

// GET /users/:id/profile — public profile with stats and recent markets
userRouter.get("/:id/profile", getUserProfile);

// PATCH /users/me — update own profile (username, bio, displayName, avatarUrl)
userRouter.patch("/me", requireAuth, updateMyProfile);

// GET /users/me/wallet — own wallet balance, locked balance, available balance
userRouter.get("/me/wallet", requireAuth, getMyWallet);
