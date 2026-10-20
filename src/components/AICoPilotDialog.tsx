import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useTasks, useSaveTask, useGoals, useSaveGoal, useSettings } from "@/hooks/use-data";
import { AiGuardian, COACH_PERSONAS, type CoachPersona } from "@/lib/ai-guardian";
import { parsePlanRequest, type ProposedTask } from "@/lib/ai-planner";
import { toISODate } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  proposedTasks?: ProposedTask[] | undefined;
  applied?: boolean | undefined;
};

const SUGGESTIONS = [
  "Plan my day: focus on coding, meeting review, gym session",
  "Break down task: prepare monthly financial report",
  "Suggest 3 monthly habits for deep study and focus",
  "Reorganize today's pending tasks by priority",
];

export function AICoPilotDialog({
  open,
  onOpenChange,
  initialPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
}) {
  const saveTask = useSaveTask();
  const [persona, setPersona] = useState<CoachPersona>(() => AiGuardian.getPersona());
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "👋 Hi Smit! I'm your **Spark AI Co-Pilot**.\n\nTell me what you'd like to accomplish today, and I'll break down tasks, calculate durations, and automatically pin them to your whiteboard!",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Voice speech-to-text integration
  function toggleSpeech() {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  function handleSend(userPrompt?: string) {
    const textToSend = userPrompt ?? input;
    if (!textToSend.trim() || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    setTimeout(() => {
      generateAiResponse(textToSend.trim());
      setIsThinking(false);
    }, 600);
  }

  const sentInitialRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && initialPrompt && initialPrompt.trim() && sentInitialRef.current !== initialPrompt) {
      sentInitialRef.current = initialPrompt;
      handleSend(initialPrompt);
    }
  }, [open, initialPrompt]);

  function generateAiResponse(query: string) {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    let responseText = "";
    let proposed: ProposedTask[] | undefined = undefined;

    // 1. Polite greetings / help queries
    if (
      /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|help|what\s+can\s+you\s+do)\b/i.test(trimmed) &&
      trimmed.split(/\s+/).length <= 4
    ) {
      responseText = `👋 Hi Smit! I'm your **Spark AI Co-Pilot**.\n\nTell me what tasks you want to tackle today and how long you want to spend (for example: *"Learn deep learning for 2 hours and solve two LeetCode problems in 1.5 hours"*).\n\n• Give time in hours (like 2 hours, 1.5hr) or minutes (like 90m, 120 mins) — I'll automatically calculate everything in minutes.\n• I'll organize each task into a separate sticky note with subtasks.\n• Then review and click **Pin to Board** to place them on your whiteboard!`;
    }
    // 2. Acknowledgments / thanks
    else if (
      /^(?:thanks|thank\s+you|awesome|great|perfect|looks\s+good|sounds\s+good)\b/i.test(trimmed) &&
      trimmed.split(/\s+/).length <= 4
    ) {
      responseText = `You're very welcome! Click **Pin to Board** on any suggested sessions to pin them directly onto your whiteboard. Let me know whenever you're ready for the next focus block!`;
    }
    // 3. Monthly goals / habits (high-level, without daily time blocks)
    else if (
      (lower.includes("goal") || lower.includes("habit") || lower.includes("monthly")) &&
      !lower.includes("hour") &&
      !lower.includes("hr") &&
      !lower.includes("today") &&
      !lower.includes("minute") &&
      !lower.includes("mins")
    ) {
      responseText = `Here are 2 high-impact monthly goals tailored to your current velocity:`;
      proposed = [
        {
          title: "Complete 20 Focused Deep Work Sessions",
          category: "Monthly Goal",
          duration_minutes: 50,
          priority: "high",
          subtasks: ["Daily focused deep session check-in", "Track productivity metrics"],
        },
        {
          title: "Finish 4 Technical Deep-Dives or Projects",
          category: "Monthly Goal",
          duration_minutes: 60,
          priority: "medium",
          subtasks: ["Weekly project milestones", "Write key architectural takeaways"],
        },
      ];
    } else {
      // Natural Language parsing respecting exact requested durations and topics
      const plan = parsePlanRequest(query);
      responseText = plan.summaryText;
      proposed = plan.tasks;
    }

    const aiMsg: Message = {
      id: `ai-${Date.now()}`,
      sender: "ai",
      text: responseText,
      proposedTasks: proposed,
      applied: false,
    };

    setMessages((prev) => [...prev, aiMsg]);
  }

  function applyTasks(msgId: string, tasksToApply: ProposedTask[]) {
    const todayStr = toISODate(new Date());

    tasksToApply.forEach((t) => {
      saveTask.mutate({
        title: t.title,
        status: "todo",
        priority: t.priority ?? "medium",
        category: t.category ?? "Today's Work",
        scheduled_date: todayStr,
        duration_minutes: t.duration_minutes ?? 30,
        meta: {
          subtasks: (t.subtasks ?? []).map((st, i) => ({
            id: `st-${Date.now()}-${i}`,
            title: st,
            done: false,
          })),
        },
      });
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    toast.success(`Pinned ${tasksToApply.length} tasks to your board! 🎉`);

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m)),
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="flex flex-col w-full max-w-2xl h-[650px] max-h-[90vh] rounded-3xl border border-border/80 bg-background/98 shadow-2xl overflow-hidden"
          >
            {/* Dialog Header */}
            <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 text-white shadow-md shadow-indigo-500/25">
                  <Sparkles className="size-4.5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    Spark AI Co-Pilot
                    <span className="text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 border border-indigo-500/20">
                      Smart Assistant
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ask me to plan your day, schedule tasks, or organize monthly goals
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Persona Switcher */}
                <select
                  value={persona}
                  onChange={(e) => {
                    const p = e.target.value as CoachPersona;
                    setPersona(p);
                    AiGuardian.setPersona(p);
                    toast.success(`Switched to ${COACH_PERSONAS[p].name}`);
                  }}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="executive">Executive Coach</option>
                  <option value="supportive">Supportive Coach</option>
                  <option value="mindful">Mindful Coach</option>
                </select>

                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-4.5" />
                </button>
              </div>
            </header>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 [scrollbar-width:thin]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3",
                    m.sender === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {m.sender === "ai" && (
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      <Bot className="size-4" />
                    </span>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.sender === "user"
                        ? "bg-indigo-600 text-white shadow-sm rounded-tr-xs"
                        : "bg-muted/60 border border-border/60 text-foreground rounded-tl-xs",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {/* Proposed Tasks Checklist */}
                    {m.proposedTasks && m.proposedTasks.length > 0 && (
                      <div className="mt-3.5 space-y-2 border-t border-border/50 pt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Suggested Action Items
                        </span>
                        <div className="space-y-1.5">
                          {m.proposedTasks.map((t, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-border/80 bg-background/90 p-2.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-foreground">
                                  {t.title}
                                </span>
                                <span className="text-[10px] rounded-full bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-700 dark:text-indigo-300">
                                  {t.duration_minutes ?? 30}m
                                </span>
                              </div>
                              {t.subtasks && t.subtasks.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                                  {t.subtasks.map((st, si) => (
                                    <li key={si} className="flex items-center gap-1.5">
                                      <span className="size-1 rounded-full bg-indigo-500" />
                                      {st}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Pin Tasks Action */}
                        <div className="pt-2 flex justify-end">
                          {m.applied ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-4" /> Pinned to Whiteboard
                            </span>
                          ) : (
                            <button
                              onClick={() => applyTasks(m.id, m.proposedTasks!)}
                              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
                            >
                              <Plus className="size-3.5" /> Pin to Board
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {m.sender === "user" && (
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
                      <User className="size-4" />
                    </span>
                  )}
                </div>
              ))}

              {isThinking && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="grid size-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 animate-pulse">
                    <Sparkles className="size-4" />
                  </span>
                  <span>Spark AI is analyzing your goals & planning tasks...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-6 py-2 border-t border-border/40 bg-muted/20 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="shrink-0 rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <footer className="p-4 border-t border-border/60 bg-background">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tell Spark AI what to plan, break down, or prioritize..."
                    className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    title={isListening ? "Listening... click to stop" : "Voice input"}
                    className={cn(
                      "absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-colors cursor-pointer",
                      isListening
                        ? "bg-rose-500 text-white animate-pulse"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="grid size-10 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
