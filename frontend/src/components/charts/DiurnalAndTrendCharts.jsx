import React, { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCityMeta } from "../../constants/cities";
import { useContainerWidth, useReducedMotion } from "../../hooks/useChartEnvironment";

function symlog(v) {
  const num = Number(v) || 0;
  return Math.sign(num) * Math.log10(1 + Math.abs(num) / 100);
}

const TICKS_MWH = [-2000, 0, 500, 2000, 5000, 15000, 50000, 105000];

/**
 * Interactive SVG Before-vs-After Telemetry Fault Caliper across all 10 cities.
 */
export function BeforeAfterFaultCaliper({
  anomalySummary = [],
  selectedCity,
  onSelectCity,
}) {
  const [containerRef, containerWidth] = useContainerWidth(840);
  const [hoveredCity, setHoveredCity] = useState(null);

  if (!anomalySummary.length) return null;

  const isCompact = containerWidth < 560;
  const viewW = isCompact ? 560 : 800;
  const labelColW = isCompact ? 108 : 148;
  const rightColW = isCompact ? 68 : 90;
  const plotSpan = viewW - labelColW - rightColW;

  const minS = symlog(-2200);
  const maxS = symlog(115000);
  const toX = (mwh) => ((symlog(mwh) - minS) / (maxS - minS)) * plotSpan + labelColW;

  const inspectedRow =
    anomalySummary.find((r) => r.city === (hoveredCity || selectedCity)) || anomalySummary[0];
  const inspectedMeta = getCityMeta(inspectedRow?.city);

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">TELEMETRY SANITIZATION CALIPER // SYMLOG MWh SCALE</span>
          <h3 className="instrument-title">
            Raw Metered Extremes vs. Repaired Operational Load Envelope
          </h3>
          <p className="instrument-subtitle">
            Hover or click any city row to inspect raw glitches vs. repaired physical bounds
          </p>
        </div>
        <div className="trace-key-list">
          <span className="trace-key-item">
            <span className="trace-swatch-signal" /> Raw Spike Span
          </span>
          <span className="trace-key-item">
            <span className="trace-swatch-heavy" /> Repaired Envelope
          </span>
        </div>
      </div>

      {/* Interactive Live Inspection Bar */}
      {inspectedRow && (
        <div
          className="font-mono"
          style={{
            fontSize: "0.73rem",
            padding: "0.45rem 0.7rem",
            background: "var(--c-vellum)",
            border: "1px solid var(--c-rule-strong)",
            marginBlockEnd: "0.65rem",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "0.4rem 1rem",
          }}
          aria-live="polite"
        >
          <span>
            <strong>
              {inspectedMeta.name} ({inspectedMeta.iso})
            </strong>{" "}
            · Raw: [{Math.round(inspectedRow.raw_min).toLocaleString()},{" "}
            {Math.round(inspectedRow.raw_max).toLocaleString()}] MWh
          </span>
          <span>
            Repaired: [<strong>{Math.round(inspectedRow.clean_min).toLocaleString()}</strong>,{" "}
            <strong>{Math.round(inspectedRow.clean_max).toLocaleString()}</strong>] MWh ·{" "}
            <span style={{ color: "var(--c-signal)", fontWeight: 600 }}>
              {inspectedRow.severe_replaced} spikes fixed
            </span>{" "}
            ({inspectedRow.isoforest_flag} IsoForest)
          </span>
        </div>
      )}

      <div className="chart-stage">
        <svg
          viewBox={`0 0 ${viewW} ${anomalySummary.length * 32 + 44}`}
          style={{ inlineSize: "100%", blockSize: "auto" }}
          role="img"
          aria-label="Before and after sensor anomaly repair range chart across 10 cities"
        >
          {(isCompact ? [-2000, 0, 2000, 15000, 105000] : TICKS_MWH).map((tick) => {
            const x = toX(tick);
            const isZero = tick === 0;
            return (
              <g key={tick}>
                <line
                  x1={x}
                  y1={22}
                  x2={x}
                  y2={anomalySummary.length * 32 + 26}
                  stroke={isZero ? "var(--c-ink)" : "var(--c-grid)"}
                  strokeWidth={isZero ? 1.1 : 0.8}
                  strokeDasharray={isZero ? undefined : "2 3"}
                />
                <text
                  x={x}
                  y={14}
                  textAnchor="middle"
                  fill="var(--c-graphite)"
                  fontFamily="var(--font-mono)"
                  fontSize={isCompact ? "8.5" : "9.5"}
                >
                  {Math.abs(tick) >= 1000 ? `${tick / 1000}k` : tick}
                </text>
              </g>
            );
          })}

          {anomalySummary.map((row, idx) => {
            const meta = getCityMeta(row.city);
            const y = 38 + idx * 32;
            const xRawMin = toX(row.raw_min);
            const xRawMax = toX(row.raw_max);
            const xCleanMin = toX(row.clean_min);
            const xCleanMax = toX(row.clean_max);
            const isSelected = row.city === selectedCity;
            const isHovered = row.city === hoveredCity;
            const hasExtremeRaw =
              row.raw_min < row.clean_min - 5 || row.raw_max > row.clean_max + 5;

            return (
              <g
                key={row.city}
                onMouseEnter={() => setHoveredCity(row.city)}
                onMouseLeave={() => setHoveredCity(null)}
                onClick={() => onSelectCity && onSelectCity(row.city)}
                style={{ cursor: onSelectCity ? "pointer" : "default" }}
              >
                <rect
                  x={2}
                  y={y - 14}
                  width={viewW - 4}
                  height={28}
                  fill={
                    isSelected
                      ? "var(--c-signal-tint)"
                      : isHovered
                      ? "var(--c-vellum)"
                      : "transparent"
                  }
                  style={{ transition: "fill 160ms ease" }}
                />
                <line
                  x1={2}
                  y1={y + 14}
                  x2={viewW - 2}
                  y2={y + 14}
                  stroke="var(--c-grid)"
                  strokeWidth="0.6"
                />

                <text
                  x={8}
                  y={y + 4}
                  fill={isSelected || isHovered ? "var(--c-signal)" : "var(--c-ink)"}
                  fontFamily="var(--font-mono)"
                  fontSize={isCompact ? "9.5" : "10.5"}
                  fontWeight={isSelected || isHovered ? "600" : "400"}
                >
                  {isCompact ? meta.name : `${meta.bay} ${meta.name}`}
                </text>

                {hasExtremeRaw && (
                  <>
                    <line
                      x1={xRawMin}
                      y1={y}
                      x2={xRawMax}
                      y2={y}
                      stroke="var(--c-signal)"
                      strokeWidth={isHovered ? "1.8" : "1.25"}
                      strokeDasharray="3 2"
                    />
                    <line
                      x1={xRawMin}
                      y1={y - 5.5}
                      x2={xRawMin}
                      y2={y + 5.5}
                      stroke="var(--c-signal)"
                      strokeWidth="1.8"
                    />
                    <line
                      x1={xRawMax}
                      y1={y - 5.5}
                      x2={xRawMax}
                      y2={y + 5.5}
                      stroke="var(--c-signal)"
                      strokeWidth="1.8"
                    />
                  </>
                )}

                <rect
                  x={xCleanMin}
                  y={isHovered ? y - 4.5 : y - 3.5}
                  width={Math.max(4, xCleanMax - xCleanMin)}
                  height={isHovered ? 9 : 7}
                  fill="var(--c-ink)"
                  style={{ transition: "all 220ms var(--ease-out-quart)" }}
                />

                <text
                  x={viewW - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill={row.severe_replaced > 20 ? "var(--c-signal)" : "var(--c-graphite)"}
                  fontFamily="var(--font-mono)"
                  fontSize={isCompact ? "8.8" : "9.5"}
                  fontWeight={isHovered ? "600" : "400"}
                >
                  {row.severe_replaced} fixed
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * 24-Hour Diurnal Load (Heavy Ink) + Temperature (Cobalt Pen) Profile
 */
export function DiurnalProfileChart({ diurnalProfile = [], cityLabel = "Dallas" }) {
  const [containerRef, containerWidth] = useContainerWidth(640);
  const reducedMotion = useReducedMotion();
  const isMobile = containerWidth < 480;

  const peakRow = useMemo(() => {
    if (!diurnalProfile.length) return null;
    return diurnalProfile.reduce(
      (best, cur) => (cur.demand_mean > best.demand_mean ? cur : best),
      diurnalProfile[0]
    );
  }, [diurnalProfile]);

  if (!diurnalProfile.length) return null;

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">DIURNAL REGIME // 24-HOUR COMPOSITE</span>
          <h3 className="instrument-title">{cityLabel} — Hourly Mean Load &amp; Temperature</h3>
          <p className="instrument-subtitle">
            Left axis: Metered Load (MWh, heavy ink) · Right axis: Ambient Temp (°F, cobalt dashed)
          </p>
        </div>
        {peakRow && (
          <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--c-signal)" }}>
            PEAK HR {String(peakRow.hour).padStart(2, "0")}:00 ·{" "}
            {Math.round(peakRow.demand_mean).toLocaleString()} MWh
          </span>
        )}
      </div>

      <div className="chart-stage" style={{ blockSize: isMobile ? "235px" : "275px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={diurnalProfile}
            margin={{
              top: 18,
              right: isMobile ? 4 : 10,
              left: isMobile ? -4 : 4,
              bottom: 6,
            }}
          >
            <CartesianGrid stroke="var(--c-grid)" strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="hour"
              minTickGap={isMobile ? 22 : 12}
              tickFormatter={(h) => `${String(h).padStart(2, "0")}h`}
              stroke="var(--c-ink)"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <YAxis
              yAxisId="load"
              width={isMobile ? 42 : 54}
              stroke="var(--c-ink)"
              tickFormatter={(v) =>
                isMobile && Math.abs(v) >= 1000
                  ? `${(v / 1000).toFixed(1)}k`
                  : Number(v).toLocaleString()
              }
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-ink)",
              }}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              width={isMobile ? 34 : 42}
              stroke="var(--c-trace-xgb)"
              tickFormatter={(v) => `${Math.round(v)}°`}
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-trace-xgb)",
              }}
            />
            <Tooltip
              isAnimationActive={!reducedMotion}
              animationDuration={100}
              cursor={{ stroke: "var(--c-ink)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="gp-tooltip">
                    <div className="gp-tooltip-head">
                      Hour {String(d.hour).padStart(2, "0")}:00 Local Cycle
                    </div>
                    <div className="gp-tooltip-row">
                      <span>Mean Load</span>
                      <span style={{ fontWeight: 600 }}>{Number(d.demand_mean).toFixed(1)} MWh</span>
                    </div>
                    <div className="gp-tooltip-row">
                      <span style={{ color: "var(--c-trace-xgb)" }}>Mean Temp</span>
                      <span>{Number(d.temp_mean).toFixed(1)} °F</span>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp_mean"
              stroke="var(--c-trace-xgb)"
              strokeWidth={1.75}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{
                r: 4.5,
                fill: "var(--c-trace-xgb)",
                stroke: "var(--c-paper)",
                strokeWidth: 1.5,
              }}
              isAnimationActive={!reducedMotion}
              animationDuration={520}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="load"
              type="monotone"
              dataKey="demand_mean"
              stroke="var(--c-ink)"
              strokeWidth={2.5}
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
            {peakRow && (
              <ReferenceDot
                yAxisId="load"
                x={peakRow.hour}
                y={peakRow.demand_mean}
                r={5}
                fill="var(--c-paper)"
                stroke="var(--c-signal)"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * 2018-2020 Daily Demand Trend Strip-Chart with Animated Envelope & Interactive Fault Rail
 */
export function DailyTrendRecorder({ dailySeries = [], cityLabel = "Dallas" }) {
  const [containerRef, containerWidth] = useContainerWidth(920);
  const reducedMotion = useReducedMotion();
  const [hoveredFault, setHoveredFault] = useState(null);
  const isMobile = containerWidth < 520;

  const { chartRows, peakDay, anomalyDays } = useMemo(() => {
    if (!dailySeries.length) return { chartRows: [], peakDay: null, anomalyDays: [] };
    let peak = dailySeries[0];
    const faults = [];
    const rows = dailySeries.map((d) => {
      if (d.demand_max > (peak?.demand_max ?? -Infinity)) {
        peak = d;
      }
      if (d.anomaly_count > 0) {
        faults.push(d);
      }
      return {
        ...d,
        envelope: [Number(d.demand_min), Number(d.demand_max)],
      };
    });
    return { chartRows: rows, peakDay: peak, anomalyDays: faults };
  }, [dailySeries]);

  if (!chartRows.length) return null;

  return (
    <div ref={containerRef} className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">LONGITUDINAL STRIP-CHART // JUL 2018 – MAY 2020</span>
          <h3 className="instrument-title">{cityLabel} — Multi-Year Daily Load &amp; Fault Rail</h3>
          <p className="instrument-subtitle">
            Vellum band = daily [min, max] MWh · Heavy ink = daily mean · Vermilion rail marks{" "}
            {anomalyDays.length} days with repaired telemetry faults
          </p>
        </div>
        <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--c-signal)" }}>
          {hoveredFault
            ? `FAULT DATE ${hoveredFault.date}: ${hoveredFault.anomaly_count} REPAIRED HRS`
            : peakDay
            ? `SYSTEM PEAK: ${peakDay.date} (${Math.round(peakDay.demand_max).toLocaleString()} MWh)`
            : ""}
        </span>
      </div>

      <div className="chart-stage" style={{ blockSize: isMobile ? "235px" : "285px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartRows}
            margin={{
              top: 18,
              right: isMobile ? 8 : 16,
              left: isMobile ? -4 : 6,
              bottom: 6,
            }}
          >
            <CartesianGrid stroke="var(--c-grid)" strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="date"
              minTickGap={isMobile ? 42 : 64}
              tickFormatter={(d) => String(d).slice(0, 7)}
              stroke="var(--c-ink)"
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <YAxis
              width={isMobile ? 42 : 56}
              stroke="var(--c-ink)"
              tickFormatter={(v) =>
                isMobile && Math.abs(v) >= 1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : Number(v).toLocaleString()
              }
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 9.5 : 10,
                fill: "var(--c-graphite)",
              }}
            />
            <Tooltip
              isAnimationActive={!reducedMotion}
              animationDuration={100}
              cursor={{ stroke: "var(--c-ink)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="gp-tooltip">
                    <div className="gp-tooltip-head">{d.date}</div>
                    <div className="gp-tooltip-row">
                      <span>Daily Mean</span>
                      <span style={{ fontWeight: 600 }}>{Number(d.demand_mean).toFixed(0)} MWh</span>
                    </div>
                    <div className="gp-tooltip-row">
                      <span style={{ color: "var(--c-graphite)" }}>Daily Span</span>
                      <span>
                        {Number(d.demand_min).toFixed(0)}–{Number(d.demand_max).toFixed(0)} MWh
                      </span>
                    </div>
                    <div className="gp-tooltip-row">
                      <span style={{ color: "var(--c-trace-xgb)" }}>Mean Temp</span>
                      <span>{Number(d.temp_mean).toFixed(1)} °F</span>
                    </div>
                    {d.anomaly_count > 0 && (
                      <div className="gp-tooltip-row" style={{ color: "var(--c-signal)" }}>
                        <span>Faults Repaired</span>
                        <span>{d.anomaly_count} hr</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="envelope"
              stroke="var(--c-rule-strong)"
              strokeWidth={0.7}
              fill="var(--c-vellum)"
              fillOpacity={0.95}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="demand_mean"
              stroke="var(--c-ink)"
              strokeWidth={1.65}
              dot={false}
              activeDot={{
                r: 4.5,
                fill: "var(--c-ink)",
                stroke: "var(--c-paper)",
                strokeWidth: 1.5,
              }}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
            />
            {peakDay && (
              <>
                <ReferenceLine
                  x={peakDay.date}
                  stroke="var(--c-signal)"
                  strokeDasharray="2 2"
                />
                <ReferenceDot
                  x={peakDay.date}
                  y={peakDay.demand_mean}
                  r={4.5}
                  fill="var(--c-paper)"
                  stroke="var(--c-signal)"
                  strokeWidth={2}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Bottom Fault Rail */}
      <div
        style={{
          paddingInlineStart: isMobile ? "38px" : "62px",
          paddingInlineEnd: isMobile ? "8px" : "16px",
          marginBlockStart: "4px",
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(chartRows.length, 1)} 18`}
          preserveAspectRatio="none"
          style={{ inlineSize: "100%", blockSize: "18px" }}
          aria-label={`${anomalyDays.length} days with repaired telemetry anomalies`}
        >
          <line
            x1="0"
            y1="9"
            x2={chartRows.length}
            y2="9"
            stroke="var(--c-rule)"
            strokeWidth="0.7"
          />
          {chartRows.map((d, idx) =>
            d.anomaly_count > 0 ? (
              <line
                key={d.date}
                x1={idx}
                y1={1}
                x2={idx}
                y2={17}
                stroke="var(--c-signal)"
                strokeWidth={Math.min(3.5, 1.6 + d.anomaly_count * 0.45)}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredFault(d)}
                onMouseLeave={() => setHoveredFault(null)}
              />
            ) : null
          )}
        </svg>
      </div>
    </div>
  );
}
