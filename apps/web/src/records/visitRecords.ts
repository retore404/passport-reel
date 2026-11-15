/**
 * 1件の訪問記録。記録の同一性は年と国の組で決まるため ID は持たない。
 * country は ISO 3166-1 alpha-2。
 */
export type VisitRecord = { readonly year: number; readonly country: string };

export type YearGroup = { readonly year: number; readonly records: readonly VisitRecord[] };

/** 年の選択肢の下限。上限は現在の年。 */
export const MIN_YEAR = 1900;

export function hasRecord(records: readonly VisitRecord[], record: VisitRecord): boolean {
  return records.some((r) => r.year === record.year && r.country === record.country);
}

/** 記録を追加した新しい配列を返す。同じ年・同じ国の組が既にあれば元の配列をそのまま返す。 */
export function addRecord(
  records: readonly VisitRecord[],
  record: VisitRecord,
): readonly VisitRecord[] {
  return hasRecord(records, record) ? records : [...records, record];
}

export function removeRecord(
  records: readonly VisitRecord[],
  record: VisitRecord,
): readonly VisitRecord[] {
  return records.filter((r) => r.year !== record.year || r.country !== record.country);
}

function sameRecord(a: VisitRecord, b: VisitRecord): boolean {
  return a.year === b.year && a.country === b.country;
}

/**
 * 記録 from を、同じ年の記録 to の位置へ移した新しい配列を返す（to は後ろへずれるか前へ詰まる）。
 * 同じ年の中の訪問順は「配列の中で同じ年の記録が並ぶ順」で表すため、その年の記録が占める位置の集合は変えず、
 * 中身だけを並べ替える。別の年の記録の位置は変わらない。年が違う・同じ記録・見つからない場合は元の配列を返す。
 */
export function moveRecord(
  records: readonly VisitRecord[],
  from: VisitRecord,
  to: VisitRecord,
): readonly VisitRecord[] {
  if (from.year !== to.year || sameRecord(from, to)) {
    return records;
  }
  const slots = records.flatMap((r, index) => (r.year === from.year ? [index] : []));
  const group = records.filter((r) => r.year === from.year);
  const fromIndex = group.findIndex((r) => sameRecord(r, from));
  const toIndex = group.findIndex((r) => sameRecord(r, to));
  const moving = group[fromIndex];
  if (moving === undefined || toIndex < 0) {
    return records;
  }
  const moved = group.toSpliced(fromIndex, 1).toSpliced(toIndex, 0, moving);
  const next = [...records];
  slots.forEach((slot, i) => {
    const record = moved[i];
    if (record !== undefined) {
      next[slot] = record;
    }
  });
  return next;
}

/** 記録に含まれる国の集合。同じ国の複数年の記録は1か国になる。 */
export function visitedCountries(records: readonly VisitRecord[]): ReadonlySet<string> {
  return new Set(records.map((r) => r.country));
}

/** 年ごとにまとめ、新しい年を先にする。年の中は追加した順を保つ。 */
export function groupByYear(records: readonly VisitRecord[]): readonly YearGroup[] {
  const byYear = new Map<number, VisitRecord[]>();
  for (const record of records) {
    byYear.set(record.year, [...(byYear.get(record.year) ?? []), record]);
  }
  return [...byYear.entries()]
    .toSorted(([a], [b]) => b - a)
    .map(([year, grouped]) => ({ year, records: grouped }));
}

/** より前の年にも同じ国の記録があるか。 */
export function isRevisit(records: readonly VisitRecord[], record: VisitRecord): boolean {
  return records.some((r) => r.country === record.country && r.year < record.year);
}
