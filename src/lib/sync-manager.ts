/**
 * Offline Sync and Transaction Queue for Pinboard
 * Manages optimistic local changes, offline queueing, duplicate-action prevention,
 * account isolation across users, and reliable background sync with visual status indicators.
 */

export type SyncState = "synced" | "saving" | "offline" | "error";

export type QueuedMutation = {
  id: string;
  userId?: string | undefined;
  type: "task_save" | "task_update" | "task_delete" | "goal_save" | "goal_log" | "goal_delete";
  payload: unknown;
  timestamp: number;
  retryCount: number;
};

const BASE_QUEUE_KEY = "pinboard_offline_mutation_queue_v2";
const REOPEN_HISTORY_KEY = "pinboard_undo_history_v2";

export class SyncManager {
  private static listeners: Set<(state: SyncState, queueLen: number) => void> = new Set();
  private static currentState: SyncState = typeof navigator !== "undefined" && navigator.onLine ? "synced" : "offline";
  private static isSyncing = false;
  private static dedupeCache = new Map<string, number>();
  private static queueExecutor?: (item: QueuedMutation) => Promise<boolean>;
  private static currentUserId: string | null = null;

  static setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    this.setState(this.getQueue().length > 0 ? (navigator.onLine ? "saving" : "offline") : "synced");
  }

  private static getStorageKey(): string {
    return this.currentUserId ? `${BASE_QUEUE_KEY}_${this.currentUserId}` : `${BASE_QUEUE_KEY}_anon`;
  }

  static init() {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.setState(this.getQueue().length > 0 ? "saving" : "synced");
      this.processQueue();
    });

    window.addEventListener("offline", () => {
      this.setState("offline");
    });
  }

  static subscribe(listener: (state: SyncState, queueLen: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentState, this.getQueue().length);
    return () => this.listeners.delete(listener);
  }

  static getState(): SyncState {
    return this.currentState;
  }

  static setState(state: SyncState) {
    this.currentState = state;
    const len = this.getQueue().length;
    this.listeners.forEach((fn) => fn(state, len));
  }

  static getQueue(): QueuedMutation[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveQueue(queue: QueuedMutation[]) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(queue));
    } catch (e) {
      console.warn("Could not persist offline queue", e);
    }
    this.setState(queue.length > 0 ? (navigator.onLine ? "saving" : "offline") : "synced");
  }

  /** Prevents duplicate rapid-fire user actions (e.g. double clicks within 700ms) */
  static checkDuplicateAction(actionKey: string, cooldownMs = 700): boolean {
    const now = Date.now();
    const last = this.dedupeCache.get(actionKey);
    if (last && now - last < cooldownMs) {
      return true; // Is duplicate
    }
    this.dedupeCache.set(actionKey, now);
    return false;
  }

  static enqueue(type: QueuedMutation["type"], payload: unknown) {
    const queue = this.getQueue();
    const item: QueuedMutation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: this.currentUserId ?? undefined,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(item);
    this.saveQueue(queue);
    this.processQueue();
  }

  static hasPendingEdits(): boolean {
    return this.getQueue().length > 0;
  }

  static clearUserQueue() {
    try {
      localStorage.removeItem(this.getStorageKey());
      this.dedupeCache.clear();
      this.setState("synced");
    } catch {
      // Ignore
    }
  }

  // Record an action for Undo / Reopen
  static recordUndoableAction(action: {
    description: string;
    undo: () => Promise<void>;
    redo?: () => Promise<void>;
  }) {
    try {
      const history = this.getUndoHistory();
      history.unshift({
        id: Math.random().toString(36).slice(2),
        description: action.description,
        timestamp: Date.now(),
      });
      // Store last 15 actions
      localStorage.setItem(REOPEN_HISTORY_KEY, JSON.stringify(history.slice(0, 15)));
    } catch {
      // LocalStorage access restricted or full
    }
  }

  static getUndoHistory(): { id: string; description: string; timestamp: number }[] {
    try {
      const raw = localStorage.getItem(REOPEN_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async processQueue(executor?: (item: QueuedMutation) => Promise<boolean>) {
    if (executor) {
      this.queueExecutor = executor;
    }
    const activeExecutor = executor || this.queueExecutor;
    if (this.isSyncing || (typeof navigator !== "undefined" && !navigator.onLine) || !activeExecutor) return;

    const queue = this.getQueue();
    if (queue.length === 0) {
      this.setState("synced");
      return;
    }

    this.isSyncing = true;
    this.setState("saving");

    const remaining: QueuedMutation[] = [];
    for (const item of queue) {
      try {
        const success = await activeExecutor(item);
        if (!success) {
          item.retryCount += 1;
          if (item.retryCount < 5) remaining.push(item);
        }
      } catch {
        item.retryCount += 1;
        if (item.retryCount < 5) remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    this.isSyncing = false;
    this.setState(remaining.length > 0 ? "error" : "synced");
  }

  static retrySync() {
    return this.processQueue();
  }

  static clearAll() {
    try {
      localStorage.removeItem(this.getStorageKey());
      localStorage.removeItem(BASE_QUEUE_KEY);
      localStorage.removeItem(REOPEN_HISTORY_KEY);
      this.dedupeCache.clear();
      this.setState("synced");
    } catch {
      // Ignore cleanup error if local storage is unavailable
    }
  }
}

if (typeof window !== "undefined") {
  SyncManager.init();
}
