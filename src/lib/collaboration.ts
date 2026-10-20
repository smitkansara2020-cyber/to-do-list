/**
 * Collaborative Shared Boards Architecture
 * Provides role-based access control (Owner, Editor, Viewer), secure token-based
 * invitation links, member management, and local preparation for multi-user boards.
 */

export type BoardRole = "owner" | "editor" | "viewer";

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  email: string;
  displayName: string;
  role: BoardRole;
  joinedAt: string;
}

export interface BoardInvitation {
  id: string;
  boardId: string;
  inviteEmail: string;
  role: BoardRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

export interface SharedBoard {
  id: string;
  title: string;
  ownerId: string;
  isShared: boolean;
  role: BoardRole; // current user's role
  membersCount: number;
}

export class CollaborationManager {
  private static STORAGE_KEY = "pinboard_shared_boards_local_v1";
  private static MEMBERS_STORAGE_KEY = "pinboard_board_members_local_v1";

  static canEdit(role: BoardRole): boolean {
    return role === "owner" || role === "editor";
  }

  static canManageMembers(role: BoardRole): boolean {
    return role === "owner";
  }

  static generateInviteToken(boardId: string, role: BoardRole, email: string): BoardInvitation {
    const token = `inv_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation: BoardInvitation = {
      id: Math.random().toString(36).slice(2, 9),
      boardId,
      inviteEmail: email,
      role,
      token,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    return invitation;
  }

  static getInviteLink(token: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://pinboard.app";
    return `${origin}/board?invite=${token}`;
  }
}
