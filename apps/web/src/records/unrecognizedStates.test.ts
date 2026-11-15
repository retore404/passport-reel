import { getNames, registerLocale } from "i18n-iso-countries";
import ja from "i18n-iso-countries/langs/ja.json";
import { describe, expect, test } from "vitest";
import { UNRECOGNIZED_STATES } from "./unrecognizedStates";

registerLocale(ja);

describe("UNRECOGNIZED_STATES", () => {
  test("ID は ISO 3166-1 の利用者割当範囲 XA–XZ の一意な 2 文字である", () => {
    const codes = UNRECOGNIZED_STATES.map(({ code }) => code);
    expect(codes.every((code) => /^X[A-Z]$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("国名データに収録されている地域だけ ID をそのまま表示し、それ以外は -- を表示する", () => {
    const known = getNames("ja");
    for (const { code, displayCode } of UNRECOGNIZED_STATES) {
      expect(displayCode).toBe(code in known ? code : "--");
    }
  });
});
