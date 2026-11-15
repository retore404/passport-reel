import type { Feature, Polygon } from "geojson";
import { geoPath } from "d3-geo";
import type { MapCountry } from "./countries";
import { createProjection, MAP_ASPECT_RATIO, type MapSize } from "./drawWorldMap";

/**
 * 1 か国ずつの表示で地図を寄せるときの座標系（世界座標）。
 * 年ごとの表示の地図と同じ投影で、世界全体を幅 1080 に収めた平面。横方向は幅 WORLD_PLANE.width で繰り返すとみなす。
 */
export const WORLD_PLANE: MapSize = { width: 1080, height: 1080 / MAP_ASPECT_RATIO };

/** 世界座標の外接矩形 [[西, 北], [東, 南]]（y は下向き）。 */
export type PlaneBounds = readonly [readonly [number, number], readonly [number, number]];

export function createPlanePath(): ReturnType<typeof geoPath> {
  return geoPath(createProjection(WORLD_PLANE));
}

function polygonsOf(countryFeature: Feature): Feature[] {
  const { geometry } = countryFeature;
  if (geometry.type !== "MultiPolygon") {
    return [countryFeature];
  }
  return geometry.coordinates.map((coordinates): Feature<Polygon> => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates },
  }));
}

/**
 * 国ごとに、地図を寄せるときに収める範囲（世界座標）を求める。
 * 国の本体（投影後の面積が最も大きいポリゴン）の外接矩形を使い、飛び地や離島に引きずられないようにする
 * （例：アメリカ合衆国はアラスカ・ハワイではなく本土、フランスは本土）。
 * 同じ国の形状が複数に分かれていても（例：AU の本土と小さな諸島）、すべての形状から最大のポリゴンを選ぶ。
 */
export function focusBoundsByCountry(
  countries: readonly MapCountry[],
): ReadonlyMap<string, PlaneBounds> {
  const path = createPlanePath();
  const largest = new Map<string, { readonly area: number; readonly polygon: Feature }>();
  for (const { alpha2, feature } of countries) {
    if (alpha2 === undefined) {
      continue;
    }
    for (const polygon of polygonsOf(feature)) {
      const area = path.area(polygon);
      if (area > (largest.get(alpha2)?.area ?? -1)) {
        largest.set(alpha2, { area, polygon });
      }
    }
  }
  return new Map(
    [...largest].map(([alpha2, { polygon }]) => {
      const [[x0, y0], [x1, y1]] = path.bounds(polygon);
      return [
        alpha2,
        [
          [x0, y0],
          [x1, y1],
        ] as const,
      ];
    }),
  );
}
