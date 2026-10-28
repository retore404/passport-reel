import { describe, expect, test } from "vitest";
import topology from "world-atlas/countries-50m.json";
import { toMapCountries } from "./countries";
import {
  drawWorldMap,
  MAP_ASPECT_RATIO,
  MAP_COLORS,
  type MapContext,
  planWorldMap,
} from "./drawWorldMap";

const countries = toMapCountries(topology);
const size = { width: 1000, height: 1000 / MAP_ASPECT_RATIO };

function markerOf(plan: ReturnType<typeof planWorldMap>, alpha2: string) {
  const marker = plan.markers.find((m) => m.alpha2 === alpha2);
  if (!marker) {
    throw new Error(`${alpha2} のマーカーがない`);
  }
  return marker;
}

function colorOf(plan: ReturnType<typeof planWorldMap>, alpha2: string) {
  return plan.fills.find((f) => f.country.alpha2 === alpha2)?.color;
}

/** fill/arc の呼び出しをその時点の fillStyle とともに記録するフェイクのコンテキスト。 */
function createRecordingContext() {
  const fills: MapContext["fillStyle"][] = [];
  const arcs: { x: number; y: number }[] = [];
  const ctx: MapContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    arc: (x, y) => {
      arcs.push({ x, y });
    },
    fill: () => {
      fills.push(ctx.fillStyle);
    },
  };
  return { ctx, fills, arcs };
}

describe("planWorldMap", () => {
  test("訪問国はハイライト色、それ以外は未訪問色で塗られる", () => {
    const plan = planWorldMap(size, countries, new Set(["JP", "FR"]));
    expect(colorOf(plan, "JP")).toBe(MAP_COLORS.visited);
    expect(colorOf(plan, "FR")).toBe(MAP_COLORS.visited);
    expect(colorOf(plan, "US")).toBe(MAP_COLORS.unvisited);
  });

  test("訪問国が空ならすべて未訪問色で塗られる", () => {
    const plan = planWorldMap(size, countries, new Set());
    expect(plan.fills.every((f) => f.color === MAP_COLORS.unvisited)).toBe(true);
    expect(plan.markers).toHaveLength(0);
  });

  test("小さな訪問国にはマーカーが出て、大きな訪問国には出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["SG", "FR"]));
    expect(plan.markers.map((m) => m.alpha2)).toEqual(["SG"]);
  });

  test("大きな国に属する小さな離島の形状にはマーカーが出ない（AU とアシュモア・カルティエ諸島）", () => {
    const plan = planWorldMap(size, countries, new Set(["AU"]));
    expect(plan.markers).toHaveLength(0);
  });

  test("南極は表示範囲の端で切られても、訪問済みならハイライトされマーカーは出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["AQ"]));
    expect(colorOf(plan, "AQ")).toBe(MAP_COLORS.visited);
    expect(plan.markers).toHaveLength(0);
  });

  test("未訪問の小さな国にはマーカーが出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["FR"]));
    expect(plan.markers.find((m) => m.alpha2 === "SG")).toBeUndefined();
  });

  test("マーカーは国の位置に置かれる（シンガポールは日本より西・南）", () => {
    const plan = planWorldMap(size, countries, new Set(["SG", "VA"]));
    const sg = markerOf(plan, "SG");
    const va = markerOf(plan, "VA");
    // バチカン（ヨーロッパ）はシンガポールより西かつ北にある
    expect(va.x).toBeLessThan(sg.x);
    expect(va.y).toBeLessThan(sg.y);
  });

  test("地図に対応しないコードが混在しても、対応する国はハイライトされる", () => {
    const plan = planWorldMap(size, countries, new Set(["JP", "XK", "ZZ"]));
    expect(colorOf(plan, "JP")).toBe(MAP_COLORS.visited);
  });
});

describe("drawWorldMap", () => {
  test("計画どおりの色で各国を塗り、小さな訪問国にマーカーを描く", () => {
    const visited = new Set(["JP", "SG"]);
    const plan = planWorldMap(size, countries, visited);
    const { ctx, fills, arcs } = createRecordingContext();

    drawWorldMap(ctx, size, countries, visited);

    // 海 → 各国 → マーカーの順に塗られる
    expect(fills).toEqual([
      MAP_COLORS.ocean,
      ...plan.fills.map((f) => f.color),
      ...plan.markers.map(() => MAP_COLORS.marker),
    ]);
    const sg = markerOf(plan, "SG");
    expect(arcs).toEqual([{ x: sg.x, y: sg.y }]);
  });
});
