import { useState } from "react";
import { RecordsScreen } from "./records/RecordsScreen";
import { useVisitRecords } from "./records/useVisitRecords";
import { PreviewScreen } from "./timeline/PreviewScreen";
import { useMediaQuery } from "./useMediaQuery";

/** PC とスマートフォンで画面構成を切り替える幅。docs/design-guidelines.md の「レイアウト」に対応する。 */
const WIDE_QUERY = "(min-width: 768px)";

type View = "records" | "preview";

const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: "records", label: "記録" },
  { id: "preview", label: "プレビュー" },
];

export function App() {
  // 記録は画面を切り替えても保つため、各画面ではなくここで持つ
  const visitRecords = useVisitRecords();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [view, setView] = useState<View>("records");

  // PC は上部バーの切り替えボタン、スマートフォンは画面下のタブで切り替える
  const viewSwitch = (
    <nav className={isWide ? "view-switch" : "tab-bar"} aria-label="画面の切り替え">
      {VIEWS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={isWide ? "view-switch-button" : "tab-button"}
          aria-current={view === id ? "page" : undefined}
          onClick={() => setView(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-logo" aria-hidden="true" />
          Passport Reel
        </h1>
        {isWide && viewSwitch}
      </header>
      <main className="view">
        {view === "records" ? (
          <RecordsScreen visitRecords={visitRecords} wide={isWide} />
        ) : (
          <PreviewScreen records={visitRecords.records} wide={isWide} />
        )}
      </main>
      {!isWide && viewSwitch}
    </div>
  );
}
