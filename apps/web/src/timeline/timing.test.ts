import { describe, expect, test } from "vitest";
import type { Reel } from "./reel";
import { buildTimeline, type Timeline } from "./timeline";
import {
  EMPHASIS_SECONDS,
  flipSeconds,
  frameAt,
  frameJumpTimes,
  frameStartTimes,
  LIST_FADE_SECONDS,
  PAGE_TRANSITION_SECONDS,
  SUMMARY_PULL_SECONDS,
  summaryPageAt,
  TEXT_FADE_SECONDS,
  totalDuration,
  visitPhases,
} from "./timing";

function timelineOf(records: Parameters<typeof buildTimeline>[0]): Timeline {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return timeline;
}

/** 2016・2019・2024 の 3 年分。まとめの国名は pages ページに分かれているものとする。 */
function threeYears(pages = 1): Reel {
  const timeline = timelineOf([
    { year: 2016, country: "JP" },
    { year: 2019, country: "AU" },
    { year: 2024, country: "FR" },
  ]);
  return { mode: "year", timeline, summaryPages: Array.from({ length: pages }, () => ["日本"]) };
}

describe("totalDuration", () => {
  test("まとめが 1 ページなら（2.5 秒は 4 秒に満たないので）3 × 2 秒 + 4 秒 = 10 秒", () => {
    expect(totalDuration(threeYears())).toBe(10);
  });

  test("まとめが 3 ページなら 3 × 2 秒 + 3 × 2.5 秒 = 13.5 秒", () => {
    expect(totalDuration(threeYears(3))).toBe(13.5);
  });
});

describe("frameStartTimes", () => {
  test("年のコマとまとめのコマの開始時刻", () => {
    expect(frameStartTimes(threeYears())).toEqual([0, 2, 4, 6]);
  });
});

describe("frameJumpTimes", () => {
  const reel = threeYears();
  const jumps = frameJumpTimes(reel);

  test("最初の年はめくらないので、開始時刻から強調が終わるまで（0.6 秒）進める", () => {
    expect(jumps[0]).toBeCloseTo(0.6);
  });

  test("2 年目以降は、めくり（0.9 秒）と強調（0.6 秒）が終わるまで進める", () => {
    expect(jumps[1]).toBeCloseTo(2 + 0.9 + 0.6);
    expect(jumps[2]).toBeCloseTo(4 + 0.9 + 0.6);
  });

  test("まとめは国名の 1 ページ目のフェードイン（0.5 秒）が終わるまで進める", () => {
    expect(jumps[3]).toBeCloseTo(6 + LIST_FADE_SECONDS);
    expect(frameAt(reel, jumps[3] ?? 0)).toEqual({ kind: "summary", elapsed: LIST_FADE_SECONDS });
  });

  test("まとめが 1 ページなら、まとめの移動先は 1 つ", () => {
    expect(jumps).toHaveLength(4);
  });

  test("まとめが複数ページなら、ページごとに切り替わり（0.4 秒）が終わった時刻へ移動する", () => {
    const pages = threeYears(3);
    const summaryJumps = frameJumpTimes(pages).slice(3);
    expect(summaryJumps).toHaveLength(3);
    expect(summaryJumps[0]).toBeCloseTo(6 + LIST_FADE_SECONDS);
    expect(summaryJumps[1]).toBeCloseTo(6 + 2.5 + PAGE_TRANSITION_SECONDS);
    expect(summaryJumps[2]).toBeCloseTo(6 + 5 + PAGE_TRANSITION_SECONDS);
    summaryJumps.forEach((time, page) => {
      const frame = frameAt(pages, time);
      expect(frame.kind === "summary" && summaryPageAt(pages, frame.elapsed).page).toBe(page);
    });
  });

  test("移動先では、そのコマの年のめくりと演出が終わっている", () => {
    reel.timeline.years.forEach((_, index) => {
      const frame = frameAt(reel, jumps[index] ?? 0);
      expect(frame).toMatchObject({ kind: "year", index });
      expect(frame.elapsed).toBeGreaterThanOrEqual(
        flipSeconds(reel.timeline, index) + Math.max(TEXT_FADE_SECONDS, EMPHASIS_SECONDS),
      );
    });
  });
});

describe("frameAt", () => {
  const reel = threeYears();

  test("4.5 秒は 3 つ目の年のコマ", () => {
    expect(frameAt(reel, 4.5)).toEqual({ kind: "year", index: 2, elapsed: 0.5 });
  });

  test("年のコマの後はまとめのコマ", () => {
    expect(frameAt(reel, 7)).toEqual({ kind: "summary", elapsed: 1 });
  });

  test("範囲外の時刻は丸める", () => {
    expect(frameAt(reel, -1)).toEqual({ kind: "year", index: 0, elapsed: 0 });
    expect(frameAt(reel, 99)).toEqual({ kind: "summary", elapsed: 4 });
  });

  test("全体の長さちょうどでまとめの最後の状態になる", () => {
    expect(frameAt(reel, 10)).toEqual({ kind: "summary", elapsed: 4 });
    expect(frameAt(threeYears(3), 13.5)).toEqual({ kind: "summary", elapsed: 7.5 });
  });
});

