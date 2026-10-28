import type { Feature, Polygon } from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import { isVisited, type MapCountry } from "./countries";

/** 描画関数が使う Canvas 2D コンテキストの機能。テストでは記録用のフェイクを渡す。 */
export type MapContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "fillRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "arc"
  | "closePath"
  | "fill"
  | "stroke"
>;

export type MapSize = { readonly width: number; readonly height: number };

export const MAP_COLORS = {
  background: "#0f172a",
  ocean: "#1e293b",
  unvisited: "#475569",
  visited: "#f59e0b",
  border: "#0f172a",
  marker: "#f59e0b",
} as const;

/**
 * 投影後の面積（px²）がこれ未満の訪問国にはマーカーを描く。
 * 固定の国リストではなく表示サイズに対する面積で判定し、Canvas のサイズが変わっても「見えにくい国」を拾えるようにする。
 */
const SMALL_COUNTRY_AREA_THRESHOLD = 30;

type MapMarker = { readonly alpha2: string; readonly x: number; readonly y: number };

export type WorldMapPlan = {
  readonly fills: readonly { readonly country: MapCountry; readonly color: string }[];
  readonly markers: readonly MapMarker[];
};

/**
 * 表示する緯度の範囲。メルカトル図法は極に近づくほど無限に引き伸ばされるため上下を切る。
 * 北はグリーンランド北端まで含める。南は南極を沿岸部だけ残し、AQ を訪問済みにしたときのハイライトが見えるようにする。
 */
const NORTH_LIMIT = 84;
const SOUTH_LIMIT = -70;

function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
}

/** 表示範囲の横:縦の比。地図を歪ませずに収める Canvas の大きさを決めるのに使う。 */
export const MAP_ASPECT_RATIO = (2 * Math.PI) / (mercatorY(NORTH_LIMIT) - mercatorY(SOUTH_LIMIT));

function createProjection(size: MapSize) {
  return geoMercator()
    .fitSize([size.width, size.height], {
      type: "MultiPoint",
      coordinates: [
        [-180, NORTH_LIMIT],
        [180, SOUTH_LIMIT],
      ],
    })
    .clipExtent([
      [0, 0],
      [size.width, size.height],
    ]);
}

/** 複数のポリゴンからなる国は、最大のポリゴンの重心を使う（飛び地にマーカーが寄らないようにする）。 */
function markerPosition(
  path: ReturnType<typeof geoPath>,
  countryFeature: Feature,
): [number, number] {
  const geometry = countryFeature.geometry;
  if (geometry.type !== "MultiPolygon") {
    return path.centroid(countryFeature);
  }
  const polygons = geometry.coordinates.map((coordinates): Polygon => ({
    type: "Polygon",
    coordinates,
  }));
  const largest = polygons.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
  return path.centroid(largest);
}

/** 訪問国の集合から、各国の塗り色とマーカーの位置を決める。 */
export function planWorldMap(
  size: MapSize,
  countries: readonly MapCountry[],
  visited: ReadonlySet<string>,
): WorldMapPlan {
  const path = geoPath(createProjection(size));
  const fills = countries.map((country) => ({
    country,
    color: isVisited(country, visited) ? MAP_COLORS.visited : MAP_COLORS.unvisited,
  }));
  // 国境データには同じ国の形状が別々に入っていることがある（例: AU の本土とアシュモア・カルティエ諸島）。
  // 「国として見えにくいか」で判定するため、国ごとに形状をまとめて面積を合算する。
  const visitedFeatures = new Map<string, Feature[]>();
  for (const country of countries) {
    if (country.alpha2 !== undefined && isVisited(country, visited)) {
      visitedFeatures.set(country.alpha2, [
        ...(visitedFeatures.get(country.alpha2) ?? []),
        country.feature,
      ]);
    }
  }
  const markers = [...visitedFeatures].flatMap(([alpha2, features]): MapMarker[] => {
    const totalArea = features.reduce((sum, f) => sum + path.area(f), 0);
    if (totalArea >= SMALL_COUNTRY_AREA_THRESHOLD) {
      return [];
    }
    const largest = features.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
    const [x, y] = markerPosition(path, largest);
    return [{ alpha2, x, y }];
  });
  return { fills, markers };
}

/**
 * 平面の世界地図を描く。
 * 後続のアニメーション・動画書き出しで「時刻 t のフレーム」を確定的に描くため、非同期処理や DOM に依存せず同期的に描き切る。
 */
export function drawWorldMap(
  ctx: MapContext,
  size: MapSize,
  countries: readonly MapCountry[],
  visited: ReadonlySet<string>,
): void {
  const path = geoPath(createProjection(size), ctx);
  const plan = planWorldMap(size, countries, visited);

  ctx.fillStyle = MAP_COLORS.background;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = MAP_COLORS.ocean;
  ctx.fill();

  ctx.strokeStyle = MAP_COLORS.border;
  ctx.lineWidth = 0.5;
  for (const { country, color } of plan.fills) {
    ctx.beginPath();
    path(country.feature);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  const markerRadius = Math.max(2, size.width / 400);
  ctx.fillStyle = MAP_COLORS.marker;
  ctx.strokeStyle = MAP_COLORS.background;
  ctx.lineWidth = markerRadius / 2;
  for (const marker of plan.markers) {
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, markerRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
}
