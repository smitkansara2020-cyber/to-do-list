/**
 * Reusable Two-Way Calendar Sync Architecture
 * Supports Google Calendar and Microsoft Outlook providers, bidirectional diff calculation,
 * conflict resolution, sync-loop prevention with hash tracking, and import previews.
 */

import { type Task } from "@/lib/tasks";

export type CalendarProviderType = "google" | "outlook";

export interface CalendarInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  color?: string;
  readOnly: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM:SS
  endDate?: string;
  endTime?: string;
  durationMinutes?: number;
  etag?: string;
  updatedAt: string;
  isCancelled?: boolean;
}

export interface SyncConflict {
  taskId: string;
  taskTitle: string;
  eventId: string;
  eventTitle: string;
  reason: string;
}

export interface CalendarSyncDiff {
  toImportToPinboard: CalendarEvent[];
  toExportToCalendar: Task[];
  toUpdateInPinboard: { task: Task; event: CalendarEvent }[];
  conflicts: SyncConflict[];
}

export interface ICalendarProvider {
  type: CalendarProviderType;
  listCalendars(): Promise<CalendarInfo[]>;
  fetchEvents(calendarId: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]>;
  upsertEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<boolean>;
}

/** Computes a content hash to detect genuine changes and prevent infinite sync echo-loops */
export function computeSyncHash(title: string, date: string, time = "", duration = 0): string {
  const str = `${title.trim()}|${date}|${time}|${duration}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Calculates a clean, non-destructive sync diff between Pinboard tasks and external calendar events
 */
export function calculateCalendarSyncDiff(
  localTasks: Task[],
  remoteEvents: CalendarEvent[],
  existingMappings: Map<string, { eventId: string; lastSyncedHash: string }> = new Map(),
): CalendarSyncDiff {
  const toImportToPinboard: CalendarEvent[] = [];
  const toExportToCalendar: Task[] = [];
  const toUpdateInPinboard: { task: Task; event: CalendarEvent }[] = [];
  const conflicts: SyncConflict[] = [];

  const taskMapByEventId = new Map<string, Task>();
  for (const t of localTasks) {
    const mapping = existingMappings.get(t.id);
    if (mapping) {
      taskMapByEventId.set(mapping.eventId, t);
    }
  }

  // 1. Process Remote Events
  for (const event of remoteEvents) {
    if (event.isCancelled) continue;

    const matchedTask = taskMapByEventId.get(event.id);

    if (!matchedTask) {
      // Event exists on calendar but not yet mapped in Pinboard -> Import
      toImportToPinboard.push(event);
    } else {
      // Both exist: check hashes to prevent redundant echo-loops
      const currentTaskHash = computeSyncHash(
        matchedTask.title,
        matchedTask.scheduled_date || matchedTask.due_date || "",
        matchedTask.start_time || "",
        matchedTask.duration_minutes || 0,
      );

      const mapping = existingMappings.get(matchedTask.id);
      const isRemoteModified = new Date(event.updatedAt).getTime() > (matchedTask.updated_at ? new Date(matchedTask.updated_at).getTime() : 0);

      if (isRemoteModified && mapping && mapping.lastSyncedHash !== currentTaskHash) {
        // Both changed independently -> conflict!
        conflicts.push({
          taskId: matchedTask.id,
          taskTitle: matchedTask.title,
          eventId: event.id,
          eventTitle: event.title,
          reason: "Both local sticky note and external calendar event were modified independently.",
        });
      } else if (isRemoteModified) {
        toUpdateInPinboard.push({ task: matchedTask, event });
      }
    }
  }

  // 2. Process Local Tasks that have not yet been exported
  for (const task of localTasks) {
    if (task.status === "done") continue;
    const hasScheduledTime = Boolean(task.scheduled_date && task.start_time);
    const mapping = existingMappings.get(task.id);

    if (!mapping && hasScheduledTime) {
      toExportToCalendar.push(task);
    }
  }

  return {
    toImportToPinboard,
    toExportToCalendar,
    toUpdateInPinboard,
    conflicts,
  };
}
