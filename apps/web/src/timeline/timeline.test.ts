import { describe, expect, test } from "vitest";
import { buildTimeline } from "./timeline";

describe("buildTimeline", () => {
  test("記録がなければタイムラインはない", () => {
    expect(buildTimeline([])).toBeUndefined();
  });

  test("年が古い順に並ぶ", () => {
    const timeline = buildTimeline([
      { year: 2024, country: "FR" },
      { year: 2016, country: "JP" },
      { year: 2019, country: "AU" },
    ]);
    expect(timeline?.years.map((y) => y.year)).toEqual([2016, 2019, 2024]);
  });

  test("再訪は最初の年だけで初めての国として数える", () => {
    const timeline = buildTimeline([
      { year: 2016, country: "JP" },
      { year: 2024, country: "JP" },
      { year: 2024, country: "FR" },
    ]);
    const [y2016, y2024] = timeline?.years ?? [];
    expect(y2016?.newCountries).toEqual(["JP"]);
    expect(y2024?.newCountries).toEqual(["FR"]);
    expect(y2024?.revisitedCountries).toEqual(["JP"]);
    expect(y2024?.cumulative.size).toBe(2);
  });

  test("再訪だけの年もコマになり、初めての国は 0 になる", () => {
    const timeline = buildTimeline([
      { year: 2016, country: "JP" },
      { year: 2024, country: "JP" },
    ]);
    const y2024 = timeline?.years[1];
    expect(y2024?.year).toBe(2024);
    expect(y2024?.newCountries).toEqual([]);
    expect(y2024?.revisitedCountries).toEqual(["JP"]);
    expect(y2024?.cumulative.size).toBe(1);
  });

  test("同じ年の国はその年の訪問順（記録の並び）に並ぶ", () => {
    const timeline = buildTimeline([
      { year: 2024, country: "IT" },
      { year: 2016, country: "JP" },
      { year: 2024, country: "FR" },
    ]);
    expect(timeline?.years[1]?.newCountries).toEqual(["IT", "FR"]);
  });

  test("再訪した国もその年の訪問順に並ぶ", () => {
    const timeline = buildTimeline([
      { year: 2016, country: "JP" },
      { year: 2016, country: "FR" },
      { year: 2024, country: "FR" },
      { year: 2024, country: "JP" },
    ]);
    expect(timeline?.years[1]?.revisitedCountries).toEqual(["FR", "JP"]);
  });

  test("まとめに期間とすべての国が初めて訪れた順に入る", () => {
    const timeline = buildTimeline([
      { year: 2019, country: "IT" },
      { year: 2016, country: "TH" },
      { year: 2019, country: "KR" },
      { year: 2024, country: "TH" },
    ]);
    // 初めて訪れた年の古い順、同じ年の中は訪問順。再訪は数えない
    expect(timeline?.summary).toEqual({
      firstYear: 2016,
      lastYear: 2024,
      countries: ["TH", "IT", "KR"],
    });
  });
});
