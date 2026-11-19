import { z } from "zod";
import { INSTAGRAM_RULES } from "./media-rules";

export const emailSchema = z.email("E-mail inválido").trim().toLowerCase();
export const passwordSchema = z
  .string()
  .min(8, "Mínimo de 8 caracteres")
  .max(128, "Máximo de 128 caracteres");

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "É necessário aceitar os termos" }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema });

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
});

export const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(32))
  .max(20, "Máximo de 20 etiquetas");

export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export const accountOrganizeSchema = z.object({
  accountIds: z.array(z.uuid()).min(1, "Selecione ao menos uma conta"),
  tags: tagsSchema.optional(),
  group: z.string().trim().max(40).nullable().optional(),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  description: z.string().trim().max(280).optional().nullable(),
});

export const captionTemplateSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().max(INSTAGRAM_RULES.captionMaxChars),
});

export const mediaMetaSchema = z.object({
  folder: z.string().trim().max(40).nullable().optional(),
  tags: tagsSchema.optional(),
  rightsConfirmed: z.boolean().optional(),
  rightsNote: z.string().trim().max(280).nullable().optional(),
});

export const publishFormatSchema = z.enum(["FEED", "REELS", "STORIES", "CAROUSEL"]);

export const schedulePublicationSchema = z
  .object({
    idempotencyKey: z.uuid("Chave de idempotência inválida"),
    mediaIds: z.array(z.uuid()).min(1, "Selecione a mídia").max(INSTAGRAM_RULES.carouselMax),
    caption: z.string().max(INSTAGRAM_RULES.captionMaxChars),
    accountIds: z.array(z.uuid()).min(1, "Selecione ao menos uma conta").max(150),
    format: publishFormatSchema,
    scheduledAt: z.iso.datetime({ offset: true, error: "Data/hora inválida" }),
    campaignId: z.uuid().nullable().optional(),
    publishNow: z.boolean().optional(),
  })
  .refine((v) => v.publishNow || new Date(v.scheduledAt).getTime() > Date.now() - 60_000, {
    message: "A data precisa estar no futuro",
    path: ["scheduledAt"],
  });

export type SchedulePublicationInput = z.infer<typeof schedulePublicationSchema>;
