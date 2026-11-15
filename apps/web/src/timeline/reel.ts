import { countryName } from "../records/countryNames";
import { layoutRecentTags, type Measure, paginateNames, type Tag } from "./textLayout";
import type { Timeline } from "./timeline";

/** 表示モード。year：年ごとに 1 コマ、focus：訪問ごとに 1 コマで地図をその国へ寄せる。 */
export type ReelMode = "year" | "focus";

/**
 * 再生する内容。記録から作ったタイムラインと、まとめのコマの国名のページ分けを持つ。
 * まとめのコマの長さはページ数で決まり、ページ数は文字幅の計測で決まるため、計測した結果をここに持たせて
 * タイミングと描画で共有する。プレビューと書き出しで同じ Reel を使えば、動画の長さと再生時間が一致する。
 * mode で表示モードを判別し、タイミング（timing.ts）と描画（drawFrame.ts）はモードごとに分岐する。
 */
type ReelBase = {
  readonly timeline: Timeline;
  /** まとめのコマの国名（日本語名）のページ。少なくとも 1 ページある。両モードで共通 */
  readonly summaryPages: readonly (readonly string[])[];
};

type YearReel = ReelBase & { readonly mode: "year" };

export type FocusReel = ReelBase & {
  readonly mode: "focus";
  /**
   * 訪問ごとの、その訪問を終えた時点の国名のタグの配置（初めて訪れた国だけ、入りきらない古い国は押し出す）。
   * 毎フレーム配置を計測し直さないよう、文字幅の計測とあわせてここで求めておく。
   */
  readonly visitTags: readonly (readonly Tag[])[];
};

export type Reel = YearReel | FocusReel;

/** measure には、コマで国名のタグを描くのと同じフォントで測る関数を渡す。 */
export function buildReel(timeline: Timeline, measure: Measure, mode: ReelMode = "year"): Reel {
  const summaryPages = paginateNames(timeline.summary.countries.map(countryName), measure);
  if (mode === "year") {
    return { mode, timeline, summaryPages };
  }
  const names: string[] = [];
  const visitTags = timeline.visits.map((visit) => {
    if (visit.ordinal !== undefined) {
      names.push(countryName(visit.country));
    }
    return layoutRecentTags(names, measure);
  });
  return { mode, timeline, summaryPages, visitTags };
}
