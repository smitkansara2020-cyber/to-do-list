import type { Database } from "@/integrations/supabase/types";

export type BaseTask = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["monthly_goals"]["Row"];
export type GoalUpdate = Database["public"]["Tables"]["goal_updates"]["Row"];

export type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

export type DailyCleanupMode = "archive" | "carry_forward" | "skip" | "trash";

// Extended task metadata safely encoded or locally cached
export type TaskExtension = {
  goal_id?: string | null | undefined;
  subtasks?: SubTask[] | undefined;
  dependencies?: string[] | undefined; // IDs of tasks that must be done first
  is_archived?: boolean | undefined;
  deleted_at?: string | null | undefined; // Soft-delete for recycle bin
  actual_minutes?: number | undefined; // Real tracked focus time
  rest_days?: number[] | undefined; // [0 = Sun, 6 = Sat]
  parent_recurrence_id?: string | null | undefined;
  recurrence_paused?: boolean | undefined;
  original_scheduled_date?: string | null | undefined;
  original_due_date?: string | null | undefined;
  carried_forward_count?: number | undefined;
  selected_weekdays?: number[] | undefined; // e.g. [1, 3, 5] for Mon, Wed, Fri
  habit_frequency?: number | undefined; // times per week e.g. 3
  links?: { title: string; url: string }[] | undefined;
};

export type Task = BaseTask & {
  // Enhanced runtime fields
  goal_id?: string | null | undefined;
  subtasks?: SubTask[] | undefined;
  dependencies?: string[] | undefined;
  is_archived?: boolean | undefined;
  deleted_at?: string | null | undefined;
  actual_minutes?: number | undefined;
  recurrence_paused?: boolean | undefined;
  original_scheduled_date?: string | null | undefined;
  original_due_date?: string | null | undefined;
  carried_forward_count?: number | undefined;
  selected_weekdays?: number[] | undefined;
  rest_days?: number[] | undefined;
  habit_frequency?: number | undefined;
  links?: { title: string; url: string }[] | undefined;
};

export const NOTE_COLORS = ["yellow", "pink", "mint", "sky", "lilac", "peach"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const noteBg: Record<string, string> = {
  yellow: "bg-note-yellow",
  pink: "bg-note-pink",
  mint: "bg-note-mint",
  sky: "bg-note-sky",
  lilac: "bg-note-lilac",
  peach: "bg-note-peach",
};

export const TASK_STATUSES = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

export const STATUSES = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;

export const RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;

/** Local YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Next occurrence date for a recurring task. Supports selected weekdays, rest days, and monthly month-end clamping. */
export function nextOccurrence(
  date: string,
  recurrence: string,
  step = 1,
  options?: { selectedWeekdays?: number[] | undefined; restDays?: number[] | undefined },
): string | null {
  const d = parseISODate(date);
  const selectedWeekdays = options?.selectedWeekdays;
  const restDays = new Set(options?.restDays ?? []);

  if (selectedWeekdays && selectedWeekdays.length > 0) {
    // Advance day by day until matching a selected weekday that is not a rest day
    for (let i = 1; i <= 14; i++) {
      const next = new Date(d);
      next.setDate(next.getDate() + i);
      const dayOfWeek = next.getDay();
      if (selectedWeekdays.includes(dayOfWeek) && !restDays.has(dayOfWeek)) {
        return toISODate(next);
      }
    }
    return null;
  }

  if (recurrence === "daily") {
    d.setDate(d.getDate() + 1 * step);
    // If next day is a rest day, skip it
    while (restDays.has(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
  } else if (recurrence === "weekly") {
    d.setDate(d.getDate() + 7 * step);
    while (restDays.has(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
  } else if (recurrence === "monthly") {
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + 1 * step, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    while (restDays.has(target.getDay())) {
      target.setDate(target.getDate() + 1);
    }
    return toISODate(target);
  } else {
    return null;
  }
  return toISODate(d);
}

export function monthStart(d = new Date()): string {
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function prevMonthStart(d = new Date()): string {
  return toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function nextMonthStart(d = new Date()): string {
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export function toMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export type Block = { id: string; title: string; start: number; end: number };

export function taskBlocks(
  tasks: Pick<Task, "id" | "title" | "start_time" | "duration_minutes">[],
): Block[] {
  return tasks
    .filter((t) => t.start_time)
    .map((t) => {
      const start = toMinutes(t.start_time!);
      return { id: t.id, title: t.title, start, end: start + (t.duration_minutes || 30) };
    })
    .sort((a, b) => a.start - b.start);
}

/** Pairs of time blocks that overlap. */
export function findConflicts(blocks: Block[]): [Block, Block][] {
  const out: [Block, Block][] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]!,
        b = blocks[j]!;
      if (b.start < a.end && a.start < b.end) out.push([a, b]);
    }
  return out;
}

/** Consecutive days (ending today or yesterday) with at least one completed task.
 * Rest days do not penalize or break streaks.
 */
export function streak(completedDates: string[], today = new Date(), restDays: number[] = []): number {
  const set = new Set(completedDates);
  const restSet = new Set(restDays);
  const d = new Date(today);

  // If today is not completed, check if it's a rest day or if streak ended yesterday
  if (!set.has(toISODate(d))) {
    d.setDate(d.getDate() - 1);
  }

  let n = 0;
  let safety = 365;
  while (safety-- > 0) {
    const iso = toISODate(d);
    if (set.has(iso)) {
      n++;
      d.setDate(d.getDate() - 1);
    } else if (restSet.has(d.getDay())) {
      // Rest day: skip without breaking streak if there was past completion
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return n;
}

/** Calculates missed days between start and end date (clamped to today),
 * explicitly excluding future days, rest days, and days before task creation.
 */
export function calculateMissedDays(
  startDateStr: string,
  endDateStr: string,
  completedDates: string[],
  restDays: number[] = [],
  today = new Date(),
): string[] {
  const completedSet = new Set(completedDates);
  const restSet = new Set(restDays);
  const todayStr = toISODate(today);
  
  const cur = parseISODate(startDateStr);
  const end = parseISODate(endDateStr < todayStr ? endDateStr : todayStr);
  
  const missed: string[] = [];
  while (cur <= end) {
    const curStr = toISODate(cur);
    if (curStr > todayStr) break; // Exclude future days
    
    if (!completedSet.has(curStr) && !restSet.has(cur.getDay())) {
      missed.push(curStr);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return missed;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------- Task Extra Metadata Serializer ---------------- //
// Encodes subtasks, goal_id, dependencies, etc. into notes or sync store
const META_TAG = "__PINBOARD_META__:";

export function extractTaskMeta(rawNotes: string | null): {
  cleanNotes: string;
  meta: TaskExtension;
} {
  if (!rawNotes || !rawNotes.includes(META_TAG)) {
    return { cleanNotes: rawNotes ?? "", meta: {} };
  }
  const parts = rawNotes.split(META_TAG);
  const cleanNotes = parts[0]?.trimEnd() ?? "";
  try {
    const meta = JSON.parse(parts[1] || "{}") as TaskExtension;
    return { cleanNotes, meta };
  } catch {
    return { cleanNotes: rawNotes, meta: {} };
  }
}

export function encodeTaskNotes(notes: string | null, meta: TaskExtension): string {
  const clean = notes?.replace(new RegExp(`\\n*${META_TAG}.*$`, "s"), "").trim() ?? "";
  const hasMeta = Object.keys(meta).length > 0;
  if (!hasMeta) return clean;
  return `${clean}\n\n${META_TAG}${JSON.stringify(meta)}`;
}
