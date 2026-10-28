import React, { useMemo } from "react";
import {
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
import { MODEL_BY_KEY, formatModelName } from "../../constants/cities";
import { useContainerWidth, useReducedMotion } from "../../hooks/useChartEnvironment";

function shortStamp(ts, isMobile) {
  if (!ts) return "";
  const clean = String(ts).replace("T", " ");
  if (isMobile) return clean.slice(5, 10);
  return `${clean.slice(5, 10)} ${clean.slice(11, 16)}`;
}

function ResidualTooltip({ active, payload, label, modelName, modelColor }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="gp-tooltip">
      <div className="gp-tooltip-head">{String(label).replace("T", " ").slice(0, 16)} UTC</div>
      <div className="gp-tooltip-row">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              inlineSize: "9px",
              blockSize: "2.5px",
              backgroundColor: modelColor,
            }}
          />
          <span>{modelName} Residual</span>
        </span>
        <span style={{ color: Math.abs(row.residual) > 350 ? "var(--c-signal)" : "var(--c-ink)", fontWeight: 600 }}>
          {row.residual > 0 ? `+${row.residual.toFixed(1)}` : row.residual.toFixed(1)} MWh
        </span>
      </div>
      <div className="gp-tooltip-row">
        <span style={{ color: "var(--c-trace-xgb)" }}>Ambient Temp</span>
        <span>{Number(row.temperature).toFixed(1)} °F</span>
      </div>
    </div>
  );
}

/**
 * Dual-channel animated strip chart synced with the main Forecast Studio chart:
 * Top channel: Forecast residual error (Predicted - Actual MWh) around 0-datum rule
 * Bottom channel: Synchronized ambient temperature (°F) with 65°F degree-hour datum
 */
export default function ResidualTempChart({
  series = [],
  primaryModel = "Stacking_Ensemble",
  syncId = "studioSync",
}) {
  const [containerRef, containerWidth] = useContainerWidth(680);
  const reducedMotion = useReducedMotion();
  const isMobile = containerWidth < 480;

  const { enriched, maxErrPoint } = useMemo(() => {
    if (!series.length) return { enriched: [], maxErrPoint: null };
    let worst = null;
    const rows = series.map((r) => {
      const pred = Number(r[primaryModel]);
      const actual = Number(r.actual_demand);
      const residual = Number.isFinite(pred) && Number.isFinite(actual) ? pred - actual : 0;
      const item = {
        timestamp: r.timestamp,
        residual,
        temperature: Number(r.temperature),
      };
      if (!worst || Math.abs(residual) > Math.abs(worst.residual)) {
        worst = item;
      }
      return item;
    });
    return { enriched: rows, maxErrPoint: worst };
  }, [series, primaryModel]);

  if (!enriched.length) return null;

  const modelLabel = formatModelName(primaryModel);
  const modelColor = MODEL_BY_KEY[primaryModel]?.color || "var(--c-signal)";

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">DIAGNOSTIC RECORDER // ERROR &amp; THERMAL DRIVER</span>
          <h3 className="instrument-title">Residual Drift &amp; Ambient Temperature Trace</h3>
          <p className="instrument-subtitle">
            Residual = {modelLabel} minus Metered Load (0 MWh datum) · Synced hover crosshair
          </p>
        </div>
        {maxErrPoint && (
          <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--c-signal)" }}>
            MAX DEVIATION:{" "}
            {maxErrPoint.residual > 0
              ? `+${maxErrPoint.residual.toFixed(1)}`
              : maxErrPoint.residual.toFixed(1)}{" "}
            MWh
          </div>
        )}
      </div>

      {/* Channel A: Residual Error */}
      <div className="chart-stage" style={{ blockSize: isMobile ? "148px" : "172px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={enriched}
            syncId={syncId}
            margin={{
              top: 20,
              right: isMobile ? 10 : 18,
              left: isMobile ? -4 : 6,
              bottom: 2,
            }}
          >
            <CartesianGrid stroke="var(--c-grid)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={isMobile ? 42 : 54}
              stroke="var(--c-ink)"
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <Tooltip
              content={<ResidualTooltip modelName={modelLabel} modelColor={modelColor} />}
              cursor={{ stroke: "var(--c-ink)", strokeWidth: 1, strokeDasharray: "3 3" }}
              isAnimationActive={!reducedMotion}
              animationDuration={100}
            />
            <ReferenceLine y={0} stroke="var(--c-ink)" strokeWidth={1.25} />
            <Line
              type="monotone"
              dataKey="residual"
              stroke={modelColor}
              strokeWidth={1.65}
              dot={false}
              activeDot={{
                r: 4.5,
                fill: modelColor,
                stroke: "var(--c-paper)",
                strokeWidth: 1.5,
              }}
              isAnimationActive={!reducedMotion}
              animationDuration={500}
              animationEasing="ease-out"
            />
            {maxErrPoint && (
              <ReferenceDot
                x={maxErrPoint.timestamp}
                y={maxErrPoint.residual}
                r={4.5}
                fill="var(--c-paper)"
                stroke="var(--c-signal)"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Channel B: Synchronized Temperature */}
      <div
        className="chart-stage"
        style={{
          blockSize: isMobile ? "122px" : "138px",
          borderBlockStart: "1px dashed var(--c-rule-strong)",
          paddingBlockStart: "4px",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={enriched}
            syncId={syncId}
            margin={{
              top: 8,
              right: isMobile ? 10 : 18,
              left: isMobile ? -4 : 6,
              bottom: 6,
            }}
          >
            <CartesianGrid stroke="var(--c-grid)" strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => shortStamp(ts, isMobile)}
              minTickGap={isMobile ? 34 : 50}
              stroke="var(--c-ink)"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <YAxis
              width={isMobile ? 42 : 54}
              stroke="var(--c-ink)"
              tickFormatter={(v) => `${v}°`}
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <Tooltip
              content={<ResidualTooltip modelName={modelLabel} modelColor={modelColor} />}
              cursor={{ stroke: "var(--c-ink)", strokeWidth: 1, strokeDasharray: "3 3" }}
              isAnimationActive={!reducedMotion}
              animationDuration={100}
            />
            <ReferenceLine
              y={65}
              stroke="var(--c-graphite)"
              strokeDasharray="4 3"
              label={{
                value: "65°F BALANCE",
                position: "insideTopRight",
                fill: "var(--c-graphite)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
              }}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="var(--c-trace-xgb)"
              strokeWidth={1.65}
              dot={false}
              activeDot={{
                r: 4.5,
                fill: "var(--c-trace-xgb)",
                stroke: "var(--c-paper)",
                strokeWidth: 1.5,
              }}
              isAnimationActive={!reducedMotion}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
