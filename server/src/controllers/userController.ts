import { Request, Response } from "express";
import * as userService from "../services/userService";
import * as walletService from "../services/walletService";
import { updateProfileSchema } from "../validations/userValidation";

// ══════════════════════════════════════════════════════════════
// USER CONTROLLER
// ══════════════════════════════════════════════════════════════
// Manages public user profiles and wallet data.
//
// Key distinction from Auth Controller:
//   Auth = "who am I?" (session management)
//   User = "what's my profile / wallet?" (data management)
//
// The User model mirrors Supabase's auth.users — created
// automatically via a Postgres trigger on first login.
// User.id IS the Supabase auth UUID. No mapping needed.
//
// Architecture rules (5-layer pattern):
//   Controller never imports Prisma.
//   Controller reads req → validates with Zod → calls service → sends res.json()
//   All Decimal fields are .toString() in the service layer, never here.
//   Never expose email or role in public API responses.
// ══════════════════════════════════════════════════════════════

/**
 * GET /users/:id/profile
 *
 * Returns the public profile of any user by their ID.
 *
 * Flow:
 * 1. Reads the user id from URL params.
 * 2. Calls userService.getPublicProfile(id as string).
 * 3. Service fetches user row, strips sensitive fields (email, role),
 *    includes: username, displayName, avatarUrl, bio, stats, recent markets, join date.
 * 4. Returns the public profile or 404 if user not found.
 *
 * Used on: leaderboard user cards, market creator info, profile pages.
 * PUBLIC endpoint — no auth required.
 */
export const getUserProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const publicProfile = await userService.getPublicProfile(id as string);

    return res.status(200).json({
      user: publicProfile
    });
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * PATCH /users/me
 *
 * Updates the currently authenticated user's own profile.
 *
 * Flow:
 * 1. Reads req.user.id (set by requireAuth middleware).
 * 2. Reads update payload from req.body.
 * 3. Validates input with Zod: username, displayName, bio, avatarUrl.
 * 4. Calls userService.updateProfile(userId, validatedData).
 * 5. Service checks username uniqueness before updating.
 * 6. Returns the updated profile.
 *
 * Protected: must be authenticated. Users can only update their OWN profile.
 */
export const updateMyProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const updateData = req.body;

    const validatedData = updateProfileSchema.parse(updateData);
    const updatedProfile = await userService.updateProfile(userId, validatedData);

    return res.status(200).json({
      user: updatedProfile
    });
  } catch (error) {
    console.error("Error in updateMyProfile:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * GET /users/me/wallet
 *
 * Returns the authenticated user's wallet balances.
 *
 * Flow:
 * 1. Reads req.user.id from the auth middleware.
 * 2. Calls walletService.getWallet(userId).
 * 3. Service fetches the Wallet row and computes:
 *    - balance: total coins in wallet
 *    - lockedBalance: coins reserved for pending LIMIT orders
 *    - availableBalance: balance - lockedBalance
 *    - totalDeposited / totalWithdrawn: lifetime aggregate stats
 * 4. All Decimal fields are .toString() in the service layer.
 *
 * Frontend shows availableBalance in the nav bar.
 * Protected: must be authenticated.
 */
export const getMyWallet = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;

    const walletData = await walletService.getWallet(userId);

    return res.status(200).json({
      wallet: walletData
    });
  } catch (error) {
    console.error("Error in getMyWallet:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
