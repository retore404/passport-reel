/**
 * 訪問データの入力（issue #6）ができるまで表示に使うサンプルの訪問国（ISO 3166-1 alpha-2）。
 * 大きな国、小さな国（マーカー表示）、飛び地を持つ国、地図に対応しないコードを含め、表示の確認に使う。
 */
export const SAMPLE_VISITED_COUNTRIES: ReadonlySet<string> = new Set([
  // 大きな国・飛び地を持つ国
  "JP",
  "US",
  "FR",
  "AU",
  "BR",
  // 小さな国
  "SG",
  "VA",
  "MV",
  "MT",
  // 地図上に対応する国がないコード（無視される）
  "XK",
]);
