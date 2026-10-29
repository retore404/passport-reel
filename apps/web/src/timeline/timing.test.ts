import { describe, expect, test } from "vitest";
import { buildTimeline, type Timeline } from "./timeline";
import { frameAt, frameStartTimes, totalDuration } from "./timing";

function threeYears(): Timeline {
  const timeline = buildTimeline([
    { year: 2016, country: "JP" },
    { year: 2019, country: "AU" },
    { year: 2024, country: "FR" },
  ]);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return timeline;
}

describe("totalDuration", () => {
  test("3 年分は 3 × 2 秒 + 4 秒 = 10 秒", () => {
    expect(totalDuration(threeYears())).toBe(10);
  });
});

describe("frameStartTimes", () => {
  test("年のコマとまとめのコマの開始時刻", () => {
    expect(frameStartTimes(threeYears())).toEqual([0, 2, 4, 6]);
  });
});

describe("frameAt", () => {
  const timeline = threeYears();

  test("4.5 秒は 3 つ目の年のコマ", () => {
    expect(frameAt(timeline, 4.5)).toEqual({ kind: "year", index: 2, elapsed: 0.5 });
  });

  test("年のコマの後はまとめのコマ", () => {
    expect(frameAt(timeline, 7)).toEqual({ kind: "summary", elapsed: 1 });
  });

  test("範囲外の時刻は丸める", () => {
    expect(frameAt(timeline, -1)).toEqual({ kind: "year", index: 0, elapsed: 0 });
    expect(frameAt(timeline, 99)).toEqual({ kind: "summary", elapsed: 4 });
  });

  test("全体の長さちょうどでまとめの最後の状態になる", () => {
    expect(frameAt(timeline, 10)).toEqual({ kind: "summary", elapsed: 4 });
  });
});
