import { describe, expect, it } from "vitest";
import { generateExamPlan } from "./exam-planner";

describe("generateExamPlan", () => {
  const today = new Date(2026, 9, 20); // 2026-10-20

  it("generates structured sessions across available days", () => {
    const plan = generateExamPlan(
      {
        subject: "Biology",
        examDate: "2026-10-25", // 5 days remaining
        topics: ["Cell Division", "Genetics", "Ecology"],
        difficulty: "medium",
        availableDailyHours: 3,
        startDate: "2026-10-20",
      },
      today,
    );

    expect(plan.daysRemaining).toBe(5);
    expect(plan.isFeasible).toBe(true);
    expect(plan.sessions.length).toBeGreaterThanOrEqual(4);
    // Should include final mock exam
    const mockExam = plan.sessions.find((s) => s.title.includes("Mock Exam"));
    expect(mockExam).toBeDefined();
    expect(mockExam?.scheduledDate).toBe("2026-10-24");
  });

  it("flags unrealistic workloads when time is insufficient", () => {
    const plan = generateExamPlan(
      {
        subject: "Physics",
        examDate: "2026-10-22", // Only 2 days
        topics: ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics", "Nuclear"],
        difficulty: "hard",
        availableDailyHours: 1, // 2h total available vs ~19h needed!
        startDate: "2026-10-20",
      },
      today,
    );

    expect(plan.isFeasible).toBe(false);
    expect(plan.warning).toBeDefined();
    expect(plan.warning).toContain("Unrealistic workload");
  });
});
