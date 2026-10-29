from pathlib import Path
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware



# PATHS & STARTUP DATA LOADING

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

FORECAST_DF = pd.read_parquet(PROCESSED_DIR / "test_forecasts_all_cities.parquet")

METRICS_DF = pd.read_csv(PROCESSED_DIR / "model_comparison_metrics.csv")
CLUSTER_DF = pd.read_parquet(PROCESSED_DIR / "clustered_sample_data.parquet")


# FASTAPI APP & CORS MIDDLEWARE

app = FastAPI(title="Smart Grid Demand Forecasting API", docs_url="/")

# Allow our future React frontend (on port 5173) to talk to this backend (on port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# API ENDPOINTS (ROUTES)

@app.get("/api/health")
def get_health():
    """When someone visits GET /api/health, FastAPI runs this function and returns JSON."""
    return {
        "status": "ok",
        "forecast_rows": len(FORECAST_DF),
        "cities": sorted(FORECAST_DF["city"].unique().tolist()),
    }


@app.get("/api/leaderboard")
def get_leaderboard():
    """
    Return the model comparison metrics table as JSON.
    HINT: Return a dictionary like:
        return {"models": METRICS_DF.to_dict(orient="records")}
    """
    return {
        "models" : METRICS_DF.to_dict(orient="records")
    }


# DYNAMIC QUERY PARAMETER ENDPOINTS

CLUSTER_PROFILES_DF = pd.read_csv(PROCESSED_DIR / "cluster_profiles.csv")
KMEANS_EVAL_DF = pd.read_csv(PROCESSED_DIR / "kmeans_evaluation.csv")
CITY_SLICE_DF = pd.read_csv(PROCESSED_DIR / "city_slice_metrics.csv")
FEATURE_IMP_DF = pd.read_csv(PROCESSED_DIR / "feature_importance.csv")
DAILY_DF = pd.read_parquet(PROCESSED_DIR / "daily_summary.parquet")
HOURLY_CLEAN_DF = pd.read_parquet(
    PROCESSED_DIR / "cleaned_hourly_data.parquet",
    columns=[
        "city", "local_time", "demand", "demand_raw", "temperature", "humidity",
        "wind_speed", "hour", "season", "flag_physical", "flag_zscore",
        "flag_iqr", "flag_ramp_spike", "flag_isoforest", "is_severe_error",
    ],
)

# Precompute per-city anomaly summary and 24-hour diurnal curves once at startup
ANOMALY_SUMMARY_DF = (
    HOURLY_CLEAN_DF.groupby("city", as_index=False)
    .agg(
        total_hours=("demand", "size"),
        physical_err=("flag_physical", "sum"),
        zscore_err=("flag_zscore", "sum"),
        iqr_err=("flag_iqr", "sum"),
        ramp_err=("flag_ramp_spike", "sum"),
        isoforest_flag=("flag_isoforest", "sum"),
        severe_replaced=("is_severe_error", "sum"),
        raw_min=("demand_raw", lambda s: round(float(s.min()), 1)),
        raw_max=("demand_raw", lambda s: round(float(s.max()), 1)),
        clean_min=("demand", lambda s: round(float(s.min()), 1)),
        clean_max=("demand", lambda s: round(float(s.max()), 1)),
        clean_mean=("demand", lambda s: round(float(s.mean()), 1)),
        temp_mean=("temperature", lambda s: round(float(s.mean()), 1)),
    )
)

DIURNAL_DF = (
    HOURLY_CLEAN_DF.groupby(["city", "hour"], as_index=False)
    .agg(
        demand_mean=("demand", lambda s: round(float(s.mean()), 1)),
        temp_mean=("temperature", lambda s: round(float(s.mean()), 1)),
        humidity_mean=("humidity", lambda s: round(float(s.mean()), 1)),
    )
)


@app.get("/api/eda")
def get_eda(city: str = "dallas"):
    """
    Return Exploratory Data Analysis (EDA), Anomaly Detection statistics,
    24-hour diurnal load curves, and daily time-series trends for a city.
    """
    daily_sub = DAILY_DF[DAILY_DF["city"] == city].copy()
    daily_sub["date"] = daily_sub["local_date"].astype(str)
    daily_cols = ["date", "demand_mean", "demand_max", "demand_min", "temp_mean", "humidity_mean", "anomaly_count"]
    daily_records = daily_sub[daily_cols].round(1).to_dict(orient="records")

    diurnal_records = DIURNAL_DF[DIURNAL_DF["city"] == city].to_dict(orient="records")

    return {
        "city": city,
        "anomaly_summary_all_cities": ANOMALY_SUMMARY_DF.to_dict(orient="records"),
        "diurnal_profile": diurnal_records,
        "daily_series": daily_records,
    }


@app.get("/api/clusters")
def get_clusters(city: str = "all", k: int = 4, limit: int = 1500):
    """
    Return clustering scatter points (PCA & t-SNE coordinates + cluster labels)
    filtered by `city` and colored by `kmeans_k{k}`.
    """
    df = CLUSTER_DF.copy()

    if city != "all":
        df = df[df["city"] == city]

    k = max(2, min(8, k))
    cluster_col = f"kmeans_k{k}"

    if len(df) > limit:
        df = df.sample(n=limit, random_state=42)

    points = df[
        ["city", "temperature", "humidity", "wind_speed", "demand", "season", "hour", "pca_1", "pca_2", "tsne_1", "tsne_2", cluster_col]
    ].rename(columns={cluster_col: "cluster"})

    return {
        "selected_city": city,
        "selected_k": k,
        "points": points.to_dict(orient="records"),
        "profiles": CLUSTER_PROFILES_DF.to_dict(orient="records"),
        "kmeans_eval": KMEANS_EVAL_DF.to_dict(orient="records"),
    }


@app.get("/api/forecasts")
def get_forecasts(
    city: str = "dallas",
    start_date: str = "2020-04-01",
    end_date: str = "2020-04-10",
):
    """
    Return hourly actual vs. predicted electricity demand for a specific `city`
    and date range (`start_date` to `end_date`).
    """
    # Filter by city
    sub = FORECAST_DF[FORECAST_DF["city"] == city].copy()

    # Convert local_time to a "YYYY-MM-DD" date string for easy comparison
    date_str = sub["local_time"].dt.strftime("%Y-%m-%d")

    sub = sub[(date_str >= start_date) & (date_str <= end_date)]


    # Format timestamp as clean string for JSON chart x-axis
    sub["timestamp"] = sub["local_time"].dt.strftime("%Y-%m-%d %H:%M")

    cols = [
        "timestamp",
        "temperature",
        "humidity",
        "wind_speed",
        "actual_demand",
        "Stacking_Ensemble",
        "XGBoost",
        "Random_Forest",
        "Neural_Network_MLP",
        "Poly_Ridge",
        "SARIMAX",
        "Naive_Baseline",
    ]
    city_metrics = CITY_SLICE_DF[CITY_SLICE_DF["city"] == city].to_dict(orient="records")

    return {
        "city": city,
        "start_date": start_date,
        "end_date": end_date,
        "row_count": len(sub),
        "city_metrics": city_metrics,
        "feature_importance": FEATURE_IMP_DF.head(10).to_dict(orient="records"),
        "series": sub[cols].to_dict(orient="records"),
    }

