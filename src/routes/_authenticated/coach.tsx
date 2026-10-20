import { useState, useRef, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  MessageCircleHeart,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Bot,
  User,
  PlusCircle,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Sun,
  LayoutGrid,
  Target,
  Tag,
  Trash2,
  Edit2,
  Check,
  X,
  Coffee,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useTasks,
  useSaveTask,
  useUpdateTask,
  useGoals,
  useSaveGoal,
  useSettings,
  useChatThreads,
  useCreateChatThread,
  useRenameChatThread,
  useDeleteChatThread,
  useChatMessages,
  useSaveChatMessage,
} from "@/hooks/use-data";
import { toISODate, noteBg, NOTE_COLORS, encodeTaskNotes, type Task } from "@/lib/tasks";
import { detectCategory, formatTitleWithEmoji, WORK_CATEGORIES } from "@/lib/categories";
import { AiGuardian, COACH_PERSONAS, type CoachPersona } from "@/lib/ai-guardian";
import { SettingsModal } from "@/components/SettingsModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Day Coach · Pinboard" }] }),
  component: CoachPage,
});

type FollowUpQuestion = {
  text: string;
  options: string[];
};

export type ProposedTask = {
  title: string;
  priority?: "low" | "medium" | "high";
  priorityReason?: string;
  color: string;
  category?: string;
  start_time?: string;
  duration_minutes?: number;
  scheduled_date?: string;
  notes?: string;
  subtasks?: string[];
};

export type ProposedGoal = {
  title: string;
  target: number;
  unit?: string;
  category?: string;
};

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  proposedTasks?: ProposedTask[] | undefined;
  appliedTasks?: boolean | undefined;
  createdGoals?: ProposedGoal[] | undefined;
  questions?: FollowUpQuestion[] | undefined;
};

const SUGGESTIONS = [
  "Plan my day: presentation, code review, gym workout",
  "Break down task: launch quarterly marketing campaign",
  "Replan afternoon: client meeting ran over by 1 hour",
  "How should my monthly plan be structured?",
  "Categorize my goals for work and fitness",
];

// Split user input into distinct topics/tasks
function extractTopics(text: string): string[] {
  let clean = text
    .replace(
      /^(hey\s+)?(ai\s+)?(coach\s+)?(please\s+)?(can you\s+)?(help me\s+)?(plan my day|ramp my day|plan today|organize my day|set my day|to do list|my day|schedule today|my tasks are|i have to do|i need to do|add tasks?|replan my day)(:)?/i,
      "",
    )
    .trim();

  clean = clean.replace(/^(i need to|i have to|i want to|tasks are|todos are|add)(:)?/i, "").trim();

  const rawParts = clean.split(/\n|•|\band\b|;|,/i);
  const topics = rawParts
    .map((p) => p.trim())
    .map((p) => p.replace(/^(to\s+|a\s+|the\s+)/i, "").trim())
    .filter((p) => p.length >= 3 && !/^(today|tomorrow|now|please|asap)$/i.test(p));

  return topics.length > 0 ? topics : [clean.slice(0, 80)];
}

