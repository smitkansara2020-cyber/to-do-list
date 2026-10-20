import { toMinutes, fmtTime, type Task } from "./tasks";

export type WorkloadSummary = {
  dayStartMinutes: number;
  dayEndMinutes: number;
  totalCapacityMinutes: number;
  breakMinutes: number;
  effectiveAvailableMinutes: number;
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  overloadMinutes: number;
  capacityPercentage: number;
  status: "optimal" | "heavy" | "overloaded";
};

export type FixedCommitment = {
  id: string;
  title: string;
  start: number; // minutes from midnight
  end: number;
};

export type ScheduledSlot = {
  taskId: string;
  task: Task;
  startTime: string; // HH:MM:00
  endTime: string;
  startMinutes: number;
  durationMinutes: number;
};

export type ReplanResult = {
  originalSchedule: { id: string; startTime: string | null; scheduledDate: string | null }[];
  proposedSchedule: ScheduledSlot[];
  overflowTasks: {
    task: Task;
    reason: string;
  }[];
  explanation: string;
};

/**
 * Extracts fixed commitments and lunch/coffee breaks from availability_notes
 * e.g. "Lunch 12:00-13:00, Daily standup 10:00-10:30"
 */
export function parseAvailabilityCommitments(notes: string | null | undefined): FixedCommitment[] {
  if (!notes) return [];
  const commitments: FixedCommitment[] = [];
  const lines = notes.split(/[,;\n]/);

  for (const line of lines) {
    const timeMatch = line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      const start = toMinutes(timeMatch[1]);
      const end = toMinutes(timeMatch[2]);
      if (end > start) {
        const title = line.replace(timeMatch[0], "").trim() || "Commitment / Break";
        commitments.push({
          id: Math.random().toString(36).slice(2, 7),
          title,
          start,
          end,
        });
      }
    }
  }
  return commitments;
}

/**
 * Calculates total planned workload vs available daily capacity
 */
export function calculateWorkload(
  tasks: Task[],
  dayStart = "09:00:00",
  dayEnd = "18:00:00",
  availabilityNotes?: string | null,
): WorkloadSummary {
  const startMin = toMinutes(dayStart.slice(0, 5));
  const endMin = toMinutes(dayEnd.slice(0, 5));
  const rawCapacity = Math.max(0, endMin - startMin);

  const commitments = parseAvailabilityCommitments(availabilityNotes);
  const breakMinutes = commitments.reduce((acc, c) => acc + (c.end - c.start), 0);
  const effectiveAvailable = Math.max(0, rawCapacity - breakMinutes);

  let plannedMinutes = 0;
  let completedMinutes = 0;

  for (const t of tasks) {
    const dur = t.duration_minutes || 30;
    if (t.status === "done") {
      completedMinutes += dur;
    } else {
      plannedMinutes += dur;
    }
  }

  const remainingMinutes = Math.max(0, effectiveAvailable - plannedMinutes);
  const overloadMinutes = Math.max(0, plannedMinutes - effectiveAvailable);
  const capacityPercentage =
    effectiveAvailable > 0 ? Math.round((plannedMinutes / effectiveAvailable) * 100) : 100;

  let status: WorkloadSummary["status"] = "optimal";
  if (capacityPercentage > 100) {
    status = "overloaded";
  } else if (capacityPercentage >= 80) {
    status = "heavy";
  }

  return {
    dayStartMinutes: startMin,
    dayEndMinutes: endMin,
    totalCapacityMinutes: rawCapacity,
    breakMinutes,
    effectiveAvailableMinutes: effectiveAvailable,
    plannedMinutes,
    completedMinutes,
    remainingMinutes,
    overloadMinutes,
    capacityPercentage,
    status,
  };
}

/**
 * Re-plans the day schedule:
 * 1. Preserves completed tasks and existing fixed commitments/breaks.
 * 2. Respects task dependencies (prerequisites must finish before dependents start).
 * 3. Sorts tasks by priority (urgent > high > medium > low), then deadlines.
 * 4. Places tasks contiguously in available working slots with 5-minute transition buffers.
 * 5. Explains what tasks could not fit in the remaining workday.
 */
