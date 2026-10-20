import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  Settings,
  Pin,
  Sparkles,
  Mail,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsModal } from "@/components/SettingsModal";
import { FocusModeWidget } from "@/components/FocusModeWidget";
import { GlobalCommandMenu } from "@/components/GlobalCommandMenu";
import { AICoPilotDialog } from "@/components/AICoPilotDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { MorphPanel } from "@/components/ui/ai-input";
import { SyncManager } from "@/lib/sync-manager";
import { cn } from "@/lib/utils";

export function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isBoard = location.pathname === "/board" || location.pathname === "/";

  const [openSettings, setOpenSettings] = useState(false);
  const [openCommand, setOpenCommand] = useState(false);
  const [openAiCopilot, setOpenAiCopilot] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openMessages, setOpenMessages] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => {
    const handleOpenCopilot = (e: any) => {
      if (e?.detail?.prompt) setAiPrompt(e.detail.prompt);
      setOpenAiCopilot(true);
    };
    const handleOpenSettings = () => setOpenSettings(true);
    const handleOpenNotifications = () => setOpenNotifications(true);
    const handleOpenMessages = () => setOpenMessages(true);
    const handleSignOut = () => signOut();

    window.addEventListener("open-ai-copilot", handleOpenCopilot as EventListener);
    window.addEventListener("open-settings", handleOpenSettings);
    window.addEventListener("open-notifications", handleOpenNotifications);
    window.addEventListener("open-messages", handleOpenMessages);
    window.addEventListener("sign-out", handleSignOut);

    return () => {
      window.removeEventListener("open-ai-copilot", handleOpenCopilot as EventListener);
      window.removeEventListener("open-settings", handleOpenSettings);
      window.removeEventListener("open-notifications", handleOpenNotifications);
      window.removeEventListener("open-messages", handleOpenMessages);
      window.removeEventListener("sign-out", handleSignOut);
    };
  }, []);

  async function signOut() {
    if (SyncManager.hasPendingEdits()) {
      const proceed = window.confirm(
        "You have unsaved changes in your offline sync queue. Logging out now may abandon these edits. Do you still want to sign out?",
      );
      if (!proceed) return;
    }
    await qc.cancelQueries();
    qc.clear();
    SyncManager.clearUserQueue();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar (hidden on board because all options are in the board header line) */}
      {!isBoard && (
        <header className="flex h-16 w-full items-center justify-between border-b border-border/60 bg-background/90 px-4 sm:px-6 backdrop-blur-md shadow-2xs">
          {/* Brand Logo & Name + Navigation */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/board"
              className="flex items-center gap-3 group transition-transform active:scale-95"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 opacity-60 blur-xs transition-opacity group-hover:opacity-100" />
                <span className="relative grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 shadow-md shadow-amber-500/40 ring-1 ring-white/25">
                  <Pin className="size-4.5 text-zinc-950 fill-zinc-950 rotate-12 transition-transform group-hover:rotate-0 duration-200" />
                </span>
              </div>
              <span className="font-display text-xl font-black tracking-tight text-foreground">
                Pinboard
              </span>
            </Link>

            <nav className="hidden sm:flex items-center p-0.5 rounded-xl bg-muted/80 border border-border/60 text-xs font-semibold">
              <Link
                to="/board"
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  location.pathname === "/board" || location.pathname === "/"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Board
              </Link>
              <Link
                to="/goals"
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  location.pathname === "/goals"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Goals
              </Link>
            </nav>
          </div>

        {/* Far Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* MorphPanel AI Input (with ColorOrb, expands downwards) */}
          <MorphPanel
            onSubmitMessage={(msg) => {
              setAiPrompt(msg);
              setOpenAiCopilot(true);
            }}
          />

          {/* Settings Gear */}
          <button
            onClick={() => setOpenSettings(true)}
            title="Settings & Data"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Settings className="size-4.5" />
          </button>

          {/* Mail Envelope */}
          <button
            onClick={() => setOpenMessages(true)}
            title="Daily Digest & Mails"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Mail className="size-4.5" />
          </button>

          {/* Notifications Bell with Badge */}
          <button
            onClick={() => setOpenNotifications(true)}
            title="Notifications"
            className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Bell className="size-4.5" />
            <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-2xs">
              3
            </span>
          </button>

          {/* User Account Name & Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-border/60">
            <span className="grid size-8 place-items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs ring-1 ring-amber-500/30">
              SK
            </span>
            <span className="hidden md:inline text-xs font-semibold text-foreground">
              Smit Kansara
            </span>
          </div>

          {/* Logout Option */}
          <button
            onClick={signOut}
            title="Sign out"
            className="rounded-full p-2 text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </header>
      )}

      {/* Main Page Content - full width, no dead margin */}
      <main className="min-w-0 flex-1 w-full p-2 sm:p-4">
        <Outlet />
      </main>

      <SettingsModal open={openSettings} onOpenChange={setOpenSettings} />
      <AICoPilotDialog open={openAiCopilot} onOpenChange={setOpenAiCopilot} initialPrompt={aiPrompt} />
      <NotificationDialog open={openNotifications} onOpenChange={setOpenNotifications} type="notifications" />
      <NotificationDialog open={openMessages} onOpenChange={setOpenMessages} type="messages" />
      <FocusModeWidget />
      <GlobalCommandMenu open={openCommand} onOpenChange={setOpenCommand} />
    </div>
  );
}
