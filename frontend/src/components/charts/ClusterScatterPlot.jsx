import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CLUSTER_GLYPHS, getCityMeta } from "../../constants/cities";
import { useContainerWidth, useReducedMotion } from "../../hooks/useChartEnvironment";
import { ClusterGlyph } from "../StatusViews";

const VIEW_W = 720;
const VIEW_H = 440;
const PAD = { top: 26, right: 24, bottom: 38, left: 48 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

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

function computeTargetLayout(points, projection, selectedK) {
  if (!points.length) {
    return {
      coords: [],
      xTicks: [],
      yTicks: [],
      zeroX: null,
      zeroY: null,
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

  const toScreenX = (v) => PAD.left + ((v - dMinX) / (dMaxX - dMinX)) * PLOT_W;
  const toScreenY = (v) => PAD.top + PLOT_H - ((v - dMinY) / (dMaxY - dMinY)) * PLOT_H;

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
      tx: toScreenX(Number(p[xKey])),
      ty: toScreenY(Number(p[yKey])),
    };
  });

  const makeTicks = (lo, hi, steps = 5) =>
    Array.from({ length: steps }, (_, i) => lo + ((hi - lo) * i) / (steps - 1));

  return {
    coords,
    xTicks: makeTicks(dMinX, dMaxX, 5).map((v) => ({ val: v, pos: toScreenX(v) })),
    yTicks: makeTicks(dMinY, dMaxY, 5).map((v) => ({ val: v, pos: toScreenY(v) })),
    zeroX: dMinX <= 0 && dMaxX >= 0 ? toScreenX(0) : null,
    zeroY: dMinY <= 0 && dMaxY >= 0 ? toScreenY(0) : null,
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
 * - 60fps requestAnimationFrame coordinate morphing between PCA and t-SNE
 * - Interactive cluster spotlighting (hover or pin C0..Ck-1)
 * - Smooth responsive SVG aspect adaptation across mobile, tablet, and desktop
 */
export default function ClusterScatterPlot({
  points = [],
  projection = "pca",
  selectedK = 4,
}) {
  const [containerRef] = useContainerWidth(720);
  const reducedMotion = useReducedMotion();
  const svgRef = useRef(null);
  const prevPositionsRef = useRef([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [pinnedCluster, setPinnedCluster] = useState(null);
  const captionId = useId();

  const spotlightCluster = hoveredCluster ?? pinnedCluster;

  useEffect(() => {
    if (pinnedCluster !== null && pinnedCluster >= selectedK) {
      setPinnedCluster(null);
    }
  }, [selectedK, pinnedCluster]);

  const targetLayout = useMemo(
    () => computeTargetLayout(points, projection, selectedK),
    [points, projection, selectedK]
  );

  const [animatedCoords, setAnimatedCoords] = useState(targetLayout.coords);

  // Smooth 60fps coordinate morph when switching PCA <-> t-SNE or re-clustering
  useEffect(() => {
    const target = targetLayout.coords;
    if (!target.length) {
      setAnimatedCoords([]);
      prevPositionsRef.current = [];
      return undefined;
    }

    const prev = prevPositionsRef.current;
    if (reducedMotion || prev.length !== target.length) {
      const snapped = target.map((pt) => ({ ...pt, sx: pt.tx, sy: pt.ty }));
      setAnimatedCoords(snapped);
      prevPositionsRef.current = snapped;
      return undefined;
    }

    const startSnap = prev.map((p) => ({ sx: p.sx, sy: p.sy }));
    const duration = 420;
    const t0 = performance.now();
    let rafId = 0;

    const tick = (now) => {
      const rawT = Math.min(1, (now - t0) / duration);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - rawT, 3);
      const frame = target.map((pt, i) => ({
        ...pt,
        sx: startSnap[i].sx + (pt.tx - startSnap[i].sx) * ease,
        sy: startSnap[i].sy + (pt.ty - startSnap[i].sy) * ease,
      }));
      setAnimatedCoords(frame);
      prevPositionsRef.current = frame;
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetLayout, reducedMotion]);

  const { clusterPaths, centroids } = useMemo(() => {
    const pathBuckets = Array.from({ length: selectedK }, () => []);
    const centAccum = Array.from({ length: selectedK }, (_, c) => ({
      cid: c,
      count: 0,
      sumX: 0,
      sumY: 0,
    }));

    for (const pt of animatedCoords) {
      const cid = pt.cid;
      const spec = CLUSTER_GLYPHS[cid % CLUSTER_GLYPHS.length];
      const sx = pt.sx ?? pt.tx;
      const sy = pt.sy ?? pt.ty;
      pathBuckets[cid]?.push(glyphSubpath(spec.shape, sx, sy, 2.85));
      if (centAccum[cid]) {
        centAccum[cid].count += 1;
        centAccum[cid].sumX += sx;
        centAccum[cid].sumY += sy;
      }
    }

    return {
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
    };
  }, [animatedCoords, selectedK]);

  const handlePointerMove = useCallback(
    (e) => {
      if (!svgRef.current || !animatedCoords.length) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const my = ((e.clientY - rect.top) / rect.height) * VIEW_H;

      let best = null;
      let bestDistSq = 289;
      for (let i = 0; i < animatedCoords.length; i += 1) {
        const pt = animatedCoords[i];
        if (spotlightCluster !== null && pt.cid !== spotlightCluster) continue;
        const sx = pt.sx ?? pt.tx;
        const sy = pt.sy ?? pt.ty;
        const dx = sx - mx;
        const dy = sy - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          best = { ...pt, sx, sy };
        }
      }
      setHoveredPoint(best);
    },
    [animatedCoords, spotlightCluster]
  );

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
            Toggle PCA / t-SNE to animate coordinate manifold · Hover or click C0–C
            {selectedK - 1} to isolate a regime
          </p>
        </div>

        <div className="trace-key-list" role="toolbar" aria-label="Cluster spotlight filters">
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

      <div className="chart-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ inlineSize: "100%", blockSize: "auto", cursor: "crosshair" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredPoint(null)}
          role="img"
          aria-label={`${projection.toUpperCase()} scatter projection of ${
            points.length
          } hourly grid demand observations partitioned into ${selectedK} clusters`}
        >
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="var(--c-paper)"
            stroke="var(--c-ink)"
            strokeWidth="1"
          />

          {targetLayout.xTicks.map((t, idx) => (
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
                {t.val.toFixed(1)}
              </text>
            </g>
          ))}

          {targetLayout.yTicks.map((t, idx) => (
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
                {t.val.toFixed(1)}
              </text>
            </g>
          ))}

          {targetLayout.zeroX !== null && (
            <line
              x1={targetLayout.zeroX}
              y1={PAD.top}
              x2={targetLayout.zeroX}
              y2={PAD.top + PLOT_H}
              stroke="var(--c-rule-strong)"
              strokeWidth="0.9"
            />
          )}
          {targetLayout.zeroY !== null && (
            <line
              x1={PAD.left}
              y1={targetLayout.zeroY}
              x2={PAD.left + PLOT_W}
              y2={targetLayout.zeroY}
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
            return (
              <g
                key={`cent-${c.cid}`}
                transform={`translate(${c.sx.toFixed(1)}, ${c.sy.toFixed(1)})`}
                style={{
                  opacity: dimmed ? 0.25 : 1,
                  transition: "opacity 200ms ease",
                  cursor: "pointer",
                }}
                onClick={() => setPinnedCluster((prev) => (prev === c.cid ? null : c.cid))}
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
          {hoveredPoint && (
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
