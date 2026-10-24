/* =====================================================================
   BurnCare — components/TbsaCalculator.jsx
   ---------------------------------------------------------------------
   The TBSA calculator (flowchart steps after "Enter Age"):
     choose chart by age → mark burns on the body map → calculate →
     output the total and a breakdown by region.
   Reusable: the Guest and Patient assessments both pass in the age
   and the AI's depth, and receive the result through onChange.

   Props:
     age       number in years (0 = under 1 year), or null if not entered
     depth     1, 2 or 3 (AI result), or null if not known yet
               (while null, the marked area is counted: safer)
     onChange  called with the result whenever it changes:
               { chart, chartLabel, depth, counted, total, breakdown[],
                 specialAreas[] }   (e.g. ["Face", "Hands"])
   Styles: section "TBSA calculator" in styles.css.
   ===================================================================== */

import { useEffect, useMemo, useState } from "react";
import BodyMap from "./BodyMap.jsx";
import { CHARTS, calculateTbsa, chooseChart, formatPercent, isChildChart, maxPalms } from "../tbsa/tbsaCharts.js";

const DEPTH_NAMES = { 1: "1st degree", 2: "2nd degree", 3: "3rd degree" };

function TbsaCalculator({ age, depth, onChange }) {
  const hasAge = typeof age === "number" && age >= 0;
  const chart = hasAge ? chooseChart(age) : null;

  const [marks, setMarks] = useState({}); // { areaId: { method, palms, touched } }
  const [activeId, setActiveId] = useState(null); // area open in the panel

  // A different chart has different areas (e.g. the age changed from 15
  // to 16), so start the map again.
  const [chartId, setChartId] = useState(chart?.id ?? null);
  if ((chart?.id ?? null) !== chartId) {
    setChartId(chart?.id ?? null);
    setMarks({});
    setActiveId(null);
  }

  const result = useMemo(() => (chart ? calculateTbsa(chart, marks, depth) : null), [chart, marks, depth]);

  // Tell the parent page whenever the result changes.
  useEffect(() => {
    if (result) onChange?.(result);
  }, [result, onChange]);

  // A tap on the map. The first tap marks the whole area and opens it in
  // the panel; tapping a marked area just opens it again. The shape that
  // was tapped is remembered (e.g. the hand inside an adult's arm), so
  // special areas are known even when only palms are counted.
  const pick = (areaId, shapeId) => {
    setActiveId(areaId);
    setMarks((current) => {
      const existing = current[areaId] ?? { method: "whole", palms: 0, touched: [] };
      const touched = shapeId && !existing.touched.includes(shapeId) ? [...existing.touched, shapeId] : existing.touched;
      if (current[areaId] && touched === existing.touched) return current;
      return { ...current, [areaId]: { ...existing, touched } };
    });
  };

  const updateMark = (areaId, changes) =>
    setMarks((current) => ({ ...current, [areaId]: { ...current[areaId], ...changes } }));

  const removeMark = (areaId) => {
    setMarks((current) => {
      const next = { ...current };
      delete next[areaId];
      return next;
    });
    setActiveId(null);
  };

  // (also checks the area exists in this chart, in case the chart just changed)
  const active = activeId && marks[activeId] && chart?.areaById[activeId] ? { id: activeId, ...marks[activeId] } : null;

  return (
    <div className="tbsa">
      {/* ===== Which chart is used ===== */}
      <div className="tbsa-chart-row">
        {chart ? (
          <p className="tbsa-chart">
            <span className="tbsa-chart-dot" aria-hidden="true" />
            Chart: <strong>{chart.label}</strong>
          </p>
        ) : (
          <p className="tbsa-chart tbsa-chart-empty">Enter the age first. It decides which chart is used.</p>
        )}
        <p className="tbsa-hint">Tap every burned area. Each number is that area&apos;s % of the body.</p>
      </div>

      <div className="tbsa-layout">
        {/* ===== Body map ===== */}
        <BodyMap
          variant={chart && isChildChart(chart) ? "child" : "adult"}
          chart={chart ?? CHART_PREVIEW}
          marks={marks}
          activeId={activeId}
          counted={result ? result.counted : true}
          disabled={!chart}
          onPick={pick}
        />

        {/* ===== Side panel ===== */}
        <div className="tbsa-side">
          {active && chart ? (
            <RegionPanel
              key={active.id}
              region={chart.areaById[active.id]}
              mark={active}
              value={chart.areaById[active.id].value}
              cap={maxPalms(chart, active.id)}
              onChange={(changes) => updateMark(active.id, changes)}
              onRemove={() => removeMark(active.id)}
              onClose={() => setActiveId(null)}
            />
          ) : (
            <div className="tbsa-panel tbsa-panel-empty">
              <p>
                <strong>Whole area</strong> counts the full region. For a smaller burn, choose{" "}
                <strong>Part of it</strong> and count it in palms.
              </p>
              <p className="tbsa-palm-tip">
                <PalmIcon /> One palm of the patient&apos;s hand, fingers closed, is about 1% of their body.
              </p>
            </div>
          )}

          {/* ===== Output ===== */}
          <TbsaOutput result={result} depth={depth} />
        </div>
      </div>
    </div>
  );
}

