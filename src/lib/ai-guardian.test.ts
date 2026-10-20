import { describe, it, expect, beforeEach } from "vitest";
import { AiGuardian, COACH_PERSONAS } from "./ai-guardian";

describe("AiGuardian Rate Limiting and Personas", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides Executive, Supportive, and Mindful personas with distinct tones", () => {
    expect(COACH_PERSONAS.executive.name).toBe("Executive Coach");
    expect(COACH_PERSONAS.supportive.name).toBe("Supportive Coach");
    expect(COACH_PERSONAS.mindful.name).toBe("Mindful Coach");

    AiGuardian.setPersona("mindful");
    expect(AiGuardian.getPersona()).toBe("mindful");

    AiGuardian.setPersona("executive");
    expect(AiGuardian.getPersona()).toBe("executive");
  });

  it("validates payload lengths correctly", () => {
    expect(AiGuardian.validatePayload("").valid).toBe(false);
    expect(AiGuardian.validatePayload("   ").valid).toBe(false);
    expect(AiGuardian.validatePayload("Help plan my day").valid).toBe(true);

    const oversized = "A".repeat(2500);
    const result = AiGuardian.validatePayload(oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Message is too long");
  });

  it("enforces cooldowns between rapid submissions", () => {
    const check1 = AiGuardian.checkRateLimit("user-test");
    expect(check1.allowed).toBe(true);
    expect(check1.remainingQuota).toBe(50);

    AiGuardian.recordUsage("user-test");

    // Immediate next call within 3s should be rejected
    const check2 = AiGuardian.checkRateLimit("user-test");
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toContain("Please wait");
  });

  it("enforces daily quota limit of 50 requests", () => {
    // Mock 50 requests
    for (let i = 0; i < 50; i++) {
      AiGuardian.recordUsage("user-quota");
    }

    const key = "pinboard_ai_quota_user-quota";
    const record = JSON.parse(localStorage.getItem(key)!);
    record.lastRequestTime = Date.now() - 5000; // bypass cooldown
    localStorage.setItem(key, JSON.stringify(record));

    const check = AiGuardian.checkRateLimit("user-quota");
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("Daily AI usage limit reached");
    expect(check.remainingQuota).toBe(0);
  });
});
