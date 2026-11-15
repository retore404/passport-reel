import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { UNRECOGNIZED_STATES } from "../records/unrecognizedStates";
import { REGION_BOUNDARIES } from "./regionBoundaries";

/** 地図上の1つの国（または国コードを持たない地域）の形状。 */
export type MapCountry = {
  /**
   * ISO 3166-1 alpha-2、または国として扱う ISO 3166-1 にない地域の ID（XK など）。
   * ISO 3166-1 numeric を持たず、その地域にも当たらない形状（Siachen Glacier など）では undefined になり、どの訪問国とも一致しない。
   */
  readonly alpha2: string | undefined;
  readonly feature: Feature;
};

type CountriesTopology = Topology<{ countries: GeometryCollection }>;

/** 経緯度の範囲 [西端, 南端, 東端, 北端]。 */
type Bounds = readonly [number, number, number, number];

/**
 * 国境データで親国の形状に含まれている海外領土と、その島々がある範囲。
 * world-atlas には海外領土単独の形状がないため、範囲内の島を親国から切り出して海外領土のコードで扱う。
 * 範囲は親国の島どうしを分けられれば足りるので、おおまかに取っている。
 */
const OVERSEAS_TERRITORIES: Readonly<
  Record<string, readonly { alpha2: string; bounds: readonly Bounds[] }[]>
> = {
  FR: [
    { alpha2: "GF", bounds: [[-55, 2, -51, 6]] },
    { alpha2: "GP", bounds: [[-62, 15.8, -60.8, 16.6]] },
    { alpha2: "MQ", bounds: [[-61.5, 14.2, -60.5, 15]] },
    { alpha2: "YT", bounds: [[44, -13.5, 46, -12]] },
    { alpha2: "RE", bounds: [[55, -22, 56, -20.5]] },
  ],
  NO: [
    {
      alpha2: "SJ",
      bounds: [
        // ヤンマイエン島
        [-10, 70, -7, 72],
        // スヴァールバル諸島（ベア島を含む）
        [10, 74, 35, 81],
      ],
    },
  ],
  NL: [{ alpha2: "BQ", bounds: [[-69, 12, -62, 18]] }],
};

