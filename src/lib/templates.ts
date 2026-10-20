import type { SubTask, Task } from "./tasks";

export type TaskTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  priority: "low" | "medium" | "high" | "urgent";
  defaultDurationMinutes: number;
  subtasks: { title: string }[];
};

export const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: "assignment",
    name: "Assignment & Essay Workflow",
    description: "Complete structured process from research to final citations proofread",
    category: "Assignment",
    color: "mint",
    priority: "high",
    defaultDurationMinutes: 120,
    subtasks: [
      { title: "Literature & source material research" },
      { title: "Draft outline with headings & key arguments" },
      { title: "Write initial rough draft" },
      { title: "Review citations & bibliography formatting" },
      { title: "Final proofreading & spell check" },
    ],
  },
  {
    id: "exam_revision",
    name: "Exam Revision & Practice",
    description: "High-yield review, active recall flashcards, and timed practice testing",
    category: "Revision",
    color: "peach",
    priority: "urgent",
    defaultDurationMinutes: 90,
    subtasks: [
      { title: "Review chapter summary & high-yield formulas" },
      { title: "Active recall flashcards session" },
      { title: "Solve timed practice exam questions" },
      { title: "Audit wrong answers & document weaknesses" },
    ],
  },
  {
    id: "gym_session",
    name: "Gym & Strength Workout",
    description: "Structured gym routine with warmup, main lifts, accessories, and stretch",
    category: "Fitness",
    color: "sky",
    priority: "medium",
    defaultDurationMinutes: 60,
    subtasks: [
      { title: "Dynamic mobility & joint warmup (5-10m)" },
      { title: "Primary heavy compound lift (4 sets)" },
      { title: "Secondary accessory superset (3 sets)" },
      { title: "Core & cool-down mobility stretching" },
    ],
  },
  {
    id: "project_release",
    name: "Project / Software Release",
    description: "Production release sequence: code freeze, test suite, and smoke tests",
    category: "Release",
    color: "lilac",
    priority: "high",
    defaultDurationMinutes: 90,
    subtasks: [
      { title: "Code freeze & feature branch merge" },
      { title: "Run full automated test suite & type checks" },
      { title: "Generate changelog & release notes" },
      { title: "Deploy to staging & run smoke tests" },
      { title: "Production deployment & health monitoring" },
    ],
  },
];

/**
 * Dependency Cycle Prevention Algorithm (DAG Cycle Detection)
 * Returns true if adding `proposedPrerequisiteId` as a dependency for `targetTaskId`
 * would create a circular dependency (e.g. A -> B -> A).
 */
export function wouldCreateDependencyCycle(
  tasks: Pick<Task, "id" | "dependencies">[],
  targetTaskId: string,
  proposedPrerequisiteId: string,
): boolean {
  if (targetTaskId === proposedPrerequisiteId) return true;

  // Build adjacency list: node -> prerequisites
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, t.dependencies ?? []);
  }

  // If proposedPrerequisite already depends on targetTaskId directly or transitively, cycle!
  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (currentId === targetTaskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const prerequisites = adj.get(currentId) ?? [];
    for (const prereq of prerequisites) {
      if (dfs(prereq)) return true;
    }
    return false;
  }

  return dfs(proposedPrerequisiteId);
}
