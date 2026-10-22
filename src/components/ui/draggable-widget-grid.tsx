import React, { useState, useEffect, useRef, useCallback } from "react";
import { GripVertical, ChevronLeft, ChevronRight, RotateCcw, Move, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WidgetItem {
  id: string;
  size?: "sm" | "wide" | "tall" | "full";
  label?: string;
  [key: string]: any;
}

export interface DraggableWidgetGridProps<T extends WidgetItem = WidgetItem> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onOrderChange?: (newItems: T[]) => void;
  storageKey?: string;
  className?: string;
  itemClassName?: string | ((item: T) => string);
  editable?: boolean;
  showPositionControls?: boolean;
  onResetLayout?: () => void;
}

export function DraggableWidgetGrid<T extends WidgetItem = WidgetItem>({
  items: initialItems,
  renderItem,
  onOrderChange,
  storageKey = "pinboard_custom_dashboard_widgets_v1",
  className,
  itemClassName,
  editable = true,
  showPositionControls = false,
  onResetLayout,
}: DraggableWidgetGridProps<T>) {
  // Ordered list of items
  const [items, setItems] = useState<T[]>(() => {
    if (typeof window === "undefined" || !storageKey) return initialItems;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedIds: string[] = JSON.parse(saved);
        if (Array.isArray(savedIds) && savedIds.length > 0) {
          const map = new Map<string, T>(initialItems.map((item) => [item.id, item]));
          const reordered: T[] = [];
          for (const id of savedIds) {
            const item = map.get(id);
            if (item) {
              reordered.push(item);
              map.delete(id);
            }
          }
          // append any newly added items not present in saved order
          for (const remaining of map.values()) {
            reordered.push(remaining);
          }
          return reordered;
        }
      }
    } catch (e) {
      console.warn("Failed to read widget layout from localStorage", e);
    }
    return initialItems;
  });

  // Track latest items in a ref for pointer callbacks
  const itemsRef = useRef<T[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Screen reader announcement for keyboard moves
  const [announcement, setAnnouncement] = useState("");

  // Save order when updated
  const updateOrder = useCallback(
    (newItems: T[], announcedMsg?: string) => {
      setItems(newItems);
      itemsRef.current = newItems;
      if (storageKey && typeof window !== "undefined") {
        try {
          const ids = newItems.map((item) => item.id);
          localStorage.setItem(storageKey, JSON.stringify(ids));
        } catch (e) {
          console.warn("Failed to persist widget layout to localStorage", e);
        }
      }
      onOrderChange?.(newItems);
      if (announcedMsg) {
        setAnnouncement(announcedMsg);
      }
    },
    [storageKey, onOrderChange],
  );

  // Sync if initialItems changes externally, preserving current user order
  useEffect(() => {
    setItems((current) => {
      const itemMap = new Map(initialItems.map((item) => [item.id, item]));
      const updated = current
        .filter((c) => itemMap.has(c.id))
        .map((c) => ({ ...c, ...itemMap.get(c.id)! }));

      const currentIds = new Set(current.map((c) => c.id));
      for (const item of initialItems) {
        if (!currentIds.has(item.id)) {
          updated.push(item);
        }
      }
      return updated;
    });
  }, [initialItems]);

  // Active dragging state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const lastSwapRef = useRef<{ from: number; to: number; time: number } | null>(null);

  // Live swap reorder during drag/hover with bounce protection
  const swapItems = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const now = Date.now();
    if (
      lastSwapRef.current &&
      lastSwapRef.current.from === toIndex &&
      lastSwapRef.current.to === fromIndex &&
      now - lastSwapRef.current.time < 300
    ) {
      return;
    }
    const current = [...itemsRef.current];
    if (fromIndex >= current.length || toIndex >= current.length) return;

    const [moved] = current.splice(fromIndex, 1);
    if (!moved) return;
    current.splice(toIndex, 0, moved);
    setItems(current);
    itemsRef.current = current;
    setDraggedIndex(toIndex);
    lastSwapRef.current = { from: fromIndex, to: toIndex, time: now };
  }, []);

  // HTML5 Drag & Drop handlers with LIVE adaptation
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!editable) return;
    const target = e.target as HTMLElement;
    // If the drag originated from an inner draggable element (e.g. sticky note) rather than the widget card itself or its drag handle,
    // let the inner element handle its own drag
    if (target !== e.currentTarget && target.closest('[draggable="true"]') !== e.currentTarget && !target.closest("[data-widget-drag-handle]")) {
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    if (draggedIndex !== index) {
      swapItems(draggedIndex, index);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    updateOrder(
      itemsRef.current,
      `Moved widget to position ${draggedIndex + 1} of ${itemsRef.current.length}`,
    );
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      updateOrder(itemsRef.current);
    }
    setDraggedIndex(null);
  };

  // Pointer / Touch support for mobile and tablet devices
  const activePointerRef = useRef<{
    pointerId: number;
    startIndex: number;
    currentIndex: number;
  } | null>(null);

  const handlePointerDownGrip = (e: React.PointerEvent, index: number) => {
    if (!editable || e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    activePointerRef.current = {
      pointerId: e.pointerId,
      startIndex: index,
      currentIndex: index,
    };
    setDraggedIndex(index);
  };

  const handlePointerMoveGrip = (e: React.PointerEvent) => {
    if (!activePointerRef.current) return;
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const widgetCard = element?.closest("[data-widget-index]");
    if (widgetCard) {
      const targetIndexStr = widgetCard.getAttribute("data-widget-index");
      if (targetIndexStr !== null) {
        const targetIndex = parseInt(targetIndexStr, 10);
        if (!isNaN(targetIndex) && targetIndex !== activePointerRef.current.currentIndex) {
          swapItems(activePointerRef.current.currentIndex, targetIndex);
          activePointerRef.current.currentIndex = targetIndex;
        }
      }
    }
  };

  const handlePointerUpGrip = (e: React.PointerEvent) => {
    if (!activePointerRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updateOrder(itemsRef.current);
    activePointerRef.current = null;
    setDraggedIndex(null);
  };

  // Keyboard reordering
  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);

    updateOrder(
      next,
      `Moved ${moved.label || moved.id} ${direction === -1 ? "earlier" : "later"} to position ${targetIndex + 1}`,
    );
  };

  const handleReset = () => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn(e);
      }
    }
    setItems(initialItems);
    itemsRef.current = initialItems;
    onResetLayout?.();
    setAnnouncement("Widget layout reset to default");
  };

  return (
    <div className="w-full space-y-3">
      {/* Live announcement region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Grid container */}
      <div
        role="region"
        aria-label="Customizable dashboard widgets"
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr",
          className,
        )}
      >
        {items.map((item, index) => {
          const isWide = item.size === "wide" || item.size === "full";
          const isDragging = draggedIndex === index;

          return (
            <div
              key={item.id}
              role="article"
              data-widget-index={index}
              data-widget-id={item.id}
              aria-label={item.label || item.id}
              aria-roledescription="draggable dashboard widget"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowLeft") {
                  e.preventDefault();
                  moveItem(index, -1);
                } else if (e.altKey && e.key === "ArrowRight") {
                  e.preventDefault();
                  moveItem(index, 1);
                }
              }}
              draggable={editable}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={cn(
                "widget-reveal group/widget relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isWide ? "md:col-span-2" : "col-span-1",
                isDragging && "z-30",
                typeof itemClassName === "function" ? itemClassName(item) : itemClassName,
              )}
            >
              <div
                className={cn(
                  "widget-surface flex flex-col w-full h-full rounded-2xl transition-all duration-200 border bg-card text-card-foreground shadow-xs",
                  isDragging
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02] shadow-2xl opacity-90 border-primary"
                    : "opacity-100 hover:shadow-md hover:border-border/90",
                )}
              >
                {/* Drag handle & Accessible position controls bar (hidden by default) */}
                {editable && showPositionControls && (
                  <div
                    className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 opacity-90 group-hover/widget:opacity-100 focus-within:opacity-100 transition-opacity bg-background/90 dark:bg-zinc-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-border/70 dark:border-zinc-700/70 shadow-xs"
                    aria-label="Widget position controls"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, -1);
                      }}
                      disabled={index === 0}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move earlier (Alt+Left)"
                      aria-label={`Move ${item.label || item.id} earlier`}
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>

                    <div
                      onPointerDown={(e) => handlePointerDownGrip(e, index)}
                      onPointerMove={handlePointerMoveGrip}
                      onPointerUp={handlePointerUpGrip}
                      onPointerCancel={handlePointerUpGrip}
                      data-widget-drag-handle="true"
                      className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground flex items-center gap-1 select-none touch-none"
                      title="Drag to rearrange"
                      aria-hidden="true"
                    >
                      <GripVertical className="size-3.5" />
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, 1);
                      }}
                      disabled={index === items.length - 1}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Move later (Alt+Right)"
                      aria-label={`Move ${item.label || item.id} later`}
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Rendered widget content */}
                <div className="flex-1 w-full h-full min-h-0">
                  {renderItem(item)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DraggableWidgetGrid;
