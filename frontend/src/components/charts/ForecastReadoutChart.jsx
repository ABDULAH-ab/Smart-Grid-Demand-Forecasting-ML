import React, { useId, useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FORECAST_MODELS, MODEL_BY_KEY, formatModelName } from "../../constants/cities";
import { useContainerWidth, useReducedMotion } from "../../hooks/useChartEnvironment";

function formatAxisStamp(ts, isCompact) {
  if (!ts || typeof ts !== "string") return "";
  const clean = ts.replace("T", " ");
  const [datePart, timePart = "00:00"] = clean.split(" ");
  const mmdd = datePart.slice(5);
  if (isCompact) return mmdd;
  return `${mmdd} ${timePart.slice(0, 5)}`;
}

function formatYAxisTick(val, isCompact) {
  const num = Number(val);
  if (!Number.isFinite(num)) return "";
  if (isCompact && Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  }
  return num.toLocaleString();
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // Sort tooltip rows descending by MWh value so order matches visual vertical trace stack
  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="gp-tooltip">
      <div className="gp-tooltip-head">{String(label).replace("T", " ").slice(0, 16)} UTC</div>
      {sorted.map((entry) => {
        const isActual = entry.dataKey === "actual_demand";
        const spec = MODEL_BY_KEY[entry.dataKey];
        const swatchColor = isActual ? "var(--c-ink)" : spec?.color || "var(--c-graphite)";

        return (
          <div key={entry.dataKey} className="gp-tooltip-row">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.42rem",
                fontWeight: isActual || entry.dataKey === "Stacking_Ensemble" ? 600 : 400,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  inlineSize: "10px",
                  blockSize: isActual ? "3px" : "2.2px",
                  backgroundColor: swatchColor,
                }}
              />
              <span>{isActual ? "Actual Load" : formatModelName(entry.dataKey)}</span>
            </span>
            <span style={{ fontWeight: 500 }}>
              {Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Custom collision-free Peak Callout SVG renderer:
 * Draws a crisp target ring on the peak point and anchors the badge cleanly
 * in the top margin headroom so it never collides with forecast lines.
 */
function PeakCalloutShape({ cx, cy, valueText }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const badgeY = 6;
  const badgeW = 118;
  const clampedX = Math.max(badgeW / 2 + 48, cx);

  return (
    <g pointerEvents="none">
      <line
        x1={cx}
        y1={badgeY + 16}
        x2={cx}
        y2={cy - 5}
        stroke="var(--c-signal)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--c-paper)"
        stroke="var(--c-signal)"
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={2} fill="var(--c-signal)" />
      <rect
        x={clampedX - badgeW / 2}
        y={badgeY}
        width={badgeW}
        height={17}
        fill="var(--c-paper)"
        stroke="var(--c-signal)"
        strokeWidth="1"
      />
      <text
        x={clampedX}
        y={badgeY + 11.8}
        textAnchor="middle"
        fill="var(--c-signal)"
        fontFamily="var(--font-mono)"
        fontSize="9.5"
        fontWeight="600"
      >
        {valueText}
      </text>
    </g>
  );
}

/**
 * Multi-pen strip-chart recorder readout for Actual vs. Predicted electricity demand.
 * Features:
 * - Distinct multi-pen color + dash cadence per model
 * - Interactive hover & click-to-pin trace spotlighting
 * - Fluid Recharts draw/morph animations (respects prefers-reduced-motion)
 * - Container-aware responsive sizing across 360px phones, tablets, and desktops
 * - Optional interactive time-window Brush zoom scrubber
 */
export default function ForecastReadoutChart({
  series = [],
  activeModels = ["Stacking_Ensemble", "Naive_Baseline"],
  cityLabel = "Dallas",
  height = 360,
  compact = false,
  syncId,
}) {
  const tableCaptionId = useId();
  const [containerRef, containerWidth] = useContainerWidth(900);
  const reducedMotion = useReducedMotion();

  const [hoveredTrace, setHoveredTrace] = useState(null);
  const [pinnedTrace, setPinnedTrace] = useState(null);
  const [showZoomBrush, setShowZoomBrush] = useState(false);

  const spotlightKey = hoveredTrace || pinnedTrace;

  const isMobile = containerWidth < 540;
  const isTablet = containerWidth >= 540 && containerWidth < 860;
  const responsiveHeight = isMobile
    ? Math.min(height, 250)
    : isTablet
    ? Math.min(height, 305)
    : height;

  const { peakPoint, yDomain, lastIndex } = useMemo(() => {
    if (!series.length) {
      return { peakPoint: null, yDomain: [0, 1000], lastIndex: 0 };
    }
    let peak = series[0];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const keysToScan = ["actual_demand", ...activeModels];
    for (const row of series) {
      if (row.actual_demand > (peak?.actual_demand ?? -Infinity)) {
        peak = row;
      }
      for (const k of keysToScan) {
        const v = Number(row[k]);
        if (Number.isFinite(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      }
    }
    const span = Math.max(maxVal - minVal, 100);
    const bottomPad = span * 0.08;
    // Extra top headroom so the peak callout badge never collides with curves
    const topPad = span * 0.2;
    return {
      peakPoint: peak,
      yDomain: [
        Math.max(0, Math.floor((minVal - bottomPad) / 50) * 50),
        Math.ceil((maxVal + topPad) / 50) * 50,
      ],
      lastIndex: series.length - 1,
    };
  }, [series, activeModels]);

  if (!series.length) return null;

  const enabledSpecs = FORECAST_MODELS.filter((m) => activeModels.includes(m.key));
  const tableSampleStep = Math.max(1, Math.floor(series.length / 12));
  const sampledRows = series.filter((_, idx) => idx % tableSampleStep === 0 || idx === lastIndex);

  const togglePin = (key) => {
    setPinnedTrace((prev) => (prev === key ? null : key));
  };

  const getOpacity = (key) => {
    if (!spotlightKey) return 1;
    return spotlightKey === key ? 1 : 0.16;
  };

  const getWidth = (key, baseW) => {
    if (spotlightKey === key) return baseW + 1.0;
    return baseW;
  };

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">STRIP-CHART RECORDER // 24H HORIZON</span>
          <h3 className="instrument-title">
            {cityLabel} — Metered Load vs. Day-Ahead Ensemble Traces
          </h3>
          <p className="instrument-subtitle">
            {series.length.toLocaleString()} hourly intervals ·{" "}
            {String(series[0]?.timestamp).slice(0, 10)} to{" "}
            {String(series[lastIndex]?.timestamp).slice(0, 10)} · Hover or click any pen below to
            spotlight its trace
          </p>
        </div>

        {!compact && series.length > 48 && !isMobile && (
          <button
            type="button"
            className="btn-quiet"
            aria-pressed={showZoomBrush}
            onClick={() => setShowZoomBrush((v) => !v)}
          >
            {showZoomBrush ? "Hide Time Zoom" : "Time Zoom Scrubber"}
          </button>
        )}
      </div>

      {/* Interactive Multi-Pen Legend Bar (Hover or Click to Spotlight) */}
      <div
        className="trace-key-list"
        role="toolbar"
        aria-label="Interactive model trace spotlight controls"
        style={{ marginBlockEnd: "0.75rem" }}
      >
        <button
          type="button"
          className={`trace-pill ${pinnedTrace === "actual_demand" ? "is-pinned" : ""} ${
            spotlightKey && spotlightKey !== "actual_demand" ? "is-dimmed" : ""
          }`}
          onMouseEnter={() => setHoveredTrace("actual_demand")}
          onMouseLeave={() => setHoveredTrace(null)}
          onClick={() => togglePin("actual_demand")}
          aria-pressed={pinnedTrace === "actual_demand"}
        >
          <span className="trace-swatch-heavy" aria-hidden="true" />
          <span>Actual MWh</span>
        </button>

        {enabledSpecs.map((spec) => {
          const isPinned = pinnedTrace === spec.key;
          const isDimmed = spotlightKey && spotlightKey !== spec.key;
          return (
            <button
              key={spec.key}
              type="button"
              className={`trace-pill ${isPinned ? "is-pinned" : ""} ${
                isDimmed ? "is-dimmed" : ""
              }`}
              onMouseEnter={() => setHoveredTrace(spec.key)}
              onMouseLeave={() => setHoveredTrace(null)}
              onClick={() => togglePin(spec.key)}
              aria-pressed={isPinned}
            >
              <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={spec.color}
                  strokeWidth={Math.max(2, spec.strokeWidth)}
                  strokeDasharray={spec.strokeDasharray}
                />
              </svg>
              <span style={{ color: spec.key === "Stacking_Ensemble" ? "var(--c-signal)" : "var(--c-ink)" }}>
                {spec.shortLabel}
              </span>
            </button>
          );
        })}

        {pinnedTrace && (
          <button
            type="button"
            className="btn-quiet"
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem" }}
            onClick={() => setPinnedTrace(null)}
          >
            Clear Spotlight
          </button>
        )}
      </div>

      {/* Responsive 100% Width Plot Stage (Zero inner vertical scrollbars) */}
      <div
        className="chart-stage"
        style={{ blockSize: `${responsiveHeight + (showZoomBrush ? 38 : 0)}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            syncId={syncId}
            margin={{
              top: 28,
              right: isMobile ? 10 : 18,
              left: isMobile ? -4 : 6,
              bottom: 6,
            }}
          >
            <CartesianGrid
              stroke="var(--c-grid)"
              strokeDasharray="2 3"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatAxisStamp(ts, isMobile)}
              minTickGap={isMobile ? 34 : 52}
              stroke="var(--c-ink)"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10.5,
                fill: "var(--c-graphite)",
              }}
              tickLine={{ stroke: "var(--c-ink)" }}
            />
            <YAxis
              domain={yDomain}
              width={isMobile ? 42 : 58}
              tickFormatter={(v) => formatYAxisTick(v, isMobile)}
              stroke="var(--c-ink)"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10.5,
                fill: "var(--c-graphite)",
              }}
              tickLine={{ stroke: "var(--c-ink)" }}
            />
            <Tooltip
              content={<ForecastTooltip />}
              cursor={{ stroke: "var(--c-ink)", strokeWidth: 1, strokeDasharray: "3 3" }}
              isAnimationActive={!reducedMotion}
              animationDuration={110}
            />

            {/* Secondary & Baseline Models with Distinct Multi-Pen Colors */}
            {enabledSpecs
              .filter((m) => m.key !== "Stacking_Ensemble")
              .map((spec) => (
                <Line
                  key={spec.key}
                  type="monotone"
                  dataKey={spec.key}
                  stroke={spec.color}
                  strokeWidth={getWidth(spec.key, spec.strokeWidth)}
                  strokeOpacity={getOpacity(spec.key)}
                  strokeDasharray={spec.strokeDasharray}
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: spec.color,
                    stroke: "var(--c-paper)",
                    strokeWidth: 1.5,
                  }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={520}
                  animationEasing="ease-out"
                />
              ))}

            {/* Metered Actual Load — Heavy Ink Line */}
            <Line
              type="monotone"
              dataKey="actual_demand"
              stroke="var(--c-ink)"
              strokeWidth={getWidth("actual_demand", 2.6)}
              strokeOpacity={getOpacity("actual_demand")}
              dot={false}
              activeDot={{
                r: 5.5,
                fill: "var(--c-ink)",
                stroke: "var(--c-paper)",
                strokeWidth: 2,
              }}
              isAnimationActive={!reducedMotion}
              animationDuration={520}
              animationEasing="ease-out"
            />

            {/* Primary Forecast — Signal Vermilion Pen */}
            {activeModels.includes("Stacking_Ensemble") && (
              <Line
                type="monotone"
                dataKey="Stacking_Ensemble"
                stroke="var(--c-signal)"
                strokeWidth={getWidth("Stacking_Ensemble", 2.3)}
                strokeOpacity={getOpacity("Stacking_Ensemble")}
                dot={false}
                activeDot={{
                  r: 5.5,
                  fill: "var(--c-signal)",
                  stroke: "var(--c-paper)",
                  strokeWidth: 2,
                }}
                isAnimationActive={!reducedMotion}
                animationDuration={560}
                animationEasing="ease-out"
              />
            )}

            {/* Collision-free Peak Demand Instrument Callout */}
            {peakPoint && (
              <>
                <ReferenceLine
                  x={peakPoint.timestamp}
                  stroke="var(--c-rule-strong)"
                  strokeDasharray="2 3"
                />
                <ReferenceDot
                  x={peakPoint.timestamp}
                  y={peakPoint.actual_demand}
                  shape={(props) => (
                    <PeakCalloutShape
                      {...props}
                      valueText={`PEAK ${Math.round(peakPoint.actual_demand).toLocaleString()} MWh`}
                    />
                  )}
                />
              </>
            )}

            {showZoomBrush && !isMobile && (
              <Brush
                dataKey="timestamp"
                height={26}
                stroke="var(--c-ink)"
                fill="var(--c-vellum)"
                tickFormatter={(ts) => formatAxisStamp(ts, true)}
                travellerWidth={8}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!compact && (
        <details className="chart-table-disclosure">
          <summary>Inspect Tabular Telemetry Readout ({sampledRows.length} checkpoint rows)</summary>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={tableCaptionId}
            className="table-wrapper"
            style={{ marginBlockStart: "0.6rem", maxBlockSize: "260px" }}
          >
            <table
              className="gp-table"
              style={{
                "--label-2": '"Actual (MWh)"',
                "--label-3": '"Stacking (MWh)"',
                "--label-4": '"Naive (MWh)"',
                "--label-5": '"Temp (F)"',
              }}
            >
              <caption id={tableCaptionId}>
                Sampled hourly demand and forecast checkpoints for {cityLabel}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col" className="align-right">Actual (MWh)</th>
                  <th scope="col" className="align-right">Stacking (MWh)</th>
                  <th scope="col" className="align-right">Naive (MWh)</th>
                  <th scope="col" className="align-right">Temp (°F)</th>
                </tr>
              </thead>
              <tbody>
                {sampledRows.map((r) => (
                  <tr key={r.timestamp}>
                    <th scope="row">{String(r.timestamp).replace("T", " ").slice(0, 16)}</th>
                    <td className="align-right">{Number(r.actual_demand).toFixed(1)}</td>
                    <td className="align-right">{Number(r.Stacking_Ensemble).toFixed(1)}</td>
                    <td className="align-right">{Number(r.Naive_Baseline).toFixed(1)}</td>
                    <td className="align-right">{Number(r.temperature).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
