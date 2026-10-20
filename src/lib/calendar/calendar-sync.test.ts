import { describe, it, expect } from "vitest";
import {
  calculateCalendarSyncDiff,
  computeSyncHash,
  type CalendarEvent,
} from "./calendar-provider";
import { type Task } from "@/lib/tasks";

describe("Two-Way Calendar Sync & Diff Engine", () => {
  const mockLocalTasks: Task[] = [
    {
      id: "task-1",
      user_id: "usr-1",
      title: "Design System Review",
      color: "yellow",
      priority: "high",
      status: "todo",
      recurrence: "none",
      scheduled_date: "2026-10-21",
      start_time: "10:00:00",
      duration_minutes: 60,
      category: null,
      completed_at: null,
      due_date: null,
      notes: null,
      created_at: "2026-10-20T10:00:00Z",
      updated_at: "2026-10-20T10:00:00Z",
    },
    {
      id: "task-2",
      user_id: "usr-1",
      title: "Grocery Shopping",
      color: "mint",
      priority: "low",
      status: "todo",
      recurrence: "none",
      scheduled_date: null,
      start_time: null,
      duration_minutes: null,
      category: null,
      completed_at: null,
      due_date: null,
      notes: null,
      created_at: "2026-10-20T10:00:00Z",
      updated_at: "2026-10-20T10:00:00Z",
    },
  ];

  const mockRemoteEvents: CalendarEvent[] = [
    {
      id: "gcal-event-99",
      calendarId: "primary",
      title: "Quarterly Strategy All-Hands",
      startDate: "2026-10-21",
      startTime: "14:00:00",
      durationMinutes: 90,
      updatedAt: "2026-10-20T12:00:00Z",
    },
  ];

  it("computes deterministic sync hashes", () => {
    const h1 = computeSyncHash("Team Standup", "2026-10-21", "09:30:00", 30);
    const h2 = computeSyncHash("Team Standup", "2026-10-21", "09:30:00", 30);
    const h3 = computeSyncHash("Team Standup", "2026-10-21", "10:00:00", 30);

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("correctly identifies items to import and export", () => {
    const diff = calculateCalendarSyncDiff(mockLocalTasks, mockRemoteEvents);

    // Remote event not mapped locally should be queued for import
    expect(diff.toImportToPinboard.length).toBe(1);
    expect(diff.toImportToPinboard[0]!.title).toBe("Quarterly Strategy All-Hands");

    // Local scheduled task should be queued for calendar export
    expect(diff.toExportToCalendar.length).toBe(1);
    expect(diff.toExportToCalendar[0]!.title).toBe("Design System Review");

    // Unscheduled task should NOT be exported to calendar
    expect(diff.toExportToCalendar.some((t) => t.id === "task-2")).toBe(false);
  });

  it("detects conflicts when both sides are edited independently", () => {
    const mappings = new Map<string, { eventId: string; lastSyncedHash: string }>();
    mappings.set("task-1", {
      eventId: "gcal-event-1",
      lastSyncedHash: "old-hash-diff",
    });

    const conflictingEvent: CalendarEvent = {
      id: "gcal-event-1",
      calendarId: "primary",
      title: "Design System Review — Remote Edit",
      startDate: "2026-10-21",
      startTime: "11:00:00",
      updatedAt: "2026-10-21T08:00:00Z",
    };

    const diff = calculateCalendarSyncDiff(mockLocalTasks, [conflictingEvent], mappings);

    expect(diff.conflicts.length).toBe(1);
    expect(diff.conflicts[0]!.taskId).toBe("task-1");
  });
});
