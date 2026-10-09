// useCapToFirstN.js — Caps a list to the height of its first N items; the rest scroll.
// Measures the real rendered items (so it fits any card height) and re-measures on window resize.
// Items are the list's direct children, or — for grouped lists — whatever `itemSelector` matches inside it.
// Returns [ref for the list element, maxHeight in px — null when there are N or fewer items].

import { useLayoutEffect, useRef, useState } from "react";

export function useCapToFirstN(n, deps = [], itemSelector = null) {
  const ref = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const list = ref.current;
      const items = list ? (itemSelector ? list.querySelectorAll(itemSelector) : list.children) : [];
      if (!list || items.length <= n) { setMaxHeight(null); return; }
      const nth = items[n - 1].getBoundingClientRect();
      setMaxHeight(Math.ceil(nth.bottom - list.getBoundingClientRect().top + list.scrollTop));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return [ref, maxHeight];
}

// Classes / style for a capped list: scroll only when capped (so dropdowns in short lists are never clipped)
export const capClass = (maxHeight) => (maxHeight ? "overflow-y-auto pr-1 [scrollbar-width:thin]" : "");
export const capStyle = (maxHeight) => (maxHeight ? { maxHeight } : undefined);