export function replanDaySchedule(
  tasks: Task[],
  dayStart = "09:00:00",
  dayEnd = "18:00:00",
  availabilityNotes?: string | null,
): ReplanResult {
  const startMin = toMinutes(dayStart.slice(0, 5));
  const endMin = toMinutes(dayEnd.slice(0, 5));
  const commitments = parseAvailabilityCommitments(availabilityNotes);

  // Preserve completed work and fixed commitment ranges
  const busyIntervals: { start: number; end: number; label: string }[] = commitments.map((c) => ({
    start: c.start,
    end: c.end,
    label: c.title,
  }));

  const activeTasks: Task[] = [];
  const originalSchedule: ReplanResult["originalSchedule"] = [];

  for (const t of tasks) {
    originalSchedule.push({
      id: t.id,
      startTime: t.start_time,
      scheduledDate: t.scheduled_date,
    });

    if (t.status === "done" && t.start_time) {
      const s = toMinutes(t.start_time.slice(0, 5));
      const dur = t.duration_minutes || 30;
      busyIntervals.push({ start: s, end: s + dur, label: `Completed: ${t.title}` });
    } else if (t.status !== "done") {
      activeTasks.push(t);
    }
  }

  // Priority weighting
  const priorityScore: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Topological sort / dependency order
  const taskMap = new Map(activeTasks.map((t) => [t.id, t]));
  const sorted: Task[] = [];
  const visited = new Set<string>();

  function visit(t: Task) {
    if (visited.has(t.id)) return;
    visited.add(t.id);
    for (const depId of t.dependencies ?? []) {
      const dep = taskMap.get(depId);
      if (dep) visit(dep);
    }
    sorted.push(t);
  }

  // Sort candidates primarily by priority and due date
  const prioritized = [...activeTasks].sort((a, b) => {
    const pDiff = (priorityScore[b.priority] || 2) - (priorityScore[a.priority] || 2);
    if (pDiff !== 0) return pDiff;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  for (const t of prioritized) {
    visit(t);
  }

  const proposedSchedule: ScheduledSlot[] = [];
  const overflowTasks: ReplanResult["overflowTasks"] = [];

  let cursor = startMin;
  const finishTimeMap = new Map<string, number>();

  for (const t of sorted) {
    const dur = t.duration_minutes || 30;

    // Prerequisite check: must start after all completed dependencies finish
    let earliestPossibleStart = cursor;
    for (const depId of t.dependencies ?? []) {
      const depFinish = finishTimeMap.get(depId);
      if (depFinish !== undefined && depFinish > earliestPossibleStart) {
        earliestPossibleStart = depFinish;
      }
    }

    let candidateStart = Math.max(cursor, earliestPossibleStart);
    let fitted = false;

    // Scan for a contiguous slot between candidateStart and endMin
    while (candidateStart + dur <= endMin) {
      const candidateEnd = candidateStart + dur;

      // Check collision with busy intervals
      const collision = busyIntervals.find(
        (b) => candidateStart < b.end && candidateEnd > b.start,
      );

      if (!collision) {
        // Fits!
        const startStr = `${String(Math.floor(candidateStart / 60)).padStart(2, "0")}:${String(candidateStart % 60).padStart(2, "0")}:00`;
        const endStr = `${String(Math.floor(candidateEnd / 60)).padStart(2, "0")}:${String(candidateEnd % 60).padStart(2, "0")}:00`;

        proposedSchedule.push({
          taskId: t.id,
          task: t,
          startTime: startStr,
          endTime: endStr,
          startMinutes: candidateStart,
          durationMinutes: dur,
        });

        busyIntervals.push({ start: candidateStart, end: candidateEnd, label: t.title });
        finishTimeMap.set(t.id, candidateEnd);
        cursor = candidateEnd + 5; // 5 min transition buffer
        fitted = true;
        break;
      } else {
        // Advance past collision
        candidateStart = collision.end + 5;
      }
    }

    if (!fitted) {
      overflowTasks.push({
        task: t,
        reason:
          candidateStart + dur > endMin
            ? `Exceeds day boundary (${fmtTime(endMin)}) by ${candidateStart + dur - endMin}m`
            : "No contiguous time slot available among commitments",
      });
    }
  }

  const fittedCount = proposedSchedule.length;
  const overflowCount = overflowTasks.length;
  let explanation = `Scheduled ${fittedCount} tasks sequentially within your working hours (${fmtTime(startMin)} - ${fmtTime(endMin)}).`;
  if (overflowCount > 0) {
    explanation += ` ${overflowCount} lower-priority task${overflowCount > 1 ? "s" : ""} could not fit into today's remaining capacity and can be carried forward or rescheduled.`;
  }

  return {
    originalSchedule,
    proposedSchedule,
    overflowTasks,
    explanation,
  };
}
