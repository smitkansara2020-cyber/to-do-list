import { describe, expect, it } from "vitest";
import { parseNaturalLanguageTask } from "./nlp-parser";
import { toISODate } from "./tasks";

describe("parseNaturalLanguageTask", () => {
  const refDate = new Date(2026, 9, 20, 10, 0, 0); // Tuesday, Oct 20, 2026

  it("parses: Revise Java tomorrow at 7 PM for 45 minutes", () => {
    const res = parseNaturalLanguageTask(
      "Revise Java tomorrow at 7 PM for 45 minutes",
      refDate,
    );

    expect(res.title).toBe("Revise Java");
    expect(res.scheduled_date).toBe("2026-10-21"); // Tomorrow
    expect(res.start_time).toBe("19:00:00"); // 7 PM
    expect(res.duration_minutes).toBe(45);
    expect(res.category).toBe("Study");
    expect(res.color).toBe("mint");
  });

  it("parses: Team sync on Friday 10:30am for 1 hour #work", () => {
    const res = parseNaturalLanguageTask(
      "Team sync on Friday 10:30am for 1 hour #work",
      refDate,
    );

    expect(res.title).toBe("Team sync");
    expect(res.scheduled_date).toBe("2026-10-23"); // Friday
    expect(res.start_time).toBe("10:30:00");
    expect(res.duration_minutes).toBe(60);
    expect(res.category).toBe("Work");
  });

  it("parses: Buy groceries today 5pm urgent", () => {
    const res = parseNaturalLanguageTask(
      "Buy groceries today 5pm urgent",
      refDate,
    );

    expect(res.title).toBe("Buy groceries");
    expect(res.scheduled_date).toBe("2026-10-20");
    expect(res.start_time).toBe("17:00:00");
    expect(res.priority).toBe("urgent");
    expect(res.category).toBe("Personal");
  });

  it("handles ambiguous date when day is today", () => {
    const res = parseNaturalLanguageTask(
      "Workout Tuesday at noon",
      refDate, // Tuesday
    );

    expect(res.scheduled_date).toBe("2026-10-20");
    expect(res.start_time).toBe("12:00:00");
    expect(res.ambiguityWarning).toBeDefined();
  });

  it("parses plain thought without mandatory dates or planning fields", () => {
    const res = parseNaturalLanguageTask(
      "Think about refactoring state machine",
      refDate,
    );

    expect(res.title).toBe("Think about refactoring state machine");
    expect(res.scheduled_date).toBeNull();
    expect(res.start_time).toBeNull();
    expect(res.duration_minutes).toBeNull();
    expect(res.priority).toBe("medium");
  });
});
