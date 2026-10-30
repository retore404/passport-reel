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

export type FrameState =
  | { readonly kind: "year"; readonly index: number; readonly elapsed: number }
  | { readonly kind: "summary"; readonly elapsed: number };

function summaryDuration(reel: Reel): number {
  return Math.max(SUMMARY_MIN_SECONDS, reel.summaryPages.length * SUMMARY_PAGE_SECONDS);
}

export function totalDuration(reel: Reel): number {
  return reel.timeline.years.length * YEAR_SECONDS + summaryDuration(reel);
}

/** 各コマの開始時刻（年のコマ、最後にまとめのコマ）。 */
export function frameStartTimes(reel: Reel): readonly number[] {
  const { years } = reel.timeline;
  return [...years.map((_, index) => index * YEAR_SECONDS), years.length * YEAR_SECONDS];
}

/**
 * コマの一覧で選んだときの移動先の時刻（年のコマ、続いてまとめのコマの国名のページごと）。
 * 年のコマの開始時刻は前の年からめくり始める瞬間、まとめのページの開始時刻は国名がまだ透明か切り替わり始める瞬間で、
 * 選んだコマの内容が見えないため、頭の演出が終わってそのコマ（ページ）の表示がそろった時刻にする。
 */
export function frameJumpTimes(reel: Reel): readonly number[] {
  const { timeline, summaryPages } = reel;
  const settle = Math.max(TEXT_FADE_SECONDS, EMPHASIS_SECONDS);
  const summaryStart = timeline.years.length * YEAR_SECONDS;
  return [
    ...timeline.years.map(
      (_, index) => index * YEAR_SECONDS + flipSeconds(timeline, index) + settle,
    ),
    ...summaryPages.map(
      (_, page) =>
        summaryStart +
        page * SUMMARY_PAGE_SECONDS +
        (page === 0 ? LIST_FADE_SECONDS : PAGE_TRANSITION_SECONDS),
    ),
  ];
}

/**
 * 再生時刻 t（秒）に表示するコマと、そのコマの中の経過時間を返す。
 * t は 0 から全体の長さの範囲に丸め、全体の長さちょうどではまとめのコマの最後の状態になる。
 */
export function frameAt(reel: Reel, t: number): FrameState {
  const { years } = reel.timeline;
  const clamped = Math.min(Math.max(t, 0), totalDuration(reel));
  const index = Math.floor(clamped / YEAR_SECONDS);
  if (index < years.length) {
    return { kind: "year", index, elapsed: clamped - index * YEAR_SECONDS };
  }
  return { kind: "summary", elapsed: clamped - years.length * YEAR_SECONDS };
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
