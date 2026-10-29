import { MAP_ASPECT_RATIO } from "../map/drawWorldMap";
import { countryName } from "../records/countryNames";
import type { MapLayers } from "./mapLayers";
import { layoutNames } from "./textLayout";
import type { Timeline } from "./timeline";
import { type FrameState, frameStartTimes, totalDuration } from "./timing";

/** コマの基準の大きさ。すべての配置と文字の大きさはこの座標系で決め、表示する幅に合わせて拡大・縮小する。 */
export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/**
 * コマの配色。Canvas からは CSS 変数を読めないため値を直接持つ。
 * docs/design-guidelines.md のデザイントークン（--bg、--text、--muted、--line、--accent、--accent-strong）と一致させる。
 */
const COLORS = {
  bg: "#0b1019",
  text: "#e7eaf0",
  muted: "#8d96aa",
  line: "#243047",
  accent: "#f2a93b",
  accentStrong: "#ffd27a",
} as const;

/** CSS の --font-sans と同じ指定。端末のサンセリフ体で描く。 */
const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif';

const PADDING_X = 80;
const TEXT_WIDTH = FRAME_WIDTH - PADDING_X * 2;
const MAP_HEIGHT = FRAME_WIDTH / MAP_ASPECT_RATIO;

/** コマの中のアニメーションの長さ（秒）。 */
const TEXT_FADE_SECONDS = 0.3;
const EMPHASIS_SECONDS = 0.6;
const LIST_FADE_SECONDS = 0.5;

export type FrameContext = Parameters<MapLayers["draw"]>[0] &
  Pick<
    CanvasRenderingContext2D,
    "font" | "textAlign" | "textBaseline" | "globalAlpha" | "letterSpacing" | "fillText" | "scale"
  > & {
    /** 文字の折り返しに使う。使うのは幅だけなので、テストのフェイクでも用意しやすいよう幅だけを求める。 */
    measureText: (text: string) => { readonly width: number };
  };

function progressOf(elapsed: number, seconds: number): number {
  return Math.min(Math.max(elapsed / seconds, 0), 1);
}

function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}

function font(weight: number, px: number): string {
  return `${weight} ${px}px ${FONT_FAMILY}`;
}

function setText(ctx: FrameContext, weight: number, px: number, color: string) {
  ctx.font = font(weight, px);
  ctx.fillStyle = color;
  ctx.letterSpacing = "0px";
}

function drawBrand(ctx: FrameContext) {
  setText(ctx, 700, 30, COLORS.muted);
  ctx.letterSpacing = "8px";
  ctx.fillText("PASSPORT REEL", PADDING_X, 150);
  ctx.letterSpacing = "0px";
}

function drawNames(
  ctx: FrameContext,
  names: readonly string[],
  y: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines = layoutNames(names, TEXT_WIDTH, maxLines, (text) => ctx.measureText(text).width);
  lines.forEach((line, index) => ctx.fillText(line, PADDING_X, y + index * lineHeight));
}

/** 下部の累計の国数と、全体の中の再生位置を示す進捗バー。 */
function drawFooter(ctx: FrameContext, count: number, position: number) {
  setText(ctx, 800, 170, COLORS.accent);
  const number = String(count);
  ctx.fillText(number, PADDING_X, 1700);
  const numberWidth = ctx.measureText(number).width;
  setText(ctx, 600, 52, COLORS.muted);
  ctx.fillText("か国", PADDING_X + numberWidth + 20, 1700);

  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PADDING_X, 1790, TEXT_WIDTH, 8);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(PADDING_X, 1790, TEXT_WIDTH * position, 8);
}

