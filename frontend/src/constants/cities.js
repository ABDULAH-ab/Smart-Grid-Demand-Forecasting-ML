/**
 * Domain metadata for the 10 U.S. utility load zones in GridPulse AI.
 * Note: ISO / Balancing Authority codes are static domain metadata mapped to
 * the backend's 10 city slugs; telemetry means & peaks come live from GET /api/eda.
 */

export const HOLDOUT_MIN_DATE = "2020-03-01";
export const HOLDOUT_MAX_DATE_DEFAULT = "2020-05-20";

export const CITIES = [
  {
    slug: "dallas",
    bay: "01",
    name: "Dallas",
    state: "TX",
    iso: "ERCOT",
    isoFull: "Electric Reliability Council of Texas (North)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "houston",
    bay: "02",
    name: "Houston",
    state: "TX",
    iso: "ERCOT",
    isoFull: "Electric Reliability Council of Texas (Coast)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "san_antonio",
    bay: "03",
    name: "San Antonio",
    state: "TX",
    iso: "ERCOT",
    isoFull: "CPS Energy / ERCOT South Central",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "nyc",
    bay: "04",
    name: "New York City",
    state: "NY",
    iso: "NYISO",
    isoFull: "New York Independent System Operator (Zone J)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "philadelphia",
    bay: "05",
    name: "Philadelphia",
    state: "PA",
    iso: "PJM",
    isoFull: "PJM Interconnection (PECO Zone)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "la",
    bay: "06",
    name: "Los Angeles",
    state: "CA",
    iso: "LDWP / CAISO",
    isoFull: "Los Angeles Dept. of Water & Power / CAISO",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "san_diego",
    bay: "07",
    name: "San Diego",
    state: "CA",
    iso: "CAISO",
    isoFull: "California ISO (SDG&E TAC Area)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "san_jose",
    bay: "08",
    name: "San Jose",
    state: "CA",
    iso: "CAISO",
    isoFull: "California ISO (PG&E Bay Area)",
    holdoutEnd: "2020-05-20",
  },
  {
    slug: "phoenix",
    bay: "09",
    name: "Phoenix",
    state: "AZ",
    iso: "AZPS",
    isoFull: "Arizona Public Service / SRP Desert Southwest",
    holdoutEnd: "2020-04-26",
  },
  {
    slug: "seattle",
    bay: "10",
    name: "Seattle",
    state: "WA",
    iso: "SCL",
    isoFull: "Seattle City Light (Pacific Northwest)",
    holdoutEnd: "2020-04-26",
  },
];

export const CITY_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

export function getCityMeta(slug) {
  return (
    CITY_BY_SLUG[slug] || {
      slug,
      bay: "--",
      name: slug,
      state: "",
      iso: "GRID",
      isoFull: "Balancing Authority",
      holdoutEnd: HOLDOUT_MAX_DATE_DEFAULT,
    }
  );
}

/**
 * Forecast model specifications with distinct multi-pen recorder colors,
 * stroke weights, and dash signatures so every model is clearly distinguishable.
 */
