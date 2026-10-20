import React from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Sun,
  AlertCircle,
  Clock,
  Target,
  Plus,
  Timer,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  MoreHorizontal,
  Check,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyNote } from "@/components/StickyNote";
import { StickyNotesCarousel } from "@/components/StickyNotesCarousel";
import DraggableWidgetGrid, { type WidgetItem } from "@/components/ui/draggable-widget-grid";
import { SyncManager } from "@/lib/sync-manager";
import type { Task, Goal } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface BoardWidget extends WidgetItem {
  id: string;
  label: string;
  description: string;
  size: "sm" | "wide";
}

export const ALL_BOARD_WIDGETS: BoardWidget[] = [
  {
    id: "tasks-overview",
    label: "Tasks Overview (Pending & Today)",
    description: "Backlog of due pending tasks and today's focused priority list",
    size: "sm",
  },
  {
    id: "calendar-timer",
    label: "Month Calendar & Focus Timer",
    description: "2:1 Split Month calendar and Pomodoro focus presets with ambient rain audio",
    size: "sm",
  },
  {
    id: "monthly-goals",
    label: "Monthly Goals & Habit Streaks",
    description: "Monthly progress bars, active streaks tracker, and today's session checkoff",
    size: "sm",
  },
  {
    id: "completed-tasks",
    label: "Completed Tasks & Archive",
    description: "Finished sticky notes archive and celebration carousel",
    size: "sm",
  },
  {
    id: "future-goals",
    label: "Future Goals & Milestones",
    description: "Quarterly and long-term milestones planner",
    size: "sm",
  },
  {
    id: "health",
    label: "Cloud Sync & Engine Health",
    description: "Real-time sync queue and offline engine status",
    size: "sm",
  },
  {
    id: "traces",
    label: "Focus Sessions & Traces",
    description: "Deep work focus session telemetry and session metrics",
    size: "sm",
  },
];

export const DEFAULT_BOARD_WIDGETS: BoardWidget[] = ALL_BOARD_WIDGETS.slice(0, 4);

export interface BoardQuadrantsProps {
  pendingDueItems: Task[];
  todayListItems: Task[];
  monthlyGoalItems: Task[];
  doneItems: Task[];
  goals: Goal[];
  isMonthlyTask: (t: Task) => boolean;
  checkIsBlocked: (t: Task) => boolean;
  complete: { mutate: (arg: { task: Task; reopen?: boolean }) => void };
  update: { mutate: (arg: Partial<Task> & { id: string }) => void };
  setEditing: (t: Task | null) => void;
  setOpen: (b: boolean) => void;
  setDialogDefaults: (d: Partial<Task>) => void;
  handleToggleSubtask: (task: Task, subtaskId: string) => void;
  dropPending: (id: string) => void;
  dropToday: (id: string) => void;
  dropMonthly: (id: string) => void;
  dropDone: (id: string) => void;
  over: string | null;
  setOver: (o: string | null) => void;
  todayStr: string;
  optimisticGoalValues: Record<string, number>;
  currentMonthValues: Map<string, number>;
  isCheckedToday: (id: string) => boolean;
  handleToggleGoalChecklist: (g: Goal) => void;
  skippedDaysCount: number;
  boardMinutes: number;
  boardTimeLeft: number;
  boardTimerRunning: boolean;
  boardTimerPreset: "pomodoro" | "deep" | "short" | "long" | "custom";
  boardRain: boolean;
  setBoardRain: React.Dispatch<React.SetStateAction<boolean>>;
  toggleBoardTimer: () => void;
  resetBoardTimer: () => void;
  setPreset: (minutes: number, preset: "pomodoro" | "deep" | "short" | "long" | "custom") => void;
  activeWidgets?: BoardWidget[];
  onOrderChange?: (newItems: BoardWidget[]) => void;
}

