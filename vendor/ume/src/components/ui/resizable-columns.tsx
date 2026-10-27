"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

/* Resizable table columns (Accounts design): drag the line at a header's
   right edge, or focus it and use ←/→; double-click resets.

     import {
       ColumnResizeHandle,
       ResizableColGroup,
       useResizableColumns,
     } from "./resizable-columns";

     const tableRef = React.useRef<HTMLTableElement>(null);
     const columns = useResizableColumns(tableRef, "recent-activity");

     <div className="overflow-x-auto thin-scrollbar">
       <table ref={tableRef} style={columns.tableStyle} className="w-full min-w-[1100px]">
         <ResizableColGroup columns={columns} />
         <thead><tr>
           <th className="relative overflow-hidden …">
             <button>Date <Icons.sort /></button>
             <ColumnResizeHandle columns={columns} index={0} label="Date" />
           </th>
           …
           <th className="relative …">Actions</th>   // the last: no handle
         </tr></thead>
         <tbody>… cells with `truncate` (they ellipsize) …</tbody>
       </table>
     </div>

   useResizableColumns(tableRef, storageKey) → { widths, tableStyle,
   startResize, resizeBy, reset, draggingIndex }. Spread `tableStyle` on the
   <table>, render <ResizableColGroup columns /> as its first child and a
   <ColumnResizeHandle columns index label /> inside every header that should
   resize (each <th> needs `relative`).

   - First paint uses the table's own auto layout. Right after, the header
     widths are measured (or read back from localStorage under
     `col-widths:<storageKey>`), written to the <colgroup>, and the table
     switches to table-layout: fixed.
   - A column never gets narrower than its header's content (the label and
     sort icon) plus the header's padding.
   - The last column has no width of its own: it absorbs whatever is left of
     the scroller, so the table always fills it. When the columns add up to
     more, the table grows and the scroller scrolls.
   - The handle is 9px wide on the header's right edge. Its 1px line is hidden
     until the header row is hovered; over the column (or while dragging it)
     it thickens to 2px --neutral-72; focused, it's the ring blue.
   - Widths persist per table in localStorage (a per-viewer convenience;
     every access is wrapped, so a blocked store just means no memory). */

const STEP = 16;

export interface ResizableColumns {
  /* Measured px widths per header cell, or null before the first measure. */
  widths: number[] | null;
  tableStyle: React.CSSProperties | undefined;
  startResize: (index: number, event: React.PointerEvent<HTMLElement>) => void;
  resizeBy: (index: number, delta: number) => void;
  reset: () => void;
  draggingIndex: number | null;
}

const keyOf = (storageKey: string) => `col-widths:${storageKey}`;

function readStored(storageKey: string): number[] | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(keyOf(storageKey)) ?? "null");
    return Array.isArray(v) && v.every((n) => typeof n === "number" && n > 0) ? v : null;
  } catch {
    return null;
  }
}

function writeStored(storageKey: string, widths: number[] | null) {
  try {
    if (widths) localStorage.setItem(keyOf(storageKey), JSON.stringify(widths));
    else localStorage.removeItem(keyOf(storageKey));
  } catch {
    /* Storage blocked or full: widths just won't be remembered. */
  }
}

/* The header row: the <thead>'s, or (for a table whose header repeats in
   each group, like the Transactions months) the first row marked
   `data-head-row`. */
function headerCells(table: HTMLTableElement | null): HTMLTableCellElement[] {
  const row = table?.tHead?.rows[0] ?? table?.querySelector<HTMLTableRowElement>("tr[data-head-row]");
  return row ? Array.from(row.cells) : [];
}

/* The header's content (its first element: the label + sort icon) plus its
   padding, plus a hair so the content never touches the handle. */
function minWidthOf(th: HTMLTableCellElement): number {
  const cs = getComputedStyle(th);
  const inner = th.firstElementChild as HTMLElement | null;
  return Math.ceil(
    (inner ? inner.scrollWidth : 0) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 4,
  );
}

