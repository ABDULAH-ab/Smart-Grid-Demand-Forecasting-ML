import React, { useCallback, useEffect, useState } from "react";
import { CITIES, getCityMeta } from "../constants/cities";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { fetchClusters, invalidateApiCache } from "../services/api";
import ClusterScatterPlot from "../components/charts/ClusterScatterPlot";
import ClusterDiagnosticsChart from "../components/charts/ClusterDiagnosticsChart";
import {
  ClusterGlyph,
  EmptyState,
  ErrorState,
  LoadingInstrument,
} from "../components/StatusViews";

export default function ClusteringExplorer({ selectedCity, onSelectCity }) {
  // Scope supports either "all" (cross-city normalized manifold) or the shared global city
  const [scopeMode, setScopeMode] = useState("all");
  const [projection, setProjection] = useState("pca");
  const [kInput, setKInput] = useState(4);
  const debouncedK = useDebouncedValue(kInput, 220);

  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const effectiveCityParam = scopeMode === "all" ? "all" : selectedCity;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchClusters(
      { city: effectiveCityParam, k: debouncedK, limit: 1500 },
      { signal: controller.signal }
    )
      .then((res) => {
        setClusterData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [effectiveCityParam, debouncedK, reloadToken]);

  const handleRetry = useCallback(() => {
    invalidateApiCache("/api/clusters");
    setReloadToken((n) => n + 1);
  }, []);

  const handleCitySelect = (val) => {
    if (val === "all") {
      setScopeMode("all");
    } else {
      setScopeMode("city");
      onSelectCity(val);
    }
  };

  const cityMeta = getCityMeta(selectedCity);

  return (
    <div className="reveal-frame">
      <section className="editorial-section" aria-labelledby="cluster-heading">
        <div className="asymmetric-grid">
          <div className="rail-meta">
            <span className="kicker">SEC. 03 // CLUSTERING EXPLORER</span>
            <h1 id="cluster-heading" className="section-heading">
              Consumption–Weather Regimes
            </h1>
            <p className="section-lede">
              Within-city z-scored load, temperature, humidity, wind, and cyclical hour vectors
              partitioned via K-Means (k = 2..8). Optimal k = 4 reaches 0.990 bootstrap ARI.
            </p>
          </div>

          <div>
            {/* Controls Console */}
            <div className="control-console" role="region" aria-label="Clustering parameters">
              <div className="control-field">
                <label htmlFor="cluster-city-select" className="control-label">
                  Manifold Scope
                </label>
                <select
                  id="cluster-city-select"
                  className="gp-select"
                  value={effectiveCityParam}
                  onChange={(e) => handleCitySelect(e.target.value)}
                >
                  <option value="all">ALL — 10-City Composite Manifold</option>
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.bay} — {c.name} ({c.iso})
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-field">
                <span className="control-label">2D Embedding</span>
                <div className="segmented-control" role="group" aria-label="2D projection embedding">
                  <button
                    type="button"
                    className="segmented-btn"
                    aria-pressed={projection === "pca"}
                    onClick={() => setProjection("pca")}
                  >
                    PCA Linear
                  </button>
                  <button
                    type="button"
                    className="segmented-btn"
                    aria-pressed={projection === "tsne"}
                    onClick={() => setProjection("tsne")}
                  >
                    t-SNE Local
                  </button>
                </div>
              </div>

              <div className="control-field" style={{ minInlineSize: "195px" }}>
                <label htmlFor="k-slider" className="control-label">
                  Cluster Count k = <strong>{kInput}</strong>{" "}
                  {kInput === 4 ? "(Optimal)" : ""}
                </label>
                <input
                  id="k-slider"
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={kInput}
                  onChange={(e) => setKInput(Number(e.target.value))}
                  style={{ inlineSize: "100%", cursor: "pointer" }}
                />
              </div>

              {kInput !== 4 && (
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setKInput(4)}
                >
                  Reset k = 4
                </button>
              )}
            </div>

            {loading ? (
              <div className="split-8-4">
                <LoadingInstrument
                  label={`Projecting ${
                    effectiveCityParam === "all" ? "10-city" : cityMeta.name
                  } vectors (k=${debouncedK})...`}
                  height={420}
                />
                <LoadingInstrument label="Loading Elbow / Silhouette / ARI..." height={420} />
              </div>
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} contextLabel="CLUSTERING EXPLORER" />
            ) : !clusterData?.points?.length ? (
              <EmptyState
                title="No clustered vectors returned"
                description="GET /api/clusters returned zero sample points for the selected parameters."
                actionLabel="Reset Scope to All Cities"
                onAction={() => {
                  setScopeMode("all");
                  setKInput(4);
                }}
              />
            ) : (
              <div className="split-8-4">
                <ClusterScatterPlot
                  points={clusterData.points}
                  projection={projection}
                  selectedK={clusterData.selected_k || debouncedK}
                />
                <ClusterDiagnosticsChart
                  kmeansEval={clusterData.kmeans_eval || []}
                  selectedK={kInput}
                  onSelectK={(nextK) => setKInput(nextK)}
                />
              </div>
            )}
          </div>

          {/* Deliberate Grid Break: 4 Operational Regime Ledger Cards derived from `profiles` */}
          {!loading && !error && clusterData?.profiles?.length > 0 && (
            <div className="grid-break-bleed" style={{ backgroundColor: "var(--c-paper)" }}>
              <span className="grid-break-stamp">
                CANONICAL k = 4 OPERATIONAL REGIMES // FULL 163,993-HOUR CORPUS
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "0.75rem",
                  marginBlockEnd: "1rem",
                }}
              >
                <div>
                  <h2 className="section-heading" style={{ fontSize: "var(--text-h2)", marginBlockEnd: "0.2rem" }}>
                    Physical Interpretation of Discovered Regimes
                  </h2>
                  <p className="section-lede">
                    Derived from <code>profiles</code> across all 163,993 cleaned hourly records at
                    optimal k = 4.
                    {debouncedK !== 4 &&
                      ` (Scatter plot above currently displays custom k = ${debouncedK}; expand its table disclosure for live k = ${debouncedK} sample means.)`}
                  </p>
                </div>
              </div>

              <div className="regime-ledger">
                {clusterData.profiles.map((prof) => (
                  <article key={prof.cluster} className="regime-entry">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span className="font-mono" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
                        <ClusterGlyph clusterId={prof.cluster} size={11} />{" "}
                        <span style={{ marginInlineStart: "0.35rem" }}>
                          REGIME C{prof.cluster}
                        </span>
                      </span>
                      <span
                        className="font-mono"
                        style={{ fontSize: "0.72rem", color: "var(--c-graphite)" }}
                      >
                        {Number(prof.share_pct).toFixed(1)}% OF HOURS
                      </span>
                    </div>

                    <h3 className="font-display" style={{ fontSize: "1.18rem", fontWeight: 500 }}>
                      {prof.regime_label}
                    </h3>

                    <div
                      className="font-mono"
                      style={{
                        fontSize: "0.76rem",
                        borderBlockStart: "1px solid var(--c-rule)",
                        paddingBlockStart: "0.55rem",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        rowGap: "0.35rem",
                      }}
                    >
                      <span style={{ color: "var(--c-graphite)" }}>Mean Load</span>
                      <span style={{ textAlign: "right" }}>
                        {Math.round(prof.demand_mean).toLocaleString()} MWh
                      </span>

                      <span style={{ color: "var(--c-graphite)" }}>Normalized Z</span>
                      <span
                        style={{
                          textAlign: "right",
                          color: prof.demand_z_mean > 0.5 ? "var(--c-signal)" : "var(--c-ink)",
                        }}
                      >
                        {prof.demand_z_mean > 0 ? `+${prof.demand_z_mean.toFixed(2)}` : prof.demand_z_mean.toFixed(2)} σ
                      </span>

                      <span style={{ color: "var(--c-graphite)" }}>Mean Temp</span>
                      <span style={{ textAlign: "right" }}>{Number(prof.temp_mean).toFixed(1)} °F</span>

                      <span style={{ color: "var(--c-graphite)" }}>Humidity / Season</span>
                      <span style={{ textAlign: "right" }}>
                        {Math.round(prof.humidity_mean)}% · {prof.dominant_season}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
