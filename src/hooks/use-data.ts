import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  nextOccurrence,
  toISODate,
  extractTaskMeta,
  encodeTaskNotes,
  type Goal,
  type GoalUpdate,
  type Task,
  type TaskExtension,
} from "@/lib/tasks";
import { SyncManager } from "@/lib/sync-manager";
import type { Database, Json } from "@/integrations/supabase/types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type GoalInsert = Database["public"]["Tables"]["monthly_goals"]["Insert"];
type MonthlyGoalUpdate = Database["public"]["Tables"]["monthly_goals"]["Update"];
type GoalUpdateInsert = Database["public"]["Tables"]["goal_updates"]["Insert"];

const fail = (e: unknown) => {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const msg = e instanceof Error ? e.message : "Couldn't save. Please check your connection.";
  toast.error(msg);
  SyncManager.setState(isOffline ? "offline" : "error");
};

// Process offline queue when network connects
if (typeof window !== "undefined") {
  SyncManager.processQueue(async (item) => {
    try {
      if (item.type === "task_update") {
        const payload = item.payload as { id: string } & TaskUpdate;
        const { id, ...patch } = payload;
        const { error } = await supabase
          .from("tasks")
          .update(patch as TaskUpdate)
          .eq("id", id);
        return !error;
      } else if (item.type === "task_save") {
        const payload = item.payload as { id?: string } & TaskInsert;
        const { id, ...rest } = payload;
        const q = id
          ? supabase
              .from("tasks")
              .update(rest as TaskUpdate)
              .eq("id", id)
          : supabase.from("tasks").insert(rest as TaskInsert);
        const { error } = await q;
        return !error;
      } else if (item.type === "task_delete") {
        const { id } = item.payload as { id: string };
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        return !error;
      } else if (item.type === "goal_save") {
        const payload = item.payload as { id?: string } & GoalInsert;
        const { id, ...rest } = payload;
        const q = id
          ? supabase
              .from("monthly_goals")
              .update(rest as MonthlyGoalUpdate)
              .eq("id", id)
          : supabase.from("monthly_goals").insert(rest as GoalInsert);
        const { error } = await q;
        return !error;
      } else if (item.type === "goal_delete") {
        const { id } = item.payload as { id: string };
        await supabase.from("goal_updates").delete().eq("goal_id", id);
        const { error } = await supabase.from("monthly_goals").delete().eq("id", id);
        return !error;
      } else if (item.type === "goal_log") {
        const { error } = await supabase
          .from("goal_updates")
          .upsert(item.payload as GoalUpdateInsert, { onConflict: "goal_id,month" });
        return !error;
      }
      return true;
    } catch {
      return false;
    }
  });
}

// Initialize user-isolated offline sync
if (typeof window !== "undefined") {
  supabase.auth.getUser().then(({ data }) => {
    SyncManager.setCurrentUser(data?.user?.id ?? null);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    SyncManager.setCurrentUser(session?.user?.id ?? null);
  });
}

