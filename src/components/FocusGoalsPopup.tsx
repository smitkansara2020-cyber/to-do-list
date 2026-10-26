import { useState, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  Sun,
  AlertTriangle,
  Trophy,
  Check,
  Calendar,
  Play,
  Plus,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import {
  useTasks,
  useUpdateTask,
  useCompleteTask,
  useGoals,
  useLogGoal,
} from "@/hooks/use-data";
import {
  type Task,
  type Goal,
  noteBg,
  toISODate,
  monthStart,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface FocusGoalsPopupProps {
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  activeTaskId?: string | null | undefined;
  onFinishTodaySession: () => void;
  sessionFinished: boolean;
}

export function FocusGoalsPopup({
  onClose,
  onSelectTask,
  activeTaskId,
  onFinishTodaySession,
  sessionFinished,
}: FocusGoalsPopupProps) {
  const { data: allTasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const { data: goalsData } = useGoals();
  const monthlyGoals = goalsData?.goals ?? [];
  const goalUpdates = goalsData?.updates ?? [];
  const logGoal = useLogGoal();

  const todayStr = useMemo(() => toISODate(new Date()), []);
  const currentMonthStr = useMemo(() => monthStart(new Date()), []);

  const todayFormattedDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  const goalValuesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of goalUpdates) {
      if (u.month === currentMonthStr) {
        map.set(u.goal_id, Number(u.value) || 0);
      }
    }
    return map;
  }, [goalUpdates, currentMonthStr]);

  // Today's goals (scheduled today, due today, in-progress, or active task)
  const todaysGoals = useMemo(() => {
    return allTasks.filter(
      (t) =>
        t.status !== "done" &&
        !t.is_archived &&
        !t.deleted_at &&
        (t.scheduled_date === todayStr ||
          (!t.scheduled_date && t.due_date === todayStr) ||
          t.status === "in_progress" ||
          t.id === activeTaskId),
    );
  }, [allTasks, todayStr, activeTaskId]);

  // Overdue / Due Pending tasks
  const duePendingTasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        t.status !== "done" &&
        !t.is_archived &&
        !t.deleted_at &&
        t.recurrence !== "monthly" &&
        ((t.scheduled_date && t.scheduled_date < todayStr) ||
          (!t.scheduled_date && t.due_date && t.due_date < todayStr)),
    );
  }, [allTasks, todayStr]);

  const hasDuePending = duePendingTasks.length > 0;

  // Scroll refs and active item trackers for column 1 and column 2
  const todaysScrollRef = useRef<HTMLDivElement>(null);
  const dueScrollRef = useRef<HTMLDivElement>(null);

  const [todaysScrollPos, setTodaysScrollPos] = useState(0);
  const [dueScrollPos, setDueScrollPos] = useState(0);

  const CARD_ITEM_HEIGHT = 208; // 200px card + gap/margin

  function handleTodaysScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop;
    const idx = Math.round(top / CARD_ITEM_HEIGHT);
    setTodaysScrollPos(idx);
  }

  function handleDueScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop;
    const idx = Math.round(top / CARD_ITEM_HEIGHT);
    setDueScrollPos(idx);
  }

  function scrollTodays(direction: "up" | "down") {
    if (todaysScrollRef.current) {
      const next = direction === "down" ? todaysScrollPos + 1 : todaysScrollPos - 1;
      const step = hasDuePending ? 1 : 2; // In 2-column grid, jump by row
      const maxIdx = Math.ceil(todaysGoals.length / (hasDuePending ? 1 : 2)) - 1;
      const clamped = Math.max(0, Math.min(maxIdx, next));
      todaysScrollRef.current.scrollTo({
        top: clamped * CARD_ITEM_HEIGHT,
        behavior: "smooth",
      });
      setTodaysScrollPos(clamped);
    }
  }

  function scrollDue(direction: "up" | "down") {
    if (dueScrollRef.current) {
      const next = direction === "down" ? dueScrollPos + 1 : dueScrollPos - 1;
      const clamped = Math.max(0, Math.min(duePendingTasks.length - 1, next));
      dueScrollRef.current.scrollTo({
        top: clamped * CARD_ITEM_HEIGHT,
        behavior: "smooth",
      });
      setDueScrollPos(clamped);
    }
  }

  function handleRollTaskToToday(task: Task) {
    updateTask.mutate({
      id: task.id,
      scheduled_date: todayStr,
    });
    toast.success(`Rolled "${task.title}" to Today! ☀️`);
  }

  function handleToggleTaskSubtask(task: Task, subtaskId: string) {
    const currentSubtasks = task.subtasks ?? [];
    const updated = currentSubtasks.map((st) =>
      st.id === subtaskId ? { ...st, done: !st.done } : st,
    );
    updateTask.mutate({
      id: task.id,
      meta: { subtasks: updated },
    });
  }

  function handleCompleteWithCelebration(task: Task) {
    confetti({ particleCount: 50, spread: 65, origin: { y: 0.65 } });
    completeTask.mutate({ task });
  }

  function handleIncrementGoal(g: Goal, delta = 1) {
    const currentVal = goalValuesMap.get(g.id) ?? 0;
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

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "rounded-3xl border border-[#333] bg-[#161616]/98 backdrop-blur-2xl text-[#f4f2ee] shadow-2xl overflow-hidden transition-all duration-200 select-none",
        hasDuePending
          ? "w-[94vw] sm:w-[860px] max-w-[95vw]"
          : "w-[92vw] sm:w-[680px] max-w-[95vw]",
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#282828] bg-[#121212] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-amber-500/20 text-amber-400 font-bold">
            <Target className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-tight">
              Today & Due Goals
            </h3>
            <p className="text-[10px] text-zinc-400">
              {todayFormattedDate} · Focus Agenda
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Finish Today's Session Button */}
          <button
            onClick={onFinishTodaySession}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm",
              sessionFinished
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-zinc-950",
            )}
            title="Finish today's session with celebration"
          >
            <Zap className="size-3.5 fill-current" />
            <span>{sessionFinished ? "Session Finished ✨" : "Finish Today's Session"}</span>
          </button>

          {/* Close Window Button */}
          <button
            onClick={onClose}
            className="size-7 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Close popup"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {hasDuePending ? (
        /* CONDITION A: Due pending tasks exist -> split into 2 columns (Today's Goal & Due Pending) + Monthly Goals column */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 max-h-[75vh] overflow-y-auto">
          {/* Column 1: Today's Goal - exactly 1 sticky note in view, scroll down for more */}
          <div className="flex flex-col min-w-0 bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-1.5">
                <Sun className="size-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Today's Goal
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {todaysGoals.length}
              </span>
            </div>

            {/* Exactly 1 sticky note visible at a time (height 208px, cards snap-start) */}
            <div
              ref={todaysScrollRef}
              onScroll={handleTodaysScroll}
              className="h-[208px] overflow-y-auto pr-1 scroll-smooth snap-y snap-mandatory focus:outline-none scrollbar-thin"
            >
              {todaysGoals.length === 0 ? (
                <div className="h-full flex items-center justify-center p-4 text-center text-xs text-zinc-500 italic">
                  No goals scheduled for today.
                </div>
              ) : (
                todaysGoals.map((task) => (
                  <div key={task.id} className="snap-start mb-2 last:mb-0">
                    <PopupStickyNoteCard
                      task={task}
                      isActive={task.id === activeTaskId}
                      onSelect={() => onSelectTask(task.id)}
                      onComplete={() => handleCompleteWithCelebration(task)}
                      onToggleSubtask={handleToggleTaskSubtask}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Scroll down option & controls for Today's Goal */}
            {todaysGoals.length > 1 && (
              <div className="pt-2 mt-auto border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                <span>
                  Note {Math.min(todaysGoals.length, todaysScrollPos + 1)} of {todaysGoals.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollTodays("up")}
                    disabled={todaysScrollPos <= 0}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    title="Previous note"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => scrollTodays("down")}
                    disabled={todaysScrollPos >= todaysGoals.length - 1}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-30 cursor-pointer"
                    title="Scroll down to next note"
                  >
                    <span>Next</span>
                    <ChevronDown className="size-3.5 animate-bounce" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Due Pending - exactly 1 sticky note in view, scroll down for more */}
          <div className="flex flex-col min-w-0 bg-[#1c1c1c] rounded-2xl p-3 border border-rose-500/25">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Due Pending
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                {duePendingTasks.length}
              </span>
            </div>

            {/* Exactly 1 sticky note visible at a time (height 208px, cards snap-start) */}
            <div
              ref={dueScrollRef}
              onScroll={handleDueScroll}
              className="h-[208px] overflow-y-auto pr-1 scroll-smooth snap-y snap-mandatory focus:outline-none scrollbar-thin"
            >
              {duePendingTasks.map((task) => (
                <div key={task.id} className="snap-start mb-2 last:mb-0">
                  <PopupStickyNoteCard
                    task={task}
                    isOverdue
                    isActive={task.id === activeTaskId}
                    onSelect={() => onSelectTask(task.id)}
                    onComplete={() => handleCompleteWithCelebration(task)}
                    onRollToday={() => handleRollTaskToToday(task)}
                    onToggleSubtask={handleToggleTaskSubtask}
                  />
                </div>
              ))}
            </div>

            {/* Scroll down option & controls for Due Pending */}
            {duePendingTasks.length > 1 && (
              <div className="pt-2 mt-auto border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-rose-400 font-medium">
                <span>
                  Note {Math.min(duePendingTasks.length, dueScrollPos + 1)} of {duePendingTasks.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollDue("up")}
                    disabled={dueScrollPos <= 0}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    title="Previous note"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => scrollDue("down")}
                    disabled={dueScrollPos >= duePendingTasks.length - 1}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-30 cursor-pointer"
                    title="Scroll down to next note"
                  >
                    <span>Next</span>
                    <ChevronDown className="size-3.5 animate-bounce" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Monthly Goals */}
          <div className="flex flex-col min-w-0 bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Monthly Goals
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {monthlyGoals.length}
              </span>
            </div>

            <div className="flex-1 h-[208px] overflow-y-auto space-y-2.5 pr-1 scroll-smooth focus:outline-none scrollbar-thin">
              {monthlyGoals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-zinc-500 italic">
                  <p>No monthly goals active.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Set targets from the Goals page</p>
                </div>
              ) : (
                monthlyGoals.map((goal) => (
                  <MonthlyGoalCard
                    key={goal.id}
                    goal={goal}
                    currentValue={goalValuesMap.get(goal.id) ?? 0}
                    onLog={handleIncrementGoal}
                  />
                ))
              )}
            </div>

            {monthlyGoals.length > 2 && (
              <div className="pt-2 mt-auto border-t border-[#2a2a2a] text-center text-[10px] text-zinc-400 font-medium flex items-center justify-center gap-1">
                <span>Scroll down for more goals</span>
                <ChevronDown className="size-3 text-amber-500" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CONDITION B: No due pending tasks -> compact popup, Today's Goal shows 2 sticky notes side by side! */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 max-h-[75vh] overflow-y-auto">
          {/* Today's Goals (8 cols on desktop): Shows 2 sticky notes side by side! */}
          <div className="md:col-span-8 flex flex-col min-w-0 bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-1.5">
                <Sun className="size-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Today's Goal
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {todaysGoals.length}
              </span>
            </div>

            {/* Viewport sized to display 1 row of 2 sticky notes side by side (height 208px), scroll down to see more */}
            <div
              ref={todaysScrollRef}
              onScroll={handleTodaysScroll}
              className="h-[208px] overflow-y-auto pr-1 scroll-smooth snap-y snap-mandatory focus:outline-none scrollbar-thin"
            >
              {todaysGoals.length === 0 ? (
                <div className="h-full flex items-center justify-center p-4 text-center text-xs text-zinc-500 italic">
                  No goals scheduled for today.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {todaysGoals.map((task) => (
                    <div key={task.id} className="snap-start">
                      <PopupStickyNoteCard
                        task={task}
                        isActive={task.id === activeTaskId}
                        onSelect={() => onSelectTask(task.id)}
                        onComplete={() => handleCompleteWithCelebration(task)}
                        onToggleSubtask={handleToggleTaskSubtask}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scroll down option & controls for Today's Goal (Side by Side view) */}
            {todaysGoals.length > 2 && (
              <div className="pt-2 mt-auto border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                <span>
                  Showing 2 of {todaysGoals.length} notes · Scroll down to see more
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollTodays("up")}
                    className="p-1 rounded hover:bg-white/10 cursor-pointer"
                    title="Previous row"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => scrollTodays("down")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 cursor-pointer"
                    title="Scroll down to see next notes"
                  >
                    <span>Scroll Down</span>
                    <ChevronDown className="size-3.5 animate-bounce" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Monthly Goals (4 cols on desktop) */}
          <div className="md:col-span-4 flex flex-col min-w-0 bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Monthly Goals
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {monthlyGoals.length}
              </span>
            </div>

            <div className="flex-1 h-[208px] overflow-y-auto space-y-2.5 pr-1 scroll-smooth focus:outline-none scrollbar-thin">
              {monthlyGoals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-zinc-500 italic">
                  <p>No monthly goals active.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Set targets from the Goals page</p>
                </div>
              ) : (
                monthlyGoals.map((goal) => (
                  <MonthlyGoalCard
                    key={goal.id}
                    goal={goal}
                    currentValue={goalValuesMap.get(goal.id) ?? 0}
                    onLog={handleIncrementGoal}
                  />
                ))
              )}
            </div>

            {monthlyGoals.length > 2 && (
              <div className="pt-2 mt-auto border-t border-[#2a2a2a] text-center text-[10px] text-zinc-400 font-medium flex items-center justify-center gap-1">
                <span>Scroll down for more goals</span>
                <ChevronDown className="size-3 text-amber-500" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PopupStickyNoteCard({
  task,
  isOverdue = false,
  isActive = false,
  onSelect,
  onComplete,
  onRollToday,
  onToggleSubtask,
}: {
  task: Task;
  isOverdue?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
  onComplete?: () => void;
  onRollToday?: () => void;
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
}) {
  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.done).length;

  return (
    <div
      className={cn(
        "relative rounded-xl p-3 text-[#F5F0E6] shadow-md border transition-all flex flex-col justify-between h-[200px] shrink-0",
        noteBg[task.color] || "bg-[#202020]",
        isActive && "ring-2 ring-amber-400 shadow-amber-500/20",
        isOverdue && "border-rose-500/50",
      )}
    >
      {/* Central Pin Head */}
      <span className="absolute left-1/2 top-1.5 size-2.5 -translate-x-1/2 rounded-full bg-pin shadow-xs" />

      <div>
        {/* Top meta tags */}
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-[#F5F0E6]/80 pt-1 pb-1">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded font-bold uppercase",
              task.priority === "urgent"
                ? "bg-rose-600/40 text-rose-200"
                : task.priority === "high"
                  ? "bg-amber-600/40 text-amber-200"
                  : "bg-black/20 text-[#F5F0E6]/80",
            )}
          >
            {task.priority || "normal"}
          </span>
          {isOverdue ? (
            <span className="text-rose-300 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/30">
              Overdue
            </span>
          ) : task.due_date ? (
            <span>Due {task.due_date.slice(5)}</span>
          ) : null}
        </div>

        {/* Title */}
        <p className="font-hand text-sm sm:text-base font-bold text-[#F5F0E6] leading-tight line-clamp-2 mt-0.5">
          {task.title}
        </p>

        {/* Notes snippet or subtasks checklist */}
        {subtasks.length > 0 ? (
          <div className="mt-1.5 space-y-1 rounded bg-black/25 p-1.5 text-[10px]">
            <div className="flex items-center justify-between font-bold text-[#F5F0E6]/90">
              <span>Steps</span>
              <span>
                {completedSubtasks}/{subtasks.length}
              </span>
            </div>
            {subtasks.slice(0, 1).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onToggleSubtask?.(task, st.id)}
                className="flex items-center gap-1.5 w-full text-left hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div
                  className={cn(
                    "grid size-3 place-items-center rounded border transition-colors",
                    st.done
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-[#F5F0E6]/40 bg-black/30",
                  )}
                >
                  {st.done && <Check className="size-2 stroke-[3]" />}
                </div>
                <span
                  className={cn(
                    "truncate font-medium",
                    st.done && "line-through text-[#F5F0E6]/50",
                  )}
                >
                  {st.title}
                </span>
              </button>
            ))}
            {subtasks.length > 1 && (
              <p className="text-[9px] text-[#F5F0E6]/60">+{subtasks.length - 1} more step(s)</p>
            )}
          </div>
        ) : task.notes ? (
          <p className="text-[11px] text-[#F5F0E6]/85 line-clamp-2 mt-1 font-sans">
            {task.notes}
          </p>
        ) : null}
      </div>

      {/* Action Footer */}
      <div className="mt-2 pt-2 border-t border-black/20 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {isOverdue && onRollToday && (
            <button
              onClick={onRollToday}
              title="Roll to today's plan"
              className="flex items-center gap-1 rounded bg-amber-500/20 hover:bg-amber-500 hover:text-zinc-950 text-amber-300 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer"
            >
              <Calendar className="size-3" />
              <span>Roll Today</span>
            </button>
          )}

          <button
            onClick={onSelect}
            title={isActive ? "Currently Focusing" : "Set as active focus timer task"}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer",
              isActive
                ? "bg-amber-400 text-zinc-950 shadow-xs"
                : "bg-black/30 hover:bg-black/50 text-[#F5F0E6]",
            )}
          >
            <Play className="size-3 fill-current" />
            <span>{isActive ? "Active" : "Focus"}</span>
          </button>
        </div>

        <button
          onClick={onComplete}
          title="Mark done"
          className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[10px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Check className="size-3 stroke-[3]" />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}

function MonthlyGoalCard({
  goal,
  currentValue,
  onLog,
}: {
  goal: Goal;
  currentValue: number;
  onLog: (goal: Goal, delta: number) => void;
}) {
  const percent = Math.min(100, Math.round((currentValue / (goal.target || 1)) * 100));

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-2.5 space-y-2 text-[#f4f2ee]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-zinc-100 truncate">{goal.title}</p>
          <p className="text-[10px] text-zinc-400 font-medium">
            {currentValue} / {goal.target} {goal.unit ?? "units"} ({percent}%)
          </p>
        </div>
        <button
          onClick={() => onLog(goal, 1)}
          title="Log +1 progress"
          className="flex items-center gap-1 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-zinc-950 px-2 py-1 text-[10px] font-bold transition-all shrink-0 cursor-pointer active:scale-95"
        >
          <Plus className="size-3" />
          <span>+1</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
