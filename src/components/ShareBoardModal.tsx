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
import { Label } from "@/components/ui/label";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Shield,
  ShieldAlert,
  Eye,
  Edit3,
  Trash2,
  Mail,
  Lock,
} from "lucide-react";
import {
  CollaborationManager,
  type BoardRole,
  type BoardMember,
  type BoardInvitation,
} from "@/lib/collaboration";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShareBoardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardTitle?: string;
}

export function ShareBoardModal({
  open,
  onOpenChange,
  boardTitle = "Whiteboard Ramp",
}: ShareBoardModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<BoardRole>("editor");
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeInvitation, setActiveInvitation] = useState<BoardInvitation | null>(null);

  // Mock initial members list for the board
  const [members, setMembers] = useState<BoardMember[]>([
    {
      id: "mem_1",
      boardId: "board_main",
      userId: "user_owner",
      email: "you@pinboard.local",
      displayName: "You (Owner)",
      role: "owner",
      joinedAt: new Date().toISOString(),
    },
  ]);

  const handleCreateInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid collaborator email address.");
      return;
    }

    const invitation = CollaborationManager.generateInviteToken(
      "board_main",
      inviteRole,
      inviteEmail.trim(),
    );
    setActiveInvitation(invitation);

    // Also add to local members list as pending
    setMembers((prev) => [
      ...prev,
      {
        id: invitation.id,
        boardId: "board_main",
        userId: `usr_${Math.random().toString(36).slice(2, 6)}`,
        email: inviteEmail.trim(),
        displayName: inviteEmail.split("@")[0] ?? "Collaborator",
        role: inviteRole,
        joinedAt: new Date().toISOString(),
      },
    ]);

    setInviteEmail("");
    toast.success(`Generated invite for ${invitation.inviteEmail} as ${invitation.role}!`);
  };

  const handleCopyLink = () => {
    if (!activeInvitation) return;
    const link = CollaborationManager.getInviteLink(activeInvitation.token);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Invitation link copied to clipboard! 📋");
  };

  const handleRemoveMember = (id: string, name: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.info(`Removed ${name} from board.`);
  };

  const handleChangeRole = (id: string, newRole: BoardRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)),
    );
    toast.success("Updated member permission role.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-lg">Share "{boardTitle}"</DialogTitle>
              <DialogDescription className="text-xs">
                Invite team members or study partners to collaborate in real time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Privacy Note */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-200">
            <Lock className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Private by design:</strong> Collaborators only see sticky notes on this board.
              Your personal reflections and private AI Coach conversations remain 100% confidential.
            </span>
          </div>

          {/* Invite Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Invite by Email</Label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateInvite();
                  }
                }}
                className="h-9 text-xs"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as BoardRole)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button size="sm" onClick={handleCreateInvite} className="h-9 px-3 text-xs gap-1">
                <UserPlus className="size-3.5" /> Invite
              </Button>
            </div>
          </div>

          {/* Generated Invite Link Preview */}
          {activeInvitation && (
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5 text-primary" /> Active Invite Link
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Role: {activeInvitation.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={CollaborationManager.getInviteLink(activeInvitation.token)}
                  className="h-8 text-xs font-mono bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Expires in 7 days. Anyone with this link can join as {activeInvitation.role}.
              </p>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Members with access ({members.length})</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {members.map((m) => {
                const isOwner = m.role === "owner";
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card/70 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <Shield className="size-3" /> Owner
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.id, e.target.value as BoardRole)}
                          className="h-7 rounded border border-input bg-background px-1.5 text-[11px]"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.displayName)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
