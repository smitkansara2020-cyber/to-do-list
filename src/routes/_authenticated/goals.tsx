import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Target,
  Plus,
  Calendar,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowLeft,
  Pin,
  Sun,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  History,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { GoalProgress } from "@/components/GoalProgress";
import { StickyNote } from "@/components/StickyNote";
import { StickyNotesCarousel } from "@/components/StickyNotesCarousel";
import { TaskDialog } from "@/components/TaskDialog";
import { SyncIndicator } from "@/components/SyncIndicator";
import {
  useGoals,
  useSaveGoal,
  useDeleteGoal,
  useLogGoal,
  useTasks,
  useUpdateTask,
  useCompleteTask,
} from "@/hooks/use-data";
import { monthStart, toISODate, NOTE_COLORS, type Task, type Goal } from "@/lib/tasks";
import { WORK_CATEGORIES, detectCategory, formatTitleWithEmoji } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Monthly Goals · Pinboard" }] }),
  component: GoalsPage,
});

export function GoalsPage() {
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => new Date());
  const todayStr = useMemo(() => toISODate(new Date()), []);

  const selectedMonthStr = useMemo(() => monthStart(selectedMonthDate), [selectedMonthDate]);
  const isViewingCurrentMonth = useMemo(
    () => selectedMonthStr === monthStart(new Date()),
    [selectedMonthStr],
  );

  const { data: goalsData, isLoading: goalsLoading } = useGoals();
  const { data: allTasks = [] } = useTasks();
  const goals = goalsData?.goals ?? [];
  const updates = goalsData?.updates ?? [];

  const saveGoal = useSaveGoal();
  const deleteGoal = useDeleteGoal();
  const logGoal = useLogGoal();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();

  const [openGoalDialog, setOpenGoalDialog] = useState(false);
  const [openCheckInDialog, setOpenCheckInDialog] = useState(false);
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [checkInVal, setCheckInVal] = useState<number>(0);
  const [checkInNote, setCheckInNote] = useState("");
  const [dragOverTodayZone, setDragOverTodayZone] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [goalTypeFilter, setGoalTypeFilter] = useState<"all" | "numeric" | "habit">("all");

  // New goal form state
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("5");
  const [goalUnit, setGoalUnit] = useState("hours");
  const [goalColor, setGoalColor] = useState("mint");

  // Month navigation
  function prevMonth() {
    setSelectedMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setSelectedMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function jumpToCurrentMonth() {
    setSelectedMonthDate(new Date());
  }

  // Categorized goals with auto-detected category & emoji
  const categorizedGoals = useMemo(() => {
    return goals.map((g) => {
      const detected = detectCategory(g.title);
      const isHabit =
        (g.unit &&
          ["day", "days", "session", "sessions", "times", "streak"].includes(
            g.unit.toLowerCase(),
          )) ||
        g.title.toLowerCase().includes("daily") ||
        g.title.toLowerCase().includes("habit") ||
        g.title.toLowerCase().includes("routine");

      return {
        ...g,
        categoryName: detected.category,
        categoryEmoji: detected.emoji,
        displayTitle: formatTitleWithEmoji(g.title, detected.emoji),
        goalType: isHabit ? ("habit" as const) : ("numeric" as const),
      };
    });
  }, [goals]);

  // Filtered goals according to selected category and type
  const filteredGoals = useMemo(() => {
    return categorizedGoals.filter((g) => {
      if (
        selectedCategory !== "all" &&
        !g.categoryName.toLowerCase().includes(selectedCategory.toLowerCase())
      ) {
        return false;
      }
      if (goalTypeFilter !== "all" && g.goalType !== goalTypeFilter) {
        return false;
      }
      return true;
    });
  }, [categorizedGoals, selectedCategory, goalTypeFilter]);

  // Monthly tasks: recurrence === 'monthly' or scheduled for the selected month
  const monthlyTasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        t.recurrence === "monthly" ||
        (t.due_date && t.due_date.startsWith(selectedMonthStr.slice(0, 7))) ||
        (t.scheduled_date && t.scheduled_date.startsWith(selectedMonthStr.slice(0, 7))),
    );
  }, [allTasks, selectedMonthStr]);

  const activeMonthlyTasks = useMemo(
    () => monthlyTasks.filter((t) => t.status !== "done"),
    [monthlyTasks],
  );
  const doneMonthlyTasks = useMemo(
    () => monthlyTasks.filter((t) => t.status === "done"),
    [monthlyTasks],
  );

  // Incomplete tasks from earlier months eligible for carry-forward
  const uncompletedPriorTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.status === "done" || t.is_archived) return false;
      const d = t.scheduled_date || t.due_date;
      return d && d < selectedMonthStr;
    });
  }, [allTasks, selectedMonthStr]);

  // Current values map for the selected month
  const monthValues = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of updates) {
      if (u.month === selectedMonthStr) {
        map.set(u.goal_id, Number(u.value));
      }
    }
    return map;
  }, [updates, selectedMonthStr]);

  const isCheckedToday = (goalId: string): boolean => {
    const u = updates.find((x) => x.goal_id === goalId && x.month === selectedMonthStr);
    if (!u) return false;
    if (u.note && u.note.includes(todayStr)) return true;
    if (u.updated_at) {
      const updatedDate = toISODate(new Date(u.updated_at));
      return updatedDate === todayStr && Number(u.value) > 0;
    }
    return false;
  };

  function handleToggleGoalChecklist(g: Goal) {
    const currentVal = monthValues.get(g.id) ?? 0;
    const checked = isCheckedToday(g.id);

    if (checked) {
      const newVal = Math.max(0, currentVal - 1);
      logGoal.mutate({
        goal_id: g.id,
        month: selectedMonthStr,
        value: newVal,
        note: newVal === 0 ? null : `Decreased on ${todayStr}`,
      });
      toast.info(`Unchecked progress for "${g.title}"`);
    } else {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      const newVal = currentVal + 1;
      logGoal.mutate({
        goal_id: g.id,
        month: selectedMonthStr,
        value: newVal,
        note: `Checked on ${todayStr}`,
      });
      toast.success(`Checked off progress for "${g.title}"! (+1 ${g.unit ?? "unit"}) 🎉`);
    }
  }

  function handleIncrementGoal(g: Goal, delta = 1) {
    const currentVal = monthValues.get(g.id) ?? 0;
    const newVal = currentVal + delta;
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
    });
    logGoal.mutate({
      goal_id: g.id,
      month: selectedMonthStr,
      value: newVal,
      note: `Checked on ${todayStr}`,
    });
    toast.success(`Logged +${delta} to "${g.title}"! (${newVal}/${g.target} ${g.unit ?? ""}) 🎉`);
  }

  function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const detected = detectCategory(goalTitle.trim());
    const formattedTitle = formatTitleWithEmoji(goalTitle.trim(), detected.emoji);
    saveGoal.mutate(
      {
        title: formattedTitle,
        target: Number(goalTarget) || 1,
        unit: goalUnit.trim() || null,
        color: goalColor || detected.color,
      },
      {
        onSuccess: () => {
          toast.success(`Monthly goal created with ${detected.emoji}!`);
          setOpenGoalDialog(false);
          setGoalTitle("");
          setGoalTarget("5");
          setGoalUnit("hours");
        },
      },
    );
  }

  function handleSaveCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal) return;
    logGoal.mutate(
      {
        goal_id: selectedGoal.id,
        month: selectedMonthStr,
        value: checkInVal,
        note: checkInNote.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Progress logged!");
          setOpenCheckInDialog(false);
        },
      },
    );
  }

  function handleDropToToday(e: React.DragEvent) {
    e.preventDefault();
    setDragOverTodayZone(false);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    updateTask.mutate({
      id: task.id,
      scheduled_date: todayStr,
    });
    toast.success(`Scheduled "${task.title}" for Today! ☀️`);
  }

  // Carry forward previous incomplete tasks to the active month
  function handleCarryForwardAll() {
    if (uncompletedPriorTasks.length === 0) return;
    for (const t of uncompletedPriorTasks) {
      updateTask.mutate({
        id: t.id,
        scheduled_date: selectedMonthStr,
      });
    }
    toast.success(
      `Carried forward ${uncompletedPriorTasks.length} backlog tasks to ${selectedMonthStr.slice(0, 7)}! 🗓️`,
    );
  }

  return (
    <div className="whiteboard min-h-screen px-4 py-8 md:px-8">
      {/* Back to Board / Main Dashboard Navigation Bar */}
      <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <Link
            to="/board"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-all shadow-xs cursor-pointer active:scale-95"
            title="Return to Main Board"
          >
            <ArrowLeft className="size-4" />
            <Pin className="size-3.5 rotate-12 text-primary" />
            <span>Back to Main Board</span>
          </Link>
        </div>

        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
          Monthly Goal View
        </span>
      </div>

      {/* Header & Month Navigator */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-note-mint shadow-note">
              <Target className="size-5 text-ink" />
            </span>
            <h1 className="text-3xl font-bold md:text-4xl">Monthly Plan & Goals</h1>
            <SyncIndicator />
          </div>

          {/* Month Selector Carousel Header */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={prevMonth}
              className="h-7 w-7"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <span className="font-semibold text-sm px-2">
              {selectedMonthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>

            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              className="h-7 w-7"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </Button>

            {!isViewingCurrentMonth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={jumpToCurrentMonth}
                className="h-7 text-xs text-primary underline"
              >
                Jump to Current Month
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setOpenTaskDialog(true)}>
            <Plus className="size-4" /> Add Monthly Task
          </Button>
          <Button onClick={() => setOpenGoalDialog(true)}>
            <Plus className="size-4" /> Create Goal
          </Button>
        </div>
      </header>

      {/* Rollover & Carry Forward Notification Banner */}
      {uncompletedPriorTasks.length > 0 && isViewingCurrentMonth && (
        <div className="mb-6 rounded-2xl border border-indigo-300/80 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-300">
              <History className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {uncompletedPriorTasks.length} Incomplete{" "}
                {uncompletedPriorTasks.length === 1 ? "Task" : "Tasks"} from Previous Months
              </p>
              <p className="text-xs text-muted-foreground">
                Would you like to carry these tasks forward into this month's plan?
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleCarryForwardAll}
            className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <RotateCcw className="size-3.5" /> Carry Forward All
          </Button>
        </div>
      )}

      {/* Drag & Drop to Today Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverTodayZone(true);
        }}
        onDragLeave={() => setDragOverTodayZone(false)}
        onDrop={handleDropToToday}
        className={cn(
          "mb-8 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 text-center transition-all",
          dragOverTodayZone
            ? "scale-[1.01] border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 shadow-md"
            : "border-border/80 bg-card/60 hover:border-amber-500/50 hover:bg-amber-500/5",
        )}
      >
        <Sun className="size-5 text-amber-500" />
        <div className="text-sm">
          <span className="font-semibold">Drop monthly task here to Schedule for Today</span>
          <span className="hidden text-xs text-muted-foreground sm:inline ml-2">
            (Pulls it immediately into Today's Ramp)
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Monthly Goals Trackers */}
        <section className="lg:col-span-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="size-5 text-muted-foreground" />
              Monthly Goal Progress ({filteredGoals.length})
            </h2>

            {/* Numeric vs Habit Toggle */}
            <div className="flex rounded-lg border border-border/80 p-0.5 text-xs bg-card">
              <button
                type="button"
                onClick={() => setGoalTypeFilter("all")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  goalTypeFilter === "all"
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setGoalTypeFilter("numeric")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  goalTypeFilter === "numeric"
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                Numeric Goals
              </button>
              <button
                type="button"
                onClick={() => setGoalTypeFilter("habit")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  goalTypeFilter === "habit"
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                Habits / Daily
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All Categories ({goals.length})
            </button>
            {WORK_CATEGORIES.map((cat) => {
              const count = categorizedGoals.filter((g) =>
                g.categoryName.toLowerCase().includes(cat.name.toLowerCase()),
              ).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                    selectedCategory === cat.name
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name.split(" ")[0]}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {goalsLoading ? (
            <p className="text-sm text-muted-foreground">Loading goals...</p>
          ) : filteredGoals.length === 0 ? (
            <div className="note-fold flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center bg-card/40">
              <Target className="size-8 text-emerald-500 mb-2" />
              <p className="font-medium text-foreground">No monthly goals found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {selectedCategory === "all"
                  ? "Set milestones for health, learning, or work to measure your progress this month."
                  : `No goals found under "${selectedCategory}". Click Create Goal to start one.`}
              </p>
              <Button size="sm" className="mt-4" onClick={() => setOpenGoalDialog(true)}>
                <Plus className="size-3.5" /> Set First Goal
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredGoals.map((g) => {
                const currentVal = monthValues.get(g.id) ?? 0;
                const target = Number(g.target) || 1;
                const pct = Math.min(100, Math.round((currentVal / target) * 100));

                return (
                  <div
                    key={g.id}
                    className="note-fold group relative rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base">{g.displayTitle}</h3>
                          <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {g.categoryName}
                          </span>
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase">
                            {g.goalType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Target: {g.target} {g.unit ?? "units"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => {
                            setSelectedGoal(g);
                            setCheckInVal(currentVal);
                            setCheckInNote("");
                            setOpenCheckInDialog(true);
                          }}
                        >
                          <Plus className="size-3" /> Log check-in
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete goal "${g.title}"?`)) deleteGoal.mutate(g.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <GoalProgress
                        current={currentVal}
                        target={target}
                        unit={g.unit}
                        color={g.color}
                        size="md"
                      />

                      {/* Option to checklist today's progress in monthly goal */}
                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleGoalChecklist(g)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer border text-xs shadow-2xs active:scale-95",
                            isCheckedToday(g.id)
                              ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-emerald-500/60",
                          )}
                          title={isCheckedToday(g.id) ? "Today's session completed! Click to undo" : "Click to mark today's session completed"}
                        >
                          <div
                            className={cn(
                              "grid size-4 place-items-center rounded border transition-colors",
                              isCheckedToday(g.id)
                                ? "border-white bg-white text-emerald-700"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {isCheckedToday(g.id) ? <Check className="size-3 stroke-[3]" /> : null}
                          </div>
                          <span>{isCheckedToday(g.id) ? "Today's Session Completed" : "Complete Today's Session"}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleIncrementGoal(g, 1)}
                            className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                            title="Add +1 unit"
                          >
                            <Plus className="size-3" /> 1
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Monthly Work & Sticky Notes */}
        <section className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="size-5 text-muted-foreground" />
              Monthly Tasks & Backlog ({activeMonthlyTasks.length})
            </h2>
            <span className="text-xs text-muted-foreground">Drag to Today or complete</span>
          </div>

          {activeMonthlyTasks.length === 0 ? (
            <div className="note-fold flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-card/40">
              <Sparkles className="size-7 text-indigo-500 mb-2" />
              <p className="font-medium text-foreground">No monthly sticky notes yet!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Move tasks from Today's Ramp here or create long-range tasks scheduled for this
                month.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setOpenTaskDialog(true)}
              >
                <Plus className="size-3.5" /> Add Monthly Task
              </Button>
            </div>
          ) : (
            <StickyNotesCarousel
              emptyMessage="No monthly sticky notes yet!"
              basis="basis-full sm:basis-1/2"
            >
              {activeMonthlyTasks.map((t, idx) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <StickyNote
                    task={t}
                    index={idx}
                    onComplete={(task) => completeTask.mutate({ task })}
                    onReopen={(task) => completeTask.mutate({ task, reopen: true })}
                  />
                </div>
              ))}
            </StickyNotesCarousel>
          )}

          {doneMonthlyTasks.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> Done this month (
                {doneMonthlyTasks.length})
              </h3>
              <StickyNotesCarousel
                emptyMessage="No completed notes yet"
                basis="basis-full sm:basis-1/2"
              >
                {doneMonthlyTasks.map((t, idx) => (
                  <StickyNote
                    key={t.id}
                    task={t}
                    index={idx}
                    onReopen={(task) => completeTask.mutate({ task, reopen: true })}
                  />
                ))}
              </StickyNotesCarousel>
            </div>
          )}
        </section>
      </div>

      {/* Create Goal Dialog */}
      <Dialog open={openGoalDialog} onOpenChange={setOpenGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Monthly Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateGoal} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">Goal Title</Label>
              <Input
                id="goal-title"
                placeholder="e.g. Read 4 books, 20 gym sessions, Ship v1"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target Number</Label>
                <Input
                  id="goal-target"
                  type="number"
                  min="1"
                  step="0.5"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-unit">Unit (optional)</Label>
                <Input
                  id="goal-unit"
                  placeholder="books, hours, days, sessions"
                  value={goalUnit}
                  onChange={(e) => setGoalUnit(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpenGoalDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-in Dialog */}
      <Dialog open={openCheckInDialog} onOpenChange={setOpenCheckInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Check-in: {selectedGoal?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCheckIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-val">
                Current Total Progress ({selectedGoal?.unit ?? "units"})
              </Label>
              <Input
                id="checkin-val"
                type="number"
                step="0.5"
                value={checkInVal}
                onChange={(e) => setCheckInVal(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Target is {selectedGoal?.target} {selectedGoal?.unit ?? ""}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-note">Note / Reflection (optional)</Label>
              <Input
                id="checkin-note"
                placeholder="e.g. Read chapter 3 and 4 today"
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpenCheckInDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Progress</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Creation Dialog with default monthly recurrence */}
      <TaskDialog
        open={openTaskDialog}
        onOpenChange={setOpenTaskDialog}
        defaults={{ recurrence: "monthly", due_date: selectedMonthStr }}
      />
    </div>
  );
}
