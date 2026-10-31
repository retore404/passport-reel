import { describe, expect, test } from "vitest";
import { parseLicenses, sourceUrl } from "./thirdPartyLicenses";

describe("parseLicenses", () => {
  test("Vite が書き出す形式の一覧をそのまま返す", () => {
    const json = [
      {
        name: "mediabunny",
        version: "1.62.0",
        identifier: "MPL-2.0",
        text: "Mozilla Public License",
      },
      { name: "no-license-file", version: "1.0.0" },
    ];

    expect(parseLicenses(json)).toEqual(json);
  });

  test("配列でなければ null を返す", () => {
    expect(parseLicenses({ name: "react", version: "19.3.1" })).toBeNull();
  });

  test("形式の違う項目が1つでもあれば null を返す", () => {
    expect(
      parseLicenses([
        { name: "react", version: "19.3.1" },
        { name: "broken", version: 1 },
      ]),
    ).toBeNull();
  });
});

describe("sourceUrl", () => {
  test("npm のその版のページを返す", () => {
    expect(sourceUrl({ name: "@scope/pkg", version: "1.0.0" })).toBe(
      "https://www.npmjs.com/package/@scope/pkg/v/1.0.0",
    );
  });
});
