import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CLUSTER_GLYPHS, getCityMeta } from "../../constants/cities";
import { useContainerWidth, useReducedMotion } from "../../hooks/useChartEnvironment";
import { ClusterGlyph } from "../StatusViews";
import ChartZoomToolbar from "./ChartZoomToolbar";

const VIEW_W = 720;
const VIEW_H = 440;
const PAD = { top: 26, right: 24, bottom: 38, left: 48 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const MAX_SCALE = 10;

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

function clampCenter(c, scale) {
  if (scale <= 1) return 0.5;
  const half = 0.5 / scale;
  return clamp(c, half, 1 - half);
}

function glyphSubpath(shape, x, y, r = 2.9) {
  const cx = Number(x.toFixed(1));
  const cy = Number(y.toFixed(1));
  switch (shape) {
    case "diamond":
      return `M${cx},${(cy - r * 1.15).toFixed(1)}L${(cx + r * 1.15).toFixed(1)},${cy}L${cx},${(
        cy +
        r * 1.15
      ).toFixed(1)}L${(cx - r * 1.15).toFixed(1)},${cy}Z`;
    case "square":
    case "hollow-square":
      return `M${(cx - r * 0.88).toFixed(1)},${(cy - r * 0.88).toFixed(1)}h${(r * 1.76).toFixed(
        1
      )}v${(r * 1.76).toFixed(1)}h-${(r * 1.76).toFixed(1)}Z`;
    case "triangle":
      return `M${cx},${(cy - r * 1.15).toFixed(1)}L${(cx + r * 1.1).toFixed(1)},${(
        cy + r
      ).toFixed(1)}L${(cx - r * 1.1).toFixed(1)},${(cy + r).toFixed(1)}Z`;
    case "inv-triangle":
      return `M${(cx - r * 1.1).toFixed(1)},${(cy - r).toFixed(1)}L${(cx + r * 1.1).toFixed(
        1
      )},${(cy - r).toFixed(1)}L${cx},${(cy + r * 1.15).toFixed(1)}Z`;
    case "cross":
      return `M${(cx - r).toFixed(1)},${cy}L${(cx + r).toFixed(1)},${cy}M${cx},${(
        cy - r
      ).toFixed(1)}L${cx},${(cy + r).toFixed(1)}`;
    case "circle":
    case "ring":
    default:
      return `M${(cx - r).toFixed(1)},${cy}a${r},${r} 0 1,0 ${(r * 2).toFixed(
        1
      )},0a${r},${r} 0 1,0 -${(r * 2).toFixed(1)},0`;
  }
}

function computeNormalizedLayout(points, projection, selectedK) {
  if (!points.length) {
    return {
      coords: [],
      dMinX: -1,
      dMaxX: 1,
      dMinY: -1,
      dMaxY: 1,
      clusterStats: [],
    };
  }

  const xKey = projection === "tsne" ? "tsne_1" : "pca_1";
  const yKey = projection === "tsne" ? "tsne_2" : "pca_2";

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    const vx = Number(p[xKey]);
    const vy = Number(p[yKey]);
    if (vx < minX) minX = vx;
    if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
  }

  const padX = Math.max((maxX - minX) * 0.07, 0.5);
  const padY = Math.max((maxY - minY) * 0.07, 0.5);
  const dMinX = minX - padX;
  const dMaxX = maxX + padX;
  const dMinY = minY - padY;
  const dMaxY = maxY + padY;
  const spanX = Math.max(dMaxX - dMinX, 1e-6);
  const spanY = Math.max(dMaxY - dMinY, 1e-6);

  const accum = Array.from({ length: selectedK }, (_, c) => ({
    cid: c,
    count: 0,
    sumDemand: 0,
    sumTemp: 0,
  }));

  const coords = points.map((p) => {
    const cid = Number(p.cluster) % selectedK;
    if (accum[cid]) {
      accum[cid].count += 1;
      accum[cid].sumDemand += Number(p.demand) || 0;
      accum[cid].sumTemp += Number(p.temperature) || 0;
    }
    return {
      ...p,
      cid,
      tux: (Number(p[xKey]) - dMinX) / spanX,
      tuy: (Number(p[yKey]) - dMinY) / spanY,
    };
  });

  return {
    coords,
    dMinX,
    dMaxX,
    dMinY,
    dMaxY,
    clusterStats: accum
      .filter((a) => a.count > 0)
      .map((a) => ({
        cid: a.cid,
        count: a.count,
        sharePct: ((a.count / points.length) * 100).toFixed(1),
        meanDemand: a.sumDemand / a.count,
        meanTemp: a.sumTemp / a.count,
      })),
  };
}

