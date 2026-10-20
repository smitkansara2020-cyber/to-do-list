import { useState } from "react";
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
  BookOpen,
  GraduationCap,
  Dumbbell,
  Rocket,
  Check,
  Plus,
  Clock,
  CheckSquare,
} from "lucide-react";
import { BUILT_IN_TEMPLATES, type TaskTemplate } from "@/lib/templates";
import { useSaveTask } from "@/hooks/use-data";
import { noteBg } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface TemplatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate?: (template: TaskTemplate) => void;
}

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  assignment: BookOpen,
  exam_revision: GraduationCap,
  gym_session: Dumbbell,
  project_release: Rocket,
};

export function TemplatePickerModal({ open, onOpenChange }: TemplatePickerModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate>(BUILT_IN_TEMPLATES[0]!);
  const [customTitle, setCustomTitle] = useState("");
  const saveTask = useSaveTask();

  const Icon = TEMPLATE_ICONS[selectedTemplate.id] ?? BookOpen;

  const handleApply = async () => {
    const title = customTitle.trim() || selectedTemplate.name;
    try {
      await saveTask.mutateAsync({
        title,
        color: selectedTemplate.color,
        priority: selectedTemplate.priority,
        category: selectedTemplate.category,
        duration_minutes: selectedTemplate.defaultDurationMinutes,
        status: "todo",
        recurrence: "none",
        meta: {
          subtasks: selectedTemplate.subtasks.map((st) => ({
            id: Math.random().toString(36).slice(2, 8),
            title: st.title,
            done: false,
          })),
        },
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      toast.success(`Created "${title}" from template! 📌`);
      setCustomTitle("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create task from template.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Rocket className="size-5 text-amber-500" />
            Task Workflow Templates
          </DialogTitle>
          <DialogDescription>
            Choose a battle-tested workflow template pre-configured with checklists, priority, and
            focused time estimates.
          </DialogDescription>
        </DialogHeader>

        {/* Template Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {BUILT_IN_TEMPLATES.map((tmpl) => {
            const TmplIcon = TEMPLATE_ICONS[tmpl.id] ?? BookOpen;
            const isSelected = selectedTemplate.id === tmpl.id;

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplate(tmpl);
                  setCustomTitle("");
                }}
                className={cn(
                  "flex flex-col items-center text-center p-3 rounded-xl border transition-all cursor-pointer",
                  isSelected
                    ? "border-amber-500 bg-amber-500/15 text-foreground ring-1 ring-amber-500 shadow-xs"
                    : "border-border/70 hover:bg-accent text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "grid size-9 place-items-center rounded-lg mb-2 shadow-2xs",
                    noteBg[tmpl.color] ?? "bg-card",
                    "text-ink",
                  )}
                >
                  <TmplIcon className="size-4.5" />
                </div>
                <span className="text-xs font-bold leading-tight text-foreground truncate w-full">
                  {tmpl.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                  {tmpl.defaultDurationMinutes} mins
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview of Selected Template */}
        <div
          className={cn(
            "rounded-xl border p-4 text-ink shadow-sm space-y-3 mt-2",
            noteBg[selectedTemplate.color] ?? "bg-card",
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-ink/15 text-xs">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-ink" />
              <span className="font-bold">{selectedTemplate.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-ink/10">
                {selectedTemplate.priority}
              </span>
              <span className="font-medium text-[11px] opacity-80">
                ⏱️ {selectedTemplate.defaultDurationMinutes}m
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold opacity-60 block mb-1">
              Customize Task Title
            </label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={`e.g. ${selectedTemplate.name}`}
              className="font-hand text-xl font-bold border-0 bg-ink/5 text-ink placeholder:text-ink/50 h-9 px-2 shadow-none focus-visible:ring-1 focus-visible:ring-ink/30"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold opacity-60 block mb-1.5 flex items-center gap-1">
              <CheckSquare className="size-3" /> Included Checklist Steps (
              {selectedTemplate.subtasks.length})
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {selectedTemplate.subtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-ink/5 rounded-md px-2.5 py-1.5"
                >
                  <div className="size-3.5 rounded border border-ink/40 grid place-items-center">
                    <Check className="size-2 text-transparent" />
                  </div>
                  <span className="text-[11px] opacity-90">{st.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
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
            disabled={saveTask.isPending}
            className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold cursor-pointer shadow-sm"
          >
            <Plus className="size-3.5" />
            <span>{saveTask.isPending ? "Creating..." : "Apply & Add to Board"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
