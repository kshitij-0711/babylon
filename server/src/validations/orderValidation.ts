import { z } from "zod";

export const placeOrderSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["YES", "NO"]),
  type: z.enum(["MARKET", "LIMIT"]),
  quantity: z.number().int().positive(),
  price: z.number().min(0.01).max(0.99),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
