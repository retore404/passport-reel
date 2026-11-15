import type { VisitRecord } from "../records/visitRecords";

/** 1 か国ずつの表示で 1 コマになる、1 件の訪問。 */
export type Visit = {
  readonly year: number;
  /** ISO 3166-1 alpha-2 */
  readonly country: string;
  /** 初めて訪れた国の連番（1 始まり）。再訪では undefined（再訪は数えない） */
  readonly ordinal: number | undefined;
  /** この訪問の前の累計の訪問国の数 */
  readonly before: number;
  /** この訪問の後の累計の訪問国の数（再訪なら before と同じ） */
  readonly after: number;
};

/**
 * 記録を、年の古い順・同じ年の中は訪問順に並べた訪問の並びにする。再訪も 1 件の訪問として含める。
 * 同じ年の中の訪問順は記録の配列の並び（visitRecords.ts）なので、年だけで安定ソートする。
 */
export function buildVisits(records: readonly VisitRecord[]): readonly Visit[] {
  const seen = new Set<string>();
  return records
    .toSorted((a, b) => a.year - b.year)
    .map(({ year, country }) => {
      const before = seen.size;
      const first = !seen.has(country);
      seen.add(country);
      return { year, country, ordinal: first ? seen.size : undefined, before, after: seen.size };
    });
}