export function useTasks() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        SyncManager.setState(isOffline ? "offline" : "error");
        throw error;
      }
      SyncManager.setState("synced");

      const todayStr = toISODate(new Date());

      // Hydrate extension metadata (subtasks, goal_id, dependencies, etc.)
      const hydrated: Task[] = (data || []).map((row) => {
        const { cleanNotes, meta } = extractTaskMeta(row.notes);
        return {
          ...row,
          notes: cleanNotes,
          goal_id: meta.goal_id ?? null,
          subtasks: meta.subtasks ?? [],
          dependencies: meta.dependencies ?? [],
          is_archived: meta.is_archived ?? false,
          deleted_at: meta.deleted_at ?? null,
          actual_minutes: meta.actual_minutes ?? 0,
          recurrence_paused: meta.recurrence_paused ?? false,
          original_scheduled_date: meta.original_scheduled_date ?? null,
          original_due_date: meta.original_due_date ?? null,
          carried_forward_count: meta.carried_forward_count ?? 0,
          selected_weekdays: meta.selected_weekdays ?? [],
          habit_frequency: meta.habit_frequency ?? undefined,
          links: meta.links ?? [],
        };
      });

      // Safe Daily Cleanup: User-selectable behavior (archive, carry_forward, skip, or trash)
      // NEVER permanently purges or deletes records automatically.
      const cleanupMode = (typeof localStorage !== "undefined" &&
        localStorage.getItem("pinboard_daily_cleanup_action")) || "archive";

      const completedCleanupMode = (typeof localStorage !== "undefined" &&
        localStorage.getItem("pinboard_completed_cleanup_action")) || "delete_tomorrow";

      const tasksToUpdate: { id: string; notes: string; scheduled_date?: string }[] = [];

      hydrated.forEach((t) => {
        if (t.is_archived || t.deleted_at) return;

        // Cleanup completed tasks from yesterday if configured to clear/delete tomorrow
        if (t.status === "done") {
          if (completedCleanupMode === "delete_tomorrow") {
            const completedDate = t.completed_at
              ? t.completed_at.slice(0, 10)
              : toISODate(new Date(t.updated_at || t.created_at));
            if (completedDate < todayStr) {
              t.is_archived = true;
              const currentMeta: TaskExtension = {
                goal_id: t.goal_id ?? null,
                subtasks: t.subtasks ?? [],
                dependencies: t.dependencies ?? [],
                actual_minutes: t.actual_minutes ?? 0,
                recurrence_paused: t.recurrence_paused ?? false,
                is_archived: true,
                original_scheduled_date: t.original_scheduled_date ?? null,
                original_due_date: t.original_due_date ?? null,
                carried_forward_count: t.carried_forward_count ?? 0,
                selected_weekdays: t.selected_weekdays ?? [],
                habit_frequency: t.habit_frequency,
                links: t.links ?? [],
              };
              tasksToUpdate.push({
                id: t.id,
                notes: encodeTaskNotes(t.notes, currentMeta),
              });
            }
          }
          return;
        }

        const isDaily =
          t.recurrence === "daily" ||
          t.category?.toLowerCase() === "daily" ||
          t.category?.toLowerCase() === "daily planning";

        if (!isDaily) return;

        const taskDate =
          t.scheduled_date ||
          (t.due_date ? t.due_date.slice(0, 10) : toISODate(new Date(t.created_at)));

        if (taskDate < todayStr) {
          const currentMeta: TaskExtension = {
            goal_id: t.goal_id ?? null,
            subtasks: t.subtasks ?? [],
            dependencies: t.dependencies ?? [],
            actual_minutes: t.actual_minutes ?? 0,
            recurrence_paused: t.recurrence_paused ?? false,
            original_scheduled_date: t.original_scheduled_date || taskDate,
            original_due_date: t.original_due_date || t.due_date || null,
            carried_forward_count: (t.carried_forward_count || 0) + (cleanupMode === "carry_forward" ? 1 : 0),
            selected_weekdays: t.selected_weekdays ?? [],
            habit_frequency: t.habit_frequency,
            links: t.links ?? [],
          };

          if (cleanupMode === "archive") {
            t.is_archived = true;
            currentMeta.is_archived = true;
            tasksToUpdate.push({
              id: t.id,
              notes: encodeTaskNotes(t.notes, currentMeta),
            });
          } else if (cleanupMode === "carry_forward") {
            t.scheduled_date = todayStr;
            tasksToUpdate.push({
              id: t.id,
              notes: encodeTaskNotes(t.notes, currentMeta),
              scheduled_date: todayStr,
            });
          } else if (cleanupMode === "trash") {
            const nowIso = new Date().toISOString();
            t.deleted_at = nowIso;
            currentMeta.deleted_at = nowIso;
            tasksToUpdate.push({
              id: t.id,
              notes: encodeTaskNotes(t.notes, currentMeta),
            });
          }
          // If cleanupMode === "skip", we leave it intact
        }
      });

      // Persist safe cleanup changes in the background without blocking the query
      if (tasksToUpdate.length > 0) {
        Promise.all(
          tasksToUpdate.map(({ id, notes, scheduled_date }) => {
            const patch: TaskUpdate = { notes, updated_at: new Date().toISOString() };
            if (scheduled_date) patch.scheduled_date = scheduled_date;
            return supabase.from("tasks").update(patch).eq("id", id);
          }),
        ).catch((err) => {
          console.warn("Background safe daily cleanup sync error:", err);
        });
      }

      // Return only active tasks for the board
      return hydrated.filter((t) => !t.is_archived && !t.deleted_at);
    },
  });
}

