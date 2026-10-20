import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Check, Sparkles, Bell } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { type Task } from "@/lib/tasks";
import { useUpdateTask } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

export function FocusTimerModal({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null;
}) {
  const [durationMinutes, setDurationMinutes] = useState(() => {
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
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isWheelActive, setIsWheelActive] = useState(false);
  const wheelDisplayRef = useRef<HTMLDivElement | null>(null);

  const update = useUpdateTask();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeLeft(durationMinutes * 60);
      setIsRunning(false);
      setElapsedMinutes(0);
      setIsWheelActive(false);
    }
  }, [open, durationMinutes]);

  useEffect(() => {
    if (isRunning) {
      setIsWheelActive(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (!isWheelActive) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (wheelDisplayRef.current && !wheelDisplayRef.current.contains(e.target as Node)) {
        setIsWheelActive(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, [isWheelActive]);

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
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  function handleTimerComplete() {
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    toast.success(`Focus session completed for "${task?.title || "Task"}"! 🌟`);

    // Play notification sound
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // Audio playback failed or blocked by autoplay policy
    }

    // Save actual time
    if (task) {
      const currentActual = task.actual_minutes ?? 0;
      update.mutate({
        id: task.id,
        meta: {
          actual_minutes: currentActual + durationMinutes,
        },
      });
    }
  }

  function toggleRunning() {
    setIsRunning((prev) => !prev);
  }

  function resetTimer() {
    setIsRunning(false);
    setTimeLeft(durationMinutes * 60);
  }

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeFormatted = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center bg-[#181818] border-[#282828] text-[#f4f2ee] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center justify-center gap-2 text-[#f4f2ee]">
            <Sparkles className="size-5 text-amber-500" />
            <span>Focus Timer</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {task && (
            <div className="rounded-xl border border-[#383838] bg-[#242424] p-3 text-left">
              <span className="text-[10px] text-[#a09e97] uppercase font-bold tracking-wider">
                Working on
              </span>
              <p className="font-hand text-xl text-[#f4f2ee] font-bold mt-0.5 line-clamp-1">
                {task.title}
              </p>
            </div>
          )}

          {/* Scrollable Time Display with Click-to-Activate Wheel */}
          <div
            ref={wheelDisplayRef}
            onClick={() => {
              if (!isRunning) setIsWheelActive((prev) => !prev);
            }}
            onWheel={(e) => {
              if (isRunning || !isWheelActive) return;
              e.preventDefault();
              const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
              setDurationMinutes((prev) => {
                const next = Math.max(1, Math.min(180, prev + delta));
                setTimeLeft(next * 60);
                try {
                  localStorage.setItem("pinboard_focus_timer_minutes", String(next));
                } catch {}
                return next;
              });
            }}
            title={
              isRunning
                ? "Session Active"
                : isWheelActive
                  ? "Wheel active! Scroll mouse wheel up/down to adjust minutes. Click to lock."
                  : "Click numbers to unlock mouse wheel scrolling"
            }
            className={cn(
              "text-6xl font-mono font-bold tracking-tight text-[#f4f2ee] py-3 px-6 mx-auto inline-block select-none rounded-2xl transition-all",
              isRunning
                ? "cursor-default"
                : isWheelActive
                  ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#181818] bg-amber-500/10 cursor-ns-resize shadow-lg shadow-amber-500/15"
                  : "cursor-pointer hover:bg-[#222222] hover:ring-1 hover:ring-amber-400/40",
            )}
          >
            {timeFormatted}
          </div>

          <div className="text-[11px] text-[#a09e97] -mt-1 select-none flex items-center justify-center min-h-[22px]">
            {isRunning ? (
              <span>Session Active</span>
            ) : isWheelActive ? (
              <button
                type="button"
                onClick={() => setIsWheelActive(false)}
                className="text-amber-400 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                Wheel active · Scroll up/down to set ({durationMinutes}m) · Click to lock
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!isRunning) setIsWheelActive(true);
                }}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {durationMinutes}m session · <span className="underline decoration-dotted font-semibold">Click number to scroll</span> or select preset
              </button>
            )}
          </div>

          {/* Quick Steppers & Duration Presets */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={isRunning}
              onClick={() => {
                const next = Math.max(1, durationMinutes - 5);
                setDurationMinutes(next);
                setTimeLeft(next * 60);
                try {
                  localStorage.setItem("pinboard_focus_timer_minutes", String(next));
                } catch {}
              }}
              className="h-7 px-2 text-xs border-[#383838] bg-[#242424] text-[#dcd7cd] hover:bg-[#2e2e2e] cursor-pointer"
              title="Subtract 5 minutes"
            >
              -5m
            </Button>

            {[
              { label: "25m Focus", min: 25 },
              { label: "50m Defocus", min: 50 },
              { label: "5m Break", min: 5 },
              { label: "15m Rest", min: 15 },
            ].map(({ label, min }) => (
              <Button
                key={min}
                size="sm"
                variant={durationMinutes === min ? "default" : "outline"}
                disabled={isRunning}
                onClick={() => {
                  setDurationMinutes(min);
                  setTimeLeft(min * 60);
                  try {
                    localStorage.setItem("pinboard_focus_timer_minutes", String(min));
                  } catch {}
                }}
                className={cn(
                  "h-7 text-xs transition-colors cursor-pointer",
                  durationMinutes === min
                    ? "bg-[#dcd7cd] text-[#121212] font-bold hover:bg-white border-[#dcd7cd] ring-1 ring-amber-400/80"
                    : "border-[#383838] bg-[#242424] text-[#dcd7cd] hover:bg-[#2e2e2e] hover:text-[#f4f2ee]",
                )}
                title={min === 50 ? "50 minute defocus session" : min === 15 ? "15 minute rest option" : `${min} minute timer`}
              >
                {label}
              </Button>
            ))}

            <Button
              size="sm"
              variant="outline"
              disabled={isRunning}
              onClick={() => {
                const next = Math.min(180, durationMinutes + 5);
                setDurationMinutes(next);
                setTimeLeft(next * 60);
                try {
                  localStorage.setItem("pinboard_focus_timer_minutes", String(next));
                } catch {}
              }}
              className="h-7 px-2 text-xs border-[#383838] bg-[#242424] text-[#dcd7cd] hover:bg-[#2e2e2e] cursor-pointer"
              title="Add 5 minutes"
            >
              +5m
            </Button>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-3 pt-2">
            <Button
              size="lg"
              variant="default"
              onClick={toggleRunning}
              className={cn(
                "gap-2 px-6 font-bold shadow-sm transition-all cursor-pointer",
                isRunning
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-[#dcd7cd] text-[#121212] hover:bg-white",
              )}
            >
              {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              <span>{isRunning ? "Pause" : "Start Focus"}</span>
            </Button>

            <Button
              size="icon"
              variant="outline"
              onClick={resetTimer}
              title="Reset"
              className="border-[#383838] bg-[#242424] text-[#dcd7cd] hover:bg-[#2e2e2e] hover:text-[#f4f2ee] cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-between text-xs text-[#a09e97] border-t border-[#282828] pt-3">
          <div className="flex items-center gap-1.5">
            <Bell className="size-3.5 text-amber-500" />
            <span>Sound alerts on finish</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-[#a09e97] hover:text-[#f4f2ee] hover:bg-[#242424]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
