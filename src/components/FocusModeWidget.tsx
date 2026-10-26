import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  X,
  Flame,
  CheckSquare,
  Square,
  Plus,
  Timer,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  Clock,
  SlidersHorizontal,
  GripVertical,
  PictureInPicture2,
  Target,
} from "lucide-react";
import { motion, useDragControls } from "motion/react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useTasks, useUpdateTask, useCompleteTask } from "@/hooks/use-data";
import { type Task, noteBg, toISODate } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { getTheme, toggleSiteTheme, type Theme } from "@/lib/theme";
import { FocusGoalsPopup } from "./FocusGoalsPopup";

const PRESETS = [
  { label: "Pomodoro", minutes: 25 },
  { label: "Defocus", minutes: 50 },
  { label: "Short Break", minutes: 5 },
  { label: "Rest", minutes: 15 },
] as const;

export function FocusModeWidget() {
  const { data: allTasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();

  // Active incomplete tasks
  const availableTasks = useMemo(
    () => allTasks.filter((t) => t.status !== "done" && !t.is_archived),
    [allTasks],
  );

  // Widget visibility & display mode: "hidden" | "closed" | "floating" | "fullscreen"
  const [viewMode, setViewMode] = useState<"hidden" | "closed" | "floating" | "fullscreen">(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_widget_mode");
      if (saved === "hidden" || saved === "closed" || saved === "floating" || saved === "fullscreen") {
        return saved as "hidden" | "closed" | "floating" | "fullscreen";
      }
    } catch {}
    return "floating";
  });

  useEffect(() => {
    try {
      localStorage.setItem("pinboard_focus_widget_mode", viewMode);
    } catch {}
  }, [viewMode]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Goals popup state anchored across widget icon
  const [showGoalsPopup, setShowGoalsPopup] = useState(false);

  // Always-on-top desktop Document PiP window (stays visible when browser minimized)
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [showPipGoals, setShowPipGoals] = useState(false);

  // Outside click listener for Goals popup
  useEffect(() => {
    if (!showGoalsPopup) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".goals-popup-container") && !target.closest(".goals-trigger-btn")) {
        setShowGoalsPopup(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, [showGoalsPopup]);

  // Session completion for today
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const [sessionFinished, setSessionFinished] = useState(() => {
    try {
      return localStorage.getItem(`pinboard_session_finished_${toISODate(new Date())}`) === "true";
    } catch {
      return false;
    }
  });

  // Site-wide theme sync
  const [focusTheme, setFocusTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const newTheme = (e as CustomEvent<Theme>).detail;
      setFocusTheme(newTheme);
    };
    window.addEventListener("theme-changed", handleThemeChange);
    return () => window.removeEventListener("theme-changed", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = toggleSiteTheme();
    setFocusTheme(next);
  };

  // Timer settings (persisted in localStorage)
  const [selectedMinutes, setSelectedMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_timer_minutes");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 1 && val <= 360) return val;
      }
    } catch {}
    return 25;
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    try {
      const saved = localStorage.getItem("pinboard_focus_timer_minutes");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 1 && val <= 360) return val * 60;
      }
    } catch {}
    return 25 * 60;
  });
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWheelActive, setIsWheelActive] = useState(false);

  // Custom timer editor state
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("30");

  // Subtask creation
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtasksPanel, setShowSubtasksPanel] = useState(false);

  // Ambient sound (synthesized client-side via Web Audio API)
  const [ambientSound, setAmbientSound] = useState(false);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Timer interval
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragControls = useDragControls();
  const isDraggingPillRef = useRef(false);

  // The active task object
  const activeTask: Task | undefined = useMemo(() => {
    if (selectedTaskId) {
      const found = allTasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return availableTasks[0];
  }, [selectedTaskId, allTasks, availableTasks]);

  // Synchronize default selected task
  useEffect(() => {
    if (!selectedTaskId && availableTasks.length > 0 && availableTasks[0]) {
      setSelectedTaskId(availableTasks[0].id);
    }
  }, [availableTasks, selectedTaskId]);

  // Listen for global custom event to open focus mode with a specific task
  useEffect(() => {
    const handleOpenFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ taskId?: string; minutes?: number; mode?: "closed" | "floating" | "fullscreen" }>).detail;
      if (detail?.taskId) setSelectedTaskId(detail.taskId);
      if (detail?.minutes) {
        setSelectedMinutes(detail.minutes);
        setTimeLeft(detail.minutes * 60);
      }
      setViewMode(detail?.mode || "floating");
    };

    window.addEventListener("open-focus-mode", handleOpenFocus);
    return () => window.removeEventListener("open-focus-mode", handleOpenFocus);
  }, []);

  // Timer countdown loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsRunning(false);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, activeTask, selectedMinutes]);

  useEffect(() => {
    if (isRunning) {
      setIsWheelActive(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (!isWheelActive) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (circleRef.current && !circleRef.current.contains(e.target as Node)) {
        setIsWheelActive(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, [isWheelActive]);

  // Ambient sound generator using Web Audio API (gentle pink/rain noise)
  useEffect(() => {
    if (ambientSound && isRunning) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!audioContextRef.current && AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume();
        }

        if (ctx && !noiseNodeRef.current) {
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let b0 = 0,
            b1 = 0,
            b2 = 0,
            b3 = 0,
            b4 = 0,
            b5 = 0,
            b6 = 0;
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
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);

          whiteNoise.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);
          whiteNoise.start();

          noiseNodeRef.current = whiteNoise;
        }
      } catch {
        // Audio error fallback
      }
    } else {
      if (noiseNodeRef.current) {
        try {
          (noiseNodeRef.current as AudioBufferSourceNode).stop();
          noiseNodeRef.current.disconnect();
        } catch {
          // ignore cleanup
        }
        noiseNodeRef.current = null;
      }
    }

    return () => {
      if (noiseNodeRef.current) {
        try {
          (noiseNodeRef.current as AudioBufferSourceNode).stop();
          noiseNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        noiseNodeRef.current = null;
      }
    };
  }, [ambientSound, isRunning]);

  function playChimeSound() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio fallback
    }
  }

  function handleTimerComplete() {
    playChimeSound();
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    toast.success("Focus session completed! Great work! 🎉", { duration: 6000 });

    if (activeTask) {
      const addedMins = selectedMinutes;
      const prevMins = activeTask.actual_minutes ?? 0;
      updateTask.mutate({
        id: activeTask.id,
        meta: { actual_minutes: prevMins + addedMins },
      });
    }
  }

  function togglePlay() {
    setIsRunning((prev) => !prev);
  }

  function resetTimer(mins = selectedMinutes) {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setSelectedMinutes(mins);
    setTimeLeft(mins * 60);
    setElapsedSeconds(0);
    try {
      localStorage.setItem("pinboard_focus_timer_minutes", String(mins));
    } catch {}
  }

  function addMinutes(mins: number) {
    setTimeLeft((prev) => Math.max(60, prev + mins * 60));
    setSelectedMinutes((prev) => {
      const next = Math.max(1, prev + mins);
      try {
        localStorage.setItem("pinboard_focus_timer_minutes", String(next));
      } catch {}
      return next;
    });
    toast.success(`Timer adjusted by ${mins > 0 ? "+" : ""}${mins} minutes`);
  }

  function applyCustomMinutes() {
    const parsed = parseInt(customMinutesInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid number of minutes (e.g. 15, 30, 45)");
      return;
    }
    const clamped = Math.max(1, Math.min(360, parsed));
    resetTimer(clamped);
    setShowCustomTimer(false);
    toast.success(`Custom timer set to ${clamped} minutes`);
  }

  function handleCompleteActiveTask() {
    if (!activeTask) return;
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.65 } });
    completeTask.mutate({ task: activeTask });
    toast.success(`Marked "${activeTask.title}" as Done! ✨`);
    resetTimer(selectedMinutes);
  }

  function handleToggleSubtask(subtaskId: string) {
    if (!activeTask) return;
    const currentSubtasks = activeTask.subtasks ?? [];
    const updated = currentSubtasks.map((st) =>
      st.id === subtaskId ? { ...st, done: !st.done } : st,
    );
    updateTask.mutate({
      id: activeTask.id,
      meta: { subtasks: updated },
    });
  }

  function handleAddSubtask() {
    if (!activeTask || !newSubtaskTitle.trim()) return;
    const currentSubtasks = activeTask.subtasks ?? [];
    const newSubtask = {
      id: Math.random().toString(36).slice(2, 8),
      title: newSubtaskTitle.trim(),
      done: false,
    };
    updateTask.mutate({
      id: activeTask.id,
      meta: { subtasks: [...currentSubtasks, newSubtask] },
    });
    setNewSubtaskTitle("");
  }

  function handleFinishTodaySession() {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });
    setIsRunning(false);
    setSessionFinished(true);
    try {
      localStorage.setItem(`pinboard_session_finished_${todayStr}`, "true");
    } catch {}
    toast.success("Today's session finished! Outstanding work! 🏁🎉", {
      description: "Great progress logged. You can take a break or start a bonus session anytime.",
    });
  }

  const openDesktopPip = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    if (typeof window === "undefined" || !("documentPictureInPicture" in window)) {
      toast.info("Always-on-top desktop window is supported in Chrome & Edge browsers.");
      return;
    }
    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 360,
        height: 250,
      });

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.href) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pip.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            const style = document.createElement("style");
            for (const rule of Array.from(sheet.cssRules)) {
              style.appendChild(document.createTextNode(rule.cssText));
            }
            pip.document.head.appendChild(style);
          }
        } catch {}
      }

      pip.document.documentElement.className = document.documentElement.className;
      pip.document.body.className =
        "bg-[#141414] text-[#f4f2ee] m-0 p-3 select-none overflow-hidden font-sans";

      pip.addEventListener("pagehide", () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
      toast.success("Focus timer popped out! Stays on top even when browser is minimized.");
    } catch (err: any) {
      toast.error(err?.message || "Could not open desktop window.");
    }
  };

  const togglePipGoals = () => {
    setShowPipGoals((prev) => {
      const next = !prev;
      try {
        if (next) {
          pipWindow?.resizeTo(820, 520);
        } else {
          pipWindow?.resizeTo(360, 260);
        }
      } catch {}
      return next;
    });
  };

  // Format time strings
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progressRatio = Math.max(0, 1 - timeLeft / (selectedMinutes * 60));

  const pipPortal =
    pipWindow &&
    createPortal(
      showPipGoals ? (
        <div className="flex flex-col h-full bg-[#141414] text-[#f4f2ee] p-2 select-none font-sans overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#282828] shrink-0">
            <button
              onClick={togglePipGoals}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer py-1 px-2 rounded hover:bg-white/5"
            >
              <Timer className="size-3.5" />
              <span>Back to Timer ({timeFormatted})</span>
            </button>
            <button
              onClick={() => {
                setShowPipGoals(false);
                pipWindow.close();
              }}
              className="text-zinc-400 hover:text-rose-400 p-1 rounded hover:bg-white/10 cursor-pointer"
              title="Close desktop window"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <FocusGoalsPopup
              onClose={togglePipGoals}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                togglePipGoals();
              }}
              activeTaskId={activeTask?.id}
              onFinishTodaySession={handleFinishTodaySession}
              sessionFinished={sessionFinished}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between bg-[#141414] text-[#f4f2ee] p-2 select-none font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-[#282828]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[190px]">
                {activeTask?.title || "Pinboard Focus"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={togglePipGoals}
                className="text-zinc-400 hover:text-amber-400 p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Today's Goals & Due Pending (Click to view popup)"
              >
                <Target className="size-3.5" />
              </button>
              <button
                onClick={() => pipWindow.close()}
                className="text-zinc-400 hover:text-rose-400 p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Close desktop window"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center my-auto py-2">
            <span className="font-mono text-4xl font-black text-amber-400 tracking-tight">
              {timeFormatted}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-1">
              {isRunning ? "Session Active" : `${selectedMinutes}m Focus Timer`}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 border-t border-[#282828]">
            <button
              onClick={() => resetTimer()}
              title="Reset Timer"
              className="size-8 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              onClick={togglePlay}
              className={cn(
                "h-8 px-4 rounded-lg text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer",
                isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-500 hover:bg-amber-600",
              )}
            >
              {isRunning ? (
                <Pause className="size-3 fill-current" />
              ) : (
                <Play className="size-3 fill-current ml-0.5" />
              )}
              <span>{isRunning ? "Pause" : "Start"}</span>
            </button>
            <button
              onClick={() => addMinutes(5)}
              title="Add 5 minutes"
              className="h-8 px-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              +5m
            </button>
            <button
              onClick={togglePipGoals}
              title="Today's & Due Goals"
              className="h-8 px-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer"
            >
              <Target className="size-3" />
              <span>Goals</span>
            </button>
          </div>
        </div>
      ),
      pipWindow.document.body,
    );

  // Dark Zen Linen theme is enforced across focus widget
  const isDark = true;

  // Circular Dial interaction (mouse wheel & rotary dragging)
  const circleRef = useRef<HTMLDivElement>(null);
  const isDraggingDialRef = useRef(false);
  const wheelAccumulatorRef = useRef(0);

  // Wheel scroll handler for clock circle (only active when clicked/unlocked)
  const handleCircleWheel = (e: React.WheelEvent) => {
    if (!isWheelActive) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    wheelAccumulatorRef.current += e.deltaY;
    const threshold = 30;

    if (Math.abs(wheelAccumulatorRef.current) >= threshold) {
      const direction = wheelAccumulatorRef.current < 0 ? 1 : -1;
      const step = e.shiftKey ? 5 : 1;
      const change = direction * step;
      wheelAccumulatorRef.current = 0;

      if (isRunning) {
        setTimeLeft((prev) => Math.max(60, prev + change * 60));
        setSelectedMinutes((prev) => Math.max(1, prev + change));
      } else {
        setSelectedMinutes((prev) => {
          const next = Math.max(1, Math.min(360, prev + change));
          setTimeLeft(next * 60);
          setCustomMinutesInput(String(next));
          try {
            localStorage.setItem("pinboard_focus_timer_minutes", String(next));
          } catch {}
          return next;
        });
      }
    }
  };

  // Rotary pointer dragging handler
  const handlePointerDownDial = (e: React.PointerEvent) => {
    isDraggingDialRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateDialFromPointer(e);
  };

  const handlePointerMoveDial = (e: React.PointerEvent) => {
    if (!isDraggingDialRef.current) return;
    updateDialFromPointer(e);
  };

  const handlePointerUpDial = (e: React.PointerEvent) => {
    if (isDraggingDialRef.current) {
      isDraggingDialRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const updateDialFromPointer = (e: React.PointerEvent) => {
    if (!circleRef.current) return;
    const rect = circleRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    const ratio = angle / (2 * Math.PI);
    let targetMins = Math.round(ratio * 60);
    if (targetMins <= 0) targetMins = 60;

    if (isRunning) {
      setTimeLeft(targetMins * 60);
      setSelectedMinutes(targetMins);
    } else {
      setSelectedMinutes(targetMins);
      setTimeLeft(targetMins * 60);
      setCustomMinutesInput(String(targetMins));
      try {
        localStorage.setItem("pinboard_focus_timer_minutes", String(targetMins));
      } catch {}
    }
  };

  // Interactive dial knob coordinates on the circular perimeter
  const knobRatio = isRunning
    ? Math.max(0, 1 - progressRatio)
    : (selectedMinutes <= 60 ? selectedMinutes : ((selectedMinutes - 1) % 60) + 1) / 60;
  const knobAngleRad = knobRatio * 2 * Math.PI - Math.PI / 2;
  const knobX = 50 + 40 * Math.cos(knobAngleRad);
  const knobY = 50 + 40 * Math.sin(knobAngleRad);

  // ---------------- HIDDEN LAUNCHER (Discrete Bottom-Right Trigger) ---------------- //
  if (viewMode === "hidden") {
    return (
      <>
        {pipWindow && pipPortal}
        <button
          onClick={() => setViewMode("floating")}
          title="Show Focus Timer & Goals"
          aria-label="Show Focus Timer & Goals"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-[#181818]/90 hover:bg-[#242424] border border-[#2e2e2e] text-[#dcd7cd] px-3 py-2 text-xs font-semibold shadow-xl transition-all hover:scale-105 active:scale-95 backdrop-blur-md cursor-pointer group"
        >
          <Timer className="size-4 text-amber-500 transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline">Focus Timer</span>
          {isRunning && (
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>
      </>
    );
  }

  // ---------------- CLOSED TRIGGER BADGE (Draggable Pill) ---------------- //
  if (viewMode === "closed") {
    return (
      <>
        {pipWindow && pipPortal}
        <motion.div
          drag
          dragMomentum={false}
          onDragStart={() => {
            isDraggingPillRef.current = true;
          }}
          onDragEnd={() => {
            setTimeout(() => {
              isDraggingPillRef.current = false;
            }, 150);
          }}
          className="fixed bottom-5 right-5 z-40 touch-none cursor-grab active:cursor-grabbing flex items-center gap-1.5"
        >
          <button
            onClick={() => {
              if (!isDraggingPillRef.current) {
                setViewMode("floating");
              }
            }}
            aria-label="Open Focus Mode"
            className="flex items-center gap-2.5 rounded-full bg-[#181818] border border-[#282828] px-4 py-2.5 text-[#dcd7cd] font-semibold shadow-2xl hover:bg-[#242424] hover:border-[#383838] active:scale-95 transition-all group backdrop-blur-md cursor-pointer"
          >
            <GripVertical className="size-4 opacity-60 text-zinc-400" />
            <Timer className="size-5 text-[#dcd7cd] transition-transform group-hover:rotate-12" />
            <span className="text-sm font-semibold tracking-wide">Focus Mode</span>
            {isRunning && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {timeFormatted}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode("hidden")}
            title="Hide Focus Widget"
            className="size-8 rounded-full bg-[#181818] border border-[#282828] text-zinc-400 hover:text-rose-400 hover:bg-[#242424] flex items-center justify-center transition-colors shadow-lg cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      </>
    );
  }

  // ---------------- MINIMIZED FLOATING WIDGET (Windows Desktop Style) ---------------- //
  if (viewMode === "floating") {
    return (
      <>
        {pipWindow && pipPortal}
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          className="fixed bottom-5 right-5 z-50 w-84 rounded-2xl border border-[#282828] bg-[#181818] text-[#f4f2ee] shadow-2xl touch-none backdrop-blur-md"
        >
          {/* Goals Popup Window anchored across the icon */}
          {showGoalsPopup && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="goals-popup-container absolute right-0 bottom-[calc(100%+12px)] z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <FocusGoalsPopup
                onClose={() => setShowGoalsPopup(false)}
                onSelectTask={(id) => {
                  setSelectedTaskId(id);
                  setShowGoalsPopup(false);
                }}
                activeTaskId={activeTask?.id}
                onFinishTodaySession={handleFinishTodaySession}
                sessionFinished={sessionFinished}
              />
            </div>
          )}

          {/* Widget Top Bar - Draggable across screen */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            title="Drag anywhere on the screen"
            className="flex items-center justify-between border-b border-[#282828] bg-[#141414] px-3.5 py-2.5 rounded-t-2xl cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="size-3.5 text-zinc-400" />
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Focus Widget
              </span>
            </div>

            <div
              className="flex items-center gap-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Desktop PiP Popout (stays on top even when browser is minimized) */}
              <button
                onClick={openDesktopPip}
                title={
                  pipWindow
                    ? "Desktop floating window active (Click to close)"
                    : "Float over all windows & screen (Stays on top when site is minimized)"
                }
                className={cn(
                  "relative p-1.5 rounded-md transition-colors cursor-pointer",
                  pipWindow
                    ? "text-amber-400 bg-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
                )}
              >
                <PictureInPicture2 className="size-3.5" />
                {pipWindow && (
                  <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              {/* Goals Popup Icon - Small icon that triggers Today's & Due Goals popup */}
              <button
                onClick={() => setShowGoalsPopup((prev) => !prev)}
                title="Today's Goals & Due Pending (Click to toggle popup)"
                className={cn(
                  "goals-trigger-btn relative p-1.5 rounded-md transition-colors cursor-pointer",
                  showGoalsPopup
                    ? "text-amber-400 bg-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
                )}
              >
                <Target className="size-3.5" />
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500" />
              </button>

              {/* Subtask Flyout Toggle */}
              <button
                onClick={() => setShowSubtasksPanel(!showSubtasksPanel)}
                title="Toggle checklist"
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  showSubtasksPanel
                    ? "text-amber-400 bg-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
                )}
              >
                {showSubtasksPanel ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
              </button>

              {/* Maximize to Fullscreen */}
              <button
                onClick={() => setViewMode("fullscreen")}
                title="Maximize to Fullscreen Zen Mode"
                className="p-1.5 rounded-md transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              >
                <Maximize2 className="size-3.5" />
              </button>

              {/* Dock to Bottom Pill */}
              <button
                onClick={() => setViewMode("closed")}
                title="Dock to bottom pill"
                className="p-1.5 rounded-md transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              >
                <Minimize2 className="size-3.5" />
              </button>

              {/* Cross Option to Hide Widget */}
              <button
                onClick={() => {
                  setViewMode("hidden");
                  setShowGoalsPopup(false);
                }}
                title="Hide Focus Widget"
                className="p-1.5 rounded-md transition-colors text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

        {/* Progress Line */}
        <div className={cn("h-1 w-full overflow-hidden", isDark ? "bg-zinc-800" : "bg-zinc-100")}>
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        {/* Widget Body */}
        <div className="p-3.5 space-y-3">
          {/* Active Task Name */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Current Focus
              </span>
              <p
                className={cn(
                  "font-medium text-xs truncate mt-0.5",
                  isDark ? "text-zinc-100" : "text-zinc-900",
                )}
                title={activeTask?.title || "No task selected"}
              >
                {activeTask?.title || "Free Focus Session"}
              </p>
            </div>
            {activeTask && (
              <button
                onClick={handleCompleteActiveTask}
                title="Mark Done"
                className="flex items-center gap-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white px-2 py-0.5 text-[11px] font-semibold transition-colors"
              >
                <CheckCircle2 className="size-3" />
                <span>Done</span>
              </button>
            )}
          </div>

          {/* Large Countdown + Controls */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => {
                if (!isRunning) setIsWheelActive((prev) => !prev);
              }}
              onWheel={(e) => {
                if (isRunning || !isWheelActive) return;
                e.preventDefault();
                addMinutes(e.deltaY < 0 ? 1 : -1);
              }}
              title={
                isRunning
                  ? "Session Active"
                  : isWheelActive
                    ? "Wheel active! Scroll mouse wheel to adjust minutes. Click to lock."
                    : "Click to enable mouse wheel scrolling"
              }
              className={cn(
                "flex flex-col select-none rounded-xl p-1.5 transition-all",
                isRunning
                  ? "cursor-default"
                  : isWheelActive
                    ? "ring-2 ring-amber-400 bg-amber-500/10 cursor-ns-resize shadow-md shadow-amber-500/10"
                    : "cursor-pointer hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "font-mono text-3xl font-black tracking-tight",
                  isDark ? "text-white" : "text-zinc-900",
                )}
              >
                {timeFormatted}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isWheelActive ? "text-amber-400 font-bold" : isDark ? "text-zinc-400" : "text-zinc-500",
                )}
              >
                {isRunning
                  ? "Session Active"
                  : isWheelActive
                    ? `Wheel active (${selectedMinutes}m) · Click to lock`
                    : `${selectedMinutes}m · Click to scroll`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Quick +5m Extension Button */}
              <button
                onClick={() => addMinutes(5)}
                title="Add 5 minutes to timer"
                className={cn(
                  "h-8 px-2 rounded-lg text-xs font-semibold border transition-colors",
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                +5m
              </button>

              <button
                onClick={() => resetTimer()}
                title="Reset Timer"
                className={cn(
                  "size-8 rounded-lg border flex items-center justify-center transition-colors",
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
                )}
              >
                <RotateCcw className="size-3.5" />
              </button>

              <button
                onClick={togglePlay}
                className={cn(
                  "h-8 px-3 rounded-lg text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95",
                  isRunning
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-amber-500 hover:bg-amber-600",
                )}
              >
                {isRunning ? (
                  <>
                    <Pause className="size-3 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3 fill-current ml-0.5" />
                    <span>Start</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subtasks flyout inside floating widget */}
          {showSubtasksPanel && activeTask && (
            <div
              className={cn(
                "pt-2.5 border-t space-y-2",
                isDark ? "border-zinc-800/80" : "border-zinc-200/80",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between text-[11px] font-semibold",
                  isDark ? "text-zinc-400" : "text-zinc-500",
                )}
              >
                <span>Task Checklist</span>
                <span>
                  {(activeTask.subtasks ?? []).filter((s) => s.done).length}/
                  {(activeTask.subtasks ?? []).length} done
                </span>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {(activeTask.subtasks ?? []).length === 0 ? (
                  <p
                    className={cn(
                      "text-[11px] italic py-1",
                      isDark ? "text-zinc-500" : "text-zinc-400",
                    )}
                  >
                    No checklist items on this note.
                  </p>
                ) : (
                  activeTask.subtasks?.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleToggleSubtask(st.id)}
                      className={cn(
                        "flex items-center gap-2 w-full text-left rounded-md px-2 py-1 text-xs transition-colors",
                        isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-100",
                      )}
                    >
                      {st.done ? (
                        <CheckSquare className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Square
                          className={cn(
                            "size-3.5 shrink-0",
                            isDark ? "text-zinc-600" : "text-zinc-400",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "truncate text-[11px]",
                          st.done &&
                            (isDark
                              ? "line-through text-zinc-600"
                              : "line-through text-zinc-400"),
                        )}
                      >
                        {st.title}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
      </>
    );
  }

  // ---------------- DASHBOARD FOCUS MODE MODAL ---------------- //
  return (
    <>
      {pipWindow && pipPortal}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) setViewMode("closed");
        }}
      >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-[#282828] bg-[#181818] text-[#f4f2ee] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
      {/* Top Header Controls */}
      <header className="flex items-center justify-between border-b border-[#282828] bg-[#141414] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
            <Timer className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-[#f4f2ee]">
              Focus Mode
            </h2>
            <p className="text-xs text-zinc-400">
              Distraction-free deep work & task execution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ambient Rain Sound Generator */}
          <button
            onClick={() => setAmbientSound(!ambientSound)}
            title={ambientSound ? "Mute ambient rain" : "Turn on ambient rain sounds"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
              ambientSound
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-[#383838] bg-[#242424] text-zinc-300 hover:text-white hover:bg-[#2e2e2e]",
            )}
          >
            {ambientSound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            <span>Rain Ambiance</span>
          </button>

          {/* Minimize to Desktop Widget */}
          <button
            onClick={() => setViewMode("floating")}
            title="Minimize to Floating Desktop Widget"
            className="flex items-center gap-1.5 rounded-full border border-[#383838] bg-[#242424] text-zinc-300 hover:text-white hover:bg-[#2e2e2e] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <Minimize2 className="size-3.5" />
            <span className="hidden sm:inline">Mini Widget</span>
          </button>

          {/* Close */}
          <button
            onClick={() => setViewMode("closed")}
            title="Exit Focus Mode"
            className="size-8 rounded-full border border-[#383838] bg-[#242424] text-zinc-300 hover:text-white hover:bg-[#2e2e2e] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Focus Center */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Timer & Controls (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col items-center text-center space-y-6">
            {/* Duration Presets & Custom Trigger */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  onClick={() => {
                    setShowCustomTimer(false);
                    resetTimer(p.minutes);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    selectedMinutes === p.minutes && !showCustomTimer
                      ? "bg-amber-500 text-white shadow-md scale-105"
                      : "bg-[#242424] text-zinc-300 border border-[#383838] hover:bg-[#2e2e2e] hover:text-white",
                  )}
                >
                  {p.label} ({p.minutes}m)
                </button>
              ))}

              {/* Custom Duration Button */}
              <button
                onClick={() => setShowCustomTimer(!showCustomTimer)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  showCustomTimer
                    ? "bg-amber-500 text-white shadow-md scale-105"
                    : "bg-[#242424] text-zinc-300 border border-[#383838] hover:bg-[#2e2e2e] hover:text-white",
                )}
              >
                <SlidersHorizontal className="size-3" />
                <span>Custom...</span>
              </button>
            </div>

            {/* Custom Timer Input Panel */}
            {showCustomTimer && (
              <div
                className="w-full max-w-md rounded-2xl p-4 border border-[#282828] bg-[#181818] text-[#f4f2ee] shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <Clock className="size-3.5" />
                    <span>Set Custom Duration</span>
                  </span>
                  <span className="text-zinc-500">
                    1 to 360 mins
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={customMinutesInput}
                    onChange={(e) => setCustomMinutesInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCustomMinutes();
                      }
                    }}
                    placeholder="Minutes"
                    className="h-9 w-28 rounded-lg border border-[#383838] bg-[#242424] text-white px-3 text-sm font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">minutes</span>

                  <button
                    onClick={applyCustomMinutes}
                    className="ml-auto h-9 px-4 rounded-lg bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    Apply Timer
                  </button>
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                  <span className="text-[10px] uppercase font-bold mr-1 text-zinc-500">
                    Quick:
                  </span>
                  {[5, 15, 25, 50, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        setCustomMinutesInput(String(mins));
                        resetTimer(mins);
                        setShowCustomTimer(false);
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-semibold border transition-colors cursor-pointer",
                        selectedMinutes === mins
                          ? "border-amber-400 bg-[#282828] text-amber-300 font-bold"
                          : "border-[#383838] bg-[#242424] text-zinc-300 hover:bg-[#2e2e2e] hover:text-white",
                      )}
                    >
                      {mins === 50 ? "50m Defocus" : mins === 15 ? "15m Rest" : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Circular / Digital Countdown Display with Interactive Rotary Dial & Scroll */}
            <div
              ref={circleRef}
              onClick={() => {
                if (!isRunning && !isDraggingDialRef.current) {
                  setIsWheelActive((prev) => !prev);
                }
              }}
              onWheel={handleCircleWheel}
              onPointerDown={handlePointerDownDial}
              onPointerMove={handlePointerMoveDial}
              onPointerUp={handlePointerUpDial}
              onPointerCancel={handlePointerUpDial}
              title={
                isRunning
                  ? "Session Active"
                  : isWheelActive
                    ? "Wheel active! Scroll mouse wheel up/down to adjust minutes. Click to lock."
                    : "Click circle to unlock mouse wheel scrolling, or drag dial"
              }
              style={{ touchAction: "none" }}
              className={cn(
                "relative size-72 sm:size-80 flex flex-col items-center justify-center rounded-full shadow-xl p-6 transition-all duration-300 select-none bg-[#181818] border shadow-black/40",
                isRunning
                  ? "border-[#282828] cursor-default"
                  : isWheelActive
                    ? "border-amber-400 ring-4 ring-amber-400/40 ring-offset-4 ring-offset-[#121212] shadow-amber-500/20 cursor-ns-resize"
                    : "border-[#282828] hover:border-amber-400/40 cursor-grab active:cursor-grabbing group",
              )}
            >
              {/* Circular SVG Ring - Exact Single Whole Ring with Smooth Arc */}
              <svg viewBox="0 0 240 240" className="absolute inset-0 size-full -rotate-90 pointer-events-none">
                {/* Whole Ring Background */}
                <circle
                  cx="120"
                  cy="120"
                  r="96"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={cn(
                    "fill-none",
                    isDark ? "text-zinc-800" : "text-amber-100",
                  )}
                />
                {/* Clean Continuous Progress Arc */}
                <circle
                  cx="120"
                  cy="120"
                  r="96"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={603.1858}
                  strokeDashoffset={
                    603.1858 *
                    (1 - (isRunning ? timeLeft / (selectedMinutes * 60) : Math.min(1, selectedMinutes / 60)))
                  }
                  strokeLinecap="round"
                  className="text-amber-500 fill-none transition-all duration-150"
                />
              </svg>

              {/* Glowing Interactive Rotary Dial Knob */}
              <div
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 border-2 border-white dark:border-zinc-950 shadow-md shadow-amber-500/50 pointer-events-none transition-transform duration-75 group-hover:scale-125 flex items-center justify-center z-20"
                style={{
                  left: `${knobX}%`,
                  top: `${knobY}%`,
                }}
              >
                <div className="size-1.5 rounded-full bg-white dark:bg-zinc-950" />
              </div>

              <div className="relative z-10 flex flex-col items-center pointer-events-none">
                <span
                  className={cn(
                    "font-mono text-5xl sm:text-6xl font-black tracking-tight",
                    isDark ? "text-white" : "text-zinc-900",
                  )}
                >
                  {timeFormatted}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-widest mt-2",
                    isDark ? "text-zinc-400" : "text-zinc-500",
                  )}
                >
                  {isRunning
                    ? "Session in Progress"
                    : selectedMinutes === 50
                      ? "50m Defocus"
                      : selectedMinutes === 15
                        ? "15m Rest"
                        : "Ready to Focus"}
                </span>
                {elapsedSeconds > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                    <Flame className="size-3" />
                    <span>{Math.floor(elapsedSeconds / 60)}m focused</span>
                  </span>
                )}
              </div>
            </div>

            {/* Scroll or Drag Hint Badge */}
            <button
              type="button"
              onClick={() => {
                if (!isRunning) setIsWheelActive((prev) => !prev);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer select-none",
                isWheelActive
                  ? "border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400 shadow-sm"
                  : isDark
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100",
              )}
            >
              <RotateCcw className="size-3" />
              <span>
                {isWheelActive
                  ? `Wheel active · Scroll up/down to set (${selectedMinutes}m) · Click to lock`
                  : "Click wheel to scroll or drag circle to dial time"}
              </span>
            </button>

            {/* Quick Extension Adjusters & Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => addMinutes(-5)}
                disabled={timeLeft <= 300}
                title="Subtract 5 minutes"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-30",
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100",
                )}
              >
                -5m
              </button>

              <button
                onClick={() => addMinutes(5)}
                title="Add 5 minutes to timer"
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-semibold border transition-colors cursor-pointer",
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100",
                )}
              >
                +5m
              </button>

              <button
                onClick={() => addMinutes(15)}
                title="Add 15 minutes to timer"
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-semibold border transition-colors cursor-pointer",
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100",
                )}
              >
                +15m
              </button>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => resetTimer()}
                title="Reset session"
                className="size-12 rounded-full border border-[#383838] bg-[#242424] text-zinc-300 hover:text-white hover:bg-[#2e2e2e] flex items-center justify-center shadow-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="size-5" />
              </button>

              <button
                onClick={togglePlay}
                className={cn(
                  "h-14 px-8 rounded-full text-white font-bold text-base flex items-center gap-3 shadow-xl transition-all cursor-pointer active:scale-95",
                  isRunning
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/25",
                )}
              >
                {isRunning ? (
                  <>
                    <Pause className="size-5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="size-5 fill-current ml-0.5" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>

              {activeTask && (
                <button
                  onClick={handleCompleteActiveTask}
                  title="Mark active task complete"
                  className="size-12 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="size-6" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Focus Task Card & Interactive Subtasks (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Task Selector Dropdown */}
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-xs font-bold uppercase tracking-wider text-zinc-400"
              >
                Target Task
              </label>
              {availableTasks.length > 1 && (
                <select
                  value={activeTask?.id ?? ""}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="h-7 text-xs rounded border border-[#383838] bg-[#242424] text-[#f4f2ee] px-2 max-w-[200px] truncate focus:outline-none"
                >
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#181818] text-[#f4f2ee]">
                      {t.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Active Task Card */}
            {activeTask ? (
              <div
                className={cn(
                  "rounded-2xl p-5 shadow-lg border transition-all",
                  noteBg[activeTask.color] || "bg-[#181818] border-[#282828] text-[#f4f2ee]",
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-hand text-2xl font-bold text-ink leading-tight">
                    {activeTask.title}
                  </h3>
                  <button
                    onClick={handleCompleteActiveTask}
                    className="flex items-center gap-1.5 rounded-full bg-ink/10 hover:bg-ink hover:text-white text-ink px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Done</span>
                  </button>
                </div>

                {activeTask.notes && (
                  <p className="text-xs text-ink/80 whitespace-pre-wrap mb-4 font-sans line-clamp-3">
                    {activeTask.notes}
                  </p>
                )}

                {/* Subtasks Checklist */}
                <div className="pt-3 border-t border-ink/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink/75">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="size-3.5" />
                      <span>Checklist</span>
                    </span>
                    <span>
                      {(activeTask.subtasks ?? []).filter((s) => s.done).length}/
                      {(activeTask.subtasks ?? []).length} completed
                    </span>
                  </div>

                  {/* Subtask items */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(activeTask.subtasks ?? []).length === 0 ? (
                      <p className="text-xs text-ink/60 italic py-1">
                        No checklist steps yet. Add one below!
                      </p>
                    ) : (
                      activeTask.subtasks?.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleToggleSubtask(st.id)}
                          className="flex items-center gap-2.5 w-full text-left rounded-lg bg-black/5 hover:bg-black/10 px-2.5 py-1.5 text-xs text-ink transition-colors cursor-pointer"
                        >
                          {st.done ? (
                            <CheckSquare className="size-4 text-emerald-700 shrink-0" />
                          ) : (
                            <Square className="size-4 text-ink/50 shrink-0" />
                          )}
                          <span className={cn("flex-1", st.done && "line-through opacity-50")}>
                            {st.title}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Add Subtask Step */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add step to checklist..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                      className="h-8 flex-1 rounded-md bg-white/80 dark:bg-black/20 border border-ink/20 px-2.5 text-xs text-ink placeholder:text-ink/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="h-8 px-2.5 rounded-md bg-ink text-white text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-dashed border-[#282828] bg-[#141414] p-8 text-center space-y-3"
              >
                <Sparkles className="size-8 mx-auto text-zinc-500" />
                <p className="text-sm font-semibold text-zinc-300">
                  All caught up!
                </p>
                <p className="text-xs text-zinc-500">
                  No pending tasks found. Enjoy your focus time or create a new sticky note.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
    </>
  );
}
