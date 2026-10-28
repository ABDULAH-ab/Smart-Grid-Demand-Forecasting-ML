/**
 * Isolated API Service Layer for GridPulse AI
 * - Base URL configured via VITE_API_BASE (default http://127.0.0.1:8000)
 * - Per-query-key in-memory response cache
 * - AbortController support to cancel stale requests on parameter changes
 * - Actionable error diagnostics including "API unreachable at <URL>"
 */

export const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

/** @type {Map<string, any>} */
const queryCache = new Map();

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, url?: string, unreachable?: boolean }} meta
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "ApiError";
    this.status = meta.status ?? 0;
    this.url = meta.url ?? API_BASE;
    this.unreachable = Boolean(meta.unreachable);
  }
}

/**
 * Clears cached responses (used when the operator clicks Retry).
 * @param {string} [prefix]
 */
export function invalidateApiCache(prefix) {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

/**
 * Core JSON fetcher with query-key caching and AbortSignal propagation.
 * @template T
 * @param {string} pathAndQuery
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [options]
 * @returns {Promise<T>}
 */
async function requestJson(pathAndQuery, options = {}) {
  const { signal, bypassCache = false } = options;
  const cacheKey = pathAndQuery;

  if (!bypassCache && queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey);
  }

  const fullUrl = `${API_BASE}${pathAndQuery}`;
  let response;

  try {
    response = await fetch(fullUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw err;
    }
    throw new ApiError(
      `API unreachable at ${API_BASE}. Verify the FastAPI backend is running (uvicorn backend.main:app --port 8000) and CORS allows this origin.`,
      { status: 0, url: fullUrl, unreachable: true }
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.detail ? ` (${errBody.detail})` : "";
    } catch (_) {
      // Ignore non-JSON error body
    }
    throw new ApiError(
      `Telemetry endpoint ${pathAndQuery} returned HTTP ${response.status}${detail}.`,
      { status: response.status, url: fullUrl, unreachable: false }
    );
  }

  const data = await response.json();
  queryCache.set(cacheKey, data);
  return data;
}

/**
 * @typedef {Object} HealthResponse
 * @property {string} status
 * @property {number} forecast_rows
 * @property {string[]} cities
 */

/**
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<HealthResponse>}
 */
export function fetchHealth(opts) {
  return requestJson("/api/health", opts);
}

/**
 * @typedef {Object} LeaderboardModel
 * @property {string} model
 * @property {number} val_MAE
 * @property {number} val_RMSE
 * @property {number} val_MAPE_pct
 * @property {number} test_MAE
 * @property {number} test_RMSE
 * @property {number} test_RMSE_CI95_low
 * @property {number} test_RMSE_CI95_high
 * @property {number} test_MAPE_pct
 * @property {number} train_time_sec
 * @property {number} rmse_skill_vs_naive_pct
 */

/**
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<{ models: LeaderboardModel[] }>}
 */
export function fetchLeaderboard(opts) {
  return requestJson("/api/leaderboard", opts);
}

/**
 * @typedef {Object} EdaResponse
 * @property {string} city
 * @property {Array<{
 *   city: string, total_hours: number, physical_err: number, zscore_err: number,
 *   iqr_err: number, ramp_err: number, isoforest_flag: number, severe_replaced: number,
 *   raw_min: number, raw_max: number, clean_min: number, clean_max: number,
 *   clean_mean: number, temp_mean: number
 * }>} anomaly_summary_all_cities
 * @property {Array<{ city: string, hour: number, demand_mean: number, temp_mean: number, humidity_mean: number }>} diurnal_profile
 * @property {Array<{ date: string, demand_mean: number, demand_max: number, demand_min: number, temp_mean: number, humidity_mean: number, anomaly_count: number }>} daily_series
 */

/**
 * @param {string} city
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<EdaResponse>}
 */
export function fetchEda(city, opts) {
  const params = new URLSearchParams({ city });
  return requestJson(`/api/eda?${params.toString()}`, opts);
}

/**
 * @typedef {Object} ClustersResponse
 * @property {string} selected_city
 * @property {number} selected_k
 * @property {Array<{
 *   city: string, temperature: number, humidity: number, wind_speed: number,
 *   demand: number, season: string, hour: number, pca_1: number, pca_2: number,
 *   tsne_1: number, tsne_2: number, cluster: number
 * }>} points
 * @property {Array<{
 *   cluster: number, count: number, share_pct: number, demand_mean: number,
 *   demand_z_mean: number, temp_mean: number, humidity_mean: number,
 *   wind_mean: number, hour_mean: number, dominant_season: string, regime_label: string
 * }>} profiles
 * @property {Array<{
 *   k: number, inertia: number, silhouette_score: number,
 *   stability_ari_mean: number, stability_ari_std: number, composite_score: number
 * }>} kmeans_eval
 */

/**
 * @param {{ city: string, k: number, limit?: number }} query
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<ClustersResponse>}
 */
export function fetchClusters({ city = "all", k = 4, limit = 1500 }, opts) {
  const params = new URLSearchParams({
    city,
    k: String(k),
    limit: String(limit),
  });
  return requestJson(`/api/clusters?${params.toString()}`, opts);
}

/**
 * @typedef {Object} ForecastsResponse
 * @property {string} city
 * @property {string} start_date
 * @property {string} end_date
 * @property {number} row_count
 * @property {Array<{ city: string, model: string, MAE: number, RMSE: number, MAPE_pct: number }>} city_metrics
 * @property {Array<{ feature: string, importance: number }>} feature_importance
 * @property {Array<{
 *   timestamp: string, temperature: number, humidity: number, wind_speed: number,
 *   actual_demand: number, Stacking_Ensemble: number, XGBoost: number,
 *   Random_Forest: number, Neural_Network_MLP: number, Poly_Ridge: number,
 *   SARIMAX: number, Naive_Baseline: number
 * }>} series
 */

/**
 * @param {{ city: string, startDate: string, endDate: string }} query
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<ForecastsResponse>}
 */
export function fetchForecasts({ city, startDate, endDate }, opts) {
  const params = new URLSearchParams({
    city,
    start_date: startDate,
    end_date: endDate,
  });
  return requestJson(`/api/forecasts?${params.toString()}`, opts);
}
