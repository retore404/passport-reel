import { describe, expect, test } from "vitest";
import topology from "world-atlas/countries-50m.json";
import { toMapCountries } from "./countries";
import { focusBoundsByCountry, WORLD_PLANE } from "./worldPlane";

const bounds = focusBoundsByCountry(toMapCountries(topology));

/** 経度を世界座標の x に変える（メルカトル図法なので x は経度に比例する）。 */
function xOf(longitude: number): number {
  return ((longitude + 180) / 360) * WORLD_PLANE.width;
}

describe("focusBoundsByCountry", () => {
  test("フランスは本土の範囲になり、南米のフランス領ギアナやカリブ海の島を含まない", () => {
    const [[x0], [x1]] = bounds.get("FR") ?? [
      [0, 0],
      [0, 0],
    ];
    // 本土はおおよそ西経 5 度〜東経 10 度
    expect(x0).toBeGreaterThan(xOf(-6));
    expect(x1).toBeLessThan(xOf(10));
  });

  test("アメリカ合衆国は本土の範囲になり、アラスカやハワイを含まない", () => {
    const [[x0], [x1]] = bounds.get("US") ?? [
      [0, 0],
      [0, 0],
    ];
    expect(x0).toBeGreaterThan(xOf(-126));
    expect(x1).toBeLessThan(xOf(-66));
  });

  test("形状に国コードのない地域は含まない", () => {
    expect([...bounds.keys()].every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });
});
