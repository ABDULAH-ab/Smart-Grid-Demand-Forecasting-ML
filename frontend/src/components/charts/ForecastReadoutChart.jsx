import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { FORECAST_MODELS, formatModelName } from "../../constants/cities";
import { useEChartsColors, getModelEChartsColor } from "../../hooks/useEChartsColors";
import ChartZoomToolbar from "./ChartZoomToolbar";

/**
 * Format timestamp stamp for x-axis ticks
 */
function formatAxisStamp(ts) {
  if (!ts || typeof ts !== "string") return "";
  const clean = ts.replace("T", " ");
  const [datePart, timePart = "00:00"] = clean.split(" ");
  const mmdd = datePart.slice(5);
  return `${mmdd} ${timePart.slice(0, 5)}`;
}

/**
 * High-performance, modern Apache ECharts strip-chart recorder for Actual vs. Day-Ahead Forecasts.
 * Features:
 * - Fluid coordinate tween animations when parameters (city, dates, models) update
 * - Native, silky smooth mouse-wheel zoom & drag-to-pan (isolated to this chart)
 * - Interactive bottom timeline scrubber bar (dataZoom slider)
 * - Multi-pen trace spotlighting (hover or click to isolate a model)
 * - Calibrated dark/light theme awareness
 * - Collision-free Peak Demand callout marker
 */
