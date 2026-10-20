import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { generateExamPlan, type ExamPlanResult } from "@/lib/exam-planner";
import { useSaveTask } from "@/hooks/use-data";
import { toISODate, noteBg } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface ExamPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExamPlannerModal({ open, onOpenChange }: ExamPlannerModalProps) {
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toISODate(d);
  });
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [dailyHours, setDailyHours] = useState("2.5");
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([
    "Key Definitions & Terminology",
    "High-Yield Core Concepts",
    "Practice Problem Set 1",
  ]);
  const [isApplying, setIsApplying] = useState(false);

  const saveTask = useSaveTask();

  const handleAddTopic = () => {
    if (!topicInput.trim()) return;
    setTopics((prev) => [...prev, topicInput.trim()]);
    setTopicInput("");
  };

  const handleRemoveTopic = (idx: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== idx));
  };

  const planResult = useMemo<ExamPlanResult>(() => {
    if (!subject.trim() || !examDate) {
      return {
        isFeasible: true,
        daysRemaining: 7,
        totalRequiredHours: 0,
        totalAvailableHours: 0,
        sessions: [],
      };
    }
    return generateExamPlan({
      subject: subject.trim(),
      examDate,
      topics,
      difficulty,
      availableDailyHours: parseFloat(dailyHours) || 2.0,
    });
  }, [subject, examDate, topics, difficulty, dailyHours]);

  const handleApplyPlan = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject name");
      return;
    }
    if (planResult.sessions.length === 0) {
      toast.error("No study sessions generated. Please add topics.");
      return;
    }

    setIsApplying(true);
    try {
      for (const session of planResult.sessions) {
        await saveTask.mutateAsync({
          title: session.title,
          scheduled_date: session.scheduledDate,
          duration_minutes: session.durationMinutes,
          category: session.category,
          color: session.color,
          priority: session.priority,
          status: "todo",
          recurrence: "none",
          meta: {
            subtasks: session.subtasks.map((st) => ({
              id: Math.random().toString(36).slice(2, 8),
              title: st.title,
              done: false,
            })),
          },
        });
      }

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success(
        `Added ${planResult.sessions.length} exam revision sessions to your whiteboard! 🎓`,
      );
      onOpenChange(false);
    } catch {
      toast.error("Failed to add revision plan to whiteboard.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <GraduationCap className="size-5 text-amber-500" />
            Student Exam Revision Planner
          </DialogTitle>
          <DialogDescription>
            Input your exam date and topics. We'll balance your study workload with spaced active
            recall, practice sets, and timed mock tests.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Subject / Course Name</Label>
              <Input
                placeholder="e.g. Organic Chemistry, Calculus II"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Exam Date</Label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Perceived Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="easy">Easy (1.5h per topic)</option>
                <option value="medium">Medium (2.5h per topic)</option>
                <option value="hard">Hard 🔥 (3.5h per topic)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Available Daily Study Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Topics List */}
          <div className="rounded-xl border border-border/70 p-3 bg-card/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="font-semibold flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-sky-600" />
                <span>Exam Topics ({topics.length})</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">Topics will be spaced out</span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Add topic (e.g. Thermodynamics, Reaction Mechanisms)..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                className="h-8 text-xs bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddTopic}
                className="h-8 text-xs shrink-0"
              >
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {topics.map((top, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                >
                  <span>{top}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(idx)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Feasibility Alert */}
          {planResult.warning && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>{planResult.warning}</p>
            </div>
          )}

          {/* Generated Sessions Preview */}
          {planResult.sessions.length > 0 && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Generated Revision Schedule ({planResult.sessions.length} sessions ·{" "}
                {planResult.totalRequiredHours.toFixed(1)}h total)
              </h4>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {planResult.sessions.map((sess, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border text-ink shadow-2xs gap-2 text-xs",
                      noteBg[sess.color] ?? "bg-card",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-hand font-bold text-sm block truncate">
                        {sess.title}
                      </span>
                      <span className="text-[10px] opacity-75">
                        {sess.subtasks.length} subtask steps included
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 rounded bg-ink/10 px-2 py-0.5 text-[11px] font-medium">
                        <Calendar className="size-3" /> {sess.scheduledDate}
                      </span>
                      <span className="font-mono text-[11px] opacity-80">
                        {sess.durationMinutes}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={!subject.trim() || planResult.sessions.length === 0 || isApplying}
            onClick={handleApplyPlan}
            className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold cursor-pointer shadow-sm"
          >
            <Sparkles className="size-3.5" />
            <span>
              {isApplying ? "Generating..." : `Add ${planResult.sessions.length} Sessions to Board`}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
