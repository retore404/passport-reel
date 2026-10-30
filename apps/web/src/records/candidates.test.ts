import { describe, expect, test } from "vitest";
import { isImeConfirmingEnter, soleSelectableCandidate } from "./candidates";
import type { CountryName } from "./countryNames";

const france: CountryName = { code: "FR", name: "フランス" };
const germany: CountryName = { code: "DE", name: "ドイツ" };
const notAdded = () => false;

describe("soleSelectableCandidate", () => {
  test("候補がなければ返さない", () => {
    expect(soleSelectableCandidate([], notAdded)).toBeUndefined();
  });

  test("候補が 1 か国ならその国を返す", () => {
    expect(soleSelectableCandidate([france], notAdded)).toBe(france);
  });

  test("追加済みを除いて 1 か国ならその国を返す", () => {
    expect(soleSelectableCandidate([germany, france], (code) => code === "DE")).toBe(france);
  });

  test("唯一の候補が追加済みなら返さない", () => {
    expect(soleSelectableCandidate([france], () => true)).toBeUndefined();
  });

  test("選べる候補が複数なら返さない", () => {
    expect(soleSelectableCandidate([germany, france], notAdded)).toBeUndefined();
  });
});

describe("isImeConfirmingEnter", () => {
  test("変換中の Enter は変換確定とみなす", () => {
    expect(isImeConfirmingEnter({ key: "Enter", isComposing: true, keyCode: 13 })).toBe(true);
  });

  test("keyCode が 229 の Enter は変換確定とみなす（Safari）", () => {
    expect(isImeConfirmingEnter({ key: "Enter", isComposing: false, keyCode: 229 })).toBe(true);
  });

  test("通常の Enter は変換確定とみなさない", () => {
    expect(isImeConfirmingEnter({ key: "Enter", isComposing: false, keyCode: 13 })).toBe(false);
  });

  test("Enter 以外のキーは変換確定とみなさない", () => {
    expect(isImeConfirmingEnter({ key: "a", isComposing: true, keyCode: 229 })).toBe(false);
  });
});
