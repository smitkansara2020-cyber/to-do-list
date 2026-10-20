export type FocusSessionRecord = {
  id: string;
  taskId: string;
  taskTitle: string;
  category: string;
  estimatedMinutes: number;
  actualMinutes: number;
  completedAt: string;
};

const FOCUS_STORAGE_KEY = "pinboard_focus_sessions_v2";

export class FocusAnalytics {
  static getSessions(): FocusSessionRecord[] {
    try {
      const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static recordSession(session: Omit<FocusSessionRecord, "id" | "completedAt">) {
    try {
      const list = this.getSessions();
      const record: FocusSessionRecord = {
        id: Math.random().toString(36).slice(2, 9),
        ...session,
        completedAt: new Date().toISOString(),
      };
      list.unshift(record);
      // Keep last 100 sessions
      localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
    } catch {
      // LocalStorage access restricted
    }
  }

  /**
   * Calculates category-based estimation variance.
   * e.g., returns 1.25 if tasks in this category take 25% longer than estimated.
   */
  static getCategoryVarianceRatio(category?: string | null): {
    ratio: number;
    sampleCount: number;
    suggestion?: string;
  } {
    if (!category) return { ratio: 1.0, sampleCount: 0 };
    const sessions = this.getSessions().filter(
      (s) => s.category.toLowerCase() === category.toLowerCase(),
    );

    if (sessions.length < 2) {
      return { ratio: 1.0, sampleCount: sessions.length };
    }

    let totalEst = 0;
    let totalAct = 0;
    for (const s of sessions) {
      if (s.estimatedMinutes > 0 && s.actualMinutes > 0) {
        totalEst += s.estimatedMinutes;
        totalAct += s.actualMinutes;
      }
    }

    if (totalEst === 0) return { ratio: 1.0, sampleCount: sessions.length };

    const ratio = Math.round((totalAct / totalEst) * 100) / 100;
    let suggestion: string | undefined;

    if (ratio >= 1.2) {
      const pctOver = Math.round((ratio - 1) * 100);
      suggestion = `You typically take ${pctOver}% longer on ${category} tasks. Consider scheduling more buffer time.`;
    } else if (ratio <= 0.8) {
      const pctUnder = Math.round((1 - ratio) * 100);
      suggestion = `You typically finish ${category} tasks ${pctUnder}% faster than estimated!`;
    }

    return {
      ratio,
      sampleCount: sessions.length,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  /**
   * Suggests an optimized duration in minutes for a new task based on category history
   */
  static suggestDuration(initialEstimate = 30, category?: string | null): number {
    const { ratio, sampleCount } = this.getCategoryVarianceRatio(category);
    if (sampleCount < 2 || ratio === 1.0) return initialEstimate;
    // Suggest adjusted estimate rounded to 5 mins
    const adjusted = Math.round((initialEstimate * ratio) / 5) * 5;
    return Math.max(10, adjusted);
  }
}
