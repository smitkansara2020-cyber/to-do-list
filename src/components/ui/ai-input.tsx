"use client"

import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OrbProps {
  dimension?: string
  className?: string
  tones?: {
    base?: string
    accent1?: string
    accent2?: string
    accent3?: string
  }
  spinDuration?: number
}

const ColorOrb: React.FC<OrbProps> = ({
  dimension = "192px",
  className,
  tones,
  spinDuration = 20,
}) => {
  const fallbackTones = {
    base: "oklch(95% 0.02 264.695)",
    accent1: "oklch(75% 0.15 350)",
    accent2: "oklch(80% 0.12 200)",
    accent3: "oklch(78% 0.14 280)",
  }

  const palette = { ...fallbackTones, ...tones }
  const dimValue = parseInt(dimension.replace("px", ""), 10)

  const blurStrength =
    dimValue < 50 ? Math.max(dimValue * 0.008, 1) : Math.max(dimValue * 0.015, 4)
  const contrastStrength =
    dimValue < 50 ? Math.max(dimValue * 0.004, 1.2) : Math.max(dimValue * 0.008, 1.5)
  const pixelDot = dimValue < 50 ? Math.max(dimValue * 0.004, 0.05) : Math.max(dimValue * 0.008, 0.1)
  const shadowRange = dimValue < 50 ? Math.max(dimValue * 0.004, 0.5) : Math.max(dimValue * 0.008, 2)
  const maskRadius =
    dimValue < 30 ? "0%" : dimValue < 50 ? "5%" : dimValue < 100 ? "15%" : "25%"
  const adjustedContrast =
    dimValue < 30 ? 1.1 : dimValue < 50 ? Math.max(contrastStrength * 1.2, 1.3) : contrastStrength

  return (
    <div
      className={cn("color-orb", className)}
      style={{
        width: dimension,
        height: dimension,
        "--base": palette.base,
        "--accent1": palette.accent1,
        "--accent2": palette.accent2,
        "--accent3": palette.accent3,
        "--spin-duration": `${spinDuration}s`,
        "--blur": `${blurStrength}px`,
        "--contrast": adjustedContrast,
        "--dot": `${pixelDot}px`,
        "--shadow": `${shadowRange}px`,
        "--mask": maskRadius,
      } as React.CSSProperties}
    >
      <style>{`
        @property --angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .color-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
          transform: scale(1.1);
        }

        .color-orb::before,
        .color-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transform: translateZ(0);
        }

        .color-orb::before {
          background:
            conic-gradient(
              from calc(var(--angle) * 2) at 25% 70%,
              var(--accent3),
              transparent 20% 80%,
              var(--accent3)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 45% 75%,
              var(--accent2),
              transparent 30% 60%,
              var(--accent2)
            ),
            conic-gradient(
              from calc(var(--angle) * -3) at 80% 20%,
              var(--accent1),
              transparent 40% 60%,
              var(--accent1)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 15% 5%,
              var(--accent2),
              transparent 10% 90%,
              var(--accent2)
            ),
            conic-gradient(
              from calc(var(--angle) * 1) at 20% 80%,
              var(--accent1),
              transparent 10% 90%,
              var(--accent1)
            ),
            conic-gradient(
              from calc(var(--angle) * -2) at 85% 10%,
              var(--accent3),
              transparent 20% 80%,
              var(--accent3)
            );
          box-shadow: inset var(--base) 0 0 var(--shadow) calc(var(--shadow) * 0.2);
          filter: blur(var(--blur)) contrast(var(--contrast));
          animation: spin var(--spin-duration) linear infinite;
        }

        .color-orb::after {
          background-image: radial-gradient(
            circle at center,
            var(--base) var(--dot),
            transparent var(--dot)
          );
          background-size: calc(var(--dot) * 2) calc(var(--dot) * 2);
          backdrop-filter: blur(calc(var(--blur) * 2)) contrast(calc(var(--contrast) * 2));
          mix-blend-mode: overlay;
        }

        .color-orb[style*="--mask: 0%"]::after {
          mask-image: none;
        }

        .color-orb:not([style*="--mask: 0%"])::after {
          mask-image: radial-gradient(black var(--mask), transparent 75%);
        }

        @keyframes spin {
          to {
            --angle: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .color-orb::before {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

const SPEED_FACTOR = 1
const FORM_WIDTH = 360
const FORM_HEIGHT = 220

interface ContextShape {
  showForm: boolean
  successFlag: boolean
  triggerOpen: () => void
  triggerClose: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

export interface MorphPanelProps {
  onSubmitMessage?: (message: string) => void
  className?: string
}

export function MorphPanel({ onSubmitMessage, className }: MorphPanelProps = {}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const [showForm, setShowForm] = React.useState(false)
  const [successFlag, setSuccessFlag] = React.useState(false)

  const triggerClose = React.useCallback(() => {
    setShowForm(false)
    textareaRef.current?.blur()
  }, [])

  const triggerOpen = React.useCallback(() => {
    setShowForm(true)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }, [])

  const handleSuccess = React.useCallback(() => {
    const val = textareaRef.current?.value?.trim()
    if (val && onSubmitMessage) {
      onSubmitMessage(val)
    }
    triggerClose()
    setSuccessFlag(true)
    setTimeout(() => setSuccessFlag(false), 1500)
  }, [triggerClose, onSubmitMessage])

  React.useEffect(() => {
    function clickOutsideHandler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
        triggerClose()
      }
    }
    document.addEventListener("mousedown", clickOutsideHandler)
    return () => document.removeEventListener("mousedown", clickOutsideHandler)
  }, [showForm, triggerClose])

  const ctx = React.useMemo(
    () => ({ showForm, successFlag, triggerOpen, triggerClose }),
    [showForm, successFlag, triggerOpen, triggerClose]
  )

  return (
    <div className={cn("relative h-9 w-[100px]", className)}>
      <FormContext.Provider value={ctx}>
        {/* Collapsed Pill Trigger (in document flow) */}
        {!showForm && <DockBar />}

        {/* Morphing Expanded Form: Anchored at top-0 right-0, expands strictly DOWNWARDS */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              ref={wrapperRef}
              data-panel
              className={cx(
                "absolute top-0 right-0 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card/98 text-card-foreground shadow-2xl backdrop-blur-md"
              )}
              initial={{
                width: 100,
                height: 36,
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                width: FORM_WIDTH,
                height: FORM_HEIGHT,
                opacity: 1,
                scale: 1,
              }}
              exit={{
                width: 100,
                height: 36,
                opacity: 0,
                scale: 0.95,
              }}
              style={{ transformOrigin: "top right" }}
              transition={{
                type: "spring",
                stiffness: 500 / SPEED_FACTOR,
                damping: 38,
                mass: 0.7,
              }}
            >
              <InputForm ref={textareaRef} onSuccess={handleSuccess} />
            </motion.div>
          )}
        </AnimatePresence>
      </FormContext.Provider>
    </div>
  )
}

function DockBar() {
  const { triggerOpen } = useFormContext()
  return (
    <button
      type="button"
      onClick={triggerOpen}
      className="flex h-9 w-[100px] items-center justify-center gap-2 rounded-full border border-border/80 bg-secondary/80 px-2.5 py-1 text-xs font-semibold text-secondary-foreground shadow-xs hover:bg-secondary hover:border-border transition-all cursor-pointer select-none active:scale-95"
      title="Ask AI Co-Pilot"
    >
      <ColorOrb dimension="20px" tones={{ base: "oklch(22.64% 0 0)" }} />
      <span className="truncate">Ask AI</span>
    </button>
  )
}

function InputForm({
  ref,
  onSuccess,
}: {
  ref: React.Ref<HTMLTextAreaElement>
  onSuccess: () => void
}) {
  const { triggerClose } = useFormContext()
  const btnRef = React.useRef<HTMLButtonElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSuccess()
  }

  function handleKeys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") triggerClose()
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      btnRef.current?.click()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full w-full flex-col p-3"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ColorOrb dimension="22px" tones={{ base: "oklch(22.64% 0 0)" }} />
          <span className="text-xs font-bold text-foreground select-none">AI Co-Pilot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={triggerClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="size-3.5" />
          </button>
          <button
            type="submit"
            ref={btnRef}
            className="flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
          >
            <span>Ask</span>
            <KeyHint className="border-primary-foreground/30 text-[9px] px-1 h-4">⌘↵</KeyHint>
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        placeholder="Ask me anything or tell me your tasks..."
        name="message"
        className="mt-2.5 flex-1 w-full resize-none rounded-lg p-2.5 text-xs outline-none bg-muted/40 focus:bg-muted/70 border border-border/60 text-foreground placeholder:text-muted-foreground transition-colors font-sans"
        required
        onKeyDown={handleKeys}
        spellCheck={false}
      />

      {/* Quick Prompts Footer */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto text-[10px] pt-1 border-t border-border/30">
        <span className="text-muted-foreground select-none">Try:</span>
        <button
          type="button"
          onClick={() => {
            const ta = (ref as React.RefObject<HTMLTextAreaElement>)?.current
            if (ta) {
              ta.value = "Plan my priority schedule for today"
              ta.focus()
            }
          }}
          className="whitespace-nowrap rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          ⚡ Plan Today
        </button>
        <button
          type="button"
          onClick={() => {
            const ta = (ref as React.RefObject<HTMLTextAreaElement>)?.current
            if (ta) {
              ta.value = "Break down tasks for my monthly goals"
              ta.focus()
            }
          }}
          className="whitespace-nowrap rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          🎯 Monthly Goals
        </button>
      </div>
    </form>
  )
}

function KeyHint({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cx(
        "text-foreground flex h-5 w-fit items-center justify-center rounded-sm border px-[5px] text-[10px] font-mono",
        className
      )}
    >
      {children}
    </kbd>
  )
}

export default MorphPanel
