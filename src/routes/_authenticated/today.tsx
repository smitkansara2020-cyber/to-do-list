import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  CalendarClock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Plus,
  Clock,
  Sparkles,
  ArrowRight,
  Sun,
  ListTodo,
  Check,
  CheckSquare,
  Target,
  GraduationCap,
  BarChart2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyNote } from "@/components/StickyNote";
import { StickyNotesCarousel } from "@/components/StickyNotesCarousel";
import { TaskDialog } from "@/components/TaskDialog";
import { FocusTimerModal } from "@/components/FocusTimerModal";
import { SyncIndicator } from "@/components/SyncIndicator";
import { WorkloadMeter } from "@/components/WorkloadMeter";
import { ReplanModal } from "@/components/ReplanModal";
import { QuickCaptureModal } from "@/components/QuickCaptureModal";
import { TemplatePickerModal } from "@/components/TemplatePickerModal";
import { ExamPlannerModal } from "@/components/ExamPlannerModal";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import {
  useCompleteTask,
  useTasks,
  useUpdateTask,
  useSaveTask,
  useSettings,
  useGoals,
  useLogGoal,
} from "@/hooks/use-data";
import {
  toISODate,
  monthStart,
  taskBlocks,
  findConflicts,
  fmtTime,
  toMinutes,
  type Task,
  type Goal,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today's Planner · Pinboard" }] }),
  component: TodayPlanner,
});