/** Hook to fetch all tasks (including archived & in recycle bin) for history/analytics */
export function useAllTasks() {
  return useQuery({
    queryKey: ["all_tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) => {
        const { cleanNotes, meta } = extractTaskMeta(row.notes);
        return {
          ...row,
          notes: cleanNotes,
          goal_id: meta.goal_id ?? null,
          subtasks: meta.subtasks ?? [],
          dependencies: meta.dependencies ?? [],
          is_archived: meta.is_archived ?? false,
          deleted_at: meta.deleted_at ?? null,
          actual_minutes: meta.actual_minutes ?? 0,
          recurrence_paused: meta.recurrence_paused ?? false,
          original_scheduled_date: meta.original_scheduled_date ?? null,
          original_due_date: meta.original_due_date ?? null,
          carried_forward_count: meta.carried_forward_count ?? 0,
          selected_weekdays: meta.selected_weekdays ?? [],
          habit_frequency: meta.habit_frequency ?? undefined,
          links: meta.links ?? [],
        };
      });
    },
  });
}

/** Hook to fetch soft-deleted and archived tasks for the Recycle Bin & Restoration dialog */
export function useRecycleBinTasks() {
  const { data: allTasks = [], ...rest } = useAllTasks();
  const trashedOrArchived = allTasks.filter((t) => Boolean(t.deleted_at || t.is_archived));
  return { data: trashedOrArchived, ...rest };
}

