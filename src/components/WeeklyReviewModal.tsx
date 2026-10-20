import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Award,
  CheckCircle2,
  Flame,
  Timer,
  Target,
  AlertCircle,
  Lightbulb,
  BookOpen,
  Calendar,
  Save,
} from "lucide-react";
import { useTasks, useGoals, useAllTasks } from "@/hooks/use-data";
import { streak, toISODate, type Task } from "@/lib/tasks";
import { FocusAnalytics } from "@/lib/focus-analytics";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface WeeklyReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklyReviewModal({ open, onOpenChange }: WeeklyReviewModalProps) {
  const { data: allTasks = [] } = useAllTasks();
  const { data: goalsData } = useGoals();
  const goals = goalsData?.goals ?? [];

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toISODate(today), [today]);

  // Seven days window
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  }, [today]);

  const completedLast7Days = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.status !== "done" || !t.completed_at) return false;
      const compDate = toISODate(new Date(t.completed_at));
      return compDate >= sevenDaysAgo && compDate <= todayStr;
    });
  }, [allTasks, sevenDaysAgo, todayStr]);

  const missedLast7Days = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.status === "done") return false;
      const date = t.scheduled_date || (t.due_date ? t.due_date.slice(0, 10) : null);
      return date && date >= sevenDaysAgo && date < todayStr;
    });
  }, [allTasks, sevenDaysAgo, todayStr]);

  // Total focused minutes
  const totalFocusMinutes = useMemo(() => {
    const fromTasks = completedLast7Days.reduce(
      (acc, t) => acc + (t.actual_minutes || t.duration_minutes || 0),
      0,
    );
    return fromTasks;
  }, [completedLast7Days]);

  // Current Streak
  const currentStreak = useMemo(() => {
    const dates = allTasks
      .filter((t) => t.status === "done" && t.completed_at)
      .map((t) => toISODate(new Date(t.completed_at!)));
    return streak(dates, today);
  }, [allTasks, today]);

  // Category breakdown for suggestions
  const categoryStats = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of allTasks) {
      const cat = t.category || "General";
      const cur = map.get(cat) || { done: 0, total: 0 };
      cur.total++;
      if (t.status === "done") cur.done++;
      map.set(cat, cur);
    }
    return Array.from(map.entries()).map(([cat, stats]) => ({
      category: cat,
      done: stats.done,
      total: stats.total,
      rate: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
    }));
  }, [allTasks]);

  // Suggestions based on recorded stats
  const suggestion = useMemo(() => {
    const lowRateCat = categoryStats.find((c) => c.total >= 3 && c.rate < 50);
    if (lowRateCat) {
      return `Tasks under "${lowRateCat.category}" have a ${lowRateCat.rate}% completion rate. Try breaking them into smaller 25-minute subtasks next week.`;
    }
    if (missedLast7Days.length > 3) {
      return `You had ${missedLast7Days.length} missed deadlines this week. Consider reducing your daily planned hours or using "Replan My Day" earlier in the morning.`;
    }
    return `Great consistency! You maintained an active streak of ${currentStreak} days with ${completedLast7Days.length} tasks completed this week.`;
  }, [categoryStats, missedLast7Days, currentStreak, completedLast7Days]);

  // Daily Evening Reflection State (Private storage)
  const reflectionKey = `pinboard_reflection_${todayStr}`;
  const [reflectionWin, setReflectionWin] = useState(() => {
    return localStorage.getItem(`${reflectionKey}_win`) || "";
  });
  const [reflectionBlock, setReflectionBlock] = useState(() => {
    return localStorage.getItem(`${reflectionKey}_block`) || "";
  });
  const [reflectionPriority, setReflectionPriority] = useState(() => {
    return localStorage.getItem(`${reflectionKey}_priority`) || "";
  });

  const handleSaveReflection = () => {
    try {
      localStorage.setItem(`${reflectionKey}_win`, reflectionWin);
      localStorage.setItem(`${reflectionKey}_block`, reflectionBlock);
      localStorage.setItem(`${reflectionKey}_priority`, reflectionPriority);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      toast.success("Evening reflection saved privately!");
    } catch {
      toast.error("Could not save reflection locally.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Award className="size-5 text-amber-500" />
            Weekly Review & Evening Reflection
          </DialogTitle>
          <DialogDescription>
            A factual summary of your productivity across the past 7 days with private journaling.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Factual Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border p-3 bg-card/60 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Completed
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {completedLast7Days.length}
              </div>
              <span className="text-[10px] text-muted-foreground">past 7 days</span>
            </div>

            <div className="rounded-xl border p-3 bg-card/60 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Focus Time
              </span>
              <div className="text-2xl font-black text-amber-500">
                {(totalFocusMinutes / 60).toFixed(1)}h
              </div>
              <span className="text-[10px] text-muted-foreground">{totalFocusMinutes} mins total</span>
            </div>

            <div className="rounded-xl border p-3 bg-card/60 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Active Streak
              </span>
              <div className="text-2xl font-black text-orange-500 flex items-center justify-center gap-1">
                <Flame className="size-5 fill-orange-500" />
                <span>{currentStreak}d</span>
              </div>
              <span className="text-[10px] text-muted-foreground">consecutive</span>
            </div>

            <div className="rounded-xl border p-3 bg-card/60 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Missed / Overdue
              </span>
              <div
                className={`text-2xl font-black ${
                  missedLast7Days.length > 0 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {missedLast7Days.length}
              </div>
              <span className="text-[10px] text-muted-foreground">uncompleted</span>
            </div>
          </div>

          {/* Factual AI Observation / Next-Week Suggestion */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-200">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <Lightbulb className="size-3.5 text-amber-500" /> Next Week Insight & Strategy
            </p>
            <p className="opacity-90">{suggestion}</p>
          </div>

          {/* Private Evening Reflection Journal */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <BookOpen className="size-3.5 text-purple-500" />
                Private Evening Reflection ({todayStr})
              </h4>
              <span className="text-[10px] text-muted-foreground">Stored only on this device</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  1. What was your biggest achievement or win today?
                </label>
                <Textarea
                  value={reflectionWin}
                  onChange={(e) => setReflectionWin(e.target.value)}
                  placeholder="e.g. Completed Chapter 4, stayed focused for 3 hours straight..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  2. What caused friction or distraction?
                </label>
                <Textarea
                  value={reflectionBlock}
                  onChange={(e) => setReflectionBlock(e.target.value)}
                  placeholder="e.g. Unscheduled meeting at 2 PM, phone notifications..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  3. Tomorrow's #1 priority
                </label>
                <Textarea
                  value={reflectionPriority}
                  onChange={(e) => setReflectionPriority(e.target.value)}
                  placeholder="e.g. Submit assignment draft before noon..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleSaveReflection}
                className="text-xs gap-1.5 h-8 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold cursor-pointer"
              >
                <Save className="size-3.5" /> Save Reflection
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
