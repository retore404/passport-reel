import { useCallback, useMemo, useState } from "react";
import { RecordForm } from "./records/RecordForm";
import { RecordList } from "./records/RecordList";
import { useVisitRecords } from "./records/useVisitRecords";
import { visitedCountries } from "./records/visitRecords";
import { Sheet } from "./Sheet";
import { useMediaQuery } from "./useMediaQuery";
import { WorldMapCanvas } from "./WorldMapCanvas";

/** PC とスマートフォンで画面構成を切り替える幅。docs/design-guidelines.md の「レイアウト」に対応する。 */
const WIDE_QUERY = "(min-width: 768px)";

export function App() {
  const { records, persistent, add, remove } = useVisitRecords();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  // 地図は visited が変わるたびに描き直すため、入力中の再描画で作り直さないよう記録が変わったときだけ求める
  const visited = useMemo(() => visitedCountries(records), [records]);

  const notice = !persistent && (
    <output className="notice">
      この端末では記録を保存できません。ページを閉じると記録は消えます。
    </output>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-logo" aria-hidden="true" />
          Passport Reel
        </h1>
      </header>
      <div className={isWide ? "records-wide" : "records-narrow"}>
        {isWide && (
          <aside className="records-panel" aria-label="訪問記録">
            <RecordForm records={records} onAdd={add} layout="inline" />
            {notice}
            <div className="records-scroll">
              <RecordList
                records={records}
                onRemove={remove}
                emptyHint="上の入力欄で年と国を選んで追加してください。"
              />
            </div>
          </aside>
        )}
        <main className="map-stage">
          <WorldMapCanvas visited={visited} />
          <p className="visited-count">
            <span className="visited-count-number">{visited.size}</span>
            か国
          </p>
        </main>
        {!isWide && (
          <>
            <section className="records-scroll" aria-label="訪問記録">
              {notice}
              <RecordList
                records={records}
                onRemove={remove}
                emptyHint="「＋ 記録を追加」から訪れた国を登録してください。"
              />
            </section>
            <div className="bottom-bar">
              <button
                type="button"
                className="button button--primary button--block"
                onClick={() => setSheetOpen(true)}
              >
                ＋ 記録を追加
              </button>
            </div>
            {sheetOpen && (
              <Sheet title="記録を追加" onClose={closeSheet}>
                <RecordForm records={records} onAdd={add} layout="stacked" />
              </Sheet>
            )}
          </>
        )}
      </div>
    </div>
  );
}
