import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Plus,
  Search,
  Sun,
  Target,
  Sparkles,
  Check,
  CheckCircle2,
  CalendarX,
  Flame,
  Filter,
  Timer,
  Moon,
  RotateCcw,
  Users,
  AlertCircle,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Pin,
  Settings,
  Mail,
  Bell,
  LogOut,
  SlidersHorizontal,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { MorphPanel } from "@/components/ui/ai-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StickyNote } from "@/components/StickyNote";
import { StickyNotesCarousel } from "@/components/StickyNotesCarousel";
import { TaskDialog } from "@/components/TaskDialog";
import { GoalProgress } from "@/components/GoalProgress";
import { FocusTimerModal } from "@/components/FocusTimerModal";
import { RecycleBinModal } from "@/components/RecycleBinModal";
import { ShareBoardModal } from "@/components/ShareBoardModal";
import {
  BoardQuadrants,
  ALL_BOARD_WIDGETS,
  DEFAULT_BOARD_WIDGETS,
  type BoardWidget,
} from "@/components/BoardQuadrants";
import { useCompleteTask, useGoals, useLogGoal, useTasks, useUpdateTask } from "@/hooks/use-data";
import { monthStart, STATUSES, toISODate, type Task, type Goal } from "@/lib/tasks";
import { getTheme, toggleSiteTheme, type Theme } from "@/lib/theme";
import { animateDashboard } from "@/lib/dashboard-reveal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({ meta: [{ title: "Board · Pinboard" }] }),
  component: Board,
});

