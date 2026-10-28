import { describe, expect, test } from "vitest";
import topology from "world-atlas/countries-50m.json";
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

  test("id のない形状は alpha-2 を持たない", () => {
    expect(findByName("Kosovo").alpha2).toBeUndefined();
  });
});

describe("isVisited", () => {
  const japan = findByName("Japan");
  const france = findByName("France");

  test("地図に対応しないコードが混在しても、対応する国は訪問済みと判定される", () => {
    const visited = new Set(["JP", "XK", "ZZ"]);
    expect(isVisited(japan, visited)).toBe(true);
    expect(isVisited(france, visited)).toBe(false);
  });

  test("alpha-2 を持たない形状は訪問済みと判定されない", () => {
    expect(isVisited(findByName("Kosovo"), new Set(["XK"]))).toBe(false);
  });
});
