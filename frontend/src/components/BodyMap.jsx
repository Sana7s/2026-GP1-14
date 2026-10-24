/* =====================================================================
   BurnCare — components/BodyMap.jsx
   ---------------------------------------------------------------------
   Clickable front and back body outlines. The body is drawn as 35
   shapes (head, neck, chest, stomach, genitals, upper/lower back,
   buttocks, and upper arm, forearm, hand, thigh, lower leg and foot on
   each side), and the CHART decides how they are grouped:
     - Lund and Browder (children): every shape is its own area.
     - Rule of Nines (adults): shapes are joined into the textbook areas,
       e.g. upper arm + forearm + hand = one arm side (4½%). Tapping any
       of them selects the whole area, and it lights up together.
   "child" draws a child's proportions (bigger head, shorter legs).
   Styles: section "TBSA calculator" in styles.css.
   ===================================================================== */

import { formatPercent } from "../tbsa/tbsaCharts.js";

// Heights of each body part (y positions inside a 200 × 410 box).
const SHAPES = {
  adult: { headCy: 36, headRx: 20, headRy: 25, neckTop: 57, sh: 76, elbow: 136, wrist: 186, mid: 146, hip: 210, crotch: 232, knee: 300, ankle: 372 },
  child: { headCy: 50, headRx: 30, headRy: 35, neckTop: 81, sh: 96, elbow: 146, wrist: 188, mid: 156, hip: 214, crotch: 234, knee: 290, ankle: 346 },
};