function contains(
  [west, south, east, north]: Bounds,
  [lon = Number.NaN, lat = Number.NaN]: Position,
) {
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

/** 親国の形状を、海外領土ごとの形状と親国に残る形状に分ける。 */
function splitOverseasTerritories(alpha2: string, countryFeature: Feature): MapCountry[] {
  const territories = OVERSEAS_TERRITORIES[alpha2];
  const geometry = countryFeature.geometry;
  if (territories === undefined || geometry.type !== "MultiPolygon") {
    return [{ alpha2, feature: countryFeature }];
  }
  const polygonsByCode = new Map<string, Position[][][]>([[alpha2, []]]);
  for (const polygon of geometry.coordinates) {
    // 島は範囲の境界をまたがないので、外周の最初の点だけで判定する
    const firstPoint = polygon[0]?.[0];
    const code =
      territories.find(
        ({ bounds }) => firstPoint !== undefined && bounds.some((b) => contains(b, firstPoint)),
      )?.alpha2 ?? alpha2;
    polygonsByCode.set(code, [...(polygonsByCode.get(code) ?? []), polygon]);
  }
  return [...polygonsByCode].map(([code, coordinates]) => ({
    alpha2: code,
    feature: {
      ...countryFeature,
      // 親国の id や名前を海外領土に引き継がない
      ...(code === alpha2 ? {} : { id: undefined, properties: {} }),
      geometry: { type: "MultiPolygon", coordinates },
    },
  }));
}

/** 親国の alpha-2 ごとの、その形状から境界線で分ける地域の ID。 */
const splitRegionCodesByParent = new Map<string, string[]>();
for (const { code, mapShape } of UNRECOGNIZED_STATES) {
  if (mapShape.kind === "split") {
    splitRegionCodesByParent.set(mapShape.parent, [
      ...(splitRegionCodesByParent.get(mapShape.parent) ?? []),
      code,
    ]);
  }
}

function samePosition(a: Position, b: Position | undefined) {
  return b !== undefined && a[0] === b[0] && a[1] === b[1];
}

/**
 * 閉じた外周を境界線で2つに分け、[地域の外周, 残りの外周] を返す。境界線の両端が外周にちょうど1回ずつなければ undefined。
 * 地域は「外周を境界線の終点から始点まで順にたどった区間」と「境界線（始点から終点）」で囲まれる（map/regionBoundaries.ts）。
 * d3-geo は外周の向きで内側を決めるため、どちらの外周も元の外周と同じ向きにたどる。
 */
function splitRing(
  ring: readonly Position[],
  line: readonly Position[],
): [Position[], Position[]] | undefined {
  const [start, ...rest] = line;
  const end = rest.pop();
  if (start === undefined || end === undefined) {
    return undefined;
  }
  // 閉じた外周は最後の点が最初の点と同じなので除く
  const points = ring.slice(0, -1);
  const indexOf = (target: Position) => {
    const found = points.flatMap((p, i) => (samePosition(target, p) ? [i] : []));
    return found.length === 1 ? found[0] : undefined;
  };
  const i = indexOf(start);
  const j = indexOf(end);
  if (i === undefined || j === undefined || i === j) {
    return undefined;
  }
  /** 外周を from から to まで順にたどった点（両端を含む）。 */
  const arc = (from: number, to: number) => {
    const length = (to - from + points.length) % points.length;
    return Array.from(
      { length: length + 1 },
      (_, k) => points[(from + k) % points.length] ?? [Number.NaN, Number.NaN],
    );
  };
  const close = (open: Position[]) => [...open, open[0] ?? [Number.NaN, Number.NaN]];
  return [close([...arc(j, i), ...rest]), close([...arc(i, j), ...rest.toReversed()])];
}

/** 形状を境界線で分け、[地域の形状, 残りの形状] を返す。境界線の両端を外周に持つポリゴンがなければ undefined。 */
function splitGeometry(
  geometry: Geometry,
  line: readonly Position[],
): [Polygon, Polygon | MultiPolygon] | undefined {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  for (const [index, [outer = [], ...holes]] of polygons.entries()) {
    const rings = splitRing(outer, line);
    if (rings !== undefined) {
      const [regionRing, restRing] = rings;
      // 分ける対象の親国（GE・MD）のポリゴンには穴がない。穴があれば残りの側に付けたままにする
      const restPolygon = [restRing, ...holes];
      const restPolygons = polygons.map((p, k) => (k === index ? restPolygon : p));
      return [
        { type: "Polygon", coordinates: [regionRing] },
        geometry.type === "Polygon"
          ? { type: "Polygon", coordinates: restPolygon }
          : { type: "MultiPolygon", coordinates: restPolygons },
      ];
    }
  }
  return undefined;
}

/**
 * 親国の形状に含まれている「国として扱う ISO 3166-1 にない地域」を、境界線で親国から分ける。
 * 境界線の両端が見つからない地域（world-atlas の更新などで国境が変わった場合）は分けず、親国の形状をそのまま残す。
 */
function splitEnclosedRegions(alpha2: string, countryFeature: Feature): MapCountry[] {
  let parent = countryFeature;
  const regions: MapCountry[] = [];
  for (const code of splitRegionCodesByParent.get(alpha2) ?? []) {
    const line = REGION_BOUNDARIES[code];
    const split = line === undefined ? undefined : splitGeometry(parent.geometry, line);
    if (split !== undefined) {
      const [regionGeometry, restGeometry] = split;
      // 親国の id や名前を地域に引き継がない
      regions.push({
        alpha2: code,
        feature: { ...countryFeature, id: undefined, properties: {}, geometry: regionGeometry },
      });
      parent = { ...parent, geometry: restGeometry };
    }
  }
  return [{ alpha2, feature: parent }, ...regions];
}

const unrecognizedCodeByMapName = new Map(
  UNRECOGNIZED_STATES.flatMap(({ code, mapShape }) =>
    mapShape.kind === "feature" ? [[mapShape.name, code] as const] : [],
  ),
);

/** 形状の名前が国として扱う ISO 3166-1 にない地域に当たれば、その ID を返す。 */
function unrecognizedCode(countryFeature: Feature): string | undefined {
  const name: unknown = countryFeature.properties?.["name"];
  return typeof name === "string" ? unrecognizedCodeByMapName.get(name) : undefined;
}

/**
 * world-atlas の TopoJSON（id は ISO 3166-1 numeric）を、alpha-2 で識別する国の一覧に変換する。
 * id のない形状は、国として扱う ISO 3166-1 にない地域の名前に一致すればその ID で識別する。
 * id のある国の扱いを変えないよう、名前での照合は id のない形状に限る。
 * 親国の形状に含まれる海外領土と ISO 3166-1 にない地域は、親国から分けて別の国として扱う。
 */
export function toMapCountries(topology: CountriesTopology): MapCountry[] {
  return feature(topology, topology.objects.countries).features.flatMap(
    (countryFeature): MapCountry[] => {
      const alpha2 =
        countryFeature.id === undefined
          ? unrecognizedCode(countryFeature)
          : numericToAlpha2(countryFeature.id);
      return alpha2 === undefined
        ? [{ alpha2, feature: countryFeature }]
        : splitOverseasTerritories(alpha2, countryFeature).flatMap((country) =>
            country.alpha2 === undefined
              ? [country]
              : splitEnclosedRegions(country.alpha2, country.feature),
          );
    },
  );
}

/**
 * 国境データを読み込む。
 * 小さな国の形状まで含む 50m 解像度を使う。約 750KB あるため動的 import で初期バンドルから分離する。
 */
export async function loadMapCountries(): Promise<MapCountry[]> {
  const { default: topology } = await import("world-atlas/countries-50m.json");
  return toMapCountries(topology);
}

/** 地図の国が訪問済みかを判定する。地図に対応しない訪問国コードは単に一致しないだけで無視される。 */
export function isVisited(country: MapCountry, visited: ReadonlySet<string>): boolean {
  return country.alpha2 !== undefined && visited.has(country.alpha2);
}
