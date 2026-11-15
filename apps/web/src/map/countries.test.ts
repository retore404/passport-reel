import { describe, expect, test } from "vitest";
import topology from "world-atlas/countries-50m.json";
import { UNRECOGNIZED_STATES } from "../records/unrecognizedStates";
import { isVisited, toMapCountries } from "./countries";

const countries = toMapCountries(topology);

function findByName(name: string) {
  const country = countries.find((c) => c.feature.properties?.["name"] === name);
  if (!country) {
    throw new Error(`${name} が地図にない`);
  }
  return country;
}

describe("toMapCountries", () => {
  test("ISO 3166-1 numeric の id を alpha-2 に変換する", () => {
    expect(countries.find((c) => c.feature.id === "392")?.alpha2).toBe("JP");
  });

  test.each(UNRECOGNIZED_STATES.map(({ code }) => code))(
    "国として扱う ISO 3166-1 にない地域 %s に、ちょうど 1 つの形状が対応する",
    (code) => {
      expect(countries.filter((c) => c.alpha2 === code)).toHaveLength(1);
    },
  );

  test("名前で ISO 3166-1 にない地域を識別する", () => {
    expect(findByName("Kosovo").alpha2).toBe("XK");
    expect(findByName("N. Cyprus").alpha2).toBe("XN");
    expect(findByName("Somaliland").alpha2).toBe("XS");
  });

  test("id がなく、ISO 3166-1 にない地域にも当たらない形状は alpha-2 を持たない", () => {
    expect(findByName("Indian Ocean Ter.").alpha2).toBeUndefined();
    expect(findByName("Siachen Glacier").alpha2).toBeUndefined();
  });
});

describe("海外領土の切り出し", () => {
  function polygonsOf(alpha2: string) {
    return countries
      .filter((c) => c.alpha2 === alpha2)
      .flatMap(({ feature: { geometry } }) => {
        if (geometry.type === "MultiPolygon") {
          return geometry.coordinates;
        }
        return geometry.type === "Polygon" ? [geometry.coordinates] : [];
      });
  }

  /** ポリゴンの外周がすべて指定の経緯度の範囲に収まるか。 */
  function within(
    polygon: number[][][],
    [west, south, east, north]: readonly [number, number, number, number],
  ) {
    return (polygon[0] ?? []).every(
      ([lon = Number.NaN, lat = Number.NaN]) =>
        lon >= west && lon <= east && lat >= south && lat <= north,
    );
  }

  test.each(["GF", "GP", "MQ", "YT", "RE", "SJ", "BQ"])(
    "%s の形状が親国から切り出される",
    (code) => {
      expect(polygonsOf(code).length).toBeGreaterThan(0);
    },
  );

  test.each([
    // フランス本土とコルシカ
    ["FR", [-6, 41, 10, 52]],
    // スヴァールバル諸島とヤンマイエン島を含まない本土と沿岸の島
    ["NO", [4, 57, 32, 72]],
    // カリブ海の島を含まない本土と沿岸の島
    ["NL", [3, 50, 8, 54]],
  ] as const)("%s の形状には本国の範囲だけが残る", (code, bounds) => {
    const polygons = polygonsOf(code);
    expect(polygons.length).toBeGreaterThan(0);
    expect(polygons.every((p) => within(p, bounds))).toBe(true);
  });
});

describe("isVisited", () => {
  const japan = findByName("Japan");
  const france = findByName("France");

  test("地図に対応しないコードが混在しても、対応する国は訪問済みと判定される", () => {
    const visited = new Set(["JP", "ZZ"]);
    expect(isVisited(japan, visited)).toBe(true);
    expect(isVisited(france, visited)).toBe(false);
  });

  test("alpha-2 を持たない形状は訪問済みと判定されない", () => {
    expect(isVisited(findByName("Siachen Glacier"), new Set(["ZZ"]))).toBe(false);
  });
});
