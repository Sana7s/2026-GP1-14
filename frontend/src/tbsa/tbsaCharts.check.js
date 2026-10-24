/* TBSA rule checks. Run from the frontend folder:  node src/tbsa/tbsaCharts.check.js */
import { CHARTS, REGIONS, chooseChart, calculateTbsa, formatPercent, maxPalms } from "./tbsaCharts.js";
let ok = true;
const check = (name, cond) => { ok &&= !!cond; console.log((cond ? "PASS " : "FAIL ") + name); };
const v = (c, ...ids) => ids.reduce((t, id) => t + c.areaById[id].value, 0);

// 1. Every chart adds up to 100% and covers every shape exactly once.
check("35 shapes on the body map", REGIONS.length === 35);
for (const c of Object.values(CHARTS)) {
  const sum = c.areas.reduce((t, a) => t + a.value, 0);
  check(`${c.label} adds up to 100 (got ${sum})`, Math.abs(sum - 100) < 1e-9);
  const used = c.areas.flatMap((a) => a.regions);
  check(`${c.label} uses every shape once`, used.length === 35 && REGIONS.every((r) => used.includes(r.id)));
}

// 2. Lund and Browder table (whole-body values, front + back).
const LB = [["lbUnder1", 19, 5.5, 5], ["lb1to4", 17, 6.5, 5], ["lb5to9", 13, 8, 5.5], ["lb10to14", 11, 8.5, 6], ["lb15", 9, 9, 6.5]];
for (const [id, head, thigh, leg] of LB) {
  const c = CHARTS[id];
  check(`${id}: head ${head}, one thigh ${thigh}, one lower leg ${leg}`,
    v(c, "headFront", "headBack") === head && v(c, "rightThighFront", "rightThighBack") === thigh &&
    v(c, "rightLowerLegFront", "rightLowerLegBack") === leg);
  check(`${id}: neck 2, trunk 13 + 13, buttocks 5, genitals 1, hand 2½, foot 3½`,
    v(c, "neckFront", "neckBack") === 2 && v(c, "chest", "abdomen") === 13 && v(c, "upperBack", "lowerBack") === 13 &&
    v(c, "rightButtock", "leftButtock") === 5 && v(c, "genitals") === 1 &&
    v(c, "rightHandFront", "rightHandBack") === 2.5 && v(c, "rightFootFront", "rightFootBack") === 3.5);
}

// 3. Rule of Nines: only the textbook areas.
const A = CHARTS.adult;
check("adult: 15 areas", A.areas.length === 15);
check("adult: head & neck 9", v(A, "headFront", "headBack") === 9);
check("adult: each arm 9", v(A, "rightArmFront", "rightArmBack") === 9 && v(A, "leftArmFront", "leftArmBack") === 9);
check("adult: each leg 18", v(A, "rightLegFront", "rightLegBack") === 18 && v(A, "leftLegFront", "leftLegBack") === 18);
check("adult: front trunk 18, back trunk 18, perineum 1", v(A, "chest", "abdomen") === 18 && v(A, "upperBack", "lowerBack") === 18 && v(A, "genitals") === 1);
check("adult: forearm shape belongs to the arm area", A.areaOf.rightForearmFront.id === "rightArmFront");
check("adult: buttocks belong to lower back", A.areaOf.leftButtock.id === "lowerBack");
check("adult: every value is a Rule of Nines value", A.areas.every((a) => [1, 4.5, 9].includes(a.value)));

// 4. Choosing the chart by age.
const cases = [[0,"lbUnder1"],[0.5,"lbUnder1"],[1,"lb1to4"],[4.9,"lb1to4"],[5,"lb5to9"],[9.9,"lb5to9"],[10,"lb10to14"],[14.9,"lb10to14"],[15,"lb15"],[15.99,"lb15"],[16,"adult"],[80,"adult"]];
for (const [age, id] of cases) check(`age ${age} -> ${id}`, chooseChart(age).id === id);

// 5. Calculating.
let r = calculateTbsa(A, { chest: { method: "whole" }, rightLegFront: { method: "palms", palms: 3 } }, 2);
check("adult chest + 3 palms on leg = 12%", r.total === 12);
r = calculateTbsa(A, { rightArmFront: { method: "whole" } }, 2);
check("adult whole front of right arm = 4.5% and includes the hand", r.total === 4.5 && r.specialAreas.includes("Hands"));
r = calculateTbsa(A, { rightArmFront: { method: "palms", palms: 2, touched: ["rightForearmFront"] } }, 2);
check("adult 2 palms on the forearm: not a hand burn", r.total === 2 && r.specialAreas.length === 0);
r = calculateTbsa(A, { rightArmFront: { method: "palms", palms: 1, touched: ["rightHandFront"] } }, 2);
check("adult 1 palm on the hand: hand burn", r.specialAreas.includes("Hands"));
check("adult arm side max 4 palms", maxPalms(A, "rightArmFront") === 4);
r = calculateTbsa(chooseChart(3), { leftThighFront: { method: "whole" }, leftLowerLegFront: { method: "whole" } }, 2);
check("3-year-old, front of left thigh + lower leg = 5.75%", r.total === 5.75);
r = calculateTbsa(A, { chest: { method: "whole" } }, 1);
check("1st degree not counted (0%)", r.total === 0 && r.counted === false && r.breakdown.length === 1);
r = calculateTbsa(A, { chest: { method: "whole" } }, null);
check("unknown depth is counted (safer) = 9%", r.total === 9 && r.counted === true);
for (const c of [A, CHARTS.lbUnder1]) {
  const all = Object.fromEntries(c.areas.map((a) => [a.id, { method: "whole" }]));
  check(`everything marked = 100% (${c.id})`, calculateTbsa(c, all, 3).total === 100);
}
r = calculateTbsa(A, { chest: { method: "palms", palms: 30 } }, 2);
check("palms above the cap are clamped (30 -> 9)", r.total === 9);

// 6. Labels like the paper chart.
check("formatPercent", formatPercent(1.25) === "1¼" && formatPercent(4.5) === "4½" && formatPercent(0.75) === "¾" && formatPercent(9) === "9");

console.log(ok ? "ALL PASSED" : "SOME FAILED");
if (!ok) globalThis.process?.exit(1); // fail with an error code