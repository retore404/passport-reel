import { useState } from "react";
import { browserStorage, loadRecords, saveRecords } from "./storage";
import { addRecord, moveRecord, removeRecord, type VisitRecord } from "./visitRecords";

export type VisitRecordsState = {
  readonly records: readonly VisitRecord[];
  /** 端末内に保存できているか。false のときは表示中のメモリ上だけで記録を扱っている。 */
  readonly persistent: boolean;
  readonly add: (record: VisitRecord) => void;
  readonly remove: (record: VisitRecord) => void;
  /** 記録 from を、同じ年の記録 to の位置へ移す（同じ年の中の訪問順を変える）。 */
  readonly move: (from: VisitRecord, to: VisitRecord) => void;
};

/**
 * 端末内に保存される訪問記録。
 * 保存は記録を変更したときだけ行い、読み込み時には書き込まない（読み取れなかった保存データを勝手に消さないため）。
 */
export function useVisitRecords(): VisitRecordsState {
  const [storage] = useState(browserStorage);
  const [initial] = useState(() => loadRecords(storage, new Date().getFullYear()));
  const [records, setRecords] = useState(initial.records);
  const [persistent, setPersistent] = useState(initial.persistent);

  function update(next: readonly VisitRecord[]) {
    if (next === records) {
      return;
    }
    setRecords(next);
    setPersistent(saveRecords(storage, next));
  }

  return {
    records,
    persistent,
    add: (record) => update(addRecord(records, record)),
    remove: (record) => update(removeRecord(records, record)),
    move: (from, to) => update(moveRecord(records, from, to)),
  };
}
