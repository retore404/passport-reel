/** Vite の build.license が JSON で書き出す、同梱した依存パッケージ1つ分のライセンス情報。 */
export type LicenseEntry = {
  readonly name: string;
  readonly version: string;
  /** package.json の license（SPDX 識別子）。書かれていないパッケージでは無い。 */
  readonly identifier?: string;
  /** パッケージに含まれる LICENSE ファイルの本文。ファイルが無いパッケージでは無い。 */
  readonly text?: string;
};

/** ビルド時に生成され、配信ルート直下に置かれる（vite.config.ts の build.license）。 */
export const LICENSES_URL = `${import.meta.env.BASE_URL}third-party-licenses.json`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isLicenseEntry(value: unknown): value is LicenseEntry {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    isOptionalString(value.identifier) &&
    isOptionalString(value.text)
  );
}

/** 取得した JSON を検証する。形式が想定と違えば、一部だけ表示して欠けたまま見せないよう null を返す。 */
export function parseLicenses(json: unknown): LicenseEntry[] | null {
  if (!Array.isArray(json) || !json.every(isLicenseEntry)) {
    return null;
  }
  return json;
}

/**
 * パッケージのソースコードの入手先として、npm のその版のページを返す。
 * MPL-2.0 は実行形式で配布するとき、受け取った人にソースの入手方法を知らせることを求める（3.2 条）。
 * 同梱しているのは npm から取得した版そのものなので、その版のページを入手先として示す。
 */
export function sourceUrl({ name, version }: LicenseEntry): string {
  return `https://www.npmjs.com/package/${name}/v/${version}`;
}