function Board() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: goalsData } = useGoals();
  const goals = goalsData?.goals ?? [];
  const updates = goalsData?.updates ?? [];

  const complete = useCompleteTask();
  const update = useUpdateTask();
  const logGoal = useLogGoal();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [openRecycleBin, setOpenRecycleBin] = useState(false);
  const [openShare, setOpenShare] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<any>(undefined);
  const [openCustomize, setOpenCustomize] = useState(false);

  // Active board widgets with persistent local storage
  const [activeBoardWidgets, setActiveBoardWidgets] = useState<BoardWidget[]>(() => {
    if (typeof window === "undefined") return DEFAULT_BOARD_WIDGETS;
    try {
      const savedOrder = localStorage.getItem("pinboard_main_board_widgets_v1");
      const savedHidden = localStorage.getItem("pinboard_main_board_hidden_v1");
      const hiddenSet = new Set<string>(savedHidden ? JSON.parse(savedHidden) : []);

      const catalogMap = new Map(ALL_BOARD_WIDGETS.map((w) => [w.id, w]));
      if (savedOrder) {
        const orderIds: string[] = JSON.parse(savedOrder);
        if (Array.isArray(orderIds) && orderIds.length > 0) {
          const list: BoardWidget[] = [];
          for (const id of orderIds) {
            if (!hiddenSet.has(id)) {
              const w = catalogMap.get(id);
              if (w) {
                list.push(w);
                catalogMap.delete(id);
              }
            }
          }
          for (const [id, remaining] of catalogMap.entries()) {
            if (!hiddenSet.has(id) && DEFAULT_BOARD_WIDGETS.some((dw) => dw.id === id)) {
              list.push(remaining);
            }
          }
          if (list.length > 0) return list;
        }
      }
    } catch (e) {
      console.warn("Failed to read board widgets from localStorage", e);
    }
    return DEFAULT_BOARD_WIDGETS;
  });

  function handleUpdateBoardWidgets(next: BoardWidget[]) {
    setActiveBoardWidgets(next);
    try {
      const hiddenIds = ALL_BOARD_WIDGETS.filter(
        (avail) => !next.some((n) => n.id === avail.id),
      ).map((h) => h.id);
      localStorage.setItem("pinboard_main_board_hidden_v1", JSON.stringify(hiddenIds));
      localStorage.setItem(
        "pinboard_main_board_widgets_v1",
        JSON.stringify(next.map((n) => n.id)),
      );
    } catch (err) {
      console.warn(err);
    }
  }

  function handleResetBoardLayout() {
    try {
      localStorage.removeItem("pinboard_main_board_widgets_v1");
      localStorage.removeItem("pinboard_main_board_hidden_v1");
      setActiveBoardWidgets(DEFAULT_BOARD_WIDGETS);
      toast.success("Board layout reset to defaults");
    } catch (e) {
      console.warn(e);
    }
  }

  // Search, Filters & Sorting
  const [q, setQ] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterGoal, setFilterGoal] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created" | "priority" | "due_date">("created");

  // Site-wide theme sync
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      setThemeState((e as CustomEvent<Theme>).detail);
    };
    window.addEventListener("theme-changed", handleThemeChange);
    return () => window.removeEventListener("theme-changed", handleThemeChange);
  }, []);

  const isDark = theme === "dark";

  const [over, setOver] = useState<string | null>(null);

  // Dashboard Entrance Reveal Animation (ANTIGRAVITY-HANDOFF)
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !dashboardRef.current) return;
    if (hasAnimatedRef.current) {
      dashboardRef.current.classList.remove("dashboard-preparing");
      return;
    }

    let cleanup: (() => void) | undefined;
    let active = true;

    const runEntrance = async () => {
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // continue
        }
      }
      if (!active || !dashboardRef.current) return;
      cleanup = animateDashboard(dashboardRef.current);
      hasAnimatedRef.current = true;
    };

    runEntrance();

    return () => {
      active = false;
      if (cleanup) {
        cleanup();
        hasAnimatedRef.current = false;
      }
    };
  }, [isLoading]);

  // Instant optimistic state for goal checklist to eliminate 1-second delay
  const [optimisticGoalChecks, setOptimisticGoalChecks] = useState<Record<string, boolean>>({});
  const [optimisticGoalValues, setOptimisticGoalValues] = useState<Record<string, number>>({});

  // Focus Timer state for top-right dashboard card (persisted in localStorage)
  const [boardMinutes, setBoardMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_timer_minutes");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 1 && val <= 360) return val;
      }
    } catch {}
    return 25;
  });
  const [boardTimeLeft, setBoardTimeLeft] = useState(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_timer_minutes");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 1 && val <= 360) return val * 60;
      }
    } catch {}
    return 25 * 60;
  });
  const [boardTimerRunning, setBoardTimerRunning] = useState(false);
  const [boardTimerPreset, setBoardTimerPreset] = useState<"pomodoro" | "deep" | "short" | "long" | "custom">(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_timer_preset");
      if (saved === "deep" || saved === "long" || saved === "short" || saved === "pomodoro" || saved === "custom") {
        return saved;
      }
    } catch {}
    return "pomodoro";
  });
  const boardRainState = useState(false);
  const [boardRain, setBoardRain] = boardRainState;
  const boardAudioCtxRef = useRef<AudioContext | null>(null);
  const boardNoiseNodeRef = useRef<AudioNode | null>(null);

  function setPreset(minutes: number, preset: "pomodoro" | "deep" | "short" | "long" | "custom") {
    setBoardMinutes(minutes);
    setBoardTimeLeft(minutes * 60);
    setBoardTimerPreset(preset);
    setBoardTimerRunning(false);
    try {
      localStorage.setItem("pinboard_focus_timer_minutes", String(minutes));
      localStorage.setItem("pinboard_focus_timer_preset", preset);
    } catch {}
  }

  function toggleBoardTimer() {
    setBoardTimerRunning((prev) => !prev);
  }

  function resetBoardTimer() {
    setBoardTimerRunning(false);
    setBoardTimeLeft(boardMinutes * 60);
  }

  // Timer interval countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (boardTimerRunning) {
      interval = setInterval(() => {
        setBoardTimeLeft((prev) => {
          if (prev <= 1) {
            setBoardTimerRunning(false);
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
            toast.success("Focus session complete! Great work! 🎉");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [boardTimerRunning]);

  // Rain sound generator using Web Audio API
  useEffect(() => {
    if (boardRain && boardTimerRunning) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!boardAudioCtxRef.current && AudioCtx) {
          boardAudioCtxRef.current = new AudioCtx();
        }
        const ctx = boardAudioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume();
        }
        if (ctx && !boardNoiseNodeRef.current) {
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856;
            b4 = 0.55 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.016898;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
            b6 = white * 0.115926;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = 800;
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          whiteNoise.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);
          whiteNoise.start();
          boardNoiseNodeRef.current = gainNode;
        }
      } catch {
        // audio optional
      }
    } else {
      if (boardAudioCtxRef.current && boardAudioCtxRef.current.state === "running") {
        boardAudioCtxRef.current.suspend();
      }
    }
  }, [boardRain, boardTimerRunning]);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toISODate(today), [today]);
  const currentMonthStr = useMemo(() => monthStart(today), [today]);
  const dayOfMonth = today.getDate();
  const daysInMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    [today],
  );

  const currentMonthValues = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of updates) {
      if (u.month === currentMonthStr) {
        map.set(u.goal_id, Number(u.value));
      }
    }
    return map;
  }, [updates, currentMonthStr]);

  // Find goal creation dates for accurate skipped day exclusion
  const goalCreationDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals) {
      map.set(g.id, toISODate(new Date(g.created_at)));
    }
    return map;
  }, [goals]);

  // Priority rank for sorting
  const priorityRank: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        // Archive filter
        if (t.is_archived) return false;

        // Search
        if (
          q &&
          !(t.title + (t.notes ?? "") + (t.category ?? "")).toLowerCase().includes(q.toLowerCase())
        ) {
          return false;
        }

        // Priority filter
        if (filterPriority !== "all" && t.priority !== filterPriority) return false;

        // Goal link filter
        if (filterGoal !== "all") {
          if (filterGoal === "unlinked" && t.goal_id) return false;
          if (filterGoal !== "unlinked" && t.goal_id !== filterGoal) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        }
        if (sortBy === "due_date") {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tasks, q, filterPriority, filterGoal, sortBy]);

  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // Check if a task is a monthly goal task
  const isMonthlyTask = (t: Task): boolean =>
    Boolean(
      t.goal_id ||
      t.recurrence === "monthly" ||
      t.category?.toLowerCase() === "monthly goal" ||
      t.category?.toLowerCase() === "monthly" ||
      t.category?.toLowerCase() === "goal",
    );

  // Dedicated Column: Pending & Due Work (tasks whose due date or scheduled date was in the past)
  const pendingDueItems = useMemo(
    () =>
      filtered.filter((t) => {
        if (t.status === "done") return false;
        const taskDate = t.scheduled_date || (t.due_date ? t.due_date.slice(0, 10) : null);
        return taskDate !== null && taskDate < todayStr;
      }),
    [filtered, todayStr],
  );

  // Column 1: Today's Work tasks (includes daily work + in_progress, excluding past overdue items)
  const todayListItems = useMemo(
    () =>
      filtered.filter((t) => {
        if (t.status !== "todo" && t.status !== "in_progress") return false;
        if (isMonthlyTask(t)) return t.scheduled_date === todayStr;
        const taskDate = t.scheduled_date || (t.due_date ? t.due_date.slice(0, 10) : null);
        if (taskDate && taskDate < todayStr) return false;
        return true;
      }),
    [filtered, todayStr],
  );

  // Column 2: Monthly Goal tasks (dedicated habit & goal tasks)
  const monthlyGoalItems = useMemo(
    () =>
      filtered.filter(
        (t) => (t.status === "todo" || t.status === "in_progress") && isMonthlyTask(t),
      ),
    [filtered],
  );

  // Column 3: Done tasks
  const doneItems = useMemo(() => filtered.filter((t) => t.status === "done"), [filtered]);

  // Dates with activity this month
  const completedDatesThisMonth = useMemo(() => {
    const dates = new Set<string>();
    for (const t of tasks) {
      if (
        t.status === "done" &&
        t.completed_at &&
        t.completed_at.startsWith(currentMonthStr.slice(0, 7))
      ) {
        dates.add(toISODate(new Date(t.completed_at)));
      }
    }
    for (const u of updates) {
      if (u.month === currentMonthStr && u.updated_at) {
        dates.add(toISODate(new Date(u.updated_at)));
      }
    }
    return dates;
  }, [tasks, updates, currentMonthStr]);

  // Count how many daily sessions were skipped this month (past days without activity)
  // Excludes rest days (Saturday & Sunday by default or if configured) and dates before oldest goal creation
  const skippedDaysCount = useMemo(() => {
    let count = 0;
    for (let d = 1; d < dayOfMonth; d++) {
      const dObj = new Date(today.getFullYear(), today.getMonth(), d);
      const dayOfWeek = dObj.getDay();
      // Exclude rest days: Sunday (0) and Saturday (6)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dStr = toISODate(dObj);
      if (!completedDatesThisMonth.has(dStr)) {
        count++;
      }
    }
    return count;
  }, [today, dayOfMonth, completedDatesThisMonth]);

  // Recent 10 days activity pace track
  const recentDaysHistory = useMemo(() => {
    const list: {
      dateStr: string;
      dayNum: number;
      completed: boolean;
      isToday: boolean;
      isRestDay: boolean;
    }[] = [];
    const startDay = Math.max(1, dayOfMonth - 6);
    for (let d = startDay; d <= dayOfMonth; d++) {
      const dObj = new Date(today.getFullYear(), today.getMonth(), d);
      const dStr = toISODate(dObj);
      const isToday = d === dayOfMonth;
      const isRestDay = dObj.getDay() === 0 || dObj.getDay() === 6;
      const completed = completedDatesThisMonth.has(dStr);
      list.push({ dateStr: dStr, dayNum: d, completed, isToday, isRestDay });
    }
    return list;
  }, [today, dayOfMonth, completedDatesThisMonth]);

  // Checks whether a goal has been checked in today (with instant optimistic cache)
  const isCheckedToday = (goalId: string): boolean => {
    if (optimisticGoalChecks[goalId] !== undefined) {
      return optimisticGoalChecks[goalId]!;
    }
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
    const serverVal = currentMonthValues.get(g.id) ?? 0;
    const currentVal = optimisticGoalValues[g.id] ?? serverVal;
    const checked = isCheckedToday(g.id);
    const nextChecked = !checked;
    const nextVal = nextChecked ? currentVal + 1 : Math.max(0, currentVal - 1);

    // Instant optimistic update (0ms delay)
    setOptimisticGoalChecks((prev) => ({ ...prev, [g.id]: nextChecked }));
    setOptimisticGoalValues((prev) => ({ ...prev, [g.id]: nextVal }));

    if (!nextChecked) {
      logGoal.mutate(
        {
          goal_id: g.id,
          month: currentMonthStr,
          value: nextVal,
          note: nextVal === 0 ? null : `Decreased on ${todayStr}`,
        },
        {
          onError: () => {
            setOptimisticGoalChecks((prev) => ({ ...prev, [g.id]: checked }));
            setOptimisticGoalValues((prev) => ({ ...prev, [g.id]: currentVal }));
            toast.error("Failed to update goal");
          },
        }
      );
      toast.info(`Unchecked today's progress for "${g.title}"`);
    } else {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      logGoal.mutate(
        {
          goal_id: g.id,
          month: currentMonthStr,
          value: nextVal,
          note: `Checked on ${todayStr}`,
        },
        {
          onError: () => {
            setOptimisticGoalChecks((prev) => ({ ...prev, [g.id]: checked }));
            setOptimisticGoalValues((prev) => ({ ...prev, [g.id]: currentVal }));
            toast.error("Failed to update goal");
          },
        }
      );
      toast.success(`Checked off today's progress for "${g.title}"! (+1 ${g.unit ?? "unit"}) 🎉`);
    }
  }

  function handleIncrementGoal(g: Goal, delta = 1) {
    const serverVal = currentMonthValues.get(g.id) ?? 0;
    const currentVal = optimisticGoalValues[g.id] ?? serverVal;
    const newVal = currentVal + delta;
    setOptimisticGoalValues((prev) => ({ ...prev, [g.id]: newVal }));
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
    });
    logGoal.mutate(
      {
        goal_id: g.id,
        month: currentMonthStr,
        value: newVal,
        note: `Checked on ${todayStr}`,
      },
      {
        onError: () => {
          setOptimisticGoalValues((prev) => ({ ...prev, [g.id]: currentVal }));
          toast.error("Failed to update goal");
        },
      }
    );
    toast.success(`Logged +${delta} to "${g.title}"! (${newVal}/${g.target} ${g.unit ?? ""}) 🎉`);
  }

  function dropPending(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    update.mutate({
      id,
      status: "todo",
      scheduled_date: toISODate(yesterday),
      completed_at: null,
    });
    toast.info(`Moved "${t.title}" to Due Work Pending ⏳`);
  }

  function dropToday(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    update.mutate({
      id,
      status: "todo",
      recurrence: t.recurrence === "monthly" ? "none" : t.recurrence,
      scheduled_date: todayStr,
      completed_at: null,
    });
    toast.success(`Moved "${t.title}" to Today's Work! ☀️`);
  }

  function dropMonthly(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    update.mutate({
      id,
      status: "todo",
      recurrence: "monthly",
      category: t.category || "Monthly Goal",
      scheduled_date: null,
      completed_at: null,
    });
    toast.success(`Moved "${t.title}" to Monthly Goal! 🗓️`);
  }

  function dropDone(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === "done") return;
    complete.mutate({ task: t });
  }

  function handleToggleSubtask(task: Task, subtaskId: string) {
    const updatedSubtasks = (task.subtasks ?? []).map((st) =>
      st.id === subtaskId ? { ...st, done: !st.done } : st,
    );
    update.mutate({
      id: task.id,
      meta: {
        subtasks: updatedSubtasks,
      },
    });
  }

  // Check if a task has unsatisfied dependencies
  function checkIsBlocked(t: Task): boolean {
    if (!t.dependencies || t.dependencies.length === 0) return false;
    for (const depId of t.dependencies) {
      const depTask = tasks.find((x) => x.id === depId);
      if (depTask && depTask.status !== "done") return true;
    }
    return false;
  }

  return (
    <div className="whiteboard min-h-[calc(100vh-2rem)] w-full rounded-2xl border border-border/80 bg-background/50 p-3 sm:p-5 shadow-sm flex flex-col">
      {/* Header - Unified single line with My Board, Ask AI, Settings, Account & Controls */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Pin className="size-4.5 text-primary rotate-12" />
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              My board
            </h1>
          </div>
        </div>

        {/* Action Controls on the exact same line */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Ask AI MorphPanel (expands downwards) */}
          <MorphPanel
            onSubmitMessage={(msg) => {
              window.dispatchEvent(new CustomEvent("open-ai-copilot", { detail: { prompt: msg } }));
            }}
          />

          {/* Settings */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
            title="Settings & Data"
            className="grid size-9 place-items-center rounded-xl bg-[#222222] border border-[#444444] text-[#f4f2ee] shadow-sm hover:bg-[#2e2e2e] hover:border-[#666666] hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <Settings className="size-4.5 stroke-[2.2]" />
          </button>

          {/* Mail / Inbox */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-messages"))}
            title="Inbox & Daily Digest"
            className="grid size-9 place-items-center rounded-xl bg-[#222222] border border-[#444444] text-[#f4f2ee] shadow-sm hover:bg-[#2e2e2e] hover:border-[#666666] hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <Mail className="size-4.5 stroke-[2.2]" />
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-notifications"))}
            title="Notifications"
            className="relative grid size-9 place-items-center rounded-xl bg-[#222222] border border-[#444444] text-[#f4f2ee] shadow-sm hover:bg-[#2e2e2e] hover:border-[#666666] hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <Bell className="size-4.5 stroke-[2.2]" />
            <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-md ring-2 ring-[#181818]">
              3
            </span>
          </button>

          {/* Account Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-border/60">
            <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-foreground font-bold text-xs ring-1 ring-primary/30">
              SK
            </span>
            <span className="hidden xl:inline text-xs font-semibold text-foreground">
              Smit Kansara
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("sign-out"))}
            title="Sign out"
            className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="size-4" />
          </button>

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("open-focus-mode"))}
            title="Open Focus Mode & Widget"
            className="h-8.5 gap-1.5 text-xs border-border/80 text-foreground hover:bg-accent cursor-pointer"
          >
            <Timer className="size-3.5 text-amber-500" />
            <span className="hidden md:inline">Focus Mode</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenShare(true)}
            title="Share board with collaborators"
            className="h-8.5 gap-1.5 text-xs hover:bg-accent cursor-pointer"
          >
            <Users className="size-3.5 text-primary" />
            <span className="hidden md:inline">Share Board</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenRecycleBin(true)}
            title="Open Recycle Bin & Safe Archive"
            className="h-8.5 gap-1.5 text-xs hover:bg-accent cursor-pointer"
          >
            <RotateCcw className="size-3.5 text-amber-500" />
            <span className="hidden md:inline">Recycle Bin</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenCustomize(true)}
            title="Customize board widgets & layout"
            className="h-8.5 gap-1.5 text-xs border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden md:inline">Customize Layout</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetBoardLayout}
            title="Reset board layout to defaults"
            className="h-8.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden 2xl:inline">Reset</span>
          </Button>

          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button
              onClick={() => {
                setDialogDefaults(undefined);
                setEditing(null);
                setOpen(true);
              }}
              className="h-8.5 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="size-4" /> Add note
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/40 p-3 text-xs shadow-2xs backdrop-blur-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sticky notes..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Goal Link filter */}
          <select
            value={filterGoal}
            onChange={(e) => setFilterGoal(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All Goals</option>
            <option value="unlinked">Unlinked Tasks Only</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Linked: {g.title}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "created" | "priority" | "due_date")}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="created">Sort: Newest</option>
            <option value="priority">Sort: Priority</option>
            <option value="due_date">Sort: Due Date</option>
          </select>
        </div>
      </div>

      {/* Helper Banner for Rearrangeable Layout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-card/60 border border-border/70 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary shrink-0" />
          <span>
            <strong className="text-foreground">Customizable Layout:</strong> Drag any quadrant tile freely to rearrange, or click "Customize Layout" to reorder and toggle widgets.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono text-muted-foreground hidden sm:inline">Auto-saved locally</span>
          <button
            type="button"
            onClick={() => setOpenCustomize(true)}
            className="text-primary hover:underline font-bold cursor-pointer"
          >
            Customize Widgets
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading your notes…</p>
      ) : (
        <div ref={dashboardRef} className="dashboard dashboard-preparing w-full">
          <BoardQuadrants
            pendingDueItems={pendingDueItems}
            todayListItems={todayListItems}
            monthlyGoalItems={monthlyGoalItems}
            doneItems={doneItems}
            goals={goals}
            isMonthlyTask={isMonthlyTask}
            checkIsBlocked={checkIsBlocked}
            complete={complete}
            update={update}
            setEditing={setEditing}
            setOpen={setOpen}
            setDialogDefaults={setDialogDefaults}
            handleToggleSubtask={handleToggleSubtask}
            dropPending={dropPending}
            dropToday={dropToday}
            dropMonthly={dropMonthly}
            dropDone={dropDone}
            over={over}
            setOver={setOver}
            todayStr={todayStr}
            optimisticGoalValues={optimisticGoalValues}
            currentMonthValues={currentMonthValues}
            isCheckedToday={isCheckedToday}
            handleToggleGoalChecklist={handleToggleGoalChecklist}
            skippedDaysCount={skippedDaysCount}
            boardMinutes={boardMinutes}
            boardTimeLeft={boardTimeLeft}
            boardTimerRunning={boardTimerRunning}
            boardTimerPreset={boardTimerPreset}
            boardRain={boardRain}
            setBoardRain={setBoardRain}
            toggleBoardTimer={toggleBoardTimer}
            resetBoardTimer={resetBoardTimer}
            setPreset={setPreset}
            activeWidgets={activeBoardWidgets}
            onOrderChange={handleUpdateBoardWidgets}
          />
        </div>
      )}

      {/* Task Creation & Edit Modal */}
      <TaskDialog open={open} onOpenChange={setOpen} task={editing} defaults={dialogDefaults} />

      {/* Focus Timer Modal */}
      <FocusTimerModal
        open={Boolean(focusTask)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setFocusTask(null);
        }}
        task={focusTask}
      />

      {/* Recycle Bin & Safe Archive Modal */}
      <RecycleBinModal open={openRecycleBin} onOpenChange={setOpenRecycleBin} />

      {/* Collaborative Shared Board Modal */}
      <ShareBoardModal open={openShare} onOpenChange={setOpenShare} />

      {/* Customize Board Widgets & Layout Modal */}
      <Dialog open={openCustomize} onOpenChange={setOpenCustomize}>
        <DialogContent className="sm:max-w-lg bg-[#181818] border-[#282828] text-[#f4f2ee] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#f4f2ee]">
              <SlidersHorizontal className="size-5 text-primary" />
              <span>Customize Board Layout & Widgets</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Toggle which widgets and sections to display on your board and reorder them with the arrow controls or by dragging tiles directly on the grid.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {ALL_BOARD_WIDGETS.map((w) => {
                const isEnabled = activeBoardWidgets.some((aw) => aw.id === w.id);
                const activeIndex = activeBoardWidgets.findIndex((aw) => aw.id === w.id);

                return (
                  <div
                    key={w.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border transition-colors",
                      isEnabled
                        ? "border-[#383838] bg-[#242424]"
                        : "border-[#282828] bg-[#141414] opacity-60",
                    )}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          let next: BoardWidget[];
                          if (checked) {
                            next = [...activeBoardWidgets, w];
                          } else {
                            next = activeBoardWidgets.filter((aw) => aw.id !== w.id);
                          }
                          handleUpdateBoardWidgets(next);
                        }}
                        className="size-4 rounded accent-primary cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#f4f2ee] block truncate">
                          {w.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {w.description}
                        </span>
                      </div>
                    </label>

                    {isEnabled && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeIndex <= 0) return;
                            const next = [...activeBoardWidgets];
                            const [item] = next.splice(activeIndex, 1);
                            if (!item) return;
                            next.splice(activeIndex - 1, 0, item);
                            handleUpdateBoardWidgets(next);
                          }}
                          disabled={activeIndex === 0}
                          className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move up"
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeIndex >= activeBoardWidgets.length - 1) return;
                            const next = [...activeBoardWidgets];
                            const [item] = next.splice(activeIndex, 1);
                            if (!item) return;
                            next.splice(activeIndex + 1, 0, item);
                            handleUpdateBoardWidgets(next);
                          }}
                          disabled={activeIndex === activeBoardWidgets.length - 1}
                          className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move down"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#282828] flex items-center justify-between sm:justify-between">
            <button
              type="button"
              onClick={handleResetBoardLayout}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={() => setOpenCustomize(false)}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
