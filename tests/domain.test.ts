import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { validateForInstagram, validateUpload } from "@/lib/domain/media-rules";
import { schedulePublicationSchema } from "@/lib/domain/schemas";
import { canTransition, isCancellable } from "@/lib/domain/status";
import { decryptSecret, encryptSecret, hashPassword, redact, sign, verify, verifyPassword } from "@/lib/security/crypto";
import { backoffMs } from "@/lib/jobs/engine";

describe("máquina de estados", () => {
  it("permite o fluxo feliz e bloqueia saltos", () => {
    expect(canTransition("scheduled", "queued")).toBe(true);
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("processing", "published")).toBe(true);
    expect(canTransition("published", "scheduled")).toBe(false);
    expect(canTransition("scheduled", "published")).toBe(false);
    expect(isCancellable("processing")).toBe(false);
    expect(isCancellable("queued")).toBe(true);
  });
});

describe("regras de mídia", () => {
  const img = { id: "1", kind: "image" as const, mimeType: "image/jpeg", sizeBytes: 1000, width: 1080, height: 1350, durationSec: null };
  it("aceita JPEG 4:5 no feed", () => {
    expect(validateForInstagram("FEED", [img], "oi").filter((i) => i.level === "error")).toHaveLength(0);
  });
  it("rejeita proporção 9:16 no feed", () => {
    const tall = { ...img, width: 1080, height: 1920 };
    expect(validateForInstagram("FEED", [tall], "").some((i) => i.level === "error")).toBe(true);
  });
  it("exige vídeo para Reels e 2–10 itens no carrossel", () => {
    expect(validateForInstagram("REELS", [img], "").some((i) => i.level === "error")).toBe(true);
    expect(validateForInstagram("CAROUSEL", [img], "").some((i) => i.level === "error")).toBe(true);
    expect(validateForInstagram("CAROUSEL", [img, { ...img, id: "2" }], "").some((i) => i.level === "error")).toBe(false);
  });
  it("limita hashtags e tamanho da legenda", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(validateForInstagram("FEED", [img], tags).some((i) => i.level === "error")).toBe(true);
    expect(validateForInstagram("FEED", [img], "x".repeat(2201)).some((i) => i.level === "error")).toBe(true);
  });
  it("valida upload por tipo e tamanho", () => {
    expect(validateUpload({ mimeType: "image/gif", sizeBytes: 10 }).ok).toBe(false);
    expect(validateUpload({ mimeType: "image/jpeg", sizeBytes: 9 * 1024 * 1024 }).ok).toBe(false);
    expect(validateUpload({ mimeType: "video/mp4", sizeBytes: 50 * 1024 * 1024 }).ok).toBe(true);
  });
});

describe("schema de agendamento", () => {
  it("rejeita data no passado", () => {
    const r = schedulePublicationSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      mediaIds: [crypto.randomUUID()],
      caption: "",
      accountIds: [crypto.randomUUID()],
      format: "FEED",
      scheduledAt: "2020-01-01T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("segurança", () => {
  it("criptografa e descriptografa tokens (AES-256-GCM) e detecta adulteração", () => {
    const key = randomBytes(32);
    const enc = encryptSecret("IGQV-token-secreto", key);
    expect(enc).not.toContain("IGQV");
    expect(decryptSecret(enc, key)).toBe("IGQV-token-secreto");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered, key)).toThrow();
  });
  it("assina e verifica payloads, rejeitando expirados", () => {
    const s = "x".repeat(40);
    expect(verify<{ a: number }>(sign({ a: 1 }, s), s)?.a).toBe(1);
    expect(verify(sign({ a: 1 }, s), "y".repeat(40))).toBeNull();
    expect(verify(sign({ exp: Date.now() - 1 }, s), s)).toBeNull();
  });
  it("hash de senha com scrypt", async () => {
    const h = await hashPassword("senha-forte-123");
    expect(await verifyPassword("senha-forte-123", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
  });
  it("remove credenciais de logs", () => {
    expect(redact({ access_token: "abc", nested: { client_secret: "s" }, ok: 1 })).toEqual({
      access_token: "[redacted]",
      nested: { client_secret: "[redacted]" },
      ok: 1,
    });
    expect(redact("https://x?access_token=abc&y=1")).toBe("https://x?access_token=[redacted]&y=1");
  });
  it("backoff exponencial com teto", () => {
    expect(backoffMs(1, () => 0)).toBe(30_000);
    expect(backoffMs(2, () => 0)).toBe(60_000);
    expect(backoffMs(20, () => 0)).toBe(30 * 60_000);
  });
});

describe("detecção de deploy mal configurado", () => {
  it("acusa Vercel sem Supabase e aceita Vercel com Supabase", async () => {
    const { isMisconfiguredDeployment } = await import("@/lib/env");
    const saved = { ...process.env };
    process.env.VERCEL = "1";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isMisconfiguredDeployment()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    expect(isMisconfiguredDeployment()).toBe(false);
    process.env = saved;
  });
});