export const FORECAST_MODELS = [
  {
    key: "Stacking_Ensemble",
    label: "Stacking Ensemble",
    shortLabel: "Stacking",
    color: "var(--c-signal)",
    strokeWidth: 2.35,
    strokeDasharray: undefined,
    defaultOn: true,
    role: "Primary meta-learner",
  },
  {
    key: "XGBoost",
    label: "XGBoost",
    shortLabel: "XGBoost",
    color: "var(--c-trace-xgb)",
    strokeWidth: 1.8,
    strokeDasharray: undefined,
    defaultOn: false,
    role: "Gradient boosted trees",
  },
  {
    key: "Random_Forest",
    label: "Random Forest",
    shortLabel: "Rand. Forest",
    color: "var(--c-trace-rf)",
    strokeWidth: 1.75,
    strokeDasharray: "9 3",
    defaultOn: false,
    role: "Bagged decision trees",
  },
  {
    key: "Neural_Network_MLP",
    label: "Neural Network (MLP)",
    shortLabel: "MLP Net",
    color: "var(--c-trace-mlp)",
    strokeWidth: 1.75,
    strokeDasharray: undefined,
    defaultOn: false,
    role: "Feedforward perceptron",
  },
  {
    key: "Poly_Ridge",
    label: "Polynomial Ridge",
    shortLabel: "Poly Ridge",
    color: "var(--c-trace-ridge)",
    strokeWidth: 1.65,
    strokeDasharray: "8 3 2 3",
    defaultOn: false,
    role: "L2 interaction regression",
  },
  {
    key: "SARIMAX",
    label: "SARIMAX",
    shortLabel: "SARIMAX",
    color: "var(--c-trace-sarimax)",
    strokeWidth: 1.65,
    strokeDasharray: "4 3",
    defaultOn: false,
    role: "Seasonal ARMA + exogenous",
  },
  {
    key: "Naive_Baseline",
    label: "Naive Baseline (t-24h)",
    shortLabel: "Naive (t-24h)",
    color: "var(--c-trace-naive)",
    strokeWidth: 1.5,
    strokeDasharray: "5 5",
    defaultOn: true,
    role: "24-hour persistence benchmark",
  },
];

export const MODEL_BY_KEY = Object.fromEntries(FORECAST_MODELS.map((m) => [m.key, m]));

export function formatModelName(rawKey) {
  return MODEL_BY_KEY[rawKey]?.label || rawKey.replaceAll("_", " ");
}

const FEATURE_LABELS = {
  num__demand_lag_24h: "Load Lag (t - 24h)",
  num__demand_lag_168h: "Weekly Load Lag (t - 168h)",
  num__demand_roll_mean_24h: "24h Rolling Mean Load",
  num__demand_roll_max_24h: "24h Rolling Peak Load",
  num__demand_roll_min_24h: "24h Rolling Min Load",
  num__demand_roll_std_24h: "24h Rolling Load Volatility",
  num__demand_roll_mean_168h: "7-Day Rolling Mean Load",
  num__demand_diff_24h_vs_48h: "Day-over-Day Load Delta",
  num__temperature: "Ambient Temperature (F)",
  num__CDH: "Cooling Degree Hours (CDH)",
  num__HDH: "Heating Degree Hours (HDH)",
  num__temp_roll_mean_24h: "24h Mean Temperature",
  num__hour_cos: "Diurnal Cosine Phase",
  num__hour_sin: "Diurnal Sine Phase",
  num__is_weekend: "Weekend Indicator",
};

export function formatFeatureName(rawFeature) {
  if (FEATURE_LABELS[rawFeature]) return FEATURE_LABELS[rawFeature];
  return rawFeature
    .replace(/^(num__|cat__)/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Colorblind-safe cluster tokens + geometric SVG marker shapes
 * so color is never the sole carrier of cluster identity.
 */
export const CLUSTER_GLYPHS = [
  { id: 0, color: "var(--c-cluster-0)", shape: "circle", shapeLabel: "Circle" },
  { id: 1, color: "var(--c-cluster-1)", shape: "diamond", shapeLabel: "Diamond" },
  { id: 2, color: "var(--c-cluster-2)", shape: "square", shapeLabel: "Square" },
  { id: 3, color: "var(--c-cluster-3)", shape: "triangle", shapeLabel: "Triangle" },
  { id: 4, color: "var(--c-cluster-4)", shape: "cross", shapeLabel: "Cross" },
  { id: 5, color: "var(--c-cluster-5)", shape: "ring", shapeLabel: "Open Ring" },
  { id: 6, color: "var(--c-cluster-6)", shape: "inv-triangle", shapeLabel: "Inverted Triangle" },
  { id: 7, color: "var(--c-cluster-7)", shape: "hollow-square", shapeLabel: "Open Square" },
];
