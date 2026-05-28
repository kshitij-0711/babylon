import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const marketFilterSchema = paginationSchema.extend({
  category: z
    .enum([
      "POLITICS",
      "SPORTS",
      "TECHNOLOGY",
      "SCIENCE",
      "ENTERTAINMENT",
      "FINANCE",
      "WORLD_EVENTS",
      "OTHER",
    ])
    .optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "CLOSED", "RESOLVED", "CANCELLED"])
    .optional(),
  sort: z.enum(["volume", "closeAt"]).optional(),
  search: z.string().optional(),
});

export const orderFilterSchema = paginationSchema.extend({
  status: z.enum(["PENDING", "PARTIAL", "FILLED", "CANCELLED"]).optional(),
  marketId: z.string().uuid().optional(),
});

export const priceHistorySchema = z.object({
  interval: z.enum(["1h", "24h", "7d", "all"]).default("24h"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type MarketFilterInput = z.infer<typeof marketFilterSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
export type PriceHistoryInput = z.infer<typeof priceHistorySchema>;
