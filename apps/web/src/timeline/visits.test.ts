import { describe, expect, test } from "vitest";
import { buildVisits } from "./visits";

describe("buildVisits", () => {
  test("年の古い順、同じ年の中は訪問順（記録の並び）に並ぶ", () => {
    const visits = buildVisits([
      { year: 2019, country: "IT" },
      { year: 2016, country: "KR" },
      { year: 2019, country: "FR" },
    ]);
    expect(visits.map((v) => v.country)).toEqual(["KR", "IT", "FR"]);
  });

  test("再訪も 1 件の訪問として含み、連番は数えず、累計は増えない", () => {
    const visits = buildVisits([
      { year: 2016, country: "KR" },
      { year: 2019, country: "KR" },
      { year: 2019, country: "FR" },
    ]);
    expect(visits).toEqual([
      { year: 2016, country: "KR", ordinal: 1, before: 0, after: 1 },
      { year: 2019, country: "KR", ordinal: undefined, before: 1, after: 1 },
      { year: 2019, country: "FR", ordinal: 2, before: 1, after: 2 },
    ]);
  });

  test("記録がなければ訪問もない", () => {
    expect(buildVisits([])).toEqual([]);
  });
});