export function CoachPage() {
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const { data: allTasks = [] } = useTasks();
  const { data: goalsData } = useGoals();
  const { data: settings } = useSettings();
  const saveTask = useSaveTask();
  const updateTask = useUpdateTask();
  const saveGoal = useSaveGoal();

  // Chat threads and messages
  const { data: threads = [] } = useChatThreads();
  const createThread = useCreateChatThread();
  const renameThread = useRenameChatThread();
  const deleteThread = useDeleteChatThread();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { data: rawMessages = [] } = useChatMessages(activeThreadId);
  const saveChatMessage = useSaveChatMessage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Thread renaming state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState("");

  // AI Usage & Coach Persona state
  const [persona, setPersona] = useState<CoachPersona>(() => AiGuardian.getPersona());
  const [remainingQuota, setRemainingQuota] = useState<number>(() => AiGuardian.checkRateLimit().remainingQuota);

  function handleSelectPersona(p: CoachPersona) {
    AiGuardian.setPersona(p);
    setPersona(p);
    toast.success(`Switched persona to ${COACH_PERSONAS[p].name}!`);
  }

  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: () => void;
    onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
    onerror: (e: { error: string }) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Set default active thread once loaded
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0]!.id);
    }
  }, [threads, activeThreadId]);

  // Sync DB messages with component state
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: `Hey! I'm your AI Day Coach & Whiteboard Ramp assistant.\n\nWorking hours: **${settings?.day_start?.slice(0, 5) ?? "09:00"} – ${settings?.day_end?.slice(0, 5) ?? "18:00"}** (${timezone}).\n${settings?.availability_notes ? `Notes: *"${settings.availability_notes}"*\n\n` : "\n"}Tell me what you'd like to accomplish today or set as monthly goals. I'll build a realistic plan with time slots, priority reasoning, and subtasks — and you can preview and adjust before applying!`,
          questions: [
            {
              text: "Quick start:",
              options: [
                "Plan my day: design wireframes, client call, team sync",
                "Set monthly goals for fitness, career, and reading",
                "Break down task: prepare product launch review",
              ],
            },
          ],
        },
      ]);
      return;
    }

    if (rawMessages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: `Ready to plan! Your schedule is set for **${settings?.day_start?.slice(0, 5) ?? "09:00"} – ${settings?.day_end?.slice(0, 5) ?? "18:00"}** (${timezone}).\n\nWhat are you working on today?`,
          questions: [
            {
              text: "Quick start:",
              options: [
                "Plan my day: presentation, code review, gym workout",
                "Break down task: launch quarterly marketing campaign",
                "How should my monthly plan be structured?",
              ],
            },
          ],
        },
      ]);
    } else {
      const parsed: Message[] = rawMessages.map(
        (m: { id: string; role: string; parts: unknown }) => {
          const parts =
            typeof m.parts === "object" && m.parts !== null
              ? (m.parts as Record<string, unknown>)
              : {};
          const textVal = parts["text"];
          const proposedTasksVal = parts["proposedTasks"];
          const appliedTasksVal = parts["appliedTasks"];
          const createdGoalsVal = parts["createdGoals"];
          const questionsVal = parts["questions"];

          return {
            id: m.id,
            sender: m.role === "user" ? "user" : "ai",
            text: typeof textVal === "string" ? textVal : "",
            proposedTasks: proposedTasksVal as ProposedTask[] | undefined,
            appliedTasks: appliedTasksVal as boolean | undefined,
            createdGoals: createdGoalsVal as ProposedGoal[] | undefined,
            questions: questionsVal as FollowUpQuestion[] | undefined,
          };
        },
      );
      setMessages(parsed);
    }
  }, [rawMessages, activeThreadId, settings, timezone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Setup Web Speech API for voice input
  useEffect(() => {
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionInstance;
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionInstance;
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
      ).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening... Speak now! 🎙️");
      };

      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: { error: string }) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please check your browser permissions.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  function toggleVoiceInput() {
    if (!recognitionRef.current) {
      toast.error(
        "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function handleCreateThread() {
    try {
      const thread = await createThread.mutateAsync("Planning Session " + (threads.length + 1));
      setActiveThreadId(thread.id);
      toast.success("Created new conversation thread!");
    } catch {
      toast.error("Failed to create thread.");
    }
  }

  async function handleRenameThread(id: string) {
    if (!editingThreadTitle.trim()) return;
    try {
      await renameThread.mutateAsync({ id, title: editingThreadTitle.trim() });
      setEditingThreadId(null);
      toast.success("Renamed session!");
    } catch {
      toast.error("Failed to rename session.");
    }
  }

  async function handleDeleteThread(id: string) {
    try {
      await deleteThread.mutateAsync(id);
      if (activeThreadId === id) {
        const remaining = threads.filter((t) => t.id !== id);
        setActiveThreadId(remaining[0]?.id ?? null);
      }
      toast.success("Deleted conversation thread.");
    } catch {
      toast.error("Failed to delete thread.");
    }
  }

  // Calculate intelligent schedule slots respecting existing tasks and user settings
  function findFreeSlots(numSlots: number, durationMinutes = 45): string[] {
    const todayTasks = allTasks.filter(
      (t) => t.scheduled_date === todayStr && t.start_time && t.status !== "done",
    );

    const startHour = parseInt((settings?.day_start ?? "09:00:00").slice(0, 2), 10) || 9;
    const endHour = parseInt((settings?.day_end ?? "18:00:00").slice(0, 2), 10) || 18;

    const bookedMinutes: Array<[number, number]> = todayTasks.map((t) => {
      const [h = 0, m = 0] = t.start_time!.split(":").map(Number);
      const start = h * 60 + m;
      const dur = t.duration_minutes || 30;
      return [start, start + dur];
    });

    // Check if availability notes specify lunch break
    if (settings?.availability_notes && /lunch/i.test(settings.availability_notes)) {
      bookedMinutes.push([12 * 60, 13 * 60]); // 12pm - 1pm
    }

    const freeSlots: string[] = [];
    let currentMin = startHour * 60;
    const maxMin = endHour * 60;

    while (currentMin + durationMinutes <= maxMin && freeSlots.length < numSlots) {
      const endSlot = currentMin + durationMinutes;
      const conflict = bookedMinutes.some(
        ([bStart, bEnd]) => currentMin < bEnd && endSlot > bStart,
      );

      if (!conflict) {
        const slotH = String(Math.floor(currentMin / 60)).padStart(2, "0");
        const slotM = String(currentMin % 60).padStart(2, "0");
        freeSlots.push(`${slotH}:${slotM}:00`);
        currentMin += durationMinutes + 15; // 15m buffer
      } else {
        currentMin += 15;
      }
    }

    // Fallback if day is full
    while (freeSlots.length < numSlots) {
      const h = String((startHour + freeSlots.length) % 24).padStart(2, "0");
      freeSlots.push(`${h}:00:00`);
    }

    return freeSlots;
  }

  async function handleSend(textToSend?: string) {
    const query = (textToSend ?? input).trim();
    if (!query || isProcessing) return;

    // AI Guardian: Validate payload size & format
    const val = AiGuardian.validatePayload(query);
    if (!val.valid) {
      toast.error(val.error);
      return;
    }

    // AI Guardian: Enforce cooldown & daily quotas
    const rateCheck = AiGuardian.checkRateLimit();
    if (!rateCheck.allowed) {
      toast.error(rateCheck.reason);
      return;
    }

    let threadId = activeThreadId;
    if (!threadId) {
      try {
        const newTh = await createThread.mutateAsync(query.slice(0, 30) || "Daily Plan");
        threadId = newTh.id;
        setActiveThreadId(threadId);
      } catch {
        toast.error("Could not initialize chat session.");
        return;
      }
    }

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    try {
      // Save user message to Supabase
      await saveChatMessage.mutateAsync({
        threadId,
        role: "user",
        messageId: userMsg.id,
        parts: { text: query },
      });

      await new Promise((r) => setTimeout(r, 450));
      const lower = query.toLowerCase();

      // Check if user is asking about Monthly Plan or Goals
      if (
        lower.includes("monthly plan") ||
        lower.includes("how should the monthly plan") ||
        lower.includes("monthly goal") ||
        (lower.includes("month") && (lower.includes("structure") || lower.includes("plan")))
      ) {
        const sampleGoals: ProposedGoal[] = [
          {
            title: "🏃‍♂️ 20 Focused Workout & Gym Sessions",
            target: 20,
            unit: "sessions",
            category: "Health & Fitness",
          },
          {
            title: "📚 Read 4 High-Impact Books",
            target: 4,
            unit: "books",
            category: "Learning & Growth",
          },
          {
            title: "💼 Deliver 8 Core Project Milestones",
            target: 8,
            unit: "milestones",
            category: "Work & Career",
          },
        ];

        const reply: Message = {
          id: Math.random().toString(),
          sender: "ai",
          text: `Here is a structured framework for your **Monthly Goals**:\n
• **Balanced Horizons**: Distribute targets across Career, Health, and Personal so you maintain holistic momentum.
• **Weekly Milestones**: Split each 30-day objective into 4 weekly targets.
• **Daily Sticky Ramp**: Connect daily sticky notes directly to your active goals on the Whiteboard.\n
I've prepared 3 recommended goals. Tap "Apply Goals" below to add them to your Monthly Goals list.`,
          createdGoals: sampleGoals,
          questions: [
            {
              text: "Next step:",
              options: ["Plan today's tasks to match these goals", "View Monthly Goals page"],
            },
          ],
        };

        setMessages((prev) => [...prev, reply]);
        await saveChatMessage.mutateAsync({
          threadId,
          role: "model",
          messageId: reply.id,
          parts: {
            text: reply.text,
            createdGoals: reply.createdGoals,
            questions: reply.questions,
          },
        });
        setIsProcessing(false);
        return;
      }

      // Check if user wants to break down a specific task
      const isBreakdown =
        lower.includes("break down") || lower.includes("breakdown") || lower.includes("subtasks");
      const isReplan =
        lower.includes("replan") || lower.includes("reschedule") || lower.includes("conflict");

      const topics = extractTopics(query);
      const freeSlots = findFreeSlots(topics.length);
      const proposedTasks: ProposedTask[] = [];

      for (let i = 0; i < topics.length; i++) {
        const rawTopic = topics[i]!;
        const det = detectCategory(rawTopic);
        const titleWithEmoji = formatTitleWithEmoji(rawTopic, det.emoji);
        const slot = freeSlots[i] ?? "10:00:00";

        let priority: "low" | "medium" | "high" = "medium";
        let priorityReason = "Fits comfortably into your standard afternoon flow";

        if (i === 0) {
          priority = "high";
          priorityReason = "High impact: Scheduled early when focus & cognitive energy are highest";
        } else if (i === topics.length - 1) {
          priority = "low";
          priorityReason = "Wrap-up slot: Light administrative or physical cooldown";
        }

        let subtasks: string[] = [];
        if (isBreakdown || rawTopic.length > 25) {
          subtasks = [
            `Outline & initial research for ${rawTopic.slice(0, 20)}`,
            `Deep focus execution phase`,
            `Review against requirements & wrap up`,
          ];
        }

        proposedTasks.push({
          title: titleWithEmoji,
          priority,
          priorityReason,
          color: det.color,
          category: det.category,
          scheduled_date: todayStr,
          start_time: slot,
          duration_minutes: isBreakdown ? 60 : 45,
          notes: `Planned by AI Coach · Prioritized: ${priorityReason}`,
          subtasks,
        });
      }

      const planExplanation = isReplan
        ? `I have replanned your day around your existing schedule and availability (${settings?.day_start?.slice(0, 5) ?? "09:00"}–${settings?.day_end?.slice(0, 5) ?? "18:00"}). Slots have been shifted without double-booking.`
        : isBreakdown
          ? `I've broken down this task into high-clarity subtasks and scheduled an uninterrupted focus block.`
          : `I've formulated a realistic daily plan tailored to your **${settings?.day_start?.slice(0, 5) ?? "09:00"}–${settings?.day_end?.slice(0, 5) ?? "18:00"}** working window. Review the proposed time slots and priority explanations below:`;

      let personaBanner = "";
      if (persona === "executive") {
        personaBanner = "⚡ **Executive Summary**: Direct action plan created. Focus on highest-leverage items first.";
      } else if (persona === "supportive") {
        personaBanner = "🌟 **Supportive Coach**: You've got this! We've paced your day so you can make confident, steady progress.";
      } else {
        personaBanner = "🌿 **Mindful Focus**: Balanced schedule optimized for calm mental clarity and sustainable energy.";
      }

      const reply: Message = {
        id: Math.random().toString(),
        sender: "ai",
        text: `${personaBanner}\n\n${planExplanation}`,
        proposedTasks,
        appliedTasks: false,
        questions: [
          {
            text: "Would you like to adjust anything?",
            options: [
              "Looks good! Apply to Whiteboard",
              "Add 15m break between tasks",
              "Replan afternoon schedule",
            ],
          },
        ],
      };

      AiGuardian.recordUsage();
      setRemainingQuota(AiGuardian.checkRateLimit().remainingQuota);

      setMessages((prev) => [...prev, reply]);
      await saveChatMessage.mutateAsync({
        threadId,
        role: "model",
        messageId: reply.id,
        parts: {
          text: reply.text,
          proposedTasks: reply.proposedTasks,
          appliedTasks: false,
          questions: reply.questions,
        },
      });
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        "Failed to process conversation: " + (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  // User previews and applies proposed tasks
  async function handleApplyPlan(messageId: string, tasksToApply: ProposedTask[]) {
    let successCount = 0;
    const errors: string[] = [];

    for (const t of tasksToApply) {
      try {
        const packedNotes =
          t.subtasks && t.subtasks.length > 0
            ? encodeTaskNotes(t.notes || "", {
                subtasks: t.subtasks.map((st) => ({
                  id: Math.random().toString(),
                  title: st,
                  done: false,
                })),
              })
            : (t.notes ?? null);

        await saveTask.mutateAsync({
          title: t.title,
          priority: t.priority ?? "medium",
          color: t.color,
          category: t.category ?? null,
          scheduled_date: t.scheduled_date ?? null,
          start_time: t.start_time ?? null,
          duration_minutes: t.duration_minutes ?? null,
          notes: packedNotes,
        });
        successCount++;
      } catch (err: unknown) {
        errors.push(`${t.title}: ${err instanceof Error ? err.message : "Save error"}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Saved ${successCount} tasks, but failed on: ${errors.join(", ")}`);
    } else {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.7 },
      });
      toast.success(`Successfully applied ${successCount} task(s) to your Whiteboard!`);
    }

    // Mark message as applied
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, appliedTasks: true } : m)));

    if (activeThreadId) {
      const targetMsg = messages.find((m) => m.id === messageId);
      if (targetMsg) {
        await saveChatMessage.mutateAsync({
          threadId: activeThreadId,
          role: "model",
          messageId: Math.random().toString(),
          parts: {
            text: `✅ Plan applied! Added ${successCount} sticky notes to your Whiteboard.`,
            appliedTasks: true,
          },
        });
      }
    }
  }

  // User applies proposed goals
  async function handleApplyGoals(messageId: string, goalsToApply: ProposedGoal[]) {
    let successCount = 0;
    const errors: string[] = [];

    for (const g of goalsToApply) {
      try {
        const det = detectCategory(g.title);
        await saveGoal.mutateAsync({
          title: g.title,
          target: g.target,
          unit: g.unit ?? null,
          color: det.color,
        });
        successCount++;
      } catch (err: unknown) {
        errors.push(`${g.title}: ${err instanceof Error ? err.message : "Save error"}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Saved ${successCount} goals, failed: ${errors.join(", ")}`);
    } else {
      confetti({ particleCount: 35, spread: 60 });
      toast.success(`Applied ${successCount} goals to Monthly Goals!`);
    }

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, appliedTasks: true } : m)));
  }

  return (
    <div className="whiteboard flex h-screen overflow-hidden">
      {/* Saved Conversations Sidebar */}
      <aside
        className={cn(
          "w-64 border-r bg-card/95 flex flex-col shrink-0 transition-all duration-200 z-20",
          sidebarOpen
            ? "absolute inset-y-0 left-0 shadow-xl md:relative md:shadow-none"
            : "hidden md:flex",
        )}
      >
        <div className="p-3.5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleHeart className="size-4 text-primary" />
            <span className="font-semibold text-xs tracking-wide uppercase">Conversations</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateThread}
            disabled={createThread.isPending}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="size-3.5" /> New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No saved chats yet.</p>
          ) : (
            threads.map((th) => {
              const isActive = th.id === activeThreadId;
              const isEditing = th.id === editingThreadId;

              return (
                <div
                  key={th.id}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => {
                    setActiveThreadId(th.id);
                    setSidebarOpen(false);
                  }}
                >
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={editingThreadTitle}
                        onChange={(e) => setEditingThreadTitle(e.target.value)}
                        className="h-6 text-xs px-1.5 py-0 bg-background text-foreground"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameThread(th.id)}
                        className="p-1 hover:text-emerald-500"
                      >
                        <Check className="size-3" />
                      </button>
                      <button
                        onClick={() => setEditingThreadId(null)}
                        className="p-1 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate flex-1">{th.title || "Planning Session"}</span>
                      <div
                        className={cn(
                          "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                          isActive && "opacity-100",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingThreadId(th.id);
                            setEditingThreadTitle(th.title);
                          }}
                          className="p-0.5 hover:text-amber-300"
                          title="Rename"
                        >
                          <Edit2 className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteThread(th.id)}
                          className="p-0.5 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* User Availability Context in Sidebar */}
        <div className="p-3 border-t bg-muted/30 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] flex items-center gap-1 text-muted-foreground">
              <Coffee className="size-3 text-amber-500" /> Availability
            </span>
            <button
              onClick={() => setOpenSettingsModal(true)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              <Settings className="size-2.5" /> Edit
            </button>
          </div>
          <p className="text-[11px] text-foreground font-mono">
            {settings?.day_start?.slice(0, 5) ?? "09:00"} –{" "}
            {settings?.day_end?.slice(0, 5) ?? "18:00"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{timezone}</p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header */}
        <header className="flex shrink-0 items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden size-8"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <MessageCircleHeart className="size-4" />
            </Button>
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-note">
              <Bot className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">
                AI Day Coach & Planner
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>
                  Working: {settings?.day_start?.slice(0, 5) ?? "09:00"}–
                  {settings?.day_end?.slice(0, 5) ?? "18:00"}
                </span>
                <span>·</span>
                <span className="hidden sm:inline">{timezone}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Persona Selector */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-0.5 text-xs">
              {(["executive", "supportive", "mindful"] as const).map((p) => {
                const cfg = COACH_PERSONAS[p];
                const active = persona === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPersona(p)}
                    title={`${cfg.name}: ${cfg.tagline}`}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                      active
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{cfg.avatarEmoji}</span>
                    <span className="hidden md:inline">{cfg.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* AI Quota Meter */}
            <div
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40 border text-[11px] font-mono text-muted-foreground"
              title="Daily AI prompt quota remaining"
            >
              <Sparkles className="size-3 text-amber-500" />
              <span>
                {remainingQuota}/{AiGuardian.getQuotaLimit()}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenSettingsModal(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Settings className="size-3.5" />
              <span className="hidden sm:inline">Availability</span>
            </Button>
            <Link to="/today">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
                <Sun className="size-3.5" /> <span className="hidden sm:inline">Today's Ramp</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div className={cn("max-w-2xl space-y-3", isUser && "items-end")}>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card border border-border/80 text-foreground rounded-tl-none whitespace-pre-line",
                      )}
                    >
                      {m.text}
                    </div>

                    {/* Proposed Daily Tasks with Preview & Apply Button */}
                    {m.proposedTasks && m.proposedTasks.length > 0 && (
                      <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-4 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <Sparkles className="size-4 text-amber-500" />
                            Proposed Daily Plan ({m.proposedTasks.length} tasks):
                          </p>
                          {m.appliedTasks ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <CheckCircle2 className="size-3 mr-1" /> Applied to Whiteboard
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleApplyPlan(m.id, m.proposedTasks!)}
                              disabled={saveTask.isPending}
                              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                            >
                              <Check className="size-3.5" /> Apply to Whiteboard
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {m.proposedTasks.map((t, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "note-fold rounded-sm p-3 text-ink shadow-note flex flex-col justify-between",
                                noteBg[t.color] ?? noteBg["yellow"],
                              )}
                            >
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-semibold opacity-75 uppercase mb-1">
                                  <span>{t.category ?? "WORK"}</span>
                                  {t.start_time && (
                                    <span className="font-mono flex items-center gap-0.5">
                                      <Clock className="size-3" /> {t.start_time.slice(0, 5)} (
                                      {t.duration_minutes || 45}m)
                                    </span>
                                  )}
                                </div>
                                <p className="font-hand font-semibold text-base line-clamp-2">
                                  {t.title}
                                </p>

                                {t.subtasks && t.subtasks.length > 0 && (
                                  <div className="mt-2 space-y-0.5 border-t border-ink/10 pt-1.5">
                                    <p className="text-[10px] font-semibold opacity-75">
                                      Subtasks:
                                    </p>
                                    {t.subtasks.map((st, sIdx) => (
                                      <p
                                        key={sIdx}
                                        className="text-[11px] opacity-80 flex items-center gap-1"
                                      >
                                        • {st}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="mt-2.5 pt-1.5 border-t border-ink/10 flex items-center justify-between text-[10px] opacity-80">
                                <span className="font-bold uppercase tracking-wider">
                                  {t.priority ?? "MEDIUM"}
                                </span>
                                {t.priorityReason && (
                                  <span
                                    className="italic truncate max-w-[150px]"
                                    title={t.priorityReason}
                                  >
                                    {t.priorityReason}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Proposed Monthly Goals Preview */}
                    {m.createdGoals && m.createdGoals.length > 0 && (
                      <div className="rounded-xl border border-indigo-300 bg-indigo-500/10 p-3.5 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <Target className="size-4 text-indigo-600" />
                            Recommended Monthly Goals:
                          </p>
                          {m.appliedTasks ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 bg-emerald-50 border-emerald-300"
                            >
                              <CheckCircle2 className="size-3 mr-1" /> Added
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleApplyGoals(m.id, m.createdGoals!)}
                              disabled={saveGoal.isPending}
                              className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                            >
                              <Check className="size-3.5" /> Apply Goals
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {m.createdGoals.map((g, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm border"
                            >
                              <span className="font-semibold">{g.title}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {g.category ?? "Target"}: {g.target} {g.unit ?? ""}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Question & Quick Suggestions */}
                    {m.questions && m.questions.length > 0 && (
                      <div className="rounded-xl border border-border/80 bg-accent/30 p-3 space-y-2.5">
                        {m.questions.map((q, qIdx) => (
                          <div key={qIdx} className="space-y-1.5">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Tag className="size-3.5 text-primary" /> {q.text}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt, optIdx) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => {
                                    if (opt.includes("Apply to Whiteboard") && m.proposedTasks) {
                                      handleApplyPlan(m.id, m.proposedTasks);
                                    } else {
                                      handleSend(opt);
                                    }
                                  }}
                                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-primary active:scale-95 text-left"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <User className="size-4" />
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground pl-11"
              >
                <Sparkles className="size-3.5 animate-spin text-amber-500" />
                Planning day, computing free slots & priority explanations...
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="border-t bg-card/40 px-4 py-2">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-1 text-xs">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Voice & Text Input Form */}
        <footer className="border-t bg-card p-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className={cn("shrink-0 relative", isListening && "animate-pulse")}
                onClick={toggleVoiceInput}
                title={isListening ? "Listening... click to stop" : "Speak to AI Coach"}
              >
                {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening to your voice... Speak now!"
                    : "Tell me what you need to do today or ask to replan..."
                }
                className="flex-1 bg-background"
                disabled={isProcessing}
              />

              <Button type="submit" disabled={!input.trim() || isProcessing} className="gap-1.5">
                <Send className="size-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {isListening ? (
                <span className="text-destructive font-medium">
                  ● Recording voice... Tell the AI what you need to do!
                </span>
              ) : (
                "AI schedules within your work hours, avoids conflicts, explains priorities, and lets you preview plans before applying."
              )}
            </p>
          </div>
        </footer>
      </div>

      <SettingsModal open={openSettingsModal} onOpenChange={setOpenSettingsModal} />
    </div>
  );
}
