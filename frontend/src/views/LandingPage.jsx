import React, { useCallback, useEffect, useState } from "react";
import {
  fetchForecasts,
  fetchLeaderboard,
  invalidateApiCache,
} from "../services/api";
import LeaderboardReadout from "../components/LeaderboardReadout";
import ForecastReadoutChart from "../components/charts/ForecastReadoutChart";
import { EmptyState, ErrorState, LoadingInstrument } from "../components/StatusViews";

export default function LandingPage({ onEnterApp }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [previewSeries, setPreviewSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      fetchLeaderboard({ signal: controller.signal }),
      fetchForecasts(
        { city: "dallas", startDate: "2020-04-01", endDate: "2020-04-07" },
        { signal: controller.signal }
      ),
    ])
      .then(([lbRes, fcRes]) => {
        setLeaderboard(lbRes?.models || []);
        setPreviewSeries(fcRes?.series || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken]);

  const handleRetry = useCallback(() => {
    invalidateApiCache();
    setReloadToken((n) => n + 1);
  }, []);

  const isInitialLoad = loading && !previewSeries.length && !leaderboard.length;

  return (
    <div className="reveal-frame">
      {/* 1. Hero Ledger */}
      <section className="hero-ledger" aria-labelledby="hero-heading">
        <div>
          <span className="kicker">
            <span className="kicker-signal">DISPATCH BULLETIN GP-2020</span> // U.S. MUNICIPAL LOAD
            SYSTEM
          </span>
          {/* Strictly under 20 words (13 words) */}
          <h1 id="hero-heading" className="hero-headline">
            Cleans corrupted grid telemetry, maps weather-load regimes, and forecasts 24-hour city
            electricity demand.
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.25rem" }}>
            <button type="button" className="btn-primary" onClick={onEnterApp}>
              <span>Get started</span>
              <span aria-hidden="true">-&gt;</span>
            </button>
            <span className="font-mono" style={{ fontSize: "0.76rem", color: "var(--c-graphite)" }}>
              2018–2020 EIA-930 &amp; NOAA ISD archive · No login required
            </span>
          </div>
        </div>

        <aside className="hero-telemetry-ledger" aria-label="Corpus and benchmark figures">
          <div className="ledger-stat">
            <div className="ledger-stat-value">163,993</div>
            <div className="ledger-stat-label">Hourly Metered Load &amp; Weather Records</div>
          </div>
          <div className="ledger-stat">
            <div className="ledger-stat-value">10 Cities · 24h</div>
            <div className="ledger-stat-label">6 U.S. Balancing Authorities · Day-Ahead Horizon</div>
          </div>
          <div className="ledger-stat">
            <div className="ledger-stat-value is-signal">351.13 MWh</div>
            <div className="ledger-stat-label">
              Stacking Ensemble RMSE (+52.59% Skill vs. Naive)
            </div>
          </div>
        </aside>
      </section>

      {/* 2. Problem -> Approach Operational Brief */}
      <section className="editorial-section" aria-labelledby="brief-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. I // OPERATIONAL PROBLEM</span>
            <h2 id="brief-heading" className="section-heading" style={{ fontSize: "var(--text-h2)" }}>
              Why raw meter feeds fail day-ahead dispatch
            </h2>
            <p className="section-lede">
              Three failure modes separate textbook regression from utility operations. Each stage in
              this pipeline addresses one directly.
            </p>
          </div>

          <div>
            <div className="brief-row">
              <span className="brief-index">FAULT 01</span>
              <h3 className="brief-problem">Sensor anomalies corrupt demand data</h3>
              <p className="brief-approach">
                Raw regional telemetry includes impossible negative demand (-1,340 MWh in Phoenix)
                and 101,412 MWh meter dropouts. A four-rule physical/statistical screen plus
                per-city Isolation Forest flags 824 anomalous hours and repairs 279 severe spikes
                using causal historical medians—never peeking into future hours.
              </p>
            </div>

            <div className="brief-row">
              <span className="brief-index">REGIME 02</span>
              <h3 className="brief-problem">Weather drives load in non-obvious regimes</h3>
              <p className="brief-approach">
                A 10°F rise at 55°F barely shifts consumption; above 90°F in Texas or Arizona,
                compressor load climbs steeply and lingers past sunset. Standardized K-Means
                clustering (k = 4, 0.990 bootstrap ARI) isolates summer cooling peaks, mild daytime
                plateaus, and overnight baseloads across climate zones.
              </p>
            </div>

            <div className="brief-row">
              <span className="brief-index">COST 03</span>
              <h3 className="brief-problem">Day-ahead error costs money</h3>
              <p className="brief-approach">
                Over-forecasting commits idle thermal units; under-forecasting forces high-priced
                real-time balancing purchases. Stacking out-of-fold Ridge, Random Forest, XGBoost,
                and MLP predictions cuts 24-hour holdout RMSE from 740.66 MWh (naive persistence)
                down to 351.13 MWh across 18,049 test hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Deliberate Grid Break: Live Telemetry Preview from Real FastAPI Backend */}
      <section className="editorial-section" style={{ borderBlockEnd: "none" }} aria-labelledby="live-preview-heading">
        <div className="asymmetric-grid">
          <div className="grid-break-bleed">
            <span className="grid-break-stamp">LIVE TELEMETRY STREAM // VERIFIED READOUT</span>
            <div className="split-7-5" style={{ alignItems: "end", marginBlockEnd: "1.25rem" }}>
              <div>
                <h2 id="live-preview-heading" className="section-heading" style={{ marginBlockEnd: "0.35rem" }}>
                  Holdout Verification Readout
                </h2>
                <p className="section-lede" style={{ maxInlineSize: "100%", lineHeight: 1.55 }}>
                  Live holdout telemetry (Dallas ERCOT, Apr 1–7, 2020) and 10-city model leaderboard. Open the workbench to switch cities, inspect residuals, or re-cluster.
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                <button type="button" className="btn-quiet" onClick={onEnterApp}>
                  Open Full Dispatch Console -&gt;
                </button>
              </div>
            </div>

            {isInitialLoad ? (
              <div className="split-7-5">
                <LoadingInstrument label="Streaming Dallas ERCOT April 2020 trace..." height={270} />
                <LoadingInstrument label="Loading 7-model holdout leaderboard..." height={270} />
              </div>
            ) : error ? (
              <ErrorState
                error={error}
                onRetry={handleRetry}
                contextLabel="LIVE PREVIEW STREAM"
              />
            ) : !previewSeries.length && !leaderboard.length ? (
              <EmptyState
                title="Preview telemetry returned zero records"
                description="The backend responded, but forecast and leaderboard tables were empty."
                actionLabel="Retry Fetch"
                onAction={handleRetry}
              />
            ) : (
              <div className="split-7-5">
                <ForecastReadoutChart
                  series={previewSeries}
                  activeModels={["Stacking_Ensemble", "Naive_Baseline"]}
                  cityLabel="Dallas (ERCOT)"
                  height={285}
                  compact
                />
                <LeaderboardReadout models={leaderboard} compact />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
