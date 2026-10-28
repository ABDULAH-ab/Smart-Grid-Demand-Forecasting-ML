import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  CITIES,
  FORECAST_MODELS,
  HOLDOUT_MAX_DATE_DEFAULT,
  HOLDOUT_MIN_DATE,
  formatFeatureName,
  formatModelName,
  getCityMeta,
} from "../constants/cities";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { fetchForecasts, invalidateApiCache } from "../services/api";
import ForecastReadoutChart from "../components/charts/ForecastReadoutChart";
import ResidualTempChart from "../components/charts/ResidualTempChart";
import { EmptyState, ErrorState, LoadingInstrument } from "../components/StatusViews";

function computeWindowMetrics(series, modelKey) {
  let n = 0;
  let absSum = 0;
  let sqSum = 0;
  let apeSum = 0;
  let apeCount = 0;

  for (const row of series) {
    const actual = Number(row.actual_demand);
    const pred = Number(row[modelKey]);
    if (!Number.isFinite(actual) || !Number.isFinite(pred)) continue;
    const err = pred - actual;
    n += 1;
    absSum += Math.abs(err);
    sqSum += err * err;
    if (Math.abs(actual) > 1e-3) {
      apeSum += Math.abs(err / actual) * 100;
      apeCount += 1;
    }
  }

  if (n === 0) return null;
  return {
    n,
    mae: absSum / n,
    rmse: Math.sqrt(sqSum / n),
    mape: apeCount > 0 ? apeSum / apeCount : 0,
  };
}

