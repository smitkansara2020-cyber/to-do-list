import { describe, expect, it } from "vitest";
import { BUILT_IN_TEMPLATES, wouldCreateDependencyCycle } from "./templates";

describe("templates - BUILT_IN_TEMPLATES", () => {
  it("provides templates with subtasks", () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    const assignment = BUILT_IN_TEMPLATES.find((t) => t.id === "assignment");
    expect(assignment).toBeDefined();
    expect(assignment?.subtasks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("templates - wouldCreateDependencyCycle", () => {
  it("detects direct self-cycle", () => {
    expect(wouldCreateDependencyCycle([], "task1", "task1")).toBe(true);
  });

  it("detects 2-node cycle (A -> B and B -> A)", () => {
    const tasks = [
      { id: "A", dependencies: ["B"] },
      { id: "B", dependencies: [] },
    ];
    // Adding A as a dependency to B would create B -> A -> B
    expect(wouldCreateDependencyCycle(tasks, "B", "A")).toBe(true);
    // Adding C as dependency to B is safe
    expect(wouldCreateDependencyCycle(tasks, "B", "C")).toBe(false);
  });

  it("detects transitive multi-node cycle (A -> B -> C -> A)", () => {
    const tasks = [
      { id: "A", dependencies: ["B"] },
      { id: "B", dependencies: ["C"] },
      { id: "C", dependencies: [] },
    ];
    // Making C depend on A creates C -> A -> B -> C
    expect(wouldCreateDependencyCycle(tasks, "C", "A")).toBe(true);
  });
});
