import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  Download,
  Calendar,
  Trash2,
  Globe,
  Coffee,
  AlertTriangle,
  Check,
  RotateCcw,
  KeyRound,
  Mail,
  Loader2,
} from "lucide-react";
import {
  useSettings,
  useSaveSettings,
  useTasks,
  useGoals,
  useDeleteAllUserData,
} from "@/hooks/use-data";
import { exportTasksToICS, exportAllDataAsJSON } from "@/lib/calendar-export";
import { RecycleBinModal } from "@/components/RecycleBinModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: settings } = useSettings();
  const { data: tasks = [] } = useTasks();
  const { data: goalsData } = useGoals();
  const saveSettings = useSaveSettings();
  const deleteAllData = useDeleteAllUserData();

  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("18:00");
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openRecycleBin, setOpenRecycleBin] = useState(false);
  const [cleanupMode, setCleanupMode] = useState<string>(() => {
    return (typeof localStorage !== "undefined" && localStorage.getItem("pinboard_daily_cleanup_action")) || "archive";
  });
  const [completedCleanupMode, setCompletedCleanupMode] = useState<string>(() => {
    return (typeof localStorage !== "undefined" && localStorage.getItem("pinboard_completed_cleanup_action")) || "delete_tomorrow";
  });
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function handleCleanupChange(mode: string) {
    setCleanupMode(mode);
    try {
      localStorage.setItem("pinboard_daily_cleanup_action", mode);
      toast.success(`Cleanup mode set to: ${mode.replace("_", " ")}`);
    } catch {
      // Ignore
    }
  }

  function handleCompletedCleanupChange(mode: string) {
    setCompletedCleanupMode(mode);
    try {
      localStorage.setItem("pinboard_completed_cleanup_action", mode);
      toast.success(
        mode === "delete_tomorrow"
          ? "Done section set to: Auto-clear / delete on tomorrow's start"
          : "Done section set to: Keep completed notes on board"
      );
    } catch {
      // Ignore
    }
  }

  async function handleUpdatePassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleSendResetEmail() {
    setIsSendingResetEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user email found");
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth?mode=update_password`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${user.email}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      toast.error(msg);
    } finally {
      setIsSendingResetEmail(false);
    }
  }

  useEffect(() => {
    if (settings) {
      setDayStart(settings.day_start?.slice(0, 5) ?? "09:00");
      setDayEnd(settings.day_end?.slice(0, 5) ?? "18:00");
      setAvailabilityNotes(settings.availability_notes ?? "");
    }
  }, [settings, open]);

  async function handleSaveSchedule() {
    try {
      await saveSettings.mutateAsync({
        day_start: `${dayStart}:00`,
        day_end: `${dayEnd}:00`,
        availability_notes: availabilityNotes.trim() || null,
      });
      toast.success("Schedule & availability saved!");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings. Please retry.");
    }
  }

  function handleExportJSON() {
    exportAllDataAsJSON({
      tasks,
      goals: goalsData?.goals ?? [],
      updates: goalsData?.updates ?? [],
      settings,
    });
    toast.success("Downloaded complete data backup (JSON)!");
  }

  function handleExportICS() {
    exportTasksToICS(tasks, "Pinboard Schedule");
    toast.success("Downloaded calendar file (.ics)!");
  }

  async function handleDeleteAll() {
    setIsDeleting(true);
    try {
      await deleteAllData.mutateAsync();
      toast.success("All personal tasks, goals, and history have been wiped.");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to wipe account data. Please check connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            Schedule & Account Settings
          </DialogTitle>
          <DialogDescription>
            Configure your work availability, export backups, or manage account data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Work Hours & Availability */}
          <section className="space-y-3 rounded-lg border p-3.5 bg-card/60">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Coffee className="size-4 text-amber-500" />
              Daily Working Hours & Fixed Commitments
            </h3>
            <p className="text-xs text-muted-foreground">
              The AI Coach uses these boundaries to avoid booking over your breaks, meetings, or
              quiet hours.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="day-start" className="text-xs">
                  Day Starts At
                </Label>
                <Input
                  id="day-start"
                  type="time"
                  value={dayStart}
                  onChange={(e) => setDayStart(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="day-end" className="text-xs">
                  Day Ends At
                </Label>
                <Input
                  id="day-end"
                  type="time"
                  value={dayEnd}
                  onChange={(e) => setDayEnd(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="avail-notes" className="text-xs">
                Breaks & Recurring Commitments
              </Label>
              <Textarea
                id="avail-notes"
                placeholder="e.g. Lunch 12:00-13:00, Daily team standup 10:00-10:30, No meetings after 17:00"
                value={availabilityNotes}
                onChange={(e) => setAvailabilityNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Globe className="size-3 text-muted-foreground" />
                Timezone: <span className="font-mono text-foreground font-medium">{timezone}</span>
              </span>
              <Button
                size="sm"
                onClick={handleSaveSchedule}
                disabled={saveSettings.isPending}
                className="h-8 text-xs gap-1"
              >
                <Check className="size-3.5" /> Save Availability
              </Button>
            </div>
          </section>

          {/* Safe Daily Cleanup & Recycle Bin */}
          <section className="space-y-3 rounded-lg border p-3.5 bg-card/60">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <RotateCcw className="size-4 text-amber-500" />
                Yesterday's Daily Cleanup Mode
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenRecycleBin(true)}
                className="text-xs h-7 gap-1 border-amber-500/30 text-amber-900 dark:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20"
              >
                <Trash2 className="size-3" /> View Recycle Bin
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose how past uncompleted daily tasks are treated when a new day begins. Your original
              deadlines, completion history, and streaks are always safely preserved.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              {[
                {
                  id: "archive",
                  label: "Safe Archive (Recommended)",
                  desc: "Leaves the whiteboard clean; preserved in history & analytics",
                },
                {
                  id: "carry_forward",
                  label: "Carry Forward to Today",
                  desc: "Reschedules unfinished daily tasks to today automatically",
                },
                {
                  id: "skip",
                  label: "Keep in Past / Skip",
                  desc: "Retains original task occurrence as uncompleted on past day",
                },
                {
                  id: "trash",
                  label: "Move to Recycle Bin",
                  desc: "Soft-deletes to Recycle Bin with 1-click restore",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleCleanupChange(opt.id)}
                  className={cn(
                    "flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer",
                    cleanupMode === opt.id
                      ? "border-amber-500 bg-amber-500/15 text-foreground ring-1 ring-amber-500"
                      : "border-border/60 hover:bg-accent text-muted-foreground",
                  )}
                >
                  <span className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                    {opt.label}
                    {cleanupMode === opt.id && <Check className="size-3 text-amber-600 font-bold" />}
                  </span>
                  <span className="text-[10px] mt-0.5 leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Completed Tasks in 'Done' Section */}
          <section className="space-y-3 rounded-lg border p-3.5 bg-card/60">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Check className="size-4 text-emerald-500" />
              Completed Tasks in "Done" Section
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose whether completed sticky notes in the "Done" column carry over to tomorrow or
              are automatically cleared/deleted so your board starts fresh every morning.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              {[
                {
                  id: "delete_tomorrow",
                  label: "Auto-Delete / Clear Tomorrow (Recommended)",
                  desc: "Clears previous days' completed notes from Done so you start tomorrow with a clean ramp. All analytics and streaks remain safely preserved.",
                },
                {
                  id: "keep",
                  label: "Keep on Board",
                  desc: "Leaves completed notes on the board in the Done column indefinitely until manually removed.",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleCompletedCleanupChange(opt.id)}
                  className={cn(
                    "flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer",
                    completedCleanupMode === opt.id
                      ? "border-emerald-500 bg-emerald-500/15 text-foreground ring-1 ring-emerald-500"
                      : "border-border/60 hover:bg-accent text-muted-foreground",
                  )}
                >
                  <span className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                    {opt.label}
                    {completedCleanupMode === opt.id && <Check className="size-3 text-emerald-600 font-bold" />}
                  </span>
                  <span className="text-[10px] mt-0.5 leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Password Reset & Security */}
          <section className="space-y-3 rounded-lg border p-3.5 bg-card/60">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Password & Account Security
            </h3>
            <p className="text-xs text-muted-foreground">
              Change your password directly or send a password reset link to your registered email address.
            </p>
            <div className="space-y-2.5 pt-1">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword || !newPassword}
                  className="h-8 text-xs gap-1"
                >
                  {isUpdatingPassword ? <Loader2 className="size-3 animate-spin" /> : "Update Password"}
                </Button>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground text-[11px]">Forgot or prefer email link?</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendResetEmail}
                  disabled={isSendingResetEmail}
                  className="h-7 text-xs gap-1"
                >
                  {isSendingResetEmail ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3 text-muted-foreground" />}
                  Send Reset Email
                </Button>
              </div>
            </div>
          </section>


          {/* Data Export & Backup */}
          <section className="space-y-3 rounded-lg border p-3.5 bg-card/60">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Download className="size-4 text-sky-500" />
              Backup & Calendar Export
            </h3>
            <p className="text-xs text-muted-foreground">
              Download your tasks and goals for offline backup or sync with Google Calendar / Apple
              Calendar.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportICS}
                className="text-xs gap-1.5 h-8"
              >
                <Calendar className="size-3.5 text-sky-600" /> Export to Calendar (.ics)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="text-xs gap-1.5 h-8"
              >
                <Download className="size-3.5 text-emerald-600" /> Download Backup (JSON)
              </Button>
            </div>
          </section>

          {/* Privacy & Account Data Deletion */}
          <section className="space-y-3 rounded-lg border border-destructive/30 p-3.5 bg-destructive/5">
            <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Danger Zone · Data Privacy
            </h3>
            <p className="text-xs text-muted-foreground">
              Permanently delete all your tasks, monthly goals, updates, and AI conversation
              history. This cannot be undone.
            </p>

            {!confirmDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-xs gap-1.5 h-8"
              >
                <Trash2 className="size-3.5" /> Wipe All My Data
              </Button>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="text-xs gap-1.5 h-8"
                >
                  {isDeleting ? "Wiping..." : "Confirm: Permanently Delete Everything"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
      <RecycleBinModal open={openRecycleBin} onOpenChange={setOpenRecycleBin} />
    </Dialog>
  );
}