describe("flipSeconds", () => {
  const { timeline } = threeYears();

  test("最初の年はめくらない", () => {
    expect(flipSeconds(timeline, 0)).toBe(0);
  });

  test("1 年あたり 0.3 秒で、記録のない年の分もめくる", () => {
    const consecutive = timelineOf([
      { year: 2023, country: "JP" },
      { year: 2024, country: "FR" },
    ]);
    expect(flipSeconds(consecutive, 1)).toBeCloseTo(0.3);
    // 2016 → 2019 は 3 年分
    expect(flipSeconds(timeline, 1)).toBeCloseTo(0.9);
  });

  test("めくりの合計は 0.9 秒まで", () => {
    // 2019 → 2024 は 5 年分（1.5 秒）だが 0.9 秒に抑える
    expect(flipSeconds(timeline, 2)).toBe(0.9);
  });
});

describe("summaryPageAt", () => {
  test("2.5 秒ごとに次のページへ送り、最後のページはコマの終わりまで残す", () => {
    const reel = threeYears(3);
    expect(summaryPageAt(reel, 0)).toEqual({ page: 0, elapsed: 0 });
    expect(summaryPageAt(reel, 2.6).page).toBe(1);
    expect(summaryPageAt(reel, 5)).toEqual({ page: 2, elapsed: 0 });
    expect(summaryPageAt(reel, 7.5)).toEqual({ page: 2, elapsed: 2.5 });
  });

  test("1 ページならずっと 1 ページ目", () => {
    expect(summaryPageAt(threeYears(1), 4)).toEqual({ page: 0, elapsed: 4 });
  });
});

/** 訪問が 5 件（うち 1 件は再訪）の 1 か国ずつの表示。まとめの国名は pages ページに分かれているものとする。 */
function fiveVisits(pages = 1): Reel {
  const timeline = timelineOf([
    { year: 2016, country: "KR" },
    { year: 2016, country: "TW" },
    { year: 2019, country: "FR" },
    { year: 2019, country: "KR" },
    { year: 2024, country: "TH" },
  ]);
  return {
    mode: "focus",
    timeline,
    summaryPages: Array.from({ length: pages }, () => ["韓国"]),
    visitTags: [],
  };
}

describe("1 か国ずつの表示のタイミング", () => {
  test("訪問 5 件・まとめ 1 ページなら 5 × 1.6 秒 + 4 秒 = 12 秒", () => {
    expect(totalDuration(fiveVisits())).toBeCloseTo(12);
  });

  test("まとめが 3 ページなら 5 × 1.6 秒 + 3 × 2.5 秒 = 15.5 秒", () => {
    expect(totalDuration(fiveVisits(3))).toBeCloseTo(15.5);
  });

  test("3.3 秒は 3 つ目の訪問のコマ", () => {
    expect(frameAt(fiveVisits(), 3.3)).toMatchObject({ kind: "visit", index: 2 });
  });

  test("訪問のコマの後はまとめのコマ", () => {
    expect(frameAt(fiveVisits(), 8.5)).toMatchObject({ kind: "summary" });
  });

  test("コマの開始時刻は 1.6 秒ごと", () => {
    const starts = frameStartTimes(fiveVisits());
    expect(starts).toHaveLength(6);
    expect(starts[2]).toBeCloseTo(3.2);
    expect(starts[5]).toBeCloseTo(8);
  });

  test("一覧の移動先は、各訪問のコマの 1.5 秒の時点（塗りと数え上げが終わった時刻）", () => {
    const reel = fiveVisits();
    const jumps = frameJumpTimes(reel);
    expect(jumps[0]).toBeCloseTo(1.5);
    expect(jumps[2]).toBeCloseTo(3.2 + 1.5);
    const frame = frameAt(reel, jumps[2] ?? 0);
    expect(frame).toMatchObject({ kind: "visit", index: 2 });
    expect(frame.kind === "visit" && visitPhases(frame.elapsed).paint).toBe(1);
  });

  test("まとめの移動先は、世界全体まで引いて国名がフェードインし終わった時刻", () => {
    const jumps = frameJumpTimes(fiveVisits());
    expect(jumps).toHaveLength(6);
    expect(jumps[5]).toBeCloseTo(8 + SUMMARY_PULL_SECONDS + LIST_FADE_SECONDS);
  });

  test("まとめが複数ページなら、2 ページ目以降は年ごとの表示と同じ考え方の時刻へ移動する", () => {
    const reel = fiveVisits(3);
    const summaryJumps = frameJumpTimes(reel).slice(5);
    expect(summaryJumps[1]).toBeCloseTo(8 + 2.5 + PAGE_TRANSITION_SECONDS);
    summaryJumps.forEach((time, page) => {
      const frame = frameAt(reel, time);
      expect(frame.kind === "summary" && summaryPageAt(reel, frame.elapsed).page).toBe(page);
    });
  });
});

describe("visitPhases", () => {
  test("移動の途中では、国名も塗りもまだ始まっていない", () => {
    const phases = visitPhases(0.3);
    expect(phases.move).toBeGreaterThan(0);
    expect(phases.move).toBeLessThan(1);
    expect(phases.name).toBe(0);
    expect(phases.paint).toBe(0);
  });

  test("移動が終わってから塗りが始まり、国名は塗りより先に入る", () => {
    expect(visitPhases(0.6).move).toBe(1);
    expect(visitPhases(0.9).name).toBe(1);
    expect(visitPhases(0.85).paint).toBe(0);
    expect(visitPhases(1.2).paint).toBeGreaterThan(0);
    expect(visitPhases(1.5).paint).toBe(1);
  });
});
