import { describe, expect, it } from "vitest";
import { formatTimeLeft, workspaceAccess } from "@/lib/domain/access";

const now = new Date("2026-11-20T12:00:00Z");

describe("workspaceAccess", () => {
  it("teste grátis em andamento", () => {
    const a = workspaceAccess({ plan: "pro", trialEndsAt: "2026-11-22T12:00:00Z" }, now);
    expect(a.state).toBe("trial");
    if (a.state === "trial") expect(a.msLeft).toBe(2 * 86_400_000);
  });
  it("bloqueia quando o teste vence, mesmo com plano Pro", () => {
    expect(workspaceAccess({ plan: "pro", trialEndsAt: "2026-11-20T11:59:59Z" }, now)).toEqual({ state: "locked", reason: "trial_ended" });
  });
  it("bloqueia sem plano", () => {
    expect(workspaceAccess({ plan: "trial", trialEndsAt: null }, now)).toEqual({ state: "locked", reason: "no_plan" });
  });
  it("libera plano pago (sem teste)", () => {
    expect(workspaceAccess({ plan: "starter", trialEndsAt: null }, now)).toEqual({ state: "paid" });
    expect(workspaceAccess({ plan: "scale" }, now)).toEqual({ state: "paid" });
  });
});

describe("formatTimeLeft", () => {
  it("formata dias, horas e menos de 1 hora", () => {
    expect(formatTimeLeft(3 * 86_400_000)).toBe("3 dias");
    expect(formatTimeLeft(30 * 3_600_000)).toBe("2 dias");
    expect(formatTimeLeft(5 * 3_600_000)).toBe("5 horas");
    expect(formatTimeLeft(1 * 3_600_000)).toBe("1 hora");
    expect(formatTimeLeft(10 * 60_000)).toBe("menos de 1 hora");
  });
});
