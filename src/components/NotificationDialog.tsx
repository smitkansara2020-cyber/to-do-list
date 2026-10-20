import { useState } from "react";
import { Bell, Mail, X, CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTasks, useGoals } from "@/hooks/use-data";
import { toISODate } from "@/lib/tasks";

export function NotificationDialog({
  open,
  onOpenChange,
  type = "notifications",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: "notifications" | "messages";
}) {
  const { data: tasks = [] } = useTasks();
  const { data: goalsData } = useGoals();
  const goals = goalsData?.goals ?? [];
  const todayStr = toISODate(new Date());

  const pendingDue = tasks.filter(
    (t) =>
      t.status !== "done" &&
      !t.is_archived &&
      ((t.due_date && t.due_date.slice(0, 10) < todayStr) ||
        (t.scheduled_date && t.scheduled_date < todayStr)),
  );

  const todayTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      !t.is_archived &&
      (t.scheduled_date === todayStr || (t.due_date && t.due_date.slice(0, 10) === todayStr)),
  );

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {type === "notifications" ? <Bell className="size-4" /> : <Mail className="size-4" />}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {type === "notifications" ? "Notifications & Alerts" : "Mails & Daily Digest"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {type === "notifications"
                      ? `${pendingDue.length} past due, ${todayTasks.length} active today`
                      : "Daily reflection & schedule updates"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto [scrollbar-width:thin]">
              {type === "notifications" ? (
                <>
                  {pendingDue.length > 0 && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                        <AlertCircle className="size-3.5" />
                        <span>{pendingDue.length} Tasks are Past Due</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Consider using "Roll Today" in the Due Pending column to reschedule.
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Clock className="size-3.5 text-amber-500" />
                      <span>{todayTasks.length} Tasks Scheduled for Today</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Ready on your Today's List sticky notes.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span>Monthly Goals Check-in Active</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {goals.length} active monthly habits and milestones tracked.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Morning Briefing</span>
                    <span className="text-[10px] text-muted-foreground">Today</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Welcome to your Pinboard workspace! Your sticky notes, focus timer, and monthly goals are synchronized. Click "✨ Spark AI" anytime for guided day planning.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex justify-end">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-xl bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