function drawYearFrame(
  ctx: FrameContext,
  timeline: Timeline,
  index: number,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const entry = timeline.years[index];
  if (!entry) {
    return;
  }
  const previous = timeline.years[index - 1];
  const before = previous?.cumulative ?? new Set<string>();

  layers.draw(
    ctx,
    { x: 0, y: 640, width: FRAME_WIDTH, height: MAP_HEIGHT },
    `year-${index}`,
    before,
    new Set(entry.newCountries),
    easeOut(progressOf(elapsed, EMPHASIS_SECONDS)),
    pixelScale,
  );

  ctx.globalAlpha = easeOut(progressOf(elapsed, TEXT_FADE_SECONDS));
  drawBrand(ctx);
  setText(ctx, 800, 200, COLORS.text);
  ctx.fillText(String(entry.year), PADDING_X - 8, 390);

  const label = "初めて訪れた国";
  setText(ctx, 600, 44, COLORS.muted);
  ctx.fillText(label, PADDING_X, 480);
  const labelWidth = ctx.measureText(label).width;
  setText(ctx, 800, 44, COLORS.accentStrong);
  ctx.fillText(`+${entry.newCountries.length}`, PADDING_X + labelWidth + 16, 480);

  if (entry.newCountries.length > 0) {
    setText(ctx, 500, 40, COLORS.text);
    drawNames(ctx, entry.newCountries.map(countryName), 550, 54, 2);
  } else {
    setText(ctx, 500, 40, COLORS.muted);
    const [first = "", ...rest] = entry.revisitedCountries.map(countryName);
    drawNames(ctx, [`再訪：${first}`, ...rest], 550, 54, 2);
  }
  ctx.globalAlpha = 1;

  // 累計の国数は前の年の値から今年の値へ数え上げる
  const growth = easeOut(progressOf(elapsed, EMPHASIS_SECONDS));
  const count = Math.round(before.size + (entry.cumulative.size - before.size) * growth);
  drawFooter(ctx, count, positionOf(timeline, index, elapsed));
}

function drawSummaryFrame(
  ctx: FrameContext,
  timeline: Timeline,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { firstYear, lastYear, countries } = timeline.summary;
  drawBrand(ctx);
  setText(ctx, 800, 130, COLORS.text);
  ctx.fillText(
    firstYear === lastYear ? `${firstYear}` : `${firstYear}–${lastYear}`,
    PADDING_X - 6,
    320,
  );

  layers.draw(
    ctx,
    { x: 0, y: 400, width: FRAME_WIDTH, height: MAP_HEIGHT },
    "summary",
    new Set(countries),
    new Set(),
    1,
    pixelScale,
  );

  ctx.globalAlpha = easeOut(progressOf(elapsed, LIST_FADE_SECONDS));
  setText(ctx, 500, 34, COLORS.text);
  drawNames(ctx, countries.map(countryName), 400 + MAP_HEIGHT + 70, 48, 4);
  ctx.globalAlpha = 1;

  drawFooter(ctx, countries.length, positionOf(timeline, timeline.years.length, elapsed));
}

/** 全体の長さに対する再生位置（0〜1）。 */
function positionOf(timeline: Timeline, frameIndex: number, elapsed: number): number {
  const start = frameStartTimes(timeline)[frameIndex] ?? 0;
  return Math.min((start + elapsed) / totalDuration(timeline), 1);
}

/**
 * 1 コマを描く。プレビューと動画の書き出しで共通に使う。
 * 描く内容は引数だけで決まり、同じ frame なら必ず同じ絵になる。
 * width は描画先の幅（実ピクセル）で、基準の 1080×1920 の座標系をその幅に合わせて縮小・拡大する。
 */
export function drawFrame(
  ctx: FrameContext,
  width: number,
  timeline: Timeline,
  frame: FrameState,
  layers: MapLayers,
): void {
  const scale = width / FRAME_WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  if (frame.kind === "year") {
    drawYearFrame(ctx, timeline, frame.index, frame.elapsed, layers, scale);
  } else {
    drawSummaryFrame(ctx, timeline, frame.elapsed, layers, scale);
  }
  ctx.restore();
}
