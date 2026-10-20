import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutGrid,
  CalendarClock,
  Target,
  MessageCircleHeart,
  Plus,
  Zap,
  GraduationCap,
  BarChart2,
  Trash2,
  Settings,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { useTasks, useGoals, useChatThreads, useCompleteTask } from "@/hooks/use-data";
import { noteBg, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GlobalCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNewTask?: () => void;
  onOpenQuickCapture?: () => void;
  onOpenReplan?: () => void;
  onOpenExamPlanner?: () => void;
  onOpenWeeklyReview?: () => void;
  onOpenRecycleBin?: () => void;
}

export function GlobalCommandMenu({
  open,
  onOpenChange,
  onOpenNewTask,
  onOpenQuickCapture,
  onOpenReplan,
  onOpenExamPlanner,
  onOpenWeeklyReview,
  onOpenRecycleBin,
}: GlobalCommandMenuProps) {
  const navigate = useNavigate();
  const { data: allTasks = [] } = useTasks();
  const { data: goalsData } = useGoals();
  const { data: threads = [] } = useChatThreads();
  const completeTask = useCompleteTask();

  const goals = goalsData?.goals ?? [];

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const activeTasks = allTasks.filter((t) => t.status !== "done").slice(0, 8);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks, goals, chats, or type an action..." />
      <CommandList className="max-h-96">
        <CommandEmpty>No matching tasks, goals, or actions found.</CommandEmpty>

        {/* Quick Navigation & Creation Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenNewTask) {
                  onOpenNewTask();
                } else {
                  navigate({ to: "/board" });
                }
              })
            }
          >
            <Plus className="mr-2 size-4 text-amber-500" />
            <span>Create new sticky note</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenQuickCapture) {
                  onOpenQuickCapture();
                } else {
                  navigate({ to: "/today" });
                }
              })
            }
          >
            <Zap className="mr-2 size-4 text-amber-500" />
            <span>Quick Capture thought / NLP Inbox</span>
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenReplan) {
                  onOpenReplan();
                } else {
                  navigate({ to: "/today" });
                }
              })
            }
          >
            <CalendarClock className="mr-2 size-4 text-indigo-500" />
            <span>Replan My Day (Collision optimizer)</span>
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenExamPlanner) {
                  onOpenExamPlanner();
                } else {
                  navigate({ to: "/today" });
                }
              })
            }
          >
            <GraduationCap className="mr-2 size-4 text-violet-500" />
            <span>Student Exam Planner</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenWeeklyReview) {
                  onOpenWeeklyReview();
                } else {
                  navigate({ to: "/today" });
                }
              })
            }
          >
            <BarChart2 className="mr-2 size-4 text-sky-500" />
            <span>Weekly Review & Reflection</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenRecycleBin) {
                  onOpenRecycleBin();
                } else {
                  navigate({ to: "/board" });
                }
              })
            }
          >
            <Trash2 className="mr-2 size-4 text-rose-500" />
            <span>Recycle Bin & Safe Archives</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Active Tasks Search */}
        {activeTasks.length > 0 && (
          <CommandGroup heading="Active Tasks">
            {activeTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`${task.title} ${task.category ?? ""} ${task.priority}`}
                onSelect={() =>
                  runCommand(() => {
                    navigate({ to: "/board" });
                  })
                }
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={cn(
                      "size-2.5 rounded-full shrink-0",
                      task.color === "yellow" && "bg-amber-400",
                      task.color === "pink" && "bg-rose-400",
                      task.color === "mint" && "bg-emerald-400",
                      task.color === "sky" && "bg-sky-400",
                      task.color === "lilac" && "bg-violet-400",
                      task.color === "peach" && "bg-orange-400",
                    )}
                  />
                  <span className="truncate font-medium">{task.title}</span>
                  {task.category && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {task.category}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.duration_minutes && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {task.duration_minutes}m
                    </span>
                  )}
                  <button
                    type="button"
                    title="Mark Done"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTask.mutate({ task });
                      toast.success(`Completed "${task.title}"! 🎉`);
                      onOpenChange(false);
                    }}
                    className="p-1 text-muted-foreground hover:text-emerald-600 transition-colors"
                  >
                    <CheckCircle2 className="size-3.5" />
                  </button>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Monthly Goals Search */}
        {goals.length > 0 && (
          <CommandGroup heading="Monthly Goals">
            {goals.map((g) => (
              <CommandItem
                key={g.id}
                value={`${g.title} goal monthly`}
                onSelect={() =>
                  runCommand(() => {
                    navigate({ to: "/goals" });
                  })
                }
              >
                <Target className="mr-2 size-4 text-emerald-500" />
                <span className="truncate">{g.title}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  Target: {g.target} {g.unit ?? ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Coach Conversations Search */}
        {threads.length > 0 && (
          <CommandGroup heading="Coach Conversations">
            {threads.slice(0, 5).map((th) => (
              <CommandItem
                key={th.id}
                value={`${th.title} coach chat conversation`}
                onSelect={() =>
                  runCommand(() => {
                    navigate({ to: "/coach" });
                  })
                }
              >
                <MessageCircleHeart className="mr-2 size-4 text-primary" />
                <span className="truncate">{th.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/board" }))}>
            <LayoutGrid className="mr-2 size-4 text-muted-foreground" />
            <span>Whiteboard Ramp</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/today" }))}>
            <CalendarClock className="mr-2 size-4 text-muted-foreground" />
            <span>Today's Daily Planner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/goals" }))}>
            <Target className="mr-2 size-4 text-muted-foreground" />
            <span>Monthly Goals</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/coach" }))}>
            <MessageCircleHeart className="mr-2 size-4 text-muted-foreground" />
            <span>AI Day Coach</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
