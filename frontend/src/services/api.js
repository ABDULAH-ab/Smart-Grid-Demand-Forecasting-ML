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
   * @param {{ status?: number, url?: string, unreachable?: boolean }} [meta]
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
 * @param {string} pathAndQuery
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [options]
 * @returns {Promise<any>}
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
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<{ status: string, forecast_rows: number, cities: string[] }>}
 */
export function fetchHealth(opts) {
  return requestJson("/api/health", opts);
}

/**
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<{ models: any[] }>}
 */
export function fetchLeaderboard(opts) {
  return requestJson("/api/leaderboard", opts);
}

/**
 * @param {string} city
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<any>}
 */
export function fetchEda(city, opts) {
  const params = new URLSearchParams({ city });
  return requestJson(`/api/eda?${params.toString()}`, opts);
}

/**
 * @param {{ city: string, k: number, limit?: number }} query
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<any>}
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
 * @param {{ city: string, startDate: string, endDate: string }} query
 * @param {{ signal?: AbortSignal, bypassCache?: boolean }} [opts]
 * @returns {Promise<any>}
 */
export function fetchForecasts({ city, startDate, endDate }, opts) {
  const params = new URLSearchParams({
    city,
    start_date: startDate,
    end_date: endDate,
  });
  return requestJson(`/api/forecasts?${params.toString()}`, opts);
}
