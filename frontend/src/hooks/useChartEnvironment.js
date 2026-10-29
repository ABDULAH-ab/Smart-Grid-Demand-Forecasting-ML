import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

/**
 * Interactive 1D series zoom, pan, wheel-zoom, and drag-selection controller
 * for Recharts time-series and diurnal strip charts.
 * Supports either internal state or shared parent { range, setRange } state.
 */
export function useSeriesZoom(data = [], keyField = "timestamp", externalZoom = null) {
  const total = data.length;
  const minWindow = Math.min(total, Math.max(6, Math.ceil(total * 0.05)));

  const [internalRange, setInternalRange] = useState(null);
  const range = externalZoom ? externalZoom.range : internalRange;
  const setRange = externalZoom ? externalZoom.setRange : setInternalRange;

  const [dragStartKey, setDragStartKey] = useState(null);
  const [dragCurrKey, setDragCurrKey] = useState(null);
  const [wheelActive, setWheelActive] = useState(false);
  const stageRef = useRef(null);

  // Reset zoom when the time/axis span changes (e.g. new start/end date),
  // while preserving zoom when switching cities across the identical window.
  const firstKey = total > 0 ? String(data[0]?.[keyField] ?? "") : "";
  const lastKey = total > 0 ? String(data[total - 1]?.[keyField] ?? "") : "";
  const domainSignature = `${total}|${firstKey}|${lastKey}`;
  const prevSigRef = useRef(domainSignature);

  useEffect(() => {
    if (prevSigRef.current !== domainSignature) {
      prevSigRef.current = domainSignature;
      setRange(null);
      setDragStartKey(null);
      setDragCurrKey(null);
    }
  }, [domainSignature, setRange]);

  const [startIdx, endIdx] = useMemo(() => {
    if (!total) return [0, 0];
    if (!range) return [0, total - 1];
    const s = Math.max(0, Math.min(total - 1, range[0]));
    const e = Math.max(s, Math.min(total - 1, range[1]));
    return [s, e];
  }, [range, total]);

  const visibleData = useMemo(() => {
    if (!total) return [];
    if (startIdx === 0 && endIdx === total - 1) return data;
    return data.slice(startIdx, endIdx + 1);
  }, [data, total, startIdx, endIdx]);

  const curSpan = Math.max(1, endIdx - startIdx + 1);
  const isZoomed = total > minWindow && (startIdx > 0 || endIdx < total - 1);
  const canZoomIn = total > minWindow && curSpan > minWindow;
  const zoomFactor = total > 0 ? total / curSpan : 1;

  const applyClampedWindow = useCallback(
    (nextStart, nextEnd) => {
      if (total <= minWindow) {
        setRange(null);
        return;
      }
      let s = Math.round(nextStart);
      let e = Math.round(nextEnd);
      const span = e - s + 1;
      if (span >= total) {
        setRange(null);
        return;
      }
      if (span < minWindow) {
        const mid = (s + e) / 2;
        s = Math.round(mid - minWindow / 2);
        e = s + minWindow - 1;
      }
      if (s < 0) {
        e -= s;
        s = 0;
      }
      if (e >= total) {
        s -= e - (total - 1);
        e = total - 1;
      }
      s = Math.max(0, s);
      setRange([s, e]);
    },
    [total, minWindow, setRange]
  );

  const zoomByFactor = useCallback(
    (factor, anchorRatio = 0.5) => {
      if (total <= minWindow) return;
      const spanNow = endIdx - startIdx + 1;
      const nextSpan = spanNow / factor;
      const anchor = startIdx + spanNow * anchorRatio;
      const nextStart = anchor - nextSpan * anchorRatio;
      const nextEnd = nextStart + nextSpan - 1;
      applyClampedWindow(nextStart, nextEnd);
    },
    [total, minWindow, startIdx, endIdx, applyClampedWindow]
  );

  const zoomIn = useCallback(() => zoomByFactor(1.6, 0.5), [zoomByFactor]);
  const zoomOut = useCallback(() => zoomByFactor(1 / 1.6, 0.5), [zoomByFactor]);
  const resetZoom = useCallback(() => {
    setRange(null);
    setDragStartKey(null);
    setDragCurrKey(null);
  }, [setRange]);

  const panBy = useCallback(
    (direction) => {
      if (!isZoomed) return;
      const spanNow = endIdx - startIdx + 1;
      const step = Math.max(1, Math.round(spanNow * 0.25)) * direction;
      applyClampedWindow(startIdx + step, endIdx + step);
    },
    [isZoomed, startIdx, endIdx, applyClampedWindow]
  );

  // Mouse drag-to-zoom handlers for Recharts <LineChart> / <ComposedChart>
  const onChartMouseDown = useCallback((state) => {
    if (state && state.activeLabel !== undefined && state.activeLabel !== null) {
      setDragStartKey(state.activeLabel);
      setDragCurrKey(state.activeLabel);
    }
  }, []);

  const onChartMouseMove = useCallback(
    (state) => {
      if (
        dragStartKey !== null &&
        state &&
        state.activeLabel !== undefined &&
        state.activeLabel !== null
      ) {
        setDragCurrKey(state.activeLabel);
      }
    },
    [dragStartKey]
  );

  const commitDragSelection = useCallback(() => {
    if (dragStartKey !== null && dragCurrKey !== null && dragStartKey !== dragCurrKey) {
      const idxA = data.findIndex((d) => d[keyField] === dragStartKey);
      const idxB = data.findIndex((d) => d[keyField] === dragCurrKey);
      if (idxA !== -1 && idxB !== -1 && Math.abs(idxB - idxA) >= 2) {
        applyClampedWindow(Math.min(idxA, idxB), Math.max(idxA, idxB));
      }
    }
    setDragStartKey(null);
    setDragCurrKey(null);
  }, [dragStartKey, dragCurrKey, data, keyField, applyClampedWindow]);

  // Ensure releasing mouse outside the SVG still commits or clears drag selection
  useEffect(() => {
    if (dragStartKey === null) return undefined;
    const onWindowUp = () => commitDragSelection();
    window.addEventListener("mouseup", onWindowUp);
    return () => window.removeEventListener("mouseup", onWindowUp);
  }, [dragStartKey, commitDragSelection]);

  // Native non-passive wheel listener for smooth cursor-anchored wheel zoom & trackpad pan
  useEffect(() => {
    const el = stageRef.current;
    if (!el || total <= minWindow) return undefined;

    const onWheel = (e) => {
      if (isZoomed && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
        e.preventDefault();
        panBy(e.deltaX > 0 ? 1 : -1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !wheelActive && !isZoomed) {
        return;
      }
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width))
      );
      const factor = e.deltaY < 0 ? 1.28 : 1 / 1.28;
      zoomByFactor(factor, ratio);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [total, minWindow, wheelActive, isZoomed, zoomByFactor, panBy]);

  return {
    stageRef,
    visibleData,
    startIdx,
    endIdx,
    total,
    isZoomed,
    canZoomIn,
    zoomFactor,
    zoomIn,
    zoomOut,
    resetZoom,
    panLeft: () => panBy(-1),
    panRight: () => panBy(1),
    applyClampedWindow,
    wheelActive,
    setWheelActive,
    dragStartKey,
    dragCurrKey,
    onChartMouseDown,
    onChartMouseMove,
    onChartMouseUp: commitDragSelection,
  };
}