export function useSaveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      t: TaskInsert & {
        id?: string;
        meta?: TaskExtension;
      },
    ) => {
      const actionKey = `save_${t.id || t.title}`;
      if (SyncManager.checkDuplicateAction(actionKey, 500)) {
        return;
      }

      SyncManager.setState("saving");
      const { id, meta, ...rest } = t;

      // Merge meta with cached meta if editing existing task
      let packedNotes = rest.notes ?? null;
      if (meta) {
        let existingMeta: TaskExtension = {};
        if (id) {
          const cached = qc.getQueryData<Task[]>(["tasks"])?.find((task) => task.id === id);
          if (cached) {
            existingMeta = {
              goal_id: cached.goal_id ?? null,
              subtasks: cached.subtasks ?? [],
              dependencies: cached.dependencies ?? [],
              is_archived: cached.is_archived ?? false,
              deleted_at: cached.deleted_at ?? null,
              actual_minutes: cached.actual_minutes ?? 0,
              recurrence_paused: cached.recurrence_paused ?? false,
              original_scheduled_date: cached.original_scheduled_date ?? null,
              original_due_date: cached.original_due_date ?? null,
              carried_forward_count: cached.carried_forward_count ?? 0,
              selected_weekdays: cached.selected_weekdays ?? [],
              habit_frequency: cached.habit_frequency,
              links: cached.links ?? [],
            };
          }
        }
        packedNotes = encodeTaskNotes(rest.notes ?? "", { ...existingMeta, ...meta });
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      const payload: TaskInsert = {
        ...rest,
        notes: packedNotes ?? null,
        updated_at: new Date().toISOString(),
      };

      if (!id && userId && !payload.user_id) {
        payload.user_id = userId;
      }

      try {
        const q = id
          ? supabase
              .from("tasks")
              .update(payload as TaskUpdate)
              .eq("id", id)
          : supabase.from("tasks").insert(payload);
        const { error } = await q;
        if (error) throw error;
        SyncManager.setState("synced");
      } catch (err) {
        // Enqueue offline mutation
        SyncManager.enqueue("task_save", { id, ...payload });
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: fail,
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      meta,
      ...patch
    }: TaskUpdate & {
      id: string;
      meta?: TaskExtension;
    }) => {
      const actionKey = `update_${id}_${Object.keys(patch).join("_")}`;
      if (SyncManager.checkDuplicateAction(actionKey, 300)) {
        return;
      }

      SyncManager.setState("saving");

      const finalPatch: TaskUpdate = {
        ...patch,
        updated_at: new Date().toISOString(),
      };

      if (meta !== undefined || patch.notes !== undefined) {
        // Blend with existing notes and metadata to prevent accidental wiping
        const cachedTask = qc.getQueryData<Task[]>(["tasks"])?.find((t) => t.id === id);

        let currentNote = patch.notes as string | undefined;
        let existingMeta: TaskExtension = {};

        if (cachedTask) {
          if (currentNote === undefined) {
            currentNote = cachedTask.notes ?? "";
          }
          existingMeta = {
            goal_id: cachedTask.goal_id ?? null,
            subtasks: cachedTask.subtasks ?? [],
            dependencies: cachedTask.dependencies ?? [],
            is_archived: cachedTask.is_archived ?? false,
            deleted_at: cachedTask.deleted_at ?? null,
            actual_minutes: cachedTask.actual_minutes ?? 0,
            recurrence_paused: cachedTask.recurrence_paused ?? false,
            original_scheduled_date: cachedTask.original_scheduled_date ?? null,
            original_due_date: cachedTask.original_due_date ?? null,
            carried_forward_count: cachedTask.carried_forward_count ?? 0,
            selected_weekdays: cachedTask.selected_weekdays ?? [],
            habit_frequency: cachedTask.habit_frequency,
            links: cachedTask.links ?? [],
          };
        } else {
          const { data } = await supabase.from("tasks").select("notes").eq("id", id).maybeSingle();
          if (data?.notes) {
            const extracted = extractTaskMeta(data.notes);
            if (currentNote === undefined) {
              currentNote = extracted.cleanNotes;
            }
            existingMeta = extracted.meta;
          } else {
            if (currentNote === undefined) currentNote = "";
          }
        }

        const mergedMeta: TaskExtension = {
          ...existingMeta,
          ...(meta ?? {}),
        };

        finalPatch.notes = encodeTaskNotes(currentNote, mergedMeta);
      }

      try {
        const { error } = await supabase.from("tasks").update(finalPatch).eq("id", id);
        if (error) throw error;
        SyncManager.setState("synced");
      } catch (err) {
        SyncManager.enqueue("task_update", { id, ...finalPatch });
        throw err;
      }
    },
    onMutate: async ({ id, meta, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            ...patch,
            notes: patch.notes !== undefined ? patch.notes : t.notes,
            ...(meta
              ? {
                  goal_id: meta.goal_id !== undefined ? meta.goal_id : t.goal_id,
                  subtasks: meta.subtasks !== undefined ? meta.subtasks : t.subtasks,
                  dependencies:
                    meta.dependencies !== undefined ? meta.dependencies : t.dependencies,
                  is_archived: meta.is_archived !== undefined ? meta.is_archived : t.is_archived,
                  actual_minutes:
                    meta.actual_minutes !== undefined ? meta.actual_minutes : t.actual_minutes,
                  recurrence_paused:
                    meta.recurrence_paused !== undefined
                      ? meta.recurrence_paused
                      : t.recurrence_paused,
                }
              : {}),
          } as Task;
        }),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
      fail(e);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Marks done; supports Undo, Reopen, and configurable recurring occurrences */
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      task,
      reopen = false,
      occurrenceMode = "this_only", // "this_only" | "all_future"
    }: {
      task: Task;
      reopen?: boolean;
      occurrenceMode?: "this_only" | "all_future";
    }) => {
      const actionKey = `complete_${task.id}`;
      if (SyncManager.checkDuplicateAction(actionKey, 500)) return null;

      SyncManager.setState("saving");

      if (reopen) {
        // Reopen previously completed task
        const patch: TaskUpdate = {
          status: "todo",
          completed_at: null,
          updated_at: new Date().toISOString(),
        };
        try {
          const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
          if (error) throw error;
          SyncManager.setState("synced");
          return { action: "reopened", taskId: task.id };
        } catch (err) {
          SyncManager.enqueue("task_update", { id: task.id, ...patch });
          throw err;
        }
      }

      // Mark Done
      const completedAt = new Date().toISOString();
      const patch: TaskUpdate = {
        status: "done",
        completed_at: completedAt,
        updated_at: completedAt,
      };

      try {
        const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
        if (error) throw error;
      } catch (err) {
        SyncManager.enqueue("task_update", { id: task.id, ...patch });
        throw err;
      }

      // Handle recurrence occurrence creation (unless paused)
      let nextDate: string | null = null;
      if (
        task.recurrence !== "none" &&
        !task.recurrence_paused &&
        occurrenceMode !== "all_future"
      ) {
        const base = task.scheduled_date ?? task.due_date ?? toISODate(new Date());
        nextDate = nextOccurrence(base, task.recurrence, 1, {
          selectedWeekdays: task.selected_weekdays,
          restDays: task.rest_days,
        });
        const nextDue = task.due_date
          ? nextOccurrence(task.due_date, task.recurrence, 1, {
              selectedWeekdays: task.selected_weekdays,
              restDays: task.rest_days,
            })
          : null;

        // Preserve metadata in next occurrence
        const meta: TaskExtension = {
          goal_id: task.goal_id ?? null,
          subtasks: task.subtasks?.map((st) => ({ ...st, done: false })) ?? [],
          dependencies: [],
          actual_minutes: 0,
          selected_weekdays: task.selected_weekdays ?? [],
          rest_days: task.rest_days ?? [],
          habit_frequency: task.habit_frequency,
          links: task.links ?? [],
        };
        const encodedNotes = encodeTaskNotes(task.notes ?? "", meta);

        const recurringPayload: TaskInsert = {
          user_id: task.user_id,
          title: task.title,
          notes: encodedNotes,
          priority: task.priority,
          color: task.color,
          category: task.category,
          recurrence: task.recurrence,
          start_time: task.start_time,
          duration_minutes: task.duration_minutes,
          scheduled_date: nextDate,
          due_date: nextDue,
          status: "todo",
        };

        try {
          const { error: e2 } = await supabase.from("tasks").insert(recurringPayload);
          if (e2) {
            console.error("Error creating recurring occurrence", e2);
            SyncManager.enqueue("task_save", recurringPayload);
          }
        } catch (err) {
          SyncManager.enqueue("task_save", recurringPayload);
        }
      }

      SyncManager.setState("synced");
      return { action: "completed", taskId: task.id, nextDate };
    },
    onMutate: async ({ task, reopen }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            status: reopen ? "todo" : "done",
            completed_at: reopen ? null : new Date().toISOString(),
          };
        }),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
      fail(e);
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all_tasks"] });
      if (result?.action === "completed") {
        // Offer 1-click Undo toast
        toast.success(`Completed "${vars.task.title}"! 🎉`, {
          action: {
            label: "Undo",
            onClick: async () => {
              const { error } = await supabase
                .from("tasks")
                .update({
                  status: "todo",
                  completed_at: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", vars.task.id);
              if (error) {
                toast.error("Failed to undo task completion");
                return;
              }
              qc.invalidateQueries({ queryKey: ["tasks"] });
              qc.invalidateQueries({ queryKey: ["all_tasks"] });
              toast.info(`Reopened "${vars.task.title}"`);
            },
          },
        });
      } else if (result?.action === "reopened") {
        toast.info(`Reopened "${vars.task.title}" ☀️`);
      }
    },
  });
}

