import type { Feature, Position } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/** 地図上の1つの国（または国コードを持たない地域）の形状。 */
export type MapCountry = {
  /**
   * ISO 3166-1 alpha-2。
   * Kosovo など ISO 3166-1 numeric を持たない形状では undefined になり、どの訪問国とも一致しない。
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

/** world-atlas の TopoJSON（id は ISO 3166-1 numeric）を、alpha-2 で識別する国の一覧に変換する。 */
export function toMapCountries(topology: CountriesTopology): MapCountry[] {
  return feature(topology, topology.objects.countries).features.flatMap(
    (countryFeature): MapCountry[] => {
      const alpha2 =
        countryFeature.id === undefined ? undefined : numericToAlpha2(countryFeature.id);
      return alpha2 === undefined
        ? [{ alpha2, feature: countryFeature }]
        : splitOverseasTerritories(alpha2, countryFeature);
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
