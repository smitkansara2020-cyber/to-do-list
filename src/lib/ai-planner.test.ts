import { describe, it, expect } from "vitest";
import { parsePlanRequest, extractDurationMinutes, cleanTaskTitle } from "./ai-planner";

describe("AI Planner - Natural Language Duration & Task Parser", () => {
  it("correctly extracts durations in hours, decimal hours, and minutes", () => {
    expect(extractDurationMinutes("learn for 2 hours").minutes).toBe(120);
    expect(extractDurationMinutes("solve leetcode in 1.5hr").minutes).toBe(90);
    expect(extractDurationMinutes("gym for 45 mins").minutes).toBe(45);
    expect(extractDurationMinutes("study for 3h").minutes).toBe(180);
    expect(extractDurationMinutes("read for half an hour").minutes).toBe(30);
  });

  it("handles the user's exact multi-task prompt with 2 hours and 1.5 hours", () => {
    const prompt =
      "hey plan my rodays day i want to learn deepleanrning for 2 hours and also i want to solve 2 leetcode problems in 1.5hr";
    const result = parsePlanRequest(prompt);

    expect(result.tasks.length).toBe(2);

    // Task 1: Deep Learning for 2 hours (120 minutes)
    const task1 = result.tasks[0]!;
    expect(task1.title).toContain("Deep Learning");
    expect(task1.duration_minutes).toBe(120);
    expect(task1.category).toBe("Study");
    expect(task1.subtasks.length).toBeGreaterThan(0);

    // Task 2: LeetCode for 1.5 hours (90 minutes)
    const task2 = result.tasks[1]!;
    expect(task2.title).toContain("LeetCode");
    expect(task2.duration_minutes).toBe(90);
    expect(task2.category).toBe("Coding");
    expect(task2.subtasks.length).toBeGreaterThan(0);
  });

  it("cleans typos and filler words cleanly", () => {
    const title = cleanTaskTitle("i want to learn deepleanrning for 2 hours", "for 2 hours");
    expect(title).toBe("Learn Deep Learning");
  });

  it("accurately parses a single 2 hour session without defaulting to 50m", () => {
    const result = parsePlanRequest("Make a 2 hour deep work session for backend api");
    expect(result.tasks[0]!.duration_minutes).toBe(120);
    expect(result.tasks[0]!.title).toContain("Backend Api");
  });

  it("handles user voice prompt with 'neat code', 'two of us', and meta directives", () => {
    const prompt =
      "I want to learn deep learning for two of us and solve two neat code questions in one hour, 30 minutes ish. So create two Sticky notes for it and I add it in today's list";
    const result = parsePlanRequest(prompt);

    expect(result.tasks.length).toBe(2);

    const task1 = result.tasks[0]!;
    expect(task1.title).toBe("Learn Deep Learning");
    expect(task1.duration_minutes).toBe(120);
    expect(task1.category).toBe("Study");

    const task2 = result.tasks[1]!;
    expect(task2.title).toBe("Solve 2 LeetCode Problems");
    expect(task2.duration_minutes).toBe(90);
    expect(task2.category).toBe("Coding");
    expect(task2.subtasks).toEqual([
      "Problem 1: Pattern identification & optimal solution",
      "Problem 2: Implementation & edge cases",
      "Analyze time & space complexity for both",
    ]);
  });

  it("handles 'deeplearning topic for 120 minutes' cleanly without redundant 'Topic'", () => {
    const result = parsePlanRequest("deeplearning topic for 120 minutes");
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0]!.title).toBe("Deep Learning");
    expect(result.tasks[0]!.duration_minutes).toBe(120);
    expect(result.tasks[0]!.category).toBe("Study");
  });

  it("handles voice prompt with omitted conjunctions ('120 minutes solve tool code problems 30 minutes each')", () => {
    const prompt =
      "I want to learn deep learning for 120 minutes solve tool code problems 30 minutes each";
    const result = parsePlanRequest(prompt);

    expect(result.tasks.length).toBe(2);

    const task1 = result.tasks[0]!;
    expect(task1.title).toBe("Learn Deep Learning");
    expect(task1.duration_minutes).toBe(120);

    const task2 = result.tasks[1]!;
    expect(task2.title).toBe("Solve LeetCode Problems");
    expect(task2.duration_minutes).toBe(60); // 2 problems * 30 min each
    expect(task2.category).toBe("Coding");
  });

  it("handles verbal hours and 'and a half' fractions correctly", () => {
    expect(extractDurationMinutes("study biology for two and a half hours").minutes).toBe(150);
    expect(extractDurationMinutes("read novel for one and a half hours").minutes).toBe(90);
    expect(extractDurationMinutes("session for two hours").minutes).toBe(120);
    expect(extractDurationMinutes("work for 2.5 hours").minutes).toBe(150);
  });

  it("separates tasks with verbal hours and strips meta directive 'add to my board'", () => {
    const prompt =
      "practice guitar for one hour, workout for 45 mins, and study python for two hours. Add to my board";
    const result = parsePlanRequest(prompt);

    expect(result.tasks.length).toBe(3);

    expect(result.tasks[0]!.title).toBe("Practice Guitar");
    expect(result.tasks[0]!.duration_minutes).toBe(60);

    expect(result.tasks[1]!.title).toBe("Workout");
    expect(result.tasks[1]!.duration_minutes).toBe(45);

    expect(result.tasks[2]!.title).toBe("Study Python");
    expect(result.tasks[2]!.duration_minutes).toBe(120);

    // Summary explicitly communicates converted minutes
    expect(result.summaryText).toContain("3 focused sessions totaling **3.8h** (225m)");
    expect(result.summaryText).toContain("• **Practice Guitar** (60m)");
    expect(result.summaryText).toContain("• **Workout** (45m)");
    expect(result.summaryText).toContain("• **Study Python** (120m)");
  });
});