/** Soft deletes by default (moves to Recycle Bin) or permanently deletes if specified */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { id: string; permanent?: boolean }) => {
      const id = typeof arg === "string" ? arg : arg.id;
      const permanent = typeof arg === "string" ? false : Boolean(arg.permanent);

      SyncManager.setState("saving");

      if (permanent) {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) {
          SyncManager.enqueue("task_delete", { id });
          throw error;
        }
      } else {
        // Soft delete: set deleted_at in metadata to move to Recycle Bin
        const cached = qc.getQueryData<Task[]>(["tasks"])?.find((t) => t.id === id);
        const currentMeta: TaskExtension = cached
          ? {
              goal_id: cached.goal_id ?? null,
              subtasks: cached.subtasks ?? [],
              dependencies: cached.dependencies ?? [],
              is_archived: cached.is_archived ?? false,
              deleted_at: new Date().toISOString(),
              actual_minutes: cached.actual_minutes ?? 0,
              recurrence_paused: cached.recurrence_paused ?? false,
              original_scheduled_date: cached.original_scheduled_date ?? null,
              original_due_date: cached.original_due_date ?? null,
              carried_forward_count: cached.carried_forward_count ?? 0,
              selected_weekdays: cached.selected_weekdays ?? [],
              habit_frequency: cached.habit_frequency,
              links: cached.links ?? [],
            }
          : { deleted_at: new Date().toISOString() };

        const notes = encodeTaskNotes(cached?.notes ?? "", currentMeta);
        const patch: TaskUpdate = { notes, updated_at: new Date().toISOString() };
        const { error } = await supabase.from("tasks").update(patch).eq("id", id);
        if (error) {
          SyncManager.enqueue("task_update", { id, ...patch });
          throw error;
        }
      }
      SyncManager.setState("synced");
    },
    onSuccess: (_, arg) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all_tasks"] });
      const permanent = typeof arg !== "string" && arg.permanent;
      if (!permanent) {
        toast.info("Moved task to Recycle Bin", {
          action: {
            label: "Undo",
            onClick: async () => {
              const taskId = typeof arg === "string" ? arg : arg.id;
              const cached = qc.getQueryData<Task[]>(["all_tasks"])?.find((t) => t.id === taskId);
              if (cached) {
                const currentMeta: TaskExtension = {
                  goal_id: cached.goal_id ?? null,
                  subtasks: cached.subtasks ?? [],
                  dependencies: cached.dependencies ?? [],
                  is_archived: cached.is_archived ?? false,
                  deleted_at: null,
                  actual_minutes: cached.actual_minutes ?? 0,
                  recurrence_paused: cached.recurrence_paused ?? false,
                  original_scheduled_date: cached.original_scheduled_date ?? null,
                  original_due_date: cached.original_due_date ?? null,
                  carried_forward_count: cached.carried_forward_count ?? 0,
                  selected_weekdays: cached.selected_weekdays ?? [],
                  habit_frequency: cached.habit_frequency,
                  links: cached.links ?? [],
                };
                const notes = encodeTaskNotes(cached.notes, currentMeta);
                await supabase.from("tasks").update({ notes }).eq("id", taskId);
                qc.invalidateQueries({ queryKey: ["tasks"] });
                qc.invalidateQueries({ queryKey: ["all_tasks"] });
                toast.success("Restored task from Recycle Bin!");
              }
            },
          },
        });
      }
    },
    onError: fail,
  });
}

