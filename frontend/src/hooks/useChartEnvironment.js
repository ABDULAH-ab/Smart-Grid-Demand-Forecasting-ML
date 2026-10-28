import { useEffect, useRef, useState } from "react";

/**
 * Tracks prefers-reduced-motion so interactive chart animations
 * stay active for standard users and disable cleanly when requested.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Observes the live inline pixel width of a chart wrapper via ResizeObserver
 * so SVG margins, tick density, heights, and callouts adapt across all screens.
 */
export function useContainerWidth(initialWidth = 900) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const update = () => {
      const next = el.clientWidth;
      if (next > 0) setWidth(next);
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect?.width || el.clientWidth;
          if (w > 0) setWidth(Math.round(w));
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return [containerRef, width];
}
