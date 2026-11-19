import { z } from "zod";

export const mediaUploadMetaSchema = z.object({
  width: z.number().int().positive().max(20_000).nullable().optional(),
  height: z.number().int().positive().max(20_000).nullable().optional(),
  durationSec: z.number().nonnegative().max(36_000).nullable().optional(),
  folder: z.string().trim().max(40).nullable().optional(),
});

export const intentSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export const completeSchema = mediaUploadMetaSchema.extend({
  storagePath: z.string().min(10).max(300),
  fileName: z.string().min(1).max(200),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
});
