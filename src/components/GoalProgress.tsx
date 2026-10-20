import { motion } from "motion/react";
import { Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_PALETTE = {
  bar: "from-emerald-400 via-teal-400 to-cyan-400",
  glow: "shadow-[0_0_12px_rgba(45,212,191,0.5)]",
  track: "bg-emerald-950/15 dark:bg-emerald-950/40",
  badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

const COLOR_MAP: Record<
  string,
  {
    bar: string;
    glow: string;
    track: string;
    badge: string;
  }
> = {
  mint: DEFAULT_PALETTE,
  pink: {
    bar: "from-pink-500 via-rose-400 to-fuchsia-400",
    glow: "shadow-[0_0_12px_rgba(244,63,94,0.5)]",
    track: "bg-rose-950/15 dark:bg-rose-950/40",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  yellow: {
    bar: "from-amber-400 via-yellow-400 to-orange-400",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.5)]",
    track: "bg-amber-950/15 dark:bg-amber-950/40",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  },
  sky: {
    bar: "from-sky-400 via-cyan-400 to-blue-500",
    glow: "shadow-[0_0_12px_rgba(56,189,248,0.5)]",
    track: "bg-sky-950/15 dark:bg-sky-950/40",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  lilac: {
    bar: "from-purple-500 via-indigo-400 to-violet-500",
    glow: "shadow-[0_0_12px_rgba(168,85,247,0.5)]",
    track: "bg-purple-950/15 dark:bg-purple-950/40",
    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  peach: {
    bar: "from-orange-400 via-amber-400 to-rose-400",
    glow: "shadow-[0_0_12px_rgba(251,146,60,0.5)]",
    track: "bg-orange-950/15 dark:bg-orange-950/40",
    badge: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30",
  },
};

export interface GoalProgressProps {
  current: number;
  target: number;
  unit?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function GoalProgress({
  current,
  target,
  unit,
  color = "mint",
  size = "sm",
  showLabel = true,
  className,
}: GoalProgressProps) {
  const t = Math.max(1, target);
  const pct = Math.min(100, Math.round((current / t) * 100));
  const isComplete = pct >= 100;
  const palette = (color ? COLOR_MAP[color] : undefined) ?? DEFAULT_PALETTE;

  const barHeight = size === "lg" ? "h-3.5" : size === "md" ? "h-3" : "h-2";

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="font-semibold text-foreground">{current}</span>
            <span>/</span>
            <span>{target}</span>
            {unit && <span className="text-[11px] opacity-80">{unit}</span>}
          </span>

          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border shadow-2xs",
              isComplete
                ? "bg-gradient-to-r from-amber-400/20 to-emerald-400/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : palette.badge,
            )}
          >
            {isComplete ? (
              <>
                <Trophy className="size-3 text-amber-500 animate-bounce" />
                <span>100% Done!</span>
              </>
            ) : (
              <>
                {pct > 50 && <Sparkles className="size-2.5 opacity-70" />}
                <span>{pct}%</span>
              </>
            )}
          </motion.span>
        </div>
      )}

      {/* Progress Track */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full p-0.5 shadow-inner transition-colors",
          barHeight,
          palette.track,
        )}
      >
        {/* Animated Progress Fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 65, damping: 14 }}
          className={cn(
            "relative h-full rounded-full bg-gradient-to-r shadow-xs overflow-hidden",
            palette.bar,
            palette.glow,
            isComplete && "bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400",
          )}
        >
          {/* Moving shimmer light wave */}
          <motion.div
            className="absolute inset-0 w-2/3 bg-gradient-to-r from-transparent via-white/45 to-transparent -skew-x-25"
            animate={{ x: ["-120%", "320%"] }}
            transition={{
              repeat: Infinity,
              duration: 2.4,
              ease: "easeInOut",
              repeatDelay: 0.5,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
