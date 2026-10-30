import { describe, expect, test } from "vitest";
import { buildReel } from "./reel";
import { buildTimeline, type Timeline } from "./timeline";

function timelineOf(records: Parameters<typeof buildTimeline>[0]): Timeline {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return timeline;
}

describe("buildReel", () => {
  test("まとめの国名を日本語名でページに分ける", () => {
    const timeline = timelineOf([
      { year: 2016, country: "JP" },
      { year: 2024, country: "FR" },
    ]);
    const reel = buildReel(timeline, (text) => text.length * 38);
    expect(reel.timeline).toBe(timeline);
    expect(reel.summaryPages).toEqual([["フランス", "日本"]]);
  });

  test("表示枠に収まらなければ複数ページになる", () => {
    // 1 つのタグが行の幅を占めるほど広く測ると、1 ページに 3 か国（3 行）までになる
    const timeline = timelineOf(
      ["JP", "FR", "IT", "DE"].map((country) => ({ year: 2024, country })),
    );
    const reel = buildReel(timeline, () => 900);
    expect(reel.summaryPages.map((page) => page.length)).toEqual([3, 1]);
  });
});