/** Restores an archived or soft-deleted task back to the active board */
export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      SyncManager.setState("saving");
      const currentMeta: TaskExtension = {
        goal_id: task.goal_id ?? null,
        subtasks: task.subtasks ?? [],
        dependencies: task.dependencies ?? [],
        is_archived: false,
        deleted_at: null,
        actual_minutes: task.actual_minutes ?? 0,
        recurrence_paused: task.recurrence_paused ?? false,
        original_scheduled_date: task.original_scheduled_date ?? null,
        original_due_date: task.original_due_date ?? null,
        carried_forward_count: task.carried_forward_count ?? 0,
        selected_weekdays: task.selected_weekdays ?? [],
        habit_frequency: task.habit_frequency,
        links: task.links ?? [],
      };
      const notes = encodeTaskNotes(task.notes, currentMeta);
      const patch: TaskUpdate = { notes, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
      if (error) {
        SyncManager.enqueue("task_update", { id: task.id, ...patch });
        throw error;
      }
      SyncManager.setState("synced");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all_tasks"] });
      toast.success("Restored task to your board! 📌");
    },
    onError: fail,
  });
}

/** Reopens any task (completed, archived, or soft-deleted) back to todo */
export function useReopenTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      SyncManager.setState("saving");
      const currentMeta: TaskExtension = {
        goal_id: task.goal_id ?? null,
        subtasks: task.subtasks ?? [],
        dependencies: task.dependencies ?? [],
        is_archived: false,
        deleted_at: null,
        actual_minutes: task.actual_minutes ?? 0,
        recurrence_paused: false,
        original_scheduled_date: task.original_scheduled_date ?? null,
        original_due_date: task.original_due_date ?? null,
        carried_forward_count: task.carried_forward_count ?? 0,
        selected_weekdays: task.selected_weekdays ?? [],
        habit_frequency: task.habit_frequency,
        links: task.links ?? [],
      };
      const notes = encodeTaskNotes(task.notes, currentMeta);
      const patch: TaskUpdate = {
        status: "todo",
        completed_at: null,
        notes,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
      if (error) {
        SyncManager.enqueue("task_update", { id: task.id, ...patch });
        throw error;
      }
      SyncManager.setState("synced");
    },
    onSuccess: (_, task) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all_tasks"] });
      toast.info(`Reopened "${task.title}" as To Do ☀️`);
    },
    onError: fail,
  });
}

