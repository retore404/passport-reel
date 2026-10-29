import { describe, expect, test } from "vitest";
import {
  addRecord,
  groupByYear,
  hasRecord,
  isRevisit,
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