// Shown as faint numbers on the map before an age is entered.
const CHART_PREVIEW = CHARTS.adult;

// The selected area: whole area or palms, remove.
function RegionPanel({ region, mark, value, cap, onChange, onRemove, onClose }) {
  const palms = Math.min(mark.palms, cap);

  return (
    <div className="tbsa-panel" aria-live="polite">
      <div className="tbsa-panel-head">
        <h3>{region.label}</h3>
        <button type="button" className="tbsa-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="tbsa-method" role="radiogroup" aria-label="How much is burned">
        <button
          type="button"
          role="radio"
          aria-checked={mark.method === "whole"}
          className={mark.method === "whole" ? "is-selected" : ""}
          onClick={() => onChange({ method: "whole" })}
        >
          Whole area <span>{formatPercent(value)}%</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mark.method === "palms"}
          className={mark.method === "palms" ? "is-selected" : ""}
          onClick={() => onChange({ method: "palms", palms: Math.max(1, palms) })}
        >
          Part of it <span>palms</span>
        </button>
      </div>

      {mark.method === "palms" && (
        <div className="palm-counter">
          <button
            type="button"
            onClick={() => onChange({ palms: Math.max(1, palms - 1) })}
            disabled={palms <= 1}
            aria-label="One palm fewer"
          >
            −
          </button>
          <p aria-live="polite">
            <strong>{palms}</strong> {palms === 1 ? "palm" : "palms"} <span>= {palms}%</span>
          </p>
          <button
            type="button"
            onClick={() => onChange({ palms: Math.min(cap, palms + 1) })}
            disabled={palms >= cap}
            aria-label="One palm more"
          >
            +
          </button>
          <p className="palm-cap">Up to {cap} palms here</p>
        </div>
      )}

      <button type="button" className="tbsa-remove" onClick={onRemove}>
        Remove this area
      </button>
    </div>
  );
}

// Flowchart's last box: "Output TBSA" — total + breakdown by region.
function TbsaOutput({ result, depth }) {
  if (!result) return null;

  return (
    <div className="tbsa-output" aria-live="polite">
      <p className="tbsa-output-label">Estimated TBSA</p>
      <p className="tbsa-total">
        {result.total}
        <span>%</span>
      </p>
      <div className="tbsa-meter" aria-hidden="true">
        <span style={{ width: `${result.total}%` }} />
      </div>

      {depth == null && (
        <p className="tbsa-note">
          Counts every marked area. The photo check will confirm how deep the burn is.
        </p>
      )}
      {depth === 1 && (
        <p className="tbsa-note">
          1st-degree (superficial) burns are not counted in TBSA, so the total is 0%.
        </p>
      )}

      {result.breakdown.length > 0 ? (
        <ul className="tbsa-breakdown">
          {result.breakdown.map((row) => (
            <li key={row.id}>
              <span>
                {row.label}
                <small>{row.method === "whole" ? "whole area" : `${row.palms} ${row.palms === 1 ? "palm" : "palms"}`}</small>
              </span>
              <strong className={result.counted ? "" : "is-muted"}>{formatPercent(row.percent)}%</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tbsa-note">No areas marked yet.</p>
      )}

      {result.specialAreas.length > 0 && (
        <p className="tbsa-special">
          Special area{result.specialAreas.length > 1 ? "s" : ""}: <strong>{result.specialAreas.join(", ")}</strong>
        </p>
      )}

      <p className="tbsa-output-foot">
        {result.chartLabel}
        {depth ? ` · ${DEPTH_NAMES[depth]}` : ""}
      </p>
    </div>
  );
}

function PalmIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m-9 0V9a1.5 1.5 0 0 0-3 0v4.5a7 7 0 0 0 7 7h.5a6.5 6.5 0 0 0 6.5-6.5V12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default TbsaCalculator;