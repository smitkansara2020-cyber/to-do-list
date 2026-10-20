-- Migration: Collaborative Shared Boards & RLS Access Control
-- Description: Sets up boards, board_members, and board_invitations tables with
-- row-level security (RLS) ensuring strict isolation and role-based permissions.

-- 1. Boards Table
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on boards
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- 2. Board Members Table
CREATE TABLE IF NOT EXISTS public.board_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(board_id, user_id)
);

-- Enable RLS on board_members
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- 3. Board Invitations Table
CREATE TABLE IF NOT EXISTS public.board_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    invite_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ
);

ALTER TABLE public.board_invitations ENABLE ROW LEVEL SECURITY;

-- 4. Add board_id to tasks (nullable, default NULL for private user tasks)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'board_id'
    ) THEN
        ALTER TABLE public.tasks ADD COLUMN board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. RLS Policies for Boards
-- A user can view a board if they are the owner OR a member
CREATE POLICY "Users can view boards they belong to"
    ON public.boards FOR SELECT
    USING (
        auth.uid() = owner_id OR
        EXISTS (
            SELECT 1 FROM public.board_members bm 
            WHERE bm.board_id = boards.id AND bm.user_id = auth.uid()
        )
    );

-- Only owners can update their boards
CREATE POLICY "Owners can update their boards"
    ON public.boards FOR UPDATE
    USING (auth.uid() = owner_id);

-- Only owners can delete their boards
CREATE POLICY "Owners can delete their boards"
    ON public.boards FOR DELETE
    USING (auth.uid() = owner_id);

-- Any authenticated user can create a board
CREATE POLICY "Authenticated users can create boards"
    ON public.boards FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- 6. RLS Policies for Board Members
CREATE POLICY "Board members can view other members of their boards"
    ON public.board_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.board_members bm 
            WHERE bm.board_id = board_members.board_id AND bm.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.boards b 
            WHERE b.id = board_members.board_id AND b.owner_id = auth.uid()
        )
    );

CREATE POLICY "Only board owners can insert members"
    ON public.board_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.boards b 
            WHERE b.id = board_members.board_id AND b.owner_id = auth.uid()
        )
    );

CREATE POLICY "Only board owners can remove members"
    ON public.board_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards b 
            WHERE b.id = board_members.board_id AND b.owner_id = auth.uid()
        )
    );

-- 7. RLS Policies for Tasks on Shared Boards
-- Read: user owns task OR is a member of the board
CREATE POLICY "Users can view tasks on shared boards they belong to"
    ON public.tasks FOR SELECT
    USING (
        auth.uid() = user_id OR
        (board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = tasks.board_id AND bm.user_id = auth.uid()
        ))
    );

-- Write/Update: user owns task OR has 'owner' or 'editor' role on the board
CREATE POLICY "Editors and owners can update shared board tasks"
    ON public.tasks FOR UPDATE
    USING (
        auth.uid() = user_id OR
        (board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = tasks.board_id 
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'editor')
        ))
    );

-- Insert: user creates task on shared board where they are owner or editor
CREATE POLICY "Editors and owners can insert tasks on shared boards"
    ON public.tasks FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        (board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = tasks.board_id 
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'editor')
        ))
    );

-- NOTE: Reflections and Chat Threads have NO board_id column and remain strictly private to auth.uid() = user_id!
