import { describe, expect, test } from "vitest";
import topology from "world-atlas/countries-50m.json";
import { toMapCountries } from "../map/countries";
import { focusBoundsByCountry, type PlaneBounds, WORLD_PLANE } from "../map/worldPlane";
import {
  focusCameraAt,
  interpolateCamera,
  MAX_FOCUS_ZOOM,
  MIN_FOCUS_ZOOM,
  planFocusTargets,
  targetCamera,
  worldCamera,
} from "./camera";
import { buildVisits } from "./visits";

const bounds = focusBoundsByCountry(toMapCountries(topology));
const boundsOf = (country: string) => bounds.get(country);
const world = worldCamera(480);

function boundsFor(country: string): PlaneBounds {
  const found = bounds.get(country);
  if (!found) {
    throw new Error(`${country} の範囲がない`);
  }
  return found;
}

describe("worldCamera", () => {
  test("世界全体を拡大せず、地図の上端をコマの mapTop に置く", () => {
    expect(world.k).toBe(1);
    expect(world.sy - world.y * world.k).toBeCloseTo(480);
    expect(world.sx - world.x * world.k).toBeCloseTo(0);
  });
});

describe("targetCamera", () => {
  test("国の範囲の中心を注視点にする", () => {
    const camera = targetCamera([
      [100, 200],
      [140, 230],
    ]);
    expect(camera).toMatchObject({ x: 120, y: 215 });
  });

  test("フランスに寄せると、本土の範囲がコマの横幅に収まる", () => {
    const camera = targetCamera(boundsFor("FR"));
    const [[x0], [x1]] = boundsFor("FR");
    const left = camera.sx + (x0 - camera.x) * camera.k;
    const right = camera.sx + (x1 - camera.x) * camera.k;
    expect(left).toBeGreaterThan(0);
    expect(right).toBeLessThan(1080);
    expect(camera.k).toBeGreaterThan(MIN_FOCUS_ZOOM);
  });

  test("極端に小さい国でも拡大率は上限まで、極端に大きい国でも下限まで", () => {
    expect(targetCamera(boundsFor("VA")).k).toBe(MAX_FOCUS_ZOOM);
    expect(targetCamera(boundsFor("RU")).k).toBe(MIN_FOCUS_ZOOM);
  });
});

describe("interpolateCamera", () => {
  const japan = targetCamera(boundsFor("JP"));
  const france = targetCamera(boundsFor("FR"));

  test("両端では移動元と移動先に一致する", () => {
    expect(interpolateCamera(japan, france, 0)).toEqual(japan);
    const end = interpolateCamera(japan, france, 1);
    expect(end.x).toBeCloseTo(france.x);
    expect(end.y).toBeCloseTo(france.y);
    expect(end.k).toBeCloseTo(france.k);
  });

  test("遠い移動では途中で引き、拡大率が両端より小さくなる", () => {
    const middle = interpolateCamera(japan, france, 0.5);
    expect(middle.k).toBeLessThan(Math.min(japan.k, france.k));
  });
});

describe("planFocusTargets", () => {
  test("日本からアメリカ合衆国へは、太平洋側（東向き）へ移る", () => {
    const visits = buildVisits([
      { year: 2024, country: "JP" },
      { year: 2024, country: "US" },
    ]);
    const [japan, usa] = planFocusTargets(visits, boundsOf, world);
    // 日本は東経 140 度付近、アメリカ本土は西経 100 度付近。東向きなら 1 周分ずらした x になり、日本より大きくなる
    expect(usa?.x ?? 0).toBeGreaterThan(japan?.x ?? 0);
    expect((usa?.x ?? 0) - (japan?.x ?? 0)).toBeLessThan(WORLD_PLANE.width / 2);
  });

  test("ヨーロッパの中では繰り返しをずらさない", () => {
    const visits = buildVisits([
      { year: 2024, country: "FR" },
      { year: 2024, country: "IT" },
    ]);
    const [france, italy] = planFocusTargets(visits, boundsOf, world);
    expect(france?.x).toBeCloseTo(targetCamera(boundsFor("FR")).x);
    expect(italy?.x).toBeCloseTo(targetCamera(boundsFor("IT")).x);
  });

  test("地図に形状のない国は前の位置のまま動かない", () => {
    const visits = buildVisits([
      { year: 2024, country: "FR" },
      { year: 2024, country: "ZZ" },
    ]);
    const [france, unknown] = planFocusTargets(visits, () => undefined, world);
    expect(france).toEqual(world);
    expect(unknown).toEqual(world);
    const [fr, zz] = planFocusTargets(visits, boundsOf, world);
    expect(zz).toEqual(fr);
  });
});

describe("focusCameraAt", () => {
  const visits = buildVisits([
    { year: 2024, country: "JP" },
    { year: 2024, country: "US" },
  ]);
  const targets = planFocusTargets(visits, boundsOf, world);

  test("最初の訪問は世界全体から寄り、移動が終わると寄せた先になる", () => {
    expect(focusCameraAt(targets, world, { kind: "visit", index: 0, elapsed: 0 })).toEqual(world);
    expect(focusCameraAt(targets, world, { kind: "visit", index: 0, elapsed: 1 })).toMatchObject({
      k: targets[0]?.k,
    });
  });

  test("まとめでは最後の国から世界全体まで引き、遠回りしない", () => {
    const end = focusCameraAt(targets, world, { kind: "summary", elapsed: 1 });
    expect(end.k).toBe(1);
    // 世界全体は 1 周ずらした位置でも同じ絵になる。最後の国の近くの繰り返しを選ぶ
    expect(Math.abs(end.x - (targets[1]?.x ?? 0))).toBeLessThanOrEqual(WORLD_PLANE.width / 2);
    expect(Math.abs((end.x - world.x) % WORLD_PLANE.width)).toBeCloseTo(0);
  });
});