export default function ForecastingStudio({ selectedCity, onSelectCity }) {
  const [startDate, setStartDate] = useState("2020-04-01");
  const [endDate, setEndDate] = useState("2020-04-10");
  const [activeModels, setActiveModels] = useState(() =>
    FORECAST_MODELS.filter((m) => m.defaultOn).map((m) => m.key)
  );

  const debouncedStart = useDebouncedValue(startDate, 260);
  const debouncedEnd = useDebouncedValue(endDate, 260);

  const [forecastPayload, setForecastPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const windowTableId = useId();

  const cityMeta = getCityMeta(selectedCity);
  const dateRangeInvalid =
    !debouncedStart || !debouncedEnd || debouncedStart > debouncedEnd;
  const outsideHoldoutEnvelope =
    !dateRangeInvalid &&
    (debouncedEnd < HOLDOUT_MIN_DATE || debouncedStart > HOLDOUT_MAX_DATE_DEFAULT);

  useEffect(() => {
    if (dateRangeInvalid || outsideHoldoutEnvelope) {
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchForecasts(
      { city: selectedCity, startDate: debouncedStart, endDate: debouncedEnd },
      { signal: controller.signal }
    )
      .then((res) => {
        setForecastPayload(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    selectedCity,
    debouncedStart,
    debouncedEnd,
    dateRangeInvalid,
    outsideHoldoutEnvelope,
    reloadToken,
  ]);

  const handleRetry = useCallback(() => {
    invalidateApiCache("/api/forecasts");
    setReloadToken((n) => n + 1);
  }, []);

  const toggleModel = (modelKey) => {
    setActiveModels((prev) =>
      prev.includes(modelKey)
        ? prev.filter((k) => k !== modelKey)
        : [...prev, modelKey]
    );
  };

  const applyPreset = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const primaryFocusModel = activeModels.includes("Stacking_Ensemble")
    ? "Stacking_Ensemble"
    : activeModels[0] || "Stacking_Ensemble";

  const { focusMetrics, naiveMetrics, allWindowMetrics, maxImportance } = useMemo(() => {
    const series = forecastPayload?.series || [];
    const fi = forecastPayload?.feature_importance || [];
    const maxImp = Math.max(...fi.map((f) => Number(f.importance) || 0), 0.01);

    if (!series.length) {
      return {
        focusMetrics: null,
        naiveMetrics: null,
        allWindowMetrics: [],
        maxImportance: maxImp,
      };
    }

    const computedAll = FORECAST_MODELS.map((m) => ({
      key: m.key,
      label: m.label,
      stats: computeWindowMetrics(series, m.key),
    }))
      .filter((r) => r.stats !== null)
      .sort((a, b) => a.stats.rmse - b.stats.rmse);

    const focus = computeWindowMetrics(series, primaryFocusModel);
    const naive = computeWindowMetrics(series, "Naive_Baseline");

    return {
      focusMetrics: focus,
      naiveMetrics: naive,
      allWindowMetrics: computedAll,
      maxImportance: maxImp,
    };
  }, [forecastPayload, primaryFocusModel]);

  const windowSkillPct =
    focusMetrics && naiveMetrics && naiveMetrics.rmse > 0
      ? ((1 - focusMetrics.rmse / naiveMetrics.rmse) * 100)
      : null;

  return (
    <div className="reveal-frame">
      <section className="editorial-section" aria-labelledby="studio-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. 04 // FORECASTING STUDIO</span>
            <h1 id="studio-heading" className="section-heading">
              24-Hour Day-Ahead Dispatch Studio
            </h1>
            <p className="section-lede">
              Compare metered load against seven forecasting architectures across the chronological
              2020 holdout archive ({HOLDOUT_MIN_DATE} to {cityMeta.holdoutEnd}).
            </p>

            <div style={{ marginBlockStart: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span className="control-label">Holdout Window Presets</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => applyPreset("2020-03-01", "2020-03-10")}
                >
                  Mar 1–10
                </button>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => applyPreset("2020-04-01", "2020-04-10")}
                >
                  Apr 1–10
                </button>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() =>
                    applyPreset(
                      cityMeta.holdoutEnd === "2020-04-26" ? "2020-04-16" : "2020-05-08",
                      cityMeta.holdoutEnd
                    )
                  }
                >
                  Late Spring
                </button>
              </div>
            </div>
          </div>

          <div>
            {/* Studio Console: City + Start/End Dates + 7 Model Checkboxes */}
            <form
              className="control-console"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Forecast studio controls"
            >
              <div className="control-field">
                <label htmlFor="studio-city" className="control-label">
                  Load Zone (ISO)
                </label>
                <select
                  id="studio-city"
                  className="gp-select"
                  value={selectedCity}
                  onChange={(e) => onSelectCity(e.target.value)}
                >
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.bay} — {c.name} ({c.iso})
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-field">
                <label htmlFor="studio-start" className="control-label">
                  Start Date
                </label>
                <input
                  id="studio-start"
                  type="date"
                  className="gp-input"
                  min={HOLDOUT_MIN_DATE}
                  max={cityMeta.holdoutEnd}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="control-field">
                <label htmlFor="studio-end" className="control-label">
                  End Date (max {cityMeta.holdoutEnd})
                </label>
                <input
                  id="studio-end"
                  type="date"
                  className="gp-input"
                  min={HOLDOUT_MIN_DATE}
                  max={cityMeta.holdoutEnd}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="model-toggles-grid" role="group" aria-label="Toggle 7 forecasting models">
                {FORECAST_MODELS.map((m) => {
                  const checked = activeModels.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      htmlFor={`chk-${m.key}`}
                      className={`model-toggle-item gp-check-label ${checked ? "is-checked" : ""}`}
                      style={{
                        borderColor: checked ? m.color : undefined,
                      }}
                    >
                      <input
                        id={`chk-${m.key}`}
                        type="checkbox"
                        className="gp-check"
                        checked={checked}
                        onChange={() => toggleModel(m.key)}
                      />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                        <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
                          <line
                            x1="0"
                            y1="4"
                            x2="16"
                            y2="4"
                            stroke={m.color}
                            strokeWidth={Math.max(2, m.strokeWidth)}
                            strokeDasharray={m.strokeDasharray}
                          />
                        </svg>
                        <span
                          style={{
                            color:
                              m.key === "Stacking_Ensemble" && checked
                                ? "var(--c-signal)"
                                : "var(--c-ink)",
                            fontWeight: checked ? 600 : 400,
                          }}
                        >
                          {m.shortLabel}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </form>

            {/* Date Validation & Data States */}
            {dateRangeInvalid ? (
              <EmptyState
                title="Invalid date window: Start Date must precede or equal End Date"
                description={`Selected window (${startDate || "empty"} to ${
                  endDate || "empty"
                }) is inverted or incomplete. Valid holdout archive for ${
                  cityMeta.name
                } spans ${HOLDOUT_MIN_DATE} through ${cityMeta.holdoutEnd}.`}
                actionLabel="Reset to Apr 1–10, 2020"
                onAction={() => applyPreset("2020-04-01", "2020-04-10")}
              />
            ) : outsideHoldoutEnvelope ? (
              <EmptyState
                title="Selected dates fall outside the 2020 holdout evaluation archive"
                description={`Out-of-time test forecasts cover ${HOLDOUT_MIN_DATE} through ${cityMeta.holdoutEnd}.`}
                actionLabel="Snap to Valid Holdout Window"
                onAction={() => applyPreset("2020-04-01", "2020-04-10")}
              />
            ) : loading ? (
              <LoadingInstrument
                label={`Fetching ${cityMeta.name} hourly traces (${debouncedStart}..${debouncedEnd})...`}
                height={340}
              />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} contextLabel="FORECASTING STUDIO" />
            ) : !forecastPayload?.series?.length ? (
              <EmptyState
                title={`Zero hourly records in ${debouncedStart} to ${debouncedEnd} for ${cityMeta.name}`}
                description={`Note: ${cityMeta.name} (${cityMeta.iso}) metered holdout archive ends ${cityMeta.holdoutEnd}. Choose dates on or before ${cityMeta.holdoutEnd}.`}
                actionLabel={`Load ${cityMeta.name} Apr 1–10, 2020`}
                onAction={() => applyPreset("2020-04-01", "2020-04-10")}
              />
            ) : (
              /* Live Window MAE / RMSE / MAPE Readout Strip */
              <div className="metric-strip">
                <div className="metric-cell">
                  <div className="metric-cell-label">
                    Window RMSE ({formatModelName(primaryFocusModel)})
                  </div>
                  <div className="metric-cell-value" style={{ color: "var(--c-signal)" }}>
                    {focusMetrics ? `${focusMetrics.rmse.toFixed(1)} MWh` : "--"}
                  </div>
                  <div className="metric-cell-sub">
                    {focusMetrics?.n ?? 0} hourly intervals evaluated
                  </div>
                </div>

                <div className="metric-cell">
                  <div className="metric-cell-label">Window MAE</div>
                  <div className="metric-cell-value">
                    {focusMetrics ? `${focusMetrics.mae.toFixed(1)} MWh` : "--"}
                  </div>
                  <div className="metric-cell-sub">Mean absolute hourly deviation</div>
                </div>

                <div className="metric-cell">
                  <div className="metric-cell-label">Window MAPE</div>
                  <div className="metric-cell-value">
                    {focusMetrics ? `${focusMetrics.mape.toFixed(2)}%` : "--"}
                  </div>
                  <div className="metric-cell-sub">Relative percentage error</div>
                </div>

                <div className="metric-cell">
                  <div className="metric-cell-label">Window Skill vs. Naive</div>
                  <div className="metric-cell-value">
                    {windowSkillPct !== null
                      ? `${windowSkillPct >= 0 ? "+" : ""}${windowSkillPct.toFixed(1)}%`
                      : "--"}
                  </div>
                  <div className="metric-cell-sub">
                    Naive RMSE: {naiveMetrics ? `${naiveMetrics.rmse.toFixed(1)} MWh` : "--"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deliberate Grid Break: Full-width Primary Forecast Readout Chart */}
          {!dateRangeInvalid &&
            !outsideHoldoutEnvelope &&
            !loading &&
            !error &&
            forecastPayload?.series?.length > 0 && (
              <>
                <div className="grid-break-bleed" style={{ backgroundColor: "var(--c-paper)" }}>
                  <span className="grid-break-stamp">
                    PRIMARY INSTRUMENT // {cityMeta.name.toUpperCase()} ({cityMeta.iso})
                  </span>
                  <ForecastReadoutChart
                    series={forecastPayload.series}
                    activeModels={activeModels}
                    cityLabel={`${cityMeta.name} (${cityMeta.iso})`}
                    height={365}
                    syncId="studioSync"
                  />

                  <details className="chart-table-disclosure">
                    <summary>
                      Compare Live Window Metrics Across All 7 Models ({forecastPayload.row_count} hrs)
                    </summary>
                    <div
                      tabIndex={0}
                      role="region"
                      aria-labelledby={windowTableId}
                      className="table-wrapper"
                      style={{ marginBlockStart: "0.65rem" }}
                    >
                      <table
                        className="gp-table"
                        style={{
                          "--label-2": '"Window RMSE"',
                          "--label-3": '"Window MAE"',
                          "--label-4": '"Window MAPE"',
                        }}
                      >
                        <caption id={windowTableId}>
                          Live error metrics computed on {cityMeta.name} ({debouncedStart} to{" "}
                          {debouncedEnd})
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Model</th>
                            <th scope="col" className="align-right">Window RMSE (MWh)</th>
                            <th scope="col" className="align-right">Window MAE (MWh)</th>
                            <th scope="col" className="align-right">Window MAPE (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allWindowMetrics.map((row) => (
                            <tr
                              key={row.key}
                              className={
                                row.key === "Stacking_Ensemble" ? "is-highlight" : undefined
                              }
                            >
                              <th scope="row">{row.label}</th>
                              <td className="align-right">{row.stats.rmse.toFixed(2)}</td>
                              <td className="align-right">{row.stats.mae.toFixed(2)}</td>
                              <td className="align-right">{row.stats.mape.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>

                {/* Lower Asymmetric Split: Residual+Temp Recorder (7fr) + Feature Importances (5fr) */}
                <div style={{ gridColumn: "1 / -1" }} className="split-7-5">
                  <ResidualTempChart
                    series={forecastPayload.series}
                    primaryModel={primaryFocusModel}
                  />

                  <div className="instrument-frame containment-panel">
                    <div className="instrument-header">
                      <div>
                        <span className="kicker">EXPLAINABILITY // GAIN ATTRIBUTION</span>
                        <h3 className="instrument-title">Top 10 Predictive Drivers</h3>
                        <p className="instrument-subtitle">
                          Tree-ensemble split gain attribution across autoregressive &amp; weather
                          features
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                      {(forecastPayload.feature_importance || []).map((item, idx) => {
                        const imp = Number(item.importance) || 0;
                        const widthPct = Math.max(2, (imp / maxImportance) * 100);
                        const isTop = idx === 0;

                        return (
                          <div key={item.feature}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: "0.5rem",
                                marginBlockEnd: "0.2rem",
                              }}
                            >
                              <span style={{ fontSize: "0.84rem", fontWeight: isTop ? 600 : 400 }}>
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "var(--c-graphite)",
                                    marginInlineEnd: "0.4rem",
                                  }}
                                >
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                {formatFeatureName(item.feature)}
                              </span>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: "0.78rem",
                                  color: isTop ? "var(--c-signal)" : "var(--c-ink)",
                                  fontWeight: isTop ? 600 : 400,
                                }}
                              >
                                {(imp * 100).toFixed(1)}%
                              </span>
                            </div>

                            {/* Animated Precision Caliper Gauge */}
                            <div
                              style={{
                                inlineSize: "100%",
                                blockSize: "8px",
                                borderBlockEnd: "1px solid var(--c-grid)",
                                position: "relative",
                              }}
                              aria-hidden="true"
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  insetInlineStart: 0,
                                  insetBlockStart: "3px",
                                  inlineSize: `${widthPct.toFixed(1)}%`,
                                  blockSize: "2.5px",
                                  backgroundColor: isTop ? "var(--c-signal)" : "var(--c-ink)",
                                  transition: "inline-size var(--dur-chart) var(--ease-out-quart)",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  insetInlineStart: `calc(${widthPct.toFixed(1)}% - 2.5px)`,
                                  insetBlockStart: "1.5px",
                                  inlineSize: "5px",
                                  blockSize: "5px",
                                  backgroundColor: isTop ? "var(--c-signal)" : "var(--c-ink)",
                                  transition:
                                    "inset-inline-start var(--dur-chart) var(--ease-out-quart)",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
        </div>
      </section>
    </div>
  );
}
