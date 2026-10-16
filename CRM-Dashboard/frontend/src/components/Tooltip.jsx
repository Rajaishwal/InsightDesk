// Tooltip.jsx — Hover / keyboard-focus tooltip in the app's style (white card, soft shadow, little arrow — same look as
// the navbar's break tooltip). Used everywhere instead of the browser's plain `title` tooltip.
//   <Tooltip text="Delete"><button …/></Tooltip>        align: "end" (default) | "center" | "start"
// It attaches straight to its single child element (no wrapper, so layouts don't change — except a disabled child, see below), is drawn in a portal with
// fixed positioning (tables and scroll areas can't clip it), opens below — or above when there's no room — and stays
// inside the window. Only one tooltip is open at a time; an empty `text` renders the child unchanged.
import { Children, cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;    // space between the element and the tooltip
const EDGE = 8;   // keep this far from the window edges

let closeOpenTooltip = null; // closes whichever tooltip is showing, so a new one replaces it

// `full`: the child is full-width (a form field) — keeps the disabled-hover wrapper full-width too
export default function Tooltip({ text, children, align = "end", full = false }) {
  const id = useId();
  const triggerRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [closeMe] = useState(() => () => setOpen(false)); // stable for this tooltip's whole life

  const show = () => {
    if (closeOpenTooltip && closeOpenTooltip !== closeMe) closeOpenTooltip();
    closeOpenTooltip = closeMe;
    setOpen(true);
  };
  const hide = () => {
    if (closeOpenTooltip === closeMe) closeOpenTooltip = null;
    setOpen(false);
  };

  // Measure once it's rendered, then place it
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) { setPos(null); return; }
    const r = triggerRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const below = r.bottom + GAP + t.height <= window.innerHeight - EDGE || r.top - GAP - t.height < EDGE;
    let left = align === "center" ? r.left + r.width / 2 - t.width / 2 : align === "start" ? r.left : r.right - t.width;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - t.width - EDGE));
    const arrowX = Math.min(Math.max(r.left + r.width / 2 - left, 14), t.width - 14); // arrow points at the element
    setPos({ top: below ? r.bottom + GAP : r.top - GAP - t.height, left, below, arrowX });
  }, [open, text, align]);

  // Close if the page scrolls (so it never floats away from its element), and when this element goes away
  useEffect(() => {
    if (!open) return;
    const onScroll = () => { if (closeOpenTooltip === closeMe) closeOpenTooltip = null; closeMe(); };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open, closeMe]);
  useEffect(() => () => { if (closeOpenTooltip === closeMe) closeOpenTooltip = null; }, [closeMe]);

  const child = Children.only(children);
  if (!text) return child;

  // Browsers send no hover events to a disabled button — exactly when a tooltip explains why it's disabled. So a disabled
  // child gets a thin wrapper that takes the hover (and keyboard focus); the child itself ignores the pointer.
  const disabled = !!child.props.disabled;
  const trigger = disabled ? (
    <span
      ref={triggerRef}
      tabIndex={0}
      className={`${full ? "flex w-full rounded-xl" : "inline-flex rounded-full"} cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(child, { style: { ...child.props.style, pointerEvents: "none" }, title: child.props.title ?? "" })}
    </span>
  ) : (() => {
    // Keep the child's own ref and event handlers working alongside ours
    const childRef = child.props.ref;
    const call = (name, e) => child.props[name]?.(e);
    return cloneElement(child, {
      ref: (node) => {
        triggerRef.current = node;
        if (typeof childRef === "function") childRef(node);
        else if (childRef) childRef.current = node;
      },
      onMouseEnter: (e) => { call("onMouseEnter", e); show(); },
      onMouseLeave: (e) => { call("onMouseLeave", e); hide(); },
      onFocus: (e) => { call("onFocus", e); show(); },
      onBlur: (e) => { call("onBlur", e); hide(); },
      "aria-describedby": open ? id : child.props["aria-describedby"],
      // An empty title stops the browser's own plain bubble (e.g. Chrome's "Value must be … or later" on a date field)
      title: child.props.title ?? "",
    });
  })();

  return (
    <>
      {trigger}
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          className="pointer-events-none fixed z-[70]"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
        >
          <div className="relative">
            <div
              className={`absolute h-2 w-2 rotate-45 bg-white border-gray-200 ${pos?.below === false ? "-bottom-1 border-r border-b" : "-top-1 border-l border-t"}`}
              style={{ left: (pos?.arrowX ?? 14) - 4 }}
            />
            <div className="w-max max-w-[260px] whitespace-pre-line rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold leading-snug text-gray-600 shadow-lg">
              {text}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