const mirror = (points) => points.map(([x, y]) => [200 - x, y]);
const toPath = (points) => `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

// A point on the straight edge from `a` to `b`, at height y.
const along = ([x1, y1], [x2, y2], y) => [Math.round((x1 + ((x2 - x1) * (y - y1)) / (y2 - y1)) * 10) / 10, y];

// One arm and one leg, drawn on the viewer's LEFT. Mirrored for the right.
function limbShapes(g) {
  // Arm edges: outer (away from the body) and inner.
  const armOuterTop = [47, g.sh + 4];
  const armOuterEnd = [32, g.wrist];
  const armInnerTop = [61, g.sh + 24];
  const armInnerEnd = [47, g.wrist];
  const upperArm = [
    [61, g.sh + 1],
    armOuterTop,
    along(armOuterTop, armOuterEnd, g.elbow),
    along(armInnerTop, armInnerEnd, g.elbow),
    armInnerTop,
  ];
  const forearm = [
    along(armOuterTop, armOuterEnd, g.elbow),
    armOuterEnd,
    armInnerEnd,
    along(armInnerTop, armInnerEnd, g.elbow),
  ];
  const hand = { type: "ellipse", cx: 39, cy: g.wrist + 13, rx: 9, ry: 13 };

  // Leg edges.
  const legOuterTop = [65, g.hip];
  const legOuterEnd = [74, g.ankle];
  const legInnerTop = [99, g.crotch];
  const legInnerEnd = [96, g.ankle];
  const thigh = [legOuterTop, [99, g.hip + 4], legInnerTop, along(legInnerTop, legInnerEnd, g.knee), along(legOuterTop, legOuterEnd, g.knee)];
  const lowerLeg = [along(legOuterTop, legOuterEnd, g.knee), along(legInnerTop, legInnerEnd, g.knee), legInnerEnd, legOuterEnd];
  const foot = { type: "ellipse", cx: 85, cy: g.ankle + 9, rx: 14, ry: 8 };

  // The same arm and leg as ONE outline (no line at the elbow or knee),
  // for charts where the whole limb side is one area (Rule of Nines).
  const wholeArm = [[61, g.sh + 1], armOuterTop, armOuterEnd, armInnerEnd, armInnerTop];
  const wholeLeg = [legOuterTop, [99, g.hip + 4], legInnerTop, legInnerEnd, legOuterEnd];

  return { upperArm, forearm, hand, thigh, lowerLeg, foot, wholeArm, wholeLeg };
}

// Middle of a list of points (for the % label).
const centre = (points) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 + 3 };
};

// All shapes for one view. The patient's RIGHT side is drawn on the
// viewer's left from the front, and on the viewer's right from behind.
// merged = true for the Rule of Nines: each arm, leg and the lower back
// with the buttocks are drawn as one outline, without inner lines.
function buildShapes(g, view, merged) {
  const cap = view === "front" ? "Front" : "Back";
  const sideOnLeft = view === "front" ? "right" : "left";
  const sideOnRight = view === "front" ? "left" : "right";
  const L = limbShapes(g);
  const shapes = [];

  // Arms and legs on both sides of the drawing.
  for (const [side, flip] of [[sideOnLeft, false], [sideOnRight, true]]) {
    const pts = (points) => (flip ? mirror(points) : points);
    const ell = (e) => (flip ? { ...e, cx: 200 - e.cx } : e);
    const limbParts = merged
      ? [["wholeArm", "UpperArm"], ["wholeLeg", "Thigh"]] // one outline, given to the upper arm / thigh shape
      : [["upperArm", "UpperArm"], ["forearm", "Forearm"], ["thigh", "Thigh"], ["lowerLeg", "LowerLeg"]];
    for (const [part, name] of limbParts) {
      const points = pts(L[part]);
      shapes.push({ region: `${side}${name}${cap}`, parts: [{ type: "path", d: toPath(points) }], label: centre(points) });
    }
    for (const [part, name] of [["hand", "Hand"], ["foot", "Foot"]]) {
      const e = ell(L[part]);
      shapes.push({ region: `${side}${name}${cap}`, parts: [e], label: { x: e.cx, y: e.cy + 3 }, small: true });
    }
  }

  // Head and neck.
  shapes.push(
    {
      region: view === "front" ? "headFront" : "headBack",
      parts: [{ type: "ellipse", cx: 100, cy: g.headCy, rx: g.headRx, ry: g.headRy }],
      label: { x: 100, y: g.headCy + 4 },
    },
    {
      region: view === "front" ? "neckFront" : "neckBack",
      parts: [{ type: "rect", x: 90, y: g.neckTop, width: 20, height: g.sh - g.neckTop + 2, rx: 4 }],
      label: { x: 100, y: (g.neckTop + g.sh) / 2 + 4 },
      small: true,
    },
  );

  if (view === "front") {
    shapes.push(
      { region: "chest", parts: [{ type: "path", d: `M61 ${g.sh} Q100 ${g.sh - 8} 139 ${g.sh} L138 ${g.mid} L62 ${g.mid} Z` }], label: { x: 100, y: (g.sh + g.mid) / 2 + 4 } },
      { region: "abdomen", parts: [{ type: "path", d: `M62 ${g.mid} L138 ${g.mid} L135 ${g.hip} Q100 ${g.hip + 6} 65 ${g.hip} Z` }], label: { x: 100, y: (g.mid + g.hip) / 2 + 4 } },
      { region: "genitals", parts: [{ type: "path", d: `M89 ${g.hip + 4} L111 ${g.hip + 4} L100 ${g.crotch + 4} Z` }], label: { x: 100, y: g.hip + 15 }, small: true },
    );
  } else {
    const butt = g.hip + (g.crotch - g.hip) / 2;
    if (merged) {
      // Lower back and buttocks as one outline.
      shapes.push(
        { region: "upperBack", parts: [{ type: "path", d: `M61 ${g.sh} Q100 ${g.sh - 8} 139 ${g.sh} L138 ${g.mid} L62 ${g.mid} Z` }], label: { x: 100, y: (g.sh + g.mid) / 2 + 4 } },
        {
          region: "lowerBack",
          parts: [{ type: "path", d: `M62 ${g.mid} L138 ${g.mid} L136 ${g.hip - 8} L134 ${butt + 12} Q120 ${g.crotch + 14} 100 ${g.crotch + 6} Q80 ${g.crotch + 14} 66 ${butt + 12} L64 ${g.hip - 8} Z` }],
          label: { x: 100, y: (g.mid + g.crotch) / 2 + 4 },
        },
      );
      return shapes;
    }
    shapes.push(
      { region: "upperBack", parts: [{ type: "path", d: `M61 ${g.sh} Q100 ${g.sh - 8} 139 ${g.sh} L138 ${g.mid} L62 ${g.mid} Z` }], label: { x: 100, y: (g.sh + g.mid) / 2 + 4 } },
      { region: "lowerBack", parts: [{ type: "path", d: `M62 ${g.mid} L138 ${g.mid} L136 ${g.hip - 8} L64 ${g.hip - 8} Z` }], label: { x: 100, y: (g.mid + g.hip - 8) / 2 + 4 } },
      // Buttocks cover the top of the thighs from behind.
      { region: "leftButtock", parts: [{ type: "path", d: `M64 ${g.hip - 8} L100 ${g.hip - 8} L100 ${g.crotch + 6} Q80 ${g.crotch + 14} 66 ${butt + 12} Z` }], label: { x: 83, y: butt + 4 } },
      { region: "rightButtock", parts: [{ type: "path", d: `M136 ${g.hip - 8} L100 ${g.hip - 8} L100 ${g.crotch + 6} Q120 ${g.crotch + 14} 134 ${butt + 12} Z` }], label: { x: 117, y: butt + 4 } },
    );
  }
  return shapes;
}

function Part({ part, region }) {
  // data-region tells the click handler which shape was tapped.
  if (part.type === "ellipse") return <ellipse data-region={region} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} />;
  if (part.type === "rect") {
    return <rect data-region={region} x={part.x} y={part.y} width={part.width} height={part.height} rx={part.rx} />;
  }
  return <path data-region={region} d={part.d} />;
}

/**
 * Props:
 *   variant    "adult" | "child"
 *   chart      the chosen chart (tbsaCharts.js): its areas and values
 *   marks      { areaId: { method, palms, touched } }
 *   activeId   area currently open in the side panel
 *   counted    false when the burn is 1st degree (shown, not counted)
 *   disabled   true until an age is entered
 *   onPick(areaId, shapeId)  called when a shape is tapped
 *              (shapeId is null when chosen with the keyboard)
 */
function BodyMap({ variant, chart, marks, activeId, counted, disabled, onPick }) {
  const g = SHAPES[variant];

  return (
    <div className={`body-map${disabled ? " is-disabled" : ""}${counted ? "" : " is-not-counted"}`}>
      {["front", "back"].map((view) => {
        const shapes = buildShapes(g, view, chart.id === "adult");
        // Group the shapes by the chart's areas (keeps the drawing order).
        const groups = [];
        for (const shape of shapes) {
          const area = chart.areaOf[shape.region];
          const group = groups.find((item) => item.area === area);
          if (group) group.shapes.push(shape);
          else groups.push({ area, shapes: [shape] });
        }

        return (
          <figure key={view} className="body-view">
            <svg viewBox="0 0 200 410" role="group" aria-label={`Body, ${view} view`}>
              <defs>
                {/* Dots = only part of the area is burned (palm method). */}
                <pattern id={`palm-dots-${view}`} width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" className="palm-dots-bg" />
                  <circle cx="3" cy="3" r="1.6" className="palm-dots-dot" />
                </pattern>
              </defs>

              {groups.map(({ area, shapes: parts }) => {
                const mark = marks[area.id];
                const state = mark ? (mark.method === "whole" ? "is-whole" : "is-palms") : "";
                const percent = formatPercent(area.value);

                return (
                  <g
                    key={area.id}
                    className={`body-region ${state}${activeId === area.id ? " is-active" : ""}`}
                    style={state === "is-palms" ? { "--palm-fill": `url(#palm-dots-${view})` } : undefined}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={`${area.label}, ${percent}%${mark ? ", marked" : ""}`}
                    aria-pressed={Boolean(mark)}
                    onClick={(event) => !disabled && onPick(area.id, event.target.dataset.region ?? null)}
                    onKeyDown={(event) => {
                      if (disabled) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onPick(area.id, null);
                      }
                    }}
                  >
                    <title>{`${area.label} — ${percent}%`}</title>
                    {parts.flatMap((shape) =>
                      shape.parts.map((part, index) => <Part key={`${shape.region}-${index}`} part={part} region={shape.region} />),
                    )}
                  </g>
                );
              })}

              {/* The % of every area, written once (like the paper chart). */}
              {shapes
                .filter((shape) => chart.areaOf[shape.region].labelAt === shape.region)
                .map((shape) => (
                  <text
                    key={`label-${shape.region}`}
                    x={shape.label.x}
                    y={shape.label.y}
                    className={`body-label${shape.small ? " is-small" : ""}`}
                    aria-hidden="true"
                  >
                    {formatPercent(chart.areaOf[shape.region].value)}
                  </text>
                ))}
            </svg>
            <figcaption>{view === "front" ? "Front" : "Back"}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export default BodyMap;