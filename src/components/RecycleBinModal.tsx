import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import {
  useRecycleBinTasks,
  useRestoreTask,
  useReopenTask,
  useDeleteTask,
  useEmptyRecycleBin,
} from "@/hooks/use-data";
import { noteBg, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface RecycleBinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecycleBinModal({ open, onOpenChange }: RecycleBinModalProps) {
  const { data: binTasks = [] } = useRecycleBinTasks();
  const restoreTask = useRestoreTask();
  const reopenTask = useReopenTask();
  const deleteTask = useDeleteTask();
  const emptyRecycleBin = useEmptyRecycleBin();

  const [activeTab, setActiveTab] = useState<"trash" | "archive">("trash");
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const trashedTasks = binTasks.filter((t) => Boolean(t.deleted_at));
  const archivedTasks = binTasks.filter((t) => t.is_archived && !t.deleted_at);

  const currentList = activeTab === "trash" ? trashedTasks : archivedTasks;

  const handleEmptyAll = async () => {
    const ids = trashedTasks.map((t) => t.id);
    await emptyRecycleBin.mutateAsync(ids);
    setConfirmEmpty(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <RotateCcw className="size-5 text-amber-500" />
              Recycle Bin & Safe Archive
            </DialogTitle>
          </div>
          <DialogDescription>
            Recover deleted or archived tasks. Yesterday's daily cleanups and deleted sticky notes
            are safely preserved here without loss.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b pb-2 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("trash");
                setConfirmEmpty(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                activeTab === "trash"
                  ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Trash2 className="size-3.5" />
              <span>Recycle Bin ({trashedTasks.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("archive");
                setConfirmEmpty(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                activeTab === "archive"
                  ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Archive className="size-3.5" />
              <span>Safe Archive ({archivedTasks.length})</span>
            </button>
          </div>

          {activeTab === "trash" && trashedTasks.length > 0 && (
            <div>
              {!confirmEmpty ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmEmpty(true)}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 h-8 gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> Empty Bin
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleEmptyAll}
                    disabled={emptyRecycleBin.isPending}
                    className="text-xs h-8 cursor-pointer"
                  >
                    Confirm Permanent Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmEmpty(false)}
                    className="text-xs h-8 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
          {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FolderOpen className="size-10 mb-2 opacity-40 text-amber-500" />
              <p className="text-sm font-medium">
                {activeTab === "trash"
                  ? "Recycle bin is completely empty."
                  : "No archived tasks found."}
              </p>
              <p className="text-xs opacity-75 mt-0.5">
                {activeTab === "trash"
                  ? "Items you delete will wait here before permanent removal."
                  : "Past uncompleted daily tasks can be archived automatically without losing analytics."}
              </p>
            </div>
          ) : (
            currentList.map((task: Task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border text-ink shadow-2xs gap-3 transition-all",
                  noteBg[task.color] ?? "bg-card",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-hand font-bold text-base truncate">{task.title}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-ink/10 opacity-75">
                      {task.priority}
                    </span>
                    {task.category && (
                      <span className="text-[10px] font-medium opacity-70">· {task.category}</span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="text-xs opacity-75 truncate max-w-md mt-0.5">{task.notes}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] opacity-60 mt-1">
                    {task.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> Scheduled: {task.scheduled_date}
                      </span>
                    )}
                    {task.original_scheduled_date && (
                      <span>Orig: {task.original_scheduled_date}</span>
                    )}
                    {task.completed_at && (
                      <span className="flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="size-3" /> Completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreTask.mutate(task)}
                    disabled={restoreTask.isPending}
                    className="h-8 text-xs bg-background/80 hover:bg-background text-foreground gap-1 cursor-pointer"
                  >
                    <RotateCcw className="size-3" /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reopenTask.mutate(task)}
                    disabled={reopenTask.isPending}
                    className="h-8 text-xs bg-background/80 hover:bg-background text-foreground gap-1 cursor-pointer"
                  >
                    Reopen
                  </Button>
                  {activeTab === "trash" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTask.mutate({ id: task.id, permanent: true })}
                      disabled={deleteTask.isPending}
                      className="h-8 px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Permanently Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
