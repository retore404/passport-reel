import { countryName } from "../records/countryNames";
import { type Measure, paginateNames } from "./textLayout";
import type { Timeline } from "./timeline";

/**
 * 再生する内容。記録から作ったタイムラインと、まとめのコマの国名のページ分けを持つ。
 * まとめのコマの長さはページ数で決まり、ページ数は文字幅の計測で決まるため、計測した結果をここに持たせて
 * タイミングと描画で共有する。プレビューと書き出しで同じ Reel を使えば、動画の長さと再生時間が一致する。
 */
export type Reel = {
  readonly timeline: Timeline;
  /** まとめのコマの国名（日本語名）のページ。少なくとも 1 ページある */
  readonly summaryPages: readonly (readonly string[])[];
};

/** measure には、コマで国名のタグを描くのと同じフォントで測る関数を渡す。 */
export function buildReel(timeline: Timeline, measure: Measure): Reel {
  return {
    timeline,
    summaryPages: paginateNames(timeline.summary.countries.map(countryName), measure),
  };
}
