// useListNav.js — Keyboard control for any suggestion list or dropdown menu.
//   ↓ / ↑  move the highlight (wraps round at the ends)
//   Enter  picks the highlighted item          Esc  closes the list
// The highlighted item scrolls into view, and hovering with the mouse moves the highlight too,
// so mouse and keyboard always agree on which item is "current".
//
// Usage:
//   const nav = useListNav({ count, open, onSelect: (i) => pick(items[i]), onClose, onOpen });
//   <input onKeyDown={nav.onKeyDown} … />
//   <ul ref={nav.listRef}> {items.map((it, i) => <li {...nav.itemProps(i)} className={nav.active === i ? "bg-indigo-50" : ""}>)} </ul>
//
// Options:
//   onOpen      — called on ↓ / ↑ while the list is closed (re-opens it)
//   initial     — index highlighted when the list opens (default: none)
//   focusItems  — move real focus onto the items (for menus of buttons, not search boxes)
import { useEffect, useRef, useState } from "react";

export function useListNav({ count, open, onSelect, onClose, onOpen, initial = -1, focusItems = false }) {
  const [active, setActive] = useState(open ? initial : -1);
  const listRef = useRef(null);

  // A new list — opened, closed or a different length — starts fresh
  useEffect(() => {
    setActive(open ? initial : -1);
  }, [open, count, initial]);

  // Keep the highlighted item visible (and focused, for menus)
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-nav-index="${active}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    if (focusItems) el.focus({ preventScroll: true });
  }, [active, focusItems]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      if (open && onClose) { e.preventDefault(); onClose(); }
      return;
    }
    if (!open || count === 0) {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && count > 0 && onOpen) {
        e.preventDefault();
        onOpen();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && active < count) {
      e.preventDefault();
      onSelect?.(active);
    }
  };

  const itemProps = (i) => ({
    "data-nav-index": i,
    onMouseEnter: () => setActive(i),
  });

  return { active, setActive, onKeyDown, listRef, itemProps };
}
