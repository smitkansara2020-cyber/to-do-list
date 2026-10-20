import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StickyNotesCarouselProps {
  children: ReactNode[] | ReactNode;
  emptyMessage?: string;
  defaultView?: "carousel" | "grid";
  showToggle?: boolean;
  className?: string;
  basis?: string;
}

/**
 * StickyNotesGrid (formerly StickyNotesCarousel)
 * Displays sticky notes in a clean, natural responsive grid without carousel sliders.
 */
export function StickyNotesCarousel({
  children,
  emptyMessage = "No notes here yet.",
  className,
}: StickyNotesCarouselProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);

  if (items.length === 0) {
    return (
      <p className="col-span-full py-10 text-center font-hand text-base text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 p-1",
        className,
      )}
    >
      {items}
    </div>
  );
}
