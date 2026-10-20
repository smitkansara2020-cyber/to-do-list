import { describe, expect, it } from "vitest";
import {
  findConflicts,
  nextOccurrence,
  streak,
  taskBlocks,
  encodeTaskNotes,
  extractTaskMeta,
} from "./tasks";

describe("recurring tasks", () => {
  it("daily moves one day", () => expect(nextOccurrence("2026-10-31", "daily")).toBe("2026-11-01"));
  it("weekly moves seven days", () =>
    expect(nextOccurrence("2026-10-17", "weekly")).toBe("2026-10-24"));
  it("monthly clamps to month end", () =>
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28"));
  it("non-recurring has no next", () => expect(nextOccurrence("2026-10-17", "none")).toBeNull());
});

describe("daily plan conflicts", () => {
  it("detects overlapping blocks", () => {
    const b = taskBlocks([
      { id: "a", title: "A", start_time: "09:00", duration_minutes: 60 },
      { id: "b", title: "B", start_time: "09:30", duration_minutes: 30 },
      { id: "c", title: "C", start_time: "10:00", duration_minutes: 30 },
    ]);
    expect(findConflicts(b).map(([x, y]) => x.id + y.id)).toEqual(["ab"]);
  });
});

describe("streak", () => {
  it("counts consecutive days", () =>
    expect(streak(["2026-10-17", "2026-10-16", "2026-10-14"], new Date(2026, 9, 17))).toBe(2));
});

describe("task metadata packing & extraction", () => {
  it("packs and extracts subtasks, goal_id, and actual_minutes", () => {
    const rawNotes = "User original note on task";
    const encoded = encodeTaskNotes(rawNotes, {
      goal_id: "goal-123",
      subtasks: [
        { id: "s1", title: "Subtask 1", done: false },
        { id: "s2", title: "Subtask 2", done: true },
      ],
      dependencies: ["task-abc"],
      actual_minutes: 45,
      recurrence_paused: true,
    });

    const { cleanNotes, meta } = extractTaskMeta(encoded);
    expect(cleanNotes).toBe("User original note on task");
    expect(meta.goal_id).toBe("goal-123");
    expect(meta.subtasks).toHaveLength(2);
    expect(meta.subtasks?.[1]?.done).toBe(true);
    expect(meta.dependencies).toEqual(["task-abc"]);
    expect(meta.actual_minutes).toBe(45);
    expect(meta.recurrence_paused).toBe(true);
  });

  it("handles plain notes without metadata gracefully", () => {
    const { cleanNotes, meta } = extractTaskMeta("Just plain text notes");
    expect(cleanNotes).toBe("Just plain text notes");
    expect(meta.goal_id).toBeUndefined();
    expect(meta.subtasks).toBeUndefined();
  });
});
