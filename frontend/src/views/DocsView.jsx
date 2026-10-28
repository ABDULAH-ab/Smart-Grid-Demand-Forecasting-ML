import React, { useId } from "react";
import { API_BASE } from "../services/api";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/health",
    params: "None",
    returns: "{ status, forecast_rows, cities[] }",
    notes: "Verifies backend readiness (18,049 holdout rows across 10 cities).",
  },
  {
    method: "GET",
    path: "/api/leaderboard",
    params: "None",
    returns: "{ models: [{ model, val_RMSE, test_MAE, test_RMSE, test_RMSE_CI95_low, test_RMSE_CI95_high, test_MAPE_pct, rmse_skill_vs_naive_pct }] }",
    notes: "Out-of-time benchmark sorted ascending by test_RMSE.",
  },
  {
    method: "GET",
    path: "/api/eda",
    params: "?city=dallas",
    returns: "{ city, anomaly_summary_all_cities[], diurnal_profile[], daily_series[] }",
    notes: "Returns corpus-wide sensor fault audit plus 24h composite and 2018–2020 daily series.",
  },
  {
    method: "GET",
    path: "/api/clusters",
    params: "?city=all&k=4&limit=1500",
    returns: "{ selected_city, selected_k, points[], profiles[], kmeans_eval[] }",
    notes: "k in [2..8]. `profiles` documents the canonical optimal k=4 full-corpus regimes.",
  },
  {
    method: "GET",
    path: "/api/forecasts",
    params: "?city=dallas&start_date=2020-04-01&end_date=2020-04-10",
    returns: "{ city, start_date, end_date, row_count, city_metrics[], feature_importance[], series[] }",
    notes: "Holdout spans 2020-03-01 to 2020-05-20 (Phoenix & Seattle conclude 2020-04-26).",
  },
];

