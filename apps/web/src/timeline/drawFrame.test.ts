import { describe, expect, test } from "vitest";
import { drawFrame, FRAME_WIDTH, type FrameContext } from "./drawFrame";
import type { MapLayers } from "./mapLayers";
import { buildTimeline, type Timeline } from "./timeline";
import { frameAt } from "./timing";

/** 描いた文字と地図の呼び出しを記録するフェイク。文字幅は 1 文字 = 文字サイズ px として測る。 */
function createRecording() {
  const texts: string[] = [];
  const maps: { key: string; visited: string[]; emphasized: string[]; strength: number }[] = [];
  const noop = () => {};
  const ctx: FrameContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    letterSpacing: "0px",
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    drawImage: noop,
    fillText: (text) => {
      texts.push(text);
    },
    measureText: (text) => {
      const px = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: text.length * px };
    },
  };
  const layers: MapLayers = {
    draw: (_ctx, _rect, key, visited, emphasized, strength) => {
      maps.push({ key, visited: [...visited], emphasized: [...emphasized], strength });
    },
  };
  return { ctx, layers, texts, maps };
}

function timelineOf(records: Parameters<typeof buildTimeline>[0]): Timeline {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return timeline;
}

function draw(timeline: Timeline, t: number) {
  const recording = createRecording();
  drawFrame(recording.ctx, FRAME_WIDTH, timeline, frameAt(timeline, t), recording.layers);
  return recording;
}

const timeline = timelineOf([
  { year: 2016, country: "JP" },
  { year: 2024, country: "FR" },
  { year: 2024, country: "IT" },
  { year: 2025, country: "JP" },
]);

describe("drawFrame（年のコマ）", () => {
  test("年、初めて訪れた国の数と国名、累計を描く", () => {
    const { texts } = draw(timeline, 2 + 1);
    expect(texts).toContain("2024");
    expect(texts).toContain("+2");
    expect(texts.some((t) => t.includes("イタリア") && t.includes("フランス"))).toBe(true);
    expect(texts).toContain("3");
  });

  test("地図は前の年までの累計を下地にし、その年の国を強調する", () => {
    const { maps } = draw(timeline, 2 + 1);
    expect(maps).toEqual([
      { key: "year-1", visited: ["JP"], emphasized: ["IT", "FR"], strength: 1 },
    ]);
  });

  test("コマの始まりでは強調も累計も前の年の状態から始まる", () => {
    const { maps, texts } = draw(timeline, 2);
    expect(maps[0]?.strength).toBe(0);
    expect(texts).toContain("1");
  });

  test("再訪だけの年は +0 と再訪した国名を描く", () => {
    const { texts } = draw(timeline, 4 + 1);
    expect(texts).toContain("2025");
    expect(texts).toContain("+0");
    expect(texts.some((t) => t.startsWith("再訪：") && t.includes("日本"))).toBe(true);
  });

  test("同じ時刻なら同じ描画になる", () => {
    const first = draw(timeline, 2.3);
    const second = draw(timeline, 2.3);
    expect(second.texts).toEqual(first.texts);
    expect(second.maps).toEqual(first.maps);
  });
});

describe("drawFrame（まとめのコマ）", () => {
  test("期間、すべての訪問国の地図と国名、累計を描く", () => {
    const { texts, maps } = draw(timeline, 6 + 4);
    expect(texts).toContain("2016–2025");
    expect(texts.some((t) => t.includes("日本") && t.includes("フランス"))).toBe(true);
    expect(texts).toContain("3");
    expect(maps).toEqual([
      { key: "summary", visited: ["IT", "FR", "JP"], emphasized: [], strength: 1 },
    ]);
  });

  test("記録が 1 年だけなら期間は 1 つの年で示す", () => {
    const { texts } = draw(timelineOf([{ year: 2024, country: "FR" }]), 2 + 1);
    expect(texts).toContain("2024");
    expect(texts.some((t) => t.includes("–"))).toBe(false);
  });
});