export function useResizableColumns(
  tableRef: React.RefObject<HTMLTableElement | null>,
  storageKey: string,
): ResizableColumns {
  const [widths, setWidths] = React.useState<number[] | null>(null);
  /* The last column's minimum: with the others, the table's least width. */
  const [lastMin, setLastMin] = React.useState(0);
  const [scrollerWidth, setScrollerWidth] = React.useState(0);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const widthsRef = React.useRef(widths);
  /* Set by a drag or key press; the widths are saved once it settles. */
  const unsaved = React.useRef(false);

  React.useLayoutEffect(() => {
    widthsRef.current = widths;
  });

  /* Measure (or restore) whenever there are no widths for the current
     header: on mount, after a reset, or when the column count changes. */
  React.useLayoutEffect(() => {
    const table = tableRef.current;
    const ths = headerCells(table);
    if (!table || !ths.length || table.offsetWidth === 0) return;
    if (widths && widths.length === ths.length) return;
    if (widths) {
      /* Column count changed under fixed layout: measure from auto again. */
      setWidths(null);
      return;
    }
    setLastMin(minWidthOf(ths[ths.length - 1]));
    const stored = readStored(storageKey);
    setWidths(
      stored && stored.length === ths.length
        ? stored
        : ths.map((th) => Math.max(minWidthOf(th), Math.round(th.getBoundingClientRect().width))),
    );
  });

  React.useEffect(() => {
    if (unsaved.current && draggingIndex === null) {
      unsaved.current = false;
      writeStored(storageKey, widths);
    }
  }, [widths, draggingIndex, storageKey]);

  /* The scroller's width: the floor for the table, so the last column can
     take up the slack. */
  React.useLayoutEffect(() => {
    const scroller = tableRef.current?.parentElement;
    if (!scroller) return;
    setScrollerWidth(scroller.clientWidth);
    const ro = new ResizeObserver(() => setScrollerWidth(scroller.clientWidth));
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [tableRef]);

  const set = React.useCallback(
    (index: number, width: number) => {
      const th = headerCells(tableRef.current)[index];
      setWidths((ws) => {
        if (!ws || !th) return ws;
        const next = [...ws];
        next[index] = Math.max(minWidthOf(th), Math.round(width));
        return next;
      });
    },
    [tableRef],
  );

  const startResize = React.useCallback(
    (index: number, event: React.PointerEvent<HTMLElement>) => {
      const ws = widthsRef.current;
      if (!ws) return;
      event.preventDefault();
      event.stopPropagation();
      const handle = event.currentTarget;
      const x0 = event.clientX;
      const w0 = ws[index];
      handle.setPointerCapture(event.pointerId);
      setDraggingIndex(index);
      document.documentElement.classList.add("col-resizing");
      const move = (e: PointerEvent) => set(index, w0 + e.clientX - x0);
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        document.documentElement.classList.remove("col-resizing");
        unsaved.current = true;
        setDraggingIndex(null);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    },
    [set],
  );

  const resizeBy = React.useCallback(
    (index: number, delta: number) => {
      const ws = widthsRef.current;
      if (!ws) return;
      unsaved.current = true;
      set(index, ws[index] + delta);
    },
    [set],
  );

  const reset = React.useCallback(() => {
    writeStored(storageKey, null);
    setWidths(null);
  }, [storageKey]);

  let tableStyle: React.CSSProperties | undefined;
  if (widths) {
    const sum = widths.slice(0, -1).reduce((a, b) => a + b, 0) + lastMin;
    tableStyle = { tableLayout: "fixed", minWidth: 0, width: Math.max(scrollerWidth, sum) };
  }

  return { widths, tableStyle, startResize, resizeBy, reset, draggingIndex };
}

/* The table's first child: one <col> per header, the last left free. */
export function ResizableColGroup({ columns }: { columns: ResizableColumns }) {
  if (!columns.widths) return null;
  const last = columns.widths.length - 1;
  return (
    <colgroup>
      {columns.widths.map((w, i) => (
        <col key={i} style={i < last ? { width: w } : undefined} />
      ))}
    </colgroup>
  );
}

export function ColumnResizeHandle({
  columns,
  index,
  label,
}: {
  columns: ResizableColumns;
  index: number;
  /* The column's name, for "Resize Date column". */
  label: string;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      tabIndex={0}
      data-dragging={columns.draggingIndex === index ? "" : undefined}
      onPointerDown={(e) => columns.startResize(index, e)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        columns.reset();
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        columns.resizeBy(index, e.key === "ArrowRight" ? STEP : -STEP);
      }}
      className={cn(
        "absolute inset-y-2.5 -end-1 z-2 flex w-2.25 cursor-col-resize touch-none justify-center outline-none",
        "after:h-full after:w-px after:bg-transparent after:transition-[background-color,width] after:duration-fast",
        "in-[thead:hover]:after:bg-border-subtle in-[[data-head-row]:hover]:after:bg-border-subtle",
        "in-[th:hover]:after:w-0.5 in-[th:hover]:after:bg-(--neutral-72) hover:after:w-0.5 hover:after:bg-(--neutral-72) data-dragging:after:w-0.5 data-dragging:after:bg-(--neutral-72)",
        "focus-visible:after:bg-ring",
      )}
    />
  );
}
