import React from "react";
import { CLUSTER_GLYPHS } from "../constants/cities";

export function LoadingInstrument({ label = "Acquiring telemetry stream...", height = 280 }) {
  return (
    <div
      className="instrument-frame"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="instrument-header">
        <div>
          <span className="kicker">TELEMETRY BUFFER</span>
          <p className="font-mono" style={{ fontSize: "0.82rem" }}>
            {label}
          </p>
        </div>
        <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--c-graphite)" }}>
          SYNC IN PROGRESS
        </span>
      </div>
      <div className="skeleton-box" style={{ blockSize: `${height}px`, inlineSize: "100%" }} />
    </div>
  );
}

export function ErrorState({ error, onRetry, contextLabel = "Telemetry Readout" }) {
  const message =
    error?.message ||
    "Telemetry service unreachable. Please ensure the backend server is running and retry.";

  return (
    <div className="status-panel is-error" role="alert">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <polygon
            points="7,1 13,13 1,13"
            fill="none"
            stroke="var(--c-signal)"
            strokeWidth="1.5"
          />
          <line x1="7" y1="5" x2="7" y2="9" stroke="var(--c-signal)" strokeWidth="1.5" />
          <circle cx="7" cy="11.2" r="0.8" fill="var(--c-signal)" />
        </svg>
        <span className="status-code-tag">FAULT // {contextLabel}</span>
      </div>
      <p style={{ fontSize: "0.95rem", maxInlineSize: "72ch" }}>{message}</p>
      {onRetry && (
        <div style={{ marginTop: "0.25rem" }}>
          <button type="button" className="btn-quiet" onClick={onRetry}>
            Retry Telemetry Fetch
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="status-panel" role="status">
      <span className="kicker">NO RECORDS IN WINDOW</span>
      <h3 className="font-display" style={{ fontSize: "1.2rem" }}>
        {title}
      </h3>
      <p style={{ color: "var(--c-graphite)", maxInlineSize: "65ch" }}>{description}</p>
      {onAction && actionLabel && (
        <div>
          <button type="button" className="btn-quiet" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Geometric SVG glyph for clusters (ensuring shape + color differentiation).
 */
export function ClusterGlyph({ clusterId, size = 11 }) {
  const spec = CLUSTER_GLYPHS[clusterId % CLUSTER_GLYPHS.length];
  const half = size / 2;
  const pad = 1.4;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
    >
      {spec.shape === "circle" && (
        <circle cx={half} cy={half} r={half - pad} fill={spec.color} />
      )}
      {spec.shape === "diamond" && (
        <polygon
          points={`${half},${pad} ${size - pad},${half} ${half},${size - pad} ${pad},${half}`}
          fill={spec.color}
        />
      )}
      {spec.shape === "square" && (
        <rect
          x={pad}
          y={pad}
          width={size - pad * 2}
          height={size - pad * 2}
          fill={spec.color}
        />
      )}
      {spec.shape === "triangle" && (
        <polygon
          points={`${half},${pad} ${size - pad},${size - pad} ${pad},${size - pad}`}
          fill={spec.color}
        />
      )}
      {spec.shape === "cross" && (
        <g stroke={spec.color} strokeWidth="2">
          <line x1={pad} y1={half} x2={size - pad} y2={half} />
          <line x1={half} y1={pad} x2={half} y2={size - pad} />
        </g>
      )}
      {spec.shape === "ring" && (
        <circle
          cx={half}
          cy={half}
          r={half - pad - 0.5}
          fill="none"
          stroke={spec.color}
          strokeWidth="1.8"
        />
      )}
      {spec.shape === "inv-triangle" && (
        <polygon
          points={`${pad},${pad} ${size - pad},${pad} ${half},${size - pad}`}
          fill={spec.color}
        />
      )}
      {spec.shape === "hollow-square" && (
        <rect
          x={pad + 0.5}
          y={pad + 0.5}
          width={size - (pad + 0.5) * 2}
          height={size - (pad + 0.5) * 2}
          fill="none"
          stroke={spec.color}
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
