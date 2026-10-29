import type { Timeline } from "../timeline/timeline";

/** 書き出す動画のフレームレート。 */
export const FPS = 30;

/** 動画の長さ（秒）に対するフレーム数。コマの長さは整数秒なので割り切れるが、念のため丸める。 */
export function frameCount(duration: number): number {
  return Math.round(duration * FPS);
}

/** フレーム番号から決まる時刻（秒）。実時間ではなく番号で決めるので、処理が遅くてもコマ落ちしない。 */
export function frameTime(index: number): number {
  return index / FPS;
}

export function progressText(done: number, total: number): string {
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  return `${done} / ${total}（${percent}%）`;
}

export function videoFileName(timeline: Timeline): string {
  const { firstYear, lastYear } = timeline.summary;
  return `passport-reel-${firstYear}-${lastYear}.mp4`;
}
