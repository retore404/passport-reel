import { describe, expect, test } from "vitest";
import {
  COUNTRY_ALIASES,
  COUNTRY_NAMES,
  countryName,
  displayCountryCode,
  normalizeForSearch,
  searchCountries,
} from "./countryNames";

const codes = (query: string) => searchCountries(query).map(({ code }) => code);

describe("COUNTRY_NAMES", () => {
  test("日本語名を持つ国の一覧になっている", () => {
    expect(COUNTRY_NAMES.length).toBeGreaterThan(240);
    expect(countryName("FR")).toBe("フランス");
  });

  test("ISO 3166-1 にない地域が含まれ、XK は重複しない", () => {
    expect(countryName("XN")).toBe("北キプロス");
    expect(countryName("XS")).toBe("ソマリランド");
    expect(countryName("XK")).toBe("コソボ");
    expect(COUNTRY_NAMES.filter(({ code }) => code === "XK")).toHaveLength(1);
  });

  test("別名表のコードはすべて日本語データに存在する", () => {
    const known = new Set(COUNTRY_NAMES.map(({ code }) => code));
    expect(Object.keys(COUNTRY_ALIASES).filter((code) => !known.has(code))).toEqual([]);
  });
});

describe("normalizeForSearch", () => {
  test("ひらがなをカタカナに、全角英数を半角にそろえ、中黒と空白を除く", () => {
    expect(normalizeForSearch("ふらんす")).toBe("フランス");
    expect(normalizeForSearch("ＵＳＡ")).toBe("USA");
    expect(normalizeForSearch("ボスニア・ヘルツェゴビナ")).toBe("ボスニアヘルツェゴビナ");
  });
});

describe("searchCountries", () => {
  test("部分一致で候補が出る", () => {
    expect(codes("フラ")).toContain("FR");
  });

  test("ひらがなで入力してもカタカナの国名に一致する", () => {
    expect(codes("ふらんす")).toContain("FR");
  });

  test("ISO 3166-1 にない地域も日本語名で候補に出る", () => {
    expect(codes("きぷろす")).toEqual(expect.arrayContaining(["CY", "XN"]));
    expect(codes("きたきぷろす")).toEqual(["XN"]);
    expect(codes("ソマリランド")).toContain("XS");
    expect(codes("コソボ")).toEqual(["XK"]);
  });

  test("一般的な呼び名で該当する国が出る", () => {
    expect(codes("韓国")).toContain("KR");
    expect(codes("中国")).toContain("CN");
    expect(codes("北朝鮮")).toContain("KP");
  });

  test("前方一致する国を先に並べる", () => {
    // 「ギニア」「ギニアビサウ」が先、「パプアニューギニア」「赤道ギニア」は後ろ
    const result = codes("ギニア");
    expect(result[0]).toBe("GN");
    expect(result).toContain("PG");
    expect(result.indexOf("PG")).toBeGreaterThan(result.indexOf("GN"));
  });

  test("最大 8 件に絞る", () => {
    expect(searchCountries("ア").length).toBe(8);
  });

  test("一致しない文字列や空の入力では候補が空になる", () => {
    expect(searchCountries("該当しない国")).toEqual([]);
    expect(searchCountries("  ")).toEqual([]);
  });
});

describe("displayCountryCode", () => {
  test("ISO 3166-1 にない地域は決められた表示にし、それ以外はコードをそのまま返す", () => {
    expect(displayCountryCode("XK")).toBe("XK");
    expect(displayCountryCode("XN")).toBe("--");
    expect(displayCountryCode("XS")).toBe("--");
    expect(displayCountryCode("JP")).toBe("JP");
  });
});
