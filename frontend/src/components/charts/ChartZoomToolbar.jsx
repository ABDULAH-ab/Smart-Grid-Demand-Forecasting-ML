import React from "react";

/**
 * Unified Mechanical Zoom & Pan Toolbar for all GridPulse AI instruments.
 */
export default function ChartZoomToolbar({
  zoomFactor = 1,
  isZoomed = false,
  canZoomIn = true,
  onZoomIn,
  onZoomOut,
  onReset,
  onPanLeft,
  onPanRight,
  wheelActive = false,
  onToggleWheel,
  canZoom = true,
}) {
  if (!canZoom) return null;

  return (
    <div
      className="zoom-toolbar"
      role="toolbar"
      aria-label="Chart zoom and pan controls"
    >
      {isZoomed && onPanLeft && (
        <button
          type="button"
          className="zoom-btn"
          onClick={onPanLeft}
          title="Pan window earlier"
          aria-label="Pan window left"
        >
          &lt;
        </button>
      )}

      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomOut}
        disabled={!isZoomed}
        title="Zoom out"
        aria-label="Zoom out"
      >
        &minus;
      </button>

      <span
        className={`zoom-readout ${isZoomed ? "is-zoomed" : ""}`}
        title="Drag across chart to zoom into a range, or double-click chart to reset"
      >
        {zoomFactor > 1.04 ? `${zoomFactor.toFixed(1)}x` : "1.0x"}
      </span>

      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="Zoom in (or drag across plot)"
        aria-label="Zoom in"
      >
        +
      </button>

      {isZoomed && onPanRight && (
        <button
          type="button"
          className="zoom-btn"
          onClick={onPanRight}
          title="Pan window later"
          aria-label="Pan window right"
        >
          &gt;
        </button>
      )}

      {onToggleWheel && (
        <button
          type="button"
          className="zoom-btn is-text"
          aria-pressed={wheelActive}
          onClick={onToggleWheel}
          title="Toggle direct mouse-wheel zoom on hover (Ctrl+Scroll also zooms anytime)"
        >
          Wheel
        </button>
      )}

      {isZoomed && (
        <button
          type="button"
          className="zoom-btn is-reset"
          onClick={onReset}
          title="Reset to 100% full window (or double-click chart)"
        >
          Reset
        </button>
      )}
    </div>
  );
}
