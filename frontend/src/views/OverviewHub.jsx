import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CITIES, getCityMeta } from "../constants/cities";
import { fetchEda, fetchLeaderboard, invalidateApiCache } from "../services/api";
import LeaderboardReadout from "../components/LeaderboardReadout";
import { EmptyState, ErrorState, LoadingInstrument } from "../components/StatusViews";

export default function OverviewHub({
  selectedCity,
  onSelectCity,
  onOpenSection,
}) {
  const [edaData, setEdaData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [targetSection, setTargetSection] = useState("forecast");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      fetchEda(selectedCity, { signal: controller.signal }),
      fetchLeaderboard({ signal: controller.signal }),
    ])
      .then(([edaRes, lbRes]) => {
        setEdaData(edaRes);
        setLeaderboard(lbRes?.models || []);
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
    invalidateApiCache();
    setReloadToken((n) => n + 1);
  }, []);

  const { cityRows, systemMaxPeak } = useMemo(() => {
    const summaryMap = Object.fromEntries(
      (edaData?.anomaly_summary_all_cities || []).map((r) => [r.city, r])
    );
    let maxPeak = 1;
    const merged = CITIES.map((meta) => {
      const stats = summaryMap[meta.slug] || null;
      if (stats?.clean_max > maxPeak) maxPeak = stats.clean_max;
      return { meta, stats };
    });
    return { cityRows: merged, systemMaxPeak: maxPeak };
  }, [edaData]);

  const handleSwitchboardClick = (slug) => {
    onSelectCity(slug);
    onOpenSection(targetSection);
  };

  const activeMeta = getCityMeta(selectedCity);
  const isInitialLoad = loading && !edaData;

  return (
    <div className="reveal-frame">
      <section className="editorial-section" aria-labelledby="hub-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. 01 // OVERVIEW &amp; CITY HUB</span>
            <h1 id="hub-heading" className="section-heading">
              Municipal Dispatch Switchboard
            </h1>
            <p className="section-lede">
              Select any of the 10 metered load zones below to lock it globally across every
              instrument bay and open its telemetry analysis.
            </p>

            <div style={{ marginBlockStart: "1.25rem" }}>
              <span className="control-label" style={{ display: "block", marginBlockEnd: "0.35rem" }}>
                On City Selection, Route To:
              </span>
              <div className="segmented-control" role="group" aria-label="Destination section on city click">
                <button
                  type="button"
                  className="segmented-btn"
                  aria-pressed={targetSection === "eda"}
                  onClick={() => setTargetSection("eda")}
                >
                  02 Quality &amp; EDA
                </button>
                <button
                  type="button"
                  className="segmented-btn"
                  aria-pressed={targetSection === "forecast"}
                  onClick={() => setTargetSection("forecast")}
                >
                  04 Forecast Studio
                </button>
              </div>
            </div>

            <div
              style={{
                marginBlockStart: "1.5rem",
                paddingBlockStart: "1rem",
                borderBlockStart: "1px solid var(--c-rule)",
              }}
            >
              <span className="kicker">ACTIVE GLOBAL ZONE</span>
              <p className="font-display" style={{ fontSize: "1.35rem", fontWeight: 500 }}>
                {activeMeta.name}, {activeMeta.state}
              </p>
              <p className="font-mono" style={{ fontSize: "0.74rem", color: "var(--c-graphite)" }}>
                {activeMeta.isoFull}
              </p>
            </div>
          </div>

          <div>
            {isInitialLoad ? (
              <LoadingInstrument label="Polling 10-city telemetry index and ISO envelopes..." height={380} />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} contextLabel="CITY SWITCHBOARD" />
            ) : !cityRows.some((r) => r.stats) ? (
              <EmptyState
                title="No city summary telemetry available"
                description="The server returned an empty city telemetry summary."
                actionLabel="Retry Switchboard Sync"
                onAction={handleRetry}
              />
            ) : (
              <div className="switchboard-frame containment-panel" role="list" aria-label="10 U.S. city load zones">
                <div className="switchboard-header" aria-hidden="true">
                  <span>Bay</span>
                  <span>Load Zone</span>
                  <span>ISO</span>
                  <span>Mean / Peak Scale</span>
                  <span style={{ textAlign: "right" }}>Mean MWh</span>
                  <span style={{ textAlign: "right" }}>Peak MWh</span>
                  <span style={{ textAlign: "right" }}>Dispatch</span>
                </div>

                {cityRows.map(({ meta, stats }) => {
                  const isSelected = meta.slug === selectedCity;
                  const meanVal = stats?.clean_mean ?? 0;
                  const peakVal = stats?.clean_max ?? 0;
                  const meanPct = Math.min(100, (meanVal / systemMaxPeak) * 100);
                  const peakPct = Math.min(100, (peakVal / systemMaxPeak) * 100);

                  return (
                    <button
                      key={meta.slug}
                      type="button"
                      role="listitem"
                      className={`switchboard-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSwitchboardClick(meta.slug)}
                      aria-label={`${meta.name}, ${meta.iso}, Mean ${Math.round(
                        meanVal
                      )} MWh, Peak ${Math.round(peakVal)} MWh. Click to set active city and open analysis.`}
                    >
                      <span className="sb-bay">{meta.bay}</span>
                      <span className="sb-city">
                        {meta.name}
                        <span
                          className="font-mono"
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--c-graphite)",
                            marginInlineStart: "0.4rem",
                          }}
                        >
                          {meta.state}
                        </span>
                      </span>
                      <span>
                        <span className="sb-iso">{meta.iso}</span>
                      </span>

                      <span className="sb-gauge-cell" aria-hidden="true">
                        <span className="sb-gauge-track" style={{ display: "block" }}>
                          <span
                            className="sb-gauge-mean"
                            style={{ inlineSize: `${meanPct.toFixed(1)}%` }}
                          />
                          <span
                            className="sb-gauge-peak"
                            style={{ insetInlineStart: `calc(${peakPct.toFixed(1)}% - 1px)` }}
                          />
                        </span>
                      </span>

                      <span className="sb-num sb-num-mean">
                        <span className="sb-mobile-label">Mean:</span>
                        <span>{Math.round(meanVal).toLocaleString()}</span>
                      </span>
                      <span className="sb-num sb-num-peak">
                        <span className="sb-mobile-label">Peak:</span>
                        <span>{Math.round(peakVal).toLocaleString()}</span>
                      </span>
                      <span className="sb-action">
                        {isSelected ? "[ACTIVE ->]" : "INSPECT ->"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deliberate Grid Break: Full-width Out-of-Time Model Leaderboard */}
          <div className="grid-break-bleed" style={{ backgroundColor: "var(--c-paper)" }}>
            <span className="grid-break-stamp">BENCHMARK LEDGER // 7 ARCHITECTURES</span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
                marginBlockEnd: "1rem",
              }}
            >
              <div>
                <h2 className="section-heading" style={{ fontSize: "var(--text-h2)", marginBlockEnd: "0.2rem" }}>
                  24-Hour-Ahead Model Leaderboard &amp; 95% Confidence Intervals
                </h2>
                <p className="section-lede">
                  Evaluated strictly out-of-time on 18,049 hourly records (Mar–May 2020) with 500x
                  non-parametric bootstrap confidence intervals and skill percentage against 24-hour
                  naive persistence.
                </p>
              </div>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => onOpenSection("forecast")}
              >
                Compare Traces in Studio -&gt;
              </button>
            </div>

            {loading && !leaderboard.length ? (
              <LoadingInstrument label="Computing confidence interval brackets..." height={240} />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} contextLabel="LEADERBOARD" />
            ) : !leaderboard.length ? (
              <EmptyState
                title="Leaderboard metrics empty"
                description="No leaderboard rows returned by the server."
                actionLabel="Retry"
                onAction={handleRetry}
              />
            ) : (
              <LeaderboardReadout models={leaderboard} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
