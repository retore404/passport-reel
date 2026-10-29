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

  test("同じ年の国は日本語名の順に並ぶ", () => {
    const timeline = buildTimeline([
      { year: 2024, country: "FR" },
      { year: 2024, country: "IT" },
    ]);
    // イタリア → フランス
    expect(timeline?.years[0]?.newCountries).toEqual(["IT", "FR"]);
  });

  test("まとめに期間とすべての国が入る", () => {
    const timeline = buildTimeline([
      { year: 2024, country: "FR" },
      { year: 2016, country: "JP" },
      { year: 2024, country: "JP" },
    ]);
    // 日本語の照合順ではカナの国名が漢字の国名より前に来る
    expect(timeline?.summary).toEqual({ firstYear: 2016, lastYear: 2024, countries: ["FR", "JP"] });
  });
});
