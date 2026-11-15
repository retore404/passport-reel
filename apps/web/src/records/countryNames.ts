import { getNames, registerLocale } from "i18n-iso-countries";
import ja from "i18n-iso-countries/langs/ja.json";
import { UNRECOGNIZED_STATES } from "./unrecognizedStates";

registerLocale(ja);

export type CountryName = {
  /** ISO 3166-1 alpha-2 */
  readonly code: string;
  /** 表示に使う日本語名（i18n-iso-countries の日本語データの名称） */
  readonly name: string;
};

/**
 * 日本語データの名称と異なる、一般的な呼び名や読み。
 * 日本語データは「大韓民国」「中華人民共和国」のような正式名称が多く、普段の呼び名では部分一致しないものだけを持つ。
 * 国名の一部が漢字でひらがなの入力に一致しないもののうち、必要なものは読みのカタカナも持つ。
 */
export const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  KR: ["韓国"],
  KP: ["北朝鮮"],
  CN: ["中国"],
  US: ["米国"],
  GB: ["英国"],
  SZ: ["エスワティニ"],
  XN: ["キタキプロス"],
};

const isoNames = getNames("ja");

/**
 * 日本語名を持つすべての国。表示順は日本語名の順。
 * 国として扱う ISO 3166-1 にない地域のうち、日本語データにない地域（XK は収録済み）を足している。
 */
export const COUNTRY_NAMES: readonly CountryName[] = [
  ...Object.entries(isoNames).map(([code, name]) => ({ code, name })),
  ...UNRECOGNIZED_STATES.filter(({ code }) => !(code in isoNames)).map(({ code, name }) => ({
    code,
    name,
  })),
].toSorted((a, b) => a.name.localeCompare(b.name, "ja"));

const nameByCode = new Map(COUNTRY_NAMES.map(({ code, name }) => [code, name]));

/** 国コードの日本語名。日本語名を持たないコードはコードをそのまま返す。 */
export function countryName(code: string): string {
  return nameByCode.get(code) ?? code;
}

const displayCodeByCode = new Map(
  UNRECOGNIZED_STATES.map(({ code, displayCode }) => [code, displayCode]),
);

/** 一覧や候補で国コードとして表示する文字列。ISO 3166-1 にない地域は ID ではなく決められた表示（"--" など）にする。 */
export function displayCountryCode(code: string): string {
  return displayCodeByCode.get(code) ?? code;
}

/**
 * 検索用に文字列をそろえる。
 * 全角・半角の違い（NFKC）とひらがな・カタカナの違いをなくし、表記が揺れやすい中黒と空白を除く。
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[・\s]/g, "");
}

const searchIndex = COUNTRY_NAMES.map((country) => ({
  country,
  keys: [country.name, ...(COUNTRY_ALIASES[country.code] ?? [])].map(normalizeForSearch),
}));

const MAX_CANDIDATES = 8;

/** 日本語名と一般的な呼び名に部分一致する国を、前方一致を先にして最大 8 件返す。 */
export function searchCountries(query: string): readonly CountryName[] {
  const normalized = normalizeForSearch(query);
  if (normalized === "") {
    return [];
  }
  const matched = searchIndex.filter(({ keys }) => keys.some((key) => key.includes(normalized)));
  const isPrefix = ({ keys }: (typeof searchIndex)[number]) =>
    keys.some((key) => key.startsWith(normalized));
  return [...matched.filter(isPrefix), ...matched.filter((entry) => !isPrefix(entry))]
    .slice(0, MAX_CANDIDATES)
    .map(({ country }) => country);
}
