import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Check,
  Repeat,
  Clock,
  CalendarDays,
  Pencil,
  Target,
  CheckSquare,
  AlertCircle,
  Timer,
  Play,
  Pause,
  Undo2,
  Lock,
} from "lucide-react";
import { noteBg, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

function tilt(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.8;
}

export function StickyNote({
  task,
  onComplete,
  onReopen,
  onEdit,
  onStartTimer,
  onToggleSubtask,
  isBlocked = false,
  index = 0,
}: {
  task: Task;
  onComplete?: (t: Task) => void;
  onReopen?: (t: Task) => void;
  onEdit?: (t: Task) => void;
  onStartTimer?: (t: Task) => void;
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
  isBlocked?: boolean;
  index?: number;
}) {
  const [falling, setFalling] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const rot = tilt(task.id);
  const done = task.status === "done";
  const inProgress = task.status === "in_progress";

  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.done).length;

  function complete(e: React.MouseEvent) {
    e.stopPropagation();
    if (falling || done) return;

    if (!shouldReduceMotion) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      confetti({
        particleCount: 50,
        spread: 60,
        startVelocity: 25,
        origin: { x: (r.left + r.width / 2) / window.innerWidth, y: r.top / window.innerHeight },
        scalar: 0.8,
      });
      setFalling(true);
    } else {
      onComplete?.(task);
    }
  }

  function reopen(e: React.MouseEvent) {
    e.stopPropagation();
    onReopen?.(task);
  }

  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, rotate: rot - 6 }}
      whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, rotate: rot }}
      viewport={{ once: true, margin: "-40px" }}
      transition={
        shouldReduceMotion
          ? { duration: 0.1 }
          : { type: "spring", stiffness: 160, damping: 16, delay: Math.min(index, 8) * 0.04 }
      }
      animate={
        falling && !shouldReduceMotion
          ? {
              rotate: [rot, rot - 5, rot + 5, rot - 3, rot + 18, rot + 55],
              y: [0, -4, 0, -10, 120, 900],
              x: [0, 0, 0, 0, 20, 70],
              opacity: [1, 1, 1, 1, 1, 0],
              transition: { duration: 1.4, times: [0, 0.1, 0.2, 0.32, 0.55, 1], ease: "easeIn" },
            }
          : {}
      }
      onAnimationComplete={() => {
        if (falling) onComplete?.(task);
      }}
      style={{
        transformOrigin: "50% 4px",
        ...(falling ? { zIndex: 50 } : {}),
      }}
      tabIndex={0}
      role="article"
      aria-label={`Sticky note: ${task.title}, Status: ${task.status}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.(task);
        }
      }}
      className={cn(
        "note-fold group relative cursor-grab active:cursor-grabbing rounded-sm p-4 pt-6 text-[#F5F0E6] font-medium shadow-note transition-shadow hover:shadow-note-lift focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        noteBg[task.color] ?? noteBg["yellow"],
        done && "opacity-75",
        inProgress && "ring-2 ring-primary/60",
        isBlocked && "opacity-80 border-dashed border-2 border-amber-400/60",
      )}
      onClick={() => onEdit?.(task)}
    >
      <span className="absolute left-1/2 top-1.5 size-3 -translate-x-1/2 rounded-full bg-pin shadow-note" />

      {/* Header Metadata */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#F5F0E6]/85">
        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            task.priority === "urgent" && "bg-rose-500/30 text-rose-200 font-bold",
            task.priority === "high" && "bg-amber-500/30 text-amber-200 font-bold",
          )}
        >
          {task.priority}
        </span>
        {task.category && <span>· {task.category}</span>}
        {task.recurrence !== "none" && (
          <span className="flex items-center gap-0.5">
            · <Repeat className="size-3" /> {task.recurrence}
            {task.recurrence_paused && <span className="text-amber-300 font-bold">(paused)</span>}
          </span>
        )}
        {inProgress && (
          <span className="ml-auto rounded-full bg-black/30 text-[#F5F0E6] px-1.5 py-0.5 text-[10px] font-bold">
            In Progress
          </span>
        )}
      </div>

      {/* Goal Pill Link */}
      {task.goal_id && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-[#F5F0E6]">
          <Target className="size-3 text-emerald-400" />
          <span>Linked Goal</span>
        </div>
      )}

      {/* Blocked by dependency warning */}
      {isBlocked && (
        <div className="mb-2 flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/50">
          <Lock className="size-3" />
          <span>Blocked by dependency</span>
        </div>
      )}

      {/* Title */}
      <p className={cn("font-hand text-xl leading-snug text-[#F5F0E6] font-semibold", done && "line-through text-[#F5F0E6]/60")}>
        {task.title}
      </p>

      {/* Notes */}
      {task.notes && <p className="mt-1 line-clamp-3 text-sm text-[#F5F0E6]/90 font-normal">{task.notes}</p>}

      {/* Subtasks Mini Checklist */}
      {subtasks.length > 0 && (
        <div className="mt-3 space-y-1 rounded bg-black/25 p-2 text-xs text-[#F5F0E6]">
          <div className="flex items-center justify-between font-bold text-[11px] text-[#F5F0E6]">
            <span>Subtasks</span>
            <span>
              {completedSubtasks}/{subtasks.length}
            </span>
          </div>
          <div className="space-y-1">
            {subtasks.slice(0, 3).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubtask?.(task, st.id);
                }}
                className="flex w-full items-center gap-1.5 text-left text-[11px] text-[#F5F0E6] hover:opacity-100"
              >
                <div
                  className={cn(
                    "grid size-3.5 place-items-center rounded border transition-colors",
                    st.done ? "bg-emerald-600 border-emerald-600 text-white" : "border-[#F5F0E6]/40 bg-black/30",
                  )}
                >
                  {st.done && <Check className="size-2.5 stroke-[3]" />}
                </div>
                <span className={cn("truncate font-medium text-[#F5F0E6]", st.done && "line-through text-[#F5F0E6]/60")}>
                  {st.title}
                </span>
              </button>
            ))}
            {subtasks.length > 3 && (
              <p className="text-[10px] text-[#F5F0E6]/75 font-medium">+{subtasks.length - 3} more subtasks</p>
            )}
          </div>
        </div>
      )}

      {/* Footer Info & Actions */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#F5F0E6]/90 font-medium pt-2 border-t border-black/15">
        <div className="flex flex-wrap items-center gap-2">
          {task.due_date && (
            <span className="flex items-center gap-1 text-[#F5F0E6]" title="Due date">
              <CalendarDays className="size-3" />
              {task.due_date}
            </span>
          )}
          {task.start_time && (
            <span className="flex items-center gap-1 text-[#F5F0E6]" title="Start time">
              <Clock className="size-3" />
              {task.start_time.slice(0, 5)}
            </span>
          )}
          {task.actual_minutes !== undefined && task.actual_minutes > 0 && (
            <span
              className="flex items-center gap-1 font-bold text-emerald-300"
              title="Tracked focus time"
            >
              <Timer className="size-3" />
              {task.actual_minutes}m
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Focus Timer Button */}
          {onStartTimer && !done && (
            <button
              type="button"
              aria-label="Start Focus Timer"
              title="Start Focus Timer"
              onClick={(e) => {
                e.stopPropagation();
                onStartTimer(task);
              }}
              className="grid size-7 place-items-center rounded-full hover:bg-white/15 transition-all text-[#F5F0E6] cursor-pointer"
            >
              <Timer className="size-3.5" />
            </button>
          )}

          {/* Edit Note */}
          {onEdit && (
            <button
              type="button"
              aria-label="Edit task"
              title="Edit note"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="grid size-7 place-items-center rounded-full hover:bg-white/15 text-[#F5F0E6] transition-all cursor-pointer"
            >
              <Pencil className="size-3.5" />
            </button>
          )}

          {/* Reopen Action for Done tasks */}
          {done && onReopen && (
            <button
              type="button"
              aria-label="Reopen task"
              title="Reopen task"
              onClick={reopen}
              className="grid size-7 place-items-center rounded-full bg-white/15 text-[#F5F0E6] hover:bg-white/25 transition-all cursor-pointer"
            >
              <Undo2 className="size-3.5" />
            </button>
          )}

          {/* Complete Today's Session / Complete Task Checkbox */}
          {!done && onComplete && (
            <button
              type="button"
              aria-label="Complete today's session"
              title="Complete today's session"
              onClick={complete}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[#F5F0E6] border border-emerald-400/40 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Check className="size-3.5 stroke-[3]" />
              <span>Complete Session</span>
            </button>
          )}

          {done && (
            <span
              title="Completed"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600/60 text-[#F5F0E6] text-[11px] font-bold shadow-2xs"
            >
              <Check className="size-3 stroke-[3]" />
              <span>Done</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
