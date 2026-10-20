import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import {
  Play,
  Pause,
  Filter,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  Flame,
  Plus,
  BarChart3,
  Calendar,
  Clock,
  ArrowUpRight,
  Bot,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface AtelierExecutiveDashboardProps {
  tasks: Task[];
  onOpenNewTask: (defaults?: any) => void;
  onOpenFocusTask: (task: Task) => void;
  onViewAll: () => void;
  onToggleTaskDone: (task: Task) => void;
  isDark: boolean;
  userName?: string;
}

export function AtelierExecutiveDashboard({
  tasks,
  onOpenNewTask,
  onOpenFocusTask,
  onViewAll,
  onToggleTaskDone,
  isDark,
  userName = "Liam",
}: AtelierExecutiveDashboardProps) {
  // Active playing task for 1-click tracking
  const [activeTrackingTaskId, setActiveTrackingTaskId] = useState<string | null>(null);

  // Workflow suggestion index for carousel (< >)
  const [workflowIndex, setWorkflowIndex] = useState(0);
  const workflowSuggestions = [
    {
      title: "Add 'Send Emails' to automation to save 30 minutes.",
      tag: "Email Automation",
      timeSaved: "30 mins",
    },
    {
      title: "Batch review 3 pending tasks into morning focus block.",
      tag: "Focus Blocking",
      timeSaved: "45 mins",
    },
    {
      title: "Auto-roll unfinished tasks to Due Pending at midnight.",
      tag: "Workflow Hygiene",
      timeSaved: "20 mins",
    },
  ];

  const currentWorkflow = workflowSuggestions[workflowIndex];

  // Derive dynamic list of tasks for Quadrant 2
  const displayTasks = useMemo(() => {
    const list = [...tasks].sort((a, b) => {
      if (a.status === "todo" && b.status === "done") return -1;
      if (a.status === "done" && b.status === "todo") return 1;
      return 0;
    });

    if (list.length >= 3) return list.slice(0, 4);

    // Provide luxury preset items matching the mockup if tasks are scarce
    const presets: Task[] = [
      {
        id: "mock-1",
        user_id: "demo",
        title: "Prepare Presentation",
        color: "yellow",
        status: "todo",
        priority: "high",
        scheduled_date: "2026-12-20",
        due_date: "2026-12-20",
        duration_minutes: 210, // 3h 30m
        start_time: null,
        category: "Presentation",
        notes: null,
        recurrence: "none",
        is_archived: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "mock-2",
        user_id: "demo",
        title: "Review Project Plan",
        color: "mint",
        status: "done",
        priority: "medium",
        scheduled_date: "2026-12-21",
        due_date: "2026-12-21",
        duration_minutes: 75, // 1h 15m
        start_time: null,
        category: "Planning",
        notes: null,
        recurrence: "none",
        is_archived: false,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "mock-3",
        user_id: "demo",
        title: "Budget Approval",
        color: "peach",
        status: "todo",
        priority: "high",
        scheduled_date: "2026-12-25",
        due_date: "2026-12-25",
        duration_minutes: 165, // 2h 45m
        start_time: null,
        category: "Finance",
        notes: null,
        recurrence: "none",
        is_archived: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    return [...list, ...presets].slice(0, 4);
  }, [tasks]);

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks],
  );

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & QUICK ACTION CARDS BANNER                */}
      {/* ======================================================== */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="font-editorial text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
            Welcome, <span className="italic font-normal text-[#C5A880]">{userName}!</span>
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground font-medium">
            Automate tasks and achieve more every day.
          </p>
        </div>

        {/* Action Cards Row (Executive Automation Quick Tools) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Card 1: Task / Invoice Bot */}
          <motion.button
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenNewTask()}
            className={cn(
              "group flex items-center gap-3.5 rounded-2xl px-4 py-3 border transition-all text-left cursor-pointer",
              isDark
                ? "bg-gradient-to-br from-[#2D1F17]/90 via-[#20150F]/90 to-[#150D0A]/95 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-lg"
                : "bg-white/90 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-sm hover:shadow-md",
            )}
          >
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#1C1613] to-[#2E1F18] text-[#E8D8C5] shadow-xs">
              <Plus className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <span>Invoice Bot</span>
                <span className="text-[#C5A880]">✦</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Generate Invoices & Tasks</p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </motion.button>

          {/* Card 2: Data Analyzer */}
          <motion.button
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewAll}
            className={cn(
              "group flex items-center gap-3.5 rounded-2xl px-4 py-3 border transition-all text-left cursor-pointer",
              isDark
                ? "bg-gradient-to-br from-[#2D1F17]/90 via-[#20150F]/90 to-[#150D0A]/95 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-lg"
                : "bg-white/90 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-sm hover:shadow-md",
            )}
          >
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#452D1E] to-[#2B1B12] text-[#F0DFCD] shadow-xs">
              <BarChart3 className="size-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Data Analyzer</div>
              <p className="text-[11px] text-muted-foreground">Analyzing daily focus data</p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </motion.button>

          {/* Card 3: Report AI */}
          <Link
            to="/coach"
            className={cn(
              "group flex items-center gap-3.5 rounded-2xl px-4 py-3 border transition-all text-left cursor-pointer",
              isDark
                ? "bg-gradient-to-br from-[#2D1F17]/90 via-[#20150F]/90 to-[#150D0A]/95 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-lg"
                : "bg-white/90 border-[#C5A880]/30 hover:border-[#C5A880]/60 shadow-sm hover:shadow-md",
            )}
          >
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#5A3B29] to-[#362115] text-[#FCEEE1] shadow-xs">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <span>Report AI</span>
                <span className="text-[#C5A880]">✦</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Preparation of review</p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. 4-QUADRANT EXECUTIVE GRID                             */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---------------------------------------------------- */}
        {/* QUADRANT 1: Automated Task List (Weekday Bar Chart)   */}
        {/* ---------------------------------------------------- */}
        <div
          className={cn(
            "rounded-3xl border p-6 flex flex-col justify-between shadow-royal transition-all",
            isDark
              ? "bg-gradient-to-br from-[#251913]/90 via-[#1C120D]/90 to-[#120B08]/95 border-[#C5A880]/25 text-white"
              : "bg-white/90 border-[#C5A880]/25 text-zinc-900 shadow-sm",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight">Automated Task List</h2>
            <div className="flex items-center gap-1 rounded-full border border-border/80 px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <span>Weekdays</span>
              <span className="text-[10px]">⌵</span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="relative pt-6 pb-2">
            {/* Horizontal Guide Lines */}
            <div className="absolute inset-x-0 top-12 border-b border-dashed border-border/40" />
            <div className="absolute inset-x-0 top-24 border-b border-dashed border-border/40" />

            {/* Days Columns */}
            <div className="grid grid-cols-5 gap-3 sm:gap-4 items-end h-56 pt-4">
              {/* Monday */}
              <div className="flex flex-col items-center h-full justify-end group">
                <span className="text-[11px] font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
                  7h 35m
                </span>
                <div className="w-full max-w-[42px] h-[68%] rounded-t-xl bg-gradient-to-t from-[#3D281D] to-[#8C6246]/60 border-t border-[#C5A880]/30 transition-all group-hover:brightness-110" />
                <span className="mt-2 text-xs font-semibold text-muted-foreground">Mon</span>
              </div>

              {/* Tuesday */}
              <div className="flex flex-col items-center h-full justify-end group">
                <span className="text-[11px] font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
                  6h 45m
                </span>
                <div className="w-full max-w-[42px] h-[58%] rounded-t-xl bg-gradient-to-t from-[#3D281D] to-[#8C6246]/60 border-t border-[#C5A880]/30 transition-all group-hover:brightness-110" />
                <span className="mt-2 text-xs font-semibold text-muted-foreground">Tue</span>
              </div>

              {/* Wednesday */}
              <div className="flex flex-col items-center h-full justify-end group">
                <span className="text-[11px] font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
                  3h 45m
                </span>
                <div className="w-full max-w-[42px] h-[34%] rounded-t-xl bg-gradient-to-t from-[#3D281D] to-[#8C6246]/60 border-t border-[#C5A880]/30 transition-all group-hover:brightness-110" />
                <span className="mt-2 text-xs font-semibold text-muted-foreground">Wed</span>
              </div>

              {/* Thursday - Highlighted active day (matching mockup) */}
              <div className="relative flex flex-col items-center h-full justify-end group">
                {/* Elevated time label */}
                <div className="absolute top-2 z-10 rounded-md bg-[#C5A880] px-2 py-0.5 text-[11px] font-bold text-[#1F140E] shadow-md">
                  7h 55m
                </div>
                {/* Highlighted Gradient Bar */}
                <div className="w-full max-w-[48px] h-[82%] rounded-t-xl bg-gradient-to-t from-[#593926] via-[#B88755] to-[#E2C7A8] shadow-lg shadow-[#B88755]/20 ring-1 ring-white/30 transition-transform group-hover:scale-105 duration-200" />
                <span className="mt-2 text-xs font-bold text-[#C5A880]">Thu</span>
              </div>

              {/* Friday */}
              <div className="flex flex-col items-center h-full justify-end group">
                <span className="text-[11px] font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
                  5h 20m
                </span>
                <div className="w-full max-w-[42px] h-[48%] rounded-t-xl bg-gradient-to-t from-[#3D281D] to-[#8C6246]/60 border-t border-[#C5A880]/30 transition-all group-hover:brightness-110" />
                <span className="mt-2 text-xs font-semibold text-muted-foreground">Fri</span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* QUADRANT 2: Tasks List (Interactive Table with Play) */}
        {/* ---------------------------------------------------- */}
        <div
          className={cn(
            "rounded-3xl border p-6 flex flex-col justify-between shadow-royal transition-all",
            isDark
              ? "bg-gradient-to-br from-[#251913]/90 via-[#1C120D]/90 to-[#120B08]/95 border-[#C5A880]/25 text-white"
              : "bg-white/90 border-[#C5A880]/25 text-zinc-900 shadow-sm",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">Tasks List</h2>
              <button
                type="button"
                onClick={onViewAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Filter className="size-3 text-[#C5A880]" />
                <span>Filter</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-bold text-[#C5A880] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>See all</span>
              <span className="text-xs">›</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[11px] font-semibold text-muted-foreground">
                  <th className="pb-2.5 font-medium">Name</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium hidden sm:table-cell">Deadline</th>
                  <th className="pb-2.5 font-medium hidden sm:table-cell">Time Spent</th>
                  <th className="pb-2.5 font-medium text-right">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayTasks.map((task) => {
                  const isDone = task.status === "done";
                  const isTracking = activeTrackingTaskId === task.id;
                  const deadlineStr = task.scheduled_date
                    ? new Date(task.scheduled_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "Flexible";

                  const timeSpentStr = task.duration_minutes
                    ? `${Math.floor(task.duration_minutes / 60)}h ${task.duration_minutes % 60}m`
                    : "1h 30m";

                  return (
                    <tr
                      key={task.id}
                      className="group transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {/* Name */}
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleTaskDone(task)}
                            className="size-4 rounded-full border border-border grid place-items-center cursor-pointer transition-colors hover:border-[#C5A880]"
                          >
                            {isDone && <CheckCircle2 className="size-3 text-emerald-500" />}
                          </button>
                          <span
                            className={cn(
                              "font-semibold text-xs tracking-tight line-clamp-1",
                              isDone && "line-through text-muted-foreground",
                            )}
                          >
                            {task.title}
                          </span>
                          {task.priority === "high" && (
                            <Flame className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-2">
                        {isDone ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#C5A880]/15 border border-[#C5A880]/40 px-2 py-0.5 text-[10px] font-bold text-[#A77C52] dark:text-[#E8D4BF]">
                            In progress
                          </span>
                        )}
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">
                        {deadlineStr}
                      </td>

                      {/* Time Spent */}
                      <td className="py-3 px-2 font-mono text-[11px] text-muted-foreground hidden sm:table-cell">
                        {timeSpentStr}
                      </td>

                      {/* 1-Click Tracking */}
                      <td className="py-3 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (isTracking) {
                              setActiveTrackingTaskId(null);
                            } else {
                              setActiveTrackingTaskId(task.id);
                              onOpenFocusTask(task);
                            }
                          }}
                          title={isTracking ? "Pause Tracking" : "Start Focus Timer"}
                          className={cn(
                            "inline-grid size-7.5 place-items-center rounded-full transition-all cursor-pointer",
                            isTracking
                              ? "bg-amber-500 text-white shadow-md animate-pulse"
                              : "bg-black/10 dark:bg-white/10 hover:bg-[#C5A880] hover:text-[#1E140E] text-foreground",
                          )}
                        >
                          {isTracking ? (
                            <Pause className="size-3.5 fill-current" />
                          ) : (
                            <Play className="size-3.5 ml-0.5 fill-current" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* QUADRANT 3: Optimize Workflow (Card with Mountains)  */}
        {/* ---------------------------------------------------- */}
        <div
          className={cn(
            "relative rounded-3xl border overflow-hidden flex flex-col justify-between shadow-royal transition-all min-h-[280px]",
            isDark
              ? "bg-gradient-to-br from-[#2D1E16] via-[#20140E] to-[#140C08] border-[#C5A880]/30 text-white"
              : "bg-gradient-to-br from-[#FAF5EE] via-[#F3EAE0] to-[#E9DC CE] border-[#C5A880]/35 text-zinc-900 shadow-sm",
          )}
        >
          {/* Card Top Section */}
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[#C5A880] text-sm">✦</span>
                <h2 className="text-base font-bold tracking-tight">Optimize Workflow</h2>
              </div>
              {/* Carousel controls (< >) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setWorkflowIndex(
                      (prev) => (prev - 1 + workflowSuggestions.length) % workflowSuggestions.length,
                    )
                  }
                  className="grid size-6 place-items-center rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-foreground transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWorkflowIndex((prev) => (prev + 1) % workflowSuggestions.length)
                  }
                  className="grid size-6 place-items-center rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-foreground transition-colors cursor-pointer"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-medium max-w-xs leading-relaxed mb-4">
              {currentWorkflow?.title ?? workflowSuggestions[0]?.title}
            </p>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenNewTask()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2B1B13] to-[#170E0A] dark:from-[#EAD9C9] dark:to-[#C5A880] px-4 py-2 text-xs font-bold text-[#F7EFE8] dark:text-[#1B110B] shadow-md border border-[#C5A880]/40 cursor-pointer"
            >
              <span>SET UP</span>
              <ArrowUpRight className="size-3.5" />
            </motion.button>
          </div>

          {/* Majestic Mountain Landscape Visual (Bottom of Card) */}
          <div className="relative w-full h-32 mt-auto overflow-hidden pointer-events-none">
            {/* Ambient sunset sky gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#C5A880]/10 to-transparent" />

            {/* Stylized Mountain Peaks SVG */}
            <svg
              viewBox="0 0 500 150"
              preserveAspectRatio="none"
              className="absolute inset-x-0 bottom-0 w-full h-full opacity-90 dark:opacity-80"
            >
              <defs>
                <linearGradient id="mountainGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8C6347" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#2E1C13" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="mountainGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#C5A880" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#4A2E1F" stopOpacity="0.98" />
                </linearGradient>
                <linearGradient id="snowGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#EAD8C7" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Background mountain silhouette */}
              <polygon
                points="0,150 70,80 160,110 240,60 330,105 420,55 500,110 500,150"
                fill="url(#mountainGrad1)"
              />

              {/* Foreground snowy peak layer */}
              <polygon
                points="0,150 90,95 180,120 280,45 370,95 460,75 500,90 500,150"
                fill="url(#mountainGrad2)"
              />

              {/* Snowy highlights on peaks */}
              <polygon points="280,45 265,70 295,70" fill="url(#snowGlow)" />
              <polygon points="420,55 408,75 432,75" fill="url(#snowGlow)" />
              <polygon points="70,80 58,98 82,98" fill="url(#snowGlow)" />
            </svg>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* QUADRANT 4: Completed Tasks (Smooth Spline Wave)     */}
        {/* ---------------------------------------------------- */}
        <div
          className={cn(
            "rounded-3xl border p-6 flex flex-col justify-between shadow-royal transition-all",
            isDark
              ? "bg-gradient-to-br from-[#251913]/90 via-[#1C120D]/90 to-[#120B08]/95 border-[#C5A880]/25 text-white"
              : "bg-white/90 border-[#C5A880]/25 text-zinc-900 shadow-sm",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight">Completed Tasks</h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                +16% today
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/80 px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <span>Week</span>
              <span className="text-[10px]">⌵</span>
            </div>
          </div>

          {/* Smooth Spline Wave Chart */}
          <div className="relative pt-2 pb-1">
            {/* Y-axis markers */}
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground/70 mb-2">
              <span>40</span>
              <span>30</span>
              <span>20</span>
            </div>

            {/* SVG Spline Chart */}
            <div className="relative h-44 w-full">
              <svg
                viewBox="0 0 500 160"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="splineAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#C5A880" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#8C6246" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#2E1C13" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="splineStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A87B56" />
                    <stop offset="65%" stopColor="#E2C7A8" />
                    <stop offset="100%" stopColor="#C5A880" />
                  </linearGradient>
                </defs>

                {/* Horizontal guide lines */}
                <line
                  x1="0"
                  y1="35"
                  x2="500"
                  y2="35"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-border/30"
                />
                <line
                  x1="0"
                  y1="85"
                  x2="500"
                  y2="85"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-border/30"
                />
                <line
                  x1="0"
                  y1="135"
                  x2="500"
                  y2="135"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-border/30"
                />

                {/* Area under spline */}
                <path
                  d="M 0,140 Q 100,120 180,95 T 320,80 T 420,35 Q 460,70 500,125 L 500,160 L 0,160 Z"
                  fill="url(#splineAreaGrad)"
                />

                {/* Smooth stroke spline */}
                <path
                  d="M 0,140 Q 100,120 180,95 T 320,80 T 420,35 Q 460,70 500,125"
                  fill="none"
                  stroke="url(#splineStrokeGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Milestone Marker at Peak (30) matching mockup */}
                <g transform="translate(420, 35)">
                  {/* Glowing halo */}
                  <circle r="12" fill="#C5A880" opacity="0.3" className="animate-ping" />
                  <circle r="6" fill="#FFFFFF" stroke="#8C6246" strokeWidth="2.5" />
                </g>
              </svg>

              {/* Peak Milestone Badge ("30") positioned over peak */}
              <div className="absolute right-12 sm:right-16 top-0 -translate-y-1/2 flex items-center justify-center">
                <span className="rounded-full bg-[#1F140E] text-[#F5EFEB] dark:bg-[#FAF4ED] dark:text-[#1F140E] border border-[#C5A880] px-2.5 py-0.5 text-[11px] font-black shadow-lg">
                  30
                </span>
              </div>
            </div>

            {/* Bottom summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/20">
              <span>Current Momentum</span>
              <span className="font-semibold text-foreground">
                {completedCount} tasks completed today
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
