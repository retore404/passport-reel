/**
 * 地図データ（world-atlas）での形状の見つけ方。
 * - feature: ISO の id を持たない単独の形状があり、その name で引く
 * - split: 親国の形状に含まれており、親国（ISO 3166-1 alpha-2）を境界線で分けて作る（境界線は map/regionBoundaries.ts）
 */
type MapShape =
  | { readonly kind: "feature"; readonly name: string }
  | { readonly kind: "split"; readonly parent: string };

/** 国として扱う ISO 3166-1 にない地域。 */
export type UnrecognizedState = {
  /**
   * 記録に保存する 2 文字の ID。
   * 保存された記録が参照するため、一度割り当てた ID は別の地域に変更・再利用しない（外す場合も欠番にする）。
   */
  readonly code: string;
  /** 表示に使う日本語名 */
  readonly name: string;
  /** 記録の一覧や候補で国コードとして表示する文字列。国名データに 2 文字コードがない地域は "--" */
  readonly displayCode: string;
  readonly mapShape: MapShape;
};

/**
 * 国として扱う ISO 3166-1 にない地域の一覧。
 * 判断基準・ID のルール・対象地域の正は openspec/specs/visit-records/spec.md の
 * 「国として扱う ISO 3166-1 にない地域」であり、地域を足すときは先に仕様の一覧を更新する。
 */
export const UNRECOGNIZED_STATES: readonly UnrecognizedState[] = [
  { code: "XK", name: "コソボ", displayCode: "XK", mapShape: { kind: "feature", name: "Kosovo" } },
  {
    code: "XN",
    name: "北キプロス",
    displayCode: "--",
    mapShape: { kind: "feature", name: "N. Cyprus" },
  },
  {
    code: "XS",
    name: "ソマリランド",
    displayCode: "--",
    mapShape: { kind: "feature", name: "Somaliland" },
  },
  { code: "XA", name: "アブハジア", displayCode: "--", mapShape: { kind: "split", parent: "GE" } },
  { code: "XO", name: "南オセチア", displayCode: "--", mapShape: { kind: "split", parent: "GE" } },
  {
    code: "XT",
    name: "沿ドニエストル",
    displayCode: "--",
    mapShape: { kind: "split", parent: "MD" },
  },
];
