import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  Flame,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Award,
  Calendar,
} from "lucide-react";
import { useTasks, useGoals } from "@/hooks/use-data";
import { streak, toISODate, type Task } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress & Insights · Pinboard" }] }),
  component: ProgressPage,
});

const PIE_COLORS = ["#eab308", "#ec4899", "#10b981", "#0ea5e9", "#8b5cf6", "#f97316"];

export function ProgressPage() {
  const { data: tasks = [] } = useTasks();
  const { data: goalsData } = useGoals();
  const goals = goalsData?.goals ?? [];

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  // Streak calculation
  const completedDates = useMemo(() => {
    return completedTasks
      .map((t) => (t.completed_at ? toISODate(new Date(t.completed_at)) : null))
      .filter(Boolean) as string[];
  }, [completedTasks]);

  const currentStreak = useMemo(() => streak(completedDates), [completedDates]);

  // Overall completion rate
  const totalCount = tasks.length;
  const doneCount = completedTasks.length;
  const completionRate = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // Category breakdown for Pie Chart
  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const cat = t.category?.trim() || "Uncategorized";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  // Weekly completion activity for Bar Chart
  const weeklyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    const now = new Date();

    for (const t of completedTasks) {
      if (t.completed_at) {
        const d = new Date(t.completed_at);
        // check if within last 7 days
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 7) {
          counts[d.getDay()]++;
        }
      }
    }

    return days.map((day, idx) => ({
      day,
      completed: counts[idx] ?? 0,
    }));
  }, [completedTasks]);

  return (
    <div className="whiteboard min-h-screen px-4 py-8 md:px-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-note-sky shadow-note">
            <BarChart3 className="size-5 text-ink" />
          </span>
          <h1 className="text-3xl font-bold md:text-4xl">Progress & Velocity</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your productivity streaks, completion rates, and focus balance
        </p>
      </header>

      {/* KPI Stat Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Streak */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Productivity Streak
            </span>
            <Flame className="size-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{currentStreak}</span>
            <span className="text-xs text-muted-foreground">consecutive days</span>
          </div>
        </div>

        {/* Total Completed */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Tasks Completed
            </span>
            <CheckCircle2 className="size-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{doneCount}</span>
            <span className="text-xs text-muted-foreground">of {totalCount} total notes</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Completion Rate
            </span>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{completionRate}%</span>
            <span className="text-xs text-muted-foreground">board velocity</span>
          </div>
        </div>

        {/* Active Monthly Goals */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Monthly Goals
            </span>
            <Award className="size-5 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{goals.length}</span>
            <span className="text-xs text-muted-foreground">active targets</span>
          </div>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Weekly Activity Bar Chart */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm lg:col-span-7">
          <h2 className="text-lg font-semibold mb-1">Weekly Completion Velocity</h2>
          <p className="text-xs text-muted-foreground mb-6">Tasks knocked out by day of the week</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis
                  dataKey="day"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Pie Chart */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm lg:col-span-5">
          <h2 className="text-lg font-semibold mb-1">Category Breakdown</h2>
          <p className="text-xs text-muted-foreground mb-6">Distribution across task domains</p>

          {categoryData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
              No categories logged yet
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