export function TodayPlanner() {
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const currentMonthStr = useMemo(() => monthStart(new Date()), []);
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: settings } = useSettings();
  const { data: goalsData } = useGoals();
  const goals = goalsData?.goals ?? [];
  const updates = goalsData?.updates ?? [];
  const complete = useCompleteTask();
  const update = useUpdateTask();
  const save = useSaveTask();
  const logGoal = useLogGoal();

  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"completed" | "monthly" | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  // Advanced Planner Modals State
  const [openQuickCapture, setOpenQuickCapture] = useState(false);
  const [openReplan, setOpenReplan] = useState(false);
  const [openTemplates, setOpenTemplates] = useState(false);
  const [openExamPlanner, setOpenExamPlanner] = useState(false);
  const [openWeeklyReview, setOpenWeeklyReview] = useState(false);

  const currentMonthValues = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of updates) {
      if (u.month === currentMonthStr) {
        map.set(u.goal_id, Number(u.value));
      }
    }
    return map;
  }, [updates, currentMonthStr]);

  const isCheckedToday = (goalId: string): boolean => {
    const u = updates.find((x) => x.goal_id === goalId && x.month === currentMonthStr);
    if (!u) return false;
    if (u.note && u.note.includes(todayStr)) return true;
    if (u.updated_at) {
      const updatedDate = toISODate(new Date(u.updated_at));
      return updatedDate === todayStr && Number(u.value) > 0;
    }
    return false;
  };

  function handleToggleGoalChecklist(g: Goal) {
    const currentVal = currentMonthValues.get(g.id) ?? 0;
    const checked = isCheckedToday(g.id);

    if (checked) {
      const newVal = Math.max(0, currentVal - 1);
      logGoal.mutate({
        goal_id: g.id,
        month: currentMonthStr,
        value: newVal,
        note: newVal === 0 ? null : `Decreased on ${todayStr}`,
      });
      toast.info(`Unchecked today's progress for "${g.title}"`);
    } else {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      const newVal = currentVal + 1;
      logGoal.mutate({
        goal_id: g.id,
        month: currentMonthStr,
        value: newVal,
        note: `Checked on ${todayStr}`,
      });
      toast.success(`Checked off today's progress for "${g.title}"! (+1 ${g.unit ?? "unit"}) 🎉`);
    }
  }

  function handleIncrementGoal(g: Goal, delta = 1) {
    const currentVal = currentMonthValues.get(g.id) ?? 0;
    const newVal = currentVal + delta;
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
    });
    logGoal.mutate({
      goal_id: g.id,
      month: currentMonthStr,
      value: newVal,
      note: `Checked on ${todayStr}`,
    });
    toast.success(`Logged +${delta} to "${g.title}"! (${newVal}/${g.target} ${g.unit ?? ""}) 🎉`);
  }

  // Today's daily tasks: only tasks explicitly scheduled for today (or due today)
  // Daily goals reset each day - past days' tasks do not pollute today's active view automatically
  const todayTasks = useMemo(() => {
    return allTasks.filter(
      (t) => t.scheduled_date === todayStr || (!t.scheduled_date && t.due_date === todayStr),
    );
  }, [allTasks, todayStr]);

  // Pending / Overdue past daily goals (excluding monthly recurrence tasks)
  // If user skipped monthly goals, they will be tracked under the Monthly Goals section
  const pendingOverdueTasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        t.status !== "done" &&
        t.recurrence !== "monthly" &&
        ((t.scheduled_date && t.scheduled_date < todayStr) ||
          (!t.scheduled_date && t.due_date && t.due_date < todayStr)),
    );
  }, [allTasks, todayStr]);

  const activeTodayTasks = useMemo(
    () => todayTasks.filter((t) => t.status !== "done"),
    [todayTasks],
  );
  const completedTodayTasks = useMemo(
    () => todayTasks.filter((t) => t.status === "done"),
    [todayTasks],
  );

  // Time blocks & conflict calculation
  const blocks = useMemo(() => taskBlocks(activeTodayTasks), [activeTodayTasks]);
  const conflicts = useMemo(() => findConflicts(blocks), [blocks]);

  // Hours range from settings (defaults 9 to 18)
  const startHour = settings?.day_start ? parseInt(settings.day_start.slice(0, 2), 10) : 9;
  const endHour = settings?.day_end ? parseInt(settings.day_end.slice(0, 2), 10) : 18;
  const hoursList = useMemo(() => {
    const list: number[] = [];
    for (let h = Math.max(6, startHour - 1); h <= Math.min(23, endHour + 1); h++) {
      list.push(h);
    }
    return list;
  }, [startHour, endHour]);

  function handleDropCompleted(e: React.DragEvent) {
    e.preventDefault();
    setDragOverZone(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === "done") return;

    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
    });
    complete.mutate({ task });
  }

  function handleDropMonthly(e: React.DragEvent) {
    e.preventDefault();
    setDragOverZone(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Shift task from today's work to monthly work
    update.mutate({
      id: task.id,
      scheduled_date: null,
      recurrence: task.recurrence === "none" ? "monthly" : task.recurrence,
    });
    toast.success(`Moved "${task.title}" to Monthly Plan! 🗓️`);
  }

  function handleDropHour(h: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    const timeStr = `${String(h).padStart(2, "0")}:00:00`;
    update.mutate({
      id: task.id,
      scheduled_date: todayStr,
      start_time: timeStr,
    });
    toast.success(`Scheduled "${task.title}" at ${h}:00`);
  }

  return (
    <div className="whiteboard min-h-screen px-4 py-8 md:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-note-yellow shadow-note">
              <Sun className="size-5 text-ink" />
            </span>
            <h1 className="text-3xl font-bold md:text-4xl">Today's Ramp</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            <span className="font-medium text-foreground">
              {completedTodayTasks.length}/{todayTasks.length} completed
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenQuickCapture(true)}
            title="Quick Capture with Natural Language (Inbox)"
            className="gap-1.5"
          >
            <Zap className="size-4 text-amber-500" />
            <span className="hidden sm:inline">Quick Capture</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenReplan(true)}
            title="Replan My Day with smart collision handling"
            className="gap-1.5"
          >
            <CalendarClock className="size-4 text-indigo-500" />
            <span className="hidden sm:inline">Replan Day</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenTemplates(true)}
            title="Choose from workflow templates"
            className="gap-1.5"
          >
            <ListTodo className="size-4 text-emerald-500" />
            <span className="hidden sm:inline">Templates</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenExamPlanner(true)}
            title="Student Exam Planner"
            className="gap-1.5"
          >
            <GraduationCap className="size-4 text-violet-500" />
            <span className="hidden sm:inline">Exam Prep</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenWeeklyReview(true)}
            title="Weekly Review & Reflection"
            className="gap-1.5"
          >
            <BarChart2 className="size-4 text-sky-500" />
            <span className="hidden sm:inline">Review</span>
          </Button>

          <Button
            onClick={() => {
              setEditingTask(null);
              setOpenDialog(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Add note
          </Button>
        </div>
      </header>

      {/* Workload Capacity Meter */}
      <div className="mb-6">
        <WorkloadMeter
          tasks={todayTasks}
          dayStart={settings?.day_start}
          dayEnd={settings?.day_end}
          onOpenReplan={() => setOpenReplan(true)}
        />
      </div>

      {/* Conflicts Banner */}
      {conflicts.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Scheduling Overlap Detected</p>
            <p className="text-xs opacity-90">
              {conflicts.map(([a, b], idx) => (
                <span key={idx} className="block mt-0.5">
                  • <strong>{a.title}</strong> overlaps with <strong>{b.title}</strong> (
                  {fmtTime(a.start)} - {fmtTime(a.end)})
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* Overdue / Pending Carried-Over Daily Goals (High Priority) */}
      {pendingOverdueTasks.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <span>Pending From Previous Days ({pendingOverdueTasks.length} High Priority)</span>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Daily goals reset each morning. Roll these over or postpone to monthly plan.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingOverdueTasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-card p-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm text-foreground line-clamp-1">
                      {t.title}
                    </span>
                    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      High Priority
                    </span>
                  </div>
                  {t.scheduled_date && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Was scheduled: {t.scheduled_date}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-indigo-600"
                    onClick={() => {
                      update.mutate({
                        id: t.id,
                        scheduled_date: null,
                        recurrence: t.recurrence === "none" ? "monthly" : t.recurrence,
                      });
                      toast.success(`Moved "${t.title}" to Monthly Plan 🗓️`);
                    }}
                  >
                    To Monthly
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      update.mutate({
                        id: t.id,
                        scheduled_date: todayStr,
                        priority: "high",
                      });
                      toast.success(`Rolled "${t.title}" over to Today with High Priority! ⭐`);
                    }}
                  >
                    ⭐ Prioritize Today
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Drag & Drop Action Target Zones */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Drop zone: Mark Completed */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("completed");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={handleDropCompleted}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all",
            dragOverZone === "completed"
              ? "scale-[1.02] border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-md"
              : "border-border/80 bg-card/60 hover:border-emerald-500/50 hover:bg-emerald-500/5",
          )}
        >
          <div className="grid size-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="font-semibold text-sm">Drop here to Mark Completed</p>
            <p className="text-xs text-muted-foreground">
              Or click the tick sign on the sticky note
            </p>
          </div>
        </div>

        {/* Drop zone: Move to Monthly Work */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("monthly");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={handleDropMonthly}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all",
            dragOverZone === "monthly"
              ? "scale-[1.02] border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shadow-md"
              : "border-border/80 bg-card/60 hover:border-indigo-500/50 hover:bg-indigo-500/5",
          )}
        >
          <div className="grid size-11 place-items-center rounded-full bg-indigo-500/10 text-indigo-600">
            <Calendar className="size-6" />
          </div>
          <div>
            <p className="font-semibold text-sm">Drop here to Move to Monthly Plan</p>
            <p className="text-xs text-muted-foreground">
              Postpone or reschedule as part of this month's goals
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Sticky Notes & Daily Timeline */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Today's Active Sticky Notes */}
        <section className="lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ListTodo className="size-5 text-muted-foreground" />
              Today's Sticky Notes ({activeTodayTasks.length})
            </h2>
            <span className="text-xs text-muted-foreground">Drag onto drop zones or schedule</span>
          </div>

          {/* Monthly Goals Checklist for Today */}
          {goals.length > 0 && (
            <div className="mb-6 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-bold text-indigo-950 dark:text-indigo-200">
                  <CheckSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Monthly Goals · Today's Progress Checklist</span>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {goals.filter((g) => isCheckedToday(g.id)).length}/{goals.length} checked today
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {goals.map((g) => {
                  const checkedToday = isCheckedToday(g.id);
                  const currentVal = currentMonthValues.get(g.id) ?? 0;
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-center justify-between rounded-xl bg-card/95 px-3 py-2 text-xs shadow-2xs border transition-colors",
                        checkedToday
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
                          : "border-border/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleGoalChecklist(g)}
                        className="flex items-center gap-2 text-left font-medium hover:text-primary transition-colors cursor-pointer"
                      >
                        <div
                          className={cn(
                            "grid size-4 place-items-center rounded border transition-colors",
                            checkedToday
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-2xs"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {checkedToday ? <Check className="size-3 stroke-[3]" /> : null}
                        </div>
                        <span
                          className={cn(
                            "truncate max-w-[130px] sm:max-w-[180px]",
                            checkedToday && "line-through opacity-70",
                          )}
                        >
                          {g.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>
                          {currentVal}/{g.target} {g.unit ?? ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementGoal(g, 1)}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                          title="Add +1 unit"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTodayTasks.length === 0 ? (
            <div className="note-fold flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center bg-card/40">
              <Sparkles className="size-8 text-amber-500 mb-2" />
              <p className="font-medium text-foreground">No notes set for today yet!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Add a new note with the button above or talk with your AI Coach to ramp up your
                schedule.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setEditingTask(null);
                  setOpenDialog(true);
                }}
              >
                <Plus className="size-3.5" /> Create Today's First Note
              </Button>
            </div>
          ) : (
            <StickyNotesCarousel
              emptyMessage="No notes set for today yet!"
              basis="basis-full sm:basis-1/2"
            >
              {activeTodayTasks.map((t, idx) => (
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
                    onComplete={(task) => complete.mutate({ task })}
                    onReopen={(task) => complete.mutate({ task, reopen: true })}
                    onEdit={(task) => {
                      setEditingTask(task);
                      setOpenDialog(true);
                    }}
                    onStartTimer={(task) =>
                      window.dispatchEvent(
                        new CustomEvent("open-focus-mode", { detail: { taskId: task.id } }),
                      )
                    }
                    onToggleSubtask={(task, stId) => {
                      const updated = (task.subtasks ?? []).map((s) =>
                        s.id === stId ? { ...s, done: !s.done } : s,
                      );
                      update.mutate({ id: task.id, meta: { subtasks: updated } });
                    }}
                  />
                </div>
              ))}
            </StickyNotesCarousel>
          )}

          {/* Completed Notes Accordion / List */}
          {completedTodayTasks.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> Completed Today (
                {completedTodayTasks.length})
              </h3>
              <StickyNotesCarousel
                emptyMessage="No completed notes yet"
                basis="basis-full sm:basis-1/2"
              >
                {completedTodayTasks.map((t, idx) => (
                  <StickyNote
                    key={t.id}
                    task={t}
                    index={idx}
                    onReopen={(task) => complete.mutate({ task, reopen: true })}
                    onEdit={(task) => {
                      setEditingTask(task);
                      setOpenDialog(true);
                    }}
                  />
                ))}
              </StickyNotesCarousel>
            </div>
          )}
        </section>

        {/* Right Column: Time-blocking schedule */}
        <section className="lg:col-span-5">
          <div className="sticky top-6 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="size-5 text-muted-foreground" />
                Time Blocks
              </h2>
              <span className="text-xs text-muted-foreground">Drop notes to schedule time</span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {hoursList.map((h) => {
                const hourFormatted = `${String(h).padStart(2, "0")}:00`;
                const tasksInThisHour = activeTodayTasks.filter((t) => {
                  if (!t.start_time) return false;
                  const [th = 0] = t.start_time.split(":").map(Number);
                  return th === h;
                });

                const isOver = dragOverHour === h;

                return (
                  <div
                    key={h}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverHour(h);
                    }}
                    onDragLeave={() => setDragOverHour(null)}
                    onDrop={(e) => handleDropHour(h, e)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border border-dashed p-2.5 transition-colors",
                      isOver
                        ? "border-primary bg-primary/10"
                        : tasksInThisHour.length > 0
                          ? "border-border/80 bg-accent/30"
                          : "border-border/40 hover:border-border",
                    )}
                  >
                    <span className="w-12 text-xs font-mono font-medium text-muted-foreground pt-1">
                      {hourFormatted}
                    </span>

                    <div className="flex-1 min-w-0">
                      {tasksInThisHour.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 py-1">Available block</p>
                      ) : (
                        <div className="space-y-1.5">
                          {tasksInThisHour.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setEditingTask(t);
                                setOpenDialog(true);
                              }}
                              className="group flex items-center justify-between gap-2 rounded bg-background px-2 py-1 text-xs font-medium shadow-sm cursor-pointer hover:bg-muted"
                            >
                              <span className="truncate">{t.title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {t.duration_minutes || 30}m
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Task Creation / Edit Dialog */}
      <TaskDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        task={editingTask}
        defaults={{ scheduled_date: todayStr }}
      />

      <FocusTimerModal
        open={Boolean(focusTask)}
        onOpenChange={(open) => !open && setFocusTask(null)}
        task={focusTask}
      />

      {/* Quick Capture Inbox Modal */}
      <QuickCaptureModal
        open={openQuickCapture}
        onOpenChange={setOpenQuickCapture}
      />

      {/* Replan My Day Modal */}
      <ReplanModal
        open={openReplan}
        onOpenChange={setOpenReplan}
        tasks={todayTasks}
        dayStart={settings?.day_start}
        dayEnd={settings?.day_end}
      />

      {/* Reusable Workflow Template Picker Modal */}
      <TemplatePickerModal
        open={openTemplates}
        onOpenChange={setOpenTemplates}
      />

      {/* Student Exam Planner Modal */}
      <ExamPlannerModal
        open={openExamPlanner}
        onOpenChange={setOpenExamPlanner}
      />

      {/* Weekly Review & Daily Reflection Modal */}
      <WeeklyReviewModal
        open={openWeeklyReview}
        onOpenChange={setOpenWeeklyReview}
      />
    </div>
  );
}
