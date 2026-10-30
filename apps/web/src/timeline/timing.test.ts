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
  summaryPageAt,
  TEXT_FADE_SECONDS,
  totalDuration,
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
  return { timeline, summaryPages: Array.from({ length: pages }, () => ["日本"]) };
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
