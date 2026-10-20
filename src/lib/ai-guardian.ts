/**
 * AI Guardian: Usage Protection, Rate Limiting & Coach Personas
 * Protects AI endpoints against quota exhaustion, spam submissions, oversized payloads,
 * and configures personalized coach personas (Executive, Supportive, Mindful).
 */

export type CoachPersona = "executive" | "supportive" | "mindful";

export interface PersonaConfig {
  id: CoachPersona;
  name: string;
  tagline: string;
  avatarEmoji: string;
  badgeColor: string;
  toneDescription: string;
  systemPromptModifier: string;
  greetingPrefix: string;
}

export const COACH_PERSONAS: Record<CoachPersona, PersonaConfig> = {
  executive: {
    id: "executive",
    name: "Executive Coach",
    tagline: "Direct, high-impact, decisive, ROI-focused",
    avatarEmoji: "⚡",
    badgeColor: "bg-slate-800 text-slate-100 dark:bg-slate-200 dark:text-slate-900",
    toneDescription: "Laser-focused on priority, time-blocking, and eliminating distractions.",
    systemPromptModifier:
      "Adopt an Executive persona. Be crisp, concise, and decisive. Cut pleasantries, focus on highest-leverage tasks, and structure time rigidly with realistic buffers.",
    greetingPrefix: "Let's optimize your schedule for maximum leverage today.",
  },
  supportive: {
    id: "supportive",
    name: "Supportive Coach",
    tagline: "Encouraging, warm, celebrating progress",
    avatarEmoji: "🌟",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    toneDescription: "Warm, empathetic, breaking overwhelming tasks into bite-sized approachable wins.",
    systemPromptModifier:
      "Adopt a Supportive persona. Be warm, empathetic, encouraging, and optimistic. Celebrate progress, relieve overwhelm, and remind the user that small consistent steps win.",
    greetingPrefix: "You're doing great! Let's craft a peaceful, achievable plan for today.",
  },
  mindful: {
    id: "mindful",
    name: "Mindful Coach",
    tagline: "Calm, balanced, burnout-resistant pacing",
    avatarEmoji: "🌿",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    toneDescription: "Values steady energy, deep work intervals, and deliberate breathing room.",
    systemPromptModifier:
      "Adopt a Mindful persona. Focus on balance, cognitive energy preservation, adequate breaks, and realistic capacity. Protect against over-scheduling and fatigue.",
    greetingPrefix: "Take a deep breath. Let's arrange today with calm clarity and balanced focus.",
  },
};

const DAILY_QUOTA_LIMIT = 50;
const MAX_PROMPT_LENGTH = 2000;
const COOLDOWN_SECONDS = 3;

interface QuotaRecord {
  date: string;
  count: number;
  lastRequestTime: number;
}

export class AiGuardian {
  private static STORAGE_PREFIX = "pinboard_ai_quota_";
  private static PERSONA_STORAGE_KEY = "pinboard_coach_persona";

  static getPersona(): CoachPersona {
    if (typeof localStorage === "undefined") return "executive";
    const saved = localStorage.getItem(this.PERSONA_STORAGE_KEY);
    if (saved && (saved === "executive" || saved === "supportive" || saved === "mindful")) {
      return saved as CoachPersona;
    }
    return "supportive";
  }

  static setPersona(persona: CoachPersona): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.PERSONA_STORAGE_KEY, persona);
  }

  private static getQuotaKey(userId?: string): string {
    return `${this.STORAGE_PREFIX}${userId || "anonymous"}`;
  }

  private static getTodayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static getQuotaRecord(userId?: string): QuotaRecord {
    if (typeof localStorage === "undefined") {
      return { date: this.getTodayISO(), count: 0, lastRequestTime: 0 };
    }
    try {
      const raw = localStorage.getItem(this.getQuotaKey(userId));
      if (!raw) return { date: this.getTodayISO(), count: 0, lastRequestTime: 0 };
      const parsed: QuotaRecord = JSON.parse(raw);
      if (parsed.date !== this.getTodayISO()) {
        // Daily reset
        return { date: this.getTodayISO(), count: 0, lastRequestTime: parsed.lastRequestTime };
      }
      return parsed;
    } catch {
      return { date: this.getTodayISO(), count: 0, lastRequestTime: 0 };
    }
  }

  static validatePayload(prompt: string): { valid: boolean; error?: string } {
    if (!prompt || !prompt.trim()) {
      return { valid: false, error: "Please enter a message or question." };
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return {
        valid: false,
        error: `Message is too long (${prompt.length}/${MAX_PROMPT_LENGTH} characters). Please shorten it.`,
      };
    }
    return { valid: true };
  }

  static checkRateLimit(userId?: string): {
    allowed: boolean;
    reason?: string;
    remainingQuota: number;
    cooldownRemainingSeconds?: number;
  } {
    const record = this.getQuotaRecord(userId);
    const now = Date.now();

    // 1. Cooldown check
    const elapsedSeconds = (now - record.lastRequestTime) / 1000;
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
      return {
        allowed: false,
        reason: `Please wait ${waitTime}s before sending another prompt.`,
        remainingQuota: Math.max(0, DAILY_QUOTA_LIMIT - record.count),
        cooldownRemainingSeconds: waitTime,
      };
    }

    // 2. Daily limit check
    if (record.count >= DAILY_QUOTA_LIMIT) {
      return {
        allowed: false,
        reason: `Daily AI usage limit reached (${DAILY_QUOTA_LIMIT}/${DAILY_QUOTA_LIMIT}). Quota resets tomorrow.`,
        remainingQuota: 0,
      };
    }

    return {
      allowed: true,
      remainingQuota: DAILY_QUOTA_LIMIT - record.count,
    };
  }

  static recordUsage(userId?: string): void {
    if (typeof localStorage === "undefined") return;
    const current = this.getQuotaRecord(userId);
    const updated: QuotaRecord = {
      date: this.getTodayISO(),
      count: current.count + 1,
      lastRequestTime: Date.now(),
    };
    try {
      localStorage.setItem(this.getQuotaKey(userId), JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save AI quota record", e);
    }
  }

  static getQuotaLimit(): number {
    return DAILY_QUOTA_LIMIT;
  }
}