export default function DocsView() {
  const apiCaptionId = useId();

  return (
    <div className="reveal-frame">
      <section className="editorial-section" style={{ borderBlockEnd: "none" }} aria-labelledby="docs-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. 05 // TECHNICAL SPECIFICATION</span>
            <h1 id="docs-heading" className="section-heading">
              Operations Manual &amp; API Reference
            </h1>
            <p className="section-lede">
              Controls guide, leakage-free statistical methodology, and FastAPI telemetry contract.
            </p>
            <div
              className="font-mono"
              style={{
                marginBlockStart: "1.25rem",
                paddingBlockStart: "0.85rem",
                borderBlockStart: "1px solid var(--c-rule)",
                fontSize: "0.74rem",
                color: "var(--c-graphite)",
              }}
            >
              <div>ACTIVE API BASE:</div>
              <code style={{ color: "var(--c-ink)" }}>{API_BASE}</code>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Part 1: Operator Controls Guide */}
            <article className="instrument-frame">
              <div className="instrument-header">
                <div>
                  <span className="kicker">MANUAL 01 // CONSOLE CONTROLS</span>
                  <h2 className="instrument-title">Dispatch Controls &amp; Shared State</h2>
                </div>
              </div>
              <div className="split-6-6" style={{ fontSize: "0.94rem" }}>
                <div>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.35rem" }}>
                    GLOBAL LOAD ZONE LOCK
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Selecting a city in the top navigation bar, the Section 01 Switchboard, or any
                    view dropdown locks that city globally across EDA, Clustering, and Forecasting
                    views.
                  </p>
                </div>
                <div>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.35rem" }}>
                    DEBOUNCED STREAM CANCELLATION
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Dragging the k-slider (2–8) or editing holdout dates debounces queries by ~240ms
                    and cancels stale in-flight HTTP requests via <code>AbortController</code> while
                    caching completed responses by query key.
                  </p>
                </div>
                <div>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.35rem" }}>
                    MULTI-PEN TRACE SPOTLIGHT &amp; ACCESSIBILITY
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Each forecasting model has a distinct colorblind-tested pen ink and dash
                    signature. Hover or click any pen pill to spotlight a single trace, toggle the
                    time-window zoom scrubber, or expand collapsible keyboard-scrollable tables.
                  </p>
                </div>
                <div>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.35rem" }}>
                    COLOR SCHEME OVERRIDE
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Defaults to warm archival paper (Light). Switch between Paper, Ink (Dark), or
                    System in the masthead; overrides sync directly to{" "}
                    <code>&lt;meta name=&quot;color-scheme&quot;&gt;</code> without flash.
                  </p>
                </div>
              </div>
            </article>

            {/* Part 2: Preprocessing & ML Methodology */}
            <article className="instrument-frame">
              <div className="instrument-header">
                <div>
                  <span className="kicker">MANUAL 02 // PIPELINE METHODOLOGY</span>
                  <h2 className="instrument-title">
                    Sanitization, Regime Clustering &amp; Ensemble Architecture
                  </h2>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.94rem" }}>
                <div style={{ borderBlockEnd: "1px solid var(--c-rule)", paddingBlockEnd: "0.85rem" }}>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.3rem" }}>
                    STAGE A — CAUSAL TELEMETRY REPAIR (163,993 HOURS)
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Raw EIA-930 &amp; NOAA ISD records (Jul 2018 – May 2020) undergo four
                    deterministic checks—physical bounds (&le;0 MWh or extreme meter overflow),
                    rolling z-score (&gt;4&sigma;), seasonal-hour IQR fences, and hour-to-hour ramp
                    thresholds—paired with per-city Isolation Forest (0.5% contamination, 824 flags).
                    Confirmed severe spikes (279 hours, including Phoenix -1,340 / 101,412 MWh) are
                    replaced strictly from backward-looking historical medians to prevent look-ahead
                    bias.
                  </p>
                </div>

                <div style={{ borderBlockEnd: "1px solid var(--c-rule)", paddingBlockEnd: "0.85rem" }}>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.3rem" }}>
                    STAGE B — WITHIN-CITY NORMALIZED CLUSTERING
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Because NYC mean demand (~6,162 MWh) dwarfs San Jose (~127 MWh), demand is
                    standardized within each city before joining temperature, humidity, wind speed,
                    and cyclical diurnal coordinates. Evaluating k = 2..8 across Inertia, Silhouette,
                    and 20-seed Bootstrap Adjusted Rand Index selects k = 4 (0.990 ARI).
                  </p>
                </div>

                <div>
                  <h3 className="font-mono" style={{ fontSize: "0.78rem", marginBlockEnd: "0.3rem" }}>
                    STAGE C — STRICT CHRONOLOGICAL 24H ENSEMBLE FORECASTING
                  </h3>
                  <p style={{ color: "var(--c-graphite)" }}>
                    Data splits chronologically: Train (&le; 2019-12-31), Validation (2020-01-01 to
                    2020-02-29), and Test (2020-03-01 to 2020-05-20; 18,049 rows). All demand lags
                    respect <code>lag &ge; 24h</code> (24h, 48h, 72h, 168h, shifted rolling stats,
                    Cooling/Heating Degree Hours around 65°F). A Ridge-regularized Stacking
                    Meta-Learner trained on <code>TimeSeriesSplit</code> out-of-fold predictions
                    combines Polynomial Ridge, Random Forest, XGBoost, and MLP to achieve{" "}
                    <strong>351.13 MWh RMSE</strong> (3.91% MAPE, +52.59% skill vs. 24h naive).
                  </p>
                </div>
              </div>
            </article>
          </div>

          {/* Deliberate Grid Break: Full-width API Contract Ledger */}
          <div className="grid-break-bleed" style={{ backgroundColor: "var(--c-paper)" }}>
            <span className="grid-break-stamp">INTERFACE CONTRACT // FASTAPI REST</span>
            <h2 className="section-heading" style={{ fontSize: "var(--text-h2)", marginBlockEnd: "0.75rem" }}>
              Backend Telemetry Endpoints
            </h2>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby={apiCaptionId}
              className="table-wrapper"
            >
              <table
                className="gp-table"
                style={{
                  "--label-2": '"Sample Query"',
                  "--label-3": '"Response Payload"',
                  "--label-4": '"Operational Notes"',
                }}
              >
                <caption id={apiCaptionId}>
                  Read-only JSON endpoints served by backend/main.py (CORS enabled, no auth)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Endpoint</th>
                    <th scope="col">Query Parameters</th>
                    <th scope="col">Response Shape</th>
                    <th scope="col">Notes &amp; Edge Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((ep) => (
                    <tr key={ep.path}>
                      <th scope="row">
                        <span style={{ color: "var(--c-signal)", marginInlineEnd: "0.4rem" }}>
                          {ep.method}
                        </span>
                        {ep.path}
                      </th>
                      <td>{ep.params}</td>
                      <td style={{ whiteSpace: "normal", maxInlineSize: "340px" }}>{ep.returns}</td>
                      <td
                        style={{
                          whiteSpace: "normal",
                          fontFamily: "var(--font-sans)",
                          color: "var(--c-graphite)",
                          maxInlineSize: "300px",
                        }}
                      >
                        {ep.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
