import type { VisitRecord } from "../records/visitRecords";
import { buildVisits, type Visit } from "./visits";

type YearEntry = {
  readonly year: number;
  /** その年に初めて訪れた国（alpha-2、その年の訪問順） */
  readonly newCountries: readonly string[];
  /** その年に再訪した国（以前の年にも記録がある国。alpha-2、その年の訪問順） */
  readonly revisitedCountries: readonly string[];
  /** その年までの累計の訪問国 */
  readonly cumulative: ReadonlySet<string>;
};

export type Timeline = {
  readonly years: readonly YearEntry[];
  /** 1 か国ずつの表示で使う、訪問の並び（年の古い順、同じ年の中は訪問順。再訪を含む） */
  readonly visits: readonly Visit[];
  readonly summary: {
    readonly firstYear: number;
    readonly lastYear: number;
    /** 訪れたすべての国（alpha-2、初めて訪れた順＝初めて訪れた年の古い順、同じ年の中は訪問順） */
    readonly countries: readonly string[];
  };
};

/**
 * 訪問記録から年ごとのタイムラインを作る。記録がなければ undefined。
 * 同じ国を複数年に訪れた場合は、最初の年だけ「初めて訪れた国」として数える。
 * 同じ年の中の訪問順は記録の配列の並び（visitRecords.ts）なので、年で絞り込んだ並びをそのまま使う。
 */
export function buildTimeline(records: readonly VisitRecord[]): Timeline | undefined {
  const years = [...new Set(records.map((r) => r.year))].toSorted((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years.at(-1);
  if (firstYear === undefined || lastYear === undefined) {
    return undefined;
  }
  const seen = new Set<string>();
  const entries = years.map((year): YearEntry => {
    const countries = records.filter((r) => r.year === year).map((r) => r.country);
    const newCountries = countries.filter((c) => !seen.has(c));
    const revisitedCountries = countries.filter((c) => seen.has(c));
    for (const country of newCountries) {
      seen.add(country);
    }
    return {
      year,
      newCountries,
      revisitedCountries,
      cumulative: new Set(seen),
    };
  });
  return {
    years: entries,
    visits: buildVisits(records),
    summary: { firstYear, lastYear, countries: [...seen] },
  };
}
