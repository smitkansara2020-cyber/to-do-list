import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NOTE_COLORS, noteBg, type SubTask, type Task } from "@/lib/tasks";
import { useDeleteTask, useSaveTask, useAllTasks } from "@/hooks/use-data";
import { wouldCreateDependencyCycle } from "@/lib/templates";
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Clock,
  Calendar,
  Repeat,
  Link2,
  GitFork,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Form = {
  title: string;
  notes: string;
  priority: string;
  color: string;
  category: string;
  due_date?: string | undefined;
  scheduled_date?: string | undefined;
  start_time?: string | undefined;
  duration_minutes?: string | undefined;
  recurrence?: string | undefined;
  status?: string | undefined;
  goal_id?: string | undefined;
  dependencies?: string[] | undefined;
  recurrence_paused?: boolean | undefined;
  selected_weekdays?: number[] | undefined;
  rest_days?: number[] | undefined;
};

const empty = (defaults?: Partial<Form>): Form => ({
  title: "",
  notes: "",
  priority: "medium",
  color: "yellow",
  category: "",
  due_date: "",
  scheduled_date: "",
  start_time: "",
  duration_minutes: "30",
  recurrence: "none",
  status: "todo",
  goal_id: "",
  dependencies: [],
  recurrence_paused: false,
  selected_weekdays: [],
  rest_days: [],
  ...defaults,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const WEEKDAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null | undefined;
  defaults?: Partial<Form> | undefined;
}) {
  const [f, setF] = useState<Form>(empty(defaults));
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [links, setLinks] = useState<{ title: string; url: string }[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const { data: allTasks = [] } = useAllTasks();
  const save = useSaveTask();
  const del = useDeleteTask();

  useEffect(() => {
    if (!open) return;
    setF(
      task
        ? {
            title: task.title,
            notes: task.notes ?? "",
            priority: task.priority,
            color: task.color,
            category: task.category ?? "",
            due_date: task.due_date ?? "",
            scheduled_date: task.scheduled_date ?? "",
            start_time: task.start_time ?? "",
            duration_minutes: task.duration_minutes ? String(task.duration_minutes) : "30",
            recurrence: task.recurrence ?? "none",
            status: task.status ?? "todo",
            goal_id: task.goal_id ?? "",
            dependencies: task.dependencies ?? [],
            recurrence_paused: task.recurrence_paused ?? false,
            selected_weekdays: task.selected_weekdays ?? [],
            rest_days: task.rest_days ?? [],
          }
        : empty(defaults),
    );
    setSubtasks(task?.subtasks ?? []);
    setLinks(task?.links ?? []);
    setNewSubtaskTitle("");
    setNewLinkTitle("");
    setNewLinkUrl("");
  }, [open, task, defaults]);

  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 8),
        title: newSubtaskTitle.trim(),
        done: false,
      },
    ]);
    setNewSubtaskTitle("");
  }

  function toggleSubtask(id: string) {
    setSubtasks((prev) => prev.map((st) => (st.id === id ? { ...st, done: !st.done } : st)));
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
  }

  function addLink() {
    if (!newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const title =
      newLinkTitle.trim() ||
      url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ||
      "Reference Link";
    setLinks((prev) => [...prev, { title, url }]);
    setNewLinkTitle("");
    setNewLinkUrl("");
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleWeekday(dayId: number) {
    setF((prev) => {
      const current = prev.selected_weekdays ?? [];
      const next = current.includes(dayId) ? current.filter((d) => d !== dayId) : [...current, dayId];
      return { ...prev, selected_weekdays: next };
    });
  }

  function toggleDependency(depId: string) {
    if (task && wouldCreateDependencyCycle(allTasks, task.id, depId)) {
      toast.error("Cannot add dependency: would create a circular dependency loop! 🔄");
      return;
    }
    setF((prev) => {
      const current = prev.dependencies ?? [];
      const next = current.includes(depId) ? current.filter((d) => d !== depId) : [...current, depId];
      return { ...prev, dependencies: next };
    });
  }

  const eligibleDependencies = useMemo(() => {
    return allTasks.filter((t) => t.id !== task?.id && t.status !== "done");
  }, [allTasks, task]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;

    await save.mutateAsync({
      ...(task ? { id: task.id } : {}),
      title: f.title.trim(),
      notes: f.notes || null,
      priority: f.priority,
      color: f.color,
      category: f.category || null,
      due_date: f.due_date || null,
      scheduled_date: f.scheduled_date || null,
      start_time: f.start_time || null,
      duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
      recurrence: f.recurrence || "none",
      status: f.status || "todo",
      meta: {
        goal_id: f.goal_id || null,
        subtasks,
        dependencies: f.dependencies ?? [],
        recurrence_paused: f.recurrence_paused ?? false,
        selected_weekdays: f.selected_weekdays ?? [],
        rest_days: f.rest_days ?? [],
        links,
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {task ? "Edit sticky note" : "New sticky note"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {/* Note Pad */}
          <div className={cn("rounded-sm p-3.5 shadow-note", noteBg[f.color])}>
            <Input
              autoFocus
              required
              placeholder="What needs doing?"
              value={f.title}
              onChange={set("title")}
              className="border-0 bg-transparent font-hand text-xl shadow-none focus-visible:ring-0 text-ink placeholder:text-ink/60"
            />
            <Textarea
              placeholder="Add details, notes, or thoughts..."
              value={f.notes}
              onChange={set("notes")}
              className="min-h-16 border-0 bg-transparent shadow-none focus-visible:ring-0 text-ink/90 placeholder:text-ink/60 text-sm"
            />
          </div>

          {/* Color Palette Selector */}
          <div className="flex gap-2">
            {NOTE_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={c}
                onClick={() => setF((p) => ({ ...p, color: c }))}
                className={cn(
                  "size-8 rounded-md shadow-note transition-transform cursor-pointer",
                  noteBg[c],
                  f.color === c && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-background",
                )}
              />
            ))}
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <select className={sel} value={f.priority} onChange={set("priority")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent 🔥</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Input
                value={f.category}
                onChange={set("category")}
                placeholder="e.g. Work, Health, Personal…"
              />
            </div>
          </div>

          {/* Schedule & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Calendar className="size-3.5 text-muted-foreground" /> Scheduled Date
              </Label>
              <Input
                type="date"
                value={f.scheduled_date ?? ""}
                onChange={set("scheduled_date")}
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Clock className="size-3.5 text-muted-foreground" /> Start Time
              </Label>
              <Input
                type="time"
                value={f.start_time ?? ""}
                onChange={set("start_time")}
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Clock className="size-3.5 text-muted-foreground" /> Duration (mins)
              </Label>
              <Input
                type="number"
                min="5"
                max="480"
                step="5"
                value={f.duration_minutes ?? "30"}
                onChange={set("duration_minutes")}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Recurrence Options */}
          <div className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Repeat className="size-3.5 text-indigo-500" /> Recurrence & Habits
              </Label>
              {f.recurrence !== "none" && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.recurrence_paused ?? false}
                    onChange={(e) => setF((p) => ({ ...p, recurrence_paused: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Pause recurrence</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <select className={sel} value={f.recurrence} onChange={set("recurrence")}>
                  <option value="none">Does not repeat</option>
                  <option value="daily">Repeats Daily</option>
                  <option value="weekly">Repeats Weekly</option>
                  <option value="monthly">Repeats Monthly</option>
                </select>
              </div>

              {f.recurrence !== "none" && (
                <div className="flex flex-wrap items-center gap-1">
                  {WEEKDAYS.map((w) => {
                    const isSelected = f.selected_weekdays?.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWeekday(w.id)}
                        className={cn(
                          "px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Task Dependencies */}
          {eligibleDependencies.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label className="flex items-center gap-1.5 font-semibold">
                  <GitFork className="size-3.5 text-amber-500" /> Blocked By (Dependencies)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Task unlocks when blockers are done
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {eligibleDependencies.map((dep) => {
                  const isBlockedBy = f.dependencies?.includes(dep.id);
                  return (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() => toggleDependency(dep.id)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs border transition-colors flex items-center gap-1 cursor-pointer",
                        isBlockedBy
                          ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-medium"
                          : "border-border/60 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="truncate max-w-[140px]">{dep.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference Links & Attachments */}
          <div className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="flex items-center gap-1.5 font-semibold">
                <Link2 className="size-3.5 text-sky-500" /> Reference Links & Docs ({links.length})
              </Label>
              <span className="text-[11px] text-muted-foreground">GitHub, Figma, Docs, etc.</span>
            </div>

            {links.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {links.map((lnk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded bg-background/80 px-2.5 py-1 text-xs border border-border/50"
                  >
                    <a
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sky-600 hover:underline truncate"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{lnk.title}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Title (optional)"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                className="h-8 text-xs bg-background flex-1"
              />
              <Input
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
                className="h-8 text-xs bg-background flex-2"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addLink}
                className="h-8 px-2 text-xs"
              >
                <Plus className="size-3 mr-0.5" /> Link
              </Button>
            </div>
          </div>

          {/* Checklist / Subtasks */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckSquare className="size-3.5 text-emerald-600" />
                <span>
                  Checklist / Subtasks ({subtasks.filter((s) => s.done).length}/{subtasks.length})
                </span>
              </Label>
              <span className="text-[11px] text-muted-foreground">Break into small steps</span>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-1.5 text-xs border border-border/50"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtask(st.id)}
                      className="flex items-center gap-2 text-left flex-1"
                    >
                      {st.done ? (
                        <CheckSquare className="size-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={cn(st.done && "line-through opacity-60 text-muted-foreground")}
                      >
                        {st.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSubtask(st.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                placeholder="Add subtask step..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                className="h-8 text-xs bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addSubtask}
                className="h-8 px-2 text-xs"
              >
                <Plus className="size-3 mr-1" /> Add
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            {task && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  await del.mutateAsync(task.id);
                  onOpenChange(false);
                }}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
