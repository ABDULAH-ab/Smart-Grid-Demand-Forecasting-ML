import React, { Suspense, lazy, useEffect, useState } from "react";
import { CITIES, getCityMeta } from "./constants/cities";
import { useTheme } from "./hooks/useTheme";
import { API_BASE, fetchHealth } from "./services/api";
import { LoadingInstrument } from "./components/StatusViews";

const LandingPage = lazy(() => import("./views/LandingPage"));
const OverviewHub = lazy(() => import("./views/OverviewHub"));
const EdaAnomalyLab = lazy(() => import("./views/EdaAnomalyLab"));
const ClusteringExplorer = lazy(() => import("./views/ClusteringExplorer"));
const ForecastingStudio = lazy(() => import("./views/ForecastingStudio"));
const DocsView = lazy(() => import("./views/DocsView"));

const APP_SECTIONS = [
  { id: "overview", num: "01", label: "Overview & City Hub" },
  { id: "eda", num: "02", label: "Data Quality & EDA" },
  { id: "clusters", num: "03", label: "Clustering Explorer" },
  { id: "forecast", num: "04", label: "Forecasting Studio" },
  { id: "docs", num: "05", label: "Docs" },
];

const VALID_SECTIONS = new Set(APP_SECTIONS.map((s) => s.id));

function parseRouteFromHash() {
  if (typeof window === "undefined") return { inApp: false, section: "overview" };
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
  if (VALID_SECTIONS.has(raw)) {
    return { inApp: true, section: raw };
  }
  return { inApp: false, section: "overview" };
}

export default function App() {
  const [route, setRoute] = useState(parseRouteFromHash);
  const [selectedCity, setSelectedCity] = useState("dallas");
  const [health, setHealth] = useState({ state: "checking", rows: null });
  const { mode, setMode, systemDark } = useTheme();

  useEffect(() => {
    const onHashChange = () => setRoute(parseRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth({ signal: controller.signal })
      .then((res) => {
        setHealth({ state: res?.status === "ok" ? "ok" : "err", rows: res?.forecast_rows ?? 0 });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setHealth({ state: "err", rows: null });
      });
    return () => controller.abort();
  }, []);

  const navigateToSection = (sectionId) => {
    const next = VALID_SECTIONS.has(sectionId) ? sectionId : "overview";
    window.location.hash = next;
    setRoute({ inApp: true, section: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToLanding = () => {
    if (window.location.hash) {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    setRoute({ inApp: false, section: "overview" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cityMeta = getCityMeta(selectedCity);

  return (
    <div className="bulletin-shell">
      <a href="#main-content" className="skip-link">
        Skip to main telemetry readout
      </a>

      {/* Masthead */}
      <header className="masthead">
        <button
          type="button"
          className="masthead-brand"
          onClick={navigateToLanding}
          aria-label="GridPulse AI — Return to dispatch bulletin cover"
        >
          <span>
            <span className="masthead-mark" aria-hidden="true" />
            <span className="masthead-title">GridPulse AI</span>
          </span>
          <span className="masthead-code">Smart Grid Telemetry &amp; 24h Load Forecasting</span>
        </button>

        <div className="masthead-controls">
          {/* Dual-State Theme Selector (Light default, Dark) */}
          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="Color scheme preference"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === "light"}
              className="segmented-btn"
              onClick={() => setMode("light")}
            >
              Paper
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "dark"}
              className="segmented-btn"
              onClick={() => setMode("dark")}
            >
              Ink
            </button>
          </div>

          {!route.inApp && (
            <button
              type="button"
              className="btn-quiet"
              onClick={() => navigateToSection("overview")}
            >
              Get started -&gt;
            </button>
          )}
        </div>
      </header>

      {/* Persistent 5-Section App Navigation + Shared Global City State */}
      {route.inApp && (
        <nav className="dispatch-nav-bar" aria-label="Workbench sections">
          <div className="dispatch-tabs">
            {APP_SECTIONS.map((sec) => {
              const isCurrent = route.section === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  className="dispatch-tab"
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => navigateToSection(sec.id)}
                >
                  <span className="dispatch-tab-num">{sec.num}</span>
                  {sec.label}
                </button>
              );
            })}
          </div>

          <div className="global-city-strip">
            <label htmlFor="global-city-picker" className="global-city-label">
              Zone:
            </label>
            <select
              id="global-city-picker"
              className="gp-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="Global active U.S. city load zone"
            >
              {CITIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.iso})
                </option>
              ))}
            </select>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main id="main-content" style={{ flex: 1 }}>
        <Suspense
          fallback={
            <div style={{ paddingBlock: "2rem" }}>
              <LoadingInstrument label="Loading dispatch module..." height={320} />
            </div>
          }
        >
          {!route.inApp ? (
            <LandingPage onEnterApp={() => navigateToSection("overview")} />
          ) : route.section === "overview" ? (
            <OverviewHub
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              onOpenSection={navigateToSection}
            />
          ) : route.section === "eda" ? (
            <EdaAnomalyLab
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
            />
          ) : route.section === "clusters" ? (
            <ClusteringExplorer
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
            />
          ) : route.section === "forecast" ? (
            <ForecastingStudio
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
            />
          ) : (
            <DocsView />
          )}
        </Suspense>
      </main>

      {/* Minimal Bulletin Footer */}
      <footer className="bulletin-footer">
        <div>
          GRIDPULSE AI · 163,993 HOURLY RECORDS · 10 U.S. CITIES (2018–2020) · ACTIVE ZONE:{" "}
          {cityMeta.name.toUpperCase()} ({cityMeta.iso})
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          {route.inApp ? (
            <button
              type="button"
              onClick={navigateToLanding}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "inherit",
                color: "var(--c-ink)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Cover Bulletin
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateToSection("docs")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "inherit",
                color: "var(--c-ink)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Methodology &amp; Documentation
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