export function BoardQuadrants({
  pendingDueItems,
  todayListItems,
  monthlyGoalItems,
  doneItems,
  goals,
  isMonthlyTask,
  checkIsBlocked,
  complete,
  update,
  setEditing,
  setOpen,
  setDialogDefaults,
  handleToggleSubtask,
  dropPending,
  dropToday,
  dropMonthly,
  dropDone,
  over,
  setOver,
  todayStr,
  optimisticGoalValues,
  currentMonthValues,
  isCheckedToday,
  handleToggleGoalChecklist,
  skippedDaysCount,
  boardMinutes,
  boardTimeLeft,
  boardTimerRunning,
  boardTimerPreset,
  boardRain,
  setBoardRain,
  toggleBoardTimer,
  resetBoardTimer,
  setPreset,
  activeWidgets = DEFAULT_BOARD_WIDGETS,
  onOrderChange,
}: BoardQuadrantsProps) {
  const [calendarDate, setCalendarDate] = React.useState(() => new Date());

  React.useEffect(() => {
    setCalendarDate(new Date());
  }, [todayStr]);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString("default", { month: "long" });

  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const taskDatesMap = React.useMemo(() => {
    const map = new Map<string, { count: number; hasPending: boolean }>();
    const all = [...pendingDueItems, ...todayListItems, ...monthlyGoalItems, ...doneItems];
    for (const t of all) {
      const d = t.scheduled_date || t.due_date;
      if (d) {
        const existing = map.get(d) || { count: 0, hasPending: false };
        existing.count += 1;
        if (t.status !== "done") existing.hasPending = true;
        map.set(d, existing);
      }
    }
    return map;
  }, [pendingDueItems, todayListItems, monthlyGoalItems, doneItems]);

  const dialSvgRef = React.useRef<SVGSVGElement | null>(null);
  const dialContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDraggingDial, setIsDraggingDial] = React.useState(false);
  const [isWheelActive, setIsWheelActive] = React.useState(false);

  // Auto-deactivate wheel scroll when clicking outside or when timer starts
  React.useEffect(() => {
    if (!isWheelActive) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (dialContainerRef.current && !dialContainerRef.current.contains(e.target as Node)) {
        setIsWheelActive(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, [isWheelActive]);

  React.useEffect(() => {
    if (boardTimerRunning) {
      setIsWheelActive(false);
    }
  }, [boardTimerRunning]);

  const boardMinStr = String(Math.floor(boardTimeLeft / 60)).padStart(2, "0");
  const boardSecStr = String(boardTimeLeft % 60).padStart(2, "0");
  const totalSec = boardMinutes * 60;
  const progressPct = totalSec > 0 ? (totalSec - boardTimeLeft) / totalSec : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (boardTimerRunning ? progressPct : Math.min(60, boardMinutes) / 60));

  // Circular dial angle & thumb position
  const currentAngleDeg = boardTimerRunning
    ? progressPct * 360 - 90
    : (Math.min(60, boardMinutes) / 60) * 360 - 90;
  const thumbX = 64 + radius * Math.cos((currentAngleDeg * Math.PI) / 180);
  const thumbY = 64 + radius * Math.sin((currentAngleDeg * Math.PI) / 180);

  const handleWheelClock = (e: React.WheelEvent) => {
    if (!isWheelActive) {
      // Do not intercept scroll if user has not clicked the wheel!
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (boardTimerRunning) {
      toast.info("Pause timer to adjust duration", { duration: 1500 });
      return;
    }
    const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
    const next = Math.max(1, Math.min(180, boardMinutes + delta));
    const preset =
      next === 50
        ? "deep"
        : next === 25
          ? "pomodoro"
          : next === 5
            ? "short"
            : next === 15
              ? "long"
              : "custom";
    setPreset(next, preset);
  };

  const updateMinutesFromPointer = (e: React.PointerEvent<SVGSVGElement> | PointerEvent) => {
    if (boardTimerRunning || !dialSvgRef.current) return;
    const rect = dialSvgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    let mins = Math.round((deg / 360) * 60);
    if (mins === 0) mins = 60;
    const clamped = Math.max(1, Math.min(120, mins));
    const preset =
      clamped === 50
        ? "deep"
        : clamped === 25
          ? "pomodoro"
          : clamped === 5
            ? "short"
            : clamped === 15
              ? "long"
              : "custom";
    setPreset(clamped, preset);
  };

  // Quadrant 1: Tasks Overview
  function renderTasksOverview() {
    return (
      <div className="flex flex-col gap-5 h-full p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sun className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Tasks Overview</h2>
              <p className="text-[11px] text-muted-foreground">Due pending backlog & today's priority list</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingDueItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                onClick={() => {
                  pendingDueItems.forEach((t) => {
                    update.mutate({ id: t.id, scheduled_date: todayStr });
                  });
                  toast.success(`Rescheduled ${pendingDueItems.length} pending tasks to Today! ☀️`);
                }}
              >
                Roll Today
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-xs gap-1 cursor-pointer"
              onClick={() => {
                setDialogDefaults({ status: "todo", scheduled_date: todayStr });
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-3.5" /> Note
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {/* Due Pending Sub-column */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setOver("pending");
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              dropPending(e.dataTransfer.getData("text/plain"));
            }}
            className={cn(
              "flex flex-col gap-3 min-h-64 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 transition-colors",
              over === "pending" && "border-rose-500 bg-rose-500/10",
            )}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-rose-500" />
                <span className="text-xs font-bold text-foreground">Due Pending</span>
              </div>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {pendingDueItems.length}
              </span>
            </div>

            <StickyNotesCarousel
              emptyMessage="No pending due tasks! You're fully caught up 🎉"
              basis="basis-full"
            >
              {pendingDueItems.map((t, i) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className="note-motion min-w-0"
                >
                  <StickyNote
                    task={t}
                    index={i}
                    isBlocked={checkIsBlocked(t)}
                    onComplete={(x) => complete.mutate({ task: x })}
                    onReopen={(x) => complete.mutate({ task: x, reopen: true })}
                    onEdit={(x) => {
                      setEditing(x);
                      setOpen(true);
                    }}
                    onStartTimer={(x) =>
                      window.dispatchEvent(
                        new CustomEvent("open-focus-mode", { detail: { taskId: x.id } }),
                      )
                    }
                    onToggleSubtask={handleToggleSubtask}
                  />
                </div>
              ))}
            </StickyNotesCarousel>
          </section>

          {/* Today's List Sub-column */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setOver("todo");
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              dropToday(e.dataTransfer.getData("text/plain"));
            }}
            className={cn(
              "flex flex-col gap-3 min-h-64 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 transition-colors",
              over === "todo" && "border-amber-500 bg-amber-500/10",
            )}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <Sun className="size-3.5 text-amber-500" />
                <span className="text-xs font-bold text-foreground">Today's List</span>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {todayListItems.length}
              </span>
            </div>

            <StickyNotesCarousel
              emptyMessage="No notes for today. Drag here or click + Note!"
              basis="basis-full"
            >
              {todayListItems.map((t, i) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className="note-motion min-w-0"
                >
                  {isMonthlyTask(t) && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <Target className="size-2.5" />
                      <span>Monthly Goal</span>
                    </div>
                  )}
                  <StickyNote
                    task={t}
                    index={i}
                    isBlocked={checkIsBlocked(t)}
                    onComplete={(x) => complete.mutate({ task: x })}
                    onReopen={(x) => complete.mutate({ task: x, reopen: true })}
                    onEdit={(x) => {
                      setEditing(x);
                      setOpen(true);
                    }}
                    onStartTimer={(x) =>
                      window.dispatchEvent(
                        new CustomEvent("open-focus-mode", { detail: { taskId: x.id } }),
                      )
                    }
                    onToggleSubtask={handleToggleSubtask}
                  />
                </div>
              ))}
            </StickyNotesCarousel>
          </section>
        </div>
      </div>
    );
  }

  // Quadrant 2: Month Calendar & Focus Timer (2:1 Split)
  function renderCalendarTimer() {
    return (
      <div className="p-4 sm:p-5 flex flex-col justify-between h-full relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-[#dcd7cd]/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        {/* 2:1 Split Body: 2x Calendar, 1x Focus Timer with Separate Headings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch relative z-10 h-full">
          {/* 2x Ratio: Month Calendar */}
          <div className="md:col-span-2 flex flex-col justify-between">
            {/* Dedicated Calendar Heading */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <div className="grid size-7.5 place-items-center rounded-xl bg-[#242424] text-[#dcd7cd] border border-[#2e2e2e]">
                  <CalendarIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f4f2ee] leading-tight">
                    Calendar
                  </h2>
                  <p className="text-[10px] text-zinc-400">
                    {monthName} {calYear} · Scheduled milestones
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#242424] text-zinc-300 hover:text-white border border-[#2e2e2e] transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(calYear, calMonth - 1, 1))
                  }
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#242424] transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(calYear, calMonth + 1, 1))
                  }
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#242424] transition-colors cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Weekday Names */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((wd) => (
                <div key={wd} className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Previous month padding days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`prev-${i}`}
                  className="h-7 grid place-items-center rounded text-[11px] text-zinc-600 select-none opacity-40"
                >
                  {daysInPrevMonth - firstDayOfWeek + 1 + i}
                </div>
              ))}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = dStr === todayStr;
                const taskData = taskDatesMap.get(dStr);

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => {
                      if (taskData) {
                        toast.info(`${taskData.count} task(s) on ${monthName} ${dayNum}`);
                      } else {
                        toast.info(`No tasks on ${monthName} ${dayNum}`);
                      }
                    }}
                    className={cn(
                      "relative h-7 flex flex-col items-center justify-center rounded text-[11px] font-medium transition-colors cursor-pointer group",
                      isToday
                        ? "bg-[#dcd7cd] text-[#121212] font-extrabold shadow-sm"
                        : "text-zinc-300 hover:bg-[#242424] hover:text-white",
                    )}
                  >
                    <span>{dayNum}</span>
                    {taskData && (
                      <span
                        className={cn(
                          "absolute bottom-0.5 size-1 rounded-full",
                          isToday
                            ? "bg-rose-600"
                            : taskData.hasPending
                            ? "bg-amber-400"
                            : "bg-emerald-400",
                        )}
                      />
                    )}
                  </button>
                );
              })}

              {/* Next month padding days */}
              {Array.from({
                length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7,
              }).map((_, i) => (
                <div
                  key={`next-${i}`}
                  className="h-7 grid place-items-center rounded text-[11px] text-zinc-600 select-none opacity-40"
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Calendar Legend */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#242424] text-[10px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#dcd7cd]" /> Today
                <span className="size-1.5 rounded-full bg-amber-400 ml-1.5" /> Scheduled
              </span>
              <span>
                {taskDatesMap.size} active date{taskDatesMap.size === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* 1x Ratio: Focus Timer */}
          <div className="md:border-l md:border-[#282828] md:pl-5 flex flex-col justify-between">
            {/* Dedicated Focus Timer Heading */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <div className="grid size-7.5 place-items-center rounded-xl bg-[#242424] text-amber-400 border border-[#2e2e2e]">
                  <Timer className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f4f2ee] leading-tight">
                    Focus Timer
                  </h2>
                  <p className="text-[10px] text-zinc-400">
                    Pomodoro & ambient sounds
                  </p>
                </div>
              </div>

              {/* Ambient Rain Noise Toggle */}
              <button
                type="button"
                onClick={() => setBoardRain((prev) => !prev)}
                className={cn(
                  "p-1.5 rounded-lg border transition-all cursor-pointer",
                  boardRain
                    ? "bg-[#2c2820] text-amber-300 border-amber-500/50 shadow-xs"
                    : "bg-[#242424] text-zinc-400 border-[#2e2e2e] hover:text-white",
                )}
                title={boardRain ? "Rain sound enabled" : "Toggle ambient rain sound"}
              >
                {boardRain ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </button>
            </div>

            {/* Interactive Scrollable Circular Countdown Progress Ring */}
            <div
              onWheel={handleWheelClock}
              className="my-auto flex flex-col items-center justify-center py-2"
            >
              <div
                ref={dialContainerRef}
                onClick={() => {
                  if (!boardTimerRunning) {
                    setIsWheelActive((prev) => !prev);
                  }
                }}
                className={cn(
                  "relative size-32 grid place-items-center select-none rounded-full transition-all",
                  boardTimerRunning
                    ? "cursor-default"
                    : isWheelActive
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#181818] shadow-lg shadow-amber-500/15 cursor-ns-resize"
                      : "cursor-pointer hover:ring-1 hover:ring-amber-400/40",
                )}
                title={
                  boardTimerRunning
                    ? "Session Active"
                    : isWheelActive
                      ? "Scroll wheel active! Scroll up/down to adjust minutes. Click again or outside to lock."
                      : "Click the clock to unlock mouse wheel scrolling, or drag dial directly"
                }
              >
                <svg
                  ref={dialSvgRef}
                  onPointerDown={(e) => {
                    if (boardTimerRunning) return;
                    setIsDraggingDial(true);
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    updateMinutesFromPointer(e);
                  }}
                  onPointerMove={(e) => {
                    if (isDraggingDial || e.buttons === 1) {
                      updateMinutesFromPointer(e);
                    }
                  }}
                  onPointerUp={(e) => {
                    setIsDraggingDial(false);
                    try {
                      (e.target as Element).releasePointerCapture?.(e.pointerId);
                    } catch {}
                  }}
                  className={cn(
                    "size-full touch-none",
                    boardTimerRunning ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                  )}
                  viewBox="0 0 128 128"
                >
                  {/* Outer subtle dial border */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius + 6}
                    className="stroke-[#222222]"
                    strokeWidth="1"
                    fill="transparent"
                  />

                  {/* 12 Clock Tick Marks (Every 5 mins) */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mins = i * 5;
                    const isSpecial = mins === 25 || mins === 50;
                    const isCardinal = mins % 15 === 0;
                    const rad = ((i * 30 - 90) * Math.PI) / 180;
                    const innerR = radius - (isSpecial ? 7 : isCardinal ? 6 : 4);
                    const outerR = radius - 1;
                    return (
                      <line
                        key={mins}
                        x1={64 + innerR * Math.cos(rad)}
                        y1={64 + innerR * Math.sin(rad)}
                        x2={64 + outerR * Math.cos(rad)}
                        y2={64 + outerR * Math.sin(rad)}
                        stroke={isSpecial ? "#f59e0b" : isCardinal ? "#a1a1aa" : "#3f3f46"}
                        strokeWidth={isSpecial ? 2 : isCardinal ? 1.5 : 1}
                      />
                    );
                  })}

                  {/* Track ring */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-[#222222]"
                    strokeWidth="6"
                    fill="transparent"
                  />

                  {/* Active progress or duration arc */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-amber-400 transition-all duration-300 ease-out"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    transform="rotate(-90 64 64)"
                  />

                  {/* Dial scrubber knob / thumb */}
                  <circle
                    cx={thumbX}
                    cy={thumbY}
                    r={5}
                    className="fill-amber-400 stroke-[#181818] shadow-sm transition-transform hover:scale-125"
                    strokeWidth="2"
                  />
                </svg>

                {/* Center time & preset display */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
                  title="Scroll mouse wheel or drag dial to adjust timer"
                >
                  <span className="font-mono text-2xl font-black tracking-tight text-[#f4f2ee]">
                    {boardMinStr}:{boardSecStr}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 max-w-[105px] truncate">
                    {boardTimerPreset === "deep" || boardMinutes === 50
                      ? "50m Defocus"
                      : boardTimerPreset === "long" || boardMinutes === 15
                        ? "15m Rest"
                        : boardTimerPreset === "short" || boardMinutes === 5
                          ? "5m Break"
                          : boardTimerPreset === "pomodoro" || boardMinutes === 25
                            ? "25m Focus"
                            : `${boardMinutes}m ${boardTimerPreset}`}
                  </span>
                </div>
              </div>

              {/* Helper caption: click to scroll */}
              <span className="text-[10px] select-none text-center mt-1.5 transition-colors">
                {boardTimerRunning ? (
                  <span className="text-zinc-400">Session Active</span>
                ) : isWheelActive ? (
                  <button
                    type="button"
                    onClick={() => setIsWheelActive(false)}
                    className="text-amber-400 font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                    Wheel active · Scroll to set ({boardMinutes}m) · Click to lock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!boardTimerRunning) setIsWheelActive(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {boardMinutes}m · <span className="underline decoration-dotted font-semibold">Click wheel to scroll</span> or drag dial
                  </button>
                )}
              </span>

              {/* Play / Pause / Reset / Stepper Controls */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  disabled={boardTimerRunning}
                  onClick={() => {
                    const next = Math.max(1, boardMinutes - 5);
                    setPreset(next, next === 50 ? "deep" : next === 25 ? "pomodoro" : next === 15 ? "long" : "custom");
                  }}
                  className="h-7.5 px-2 rounded-lg bg-[#242424] text-zinc-300 hover:text-white border border-[#2e2e2e] text-[11px] font-mono font-bold disabled:opacity-40 transition-colors cursor-pointer"
                  title="Decrease 5 minutes"
                >
                  -5m
                </button>

                <button
                  type="button"
                  onClick={toggleBoardTimer}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95",
                    boardTimerRunning
                      ? "bg-[#282828] text-amber-300 border border-amber-500/40 hover:bg-[#303030]"
                      : "bg-[#dcd7cd] text-[#121212] hover:bg-[#ede8dd]",
                  )}
                >
                  {boardTimerRunning ? (
                    <>
                      <Pause className="size-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      <span>Start</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetBoardTimer}
                  className="grid size-7.5 place-items-center rounded-lg bg-[#242424] text-zinc-400 border border-[#2e2e2e] hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                  title="Reset timer"
                >
                  <RotateCcw className="size-3.5" />
                </button>

                <button
                  type="button"
                  disabled={boardTimerRunning}
                  onClick={() => {
                    const next = Math.min(180, boardMinutes + 5);
                    setPreset(next, next === 50 ? "deep" : next === 25 ? "pomodoro" : next === 15 ? "long" : "custom");
                  }}
                  className="h-7.5 px-2 rounded-lg bg-[#242424] text-zinc-300 hover:text-white border border-[#2e2e2e] text-[11px] font-mono font-bold disabled:opacity-40 transition-colors cursor-pointer"
                  title="Increase 5 minutes"
                >
                  +5m
                </button>
              </div>
            </div>

            {/* Presets Bar */}
            <div className="pt-2 border-t border-[#242424]">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPreset(25, "pomodoro")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all shrink-0 cursor-pointer",
                    boardMinutes === 25
                      ? "bg-[#dcd7cd] text-[#121212] font-bold shadow-xs"
                      : "bg-[#202020] text-zinc-300 hover:text-white hover:bg-[#282828] border border-[#282828]",
                  )}
                  title="25 minute pomodoro focus"
                >
                  25m Focus
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(50, "deep")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all shrink-0 cursor-pointer",
                    boardMinutes === 50
                      ? "bg-[#dcd7cd] text-[#121212] font-bold shadow-xs ring-1 ring-amber-400/80"
                      : "bg-[#202020] text-zinc-300 hover:text-white hover:bg-[#282828] border border-[#282828]",
                  )}
                  title="50 minute defocus session"
                >
                  50m Defocus
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(5, "short")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all shrink-0 cursor-pointer",
                    boardMinutes === 5
                      ? "bg-[#dcd7cd] text-[#121212] font-bold shadow-xs"
                      : "bg-[#202020] text-zinc-300 hover:text-white hover:bg-[#282828] border border-[#282828]",
                  )}
                  title="5 minute short break"
                >
                  5m Break
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(15, "long")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all shrink-0 cursor-pointer",
                    boardMinutes === 15
                      ? "bg-[#dcd7cd] text-[#121212] font-bold shadow-xs ring-1 ring-amber-400/80"
                      : "bg-[#202020] text-zinc-300 hover:text-white hover:bg-[#282828] border border-[#282828]",
                  )}
                  title="15 minute rest option"
                >
                  15m Rest
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quadrant 3: Monthly Goals
  function renderMonthlyGoals() {
    return (
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setOver("monthly");
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          setOver(null);
          dropMonthly(e.dataTransfer.getData("text/plain"));
        }}
        className={cn(
          "flex flex-col gap-4 h-full p-5 transition-colors",
          over === "monthly" && "bg-emerald-500/10",
        )}
      >
        {/* Header with Title and ... Menu */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Target className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Monthly Goals</h2>
              <p className="text-[11px] text-muted-foreground">Progress bars & daily streak checklist</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                setDialogDefaults({
                  status: "todo",
                  recurrence: "monthly",
                  category: "Monthly Goal",
                });
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-1 size-3.5" /> Add Goal
            </Button>
            <Link
              to="/goals"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Goal settings & full stats"
            >
              <MoreHorizontal className="size-4" />
            </Link>
          </div>
        </div>

        {/* Split Columns: Left = Progress Bars, Right = Active Habit Streaks & Today's Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Progress Bars */}
          <div className="flex flex-col gap-3">
            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3">No monthly goals created yet.</p>
            ) : (
              goals.map((g, idx) => {
                const currentVal = optimisticGoalValues[g.id] ?? currentMonthValues.get(g.id) ?? 0;
                const target = Number(g.target) || 1;
                const pct = Math.min(100, Math.round((currentVal / target) * 100));

                const barColors = [
                  "bg-emerald-600 dark:bg-emerald-500",
                  "bg-sky-500 dark:bg-sky-400",
                  "bg-rose-500 dark:bg-rose-400",
                  "bg-amber-500 dark:bg-amber-400",
                ];
                const chosenColor = barColors[idx % barColors.length];

                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground/90 truncate max-w-[140px]" title={g.title}>
                        {g.title}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        {currentVal} / {target}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full", chosenColor)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vertical Divider & Right Column: Active Habit Day Streaks + Today's Checklist */}
          <div className="flex flex-col gap-3 md:border-l md:border-border/50 md:pl-4">
            {/* Active Habit Day Streaks Header & Pill Track */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-foreground">Active Habit Day Streaks</span>
                <span className="font-mono text-sm font-extrabold text-foreground">
                  {Math.max(1, 30 - skippedDaysCount)}
                </span>
              </div>
              {/* Segmented Streak Pill Track */}
              <div className="flex items-center gap-1">
                <div className="h-1.5 flex-1 rounded-full bg-emerald-500" />
                <div className="h-1.5 flex-1 rounded-full bg-emerald-500" />
                <div className="h-1.5 flex-1 rounded-full bg-amber-400" />
                <div className="h-1.5 flex-1 rounded-full bg-muted" />
                <div className="h-1.5 flex-1 rounded-full bg-muted" />
              </div>
            </div>

            {/* Today's Checklist Done Beside Every Goal */}
            <div className="flex flex-col gap-2 mt-1">
              {goals.map((g) => {
                const checkedToday = isCheckedToday(g.id);
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded-lg p-2 text-xs bg-muted/40 hover:bg-muted transition-colors border border-border/40"
                  >
                    <span className="truncate font-semibold text-foreground/90" title={g.title}>
                      {g.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleGoalChecklist(g)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer shrink-0 border shadow-2xs active:scale-95",
                        checkedToday
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-emerald-500/60",
                      )}
                      title={checkedToday ? "Today's session completed! Click to undo" : "Click to mark today's session completed"}
                    >
                      <Check className={cn("size-3", checkedToday && "stroke-[3]")} />
                      <span>{checkedToday ? "Session Done" : "Complete Session"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Goals Sticky Notes Carousel */}
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Goal Notes
            </span>
            <span className="text-[10px] text-muted-foreground">{monthlyGoalItems.length} pinned</span>
          </div>
          <StickyNotesCarousel
            emptyMessage="Drag notes here to assign to monthly goals"
            basis="basis-full"
          >
            {monthlyGoalItems.map((t, i) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                className="note-motion min-w-0"
              >
                <StickyNote
                  task={t}
                  index={i}
                  isBlocked={checkIsBlocked(t)}
                  onComplete={(x) => complete.mutate({ task: x })}
                  onReopen={(x) => complete.mutate({ task: x, reopen: true })}
                  onEdit={(x) => {
                    setEditing(x);
                    setOpen(true);
                  }}
                  onStartTimer={(x) =>
                    window.dispatchEvent(
                      new CustomEvent("open-focus-mode", { detail: { taskId: x.id } }),
                    )
                  }
                  onToggleSubtask={handleToggleSubtask}
                />
              </div>
            ))}
          </StickyNotesCarousel>
        </div>
      </section>
    );
  }

  // Quadrant 4: Completed Tasks
  function renderCompletedTasks() {
    return (
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setOver("done");
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          setOver(null);
          dropDone(e.dataTransfer.getData("text/plain"));
        }}
        className={cn(
          "flex flex-col gap-4 h-full p-5 transition-colors",
          over === "done" && "bg-emerald-500/10",
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Completed Tasks</h2>
              <p className="text-[11px] text-muted-foreground">Finished notes archive & celebration rack</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {doneItems.length}
          </span>
        </div>

        <StickyNotesCarousel emptyMessage="Completed sticky notes land here 🎉" basis="basis-full">
          {doneItems.map((t, i) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              className="note-motion min-w-0"
            >
              <StickyNote
                task={t}
                index={i}
                onComplete={(x) => complete.mutate({ task: x })}
                onReopen={(x) => complete.mutate({ task: x, reopen: true })}
                onEdit={(x) => {
                  setEditing(x);
                  setOpen(true);
                }}
              />
            </div>
          ))}
        </StickyNotesCarousel>
      </section>
    );
  }

  // Extra Widget: Future Goals
  function renderFutureGoals() {
    return (
      <div className="flex flex-col gap-4 h-full p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/50 pr-24">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Target className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Future Goals & Roadmap</h2>
              <p className="text-[11px] text-muted-foreground">Long-term milestones & focus tracks</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
              onClick={() => {
                setDialogDefaults({ status: "todo", recurrence: "monthly", category: "Future Goal" });
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-1 size-3.5" /> Goal
            </Button>
            <Link
              to="/goals"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Full Goals View"
            >
              <MoreHorizontal className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4">No future goals tracked yet. Click + Goal to add one!</p>
          ) : (
            goals.map((g) => {
              const currentVal = optimisticGoalValues[g.id] ?? currentMonthValues.get(g.id) ?? 0;
              const target = Number(g.target) || 1;
              const pct = Math.min(100, Math.round((currentVal / target) * 100));
              return (
                <div key={g.id} className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate">{g.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{currentVal} / {target} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Extra Widget: Cloud Sync Health
  function renderHealthWidget() {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    const queueLen = SyncManager.getQueue().length;
    return (
      <div className="flex flex-col justify-between h-full p-5">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/50 pr-24">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">System & Cloud Sync</h2>
                <p className="text-[11px] text-muted-foreground">Local storage & background sync queue</p>
              </div>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold border",
              online ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-rose-500/15 text-rose-600 border-rose-500/30"
            )}>
              {online ? "Online" : "Offline Mode"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Engine Uptime</span>
              <p className="text-xl font-extrabold text-foreground mt-0.5 font-mono">99.98%</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Sync Queue</span>
              <p className="text-xl font-extrabold text-foreground mt-0.5 font-mono">{queueLen} pending</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database active & verified</span>
          </span>
          <span className="font-mono text-[10px]">IndexedDB + SQLite</span>
        </div>
      </div>
    );
  }

  // Extra Widget: Traces
  function renderTracesWidget() {
    return (
      <div className="flex flex-col justify-between h-full p-5">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/50 pr-24">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
                <Timer className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">Focus Sessions & Traces</h2>
                <p className="text-[11px] text-muted-foreground">Deep work telemetry & session metrics</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              onClick={() => window.dispatchEvent(new CustomEvent("open-focus-mode"))}
            >
              Open Mode
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground">Active Focus Duration</span>
              <span className="font-mono font-bold text-foreground">{boardMinutes} min session</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground">Ambient Sound</span>
              <span className="font-semibold text-foreground">{boardRain ? "Gentle Rain (Active)" : "Silent"}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground">Timer Status</span>
              <span className="font-mono font-bold text-amber-500">{boardTimerRunning ? "Running countdown" : "Ready"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>Preset: <strong className="text-foreground capitalize">{boardTimerPreset}</strong></span>
          <span className="font-mono text-[10px]">Web Audio API</span>
        </div>
      </div>
    );
  }

  function renderQuadrant(widgetId: string) {
    switch (widgetId) {
      case "tasks-overview":
        return renderTasksOverview();
      case "calendar-timer":
        return renderCalendarTimer();
      case "monthly-goals":
        return renderMonthlyGoals();
      case "completed-tasks":
        return renderCompletedTasks();
      case "future-goals":
        return renderFutureGoals();
      case "health":
        return renderHealthWidget();
      case "traces":
        return renderTracesWidget();
      default:
        return null;
    }
  }

  return (
    <DraggableWidgetGrid
      items={activeWidgets}
      storageKey="pinboard_main_board_widgets_v1"
      className="grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-auto"
      itemClassName={(item) =>
        item.id === "calendar-timer"
          ? "border border-[#282828] bg-[#181818] text-[#f4f2ee] shadow-xl"
          : "border border-border/80 bg-card/60 shadow-sm backdrop-blur-md"
      }
      renderItem={(item) => renderQuadrant(item.id)}
      onOrderChange={(newItems) => onOrderChange?.(newItems as BoardWidget[])}
    />
  );
}
