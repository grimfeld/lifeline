import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { cn } from "@lifeline/ui";
import { GripVertical } from "lucide-react";

// The item under the pointer is where it lands — a row with its fold-out open is tall, so its center says little.
const underPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};

/**
 * Put a list in order (spec #95, #101): each item has a handle — dragged with
 * a mouse on the desk, with a finger on a phone (the handle doesn't scroll the
 * page), or moved one step with ↑/↓ once focused. `onMove(from, to)` gets the
 * indexes; the caller moves its own list (core `moveItem`).
 */
export function Reorderable({ ids, onMove, children }: { ids: (string | number)[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { distance: 4 } }));
  const [over, setOver] = useState<{ from: number; to: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const index = (id: string | number | undefined) => ids.findIndex((x) => String(x) === String(id));
  const end = (e: DragEndEvent) => {
    setOver(null);
    const from = index(e.active.id);
    const to = index(e.over?.id);
    if (from >= 0 && to >= 0 && from !== to) onMove(from, to);
  };
  // A keyboard step keeps focus on the handle at the item's new place.
  const step = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    onMove(from, to);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-reorder-handle="${to}"]`)?.focus());
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={underPointer}
      accessibility={{ screenReaderInstructions: { draggable: "Drag to move it, or press the up or down arrow." } }}
      onDragOver={(e) => setOver(e.over ? { from: index(e.active.id), to: index(e.over.id) } : null)}
      onDragEnd={end}
      onDragCancel={() => setOver(null)}
    >
      <div ref={box} className="contents">
        <ReorderContext.Provider value={{ ids, over, step }}>{children}</ReorderContext.Provider>
      </div>
    </DndContext>
  );
}

interface ReorderState {
  ids: (string | number)[];
  over: { from: number; to: number } | null;
  step: (from: number, to: number) => void;
}
const ReorderContext = createContext<ReorderState>({ ids: [], over: null, step: () => {} });

/**
 * One item of a `Reorderable`: `children` gets the handle to place in the
 * item's first slot. While dragging, the item follows the pointer and a line
 * shows where it lands.
 */
export function ReorderItem({ id, label, className, children }: { id: string | number; label: string; className?: string; children: (handle: ReactNode) => ReactNode }) {
  const { ids, over, step } = useContext(ReorderContext);
  const i = ids.findIndex((x) => String(x) === String(id));
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const target = over && over.to === i && over.from !== i ? (over.from < i ? "after" : "before") : null;
  const handle = (
    <button
      type="button"
      ref={drag.setActivatorNodeRef}
      {...drag.listeners}
      {...drag.attributes}
      data-reorder-handle={i}
      aria-label={`Move ${label}`}
      title="Drag to move — or ↑/↓"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-2 active:cursor-grabbing"
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        step(i, e.key === "ArrowUp" ? i - 1 : i + 1);
      }}
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      style={drag.transform ? { transform: `translate3d(0, ${drag.transform.y}px, 0)` } : undefined}
      className={cn(
        "relative",
        className,
        drag.isDragging && "bg-background z-10 opacity-80 shadow-md",
        target === "before" && "before:bg-primary before:absolute before:inset-x-0 before:-top-0.5 before:h-0.5 before:rounded-full",
        target === "after" && "after:bg-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full",
      )}
    >
      {children(handle)}
    </div>
  );
}
