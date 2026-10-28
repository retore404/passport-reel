import type { Feature } from "geojson";
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

/** world-atlas の TopoJSON（id は ISO 3166-1 numeric）を、alpha-2 で識別する国の一覧に変換する。 */
export function toMapCountries(topology: CountriesTopology): MapCountry[] {
  return feature(topology, topology.objects.countries).features.map((countryFeature) => ({
    alpha2: countryFeature.id === undefined ? undefined : numericToAlpha2(countryFeature.id),
    feature: countryFeature,
  }));
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
