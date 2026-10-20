import { useEffect, useState } from "react";
import { SyncManager, type SyncState } from "@/lib/sync-manager";
import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncIndicator({ className }: { className?: string }) {
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [queueCount, setQueueCount] = useState<number>(0);

  useEffect(() => {
    return SyncManager.subscribe((state, count) => {
      setSyncState(state);
      setQueueCount(count);
    });
  }, []);

  return (
    <div
      title={
        syncState === "synced"
          ? "All changes saved & synced"
          : syncState === "saving"
            ? `Syncing ${queueCount} changes...`
            : syncState === "offline"
              ? `Offline mode (${queueCount} changes queued to sync)`
              : "Sync error - will retry automatically"
      }
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors cursor-help shadow-2xs",
        syncState === "synced" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        syncState === "saving" &&
          "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 animate-pulse",
        syncState === "offline" &&
          "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
        syncState === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {syncState === "synced" && (
        <>
          <Cloud className="size-3.5" />
          <span>Synced</span>
        </>
      )}
      {syncState === "saving" && (
        <>
          <RefreshCw className="size-3.5 animate-spin" />
          <span>Syncing{queueCount > 0 ? ` (${queueCount})` : "…"}</span>
        </>
      )}
      {syncState === "offline" && (
        <>
          <CloudOff className="size-3.5" />
          <span>Offline{queueCount > 0 ? ` (${queueCount})` : ""}</span>
        </>
      )}
      {syncState === "error" && (
        <>
          <AlertCircle className="size-3.5" />
          <span>Retrying…</span>
        </>
      )}
    </div>
  );
}
