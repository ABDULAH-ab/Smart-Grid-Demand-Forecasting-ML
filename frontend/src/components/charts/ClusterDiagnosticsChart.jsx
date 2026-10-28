import React, { useState } from "react";

/**
 * Interactive SVG mini strip-chart for K-Means evaluation metrics (k = 2..8)
 * with smooth gliding hairline & hover inspection.
 */
function DiagnosticTrack({
  title,
  data,
  valueKey,
  stdKey,
  selectedK,
  onSelectK,
  formatVal,
}) {
  const [hoveredK, setHoveredK] = useState(null);

  if (!data.length) return null;

  const W = 340;
  const H = 114;
  const P = { top: 16, right: 18, bottom: 24, left: 48 };
  const pw = W - P.left - P.right;
  const ph = H - P.top - P.bottom;

  const vals = data.map((d) => Number(d[valueKey]));
  const highs = stdKey
    ? data.map((d) => Number(d[valueKey]) + Number(d[stdKey] || 0))
    : vals;
  const lows = stdKey
    ? data.map((d) => Number(d[valueKey]) - Number(d[stdKey] || 0))
    : vals;

  const minV = Math.min(...lows);
  const maxV = Math.max(...highs);
  const span = Math.max(maxV - minV, 1e-6);
  const pad = span * 0.14;
  const lo = minV - pad;
  const hi = maxV + pad;

  const minK = data[0].k;
  const maxK = data[data.length - 1].k;
  const toX = (k) => P.left + ((k - minK) / Math.max(1, maxK - minK)) * pw;
  const toY = (v) => P.top + ph - ((v - lo) / (hi - lo)) * ph;

  const polyPoints = data
    .map((d) => `${toX(d.k).toFixed(1)},${toY(d[valueKey]).toFixed(1)}`)
    .join(" ");
  const inspectedK = hoveredK ?? selectedK;
  const activeRow = data.find((d) => d.k === inspectedK) || data[0];
  const selectedX = toX(selectedK);

  return (
    <div
      style={{
        borderBlockEnd: "1px solid var(--c-rule)",
        paddingBlock: "0.65rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBlockEnd: "0.25rem",
        }}
      >
        <span className="font-mono" style={{ fontSize: "0.72rem", fontWeight: 600 }}>
          {title}
        </span>
        <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--c-signal)" }}>
          k={activeRow.k}: {formatVal(activeRow[valueKey])}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ inlineSize: "100%", blockSize: "auto" }}
        role="img"
        aria-label={`${title} across cluster counts k=2 to k=8`}
      >
        <rect
          x={P.left}
          y={P.top}
          width={pw}
          height={ph}
          fill="var(--c-paper)"
          stroke="var(--c-rule-strong)"
          strokeWidth="0.9"
        />

        {[lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.85].map((tv, idx) => (
          <g key={idx}>
            <line
              x1={P.left}
              y1={toY(tv)}
              x2={P.left + pw}
              y2={toY(tv)}
              stroke="var(--c-grid)"
              strokeDasharray="2 3"
            />
            <text
              x={P.left - 5}
              y={toY(tv) + 3}
              textAnchor="end"
              fill="var(--c-graphite)"
              fontFamily="var(--font-mono)"
              fontSize="8.8"
            >
              {formatVal(tv)}
            </text>
          </g>
        ))}

        {/* Optimal k=4 Reference Rule */}
        <line
          x1={toX(4)}
          y1={P.top}
          x2={toX(4)}
          y2={P.top + ph}
          stroke="var(--c-rule-strong)"
          strokeDasharray="2 2"
        />

        {/* Animated Selected k Vermilion Hairline */}
        <g
          style={{
            transform: `translateX(${selectedX.toFixed(1)}px)`,
            transition: "transform 240ms var(--ease-out-quart)",
          }}
        >
          <line
            x1={0}
            y1={P.top}
            x2={0}
            y2={P.top + ph}
            stroke="var(--c-signal)"
            strokeWidth="1.5"
          />
        </g>

        <polyline
          points={polyPoints}
          fill="none"
          stroke="var(--c-ink)"
          strokeWidth="1.6"
        />

        {data.map((d) => {
          const cx = toX(d.k);
          const cy = toY(d[valueKey]);
          const isCurrent = d.k === selectedK;
          const isHovered = d.k === hoveredK;
          const sd = stdKey ? Number(d[stdKey] || 0) : 0;

          return (
            <g
              key={d.k}
              onMouseEnter={() => setHoveredK(d.k)}
              onMouseLeave={() => setHoveredK(null)}
              onClick={() => onSelectK && onSelectK(d.k)}
              style={{ cursor: onSelectK ? "pointer" : "default" }}
            >
              {/* Larger invisible hit zone for easy touch & mouse targeting */}
              <rect x={cx - 12} y={P.top} width={24} height={ph + 18} fill="transparent" />
              {sd > 0 && (
                <line
                  x1={cx}
                  y1={toY(d[valueKey] - sd)}
                  x2={cx}
                  y2={toY(d[valueKey] + sd)}
                  stroke="var(--c-graphite)"
                  strokeWidth="1.15"
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isCurrent ? 4.8 : isHovered ? 4.2 : 2.8}
                fill={isCurrent || isHovered ? "var(--c-signal)" : "var(--c-ink)"}
                stroke="var(--c-paper)"
                strokeWidth="1.2"
                style={{ transition: "r 160ms ease, fill 160ms ease" }}
              />
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fill={isCurrent || isHovered ? "var(--c-signal)" : "var(--c-graphite)"}
                fontFamily="var(--font-mono)"
                fontSize="9.2"
                fontWeight={isCurrent || isHovered ? "600" : "400"}
              >
                {d.k}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ClusterDiagnosticsChart({
  kmeansEval = [],
  selectedK = 4,
  onSelectK,
}) {
  if (!kmeansEval.length) return null;

  return (
    <div className="instrument-frame containment-panel">
      <div className="instrument-header" style={{ marginBlockEnd: "0.35rem" }}>
        <div>
          <span className="kicker">PARTITION DIAGNOSTICS // k = 2..8</span>
          <h3 className="instrument-title">Elbow, Silhouette &amp; Stability</h3>
          <p className="instrument-subtitle">
            Hover or click any k node to re-partition · Canonical optimum k = 4 (ARI 0.990)
          </p>
        </div>
      </div>

      <DiagnosticTrack
        title="01 / INERTIA (ELBOW SSE)"
        data={kmeansEval}
        valueKey="inertia"
        selectedK={selectedK}
        onSelectK={onSelectK}
        formatVal={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
      />

      <DiagnosticTrack
        title="02 / SILHOUETTE SEPARATION"
        data={kmeansEval}
        valueKey="silhouette_score"
        selectedK={selectedK}
        onSelectK={onSelectK}
        formatVal={(v) => Number(v).toFixed(3)}
      />

      <DiagnosticTrack
        title="03 / BOOTSTRAP STABILITY (ARI ± SD)"
        data={kmeansEval}
        valueKey="stability_ari_mean"
        stdKey="stability_ari_std"
        selectedK={selectedK}
        onSelectK={onSelectK}
        formatVal={(v) => Number(v).toFixed(3)}
      />
    </div>
  );
}
