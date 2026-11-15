import type { Reel } from "./reel";
import type { Timeline } from "./timeline";

/** 1 年のコマの長さ（秒）。 */
const YEAR_SECONDS = 2;
/** まとめのコマの最低の長さ（秒）。 */
const SUMMARY_MIN_SECONDS = 4;
/** まとめのコマで国名の 1 ページを見せる長さ（秒）。 */
const SUMMARY_PAGE_SECONDS = 2.5;
/** 年を 1 年めくる長さ（秒）と、1 コマの中のめくりの合計の上限（秒）。 */
const FLIP_STEP_SECONDS = 0.3;
const FLIP_MAX_SECONDS = 0.9;
/** 年のコマで、めくりが終わってから文字をフェードインする長さと、その年の国を強調し国数を数え上げる長さ（秒）。 */
export const TEXT_FADE_SECONDS = 0.3;
export const EMPHASIS_SECONDS = 0.6;
/** まとめのコマで、国名の 1 ページ目をフェードインする長さと、2 ページ目以降へ切り替える長さ（秒）。 */
export const LIST_FADE_SECONDS = 0.5;
export const PAGE_TRANSITION_SECONDS = 0.4;

/**
 * 1 か国ずつの表示の訪問のコマの長さと、コマの頭からの区間（秒）。
 * 移動して寄る → 国名を出す → 塗って数え上げる、の順に進め、最後の 0.1 秒は止まって見せる。
 */
const VISIT_SECONDS = 1.6;
const VISIT_MOVE_SECONDS = 0.6;
/** 年が変わる訪問で、前の年から次の年へ切り替える長さ。移動と同時に進める */
const VISIT_YEAR_SWITCH_SECONDS = 0.45;
/** 国名は移動の終わり際から入り始める（移動が止まる前に動き出して間を詰める） */
const VISIT_NAME_START = 0.55;
const VISIT_NAME_FADE_SECONDS = 0.3;
const VISIT_PAINT_START = 0.9;
const VISIT_PAINT_SECONDS = 0.6;
/** 到着時の輪を広げる長さ。移動が止まる少し前から始める */
const VISIT_RING_SECONDS = 0.6;
/** 1 か国ずつの表示のまとめのコマで、最後の国から世界全体まで引く長さ。引き終わってから国名を出す */
export const SUMMARY_PULL_SECONDS = 1;

export type FrameState =
  | { readonly kind: "year"; readonly index: number; readonly elapsed: number }
  | { readonly kind: "visit"; readonly index: number; readonly elapsed: number }
  | { readonly kind: "summary"; readonly elapsed: number };

function summaryDuration(reel: Reel): number {
  return Math.max(SUMMARY_MIN_SECONDS, reel.summaryPages.length * SUMMARY_PAGE_SECONDS);
}

/** まとめより前のコマ（年のコマ、または訪問のコマ）の数と、1 コマの長さ。 */
function bodyFrames(reel: Reel): { readonly count: number; readonly seconds: number } {
  return reel.mode === "year"
    ? { count: reel.timeline.years.length, seconds: YEAR_SECONDS }
    : { count: reel.timeline.visits.length, seconds: VISIT_SECONDS };
}

function summaryStart(reel: Reel): number {
  const { count, seconds } = bodyFrames(reel);
  return count * seconds;
}

export function totalDuration(reel: Reel): number {
  return summaryStart(reel) + summaryDuration(reel);
}

/** 各コマの開始時刻（年または訪問のコマ、最後にまとめのコマ）。 */
export function frameStartTimes(reel: Reel): readonly number[] {
  const { count, seconds } = bodyFrames(reel);
  return [...Array.from({ length: count }, (_, index) => index * seconds), count * seconds];
}

/**
 * コマの一覧で選んだときの移動先の時刻（年または訪問のコマ、続いてまとめのコマの国名のページごと）。
 * コマの開始時刻は前のコマからの移り変わりの最中で、選んだコマの内容が見えないため、
 * 頭の演出が終わってそのコマ（ページ）の表示がそろった時刻にする。
 */
