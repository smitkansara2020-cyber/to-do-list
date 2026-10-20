import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Undo2,
  Calendar,
  Lock,
} from "lucide-react";
import { replanDaySchedule, type ReplanResult } from "@/lib/scheduler";
import { useUpdateTask } from "@/hooks/use-data";
import { noteBg, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface ReplanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  dayStart?: string | undefined;
  dayEnd?: string | undefined;
  availabilityNotes?: string | null | undefined;
}

export function ReplanModal({
  open,
  onOpenChange,
  tasks,
  dayStart = "09:00:00",
  dayEnd = "18:00:00",
  availabilityNotes,
}: ReplanModalProps) {
  const updateTask = useUpdateTask();
  const [isApplying, setIsApplying] = useState(false);

  const planResult = useMemo<ReplanResult>(() => {
    return replanDaySchedule(tasks, dayStart, dayEnd, availabilityNotes);
  }, [tasks, dayStart, dayEnd, availabilityNotes]);

  const handleApply = async () => {
    setIsApplying(true);
    const prevSchedule = planResult.originalSchedule;

    try {
      // Apply new start times sequentially
      for (const slot of planResult.proposedSchedule) {
        await updateTask.mutateAsync({
          id: slot.taskId,
          start_time: slot.startTime,
        });
      }

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });

      toast.success("Applied optimized day schedule! 🎉", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              for (const orig of prevSchedule) {
                await updateTask.mutateAsync({
                  id: orig.id,
                  start_time: orig.startTime,
                });
              }
              toast.info("Reverted back to previous schedule.");
            } catch {
              toast.error("Failed to revert schedule.");
            }
          },
        },
      });

      onOpenChange(false);
    } catch {
      toast.error("Failed to apply schedule updates. Please retry.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Replan My Day · Intelligent Schedule Optimizer
          </DialogTitle>
          <DialogDescription>
            Optimizes your workday based on deadlines, priorities, dependencies, and available study/work hours.
            Completed tasks and fixed commitments remain strictly preserved.
          </DialogDescription>
        </DialogHeader>

        {/* Explanation Alert */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-200">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <Sparkles className="size-3.5 text-amber-500" /> Optimizer Strategy
          </p>
          <p className="opacity-90">{planResult.explanation}</p>
        </div>

        {/* Schedule Preview Timeline */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Proposed Schedule ({planResult.proposedSchedule.length} tasks)
            </h4>

            {planResult.proposedSchedule.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No active tasks to schedule for today.
              </p>
            ) : (
              <div className="space-y-2">
                {planResult.proposedSchedule.map((slot) => {
                  const origStart = slot.task.start_time?.slice(0, 5) ?? "Unscheduled";
                  const newStart = slot.startTime.slice(0, 5);
                  const isChanged = origStart !== newStart;

                  return (
                    <div
                      key={slot.taskId}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border text-ink shadow-2xs gap-3",
                        noteBg[slot.task.color] ?? "bg-card",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-hand font-bold text-base truncate">
                            {slot.task.title}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-ink/10 opacity-75">
                            {slot.task.priority}
                          </span>
                          {slot.task.dependencies && slot.task.dependencies.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-400/30 px-1.5 py-0.2 rounded">
                              <Lock className="size-2.5" /> Ordered
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] opacity-75 mt-0.5">
                          <span>Duration: {slot.durationMinutes}m</span>
                          {slot.task.due_date && <span>· Due: {slot.task.due_date}</span>}
                        </div>
                      </div>

                      {/* Time slot comparison */}
                      <div className="flex items-center gap-2 font-mono text-xs font-bold shrink-0">
                        {isChanged ? (
                          <div className="flex items-center gap-1.5 bg-background/90 text-foreground px-2.5 py-1 rounded-md border">
                            <span className="line-through text-muted-foreground opacity-60">
                              {origStart}
                            </span>
                            <ArrowRight className="size-3 text-amber-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {newStart} - {slot.endTime.slice(0, 5)}
                            </span>
                          </div>
                        ) : (
                          <div className="bg-background/80 text-foreground px-2.5 py-1 rounded-md border">
                            {newStart} - {slot.endTime.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overflow Tasks (Cannot fit today) */}
          {planResult.overflowTasks.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-destructive flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="size-3.5" />
                Tasks Exceeding Available Capacity ({planResult.overflowTasks.length})
              </h4>
              <p className="text-[11px] text-muted-foreground">
                These tasks could not fit before your day end without overloading your schedule. We
                recommend carrying them forward to tomorrow.
              </p>
              <div className="space-y-1.5 pt-1">
                {planResult.overflowTasks.map(({ task, reason }) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-background/80 border text-xs text-foreground"
                  >
                    <span className="font-medium truncate max-w-xs">{task.title}</span>
                    <span className="text-[11px] text-destructive font-mono">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying || planResult.proposedSchedule.length === 0}
            className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="size-3.5" />
            <span>{isApplying ? "Applying..." : "Apply Optimized Schedule"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
