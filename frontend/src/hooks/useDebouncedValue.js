import { useEffect, useState } from "react";

/**
 * Debounces rapidly changing control inputs (sliders, date fields)
 * before triggering API calls or expensive recalculations.
 * @template T
 * @param {T} value
 * @param {number} [delayMs=240]
 * @returns {T}
 */
export function useDebouncedValue(value, delayMs = 240) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
