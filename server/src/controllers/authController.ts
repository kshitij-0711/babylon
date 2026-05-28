import { Request, Response } from "express";
import * as userService from "../services/userService";
import { supabaseAdmin } from "../lib/supabase";

// ══════════════════════════════════════════════════════════════
// AUTH CONTROLLER
// ══════════════════════════════════════════════════════════════
// Supabase owns the entire OAuth flow. These controllers just
// bridge between the Supabase JWT on the request and our app's
// user/profile data.
//
// Request flow:
//   Request → requireAuth middleware (verifies JWT, attaches req.user)
//           → Controller (reads req.user, calls service)
//           → Service (business logic)
//           → Repository (Prisma queries)
// ══════════════════════════════════════════════════════════════

/**
 * GET /auth/me
 *
 * Decodes the JWT and returns the current user's profile row.
 *
 * Flow:
 * 1. requireAuth middleware has already verified the Supabase JWT
 *    and attached { id, email, role } to req.user.
 * 2. Controller reads userId from req.user.
 * 3. Calls userService to fetch the full profile row from public.users.
 * 4. Returns the profile (never expose email or role in response).
 *
 * Frontend calls this on app load to know who is logged in
 * and hydrate the global auth state.
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;

    const profile = await userService.getPublicProfile(userId);

    return res.status(200).json({
      user: profile
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};

/**
 * POST /auth/logout
 *
 * Invalidates the Supabase session server-side.
 *
 * Flow:
 * 1. Reads the access token from the Authorization header.
 * 2. Calls Supabase Admin API to revoke/invalidate that session.
 * 3. Returns success — the frontend also clears its local token storage.
 *
 * Why server-side logout matters:
 * Just clearing the frontend token is not enough; the JWT is still
 * valid until it expires. Server-side invalidation ensures the token
 * cannot be reused if intercepted.
 */
export const logoutUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      await supabaseAdmin.auth.admin.signOut(token);
    }

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logoutUser:", error);
    return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
};