export default function ForecastReadoutChart({
  series = [],
  activeModels = ["Stacking_Ensemble", "Naive_Baseline"],
  cityLabel = "Dallas",
  height = 370,
  compact = false,
  onZoomRangeChange = null,
}) {
  const tableCaptionId = useId();
  const echartsRef = useRef(null);
  const colors = useEChartsColors();

  const [hoveredTrace, setHoveredTrace] = useState(null);
  const [pinnedTrace, setPinnedTrace] = useState(null);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const spotlightKey = hoveredTrace || pinnedTrace;
  const totalPoints = series.length;

  // Find peak point of actual demand
  const { peakIndex, peakActual } = useMemo(() => {
    if (!series.length) return { peakIndex: -1, peakActual: 0 };
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < series.length; i++) {
      const v = Number(series[i].actual_demand);
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }
    return { peakIndex: maxIdx, peakActual: maxVal };
  }, [series]);

  const timestamps = useMemo(() => series.map((r) => r.timestamp), [series]);
  const enabledSpecs = useMemo(
    () => FORECAST_MODELS.filter((m) => activeModels.includes(m.key)),
    [activeModels]
  );

  const togglePin = (key) => {
    setPinnedTrace((prev) => (prev === key ? null : key));
  };

  // ECharts Option Configuration
  const option = useMemo(() => {
    if (!series.length) return {};

    const actualSeriesData = series.map((r) => Number(r.actual_demand) || null);

    const isActualSpotlight = spotlightKey === "actual_demand";
    const actualOpacity = spotlightKey ? (isActualSpotlight ? 1 : 0.16) : 1;
    const actualWidth = isActualSpotlight ? 3.4 : 2.6;

    // Series array
    const chartSeries = [
      {
        name: "Actual Demand",
        type: "line",
        data: actualSeriesData,
        smooth: 0.25,
        showSymbol: false,
        lineStyle: {
          color: colors.ink,
          width: actualWidth,
          opacity: actualOpacity,
        },
        itemStyle: {
          color: colors.ink,
        },
        z: 10,
        // Peak callout marker & target dot
        markPoint:
          peakIndex >= 0
            ? {
                silent: true,
                data: [
                  {
                    coord: [peakIndex, peakActual],
                    value: `PEAK ${Math.round(peakActual).toLocaleString()} MWh`,
                    symbol: "roundRect",
                    symbolSize: [148, 24],
                    symbolOffset: [0, -18],
                    itemStyle: {
                      color: colors.paper,
                      borderColor: colors.signal,
                      borderWidth: 1.5,
                      shadowBlur: 4,
                      shadowColor: "rgba(0,0,0,0.15)",
                    },
                    label: {
                      show: true,
                      formatter: (p) => p.value,
                      color: colors.signal,
                      fontFamily: colors.fontMono,
                      fontSize: 10,
                      fontWeight: 600,
                      align: "center",
                      verticalAlign: "middle",
                    },
                  },
                  {
                    coord: [peakIndex, peakActual],
                    symbol: "circle",
                    symbolSize: 6,
                    itemStyle: {
                      color: colors.signal,
                      borderColor: colors.paper,
                      borderWidth: 1.5,
                    },
                    label: { show: false },
                  },
                ],
              }
            : undefined,
        // Vertical dashed guideline under the peak
        markLine:
          peakIndex >= 0
            ? {
                silent: true,
                symbol: "none",
                data: [
                  {
                    xAxis: peakIndex,
                    lineStyle: {
                      color: colors.signal,
                      type: "dashed",
                      width: 1,
                      opacity: 0.5,
                    },
                    label: { show: false },
                  },
                ],
              }
            : undefined,
      },
    ];

    // Add forecast model traces
    for (const spec of enabledSpecs) {
      const isSpotlight = spotlightKey === spec.key;
      const opacity = spotlightKey ? (isSpotlight ? 1 : 0.15) : 1;
      const baseWidth = spec.strokeWidth || 1.8;
      const width = isSpotlight ? baseWidth + 1.2 : baseWidth;
      const modelColor = getModelEChartsColor(spec.key, colors);

      const isDashed = Boolean(spec.strokeDasharray);
      const isStacking = spec.key === "Stacking_Ensemble";

      chartSeries.push({
        name: spec.label,
        type: "line",
        data: series.map((r) => Number(r[spec.key]) || null),
        smooth: 0.25,
        showSymbol: false,
        lineStyle: {
          color: modelColor,
          width,
          opacity,
          type: isDashed ? "dashed" : "solid",
        },
        itemStyle: {
          color: modelColor,
        },
        z: isStacking ? 9 : 5,
      });
    }

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 520,
      animationDurationUpdate: 450,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      grid: {
        top: 36,
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
          fontSize: 11.5,
          color: colors.ink,
        },
        axisPointer: {
          type: "cross",
          lineStyle: {
            color: colors.ink,
            type: "dashed",
            width: 1,
          },
          label: {
            backgroundColor: colors.ink,
            color: colors.paper,
            fontFamily: colors.fontMono,
            fontSize: 10,
          },
        },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const time = params[0].axisValueLabel || "";
          const header = `<div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid ${colors.rule};padding-bottom:3px;">${time} UTC</div>`;

          // Sort descending by value
          const sorted = [...params].sort(
            (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
          );

          const rows = sorted
            .map((item) => {
              const val = Number(item.value);
              const formattedVal = Number.isFinite(val)
                ? `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh`
                : "--";
              const isActual = item.seriesName === "Actual Demand";
              const fontWeight = isActual || item.seriesName.includes("Stacking") ? 600 : 400;

              return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin:2px 0;">
                  <span style="display:inline-flex;align-items:center;gap:6px;font-weight:${fontWeight};">
                    <span style="display:inline-block;width:9px;height:3px;background-color:${item.color};"></span>
                    <span>${item.seriesName}</span>
                  </span>
                  <span style="font-weight:500;">${formattedVal}</span>
                </div>
              `;
            })
            .join("");

          return `<div class="gp-tooltip" style="min-width:210px;">${header}${rows}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: timestamps,
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: colors.ink, width: 1 },
        },
        axisTick: {
          lineStyle: { color: colors.ink },
        },
        axisLabel: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 10,
          formatter: (ts) => formatAxisStamp(ts),
          margin: 10,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "MWh",
        nameTextStyle: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 10,
          align: "right",
          padding: [0, 6, 0, 0],
        },
        scale: true,
        min: (val) => {
          const span = Math.max(val.max - val.min, 100);
          return Math.max(0, Math.floor((val.min - span * 0.08) / 50) * 50);
        },
        max: (val) => {
          const span = Math.max(val.max - val.min, 100);
          return Math.ceil((val.max + span * 0.16) / 50) * 50;
        },
        axisLine: {
          show: true,
          lineStyle: { color: colors.ink, width: 1 },
        },
        axisTick: {
          show: true,
          lineStyle: { color: colors.ink },
        },
        axisLabel: {
          color: colors.graphite,
          fontFamily: colors.fontMono,
          fontSize: 10,
          formatter: (v) => Number(v).toLocaleString(),
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: colors.grid,
            type: "dashed",
          },
        },
      },
      // Native ECharts DataZoom (Mouse-wheel + Drag + Slider)
      dataZoom: [
        {
          type: "inside",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          bottom: 4,
          height: 18,
          borderColor: colors.rule,
          backgroundColor: colors.vellum,
          fillerColor: colors.isDark ? "rgba(255, 89, 54, 0.22)" : "rgba(201, 56, 24, 0.16)",
          handleStyle: {
            color: colors.signal,
            borderColor: colors.paper,
            borderWidth: 1.5,
          },
          moveHandleStyle: {
            color: colors.graphite,
          },
          textStyle: {
            color: colors.graphite,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
          },
          dataBackground: {
            lineStyle: { color: colors.graphite, width: 1 },
            areaStyle: { color: colors.rule },
          },
          selectedDataBackground: {
            lineStyle: { color: colors.signal, width: 1.5 },
            areaStyle: { color: colors.signal, opacity: 0.2 },
          },
        },
      ],
      series: chartSeries,
    };
  }, [
    series,
    timestamps,
    enabledSpecs,
    colors,
    spotlightKey,
    peakIndex,
    peakActual,
  ]);

  // Toolbar Actions via ECharts dispatchAction
  const handleZoomIn = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    const currentOption = inst.getOption();
    const zoom = currentOption.dataZoom?.[0] || {};
    const start = zoom.start ?? 0;
    const end = zoom.end ?? 100;
    const center = (start + end) / 2;
    const span = (end - start) * 0.7; // zoom in by 30%
    const nextStart = Math.max(0, center - span / 2);
    const nextEnd = Math.min(100, center + span / 2);
    inst.dispatchAction({
      type: "dataZoom",
      start: nextStart,
      end: nextEnd,
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
    const nextStart = Math.max(0, center - span / 2);
    const nextEnd = Math.min(100, center + span / 2);
    inst.dispatchAction({
      type: "dataZoom",
      start: nextStart,
      end: nextEnd,
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
    const nextEnd = nextStart + span;
    inst.dispatchAction({
      type: "dataZoom",
      start: nextStart,
      end: nextEnd,
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
    const nextStart = nextEnd - span;
    inst.dispatchAction({
      type: "dataZoom",
      start: nextStart,
      end: nextEnd,
    });
  }, []);

  // Listen for ECharts native datazoom events to update toolbar readout & parent metrics
  const onEvents = useMemo(
    () => ({
      datazoom: () => {
        const inst = echartsRef.current?.getEchartsInstance();
        if (!inst || !totalPoints) return;
        const currentOption = inst.getOption();
        const zoom = currentOption.dataZoom?.[0] || {};
        const start = zoom.start ?? 0;
        const end = zoom.end ?? 100;
        const span = Math.max(0.01, end - start);
        const factor = 100 / span;
        setZoomFactor(factor);
        setIsZoomed(start > 1 || end < 99);

        if (onZoomRangeChange) {
          const sIdx = Math.max(0, Math.floor((start / 100) * totalPoints));
          const eIdx = Math.min(totalPoints - 1, Math.ceil((end / 100) * totalPoints));
          onZoomRangeChange(start > 1 || end < 99 ? [sIdx, eIdx] : null);
        }
      },
    }),
    [totalPoints, onZoomRangeChange]
  );

  if (!series.length) return null;

  const tableSampleStep = Math.max(1, Math.floor(series.length / 12));
  const sampledRows = series.filter(
    (_, idx) => idx % tableSampleStep === 0 || idx === series.length - 1
  );

  return (
    <div className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">STRIP-CHART RECORDER // 24H HORIZON</span>
          <h3 className="instrument-title">
            {cityLabel} — Metered Load vs. Day-Ahead Ensemble Traces
          </h3>
          <p className="instrument-subtitle">
            {isZoomed
              ? `Zoom factor ${zoomFactor.toFixed(1)}x · Native wheel/drag zoom active · Double-click or click Reset for full archive`
              : `${series.length.toLocaleString()} hourly intervals · ${String(
                  series[0]?.timestamp
                ).slice(0, 10)} to ${String(series[series.length - 1]?.timestamp).slice(
                  0,
                  10
                )} · Use mouse-wheel or slider track below to zoom`}
          </p>
        </div>

        <div className="instrument-header-actions">
          <ChartZoomToolbar
            zoomFactor={zoomFactor}
            isZoomed={isZoomed}
            canZoomIn={zoomFactor < 15}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onPanLeft={handlePanLeft}
            onPanRight={handlePanRight}
            canZoom={series.length > 8}
          />
        </div>
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
          const modelColor = getModelEChartsColor(spec.key, colors);

          return (
            <button
              key={spec.key}
              type="button"
              className={`trace-pill ${isPinned ? "is-pinned" : ""} ${isDimmed ? "is-dimmed" : ""}`}
              onMouseEnter={() => setHoveredTrace(spec.key)}
              onMouseLeave={() => setHoveredTrace(null)}
              onClick={() => togglePin(spec.key)}
              aria-pressed={isPinned}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  inlineSize: "14px",
                  blockSize: "3px",
                  backgroundColor: modelColor,
                }}
              />
              <span>{spec.shortLabel}</span>
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

      {/* Responsive ECharts Canvas Stage */}
      <div
        className="chart-stage"
        onDoubleClick={handleReset}
        style={{
          blockSize: `${height}px`,
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
