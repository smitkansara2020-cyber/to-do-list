# 📌 Pinboard · Intelligent Whiteboard Planner

A high-fidelity daily planner and monthly goal-tracking application built with a tactile **sticky-note whiteboard aesthetic**, physics-based micro-interactions, offline resilience, and an intelligent AI Day Coach.

---

## 🎨 Design Philosophy & Tactile Aesthetics

Pinboard bridges physical productivity artifacts with digital speed and automation:

- **Sticky Note Anatomy**: Authentic paper folds (`note-fold`), soft dropped shadows (`shadow-note`), handwritten script accents (`font-hand`), pushpins with metallic highlights, and genuine sticky-note pastel hues (yellow, pink, blue, green, amber, purple).
- **Physical Feel**: Sticky notes rotate slightly on tilt (`-rotate-1`, `rotate-2`), cast dynamic drop shadows on hover/drag, and feel tactile on both mobile touch screens and desktop cursors.
- **Carousel & Grid Views**: Choose between an expansive whiteboard grid or a smooth horizontal Carousel (`StickyNotesCarousel`) with multi-note sliding and navigation controls.
- **Accessibility & Reduced Motion**: Automatically detects `prefers-reduced-motion` to tone down high-intensity springs while keeping visual clarity and full keyboard focus controls (`Enter` / `Space` to edit, focus indicators, and accessible buttons).

---

## ⚡ Animation Architecture

Animations in Pinboard use **Motion (`motion/react`)** and **Canvas Confetti**:

1. **Card Springs & Dragging**: Sticky notes feature damped spring physics (`stiffness: 280, damping: 24`) that settle naturally without jarring abruptness.
2. **Carousel Transitions**: Notes glide into view with responsive snap points and custom basis sizing (`basis-full sm:basis-1/2 lg:basis-1/3`).
3. **Completion Celebrations**: Completing a goal or finishing a daily ramp unleashes celebratory confetti bursts with multi-angle spreads.
4. **Subtask & Badge Reveals**: Subtasks expand smoothly when clicked, showing strikethroughs and completion percentages in real time.
5. **Sync Pulsing**: The real-time `SyncIndicator` subtly pulses when background network syncs or retries occur.

---

## 🚀 Completed Features & Capabilities

### 1. Data Reliability & Offline Sync

- **Independent Task Statuses**: Decoupled task completion (`todo`, `in_progress`, `done`) from scheduled views and goals.
- **Real Offline Mutation Queue**: `SyncManager` records mutations to `localStorage` when offline and flushes them automatically upon reconnect.
- **Visible Sync Indicator**: Live header pill showing `Synced`, `Syncing (N)`, `Offline`, or `Retrying`.
- **Duplicate-Action Prevention**: Short-window deduplication prevents double-submits or accidental repeated clicks.
- **1-Click Undo & Reopen**: Completing a note prompts an actionable toast with an `Undo` button; notes also have an explicit `Reopen` action.

### 2. Recurrence Engine & Goal Linking

- **Recurrence Controls**: Tasks support `daily`, `weekly`, `monthly` cycles.
- **Occurrence Creation & History**: Completing a recurring note archives the occurrence and schedules the next cycle automatically.
- **Pause & Skip Controls**: Temporarily pause recurring generation without deleting the task template.
- **Edit One vs. All Future**: Choose between modifying only the current instance or updating all future recurrences.
- **Direct Goal Linking**: Tasks link to `monthly_goals` (`goal_id`), showing goal tags and updating goal progress when completed.

### 3. Monthly Goals & Rollover

- **Month-by-Month Navigation**: Cycle backward and forward across historical months with `ChevronLeft` and `ChevronRight`.
- **Backlog Rollover**: Unfinished goals from prior months are highlighted with a 1-click **"Carry Forward All"** action.
- **Habits vs. Numeric Goals**: Differentiates daily scheduled habits from quantitative milestone metrics.
- **Rest-Day (Weekend) Exclusion**: Excludes rest days (Saturdays & Sundays) from skipped-session tallies so users are not penalized on weekends.

### 4. Organization, Subtasks & Dependencies

- **Subtask Checklists**: Embedded checklists right on sticky note cards and in the creation dialog.
- **Dependency Locks**: Mark tasks as blocked by another task, visually locking completion until prerequisites are satisfied.
- **Search & Quick Filters**: Search by keyword; filter by priority (`High`, `Medium`, `Low`) or category; sort by date or priority.
- **Archive Toggle**: View active notes or toggle to view archived/completed notes.

### 5. Focus Timer & Time Tracking

- **Pomodoro Focus Timer**: Built-in 15m, 25m, 45m, and 60m focus blocks with real-time countdown.
- **Logged Focus Minutes**: Automatically saves actual focus time into the task's metadata (`actual_minutes`).
- **Completion Chime**: Web Audio chime alerts when focus sessions wrap up.

### 6. Upgraded AI Day Coach

- **Persistent Saved Threads**: Multiple conversation threads stored in Supabase (`chat_threads` and `chat_messages`) with Create, Rename, and Delete capabilities.
- **Work Availability & Boundaries**: Respects working hours (`day_start`, `day_end`), timezone, and commitments/breaks (e.g. lunch, school run) from user settings.
- **Intelligent Slot Planning**: Calculates realistic non-conflicting time slots around existing tasks and breaks.
- **Priority Explanations & Task Breakdowns**: Every proposed task includes a clear priority rationale and recommended subtasks.
- **Interactive Preview Before Apply**: Users preview proposed plans before committing them to the Whiteboard with 1-click apply and detailed error reporting.
- **Voice & Speech Input**: Integrated Web Speech API for hands-free voice task generation.

### 7. Export & Account Privacy

- **Calendar Export (.ics)**: Download an RFC-5545 `.ics` file compatible with Apple Calendar, Google Calendar, and Outlook.
- **Full Data Backup (JSON)**: Export all tasks, goals, updates, and settings as a clean JSON backup file.
- **GDPR Account Wipe**: Clear all personal tasks, goals, and chat threads directly from the Settings modal.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **Data & Auth**: [Supabase](https://supabase.com) (PostgreSQL, Row-Level Security, Auth)
- **State & Caching**: [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [Radix UI](https://www.radix-ui.com) primitives
- **Motion**: [Motion](https://motion.dev) (`motion/react`)
- **Testing**: [Vitest](https://vitest.dev)

---

## 🧪 Testing & Verification

Run tests:

```bash
npm test -- --run
```

Run TypeScript compilation check:

```bash
npx tsc --noEmit
```

Build for production:

```bash
npm run build
```