export function frameJumpTimes(reel: Reel): readonly number[] {
  const { timeline, summaryPages } = reel;
  const start = summaryStart(reel);
  const body =
    reel.mode === "year"
      ? timeline.years.map(
          (_, index) =>
            index * YEAR_SECONDS +
            flipSeconds(timeline, index) +
            Math.max(TEXT_FADE_SECONDS, EMPHASIS_SECONDS),
        )
      : timeline.visits.map(
          (_, index) => index * VISIT_SECONDS + VISIT_PAINT_START + VISIT_PAINT_SECONDS,
        );
  // 1 か国ずつの表示のまとめは、世界全体まで引いてから国名が入る
  const listStart = reel.mode === "year" ? 0 : SUMMARY_PULL_SECONDS;
  return [
    ...body,
    ...summaryPages.map(
      (_, page) =>
        start +
        (page === 0
          ? listStart + LIST_FADE_SECONDS
          : page * SUMMARY_PAGE_SECONDS + PAGE_TRANSITION_SECONDS),
    ),
  ];
}

/**
 * 再生時刻 t（秒）に表示するコマと、そのコマの中の経過時間を返す。
 * t は 0 から全体の長さの範囲に丸め、全体の長さちょうどではまとめのコマの最後の状態になる。
 */
export function frameAt(reel: Reel, t: number): FrameState {
  const { count, seconds } = bodyFrames(reel);
  const clamped = Math.min(Math.max(t, 0), totalDuration(reel));
  const index = Math.floor(clamped / seconds);
  if (index < count) {
    return {
      kind: reel.mode === "year" ? "year" : "visit",
      index,
      elapsed: clamped - index * seconds,
    };
  }
  return { kind: "summary", elapsed: clamped - count * seconds };
}

function progressOf(elapsed: number, start: number, seconds: number): number {
  return Math.min(Math.max((elapsed - start) / seconds, 0), 1);
}

/** 訪問のコマの中の各区間の進み具合（0〜1、イージング前）。 */
export type VisitPhases = {
  /** 前の国からこの国への地図の移動 */
  readonly move: number;
  /** 前の年からこの年への切り替え（年が変わる訪問だけで使う） */
  readonly yearSwitch: number;
  /** 番号と国名の入り */
  readonly name: number;
  /** この国の塗りと累計の数え上げ、タグの追加 */
  readonly paint: number;
  /** 移動の終わり際に、国の位置を示す輪を一度広げる */
  readonly ring: number;
};

/** 訪問のコマの経過時間 elapsed での各区間の進み具合。描画とテストで同じ区間の定義を使う。 */
export function visitPhases(elapsed: number): VisitPhases {
  return {
    move: progressOf(elapsed, 0, VISIT_MOVE_SECONDS),
    yearSwitch: progressOf(elapsed, 0, VISIT_YEAR_SWITCH_SECONDS),
    name: progressOf(elapsed, VISIT_NAME_START, VISIT_NAME_FADE_SECONDS),
    paint: progressOf(elapsed, VISIT_PAINT_START, VISIT_PAINT_SECONDS),
    ring: progressOf(elapsed, VISIT_MOVE_SECONDS - 0.1, VISIT_RING_SECONDS),
  };
}

/**
 * 年のコマの頭で、前の年からこの年までめくる長さ（秒）。最初の年はめくらないので 0。
 * 記録のない年も 1 年ずつめくるため年の差に比例させるが、コマの長さは変えないので上限で抑える。
 */
export function flipSeconds(timeline: Timeline, index: number): number {
  const year = timeline.years[index]?.year;
  const previous = timeline.years[index - 1]?.year;
  if (year === undefined || previous === undefined) {
    return 0;
  }
  return Math.min((year - previous) * FLIP_STEP_SECONDS, FLIP_MAX_SECONDS);
}

/** まとめのコマの経過時間 elapsed に表示するページと、そのページの中の経過時間。最後のページはコマの終わりまで残す。 */
export function summaryPageAt(
  reel: Reel,
  elapsed: number,
): { readonly page: number; readonly elapsed: number } {
  const page = Math.min(
    Math.max(Math.floor(elapsed / SUMMARY_PAGE_SECONDS), 0),
    reel.summaryPages.length - 1,
  );
  return { page, elapsed: elapsed - page * SUMMARY_PAGE_SECONDS };
}

/** 秒を m:ss で表す。 */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
