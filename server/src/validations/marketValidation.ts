import { z } from "zod";

export const createMarketSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(20).max(2000),
  category: z.enum([
    "POLITICS",
    "SPORTS",
    "TECHNOLOGY",
    "SCIENCE",
    "ENTERTAINMENT",
    "FINANCE",
    "WORLD_EVENTS",
    "OTHER",
  ]),
  tags: z.array(z.string()).max(10).default([]),
  closeAt: z.string().datetime(),
});

export const resolveMarketSchema = z.object({
  outcome: z.enum(["YES", "NO", "VOID"]),
  evidenceUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateMarketInput = z.infer<typeof createMarketSchema>;
export type ResolveMarketInput = z.infer<typeof resolveMarketSchema>;