/**
 * Interactive 2D Manifold Scatter Plot with:
 * - 60fps requestAnimationFrame coordinate morphing across PCA/t-SNE, city scope, and k changes
 * - Full 2D Zoom & Pan (+ / - / wheel / rubber-band box-zoom at 1x / 2D drag-pan when zoomed)
 * - Interactive cluster spotlighting (hover or pin C0..Ck-1)
 */
export default function ClusterScatterPlot({
  points = [],
  projection = "pca",
  selectedK = 4,
}) {
  const [containerRef] = useContainerWidth(720);
  const reducedMotion = useReducedMotion();
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const prevNormRef = useRef([]);
  const clipId = useId();
  const captionId = useId();

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [pinnedCluster, setPinnedCluster] = useState(null);

  // 2D Zoom & Pan State in normalized [0..1] manifold space
  const [zoomView, setZoomView] = useState({ scale: 1, cx: 0.5, cy: 0.5 });
  const [wheelActive, setWheelActive] = useState(false);
  const [dragBox, setDragBox] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const gestureRef = useRef(null);
  const [isMorphing, setIsMorphing] = useState(false);

  const spotlightCluster = hoveredCluster ?? pinnedCluster;
  const isZoomed = zoomView.scale > 1.02;

  useEffect(() => {
    if (pinnedCluster !== null && pinnedCluster >= selectedK) {
      setPinnedCluster(null);
    }
  }, [selectedK, pinnedCluster]);

  // Reset 2D zoom when projection embedding switches (PCA <-> t-SNE have distinct axes)
  useEffect(() => {
    setZoomView({ scale: 1, cx: 0.5, cy: 0.5 });
  }, [projection]);

  const targetLayout = useMemo(
    () => computeNormalizedLayout(points, projection, selectedK),
    [points, projection, selectedK]
  );

  const [animatedNorm, setAnimatedNorm] = useState(targetLayout.coords);

  // Smooth 60fps coordinate morph when switching PCA <-> t-SNE, city scope, or k
  useEffect(() => {
    const target = targetLayout.coords;
    if (!target.length) {
      setAnimatedNorm([]);
      prevNormRef.current = [];
      return undefined;
    }

    const prev = prevNormRef.current;
    if (reducedMotion || prev.length === 0) {
      const snapped = target.map((pt) => ({ ...pt, ux: pt.tux, uy: pt.tuy }));
      setAnimatedNorm(snapped);
      prevNormRef.current = snapped;
      setIsMorphing(false);
      return undefined;
    }

    // Map every target point from previous point (modulo length so city switches also morph smoothly!)
    const startSnap = target.map((_, i) => {
      const src = prev[i % prev.length];
      return { ux: src.ux ?? src.tux ?? 0.5, uy: src.uy ?? src.tuy ?? 0.5 };
    });

    // Check if coordinates actually moved (e.g. PCA <-> t-SNE or city switch)
    let maxDelta = 0;
    for (let i = 0; i < Math.min(target.length, 40); i += 1) {
      const d =
        Math.abs(target[i].tux - startSnap[i].ux) + Math.abs(target[i].tuy - startSnap[i].uy);
      if (d > maxDelta) maxDelta = d;
    }

    if (maxDelta < 1e-4) {
      const updated = target.map((pt) => ({ ...pt, ux: pt.tux, uy: pt.tuy }));
      setAnimatedNorm(updated);
      prevNormRef.current = updated;
      setIsMorphing(false);
      return undefined;
    }

    setIsMorphing(true);
    const duration = 420;
    const t0 = performance.now();
    let rafId = 0;

    const tick = (now) => {
      const rawT = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - rawT, 3);
      const frame = target.map((pt, i) => ({
        ...pt,
        ux: startSnap[i].ux + (pt.tux - startSnap[i].ux) * ease,
        uy: startSnap[i].uy + (pt.tuy - startSnap[i].uy) * ease,
      }));
      setAnimatedNorm(frame);
      prevNormRef.current = frame;
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setIsMorphing(false);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetLayout, reducedMotion]);

  // Zoom & Pan Helpers
  const zoomAt = useCallback((factor, rx = 0.5, ry = 0.5) => {
    setZoomView((prev) => {
      const nextScale = clamp(prev.scale * factor, 1, MAX_SCALE);
      if (nextScale <= 1.01) {
        return { scale: 1, cx: 0.5, cy: 0.5 };
      }
      const prevHalf = 0.5 / prev.scale;
      const uMinX = prev.cx - prevHalf;
      const uMinY = prev.cy - prevHalf;
      const anchorUx = uMinX + rx / prev.scale;
      const anchorUy = uMinY + ry / prev.scale;
      const nextCx = clampCenter(anchorUx - rx / nextScale + 0.5 / nextScale, nextScale);
      const nextCy = clampCenter(anchorUy - ry / nextScale + 0.5 / nextScale, nextScale);
      return { scale: nextScale, cx: nextCx, cy: nextCy };
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomView({ scale: 1, cx: 0.5, cy: 0.5 });
    setDragBox(null);
  }, []);

  const panStepX = useCallback((dir) => {
    setZoomView((prev) => {
      if (prev.scale <= 1.01) return prev;
      const step = (0.24 / prev.scale) * dir;
      return { ...prev, cx: clampCenter(prev.cx + step, prev.scale) };
    });
  }, []);

  // Native non-passive wheel listener for cursor-anchored 2D zoom & trackpad pan
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !wheelActive && !isZoomed) {
        return;
      }
      e.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * VIEW_W;
      const my = ((e.clientY - rect.top) / Math.max(1, rect.height)) * VIEW_H;
      const rx = clamp((mx - PAD.left) / PLOT_W, 0, 1);
      const ry = clamp(1 - (my - PAD.top) / PLOT_H, 0, 1);
      const factor = e.deltaY < 0 ? 1.28 : 1 / 1.28;
      zoomAt(factor, rx, ry);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelActive, isZoomed, zoomAt]);

  // Project normalized animated coordinates through active 2D zoomView
  const { screenPoints, clusterPaths, centroids, xTicks, yTicks, zeroX, zeroY } = useMemo(() => {
    const half = 0.5 / zoomView.scale;
    const uMinX = zoomView.cx - half;
    const uMaxX = zoomView.cx + half;
    const uMinY = zoomView.cy - half;
    const uMaxY = zoomView.cy + half;
    const uSpanX = Math.max(uMaxX - uMinX, 1e-6);
    const uSpanY = Math.max(uMaxY - uMinY, 1e-6);

    const toSx = (ux) => PAD.left + ((ux - uMinX) / uSpanX) * PLOT_W;
    const toSy = (uy) => PAD.top + PLOT_H - ((uy - uMinY) / uSpanY) * PLOT_H;

    const pathBuckets = Array.from({ length: selectedK }, () => []);
    const centAccum = Array.from({ length: selectedK }, (_, c) => ({
      cid: c,
      count: 0,
      sumX: 0,
      sumY: 0,
    }));

    const projected = animatedNorm.map((pt) => {
      const ux = pt.ux ?? pt.tux;
      const uy = pt.uy ?? pt.tuy;
      const sx = toSx(ux);
      const sy = toSy(uy);
      const cid = pt.cid;
      const spec = CLUSTER_GLYPHS[cid % CLUSTER_GLYPHS.length];

      if (
        sx >= PAD.left - 8 &&
        sx <= PAD.left + PLOT_W + 8 &&
        sy >= PAD.top - 8 &&
        sy <= PAD.top + PLOT_H + 8
      ) {
        pathBuckets[cid]?.push(glyphSubpath(spec.shape, sx, sy, 2.9));
      }
      if (centAccum[cid]) {
        centAccum[cid].count += 1;
        centAccum[cid].sumX += sx;
        centAccum[cid].sumY += sy;
      }
      return { ...pt, sx, sy };
    });

    const dataSpanX = targetLayout.dMaxX - targetLayout.dMinX;
    const dataSpanY = targetLayout.dMaxY - targetLayout.dMinY;
    const visMinX = targetLayout.dMinX + uMinX * dataSpanX;
    const visMaxX = targetLayout.dMinX + uMaxX * dataSpanX;
    const visMinY = targetLayout.dMinY + uMinY * dataSpanY;
    const visMaxY = targetLayout.dMinY + uMaxY * dataSpanY;

    const ticksX = Array.from({ length: 5 }, (_, i) => {
      const frac = i / 4;
      return {
        val: visMinX + (visMaxX - visMinX) * frac,
        pos: PAD.left + PLOT_W * frac,
      };
    });

    const ticksY = Array.from({ length: 5 }, (_, i) => {
      const frac = i / 4;
      return {
        val: visMinY + (visMaxY - visMinY) * frac,
        pos: PAD.top + PLOT_H - PLOT_H * frac,
      };
    });

    const zUx = (0 - targetLayout.dMinX) / Math.max(dataSpanX, 1e-6);
    const zUy = (0 - targetLayout.dMinY) / Math.max(dataSpanY, 1e-6);
    const zx = zUx >= uMinX && zUx <= uMaxX ? toSx(zUx) : null;
    const zy = zUy >= uMinY && zUy <= uMaxY ? toSy(zUy) : null;

    return {
      screenPoints: projected,
      clusterPaths: pathBuckets.map((segments, cid) => {
        const spec = CLUSTER_GLYPHS[cid % CLUSTER_GLYPHS.length];
        const isStrokeOnly =
          spec.shape === "cross" || spec.shape === "ring" || spec.shape === "hollow-square";
        return {
          cid,
          d: segments.join(""),
          color: spec.color,
          isStrokeOnly,
        };
      }),
      centroids: centAccum
        .filter((a) => a.count > 0)
        .map((a) => ({
          cid: a.cid,
          sx: a.sumX / a.count,
          sy: a.sumY / a.count,
        })),
      xTicks: ticksX,
      yTicks: ticksY,
      zeroX: zx,
      zeroY: zy,
    };
  }, [animatedNorm, zoomView, selectedK, targetLayout]);

  const toSvgCoords = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      mx: ((e.clientX - rect.left) / Math.max(1, rect.width)) * VIEW_W,
      my: ((e.clientY - rect.top) / Math.max(1, rect.height)) * VIEW_H,
    };
  };

  const handlePointerDown = useCallback(
    (e) => {
      if (!svgRef.current || e.button !== 0) return;
      const { mx, my } = toSvgCoords(e);
      if (
        mx < PAD.left ||
        mx > PAD.left + PLOT_W ||
        my < PAD.top ||
        my > PAD.top + PLOT_H
      ) {
        return;
      }

      if (isZoomed) {
        gestureRef.current = {
          mode: "pan",
          startMx: mx,
          startMy: my,
          startCx: zoomView.cx,
          startCy: zoomView.cy,
          scale: zoomView.scale,
        };
        setIsPanning(true);
      } else {
        gestureRef.current = {
          mode: "box",
          x0: mx,
          y0: my,
          x1: mx,
          y1: my,
        };
        setDragBox({ x0: mx, y0: my, x1: mx, y1: my });
      }
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [isZoomed, zoomView]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!svgRef.current || !screenPoints.length) return;
      const { mx, my } = toSvgCoords(e);

      const g = gestureRef.current;
      if (g?.mode === "pan") {
        const dx = mx - g.startMx;
        const dy = my - g.startMy;
        const nextCx = clampCenter(g.startCx - dx / PLOT_W / g.scale, g.scale);
        const nextCy = clampCenter(g.startCy + dy / PLOT_H / g.scale, g.scale);
        setZoomView((prev) => ({ ...prev, cx: nextCx, cy: nextCy }));
        setHoveredPoint(null);
        return;
      }

      if (g?.mode === "box") {
        const clampedX = clamp(mx, PAD.left, PAD.left + PLOT_W);
        const clampedY = clamp(my, PAD.top, PAD.top + PLOT_H);
        g.x1 = clampedX;
        g.y1 = clampedY;
        setDragBox({ x0: g.x0, y0: g.y0, x1: clampedX, y1: clampedY });
        setHoveredPoint(null);
        return;
      }

      let best = null;
      let bestDistSq = 289;
      for (let i = 0; i < screenPoints.length; i += 1) {
        const pt = screenPoints[i];
        if (spotlightCluster !== null && pt.cid !== spotlightCluster) continue;
        const dx = pt.sx - mx;
        const dy = pt.sy - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          best = pt;
        }
      }
      setHoveredPoint(best);
    },
    [screenPoints, spotlightCluster]
  );

  const handlePointerUp = useCallback(() => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setIsPanning(false);

    if (g?.mode === "box") {
      setDragBox(null);
      const left = Math.min(g.x0, g.x1);
      const right = Math.max(g.x0, g.x1);
      const top = Math.min(g.y0, g.y1);
      const bottom = Math.max(g.y0, g.y1);
      if (right - left >= 18 && bottom - top >= 18) {
        const midRx = ((left + right) / 2 - PAD.left) / PLOT_W;
        const midRy = 1 - ((top + bottom) / 2 - PAD.top) / PLOT_H;
        const frac = Math.max((right - left) / PLOT_W, (bottom - top) / PLOT_H);
        const nextScale = clamp(1 / frac, 1.25, MAX_SCALE);
        setZoomView({
          scale: nextScale,
          cx: clampCenter(midRx, nextScale),
          cy: clampCenter(midRy, nextScale),
        });
      }
    }
  }, []);

  if (!points.length) return null;

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">
            2D MANIFOLD INSTRUMENT // {projection.toUpperCase()} PROJECTION (k = {selectedK})
          </span>
          <h3 className="instrument-title">
            Consumption–Weather State Space ({points.length.toLocaleString()} Hourly Vectors)
          </h3>
          <p className="instrument-subtitle">
            {isZoomed
              ? `Zoomed ${zoomView.scale.toFixed(1)}x — Drag plot to pan 2D · Scroll wheel to zoom · Double-click to reset`
              : `Drag a box on the plane to zoom in 2D · Toggle PCA / t-SNE to animate manifold`}
          </p>
        </div>

        <div className="instrument-header-actions">
          <ChartZoomToolbar
            zoomFactor={zoomView.scale}
            isZoomed={isZoomed}
            canZoomIn={zoomView.scale < MAX_SCALE - 0.1}
            onZoomIn={() => zoomAt(1.6, 0.5, 0.5)}
            onZoomOut={() => zoomAt(1 / 1.6, 0.5, 0.5)}
            onReset={resetZoom}
            onPanLeft={() => panStepX(-1)}
            onPanRight={() => panStepX(1)}
            wheelActive={wheelActive}
            onToggleWheel={() => setWheelActive((v) => !v)}
            canZoom={points.length > 0}
          />
        </div>
      </div>

      {/* Cluster Spotlight Pills */}
      <div
        className="trace-key-list"
        role="toolbar"
        aria-label="Cluster spotlight filters"
        style={{ marginBlockEnd: "0.65rem" }}
      >
        {targetLayout.clusterStats.map((st) => {
          const isPinned = pinnedCluster === st.cid;
          const isDimmed = spotlightCluster !== null && spotlightCluster !== st.cid;
          return (
            <button
              key={st.cid}
              type="button"
              className={`trace-pill ${isPinned ? "is-pinned" : ""} ${
                isDimmed ? "is-dimmed" : ""
              }`}
              onMouseEnter={() => setHoveredCluster(st.cid)}
              onMouseLeave={() => setHoveredCluster(null)}
              onClick={() => setPinnedCluster((prev) => (prev === st.cid ? null : st.cid))}
              aria-pressed={isPinned}
            >
              <ClusterGlyph clusterId={st.cid} size={11} />
              <span>
                C{st.cid} ({st.sharePct}%)
              </span>
            </button>
          );
        })}
      </div>

      {/* Fixed Instrument Telemetry Readout Bar */}
      <div
        className="font-mono"
        style={{
          fontSize: "0.74rem",
          padding: "0.45rem 0.7rem",
          background: "var(--c-vellum)",
          border: "1px solid var(--c-rule-strong)",
          marginBlockEnd: "0.65rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.4rem 0.8rem",
        }}
        aria-live="polite"
      >
        {hoveredPoint ? (
          <>
            <span>
              <strong>CLUSTER C{hoveredPoint.cid}</strong> ·{" "}
              {getCityMeta(hoveredPoint.city).name} ({hoveredPoint.season}, Hr{" "}
              {String(hoveredPoint.hour).padStart(2, "0")}:00)
            </span>
            <span>
              LOAD: <strong>{Number(hoveredPoint.demand).toLocaleString()} MWh</strong> · TEMP:{" "}
              {Number(hoveredPoint.temperature).toFixed(1)}°F · HUM:{" "}
              {Math.round(hoveredPoint.humidity)}%
            </span>
          </>
        ) : (
          <span style={{ color: "var(--c-graphite)" }}>
            CURSOR IDLE — Sweep across projection plane to inspect individual hourly load-weather
            vectors.
          </span>
        )}
      </div>

      <div ref={stageRef} onDoubleClick={resetZoom} className="chart-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{
            inlineSize: "100%",
            blockSize: "auto",
            cursor: isPanning ? "grabbing" : isZoomed ? "grab" : "crosshair",
            touchAction: isZoomed ? "none" : "auto",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (!gestureRef.current) setHoveredPoint(null);
          }}
          role="img"
          aria-label={`${projection.toUpperCase()} scatter projection of ${
            points.length
          } hourly grid demand observations partitioned into ${selectedK} clusters`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="var(--c-paper)"
            stroke="var(--c-ink)"
            strokeWidth="1"
          />

          {xTicks.map((t, idx) => (
            <g key={`xt-${idx}`}>
              <line
                x1={t.pos}
                y1={PAD.top}
                x2={t.pos}
                y2={PAD.top + PLOT_H}
                stroke="var(--c-grid)"
                strokeDasharray="2 3"
              />
              <text
                x={t.pos}
                y={PAD.top + PLOT_H + 16}
                textAnchor="middle"
                fill="var(--c-graphite)"
                fontFamily="var(--font-mono)"
                fontSize="10"
              >
                {t.val.toFixed(zoomView.scale > 2.5 ? 2 : 1)}
              </text>
            </g>
          ))}

          {yTicks.map((t, idx) => (
            <g key={`yt-${idx}`}>
              <line
                x1={PAD.left}
                y1={t.pos}
                x2={PAD.left + PLOT_W}
                y2={t.pos}
                stroke="var(--c-grid)"
                strokeDasharray="2 3"
              />
              <text
                x={PAD.left - 7}
                y={t.pos + 3.5}
                textAnchor="end"
                fill="var(--c-graphite)"
                fontFamily="var(--font-mono)"
                fontSize="10"
              >
                {t.val.toFixed(zoomView.scale > 2.5 ? 2 : 1)}
              </text>
            </g>
          ))}

          {/* Clipped Interior Plot Plane */}
          <g clipPath={`url(#${clipId})`}>
            {zeroX !== null && (
              <line
                x1={zeroX}
                y1={PAD.top}
                x2={zeroX}
                y2={PAD.top + PLOT_H}
                stroke="var(--c-rule-strong)"
                strokeWidth="0.9"
              />
            )}
            {zeroY !== null && (
              <line
                x1={PAD.left}
                y1={zeroY}
                x2={PAD.left + PLOT_W}
                y2={zeroY}
                stroke="var(--c-rule-strong)"
                strokeWidth="0.9"
              />
            )}

            {/* Batched Cluster Paths with Smooth Opacity Spotlight Transition */}
            {clusterPaths.map((cp) => {
              const dimmed = spotlightCluster !== null && spotlightCluster !== cp.cid;
              const opacityVal = dimmed ? 0.1 : spotlightCluster === cp.cid ? 0.96 : 0.8;

              return (
                <path
                  key={cp.cid}
                  d={cp.d}
                  fill={cp.isStrokeOnly ? "none" : cp.color}
                  fillOpacity={cp.isStrokeOnly ? undefined : opacityVal}
                  stroke={cp.isStrokeOnly ? cp.color : "none"}
                  strokeOpacity={cp.isStrokeOnly ? opacityVal : undefined}
                  strokeWidth={cp.isStrokeOnly ? 1.45 : 0}
                  style={{ transition: "fill-opacity 200ms ease, stroke-opacity 200ms ease" }}
                />
              );
            })}

            {/* Animated Cluster Centroid Stamps */}
            {centroids.map((c) => {
              const dimmed = spotlightCluster !== null && spotlightCluster !== c.cid;
              const useCssGlide = !reducedMotion && !isMorphing && !isPanning && ! isZoomed;
              return (
                <g
                  key={`cent-${c.cid}`}
                  style={{
                    transform: `translate(${c.sx.toFixed(1)}px, ${c.sy.toFixed(1)}px)`,
                    opacity: dimmed ? 0.25 : 1,
                    transition: useCssGlide
                      ? "transform 340ms var(--ease-out-quart), opacity 200ms ease"
                      : "opacity 200ms ease",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedCluster((prev) => (prev === c.cid ? null : c.cid));
                  }}
                >
                  <rect
                    x="-13"
                    y="-9"
                    width="26"
                    height="18"
                    fill="var(--c-paper)"
                    stroke={spotlightCluster === c.cid ? "var(--c-signal)" : "var(--c-ink)"}
                    strokeWidth="1.4"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fill={spotlightCluster === c.cid ? "var(--c-signal)" : "var(--c-ink)"}
                    fontFamily="var(--font-mono)"
                    fontSize="9.5"
                    fontWeight="600"
                  >
                    C{c.cid}
                  </text>
                </g>
              );
            })}

            {/* Active Crosshair Reticle on Hovered Point */}
            {hoveredPoint && !dragBox && (
              <g pointerEvents="none">
                <line
                  x1={hoveredPoint.sx}
                  y1={PAD.top}
                  x2={hoveredPoint.sx}
                  y2={PAD.top + PLOT_H}
                  stroke="var(--c-signal)"
                  strokeWidth="0.95"
                  strokeDasharray="3 2"
                />
                <line
                  x1={PAD.left}
                  y1={hoveredPoint.sy}
                  x2={PAD.left + PLOT_W}
                  y2={hoveredPoint.sy}
                  stroke="var(--c-signal)"
                  strokeWidth="0.95"
                  strokeDasharray="3 2"
                />
                <circle
                  cx={hoveredPoint.sx}
                  cy={hoveredPoint.sy}
                  r="7.5"
                  fill="none"
                  stroke="var(--c-signal)"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* 2D Rubber-Band Box Zoom Overlay */}
            {dragBox && (
              <rect
                x={Math.min(dragBox.x0, dragBox.x1)}
                y={Math.min(dragBox.y0, dragBox.y1)}
                width={Math.abs(dragBox.x1 - dragBox.x0)}
                height={Math.abs(dragBox.y1 - dragBox.y0)}
                fill="var(--c-signal)"
                fillOpacity="0.14"
                stroke="var(--c-signal)"
                strokeWidth="1.25"
                strokeDasharray="4 2"
                pointerEvents="none"
              />
            )}
          </g>

          <text
            x={PAD.left + PLOT_W / 2}
            y={VIEW_H - 6}
            textAnchor="middle"
            fill="var(--c-ink)"
            fontFamily="var(--font-mono)"
            fontSize="10"
          >
            {projection === "tsne"
              ? "t-SNE Dimension 1"
              : "Principal Component 1 (Thermal & Load Scale)"}
          </text>
          <text
            x={13}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90 13 ${PAD.top + PLOT_H / 2})`}
            fill="var(--c-ink)"
            fontFamily="var(--font-mono)"
            fontSize="10"
          >
            {projection === "tsne"
              ? "t-SNE Dimension 2"
              : "Principal Component 2 (Diurnal & Humidity)"}
          </text>
        </svg>
      </div>

      <details className="chart-table-disclosure">
        <summary>Inspect Live Sample Partition Summary (k = {selectedK})</summary>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper"
          style={{ marginBlockStart: "0.6rem" }}
        >
          <table
            className="gp-table"
            style={{
              "--label-2": '"Sample Count"',
              "--label-3": '"Share"',
              "--label-4": '"Mean Load (MWh)"',
              "--label-5": '"Mean Temp (F)"',
            }}
          >
            <caption id={captionId}>
              Active k={selectedK} partition summary across {points.length} sampled observations
            </caption>
            <thead>
              <tr>
                <th scope="col">Cluster</th>
                <th scope="col" className="align-right">Sample Count</th>
                <th scope="col" className="align-right">Share</th>
                <th scope="col" className="align-right">Mean Load (MWh)</th>
                <th scope="col" className="align-right">Mean Temp (°F)</th>
              </tr>
            </thead>
            <tbody>
              {targetLayout.clusterStats.map((st) => (
                <tr key={st.cid}>
                  <th scope="row">
                    <ClusterGlyph clusterId={st.cid} size={10} />{" "}
                    <span style={{ marginInlineStart: "0.35rem" }}>Cluster C{st.cid}</span>
                  </th>
                  <td className="align-right">{st.count.toLocaleString()}</td>
                  <td className="align-right">{st.sharePct}%</td>
                  <td className="align-right">{st.meanDemand.toFixed(1)}</td>
                  <td className="align-right">{st.meanTemp.toFixed(1)}°F</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
