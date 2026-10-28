import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gridpulse-color-scheme";

function readInitialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "light dark") {
      return saved;
    }
  } catch (_) {
    // Ignore blocked storage
  }
  // Explicit product design requirement: warm paper light mode is the default
  return "light";
}

function applyMetaColorScheme(mode) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", mode);
  }
}

/**
 * Tri-state color-scheme manager ("light" default | "dark" | "light dark" system)
 * synced to <meta name="color-scheme">, CSS light-dark(), storage events, and OS changes.
 */
export function useTheme() {
  const [mode, setModeState] = useState(readInitialMode);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  useEffect(() => {
    applyMetaColorScheme(mode);
  }, [mode]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const next = e.newValue === "dark" || e.newValue === "light dark" ? e.newValue : "light";
        setModeState(next);
        applyMetaColorScheme(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((nextMode) => {
    setModeState(nextMode);
    applyMetaColorScheme(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch (_) {
      // Ensure theme applies to page even if localStorage is unavailable
    }
  }, []);

  const resolvedScheme = mode === "light dark" ? (systemDark ? "dark" : "light") : mode;

  return { mode, setMode, systemDark, resolvedScheme };
}
