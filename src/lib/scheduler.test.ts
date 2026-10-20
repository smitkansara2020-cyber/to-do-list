import { describe, expect, it } from "vitest";
import {
  calculateWorkload,
  parseAvailabilityCommitments,
  replanDaySchedule,
} from "./scheduler";
import type { Task } from "./tasks";

function mockTask(partial: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2, 8),
    user_id: "u1",
    title: "Mock Task",
    notes: null,
    priority: "medium",
    color: "yellow",
    category: null,
    recurrence: "none",
    status: "todo",
    start_time: null,
    duration_minutes: 30,
    scheduled_date: "2026-10-20",
    due_date: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("scheduler - calculateWorkload", () => {
  it("calculates capacity and breaks properly", () => {
    const tasks = [
      mockTask({ duration_minutes: 60, status: "todo" }),
      mockTask({ duration_minutes: 120, status: "done" }),
    ];

    const workload = calculateWorkload(
      tasks,
      "09:00:00",
      "17:00:00", // 8 hours = 480 mins
      "Lunch 12:00-13:00", // 60 mins break
    );

    expect(workload.totalCapacityMinutes).toBe(480);
    expect(workload.breakMinutes).toBe(60);
    expect(workload.effectiveAvailableMinutes).toBe(420);
    expect(workload.plannedMinutes).toBe(60);
    expect(workload.completedMinutes).toBe(120);
    expect(workload.status).toBe("optimal");
  });

  it("detects overload when planned minutes exceed effective capacity", () => {
    const tasks = [
      mockTask({ duration_minutes: 300, status: "todo" }),
      mockTask({ duration_minutes: 300, status: "todo" }), // 600m total
    ];

    const workload = calculateWorkload(
      tasks,
      "09:00:00",
      "17:00:00", // 480 mins
    );

    expect(workload.status).toBe("overloaded");
    expect(workload.overloadMinutes).toBe(120);
    expect(workload.capacityPercentage).toBe(125);
  });
});

describe("scheduler - parseAvailabilityCommitments", () => {
  it("extracts multiple time intervals", () => {
    const text = "Lunch 12:30-13:30; Daily standup 10:00-10:30";
    const commitments = parseAvailabilityCommitments(text);

    expect(commitments).toHaveLength(2);
    expect(commitments[0]?.start).toBe(12 * 60 + 30);
    expect(commitments[0]?.end).toBe(13 * 60 + 30);
  });
});

describe("scheduler - replanDaySchedule", () => {
  it("schedules tasks in priority and dependency order, dodging breaks", () => {
    const tA = mockTask({ id: "taskA", title: "Research Topic", priority: "urgent", duration_minutes: 60 });
    const tB = mockTask({
      id: "taskB",
      title: "Write Draft",
      priority: "high",
      duration_minutes: 60,
      dependencies: ["taskA"],
    });

    const res = replanDaySchedule(
      [tB, tA], // Input in reverse order
      "09:00:00",
      "13:00:00",
      "Standup 10:00-10:30",
    );

    expect(res.proposedSchedule).toHaveLength(2);
    // Task A should be scheduled first
    expect(res.proposedSchedule[0]?.taskId).toBe("taskA");
    expect(res.proposedSchedule[0]?.startTime).toBe("09:00:00");
    // Task A ends at 10:00, then standup is 10:00-10:30, so Task B starts after 10:30
    expect(res.proposedSchedule[1]?.taskId).toBe("taskB");
    expect(res.proposedSchedule[1]?.startTime).toBe("10:35:00");
  });

  it("identifies overflow tasks when capacity is exceeded", () => {
    const t1 = mockTask({ id: "t1", duration_minutes: 180, priority: "urgent" });
    const t2 = mockTask({ id: "t2", duration_minutes: 180, priority: "low" });

    const res = replanDaySchedule(
      [t1, t2],
      "09:00:00",
      "12:00:00", // Only 180 minutes available
    );

    expect(res.proposedSchedule).toHaveLength(1);
    expect(res.proposedSchedule[0]?.taskId).toBe("t1");
    expect(res.overflowTasks).toHaveLength(1);
    expect(res.overflowTasks[0]?.task.id).toBe("t2");
  });
});
