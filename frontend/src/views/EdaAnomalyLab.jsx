import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CITIES, getCityMeta } from "../constants/cities";
import { fetchEda, invalidateApiCache } from "../services/api";
import {
  BeforeAfterFaultCaliper,
  DailyTrendRecorder,
  DiurnalProfileChart,
} from "../components/charts/DiurnalAndTrendCharts";
import { EmptyState, ErrorState, LoadingInstrument } from "../components/StatusViews";

export default function EdaAnomalyLab({ selectedCity, onSelectCity }) {
  const [eda, setEda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const auditCaptionId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchEda(selectedCity, { signal: controller.signal })
      .then((res) => {
        setEda(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [selectedCity, reloadToken]);

  const handleRetry = useCallback(() => {
    invalidateApiCache("/api/eda");
    setReloadToken((n) => n + 1);
  }, []);

  const { totals, cityAudit } = useMemo(() => {
    const rows = eda?.anomaly_summary_all_cities || [];
    const agg = rows.reduce(
      (acc, r) => ({
        hours: acc.hours + (Number(r.total_hours) || 0),
        severe: acc.severe + (Number(r.severe_replaced) || 0),
        isoFlags: acc.isoFlags + (Number(r.isoforest_flag) || 0),
        ramp: acc.ramp + (Number(r.ramp_err) || 0),
      }),
      { hours: 0, severe: 0, isoFlags: 0, ramp: 0 }
    );
    const current = rows.find((r) => r.city === selectedCity) || null;
    return { totals: agg, cityAudit: current };
  }, [eda, selectedCity]);

  const cityMeta = getCityMeta(selectedCity);
  const isInitialLoad = loading && !eda;
  const isSyncing = loading && Boolean(eda);

  return (
    <div className="reveal-frame">
      <section className="editorial-section" aria-labelledby="eda-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. 02 // DATA QUALITY &amp; EDA LAB</span>
            <h1 id="eda-heading" className="section-heading">
              Telemetry Sanitization &amp; Load Regimes
            </h1>
            <p className="section-lede">
              Four deterministic physical/statistical screens plus multivariate Isolation Forest
              sanitize sensor dropouts before feature lag construction.
            </p>

            <div className="control-field" style={{ marginBlockStart: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <label htmlFor="eda-city-select" className="control-label">
                  Inspect Metered Zone
                </label>
                {isSyncing && (
                  <span className="sync-badge" aria-live="polite">
                    Syncing...
                  </span>
                )}
              </div>
              <select
                id="eda-city-select"
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
          </div>

          <div>
            {isInitialLoad ? (
              <LoadingInstrument label={`Auditing ${cityMeta.name} sensor ledger...`} height={310} />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} contextLabel="EDA & ANOMALY LAB" />
            ) : !eda ? (
              <EmptyState
                title="No EDA payload available"
                description="The server returned an empty record set for this city."
                actionLabel="Retry Audit"
                onAction={handleRetry}
              />
            ) : (
              <div className={`sync-surface ${isSyncing ? "is-syncing" : ""}`}>
                <div className="metric-strip" style={{ marginBlockEnd: "1.25rem" }}>
                  <div className="metric-cell">
                    <div className="metric-cell-label">Severe Spikes Fixed (10 Cities)</div>
                    <div className="metric-cell-value" style={{ color: "var(--c-signal)" }}>
                      {totals.severe.toLocaleString()}
                    </div>
                    <div className="metric-cell-sub">
                      Across {totals.hours.toLocaleString()} metered hours
                    </div>
                  </div>
                  <div className="metric-cell">
                    <div className="metric-cell-label">Isolation Forest Flags</div>
                    <div className="metric-cell-value">{totals.isoFlags.toLocaleString()}</div>
                    <div className="metric-cell-sub">0.5% contamination envelope</div>
                  </div>
                  <div className="metric-cell">
                    <div className="metric-cell-label">{cityMeta.name} Raw Extremes</div>
                    <div className="metric-cell-value">
                      {cityAudit
                        ? `${Math.round(cityAudit.raw_min).toLocaleString()} / ${Math.round(
                            cityAudit.raw_max
                          ).toLocaleString()}`
                        : "--"}
                    </div>
                    <div className="metric-cell-sub">Raw [min / max] MWh</div>
                  </div>
                  <div className="metric-cell">
                    <div className="metric-cell-label">{cityMeta.name} Repaired Span</div>
                    <div className="metric-cell-value">
                      {cityAudit
                        ? `${Math.round(cityAudit.clean_min).toLocaleString()}–${Math.round(
                            cityAudit.clean_max
                          ).toLocaleString()}`
                        : "--"}
                    </div>
                    <div className="metric-cell-sub">
                      {cityAudit?.severe_replaced ?? 0} spikes imputed in {cityMeta.iso}
                    </div>
                  </div>
                </div>

                <DiurnalProfileChart
                  diurnalProfile={eda.diurnal_profile || []}
                  cityLabel={`${cityMeta.name} (${cityMeta.iso})`}
                />
              </div>
            )}
          </div>

          {/* Deliberate Grid Break: Full-width Before-vs-After Telemetry Fault Caliper */}
          {!isInitialLoad && !error && eda && (
            <div className="grid-break-bleed" style={{ backgroundColor: "var(--c-paper)" }}>
              <span className="grid-break-stamp">BEFORE VS. AFTER // SENSOR REPAIR AUDIT</span>
              <BeforeAfterFaultCaliper
                anomalySummary={eda.anomaly_summary_all_cities || []}
                selectedCity={selectedCity}
                onSelectCity={onSelectCity}
              />

              <details className="chart-table-disclosure">
                <summary>
                  Open Full 10-City Anomaly Rule Ledger (Physical, Z-Score, IQR, Ramp, IsoForest)
                </summary>
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby={auditCaptionId}
                  className="table-wrapper"
                  style={{ marginBlockStart: "0.7rem" }}
                >
                  <table
                    className="gp-table"
                    style={{
                      "--label-2": '"Raw Span (MWh)"',
                      "--label-3": '"Clean Span (MWh)"',
                      "--label-4": '"Physical / Z / IQR"',
                      "--label-5": '"IsoForest Flags"',
                      "--label-6": '"Spikes Fixed"',
                    }}
                  >
                    <caption id={auditCaptionId}>
                      Per-city anomaly detection counts and before/after MWh bounds
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">City</th>
                        <th scope="col" className="align-right">Raw Span (MWh)</th>
                        <th scope="col" className="align-right">Clean Span (MWh)</th>
                        <th scope="col" className="align-right">Phys / Z / IQR</th>
                        <th scope="col" className="align-right">IsoForest</th>
                        <th scope="col" className="align-right">Spikes Fixed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(eda.anomaly_summary_all_cities || []).map((r) => {
                        const m = getCityMeta(r.city);
                        return (
                          <tr
                            key={r.city}
                            className={r.city === selectedCity ? "is-highlight" : undefined}
                          >
                            <th scope="row">
                              {m.name} ({m.iso})
                            </th>
                            <td className="align-right">
                              {Math.round(r.raw_min).toLocaleString()} to{" "}
                              {Math.round(r.raw_max).toLocaleString()}
                            </td>
                            <td className="align-right">
                              {Math.round(r.clean_min).toLocaleString()} to{" "}
                              {Math.round(r.clean_max).toLocaleString()}
                            </td>
                            <td className="align-right">
                              {r.physical_err} / {r.zscore_err} / {r.iqr_err}
                            </td>
                            <td className="align-right">{r.isoforest_flag}</td>
                            <td
                              className="align-right"
                              style={{
                                color: r.severe_replaced > 20 ? "var(--c-signal)" : "var(--c-ink)",
                                fontWeight: r.severe_replaced > 20 ? 600 : 400,
                              }}
                            >
                              {r.severe_replaced}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {/* Full 2018-2020 Daily Trend Recorder */}
          {!isInitialLoad && !error && eda && (
            <div
              style={{ gridColumn: "1 / -1" }}
              className={`sync-surface ${isSyncing ? "is-syncing" : ""}`}
            >
              <DailyTrendRecorder
                dailySeries={eda.daily_series || []}
                cityLabel={`${cityMeta.name} (${cityMeta.iso})`}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
