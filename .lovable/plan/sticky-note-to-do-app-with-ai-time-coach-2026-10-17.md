# Sticky-note To-Do App with AI Time Coach

A colorful, animated task board where tasks are sticky notes pinned to a whiteboard. Completing one makes the note peel off and fall. A personal AI coach helps plan your day. Your progress shows as charts and progress bars, including monthly recurring tasks.

## Look and feel

- Whiteboard background with soft texture; tasks are colorful sticky notes (yellow, pink, mint, sky, lilac, peach), slightly rotated, with a pin or tape strip.
- Board layout inspired by your references: columns (To Do, In Progress, Done), clean sidebar, rounded pills for priority and tags.
- Playful display font for headings, clean sans for body. Light theme with a dark-mode toggle.

## Animations

- Scroll animations: sections and notes fade, lift and slightly rotate into place as you scroll; parallax on the landing page.
- Complete a task: note wiggles, the top corner peels, it detaches from the pin and falls off the board with gravity and spin, then lands in a "Done" pile; small confetti burst.
- Hover: notes lift with a shadow; drag notes between columns.
- Progress rings and bars animate up when they appear.

## Pages

- **Landing page** (public): animated hero with notes floating in, feature sections that animate on scroll, sign-in button.
- **Sign in / sign up**: email and password.
- **Board**: your sticky notes, add/edit tasks (title, note, priority, color, due date, category), filters and search.
- **Progress**: today/week completion ring, streak counter, completed-per-day chart, category breakdown.
- **Monthly goals**: tasks updated monthly (e.g. "Read 4 books", "Save 10,000") with a target, monthly check-ins, and a progressive bar plus month-by-month history timeline.
- **AI Coach**: multiple saved conversations in a side list, each with its own page. The coach can see your tasks, deadlines and progress, and suggests a time-blocked plan, priorities, and focus tips.

## Data (saved to the cloud, per user)

- Tasks, monthly goals and their check-ins, coach conversations and messages. Only you can see your data.

## Technical details

- Enable Lovable Cloud: email auth, tables `tasks`, `monthly_goals`, `goal_updates`, `chat_threads`, `chat_messages` with owner-only RLS and grants.
- Protected routes under `_authenticated/`: `/board`, `/progress`, `/goals`, `/coach`, `/coach/$threadId`; public `/` and `/auth`.
- Animations with `motion` (framer-motion): `whileInView` scroll reveals, falling-note keyframes (rotate + translateY + opacity) via AnimatePresence; drag via `@dnd-kit`; charts via `recharts`; confetti via `canvas-confetti`.
- AI coach: streaming chat through Lovable AI Gateway (default model) in a server route, with user's tasks/goals injected as context; AI Elements chat UI with markdown rendering; messages persisted per thread.
