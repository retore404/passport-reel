import { describe, expect, test } from "vitest";
import { layoutNames } from "./textLayout";

/** 1 文字 = 幅 1 として測るフェイク（テストの文字はすべて BMP 内なので UTF-16 の長さで数える）。 */
const measure = (text: string) => text.length;

describe("layoutNames", () => {
  test("収まる場合は「、」でつないで 1 行にする", () => {
    expect(layoutNames(["日本", "フランス"], 20, 3, measure)).toEqual(["日本、フランス"]);
  });

  test("幅を超えたら国名の切れ目で折り返す", () => {
    // 「日本、」(3) +「フランス、」(5) = 8、「イタリア」(4) を足すと 12 で幅 10 を超える
    expect(layoutNames(["日本", "フランス", "イタリア"], 10, 3, measure)).toEqual([
      "日本、フランス、",
      "イタリア",
    ]);
  });

  test("最大行数を超える分は「ほか N か国」にまとめる", () => {
    const names = ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"];
    // 1 行に国名 2 つ（「AAAA、BBBB、」= 10）まで。「CCCC、ほか 2 か国」(12) は収まらないので、残り 3 か国をまとめる
    expect(layoutNames(names, 10, 2, measure)).toEqual(["AAAA、BBBB、", "ほか 3 か国"]);
    // 幅に余裕があれば、まとめる前に出せるだけ国名を出す
    expect(layoutNames(names, 12, 2, measure)).toEqual(["AAAA、BBBB、", "CCCC、ほか 2 か国"]);
  });

  test("国名がなければ行もない", () => {
    expect(layoutNames([], 10, 3, measure)).toEqual([]);
  });
});
