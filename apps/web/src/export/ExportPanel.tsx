import { useState } from "react";
import { FRAME_HEIGHT, FRAME_WIDTH } from "../timeline/drawFrame";
import type { Timeline } from "../timeline/timeline";
import { formatTime, totalDuration } from "../timeline/timing";
import { progressText } from "./frames";
import { saveVideo } from "./saveVideo";
import type { VideoExport } from "./useVideoExport";

type Props = {
  readonly timeline: Timeline;
  readonly videoExport: VideoExport;
  /** 書き出しを始めるときに呼ぶ（プレビューの再生を止めるため）。 */
  readonly onStart: () => void;
};

const SAVE_MESSAGES = {
  shared: "共有しました。",
  downloaded: "ダウンロードしました。",
  dismissed: undefined,
} as const;

/** 動画の書き出しボタンと、書き出し中の進捗・完了・非対応・失敗の表示。 */
export function ExportPanel({ timeline, videoExport, onStart }: Props) {
  const { state, start, cancel, reset } = videoExport;
  const [saveMessage, setSaveMessage] = useState<string>();

  function handleStart() {
    setSaveMessage(undefined);
    onStart();
    start();
  }

  if (state.status === "checking" || state.status === "unsupported" || state.status === "ready") {
    return (
      <div className="export-panel">
        <button
          type="button"
          className="button button--primary button--block"
          disabled={state.status !== "ready"}
          onClick={handleStart}
        >
          {state.status === "checking" ? "書き出し方法を確認中…" : "動画を書き出す"}
        </button>
        {state.status === "unsupported" && (
          <p className="export-error">
            この環境では動画を書き出せません。PC・Android の Chrome、iPhone の Safari
            で書き出せます。
          </p>
        )}
      </div>
    );
  }

  if (state.status === "exporting") {
    return (
      <div className="export-panel">
        <p className="export-heading">動画を書き出しています</p>
        <progress className="export-progress" value={state.done} max={state.total}>
          {progressText(state.done, state.total)}
        </progress>
        <p className="export-detail">{progressText(state.done, state.total)}</p>
        <button type="button" className="button button--secondary button--block" onClick={cancel}>
          キャンセル
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="export-panel">
        <p className="export-error">書き出しに失敗しました（{state.message}）。</p>
        <button
          type="button"
          className="button button--primary button--block"
          onClick={handleStart}
        >
          もう一度書き出す
        </button>
      </div>
    );
  }

  const { file, format } = state;
  return (
    <div className="export-panel">
      <p className="export-heading">書き出しが完了しました</p>
      <dl className="export-info">
        <dt>ファイル名</dt>
        <dd>{file.name}</dd>
        <dt>長さ</dt>
        <dd>{formatTime(totalDuration(timeline))}</dd>
        <dt>解像度</dt>
        <dd>
          {FRAME_WIDTH}×{FRAME_HEIGHT}
        </dd>
        <dt>形式</dt>
        <dd>{format.label}</dd>
      </dl>
      <button
        type="button"
        className="button button--primary button--block"
        onClick={() => {
          saveVideo(file, navigator).then(
            (result) => setSaveMessage(SAVE_MESSAGES[result]),
            (error: unknown) => setSaveMessage(`保存できませんでした（${String(error)}）。`),
          );
        }}
      >
        共有・保存
      </button>
      {saveMessage && <output className="export-detail">{saveMessage}</output>}
      <button
        type="button"
        className="button button--secondary button--block"
        onClick={() => {
          setSaveMessage(undefined);
          reset();
        }}
      >
        閉じる
      </button>
    </div>
  );
}
