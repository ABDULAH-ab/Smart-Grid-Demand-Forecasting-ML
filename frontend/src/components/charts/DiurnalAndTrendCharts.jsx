import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { getCityMeta } from "../../constants/cities";
import { useEChartsColors } from "../../hooks/useEChartsColors";
import ChartZoomToolbar from "./ChartZoomToolbar";

function symlog(v) {
  const num = Number(v) || 0;
  return Math.sign(num) * Math.log10(1 + Math.abs(num) / 100);
}

/**
 * Interactive SVG Before-vs-After Telemetry Fault Caliper across all 10 cities.
 */
export function BeforeAfterFaultCaliper({
  anomalySummary = [],
  selectedCity,
  onSelectCity,
}) {
  const [hoveredCity, setHoveredCity] = useState(null);

  if (!anomalySummary.length) return null;

  const viewW = 800;
  const labelColW = 148;
  const rightColW = 90;
  const plotSpan = viewW - labelColW - rightColW;

  const minS = symlog(-2200);
  const maxS = symlog(115000);
  const toX = (mwh) => ((symlog(mwh) - minS) / (maxS - minS)) * plotSpan + labelColW;

  const inspectedRow =
    anomalySummary.find((r) => r.city === (hoveredCity || selectedCity)) || anomalySummary[0];
  const inspectedMeta = getCityMeta(inspectedRow?.city);

  return (
    <div className="instrument-frame containment-panel">
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
            — Raw: [{Math.round(inspectedRow.raw_min).toLocaleString()} ..{" "}
            {Math.round(inspectedRow.raw_max).toLocaleString()}] MWh · Repaired: [
            {Math.round(inspectedRow.clean_min).toLocaleString()} ..{" "}
            {Math.round(inspectedRow.clean_max).toLocaleString()}] MWh
          </span>
          <span style={{ color: "var(--c-signal)" }}>
            {inspectedRow.severe_replaced} severe sensor dropouts imputed
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${viewW} ${anomalySummary.length * 28 + 32}`}
          style={{ inlineSize: "100%", minInlineSize: "560px", blockSize: "auto" }}
          role="img"
          aria-label="Raw versus cleaned demand bounds caliper chart"
        >
          {/* Axis ticks */}
          {[-2000, 0, 1000, 5000, 20000, 100000].map((tick) => {
            const tx = toX(tick);
            return (
              <g key={tick}>
                <line
                  x1={tx}
                  y1={20}
                  x2={tx}
                  y2={anomalySummary.length * 28 + 24}
                  stroke="var(--c-grid)"
                  strokeDasharray="2 3"
                />
                <text
                  x={tx}
                  y={14}
                  textAnchor="middle"
                  fill="var(--c-graphite)"
                  fontFamily="var(--font-mono)"
                  fontSize="9.5"
                >
                  {tick >= 1000 ? `${tick / 1000}k` : tick}
                </text>
              </g>
            );
          })}

          {/* City calipers */}
          {anomalySummary.map((r, idx) => {
            const cy = 34 + idx * 28;
            const isTarget = r.city === (hoveredCity || selectedCity);
            const m = getCityMeta(r.city);

            const rawX1 = toX(r.raw_min);
            const rawX2 = toX(r.raw_max);
            const cleanX1 = toX(r.clean_min);
            const cleanX2 = toX(r.clean_max);

            return (
              <g
                key={r.city}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredCity(r.city)}
                onMouseLeave={() => setHoveredCity(null)}
                onClick={() => onSelectCity && onSelectCity(r.city)}
              >
                {/* Highlight background strip on hover / selection */}
                {isTarget && (
                  <rect
                    x={0}
                    y={cy - 12}
                    width={viewW}
                    height={24}
                    fill="var(--c-signal-tint)"
                    opacity={0.8}
                  />
                )}

                {/* City name label */}
                <text
                  x={labelColW - 14}
                  y={cy + 4}
                  textAnchor="end"
                  fill={isTarget ? "var(--c-signal)" : "var(--c-ink)"}
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fontWeight={isTarget ? "600" : "400"}
                >
                  {m.name} ({m.iso})
                </text>

                {/* Raw Span Caliper line */}
                <line
                  x1={rawX1}
                  y1={cy}
                  x2={rawX2}
                  y2={cy}
                  stroke="var(--c-signal)"
                  strokeWidth={isTarget ? 3.5 : 2.2}
                  opacity={0.65}
                />
                <circle cx={rawX1} cy={cy} r={3} fill="var(--c-signal)" />
                <circle cx={rawX2} cy={cy} r={3} fill="var(--c-signal)" />

                {/* Repaired Span Caliper line */}
                <line
                  x1={cleanX1}
                  y1={cy}
                  x2={cleanX2}
                  y2={cy}
                  stroke="var(--c-ink)"
                  strokeWidth={isTarget ? 4 : 3}
                />
                <circle cx={cleanX1} cy={cy} r={3.5} fill="var(--c-ink)" />
                <circle cx={cleanX2} cy={cy} r={3.5} fill="var(--c-ink)" />

                {/* Right column: count of severe spikes fixed */}
                <text
                  x={viewW - 10}
                  y={cy + 4}
                  textAnchor="end"
                  fill={r.severe_replaced > 20 ? "var(--c-signal)" : "var(--c-graphite)"}
                  fontFamily="var(--font-mono)"
                  fontSize="9.5"
                  fontWeight={r.severe_replaced > 20 ? "600" : "400"}
                >
                  {r.severe_replaced} fix
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
 * 24-Hour Diurnal Profile Strip-Chart powered by Apache ECharts
 * Dual Y-axis: Demand Mean (MWh) on Left, Temp Mean (°F) on Right
 * Smoothly morphs without clipping wipes when user switches cities!
 */
export function DiurnalProfileChart({ diurnalProfile = [], cityLabel = "Dallas" }) {
  const colors = useEChartsColors();

  const hours = useMemo(() => diurnalProfile.map((d) => `${String(d.hour).padStart(2, "0")}h`), [diurnalProfile]);
  const demandMeans = useMemo(() => diurnalProfile.map((d) => d.demand_mean), [diurnalProfile]);
  const tempMeans = useMemo(() => diurnalProfile.map((d) => d.temp_mean), [diurnalProfile]);

  const peakRow = useMemo(() => {
    if (!diurnalProfile.length) return null;
    return diurnalProfile.reduce(
      (best, cur) => (cur.demand_mean > (best?.demand_mean ?? -Infinity) ? cur : best),
      diurnalProfile[0]
    );
  }, [diurnalProfile]);

  const option = useMemo(() => {
    if (!diurnalProfile.length) return {};

    const peakIndex = peakRow ? diurnalProfile.indexOf(peakRow) : -1;

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 520,
      animationDurationUpdate: 450,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      grid: {
        top: 26,
        left: 54,
        right: 48,
        bottom: 30,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.paper,
        borderColor: colors.ink,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
          fontFamily: colors.fontMono,
          fontSize: 11,
          color: colors.ink,
        },
        axisPointer: {
          type: "cross",
          lineStyle: {
            color: colors.ink,
            type: "dashed",
            width: 1,
          },
        },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const h = params[0].axisValueLabel || "";
          const loadItem = params.find((p) => p.seriesName === "Mean Load");
          const tempItem = params.find((p) => p.seriesName === "Mean Temp");

          return `
            <div class="gp-tooltip" style="min-width:180px;">
              <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid ${colors.rule};padding-bottom:3px;">
                Hour ${h}:00 Local Cycle
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;">
                <span style="display:inline-flex;align-items:center;gap:5px;">
                  <span style="display:inline-block;width:9px;height:3px;background-color:${colors.ink};"></span>
                  <span>Mean Load</span>
                </span>
                <span style="font-weight:600;">${Number(loadItem?.value).toFixed(1)} MWh</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;">
                <span style="display:inline-flex;align-items:center;gap:5px;color:${colors.xgb};">
                  <span style="display:inline-block;width:9px;height:2px;background-color:${colors.xgb};"></span>
                  <span>Mean Temp</span>
                </span>
                <span style="font-weight:500;">${Number(tempItem?.value).toFixed(1)} °F</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: hours,
        boundaryGap: false,
        axisLine: { lineStyle: { color: colors.ink, width: 1 } },
        axisTick: { lineStyle: { color: colors.ink } },
        axisLabel: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 10,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Load (MWh)",
          nameTextStyle: {
            color: colors.graphite,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
            align: "right",
            padding: [0, 4, 0, 0],
          },
          scale: true,
          axisLine: { show: true, lineStyle: { color: colors.ink, width: 1 } },
          axisTick: { show: true, lineStyle: { color: colors.ink } },
          axisLabel: {
            color: colors.graphite,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
            formatter: (v) => Number(v).toLocaleString(),
          },
          splitLine: {
            show: true,
            lineStyle: { color: colors.grid, type: "dashed" },
          },
        },
        {
          type: "value",
          name: "Temp (°F)",
          nameTextStyle: {
            color: colors.xgb,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
            align: "left",
            padding: [0, 0, 0, 4],
          },
          scale: true,
          axisLine: { show: true, lineStyle: { color: colors.xgb, width: 1 } },
          axisTick: { show: true, lineStyle: { color: colors.xgb } },
          axisLabel: {
            color: colors.xgb,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
            formatter: (v) => `${Math.round(v)}°`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Mean Load",
          type: "line",
          yAxisIndex: 0,
          data: demandMeans,
          smooth: 0.3,
          showSymbol: false,
          lineStyle: {
            color: colors.ink,
            width: 2.6,
          },
          itemStyle: { color: colors.ink },
          markPoint:
            peakIndex >= 0
              ? {
                  silent: true,
                  data: [
                    {
                      coord: [peakIndex, peakRow.demand_mean],
                      value: `PEAK ${Math.round(peakRow.demand_mean).toLocaleString()} MWh`,
                    },
                  ],
                  symbol: "circle",
                  symbolSize: 8,
                  itemStyle: {
                    color: colors.paper,
                    borderColor: colors.signal,
                    borderWidth: 2,
                  },
                  label: {
                    show: true,
                    formatter: (p) => p.value,
                    position: "top",
                    color: colors.signal,
                    fontFamily: colors.fontMono,
                    fontSize: 9.5,
                    fontWeight: 600,
                  },
                }
              : undefined,
        },
        {
          name: "Mean Temp",
          type: "line",
          yAxisIndex: 1,
          data: tempMeans,
          smooth: 0.3,
          showSymbol: false,
          lineStyle: {
            color: colors.xgb,
            width: 1.8,
            type: "dashed",
          },
          itemStyle: { color: colors.xgb },
        },
      ],
    };
  }, [diurnalProfile, hours, demandMeans, tempMeans, peakRow, colors]);

  if (!diurnalProfile.length) return null;

  return (
    <div className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">DIURNAL LOAD PROFILE // 24H HARMONIC</span>
          <h3 className="instrument-title">{cityLabel} — 24-Hour Cycle vs. Ambient Temperature</h3>
          <p className="instrument-subtitle">
            Peak diurnal load occurs at Hour {String(peakRow?.hour ?? "--").padStart(2, "0")}:00 (
            {peakRow ? Math.round(peakRow.demand_mean).toLocaleString() : "--"} MWh)
          </p>
        </div>
        <div className="trace-key-list">
          <span className="trace-key-item">
            <span className="trace-swatch-heavy" /> Mean Load MWh (Left Axis)
          </span>
          <span className="trace-key-item">
            <span
              style={{
                display: "inline-block",
                inlineSize: "12px",
                blockSize: "2px",
                borderTop: "2px dashed var(--c-trace-xgb)",
              }}
            />{" "}
            Mean Temp °F (Right Axis)
          </span>
        </div>
      </div>

      <div className="chart-stage" style={{ blockSize: "235px", position: "relative" }}>
        <ReactECharts
          option={option}
          notMerge={false}
          lazyUpdate={true}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

/**
 * 2018-2020 Daily Demand Trend Strip-Chart powered by Apache ECharts.
 * Features:
 * - Vellum band for daily [min, max] envelope + heavy line for daily mean
 * - Fluid native zoom via mouse-wheel and bottom slider across 700+ days
 * - Synchronized Fault Rail with interactive anomaly markers
 */
export function DailyTrendRecorder({ dailySeries = [], cityLabel = "Dallas" }) {
  const echartsRef = useRef(null);
  const colors = useEChartsColors();

  const [hoveredFault, setHoveredFault] = useState(null);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const dates = useMemo(() => dailySeries.map((d) => d.date), [dailySeries]);
  const means = useMemo(() => dailySeries.map((d) => d.demand_mean), [dailySeries]);
  const mins = useMemo(() => dailySeries.map((d) => d.demand_min), [dailySeries]);
  const maxs = useMemo(() => dailySeries.map((d) => d.demand_max), [dailySeries]);

  const peakDay = useMemo(() => {
    if (!dailySeries.length) return null;
    return dailySeries.reduce(
      (best, cur) => (cur.demand_max > (best?.demand_max ?? -Infinity) ? cur : best),
      dailySeries[0]
    );
  }, [dailySeries]);

  const anomalyDays = useMemo(() => dailySeries.filter((d) => d.anomaly_count > 0), [dailySeries]);

  // Option config for Daily Trend
  const option = useMemo(() => {
    if (!dailySeries.length) return {};

    // For the min-max band in ECharts:
    // Base line = mins (transparent line)
    // Span line = (maxs - mins) stacked on top of mins with areaStyle
    const spans = dailySeries.map((d) => Math.max(0, d.demand_max - d.demand_min));

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 520,
      animationDurationUpdate: 450,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      grid: {
        top: 28,
        left: 56,
        right: 22,
        bottom: 46,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.paper,
        borderColor: colors.ink,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
          fontFamily: colors.fontMono,
          fontSize: 11,
          color: colors.ink,
        },
        axisPointer: {
          type: "cross",
          lineStyle: {
            color: colors.ink,
            type: "dashed",
            width: 1,
          },
        },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const date = params[0].axisValueLabel || "";
          const dayData = dailySeries.find((d) => d.date === date);
          if (!dayData) return "";

          return `
            <div class="gp-tooltip" style="min-width:190px;">
              <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid ${colors.rule};padding-bottom:3px;">
                ${date}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;">
                <span>Daily Mean</span>
                <span style="font-weight:600;">${Number(dayData.demand_mean).toFixed(0)} MWh</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;">
                <span style="color:${colors.graphite};">Daily Span</span>
                <span>${Number(dayData.demand_min).toFixed(0)}–${Number(dayData.demand_max).toFixed(0)} MWh</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;">
                <span style="color:${colors.xgb};">Mean Temp</span>
                <span>${Number(dayData.temp_mean).toFixed(1)} °F</span>
              </div>
              ${
                dayData.anomaly_count > 0
                  ? `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0;color:${colors.signal};font-weight:600;">
                  <span>Faults Repaired</span>
                  <span>${dayData.anomaly_count} hr</span>
                </div>
              `
                  : ""
              }
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: colors.ink, width: 1 } },
        axisTick: { lineStyle: { color: colors.ink } },
        axisLabel: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 9.5,
          formatter: (d) => String(d).slice(0, 7),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "MWh",
        nameTextStyle: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 9.5,
          align: "right",
          padding: [0, 4, 0, 0],
        },
        scale: true,
        axisLine: { show: true, lineStyle: { color: colors.ink, width: 1 } },
        axisTick: { show: true, lineStyle: { color: colors.ink } },
        axisLabel: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 9.5,
          formatter: (v) =>
            Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : Number(v).toLocaleString(),
        },
        splitLine: {
          show: true,
          lineStyle: { color: colors.grid, type: "dashed" },
        },
      },
      dataZoom: [
        {
          type: "inside",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          bottom: 2,
          height: 18,
          borderColor: colors.rule,
          backgroundColor: colors.vellum,
          fillerColor: colors.isDark ? "rgba(255, 89, 54, 0.22)" : "rgba(201, 56, 24, 0.16)",
          handleStyle: {
            color: colors.signal,
            borderColor: colors.paper,
          },
          textStyle: {
            color: colors.graphite,
            fontFamily: colors.fontMono,
            fontSize: 9,
          },
        },
      ],
      series: [
        // Base transparent line for min envelope
        {
          name: "Min Base",
          type: "line",
          data: mins,
          stack: "confidence-band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          itemStyle: { opacity: 0 },
        },
        // Span fill for [min, max] envelope
        {
          name: "Demand Span",
          type: "line",
          data: spans,
          stack: "confidence-band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: colors.vellum,
            opacity: 0.85,
          },
        },
        // Daily Mean Line
        {
          name: "Daily Mean",
          type: "line",
          data: means,
          smooth: 0.2,
          showSymbol: false,
          lineStyle: {
            color: colors.ink,
            width: 1.8,
          },
          itemStyle: { color: colors.ink },
          markPoint: peakDay
            ? {
                silent: true,
                data: [
                  {
                    coord: [dates.indexOf(peakDay.date), peakDay.demand_max],
                    value: `PEAK ${Math.round(peakDay.demand_max).toLocaleString()} MWh`,
                  },
                ],
                symbol: "circle",
                symbolSize: 7,
                itemStyle: {
                  color: colors.paper,
                  borderColor: colors.signal,
                  borderWidth: 2,
                },
                label: {
                  show: true,
                  formatter: (p) => p.value,
                  position: "top",
                  color: colors.signal,
                  fontFamily: colors.fontMono,
                  fontSize: 9.5,
                  fontWeight: 600,
                },
              }
            : undefined,
        },
      ],
    };
  }, [dailySeries, dates, means, mins, maxs, peakDay, colors]);

  const handleZoomIn = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    const currentOption = inst.getOption();
    const zoom = currentOption.dataZoom?.[0] || {};
    const start = zoom.start ?? 0;
    const end = zoom.end ?? 100;
    const center = (start + end) / 2;
    const span = (end - start) * 0.7;
    inst.dispatchAction({
      type: "dataZoom",
      start: Math.max(0, center - span / 2),
      end: Math.min(100, center + span / 2),
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    const currentOption = inst.getOption();
    const zoom = currentOption.dataZoom?.[0] || {};
    const start = zoom.start ?? 0;
    const end = zoom.end ?? 100;
    const center = (start + end) / 2;
    const span = Math.min(100, (end - start) / 0.7);
    inst.dispatchAction({
      type: "dataZoom",
      start: Math.max(0, center - span / 2),
      end: Math.min(100, center + span / 2),
    });
  }, []);

  const handleReset = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    inst.dispatchAction({
      type: "dataZoom",
      start: 0,
      end: 100,
    });
  }, []);

  const handlePanLeft = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    const currentOption = inst.getOption();
    const zoom = currentOption.dataZoom?.[0] || {};
    const start = zoom.start ?? 0;
    const end = zoom.end ?? 100;
    const span = end - start;
    const shift = span * 0.25;
    const nextStart = Math.max(0, start - shift);
    inst.dispatchAction({
      type: "dataZoom",
      start: nextStart,
      end: nextStart + span,
    });
  }, []);

  const handlePanRight = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    const currentOption = inst.getOption();
    const zoom = currentOption.dataZoom?.[0] || {};
    const start = zoom.start ?? 0;
    const end = zoom.end ?? 100;
    const span = end - start;
    const shift = span * 0.25;
    const nextEnd = Math.min(100, end + shift);
    inst.dispatchAction({
      type: "dataZoom",
      start: nextEnd - span,
      end: nextEnd,
    });
  }, []);

  const onEvents = useMemo(
    () => ({
      datazoom: () => {
        const inst = echartsRef.current?.getEchartsInstance();
        if (!inst) return;
        const currentOption = inst.getOption();
        const zoom = currentOption.dataZoom?.[0] || {};
        const start = zoom.start ?? 0;
        const end = zoom.end ?? 100;
        const span = Math.max(0.01, end - start);
        setZoomFactor(100 / span);
        setIsZoomed(start > 1 || end < 99);
      },
    }),
    []
  );

  const jumpToAnomalyDay = (idx) => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst || !dailySeries.length) return;
    const total = dailySeries.length;
    const centerPct = (idx / total) * 100;
    const halfSpan = 5; // +/- 5% window
    inst.dispatchAction({
      type: "dataZoom",
      start: Math.max(0, centerPct - halfSpan),
      end: Math.min(100, centerPct + halfSpan),
    });
  };

  if (!dailySeries.length) return null;

  return (
    <div className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">LONGITUDINAL STRIP-CHART // JUL 2018 – MAY 2020</span>
          <h3 className="instrument-title">{cityLabel} — Multi-Year Daily Load &amp; Fault Rail</h3>
          <p className="instrument-subtitle">
            {isZoomed
              ? `Zoom factor ${zoomFactor.toFixed(1)}x · Native wheel/drag zoom active · Double-click or click Reset for full archive`
              : `Vellum band = daily [min, max] MWh · Heavy ink = daily mean · Drag slider track or click a fault tick below to inspect`}
          </p>
        </div>

        <div className="instrument-header-actions">
          <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--c-signal)" }}>
            {hoveredFault
              ? `FAULT ${hoveredFault.date}: ${hoveredFault.anomaly_count} HRS`
              : peakDay
              ? `PEAK ${peakDay.date} (${Math.round(peakDay.demand_max).toLocaleString()} MWh)`
              : ""}
          </span>
          <ChartZoomToolbar
            zoomFactor={zoomFactor}
            isZoomed={isZoomed}
            canZoomIn={zoomFactor < 15}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onPanLeft={handlePanLeft}
            onPanRight={handlePanRight}
            canZoom={dailySeries.length > 14}
          />
        </div>
      </div>

      <div
        className="chart-stage"
        onDoubleClick={handleReset}
        style={{
          blockSize: "285px",
          position: "relative",
        }}
      >
        <ReactECharts
          ref={echartsRef}
          option={option}
          notMerge={false}
          lazyUpdate={true}
          style={{ width: "100%", height: "100%" }}
          onEvents={onEvents}
        />
      </div>

      {/* Interactive Synchronized Bottom Fault Rail */}
      <div
        style={{
          paddingInlineStart: "56px",
          paddingInlineEnd: "22px",
          marginBlockStart: "4px",
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(dailySeries.length, 1)} 18`}
          preserveAspectRatio="none"
          style={{ inlineSize: "100%", blockSize: "18px" }}
          aria-label={`${anomalyDays.length} days with repaired telemetry anomalies`}
        >
          <line
            x1="0"
            y1="9"
            x2={dailySeries.length}
            y2="9"
            stroke="var(--c-rule)"
            strokeWidth="0.7"
          />
          {dailySeries.map((d, idx) =>
            d.anomaly_count > 0 ? (
              <line
                key={d.date}
                x1={idx}
                y1={1}
                x2={idx}
                y2={17}
                stroke="var(--c-signal)"
                strokeWidth={Math.min(3.8, 1.8 + d.anomaly_count * 0.45)}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredFault(d)}
                onMouseLeave={() => setHoveredFault(null)}
                onClick={() => jumpToAnomalyDay(idx)}
              />
            ) : null
          )}
        </svg>
      </div>
    </div>
  );
}
