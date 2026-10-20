import { useState } from "react";
import {
  Clock,
  Coffee,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateWorkload, type WorkloadSummary } from "@/lib/scheduler";
import { fmtTime, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface WorkloadMeterProps {
  tasks: Task[];
  dayStart?: string | undefined;
  dayEnd?: string | undefined;
  availabilityNotes?: string | null | undefined;
  onOpenReplan?: (() => void) | undefined;
  className?: string | undefined;
}

export function WorkloadMeter({
  tasks,
  dayStart = "09:00:00",
  dayEnd = "18:00:00",
  availabilityNotes,
  onOpenReplan,
  className,
}: WorkloadMeterProps) {
  const workload = calculateWorkload(tasks, dayStart, dayEnd, availabilityNotes);

  const plannedHours = (workload.plannedMinutes / 60).toFixed(1);
  const availableHours = (workload.effectiveAvailableMinutes / 60).toFixed(1);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm backdrop-blur-xs transition-all",
        workload.status === "overloaded"
          ? "border-destructive/40 bg-destructive/5 text-destructive-foreground"
          : workload.status === "heavy"
            ? "border-amber-500/40 bg-amber-500/5 text-foreground"
            : "border-border/70 bg-card/60 text-foreground",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg shadow-2xs",
              workload.status === "overloaded"
                ? "bg-destructive text-destructive-foreground"
                : workload.status === "heavy"
                  ? "bg-amber-500 text-zinc-950"
                  : "bg-emerald-600 text-white",
            )}
          >
            <CalendarClock className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5 leading-none">
              Daily Workload & Capacity
              {workload.status === "overloaded" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/20 text-destructive px-2 py-0.5 text-[10px] font-bold">
                  <AlertTriangle className="size-3" /> Overbooked +{workload.overloadMinutes}m
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Available: {fmtTime(workload.dayStartMinutes)} – {fmtTime(workload.dayEndMinutes)}
              {workload.breakMinutes > 0 && ` (${workload.breakMinutes}m breaks deducted)`}
            </p>
          </div>
        </div>

        {onOpenReplan && (
          <Button
            size="sm"
            onClick={onOpenReplan}
            className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold shadow-xs cursor-pointer"
          >
            <Sparkles className="size-3.5" /> Replan My Day
          </Button>
        )}
      </div>

      {/* Progress Track */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">
            Planned: <strong className="text-foreground">{plannedHours}h</strong> /{" "}
            {availableHours}h
          </span>
          <span
            className={cn(
              "font-bold font-mono",
              workload.status === "overloaded"
                ? "text-destructive"
                : workload.status === "heavy"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {workload.capacityPercentage}%
          </span>
        </div>

        <div className="relative h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              workload.status === "overloaded"
                ? "bg-destructive"
                : workload.status === "heavy"
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500",
            )}
            style={{ width: `${Math.min(workload.capacityPercentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
