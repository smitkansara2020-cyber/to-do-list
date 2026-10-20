import { describe, it, expect, beforeEach } from "vitest";
import { NotificationEngine, DEFAULT_NOTIFICATION_PREFS } from "./push-notifications";

describe("NotificationEngine Quiet Hours & Reminders", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accurately identifies overnight quiet hours", () => {
    // 22:00 to 07:00
    expect(NotificationEngine.isQuietHours("23:15", "22:00", "07:00")).toBe(true);
    expect(NotificationEngine.isQuietHours("02:00", "22:00", "07:00")).toBe(true);
    expect(NotificationEngine.isQuietHours("06:59", "22:00", "07:00")).toBe(true);

    // Daytime: not quiet hours
    expect(NotificationEngine.isQuietHours("09:00", "22:00", "07:00")).toBe(false);
    expect(NotificationEngine.isQuietHours("14:30", "22:00", "07:00")).toBe(false);
    expect(NotificationEngine.isQuietHours("21:59", "22:00", "07:00")).toBe(false);
  });

  it("checks lead time for task reminders", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      enabled: true,
      quietHoursEnabled: false,
    };

    const mockDate = new Date("2026-10-20T14:52:00");

    // Task at 15:00 with 10 min lead time -> trigger between 14:50 and 15:00
    const shouldFire = NotificationEngine.shouldTriggerReminder({
      taskScheduledDate: "2026-10-20",
      taskStartTime: "15:00:00",
      leadMinutes: 10,
      currentDate: mockDate,
      prefs,
    });
    expect(shouldFire).toBe(true);

    // Task too far in future (16:30)
    const tooEarly = NotificationEngine.shouldTriggerReminder({
      taskScheduledDate: "2026-10-20",
      taskStartTime: "16:30:00",
      leadMinutes: 10,
      currentDate: mockDate,
      prefs,
    });
    expect(tooEarly).toBe(false);
  });

  it("prevents duplicate reminders", () => {
    expect(NotificationEngine.hasSentReminder("t1", "2026-10-20")).toBe(false);
    NotificationEngine.markReminderSent("t1", "2026-10-20");
    expect(NotificationEngine.hasSentReminder("t1", "2026-10-20")).toBe(true);
    expect(NotificationEngine.hasSentReminder("t2", "2026-10-20")).toBe(false);
  });
});
