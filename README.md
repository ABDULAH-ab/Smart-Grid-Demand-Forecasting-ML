# GridPulse AI — Smart Grid Demand Forecasting & Telemetry Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?logo=vercel)](https://smart-grid-demand-forecasting-ml.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Apache ECharts](https://img.shields.io/badge/Apache_ECharts-6.1-AA344D.svg)](https://echarts.apache.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An end-to-end industrial data product uniting **Data Engineering & Applied Machine Learning** with modern **Software Engineering & Interactive Web Visualization**.

---

### The Core Problem
Power grid operators must commit generation assets 24 hours in advance. Over-forecasting commits expensive spinning reserve units unnecessarily; under-forecasting forces emergency real-time spot-market purchases. Textbook machine learning fails in production because raw utility meter feeds suffer from severe sensor corruption (negative demand, meter dropouts) and non-linear weather regimes (e.g. non-linear AC compressor load above 90°F).

### Purpose & Features
GridPulse AI delivers an audited, reproducible pipeline from raw utility telemetry to an interactive web dispatch console:
- **Data Engineering (DE)**:
  - **Corpus**: 163,993 hourly observations across 10 U.S. municipal load zones (Dallas, Houston, LA, NYC, Philadelphia, Phoenix, San Antonio, San Diego, San Jose, Seattle) spanning July 2018 – May 2020.
  - **4-Tier Anomaly Screening**: Combines domain physics (load $\le 0$, temp/humidity limits), statistical calipers ($|z| > 4.0$, $3 \times \text{IQR}$), and multivariate Isolation Forest.
  - **Causal Imputation**: Zero-lookahead short-gap interpolation and historical median reconstruction over $(\text{city}, \text{month}, \text{hour})$ bins to prevent temporal data leakage.
  - **Feature Engineering**: Cyclic diurnal harmonics ($\sin/\cos$), Cooling/Heating Degree Hours ($\text{CDH}/\text{HDH}$ base $65^\circ\text{F}$), autoregressive lags ($t-24$, $t-168$), and 24h rolling volatility.
  - **Pattern Mining**: Unsupervised standardized K-Means ($k=4$, 0.990 bootstrap Adjusted Rand Index) isolating 4 canonical operational weather-demand regimes.
  - **Predictive ML**: 24-hour day-ahead forecasting across 7 architectures. The champion **Stacking Ensemble** meta-learner scores **351.13 MWh RMSE** (**3.91% MAPE**, **+52.59% skill improvement** over the naive persistence baseline) on an 18,049-observation holdout.
- **Software Engineering (SWE)**:
  - **Full-Stack Architecture**: Python FastAPI backend with zero-copy Parquet streaming paired with a React 18 + Vite frontend.
  - **60 FPS Canvas Visualizations**: Custom **Apache ECharts** instruments featuring isolated mouse-wheel zooming, drag-to-pan, synchronized bottom scrubber tracks, and multi-pen trace spotlighting.
  - **Resilient Client Service Layer**: In-memory query caching, `AbortController` cancellation for rapid filter updates, and automatic edge fallback to pre-bundled datasets.
  - **Zero-Cold-Start Vercel Deployment**: Runs standalone on Vercel's Edge CDN with 0ms latency, while retaining full compatibility with live containerized backends.

---

### Live Web Application
Explore the interactive dispatch console without running anything locally:
- **Production URL**: [https://smart-grid-demand-forecasting-ml.vercel.app](https://smart-grid-demand-forecasting-ml.vercel.app)

### Local Prerequisites
- **Python** `3.10+`
- **Node.js** `18+` and **npm** `9+`

### Installation & Local Setup

#### 1. Backend (FastAPI)
```bash
# Clone the repository
git clone https://github.com/ABDULAH-ab/Smart-Grid-Demand-Forecasting-ML.git
cd Smart-Grid-Demand-Forecasting-ML

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # On Linux/macOS: source .venv/bin/activate

# Install dependencies and start server
pip install fastapi uvicorn pandas pyarrow scikit-learn xgboost pyyaml
uvicorn backend.main:app --reload --port 8000
```
Backend API interactive documentation is available at `http://127.0.0.1:8000/`.

#### 2. Frontend (React + Vite)
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### API Code Examples

```bash
# 1. Health check & corpus statistics
curl http://127.0.0.1:8000/api/health

# 2. Retrieve chronological holdout leaderboard
curl http://127.0.0.1:8000/api/leaderboard

# 3. Fetch 24-hour day-ahead forecasts for a specific city and date range
curl "http://127.0.0.1:8000/api/forecasts?city=dallas&start_date=2020-04-01&end_date=2020-04-07"

# 4. Fetch PCA/t-SNE cluster coordinates with k=4 assignments
curl "http://127.0.0.1:8000/api/clusters?city=all&k=4&limit=1000"
```

Python client snippet:
```python
import requests

res = requests.get(
    "http://127.0.0.1:8000/api/forecasts",
    params={"city": "dallas", "start_date": "2020-04-01", "end_date": "2020-04-07"}
)
forecast_data = res.json()
print(f"Loaded {forecast_data['row_count']} hourly forecasts for {forecast_data['city']}")
```

---

### Project Structure

```text
Smart-Grid-Demand-Forecasting-ML/
├── backend/
│   ├── main.py                     # FastAPI REST service & Parquet stream routes
│   └── requirements.txt            # Minimal backend runtime dependencies
├── configs/
│   └── config.yaml                 # Pipeline configurations, city metadata & thresholds
├── data/
│   ├── raw/                        # Original raw utility and NOAA weather ledgers
│   └── processed/                  # Cleaned parquet datasets & benchmark evaluation metrics
├── frontend/
│   ├── public/demo-data/           # Static JSON datasets for zero-cold-start edge preview
│   ├── src/
│   │   ├── components/charts/      # Apache ECharts instruments (Forecast, Residuals, Clusters)
│   │   ├── services/api.js         # Resilient API layer (caching, AbortController, edge fallback)
│   │   ├── styles/                 # Design tokens (tokens.css) & dispatch grid (layout.css)
│   │   └── views/                  # Lazy-loaded views (Landing, Overview, EDA, Clusters, Studio)
│   ├── vercel.json                 # Vercel SPA routing configuration
│   └── package.json
├── notebooks/                      # Research notebooks (01 EDA, 02 Clustering, 03 Ensembles)
├── src/
│   ├── data/preprocess.py          # Data cleaning, 4-tier anomaly detection, causal imputation
│   ├── features/build_features.py  # Lags, CDH/HDH, cyclical feature engineering
│   └── models/train_forecast.py    # Training & 500x bootstrap validation of 7 models
└── README.md
```

### Running Pipeline Scripts
- **Data Preprocessing**: `python -m src.data.preprocess`
- **Feature Pipeline**: `python -m src.features.build_features`
- **Model Training & Evaluation**: `python -m src.models.train_forecast`
- **Frontend Production Build**: `cd frontend && npm run build`

### Deployment

### License
This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
