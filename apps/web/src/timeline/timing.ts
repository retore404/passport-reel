import type { Timeline } from "./timeline";

/** 1 年のコマの長さ（秒）。 */
const YEAR_SECONDS = 2;
/** まとめのコマの長さ（秒）。 */
const SUMMARY_SECONDS = 4;

export type FrameState =
  | { readonly kind: "year"; readonly index: number; readonly elapsed: number }
  | { readonly kind: "summary"; readonly elapsed: number };

export function totalDuration(timeline: Timeline): number {
  return timeline.years.length * YEAR_SECONDS + SUMMARY_SECONDS;
}

/** 各コマの開始時刻（年のコマ、最後にまとめのコマ）。 */
export function frameStartTimes(timeline: Timeline): readonly number[] {
  return [
    ...timeline.years.map((_, index) => index * YEAR_SECONDS),
    timeline.years.length * YEAR_SECONDS,
  ];
}

/**
 * 再生時刻 t（秒）に表示するコマと、そのコマの中の経過時間を返す。
 * t は 0 から全体の長さの範囲に丸め、全体の長さちょうどではまとめのコマの最後の状態になる。
 */
export function frameAt(timeline: Timeline, t: number): FrameState {
  const clamped = Math.min(Math.max(t, 0), totalDuration(timeline));
  const index = Math.floor(clamped / YEAR_SECONDS);
  if (index < timeline.years.length) {
    return { kind: "year", index, elapsed: clamped - index * YEAR_SECONDS };
  }
  return { kind: "summary", elapsed: clamped - timeline.years.length * YEAR_SECONDS };
}

/** 秒を m:ss で表す。 */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
