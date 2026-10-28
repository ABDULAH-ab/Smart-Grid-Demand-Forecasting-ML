# GridPulse AI — Smart Grid Demand Forecasting & Pattern Mining

GridPulse AI analyzes **163,993 hourly electricity demand and weather records** across **10 U.S. municipal load zones** (`dallas`, `houston`, `la`, `nyc`, `philadelphia`, `phoenix`, `san_antonio`, `san_diego`, `san_jose`, `seattle`) spanning July 2018 through May 2020.

It repairs raw sensor telemetry spikes, partitions multi-city consumption–weather states into interpretable operational regimes (`k = 4`, `0.990` bootstrap Adjusted Rand Index), and forecasts **24-hour-ahead electricity load** across seven statistical, tree, neural, and ensemble architectures. On the strict out-of-time holdout archive (`18,049` hourly city-timestamp observations), the **Stacking Ensemble** reaches **351.13 MWh RMSE** (**3.91% MAPE**, **+52.59% RMSE skill** vs. the 24-hour naive persistence baseline).

---

## Repository Structure

```text
Smart-Grid-Demand-Forecasting-ML/
├── backend/
│   └── main.py                 # Read-only FastAPI telemetry & forecast service (CORS enabled)
├── configs/
│   └── config.yaml             # Pipeline hyperparameters, date splits, and thresholds
├── frontend/
│   ├── public/favicon.svg      # Strip-chart SVG favicon
│   ├── index.html              # FOUC-free color-scheme init, SEO/OG metadata, font preconnects
│   └── src/
│       ├── styles/
│       │   ├── tokens.css      # Single source of CSS variables (light/dark tokens, type, spacing)
│       │   └── layout.css      # Asymmetric dispatch-bulletin grid & responsive table/chart frames
│       ├── constants/cities.js # ISO balancing authority metadata, model trace specs, glyphs
│       ├── services/api.js     # Isolated fetch layer with Map cache + AbortController cancellation
│       ├── hooks/              # useChartEnvironment, useDebouncedValue & tri-state useTheme hooks
│       ├── components/         # StatusViews, LeaderboardReadout, and 5 custom chart instruments
│       └── views/              # Lazy-loaded LandingPage + 5 workbench sections
└── notebooks/                  # Executed analytical notebooks (01 EDA, 02 Clustering, 03 Ensembles)
```

---

## Prerequisites

- **Python** `3.10+` (for the FastAPI backend and data mining pipeline)
- **Node.js** `18+` and **npm** `9+` (for the React 18 + Vite frontend)

---

## 1. Setup

### Backend Setup

From the repository root:

```bash
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

*(Note: Data preprocessing, anomaly detection, clustering, and ensemble model evaluation workflows are documented and executed in `notebooks/01_data_preprocessing_and_anomalies.ipynb`, `notebooks/02_clustering_analysis.ipynb`, and `notebooks/03_demand_forecasting_and_ensembles.ipynb`.)*

### Frontend Setup

```bash
cd frontend
npm install
```

Configure the backend base URL if needed by copying `.env.example` to `.env`:

```bash
cp .env.example .env
```

`VITE_API_BASE` defaults to `http://127.0.0.1:8000` when unset.

---

## 2. Run Locally (Backend + Frontend)

Open two terminals:

**Terminal 1 — Start FastAPI Backend (`http://127.0.0.1:8000`):**

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Verify health check at `http://127.0.0.1:8000/api/health`.

**Terminal 2 — Start React + Vite Dev Server (`http://localhost:5173`):**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 3. Production Build & Local Preview

Build optimized, code-split static assets into `frontend/dist/`:

```bash
cd frontend
npm run build
npm run preview
```

---

## 4. Deployment

1. **Backend (FastAPI):**
   - Deploy the repository root (including `backend/main.py` and `data/processed/`) to a Python container host (Cloud Run, Render, Railway, Fly.io, or a Linux VM behind Nginx/Caddy).
   - Start command:
     ```bash
     uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
     ```
2. **Frontend (Static SPA):**
   - Set environment variable `VITE_API_BASE=https://your-api-domain.example.com` at build time.
   - Build command: `npm run build` (working directory: `frontend/`).
   - Publish directory: `frontend/dist` (compatible with Cloudflare Pages, Vercel, Netlify, Firebase Hosting, or Nginx). No SPA path rewrite rule is required because section routing uses hash fragments (`#overview`, `#eda`, `#clusters`, `#forecast`, `#docs`).
