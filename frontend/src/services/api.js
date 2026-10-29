/**
 * Isolated API Service Layer for GridPulse AI
 * - Base URL configured via VITE_API_BASE (default http://127.0.0.1:8000)
 * - Per-query-key in-memory response cache
 * - AbortController support to cancel stale requests on parameter changes
 * - Automatic seamless static fallback (/demo-data/) when backend is offline or on Vercel
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
 * Static fallback adapter that serves pre-exported JSON dataset
 * when the live FastAPI backend is offline or when deployed standalone on Vercel.
 */
async function fetchStaticFallback(pathAndQuery, signal) {
  const [pathname, queryString = ""] = pathAndQuery.split("?");
  const params = new URLSearchParams(queryString);

  if (pathname === "/api/health") {
    const res = await fetch("/demo-data/health.json", { signal });
    if (!res.ok) throw new Error("Health demo data missing");
    return res.json();
  }

  if (pathname === "/api/leaderboard") {
    const res = await fetch("/demo-data/leaderboard.json", { signal });
    if (!res.ok) throw new Error("Leaderboard demo data missing");
    return res.json();
  }

  if (pathname === "/api/eda") {
    const city = (params.get("city") || "dallas").toLowerCase();
    let res = await fetch(`/demo-data/eda/${city}.json`, { signal });
    if (!res.ok) {
      res = await fetch("/demo-data/eda/dallas.json", { signal });
    }
    if (!res.ok) throw new Error("EDA demo data missing");
    return res.json();
  }

  if (pathname === "/api/clusters") {
    const city = (params.get("city") || "all").toLowerCase();
    const k = Math.max(2, Math.min(8, Number(params.get("k")) || 4));
    const limit = Math.max(100, Number(params.get("limit")) || 1500);

    const res = await fetch("/demo-data/clusters.json", { signal });
    if (!res.ok) throw new Error("Clusters demo data missing");
    const raw = await res.json();

    let points = raw.points || [];
    if (city !== "all") {
      points = points.filter((p) => p.city?.toLowerCase() === city);
    }
    if (points.length > limit) {
      points = points.slice(0, limit);
    }

    const clusterKey = `kmeans_k${k}`;
    const mappedPoints = points.map((p) => ({
      ...p,
      cluster: p[clusterKey] ?? p.cluster ?? 0,
    }));

    return {
      selected_city: city,
      selected_k: k,
      points: mappedPoints,
      profiles: raw.profiles || [],
      kmeans_eval: raw.kmeans_eval || [],
    };
  }

  if (pathname === "/api/forecasts") {
    const city = (params.get("city") || "dallas").toLowerCase();
    const startDate = params.get("start_date") || "2020-04-01";
    const endDate = params.get("end_date") || "2020-04-10";

    let res = await fetch(`/demo-data/forecasts/${city}.json`, { signal });
    if (!res.ok) {
      res = await fetch("/demo-data/forecasts/dallas.json", { signal });
    }
    if (!res.ok) throw new Error("Forecasts demo data missing");
    const raw = await res.json();

    const filteredSeries = (raw.series || []).filter((row) => {
      const d = String(row.timestamp).slice(0, 10);
      return d >= startDate && d <= endDate;
    });

    return {
      ...raw,
      city,
      start_date: startDate,
      end_date: endDate,
      row_count: filteredSeries.length,
      series: filteredSeries,
    };
  }

  throw new Error(`No static fallback available for ${pathAndQuery}`);
}

/**
 * Core JSON fetcher with query-key caching, live API priority, and seamless static fallback.
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

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const isLocalHttp = API_BASE.startsWith("http://127.0.0.1") || API_BASE.startsWith("http://localhost");

  // On HTTPS production deployments (e.g. Vercel) where API_BASE is still local HTTP,
  // directly serve the pre-exported static demo data to avoid Mixed Content browser errors.
  if (isHttps && isLocalHttp) {
    try {
      const staticData = await fetchStaticFallback(pathAndQuery, signal);
      queryCache.set(cacheKey, staticData);
      return staticData;
    } catch (_) {
      // Fall through to attempt fetch if static failed
    }
  }

  // 1. Attempt live API request
  const fullUrl = `${API_BASE}${pathAndQuery}`;
  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      queryCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw err;
    }
    // Network failure / server unreachable
  }

  // 2. Seamless static fallback when backend is unreachable or offline
  try {
    const fallbackData = await fetchStaticFallback(pathAndQuery, signal);
    queryCache.set(cacheKey, fallbackData);
    return fallbackData;
  } catch (fallbackErr) {
    if (fallbackErr?.name === "AbortError") {
      throw fallbackErr;
    }
    throw new ApiError(
      `Telemetry service unreachable. Please ensure the backend server is running and retry.`,
      { status: 0, url: fullUrl, unreachable: true }
    );
  }
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
