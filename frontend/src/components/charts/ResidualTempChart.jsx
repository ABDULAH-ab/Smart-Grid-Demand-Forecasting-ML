import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { formatModelName } from "../../constants/cities";
import { useEChartsColors, getModelEChartsColor } from "../../hooks/useEChartsColors";
import ChartZoomToolbar from "./ChartZoomToolbar";

/**
 * Format timestamp stamp for x-axis ticks
 */
function shortStamp(ts) {
  if (!ts) return "";
  const clean = String(ts).replace("T", " ");
  return `${clean.slice(5, 10)} ${clean.slice(11, 16)}`;
}

/**
 * Dual-channel Apache ECharts diagnostic recorder:
 * Channel A: Residual Drift (Model minus Metered Load MWh) around 0 MWh datum
 * Channel B: Synchronized Ambient Temperature (°F) with 65°F degree-hour datum
 *
 * Zoom and pan are linked across Channel A & B inside this instrument,
 * but completely isolated from the primary forecast chart!
 */
export default function ResidualTempChart({
  series = [],
  primaryModel = "Stacking_Ensemble",
}) {
  const echartsRef = useRef(null);
  const colors = useEChartsColors();

  const [zoomFactor, setZoomFactor] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const enriched = useMemo(() => {
    if (!series.length) return [];
    return series.map((r) => {
      const pred = Number(r[primaryModel]);
      const actual = Number(r.actual_demand);
      const residual = Number.isFinite(pred) && Number.isFinite(actual) ? pred - actual : 0;
      return {
        timestamp: r.timestamp,
        residual,
        temperature: Number(r.temperature) || 0,
      };
    });
  }, [series, primaryModel]);

  const maxErrPoint = useMemo(() => {
    if (!enriched.length) return null;
    let worst = enriched[0];
    for (const item of enriched) {
      if (Math.abs(item.residual) > Math.abs(worst.residual)) {
        worst = item;
      }
    }
    return worst;
  }, [enriched]);

  const modelLabel = formatModelName(primaryModel);
  const modelColor = getModelEChartsColor(primaryModel, colors);
  const timestamps = useMemo(() => enriched.map((r) => r.timestamp), [enriched]);

  const option = useMemo(() => {
    if (!enriched.length) return {};

    const residuals = enriched.map((r) => r.residual);
    const temps = enriched.map((r) => r.temperature);

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 520,
      animationDurationUpdate: 450,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        label: {
          backgroundColor: colors.ink,
          color: colors.paper,
          fontFamily: colors.fontMono,
          fontSize: 10,
        },
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
        },
        formatter: (params) => {
          if (!params || !params.length) return "";
          const time = params[0].axisValueLabel || "";
          const resItem = params.find((p) => p.seriesName.includes("Residual"));
          const tempItem = params.find((p) => p.seriesName === "Temperature");

          const resVal = Number(resItem?.value);
          const formattedRes = Number.isFinite(resVal)
            ? `${resVal > 0 ? "+" : ""}${resVal.toFixed(1)} MWh`
            : "--";
          const tempVal = Number(tempItem?.value);
          const formattedTemp = Number.isFinite(tempVal) ? `${tempVal.toFixed(1)} °F` : "--";

          return `
            <div class="gp-tooltip" style="min-width:190px;">
              <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid ${colors.rule};padding-bottom:3px;">
                ${time} UTC
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:3px 0;">
                <span style="display:inline-flex;align-items:center;gap:5px;">
                  <span style="display:inline-block;width:9px;height:3px;background-color:${modelColor};"></span>
                  <span>${modelLabel} Residual</span>
                </span>
                <span style="font-weight:600;color:${Math.abs(resVal) > 350 ? colors.signal : colors.ink};">
                  ${formattedRes}
                </span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:3px 0;">
                <span style="display:inline-flex;align-items:center;gap:5px;color:${colors.xgb};">
                  <span>Ambient Temp</span>
                </span>
                <span style="font-weight:500;">${formattedTemp}</span>
              </div>
            </div>
          `;
        },
      },
      // Dual-Grid Layout
      grid: [
        {
          left: 56,
          right: 20,
          top: 26,
          height: "44%",
          containLabel: false,
        },
        {
          left: 56,
          right: 20,
          top: "62%",
          height: "26%",
          containLabel: false,
        },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: "category",
          data: timestamps,
          boundaryGap: false,
          axisLine: { lineStyle: { color: colors.rule } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
        {
          gridIndex: 1,
          type: "category",
          data: timestamps,
          boundaryGap: false,
          axisLine: { lineStyle: { color: colors.ink, width: 1 } },
          axisTick: { lineStyle: { color: colors.ink } },
          axisLabel: {
            color: colors.graphite,
            fontFamily: colors.fontMono,
            fontSize: 9.5,
            formatter: (ts) => shortStamp(ts),
            margin: 8,
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "value",
          name: "Res (MWh)",
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
            formatter: (v) => `${v > 0 ? "+" : ""}${v}`,
          },
          splitLine: {
            show: true,
            lineStyle: { color: colors.grid, type: "dashed" },
          },
        },
        {
          gridIndex: 1,
          type: "value",
          name: "Temp (°F)",
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
            formatter: (v) => `${v}°`,
          },
          splitLine: {
            show: true,
            lineStyle: { color: colors.grid, type: "dashed" },
          },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1],
          bottom: 2,
          height: 16,
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
        // Channel A: Residual Error
        {
          name: `${modelLabel} Residual`,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: residuals,
          smooth: 0.25,
          showSymbol: false,
          lineStyle: {
            color: modelColor,
            width: 1.8,
          },
          itemStyle: { color: modelColor },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: 0,
                lineStyle: { color: colors.ink, width: 1.25 },
                label: { show: false },
              },
            ],
          },
        },
        // Channel B: Temperature
        {
          name: "Temperature",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: temps,
          smooth: 0.25,
          showSymbol: false,
          lineStyle: {
            color: colors.xgb,
            width: 1.7,
          },
          itemStyle: { color: colors.xgb },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: 65,
                lineStyle: { color: colors.graphite, type: "dashed", width: 1 },
                label: {
                  formatter: "65°F BALANCE",
                  position: "insideEndTop",
                  color: colors.graphite,
                  fontFamily: colors.fontMono,
                  fontSize: 9,
                },
              },
            ],
          },
        },
      ],
    };
  }, [enriched, timestamps, colors, modelColor, modelLabel]);

  // Toolbar Actions via ECharts dispatchAction
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

  if (!enriched.length) return null;

  return (
    <div className="instrument-frame containment-panel">
      <div className="instrument-header">
        <div>
          <span className="kicker">DIAGNOSTIC RECORDER // ERROR &amp; THERMAL DRIVER</span>
          <h3 className="instrument-title">Residual Drift &amp; Ambient Temperature Trace</h3>
          <p className="instrument-subtitle">
            Residual = {modelLabel} minus Metered Load (0 MWh datum) · Independent diagnostic zoom
          </p>
        </div>

        <div className="instrument-header-actions">
          {maxErrPoint && (
            <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--c-signal)" }}>
              MAX:{" "}
              {maxErrPoint.residual > 0
                ? `+${maxErrPoint.residual.toFixed(1)}`
                : maxErrPoint.residual.toFixed(1)}{" "}
              MWh
            </div>
          )}
          <ChartZoomToolbar
            zoomFactor={zoomFactor}
            isZoomed={isZoomed}
            canZoomIn={zoomFactor < 15}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onPanLeft={handlePanLeft}
            onPanRight={handlePanRight}
            canZoom={enriched.length > 8}
          />
        </div>
      </div>

      <div
        className="chart-stage"
        onDoubleClick={handleReset}
        style={{
          blockSize: "330px",
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
    </div>
  );
}
