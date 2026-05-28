/**
 * Build the grouped option list for the cite-only manual-entry county picker.
 *
 * For a project with regionCodes like ["US-IN", "US-IL", "CA-ON"], returns:
 *   [
 *     { group: "Indiana",   options: [{value: "18001", label: "Adams County"}, …] },
 *     { group: "Illinois",  options: [{value: "17001", label: "Adams County"}, …] },
 *     { group: "Ontario",   options: [{value: "CA-ON", label: "Ontario (province)"}] },
 *   ]
 *
 * US-XX codes expand into per-county options. CA-XX codes are single
 * province-level options since census divisions are out of scope.
 */

import {
  CA_PROVINCES,
  US_COUNTIES,
  US_STATES_BY_CODE,
} from "./regions.generated";

export interface PickerOption {
  value: string; // 5-digit FIPS for US counties; "CA-XX" for CA provinces
  label: string;
}

export interface PickerGroup {
  group: string; // state or province name
  options: ReadonlyArray<PickerOption>;
}

export function pickerOptionsForRegions(
  regionCodes: ReadonlyArray<string>,
): ReadonlyArray<PickerGroup> {
  const groups: PickerGroup[] = [];

  // US states → list of counties, alphabetical.
  const usCodes = regionCodes.filter((c) => c.startsWith("US-"));
  for (const stateCode of usCodes) {
    const stateName = US_STATES_BY_CODE[stateCode]?.name;
    if (!stateName) continue;
    const counties = Object.entries(US_COUNTIES)
      .filter(([, c]) => c.stateCode === stateCode)
      .map(([fips, c]) => ({ value: fips, label: `${c.name} County` }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (counties.length > 0) {
      groups.push({ group: stateName, options: counties });
    }
  }

  // CA provinces → single province-level option each.
  const caCodes = regionCodes.filter((c) => c.startsWith("CA-"));
  for (const code of caCodes) {
    const name = CA_PROVINCES[code]?.name;
    if (!name) continue;
    groups.push({
      group: name,
      options: [{ value: code, label: `${name} (province)` }],
    });
  }

  return groups;
}
