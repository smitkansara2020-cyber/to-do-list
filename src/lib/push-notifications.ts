/**
 * Web Push Notifications Engine (Local Architecture & Scheduling)
 * Manages user notification preferences, quiet hours enforcement, snooze logic,
 * and duplicate reminder prevention without blocking on browser permissions.
 */

export interface NotificationPreferences {
  enabled: boolean;
  scheduledTaskReminders: boolean;
  reminderLeadTimeMinutes: number; // e.g. 10 mins before start
  morningPlanningPrompt: boolean;
  morningPromptTime: string; // "08:30"
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  snoozeDurationMinutes: number; // 10
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  scheduledTaskReminders: true,
  reminderLeadTimeMinutes: 10,
  morningPlanningPrompt: true,
  morningPromptTime: "08:30",
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  snoozeDurationMinutes: 10,
};

export class NotificationEngine {
  private static PREFS_STORAGE_KEY = "pinboard_notification_prefs_v1";
  private static SENT_REMINDERS_KEY = "pinboard_sent_reminders_v1";

  static getPreferences(): NotificationPreferences {
    if (typeof localStorage === "undefined") return DEFAULT_NOTIFICATION_PREFS;
    try {
      const raw = localStorage.getItem(this.PREFS_STORAGE_KEY);
      return raw ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_PREFS;
    } catch {
      return DEFAULT_NOTIFICATION_PREFS;
    }
  }

  static savePreferences(prefs: NotificationPreferences): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.PREFS_STORAGE_KEY, JSON.stringify(prefs));
  }

  /**
   * Checks whether a given clock time (HH:MM) falls within quiet hours
   */
  static isQuietHours(timeStr: string, quietStart = "22:00", quietEnd = "07:00"): boolean {
    const toMinutes = (t: string) => {
      const [h = 0, m = 0] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const cur = toMinutes(timeStr);
    const start = toMinutes(quietStart);
    const end = toMinutes(quietEnd);

    if (start > end) {
      // Overnight range, e.g. 22:00 to 07:00
      return cur >= start || cur < end;
    } else {
      // Same day range, e.g. 13:00 to 15:00
      return cur >= start && cur < end;
    }
  }

  /**
   * Checks whether a task reminder should fire right now
   */
  static shouldTriggerReminder({
    taskScheduledDate,
    taskStartTime,
    leadMinutes = 10,
    currentDate = new Date(),
    prefs,
  }: {
    taskScheduledDate: string;
    taskStartTime: string;
    leadMinutes?: number;
    currentDate?: Date;
    prefs: NotificationPreferences;
  }): boolean {
    if (!prefs.enabled || !prefs.scheduledTaskReminders) return false;

    // Check quiet hours
    const currentHours = String(currentDate.getHours()).padStart(2, "0");
    const currentMins = String(currentDate.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${currentHours}:${currentMins}`;

    if (
      prefs.quietHoursEnabled &&
      this.isQuietHours(currentTimeStr, prefs.quietHoursStart, prefs.quietHoursEnd)
    ) {
      return false; // Silenced by quiet hours
    }

    const todayISO = currentDate.toISOString().slice(0, 10);
    if (taskScheduledDate !== todayISO) return false;

    const [tH = 0, tM = 0] = taskStartTime.split(":").map(Number);
    const taskMinutes = tH * 60 + tM;
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    // Trigger window: between (taskMinutes - leadMinutes) and taskMinutes
    return currentMinutes >= taskMinutes - leadMinutes && currentMinutes <= taskMinutes;
  }

  /**
   * Prevents firing duplicate reminders for the same task on the same day
   */
  static hasSentReminder(taskId: string, dateStr: string): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(this.SENT_REMINDERS_KEY);
      const set = raw ? JSON.parse(raw) : [];
      return set.includes(`${taskId}_${dateStr}`);
    } catch {
      return false;
    }
  }

  static markReminderSent(taskId: string, dateStr: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(this.SENT_REMINDERS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      list.push(`${taskId}_${dateStr}`);
      localStorage.setItem(this.SENT_REMINDERS_KEY, JSON.stringify(list.slice(-100)));
    } catch (e) {
      console.warn("Could not record sent reminder", e);
    }
  }
}
