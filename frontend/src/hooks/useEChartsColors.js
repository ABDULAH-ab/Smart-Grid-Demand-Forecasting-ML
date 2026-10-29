import { useMemo } from "react";
import { useTheme } from "./useTheme";

function resolveCssVar(varName, fallback) {
  if (typeof window === "undefined" || !document?.documentElement) return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallback;
}

export function useEChartsColors() {
  const { resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";

  return useMemo(() => {
    const paper = resolveCssVar("--c-paper", isDark ? "#121311" : "#F5F1E8");
    const vellum = resolveCssVar("--c-vellum", isDark ? "#1B1D19" : "#EAE4D7");
    const graphite = resolveCssVar("--c-graphite", isDark ? "#A8A296" : "#524E46");
    const ink = resolveCssVar("--c-ink", isDark ? "#F2EEE4" : "#161614");
    const signal = resolveCssVar("--c-signal", isDark ? "#FF5936" : "#C93818");
    const grid = resolveCssVar(
      "--c-grid",
      isDark ? "rgba(242, 238, 228, 0.12)" : "rgba(22, 22, 20, 0.12)"
    );
    const rule = resolveCssVar(
      "--c-rule",
      isDark ? "rgba(242, 238, 228, 0.18)" : "rgba(22, 22, 20, 0.18)"
    );
    const ruleStrong = resolveCssVar(
      "--c-rule-strong",
      isDark ? "rgba(242, 238, 228, 0.44)" : "rgba(22, 22, 20, 0.44)"
    );

    // Trace inks calibrated per model
    const xgb = resolveCssVar("--c-trace-xgb", isDark ? "#4EA8F0" : "#1464A5");
    const rf = resolveCssVar("--c-trace-rf", isDark ? "#38CB97" : "#117A58");
    const mlp = resolveCssVar("--c-trace-mlp", isDark ? "#F5B841" : "#AD6800");
    const ridge = resolveCssVar("--c-trace-ridge", isDark ? "#E47AC3" : "#8C3470");
    const sarimax = resolveCssVar("--c-trace-sarimax", isDark ? "#4AD4E0" : "#0C7985");
    const naive = resolveCssVar("--c-trace-naive", isDark ? "#9B968B" : "#6E6A60");

    return {
      paper,
      vellum,
      graphite,
      ink,
      signal,
      grid,
      rule,
      ruleStrong,
      xgb,
      rf,
      mlp,
      ridge,
      sarimax,
      naive,
      fontMono: "IBM Plex Mono, monospace",
      fontSans: "Source Sans 3, sans-serif",
      isDark,
    };
  }, [resolvedScheme, isDark]);
}

export function getModelEChartsColor(key, colors) {
  switch (key) {
    case "Stacking_Ensemble":
      return colors.signal;
    case "XGBoost":
      return colors.xgb;
    case "Random_Forest":
      return colors.rf;
    case "Neural_Network_MLP":
      return colors.mlp;
    case "Poly_Ridge":
      return colors.ridge;
    case "SARIMAX":
      return colors.sarimax;
    case "Naive_Baseline":
      return colors.naive;
    default:
      return colors.graphite;
  }
}

