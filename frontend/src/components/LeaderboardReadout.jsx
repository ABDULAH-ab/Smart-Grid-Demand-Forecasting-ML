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

  const toPx = (val) => Number((Math.min(106, Math.max(4, ((val - minRmse) / span) * 102 + 4))).toFixed(2));

  const displayed = compact ? models.slice(0, 5) : models;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className="table-wrapper containment-panel"
    >
      <table
        className="gp-table"
        style={{
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
            {!compact && <th scope="col" className="align-right">Test MAE</th>}
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
                      minInlineSize: "160px",
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
                        x1={toPx(ciLow)}
                        y1="8"
                        x2={toPx(ciHigh)}
                        y2="8"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.6"
                      />
                      <line
                        x1={toPx(ciLow)}
                        y1="4"
                        x2={toPx(ciLow)}
                        y2="12"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.2"
                      />
                      <line
                        x1={toPx(ciHigh)}
                        y1="4"
                        x2={toPx(ciHigh)}
                        y2="12"
                        stroke={isChampion ? "var(--c-signal)" : "var(--c-ink)"}
                        strokeWidth="1.2"
                      />
                      <rect
                        x={toPx(row.test_RMSE) - 2.5}
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
                {!compact && <td className="align-right">{row.test_MAE.toFixed(2)}</td>}
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
