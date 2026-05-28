/**
 * Verify Canadian province reverse-geocoding end to end.
 */

import { reverseGeocode } from "../src/lib/geo/reverse-geocode";
import { countyLabel } from "../src/lib/insectid/regions";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(actual)}`);
  if (!ok) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    process.exit(1);
  }
}

// Toronto, ON — ~43.65°N, -79.38°E
const toronto = reverseGeocode(-79.38, 43.65, ["CA-ON"]);
check("Toronto in CA-ON project", toronto, {
  countyFips: "CA-ON",
  countyName: "Ontario",
  stateCode: "CA-ON",
});

// Montreal, QC — ~45.50°N, -73.57°E. Province name varies by source
// (Quebec vs Québec); accept either.
const montreal = reverseGeocode(-73.57, 45.50, ["CA-QC"]);
const montrealOk =
  montreal?.countyFips === "CA-QC" &&
  /Qu[eé]bec/.test(montreal?.countyName ?? "");
console.log(
  `${montrealOk ? "✓" : "✗"} Montreal in CA-QC project: ${JSON.stringify(montreal)}`,
);
if (!montrealOk) process.exit(1);

// Toronto in a mixed project (US-NY + CA-ON) should still resolve.
const mixed = reverseGeocode(-79.38, 43.65, ["US-NY", "CA-ON"]);
check("Toronto in US-NY + CA-ON project", mixed, {
  countyFips: "CA-ON",
  countyName: "Ontario",
  stateCode: "CA-ON",
});

// Albany, NY — ~42.65°N, -73.76°E — in NY but project is CA-ON only → null.
const out = reverseGeocode(-73.76, 42.65, ["CA-ON"]);
check("Albany NY in CA-ON-only project → null", out, null);

// countyLabel for CA codes
check("countyLabel CA-ON", countyLabel("CA-ON"), "Ontario, ON");
const qcLabel = countyLabel("CA-QC");
const qcOk = qcLabel === "Quebec, QC" || qcLabel === "Québec, QC";
console.log(`${qcOk ? "✓" : "✗"} countyLabel CA-QC: ${qcLabel}`);
if (!qcOk) process.exit(1);
check("countyLabel 18001", countyLabel("18001"), "Adams County, IN");

console.log("[smoke] CA reverse-geocode + countyLabel ok");
