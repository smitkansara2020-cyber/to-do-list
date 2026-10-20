import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Calendar,
  Clock,
  Timer,
  Tag,
  AlertTriangle,
  ArrowRight,
  Check,
  Inbox,
  Lightbulb,
} from "lucide-react";
import { parseNaturalLanguageTask, type ParsedTaskResult } from "@/lib/nlp-parser";
import { useSaveTask } from "@/hooks/use-data";
import { NOTE_COLORS, noteBg } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInput?: string;
}

export function QuickCaptureModal({
  open,
  onOpenChange,
  defaultInput = "",
}: QuickCaptureModalProps) {
  const [input, setInput] = useState(defaultInput);
  const save = useSaveTask();

  useEffect(() => {
    if (open) {
      setInput(defaultInput);
    }
  }, [open, defaultInput]);

  const parsed = useMemo<ParsedTaskResult>(() => {
    if (!input.trim()) {
      return {
        title: "",
        rawInput: "",
        scheduled_date: null,
        start_time: null,
        duration_minutes: null,
        priority: "medium",
        category: "Inbox",
        color: "yellow",
        confidence: 0,
        tokensFound: {},
      };
    }
    return parseNaturalLanguageTask(input);
  }, [input]);

  const [editableTitle, setEditableTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState("yellow");

  useEffect(() => {
    if (parsed.title) {
      setEditableTitle(parsed.title);
      setSelectedColor(parsed.color);
    }
  }, [parsed]);

  const handleSave = async (asInboxOnly = false) => {
    const finalTitle = editableTitle.trim() || input.trim();
    if (!finalTitle) {
      toast.error("Please enter a task or thought title");
      return;
    }

    try {
      await save.mutateAsync({
        title: finalTitle,
        notes: asInboxOnly ? input.trim() : null,
        color: selectedColor,
        priority: asInboxOnly ? "low" : parsed.priority,
        category: asInboxOnly ? "Inbox" : parsed.category,
        scheduled_date: asInboxOnly ? null : parsed.scheduled_date,
        start_time: asInboxOnly ? null : parsed.start_time,
        duration_minutes: asInboxOnly ? null : parsed.duration_minutes,
        status: "todo",
        recurrence: "none",
        meta: {
          subtasks: [],
        },
      });

      toast.success(
        asInboxOnly
          ? "Saved thought to Inbox! 💡"
          : `Created "${finalTitle}" on your board! 📌`,
      );
      setInput("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save task. Please retry.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Quick Capture & Natural Language Parser
          </DialogTitle>
          <DialogDescription>
            Type freely to capture ideas instantly or schedule full tasks. Our AI parser extracts
            dates, times, durations, and priorities automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Main Input Box */}
          <div className="relative">
            <textarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 'Revise Java tomorrow at 7 PM for 45 minutes #study urgent' or capture any quick thought..."
              rows={3}
              className="w-full rounded-xl border border-input bg-card p-3.5 text-sm shadow-2xs focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none transition-all resize-none placeholder:text-muted-foreground/70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/60">
              Press Ctrl+Enter to save
            </span>
          </div>

          {/* Real-time Parsed Preview */}
          {input.trim() && (
            <div
              className={cn(
                "rounded-xl border p-4 shadow-sm transition-all text-ink",
                noteBg[selectedColor] ?? "bg-card",
              )}
            >
              <div className="flex items-center justify-between text-xs pb-2 border-b border-ink/15 mb-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] opacity-75">
                  Parsed Task Preview
                </span>
                <span className="text-[11px] font-medium opacity-80">
                  Confidence: {Math.round(parsed.confidence * 100)}%
                </span>
              </div>

              {/* Editable Title */}
              <div className="mb-2.5">
                <label className="text-[10px] uppercase font-bold opacity-60 block mb-0.5">
                  Task Title
                </label>
                <Input
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  className="font-hand text-xl font-bold border-0 bg-ink/5 text-ink placeholder:text-ink/50 h-9 px-2 shadow-none focus-visible:ring-1 focus-visible:ring-ink/30"
                  placeholder="Task title..."
                />
              </div>

              {/* Extracted Token Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {parsed.scheduled_date ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-ink/10 font-medium">
                    <Calendar className="size-3 text-sky-700" />
                    <span>{parsed.scheduled_date}</span>
                  </span>
                ) : (
                  <span className="text-[11px] opacity-60 italic">No date specified</span>
                )}

                {parsed.start_time && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-ink/10 font-medium">
                    <Clock className="size-3 text-amber-700" />
                    <span>{parsed.start_time.slice(0, 5)}</span>
                  </span>
                )}

                {parsed.duration_minutes && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-ink/10 font-medium">
                    <Timer className="size-3 text-emerald-700" />
                    <span>{parsed.duration_minutes}m</span>
                  </span>
                )}

                {parsed.priority && parsed.priority !== "medium" && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold uppercase text-[10px]",
                      parsed.priority === "urgent"
                        ? "bg-rose-500/20 text-rose-900"
                        : "bg-amber-500/20 text-amber-900",
                    )}
                  >
                    {parsed.priority}
                  </span>
                )}

                {parsed.category && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-ink/10 font-medium text-[11px]">
                    <Tag className="size-3 text-purple-700" />
                    <span>{parsed.category}</span>
                  </span>
                )}
              </div>

              {/* Ambiguity notice */}
              {parsed.ambiguityWarning && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-950 bg-amber-400/40 p-2 rounded-lg font-medium">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>{parsed.ambiguityWarning}</span>
                </div>
              )}

              {/* Color choices */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-ink/15">
                <span className="text-[10px] uppercase font-bold opacity-60 mr-1">Color:</span>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "size-5 rounded-full border border-ink/20 shadow-2xs transition-transform cursor-pointer",
                      noteBg[c],
                      selectedColor === c && "ring-2 ring-ink scale-110",
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quick example inspirations */}
          {!input.trim() && (
            <div className="rounded-xl border border-dashed border-border/80 p-3.5 bg-muted/20 text-xs space-y-1.5">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-amber-500" />
                Try typing:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground/80">
                <button
                  type="button"
                  onClick={() => setInput("Revise Java tomorrow at 7 PM for 45 minutes #study")}
                  className="text-left p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  "Revise Java tomorrow at 7 PM for 45m"
                </button>
                <button
                  type="button"
                  onClick={() => setInput("Team sync on Friday 10:30am for 1 hour #work")}
                  className="text-left p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  "Team sync on Friday 10:30am 1 hour"
                </button>
                <button
                  type="button"
                  onClick={() => setInput("Buy groceries today 5pm urgent")}
                  className="text-left p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  "Buy groceries today 5pm urgent"
                </button>
                <button
                  type="button"
                  onClick={() => setInput("Refactor auth state machine someday")}
                  className="text-left p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  "Refactor auth state machine someday"
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              disabled={!input.trim() || save.isPending}
              onClick={() => handleSave(true)}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Save directly into inbox thoughts without dates or mandatory planning"
            >
              <Inbox className="size-3.5" /> Save as Thought Inbox
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!input.trim() || save.isPending}
                onClick={() => handleSave(false)}
                className="text-xs h-8 gap-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold cursor-pointer shadow-sm"
              >
                <Check className="size-3.5" />
                <span>{save.isPending ? "Creating..." : "Add to Board"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
