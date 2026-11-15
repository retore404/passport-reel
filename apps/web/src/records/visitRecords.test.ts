import { describe, expect, test } from "vitest";
import {
  addRecord,
  groupByYear,
  hasRecord,
  isRevisit,
  moveRecord,
  removeRecord,
  visitedCountries,
  type VisitRecord,
} from "./visitRecords";

const jp2016: VisitRecord = { year: 2016, country: "JP" };
const jp2024: VisitRecord = { year: 2024, country: "JP" };
const fr2024: VisitRecord = { year: 2024, country: "FR" };

describe("addRecord", () => {
  test("年と国の記録を追加する", () => {
    expect(addRecord([], fr2024)).toEqual([fr2024]);
  });

  test("同じ国を別の年に追加できる", () => {
    expect(addRecord([jp2016], jp2024)).toEqual([jp2016, jp2024]);
  });

  test("同じ年・同じ国は重複して追加されない", () => {
    const records = [jp2024];
    expect(addRecord(records, { year: 2024, country: "JP" })).toBe(records);
  });
});

describe("hasRecord", () => {
  test("年と国の組で判定する", () => {
    expect(hasRecord([jp2016], { year: 2016, country: "JP" })).toBe(true);
    expect(hasRecord([jp2016], jp2024)).toBe(false);
  });
});

describe("removeRecord", () => {
  test("指定した年・国の記録だけを削除する", () => {
    expect(removeRecord([jp2016, jp2024, fr2024], jp2016)).toEqual([jp2024, fr2024]);
  });
});

describe("visitedCountries", () => {
  test("複数年の同じ国は1か国として数える", () => {
    const visited = visitedCountries([jp2016, jp2024, fr2024]);
    expect(visited.size).toBe(2);
    expect([...visited]).toEqual(expect.arrayContaining(["JP", "FR"]));
  });

  test("記録がなければ空", () => {
    expect(visitedCountries([]).size).toBe(0);
  });
});

describe("groupByYear", () => {
  test("新しい年を先にまとめ、年の中は追加した順を保つ", () => {
    expect(groupByYear([jp2016, fr2024, jp2024])).toEqual([
      { year: 2024, records: [fr2024, jp2024] },
      { year: 2016, records: [jp2016] },
    ]);
  });
});

describe("isRevisit", () => {
  const records = [jp2016, jp2024, fr2024];

  test("より前の年に同じ国があれば再訪", () => {
    expect(isRevisit(records, jp2024)).toBe(true);
  });

  test("最初の年の記録は再訪ではない", () => {
    expect(isRevisit(records, jp2016)).toBe(false);
    expect(isRevisit(records, fr2024)).toBe(false);
  });
});

describe("moveRecord", () => {
  const fr2019: VisitRecord = { year: 2019, country: "FR" };
  const it2019: VisitRecord = { year: 2019, country: "IT" };
  const es2019: VisitRecord = { year: 2019, country: "ES" };
  // 2019 年の記録の間に別の年の記録が挟まっている配列
  const records = [fr2019, jp2016, it2019, jp2024, es2019];

  test("後ろの記録を前へ移す", () => {
    expect(groupByYear(moveRecord(records, es2019, fr2019))).toContainEqual({
      year: 2019,
      records: [es2019, fr2019, it2019],
    });
  });

  test("前の記録を後ろへ移す", () => {
    expect(groupByYear(moveRecord(records, fr2019, es2019))).toContainEqual({
      year: 2019,
      records: [it2019, es2019, fr2019],
    });
  });

  test("別の年の記録の位置は変わらない", () => {
    const moved = moveRecord(records, es2019, fr2019);
    expect(moved[1]).toBe(jp2016);
    expect(moved[3]).toBe(jp2024);
    expect(moved).toHaveLength(records.length);
  });

  test("年をまたぐ移動は受け付けない", () => {
    expect(moveRecord(records, fr2019, jp2016)).toBe(records);
  });

  test("同じ記録への移動や見つからない記録は元の配列のまま", () => {
    expect(moveRecord(records, fr2019, fr2019)).toBe(records);
    expect(moveRecord(records, { year: 2019, country: "DE" }, fr2019)).toBe(records);
  });

  test("追加した記録はその年の最後に並ぶ", () => {
    expect(groupByYear(addRecord(records, { year: 2019, country: "DE" }))).toContainEqual({
      year: 2019,
      records: [fr2019, it2019, es2019, { year: 2019, country: "DE" }],
    });
  });
});