/** Permanently deletes all items currently in the Recycle Bin */
export function useEmptyRecycleBin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      SyncManager.setState("saving");
      const { error } = await supabase.from("tasks").delete().in("id", taskIds);
      if (error) throw error;
      SyncManager.setState("synced");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all_tasks"] });
      toast.success("Recycle bin emptied permanently.");
    },
    onError: fail,
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async (): Promise<{ goals: Goal[]; updates: GoalUpdate[] }> => {
      const [g, u] = await Promise.all([
        supabase.from("monthly_goals").select("*").order("created_at"),
        supabase.from("goal_updates").select("*").order("month"),
      ]);
      if (g.error) throw g.error;
      if (u.error) throw u.error;
      return { goals: g.data ?? [], updates: u.data ?? [] };
    },
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: {
      id?: string;
      title: string;
      target: number;
      unit: string | null;
      color: string;
    }) => {
      SyncManager.setState("saving");
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const { id, ...rest } = g;
      const payload: GoalInsert = {
        ...rest,
        ...(userId ? { user_id: userId } : {}),
      };

      try {
        const { error } = id
          ? await supabase
              .from("monthly_goals")
              .update(payload as MonthlyGoalUpdate)
              .eq("id", id)
          : await supabase.from("monthly_goals").insert(payload);
        if (error) throw error;
        SyncManager.setState("synced");
      } catch (err) {
        SyncManager.enqueue("goal_save", { id, ...payload });
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: fail,
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      SyncManager.setState("saving");
      try {
        const { error: errUpdates } = await supabase
          .from("goal_updates")
          .delete()
          .eq("goal_id", id);
        if (errUpdates) throw errUpdates;

        const { error } = await supabase.from("monthly_goals").delete().eq("id", id);
        if (error) throw error;
        SyncManager.setState("synced");
      } catch (err) {
        SyncManager.enqueue("goal_delete", { id });
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: fail,
  });
}

export function useLogGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (u: {
      goal_id: string;
      month: string;
      value: number;
      note?: string | null;
    }) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const payload = userId
        ? { ...u, user_id: userId, updated_at: new Date().toISOString() }
        : { ...u, updated_at: new Date().toISOString() };

      SyncManager.setState("saving");
      try {
        const { error } = await supabase
          .from("goal_updates")
          .upsert(payload as GoalUpdateInsert, { onConflict: "goal_id,month" });
        if (error) throw error;
        SyncManager.setState("synced");
      } catch (err) {
        SyncManager.enqueue("goal_log", payload);
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: fail,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data ?? { day_start: "09:00:00", day_end: "18:00:00", availability_notes: null };
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: {
      day_start: string;
      day_end: string;
      availability_notes?: string | null;
    }) => {
      SyncManager.setState("saving");
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Must be logged in to update settings");

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { ...s, user_id: userId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      SyncManager.setState("synced");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    onError: fail,
  });
}

export function useChatThreads() {
  return useQuery({
    queryKey: ["chat_threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateChatThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string = "New Planning Session") => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Must be logged in to create chat thread");

      const { data, error } = await supabase
        .from("chat_threads")
        .insert({
          title,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_threads"] }),
    onError: fail,
  });
}

export function useRenameChatThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("chat_threads")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_threads"] }),
    onError: fail,
  });
}

export function useDeleteChatThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: msgErr } = await supabase.from("chat_messages").delete().eq("thread_id", id);
      if (msgErr) throw msgErr;
      const { error: threadErr } = await supabase.from("chat_threads").delete().eq("id", id);
      if (threadErr) throw threadErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_threads"] }),
    onError: fail,
  });
}

export function useChatMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["chat_messages", threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      if (!threadId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      role,
      messageId,
      parts,
    }: {
      threadId: string;
      role: string;
      messageId: string;
      parts: unknown;
    }) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Must be logged in to save chat message");

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: threadId,
          role,
          message_id: messageId,
          parts: (parts ?? null) as unknown as Json,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["chat_messages", vars.threadId] });
      qc.invalidateQueries({ queryKey: ["chat_threads"] });
    },
    onError: fail,
  });
}

export function useDeleteAllUserData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Must be logged in to delete user data");

      const { error: e1 } = await supabase.from("chat_messages").delete().eq("user_id", userId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("chat_threads").delete().eq("user_id", userId);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("goal_updates").delete().eq("user_id", userId);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("monthly_goals").delete().eq("user_id", userId);
      if (e4) throw e4;
      const { error: e5 } = await supabase.from("tasks").delete().eq("user_id", userId);
      if (e5) throw e5;
      const { error: e6 } = await supabase.from("user_settings").delete().eq("user_id", userId);
      if (e6) throw e6;
    },
    onSuccess: () => {
      qc.clear();
      SyncManager.clearAll();
    },
    onError: fail,
  });
}
