import { countryName } from "../records/countryNames";
import type { Reel } from "./reel";
import { type FrameState, frameJumpTimes, summaryPageAt } from "./timing";

/** プレビューのコマの一覧の 1 項目。 */
export type FrameListItem = {
  readonly label: string;
  readonly count: string;
  /** 選んだときの移動先の時刻（秒） */
  readonly time: number;
  /** 1 か国ずつの表示で、再訪の訪問の項目か（項目に「再訪」のタグを添える） */
  readonly revisit?: boolean;
};

/**
 * まとめより前のコマの項目。
 * 年ごとの表示は年とその年に初めて訪れた国の数、1 か国ずつの表示は「#連番 国名」（再訪は国名と再訪のタグ）と年を示す。
 */
function bodyItems(reel: Reel, jumps: readonly number[]): FrameListItem[] {
  if (reel.mode === "year") {
    return reel.timeline.years.map((entry, index) => ({
      label: `${entry.year}`,
      count: `+${entry.newCountries.length}`,
      time: jumps[index] ?? 0,
    }));
  }
  return reel.timeline.visits.map((visit, index) => ({
    label:
      visit.ordinal === undefined
        ? countryName(visit.country)
        : `#${visit.ordinal} ${countryName(visit.country)}`,
    count: `${visit.year}`,
    time: jumps[index] ?? 0,
    ...(visit.ordinal === undefined ? { revisit: true } : {}),
  }));
}

function bodyCount(reel: Reel): number {
  return reel.mode === "year" ? reel.timeline.years.length : reel.timeline.visits.length;
}

/**
 * コマの一覧の項目（年または訪問のコマ、続いてまとめのコマ）。
 * まとめの国名が複数ページに分かれるときは、ページごとに項目を分け、コマの中のページ番号と同じ「1/2」の表記と、
 * そのページに載る国の番号の範囲を示す。
 */
export function frameListItems(reel: Reel): readonly FrameListItem[] {
  const { timeline, summaryPages } = reel;
  const jumps = frameJumpTimes(reel);
  const body = bodyItems(reel, jumps);
  const total = `${timeline.summary.countries.length} か国`;
  let first = 1;
  const pages = summaryPages.map((names, page) => {
    const last = first + names.length - 1;
    const range = last === first ? `${first}` : `${first}–${last}`;
    first += names.length;
    const time = jumps[body.length + page] ?? 0;
    return summaryPages.length === 1
      ? { label: "まとめ", count: total, time }
      : { label: `まとめ ${page + 1}/${summaryPages.length}`, count: `${total}（${range}）`, time };
  });
  return [...body, ...pages];
}

/** 表示中のコマに当たる、コマの一覧の項目の位置。まとめのコマでは表示中のページの項目になる。 */
export function currentFrameListIndex(reel: Reel, frame: FrameState): number {
  return frame.kind === "summary"
    ? bodyCount(reel) + summaryPageAt(reel, frame.elapsed).page
    : frame.index;
}
