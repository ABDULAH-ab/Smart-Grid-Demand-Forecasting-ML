import React, { useId } from "react";
import { MODEL_BY_KEY, formatModelName } from "../constants/cities";

/**
 * Out-of-Time Holdout Leaderboard with inline SVG 95% Bootstrap RMSE Confidence Intervals
 * and accessible container-query responsive table structure.
 */
export default function LeaderboardReadout({ models = [], compact = false }) {
  const captionId = useId();

  if (!models.length) {
    return null;
  }

  const maxRmse = Math.max(...models.map((m) => m.test_RMSE_CI95_high || m.test_RMSE), 800);
  const minRmse = Math.min(...models.map((m) => m.test_RMSE_CI95_low || m.test_RMSE), 300) * 0.85;
  const span = Math.max(maxRmse - minRmse, 1);

  const displayed = compact ? models.slice(0, 5) : models;

  if (compact) {
    const toPxCompact = (val) =>
      Number((Math.min(42, Math.max(2, ((val - minRmse) / span) * 38 + 2))).toFixed(1));

    return (
      <div
        className="instrument-frame leaderboard-frame"
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxSizing: "border-box",
          inlineSize: "100%",
          maxInlineSize: "100%",
          overflow: "hidden",
          padding: "var(--space-3) var(--space-3)",
        }}
      >
        <div style={{ inlineSize: "100%", minInlineSize: 0 }}>
          <div className="instrument-header" style={{ paddingBlockEnd: "0.5rem", marginBlockEnd: "0.5rem" }}>
            <div>
              <span className="kicker">HOLDOUT BENCHMARK // 10 CITIES</span>
              <h3 className="instrument-title" id={captionId} style={{ marginBlockEnd: "0.15rem", fontSize: "1.05rem" }}>
                Model Accuracy Leaderboard
              </h3>
              <p className="instrument-subtitle" style={{ fontSize: "0.68rem" }}>
                Mar–May 2020 · 18,049 out-of-fold hourly observations
              </p>
            </div>
            <div className="instrument-header-actions">
              <span
                className="font-mono"
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.05em",
                  color: "var(--c-signal)",
                  border: "1px solid var(--c-signal)",
                  backgroundColor: "var(--c-signal-tint)",
                  padding: "0.12rem 0.38rem",
                  textTransform: "uppercase",
                }}
              >
                Champion: Stacking
              </span>
            </div>
          </div>

          <table
            className="gp-table gp-table-compact"
            style={{
              inlineSize: "100%",
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: 0,
              boxSizing: "border-box",
            }}
          >
            <colgroup>
              <col style={{ inlineSize: "36%" }} />
              <col style={{ inlineSize: "19%" }} />
              <col style={{ inlineSize: "27%" }} />
              <col style={{ inlineSize: "18%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Model</th>
                <th scope="col" className="align-right">RMSE</th>
                <th scope="col">95% CI</th>
                <th scope="col" className="align-right">Skill</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, idx) => {
                const isChampion = row.model === "Stacking_Ensemble" || idx === 0;
                const isNaive = row.model === "Naive_Baseline";
                const penColor = MODEL_BY_KEY[row.model]?.color || "var(--c-ink)";
                const ciLow = row.test_RMSE_CI95_low ?? row.test_RMSE;
                const ciHigh = row.test_RMSE_CI95_high ?? row.test_RMSE;
                const skill = row.rmse_skill_vs_naive_pct;
                const modelLabel = MODEL_BY_KEY[row.model]?.shortLabel || formatModelName(row.model);

                return (
                  <tr key={row.model} className={isChampion ? "is-highlight" : undefined}>
                    <th
                      scope="row"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingInline: "0.4rem",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", minInlineSize: 0, overflow: "hidden" }}>
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            inlineSize: "6px",
                            blockSize: "3px",
                            backgroundColor: penColor,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "var(--c-graphite)", fontSize: "0.68rem", flexShrink: 0 }}>
                          0{idx + 1}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: isChampion ? 600 : 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {modelLabel}
                        </span>
                      </span>
                      {isChampion && (
                        <span
                          style={{
                            marginInlineStart: "0.25rem",
                            color: "var(--c-signal)",
                            fontSize: "0.6rem",
                            letterSpacing: "0.04em",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          [PRIM]
                        </span>
                      )}
                    </th>
                    <td
                      className="align-right font-mono"
                      style={{
                        fontWeight: isChampion ? 600 : 400,
                        color: isChampion ? "var(--c-signal)" : "var(--c-ink)",
                        fontSize: "0.76rem",
                        whiteSpace: "nowrap",
                        paddingInline: "0.35rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.test_RMSE.toFixed(1)}
                    </td>
                    <td style={{ whiteSpace: "nowrap", paddingInline: "0.35rem", overflow: "hidden" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          minInlineSize: 0,
                        }}
                      >
                        <svg
                          width="38"
                          height="12"
                          viewBox="0 0 46 12"
                          aria-hidden="true"
                          style={{ flexShrink: 0, overflow: "visible" }}
                        >
                          <line
                            x1="0"
                            y1="6"
                            x2="46"
                            y2="6"
                            stroke="var(--c-grid)"
                            strokeWidth="1"
                          />
                          <line
                            x1={toPxCompact(ciLow)}
                            y1="6"
                            x2={toPxCompact(ciHigh)}
                            y2="6"
                            stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                            strokeWidth="1.6"
                          />
                          <line
                            x1={toPxCompact(ciLow)}
                            y1="2"
                            x2={toPxCompact(ciLow)}
                            y2="10"
                            stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                            strokeWidth="1.2"
                          />
                          <line
                            x1={toPxCompact(ciHigh)}
                            y1="2"
                            x2={toPxCompact(ciHigh)}
                            y2="10"
                            stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                            strokeWidth="1.2"
                          />
                          <rect
                            x={toPxCompact(row.test_RMSE) - 1.5}
                            y="4.5"
                            width="3"
                            height="3"
                            fill={
                              isChampion
                                ? "var(--c-signal)"
                                : isNaive
                                ? "var(--c-graphite)"
                                : "var(--c-ink)"
                            }
                          />
                        </svg>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: "0.64rem",
                            color: "var(--c-graphite)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          [{ciLow.toFixed(0)}–{ciHigh.toFixed(0)}]
                        </span>
                      </div>
                    </td>
                    <td
                      className="align-right font-mono"
                      style={{
                        color:
                          skill > 0
                            ? isChampion
                              ? "var(--c-signal)"
                              : "var(--c-ink)"
                            : "var(--c-graphite)",
                        fontWeight: isChampion ? 600 : 400,
                        fontSize: "0.76rem",
                        whiteSpace: "nowrap",
                        paddingInline: "0.35rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {skill > 0 ? `+${skill.toFixed(1)}%` : `${skill.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginBlockStart: "0.65rem",
            paddingBlockStart: "0.55rem",
            borderBlockStart: "1px dashed var(--c-rule)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "0.66rem",
            color: "var(--c-graphite)",
            boxSizing: "border-box",
            inlineSize: "100%",
          }}
        >
          <span>10-CITY TEST POOL</span>
          <span style={{ color: "var(--c-signal)", fontWeight: 500 }}>
            -52.6% RMSE VS NAIVE
          </span>
        </div>
      </div>
    );
  }

  const toPxFull = (val) =>
    Number((Math.min(106, Math.max(4, ((val - minRmse) / span) * 102 + 4))).toFixed(2));

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className="table-wrapper"
    >
      <table
        className="gp-table"
        style={{
          inlineSize: "100%",
          "--label-2": '"Test RMSE (MWh)"',
          "--label-3": '"95% Bootstrap CI"',
          "--label-4": '"Test MAE"',
          "--label-5": '"Test MAPE"',
          "--label-6": '"Skill vs. Naive"',
        }}
      >
        <caption id={captionId}>
          Chronological Holdout Benchmark (Mar–May 2020 · 18,049 Hourly City-Timestamp Observations)
        </caption>
        <thead>
          <tr>
            <th scope="col">Architecture</th>
            <th scope="col" className="align-right">Test RMSE (MWh)</th>
            <th scope="col">95% CI Whisker Caliper</th>
            <th scope="col" className="align-right">Test MAE</th>
            <th scope="col" className="align-right">Test MAPE</th>
            <th scope="col" className="align-right">Skill vs. Naive</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, idx) => {
            const isChampion = row.model === "Stacking_Ensemble" || idx === 0;
            const isNaive = row.model === "Naive_Baseline";
            const penColor = MODEL_BY_KEY[row.model]?.color || "var(--c-ink)";
            const ciLow = row.test_RMSE_CI95_low ?? row.test_RMSE;
            const ciHigh = row.test_RMSE_CI95_high ?? row.test_RMSE;
            const skill = row.rmse_skill_vs_naive_pct;

            return (
              <tr key={row.model} className={isChampion ? "is-highlight" : undefined}>
                <th scope="row">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        inlineSize: "10px",
                        blockSize: "3px",
                        backgroundColor: penColor,
                      }}
                    />
                    <span style={{ color: "var(--c-graphite)" }}>0{idx + 1}</span>
                    <span>{formatModelName(row.model)}</span>
                  </span>
                  {isChampion && (
                    <span
                      style={{
                        marginInlineStart: "0.5rem",
                        color: "var(--c-signal)",
                        fontSize: "0.68rem",
                        letterSpacing: "0.06em",
                      }}
                    >
                      [PRIMARY]
                    </span>
                  )}
                </th>
                <td
                  className="align-right"
                  style={{
                    fontWeight: isChampion ? 600 : 400,
                    color: isChampion ? "var(--c-signal)" : "var(--c-ink)",
                  }}
                >
                  {row.test_RMSE.toFixed(2)}
                </td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      minInlineSize: "140px",
                    }}
                  >
                    <svg
                      width="110"
                      height="16"
                      viewBox="0 0 110 16"
                      aria-hidden="true"
                      style={{ flexShrink: 0, overflow: "visible" }}
                    >
                      <line
                        x1="0"
                        y1="8"
                        x2="110"
                        y2="8"
                        stroke="var(--c-grid)"
                        strokeWidth="1"
                      />
                      <line
                        x1={toPxFull(ciLow)}
                        y1="8"
                        x2={toPxFull(ciHigh)}
                        y2="8"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.6"
                      />
                      <line
                        x1={toPxFull(ciLow)}
                        y1="4"
                        x2={toPxFull(ciLow)}
                        y2="12"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.2"
                      />
                      <line
                        x1={toPxFull(ciHigh)}
                        y1="4"
                        x2={toPxFull(ciHigh)}
                        y2="12"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.2"
                      />
                      <rect
                        x={toPxFull(row.test_RMSE) - 2.5}
                        y="5.5"
                        width="5"
                        height="5"
                        fill={
                          isChampion
                            ? "var(--c-signal)"
                            : isNaive
                            ? "var(--c-graphite)"
                            : "var(--c-ink)"
                        }
                      />
                    </svg>
                    <span style={{ fontSize: "0.72rem", color: "var(--c-graphite)" }}>
                      [{ciLow.toFixed(0)}–{ciHigh.toFixed(0)}]
                    </span>
                  </div>
                </td>
                <td className="align-right">{row.test_MAE.toFixed(2)}</td>
                <td className="align-right">{row.test_MAPE_pct.toFixed(2)}%</td>
                <td
                  className="align-right"
                  style={{
                    color:
                      skill > 0
                        ? isChampion
                          ? "var(--c-signal)"
                          : "var(--c-ink)"
                        : "var(--c-graphite)",
                    fontWeight: isChampion ? 600 : 400,
                  }}
                >
                  {skill > 0 ? `+${skill.toFixed(2)}%` : `${skill.toFixed(2)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
