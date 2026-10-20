import { parseISODate, toISODate, type Task } from "./tasks";

export type ExamPlanInput = {
  subject: string;
  examDate: string; // YYYY-MM-DD
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  availableDailyHours: number;
  startDate?: string;
};

export type GeneratedStudySession = {
  title: string;
  scheduledDate: string;
  durationMinutes: number;
  category: string;
  color: string;
  priority: "low" | "medium" | "high" | "urgent";
  subtasks: { title: string }[];
};

export type ExamPlanResult = {
  isFeasible: boolean;
  daysRemaining: number;
  totalRequiredHours: number;
  totalAvailableHours: number;
  warning?: string | undefined;
  sessions: GeneratedStudySession[];
};

export function generateExamPlan(
  input: ExamPlanInput,
  today = new Date(),
): ExamPlanResult {
  const start = input.startDate ? parseISODate(input.startDate) : new Date(today);
  const exam = parseISODate(input.examDate);

  const diffMs = exam.getTime() - start.getTime();
  const daysRemaining = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  // Difficulty weights: hours per topic
  const hoursPerTopic =
    input.difficulty === "hard" ? 3.5 : input.difficulty === "medium" ? 2.5 : 1.5;

  const validTopics = input.topics.filter((t) => t.trim().length > 0);
  const totalTopics = Math.max(1, validTopics.length);

  // Total required study hours
  const totalRequiredHours = totalTopics * hoursPerTopic + 2.0; // +2h for final mock exam
  const totalAvailableHours = daysRemaining * input.availableDailyHours;

  const isFeasible = totalAvailableHours >= totalRequiredHours;
  let warning: string | undefined;

  if (!isFeasible) {
    const deficit = Math.round((totalRequiredHours - totalAvailableHours) * 10) / 10;
    warning = `Unrealistic workload: You need approx ${totalRequiredHours.toFixed(1)}h across ${totalTopics} topics, but only have ${totalAvailableHours.toFixed(1)}h available in the ${daysRemaining} days remaining (deficit: ${deficit}h). Consider increasing daily hours or focusing on high-yield topics.`;
  }

  const sessions: GeneratedStudySession[] = [];

  // Distribute topics across available days before exam
  let dayOffset = 0;
  for (let i = 0; i < validTopics.length; i++) {
    const topic = validTopics[i];
    const sessionDate = new Date(start);
    sessionDate.setDate(sessionDate.getDate() + (dayOffset % daysRemaining));

    // Session 1: Concept Review & Active Recall
    sessions.push({
      title: `${input.subject}: Review ${topic}`,
      scheduledDate: toISODate(sessionDate),
      durationMinutes: input.difficulty === "hard" ? 60 : 45,
      category: "Exam Prep",
      color: "mint",
      priority: input.difficulty === "hard" ? "urgent" : "high",
      subtasks: [
        { title: `Read high-yield notes on ${topic}` },
        { title: "Extract key formulas & definitions" },
        { title: "Active recall self-explanation" },
      ],
    });

    // Session 2: Practice Problems (if medium or hard)
    if (input.difficulty !== "easy") {
      const practiceDate = new Date(sessionDate);
      practiceDate.setDate(practiceDate.getDate() + 1);
      if (practiceDate < exam) {
        sessions.push({
          title: `${input.subject}: Practice Problems on ${topic}`,
          scheduledDate: toISODate(practiceDate),
          durationMinutes: 60,
          category: "Exam Prep",
          color: "peach",
          priority: "high",
          subtasks: [
            { title: `Solve 10 practice questions on ${topic}` },
            { title: "Review mistakes and check answer explanations" },
          ],
        });
      }
    }

    dayOffset++;
  }

  // Final Mock Exam 1 day before the exam
  const mockDate = new Date(exam);
  mockDate.setDate(mockDate.getDate() - 1);
  if (mockDate >= start) {
    sessions.push({
      title: `${input.subject}: Timed Full Mock Exam`,
      scheduledDate: toISODate(mockDate),
      durationMinutes: 90,
      category: "Exam Prep",
      color: "pink",
      priority: "urgent",
      subtasks: [
        { title: "Take timed practice paper in simulated conditions" },
        { title: "Grade against marking rubric" },
        { title: "Final formula sheet review" },
      ],
    });
  }

  // Sort sessions chronologically
  sessions.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  return {
    isFeasible,
    daysRemaining,
    totalRequiredHours,
    totalAvailableHours,
    warning,
    sessions,
  };
}
