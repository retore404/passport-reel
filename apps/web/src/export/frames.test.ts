import { describe, expect, test } from "vitest";
import type { Reel } from "../timeline/reel";
import { buildTimeline, type Timeline } from "../timeline/timeline";
import { frameAt, totalDuration } from "../timeline/timing";
import { frameCount, frameTime, progressText, videoFileName } from "./frames";

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

/** まとめの国名が 1 ページに収まる 3 年分（10 秒）。 */
function threeYearsReel(): Reel {
  return { timeline: threeYears(), summaryPages: [["オーストラリア", "日本", "フランス"]] };
}

describe("frameCount / frameTime", () => {
  test("10 秒の動画は 30fps で 300 フレーム", () => {
    expect(frameCount(totalDuration(threeYearsReel()))).toBe(300);
  });

  test("フレーム 135 は 4.5 秒で、3 つ目の年のコマになる", () => {
    expect(frameTime(135)).toBe(4.5);
    expect(frameAt(threeYearsReel(), frameTime(135))).toEqual({
      kind: "year",
      index: 2,
      elapsed: 0.5,
    });
  });
});

describe("progressText", () => {
  test("処理したフレーム数と割合", () => {
    expect(progressText(150, 300)).toBe("150 / 300（50%）");
    expect(progressText(0, 300)).toBe("0 / 300（0%）");
  });
});

describe("videoFileName", () => {
  test("最初の年と最後の年を入れる", () => {
    expect(videoFileName(threeYears())).toBe("passport-reel-2016-2024.mp4");
  });
});
